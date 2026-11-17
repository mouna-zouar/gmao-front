import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, ChevronDown, ChevronRight, FolderTree, LoaderCircle, Search, X } from 'lucide-react';
import parametreService from '../../../services/parametreService';
import { arbreFamilles, lignesArbre, basculerDansSet } from '../../../utils/arbreFamilles';
import { t, locale } from '../../../i18n';
import './FiltreFamilleArbre.css';

/*
 * Filtre « Famille » de la liste des équipements, présenté comme dans Paramètres système :
 *   familles parentes → (clic) sous-familles → (clic) articles.
 * Un clic sur le nom choisit le filtre ; la flèche affiche / cache le contenu.
 *
 * equipements : [{ lotArticleImmobilistationId, familleId, familleNom }]
 * valeur / onChange :
 *   null                                   toutes les familles
 *   { type: 'aucune' }                     équipements sans famille
 *   { type: 'famille', id, nom, familles } la famille et ses sous-familles (familles : Set d'ID texte)
 *   { type: 'article', id, nom, immobilisations } un article (immobilisations : Set d'ID texte)
 */

/** L'équipement passe-t-il le filtre famille / article ? */
export function filtrerParFamille(valeur, e) {
  if (!valeur) return true;
  if (valeur.type === 'aucune') return e.familleId == null;
  if (valeur.type === 'famille') return e.familleId != null && valeur.familles.has(String(e.familleId));
  if (valeur.type === 'article') return valeur.immobilisations.has(String(e.lotArticleImmobilistationId));
  return true;
}

export default function FiltreFamilleArbre({ equipements, valeur, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const [famillesCubix, setFamillesCubix] = useState(null); // null = pas encore lues
  const [erreurCubix, setErreurCubix] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [ouverts, setOuverts] = useState(() => new Set());
  const [articles, setArticles] = useState({}); // { familleId: 'chargement' | 'erreur' | [...] }
  const plier = basculerDansSet(setOuverts);
  const racine = useRef(null);

  // Familles Cubix (avec leur parent) : lues à la première ouverture du filtre
  useEffect(() => {
    if (!ouvert || famillesCubix !== null) return;
    parametreService.getFamillesCubix()
      .then((l) => setFamillesCubix(l.filter((f) => f.id != null)))
      .catch(() => { setFamillesCubix([]); setErreurCubix(true); });
  }, [ouvert, famillesCubix]);

  // Fermeture : clic à l'extérieur ou Échap
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (ev) => { if (racine.current && !racine.current.contains(ev.target)) setOuvert(false); };
    const echap = (ev) => { if (ev.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [ouvert]);

  // Nombre d'équipements de la liste par famille, et équipements sans famille
  const { parFamille, sansFamille, idsListe } = useMemo(() => {
    const m = new Map();
    let sans = 0;
    (equipements || []).forEach((e) => {
      if (e.familleId == null) { sans += 1; return; }
      const cle = String(e.familleId);
      const f = m.get(cle) || { id: e.familleId, nom: e.familleNom, n: 0 };
      f.n += 1;
      m.set(cle, f);
    });
    return { parFamille: m, sansFamille: sans, idsListe: new Set((equipements || []).map((e) => String(e.lotArticleImmobilistationId))) };
  }, [equipements]);

  // Arbre : hiérarchie lue dans Cubix, nombres = équipements de la liste ; les familles vides sont cachées
  const arbre = useMemo(() => {
    const cubix = famillesCubix || [];
    const connues = new Set(cubix.map((f) => String(f.id)));
    const toutes = [
      ...cubix.map((f) => ({ ...f, nombre: parFamille.get(String(f.id))?.n || 0 })),
      // Familles des équipements que Cubix n'a pas renvoyées : à la racine
      ...[...parFamille.entries()].filter(([cle]) => !connues.has(cle))
        .map(([, f]) => ({ id: f.id, nom: f.nom, nombre: f.n, parentId: null })),
    ];
    const elaguer = (l) => l.filter((n) => n.total > 0).map((n) => ({ ...n, enfants: elaguer(n.enfants) }));
    return elaguer(arbreFamilles(toutes));
  }, [famillesCubix, parFamille]);

  const chargerArticles = (familleId) => {
    const cle = String(familleId);
    if (articles[cle] && articles[cle] !== 'erreur') return;
    setArticles((x) => ({ ...x, [cle]: 'chargement' }));
    parametreService.getArticlesFamilleCubix(familleId)
      .then((l) => setArticles((x) => ({
        ...x,
        // Seulement les articles qui ont des équipements dans la liste, avec ce nombre-là
        [cle]: l.map((a) => ({ ...a, dansListe: a.immobilisations.filter((id) => idsListe.has(id)).length }))
          .filter((a) => a.dansListe > 0),
      })))
      .catch(() => setArticles((x) => ({ ...x, [cle]: 'erreur' })));
  };

  const ouvrirFermer = (n) => {
    const cle = String(n.id);
    const aArticles = !n.virtuel && n.nombre > 0;
    if (aArticles && !ouverts.has(cle)) chargerArticles(n.id);
    plier(cle);
  };

  const choisir = (v) => { onChange(v); setOuvert(false); };
  const choisirFamille = (n) => choisir({ type: 'famille', id: n.id, nom: n.nom, familles: new Set(n.ids) });
  const choisirArticle = (a) => choisir({
    type: 'article', id: a.id, nom: a.designation || a.code || `#${a.id}`, immobilisations: new Set(a.immobilisations),
  });

  const fmt = (n) => Number(n || 0).toLocaleString(locale());
  const total = (equipements || []).length;
  const libelle = !valeur ? t('Toutes les familles')
    : valeur.type === 'aucune' ? t('Sans famille')
      : valeur.nom || `#${valeur.id}`;
  const lignes = lignesArbre(arbre, ouverts, recherche);
  const estChoisi = (type, id) => valeur?.type === type && String(valeur.id) === String(id);

  return (
    <div className="ffa" ref={racine}>
      <button type="button" className={`ffa-bouton ${valeur ? 'is-actif' : ''}`} onClick={() => setOuvert((o) => !o)}
        aria-haspopup="true" aria-expanded={ouvert} title={t('Filtrer par famille')}>
        <FolderTree size={14} aria-hidden="true" />
        <span className="ffa-bouton-texte">
          {valeur?.type === 'article' && <small>{t('Article')} : </small>}
          {libelle}
        </span>
        {valeur ? (
          <span className="ffa-effacer" role="button" tabIndex={0} aria-label={t('Toutes les familles')}
            onClick={(ev) => { ev.stopPropagation(); onChange(null); }}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onChange(null); } }}>
            <X size={13} />
          </span>
        ) : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {ouvert && (
        <div className="ffa-panneau" role="dialog" aria-label={t('Filtrer par famille')}>
          <label className="ffa-recherche">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={recherche} onChange={(ev) => setRecherche(ev.target.value)} autoFocus
              placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille…')} />
          </label>

          <ul className="ffa-liste">
            <li>
              <button type="button" className={`ffa-ligne ffa-ligne--tout ${!valeur ? 'is-choisi' : ''}`} onClick={() => choisir(null)}>
                <span className="ffa-nom">{t('Toutes les familles')}</span>
                <span className="ffa-n">{fmt(total)}</span>
              </button>
            </li>

            {famillesCubix === null && (
              <li className="ffa-info"><LoaderCircle size={13} className="ffa-tourne" /> {t('Recherche dans Cubix…')}</li>
            )}
            {erreurCubix && (
              <li className="ffa-info ffa-info--erreur"><AlertTriangle size={13} /> {t('Familles parentes indisponibles (Cubix) : liste à plat.')}</li>
            )}

            {lignes.map(({ noeud: n, niveau, ouvert: deplie }) => {
              const cle = String(n.id);
              const aArticles = !n.virtuel && n.nombre > 0;
              const ouvrable = n.enfants.length > 0 || aArticles;
              const arts = articles[cle];
              return [
                <li key={`f-${cle}`} style={{ '--niveau': niveau }} className={niveau === 0 ? 'is-racine' : 'is-fils'}>
                  {ouvrable ? (
                    <button type="button" className="ffa-fleche" onClick={() => ouvrirFermer(n)} aria-expanded={deplie}
                      aria-label={deplie ? t('Cacher le détail') : (n.enfants.length ? t('Afficher les sous-familles') : t('Afficher les articles'))}>
                      {deplie ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : <span className="ffa-fleche ffa-fleche--vide" aria-hidden="true" />}
                  <button type="button" className={`ffa-ligne ${estChoisi('famille', n.id) ? 'is-choisi' : ''}`}
                    onClick={() => choisirFamille(n)} title={t('Afficher les équipements de cette famille')}>
                    <span className="ffa-nom">
                      {n.nom || t('Famille #{id}', { id: cle })}
                      {n.enfants.length > 0 && <small> · {t('{n} sous-famille(s)', { n: n.enfants.length })}</small>}
                    </span>
                    <span className="ffa-n">{fmt(n.total)}</span>
                  </button>
                </li>,
                // Articles de la famille, sous ses sous-familles
                aArticles && deplie && ouverts.has(cle) && (
                  arts === 'chargement' || arts === undefined ? (
                    <li key={`a-${cle}`} className="ffa-info" style={{ '--niveau': niveau + 1 }}>
                      <LoaderCircle size={13} className="ffa-tourne" /> {t('Chargement des articles…')}
                    </li>
                  ) : arts === 'erreur' ? (
                    <li key={`a-${cle}`} className="ffa-info ffa-info--erreur" style={{ '--niveau': niveau + 1 }}>
                      <AlertTriangle size={13} /> {t('Impossible de lire les articles dans Cubix.')}
                    </li>
                  ) : arts.map((a) => (
                    <li key={`a-${cle}-${a.id}`} className="is-article" style={{ '--niveau': niveau + 1 }}>
                      <span className="ffa-fleche ffa-fleche--vide" aria-hidden="true" />
                      <button type="button" className={`ffa-ligne ffa-ligne--article ${estChoisi('article', a.id) ? 'is-choisi' : ''}`}
                        onClick={() => choisirArticle(a)} title={a.code ? `${a.designation || ''} (${a.code})` : a.designation || ''}>
                        <Boxes size={12} aria-hidden="true" />
                        <span className="ffa-nom">{a.designation || `#${a.id}`}</span>
                        {a.code && <span className="ffa-code">{a.code}</span>}
                        <span className="ffa-n">{fmt(a.dansListe)}</span>
                      </button>
                    </li>
                  ))
                ),
              ];
            })}

            {sansFamille > 0 && (
              <li className="is-racine">
                <button type="button" className={`ffa-ligne ${valeur?.type === 'aucune' ? 'is-choisi' : ''}`} onClick={() => choisir({ type: 'aucune' })}>
                  <span className="ffa-nom">{t('Sans famille')}</span>
                  <span className="ffa-n">{fmt(sansFamille)}</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
