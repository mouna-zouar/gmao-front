import { useEffect, useMemo, useState, Fragment } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Building2,
  LoaderCircle,
  Search,
  Boxes,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import parametreService from '../../../services/parametreService';
import prestataireService from '../../../services/prestataireService';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import { arbreFamilles } from '../../../utils/arbreFamilles';

const nomPrestataire = (p) => (p ? (p.raisonSociale || `${p.nom || ''} ${p.prenom || ''}`.trim() || null) : null);

function ChampPrestataire({ param, valeur, onChange }) {
  const id = Number(valeur) || 0;
  const [etat, setEtat] = useState({ statut: 'vide' });
  const contexte = authService.getContexteMetier();
  const monId = Number(contexte.prestataireId) || 0;

  useEffect(() => {
    if (id <= 0) { setEtat({ statut: 'vide' }); return undefined; }
    let annule = false;
    setEtat({ statut: 'chargement' });
    const minuterie = setTimeout(() => {
      prestataireService.getById(id)
        .then((p) => { if (!annule) setEtat({ statut: 'ok', nom: nomPrestataire(p) || t('Prestataire #{id}', { id }) }); })
        .catch(() => { if (!annule) setEtat({ statut: 'introuvable' }); });
    }, 400);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [id]);

  return (
    <div className="ps-presta">
      <div className="ps-presta-ligne">
        <input
          id={`ps-${param.cle}`}
          type="number"
          step="1"
          min={0}
          value={valeur ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`ps-${param.cle}-nom`}
        />
        {monId > 0 && monId !== id && (
          <button type="button" className="ps-action" onClick={() => onChange(String(monId))} title={t('Utiliser le prestataire de ma session')}>
            <Building2 size={13} /> {contexte.prestataireNom || t('Ma clinique')}
          </button>
        )}
      </div>
      <p id={`ps-${param.cle}-nom`} className={`ps-presta-nom ps-presta-nom--${etat.statut}`}>
        {etat.statut === 'chargement' && <><LoaderCircle size={13} className="ps-tourne" /> {t('Recherche dans Cubix…')}</>}
        {etat.statut === 'ok' && <><CheckCircle2 size={13} /> {etat.nom}</>}
        {etat.statut === 'introuvable' && <><AlertTriangle size={13} /> {t('Aucun prestataire avec cet ID dans Cubix.')}</>}
        {etat.statut === 'vide' && t('0 : prestataire de la session Cubix, sinon tous les prestataires (liste très longue).')}
      </p>
    </div>
  );
}

function ChampFamilles({ param, valeur, onChange, prestataireId }) {
  const [familles, setFamilles] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [ouverts, setOuverts] = useState(() => new Set());
  const [articlesFamille, setArticlesFamille] = useState({});
  useEffect(() => { setArticlesFamille({}); }, [prestataireId]);
  const chargerArticles = (familleId) => {
    const cle = String(familleId);
    if (articlesFamille[cle] && articlesFamille[cle] !== 'erreur') return;
    setArticlesFamille((x) => ({ ...x, [cle]: 'chargement' }));
    parametreService.getArticlesFamilleCubix(familleId, prestataireId)
      .then((l) => setArticlesFamille((x) => ({ ...x, [cle]: l })))
      .catch(() => setArticlesFamille((x) => ({ ...x, [cle]: 'erreur' })));
  };
  const choisies = useMemo(() => new Set(String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean)), [valeur]);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) { setFamilles([]); setErreur(t('Impossible de lire les familles dans Cubix.')); } });
    return () => { annule = true; };
  }, [prestataireId]);

  const arbre = useMemo(() => arbreFamilles(familles), [familles]);

  const basculer = (noeud) => {
    const n = new Set(choisies);
    const tous = noeud.ids.length > 0 && noeud.ids.every((id) => n.has(id));
    noeud.ids.forEach((id) => (tous ? n.delete(id) : n.add(id)));
    onChange([...n].join(','));
  };
  const plier = (cle, noeud) => {
    if (noeud && !noeud.virtuel && noeud.nombre > 0 && !ouverts.has(cle)) chargerArticles(noeud.id);
    plierSeul(cle);
  };
  const plierSeul = (cle) => setOuverts((avant) => {
    const n = new Set(avant);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return n;
  });

  const q = filtre.trim().toLowerCase();
  const correspond = (n) => !q || `${n.nom || ''} ${n.code || ''}`.toLowerCase().includes(q);
  const visible = (n, parentCorrespond) => parentCorrespond || correspond(n) || n.enfants.some((e) => visible(e, false));

  const total = (familles || []).reduce((s, f) => s + f.nombre, 0);
  const totalChoisi = (familles || []).filter((f) => choisies.has(String(f.id))).reduce((s, f) => s + f.nombre, 0);
  const fmt = (n) => n.toLocaleString(locale());

  const rendre = (n, niveau, parentCorrespond, chemin) => {
    if (chemin.has(n) || !visible(n, parentCorrespond)) return null;
    const suite = new Set(chemin).add(n);
    const cle = String(n.id);
    const nbCoches = n.ids.filter((id) => choisies.has(id)).length;
    const coche = n.ids.length > 0 && nbCoches === n.ids.length;
    const partiel = nbCoches > 0 && !coche;
    const aEnfants = n.enfants.length > 0;
    const aArticles = !n.virtuel && n.nombre > 0;
    const ouvrable = aEnfants || aArticles;
    const arts = articlesFamille[cle];
    const ouvert = q ? (ouverts.has(cle) || aEnfants) : ouverts.has(cle);
    return (
      <Fragment key={cle}>
        <li className={`ps-familles-noeud ${niveau === 0 ? 'is-racine' : 'is-fils'}`} style={{ '--niveau': niveau }}>
          {ouvrable ? (
            <button type="button" className="ps-familles-plier" onClick={() => plier(cle, n)}
              aria-expanded={ouvert} aria-label={ouvert ? t('Replier') : t('Déplier')}>
              {ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="ps-familles-plier ps-familles-plier--vide" aria-hidden="true" />}
          {ouvrable ? (
            <div className={`ps-familles-ligne ${coche ? 'is-coche' : partiel ? 'is-partiel' : ''} ${ouvert ? 'is-ouvert' : ''}`}>
              <input type="checkbox" checked={coche} disabled={n.ids.length === 0}
                ref={(el) => { if (el) el.indeterminate = partiel; }}
                onChange={() => basculer(n)}
                aria-label={t('Cocher {f} et ses sous-familles', { f: n.nom || t('Sans famille') })} />
              <button type="button" className="ps-familles-ouvrir" onClick={() => plier(cle, n)}
                aria-expanded={ouvert} title={ouvert ? t('Cacher le détail') : (aEnfants ? t('Afficher les sous-familles') : t('Afficher les articles'))}>
                <span className="ps-familles-nom">
                  {n.nom || t('Sans famille')}
                  <span className="ps-familles-sous">
                    {' · '}{aEnfants
                      ? t('{n} sous-famille(s)', { n: n.enfants.length })
                      : Array.isArray(arts) ? t('{n} article(s)', { n: arts.length }) : t('articles')}
                  </span>
                </span>
                <span className="ps-familles-n" title={aEnfants ? t('Avec les sous-familles') : undefined}>{fmt(n.total)}</span>
              </button>
            </div>
          ) : (
            <label className={coche ? 'is-coche' : ''}>
              <input type="checkbox" checked={coche} disabled={n.ids.length === 0} onChange={() => basculer(n)} />
              <span className="ps-familles-nom" title={n.code ? `${n.nom || ''} (${n.code})` : n.nom || ''}>{n.nom || t('Sans famille')}</span>
              <span className="ps-familles-n">{fmt(n.total)}</span>
            </label>
          )}
        </li>
        {aEnfants && ouvert && n.enfants.map((e) => rendre(e, niveau + 1, parentCorrespond || correspond(n), suite))}
        {aArticles && ouvert && ouverts.has(cle) && (
          arts === 'chargement' || arts === undefined ? (
            <li className="ps-familles-article is-info" style={{ '--niveau': niveau + 1 }}>
              <LoaderCircle size={13} className="ps-tourne" /> {t('Chargement des articles…')}
            </li>
          ) : arts === 'erreur' ? (
            <li className="ps-familles-article is-info is-erreur" style={{ '--niveau': niveau + 1 }}>
              <AlertTriangle size={13} /> {t('Impossible de lire les articles dans Cubix.')}
              <button type="button" className="ps-action" onClick={() => chargerArticles(n.id)}>{t('Réessayer')}</button>
            </li>
          ) : arts.length === 0 ? (
            <li className="ps-familles-article is-info" style={{ '--niveau': niveau + 1 }}>{t('Aucun article.')}</li>
          ) : arts.map((art) => (
            <li key={`a-${cle}-${art.id}`} className="ps-familles-article" style={{ '--niveau': niveau + 1 }}
              title={art.code ? `${art.designation || ''} (${art.code})` : art.designation || ''}>
              <Boxes size={12} aria-hidden="true" />
              <span className="ps-familles-nom">{art.designation || `#${art.id}`}</span>
              {art.code && <span className="ps-familles-code">{art.code}</span>}
              <span className="ps-familles-n">{fmt(art.nombre)}</span>
            </li>
          ))
        )}
      </Fragment>
    );
  };

  return (
    <div className="ps-familles">
      <div className="ps-familles-tete">
        <span className="ps-familles-resume">
          {choisies.size === 0
            ? t('Toutes les familles : {n} équipements', { n: fmt(total) })
            : t('{f} famille(s) cochée(s) : {n} équipements sur {total}', { f: choisies.size, n: fmt(totalChoisi), total: fmt(total) })}
        </span>
        {choisies.size > 0 && (
          <button type="button" className="ps-action" onClick={() => onChange('')}>{t('Tout décocher')}</button>
        )}
      </div>
      <label className="ps-familles-recherche">
        <Search size={14} aria-hidden="true" />
        <input type="text" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille…')} />
      </label>
      {familles === null ? (
        <p className="ps-presta-nom"><LoaderCircle size={13} className="ps-tourne" /> {t('Recherche dans Cubix…')}</p>
      ) : erreur ? (
        <p className="ps-presta-nom ps-presta-nom--introuvable"><AlertTriangle size={13} /> {erreur}</p>
      ) : (
        <ul className="ps-familles-liste ps-familles-arbre" id={`ps-${param.cle}`}>
          {arbre.map((r) => rendre(r, 0, false, new Set()))}
        </ul>
      )}
    </div>
  );
}

export function ChampValeur({ param, valeur, onChange, draft }) {
  const common = { id: `ps-${param.cle}`, value: valeur ?? '' };

  switch (param.type) {
    case 'PRESTATAIRE':
      return <ChampPrestataire param={param} valeur={valeur} onChange={onChange} />;
    case 'FAMILLES':
      return <ChampFamilles param={param} valeur={valeur} onChange={onChange} prestataireId={draft?.['cubix.prestataire_id']} />;
    case 'BOOLEEN':
      return (
        <label className="ps-switch">
          <input
            type="checkbox"
            checked={valeur === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          />
          <span className="ps-switch-track" />
          <span className="ps-switch-label">{valeur === 'true' ? t("Oui") : t("Non")}</span>
        </label>
      );
    case 'HEURE':
      return <input {...common} type="time" onChange={(e) => onChange(e.target.value)} />;
    case 'ENTIER':
      return (
        <input
          {...common}
          type="number"
          step="1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'DECIMAL':
      return (
        <input
          {...common}
          type="number"
          step="0.1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />;
  }
}
