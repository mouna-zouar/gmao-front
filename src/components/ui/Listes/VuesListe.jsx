import { useEffect, useMemo, useRef, useState } from 'react';
import { lire, ecrire } from './stockageVues';
import { Bookmark, BookmarkPlus, Check, ChevronDown, X } from 'lucide-react';
import { t } from '../../../i18n';
import './VuesListe.css';

/*
 * Vues d'une liste : des raccourcis prêts à l'emploi (« Mes bons en retard », « Urgents de mon service »…)
 * et les vues que l'utilisateur enregistre lui-même (vue de départ + recherche + état + tri).
 *
 *   const [vueId, setVueId] = useVueActive('bons', userKey, 'tous');
 *   <VuesListe liste="bons" userKey={userKey} vues={VUES} items={bons}
 *              vueActive={vueId} reglages={{ recherche, etat, tri, sens }}
 *              onChoisir={(id, reglages) => { setVueId(id); if (reglages) appliquer(reglages); }} />
 *
 * Les vues enregistrées restent dans ce navigateur (localStorage), propres à chaque utilisateur.
 *
 * max (facultatif) : nombre de vues affichées ; les autres (et les vues enregistrées) passent dans un menu « Plus ».
 * La vue active reste toujours visible.
 */

const memesReglages = (a = {}, b = {}) =>
  (a.recherche || '') === (b.recherche || '')
  && String(a.etat ?? 'all') === String(b.etat ?? 'all')
  && (a.tri || '') === (b.tri || '')
  && (a.sens || '') === (b.sens || '');

export default function VuesListe({ liste, userKey, vues, items, vueActive, reglages, onChoisir, chargement = false, max }) {
  const cle = `gmao-vues-${liste}-${userKey}`;
  const [perso, setPerso] = useState(() => lire(cle, []));
  const [saisie, setSaisie] = useState(null); // null = fermé, sinon le nom en cours
  const champ = useRef(null);
  const [plusOuvert, setPlusOuvert] = useState(false);
  const zonePlus = useRef(null);

  useEffect(() => { if (saisie !== null) champ.current?.focus(); }, [saisie]);
  useEffect(() => {
    if (!plusOuvert) return undefined;
    const dehors = (e) => { if (zonePlus.current && !zonePlus.current.contains(e.target)) setPlusOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setPlusOuvert(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [plusOuvert]);

  // Nombre de lignes par vue (calculé sur toute la liste, pas sur la page affichée)
  const comptes = useMemo(() => {
    const c = {};
    vues.forEach((v) => { c[v.id] = v.filtre ? items.filter(v.filtre).length : items.length; });
    return c;
  }, [vues, items]);

  const vueConnue = vues.some((v) => v.id === vueActive);
  const idActif = vueConnue ? vueActive : vues[0]?.id;
  const persoActive = perso.find((p) => p.base === idActif && memesReglages(p.reglages, reglages));
  const filtresModifies = Boolean(reglages?.recherche?.trim())
    || String(reglages?.etat ?? 'all') !== 'all'
    || idActif !== vues[0]?.id;

  const enregistrer = (e) => {
    e?.preventDefault();
    const nom = (saisie || '').trim();
    if (!nom) return;
    const nouvelle = { id: `p${Date.now()}`, nom, base: idActif, reglages: { ...reglages } };
    const suite = [...perso.filter((p) => p.nom.toLowerCase() !== nom.toLowerCase()), nouvelle];
    setPerso(suite);
    ecrire(cle, suite);
    setSaisie(null);
  };

  const supprimer = (id) => {
    const suite = perso.filter((p) => p.id !== id);
    setPerso(suite);
    ecrire(cle, suite);
  };

  // Mode compact (max) : les premières vues, la vue active toujours visible, le reste dans « Plus »
  const compact = Number.isFinite(max) && max > 0;
  let visibles = vues;
  if (compact) {
    visibles = vues.slice(0, max);
    const active = vues.find((v) => v.id === idActif);
    if (!persoActive && active && !visibles.includes(active)) visibles = [...visibles.slice(0, max - 1), active];
  }
  const cachees = compact ? vues.filter((v) => !visibles.includes(v)) : [];
  const persoVisibles = compact ? perso.filter((p) => p.id === persoActive?.id) : perso;
  const persoCachees = compact ? perso.filter((p) => p.id !== persoActive?.id) : [];
  const proposerEnregistrement = saisie === null && filtresModifies && !persoActive;
  const nbPlus = cachees.length + persoCachees.length;

  return (
    <div className={`vues-liste ${compact ? 'vues-liste--compacte' : ''}`} role="toolbar" aria-label={t('Vues de la liste')}>
      <div className="vues-liste__rail">
        {visibles.map((v) => {
          const Icone = v.icone;
          const actif = v.id === idActif && !persoActive;
          return (
            <button
              key={v.id}
              type="button"
              className={`vue-puce ${actif ? 'vue-puce--active' : ''} ${v.ton ? `vue-puce--${v.ton}` : ''}`}
              aria-pressed={actif}
              title={v.aide ? t(v.aide) : undefined}
              onClick={() => onChoisir(v.id, { recherche: '', etat: 'all' })}
            >
              {Icone && <Icone className="vue-puce__icone" aria-hidden="true" />}
              <span>{t(v.label)}</span>
              <span className="vue-puce__compte">{chargement ? '…' : comptes[v.id]}</span>
            </button>
          );
        })}

        {persoVisibles.length > 0 && <span className="vues-liste__separateur" aria-hidden="true" />}

        {persoVisibles.map((p) => {
          const actif = persoActive?.id === p.id;
          return (
            <span key={p.id} className={`vue-puce vue-puce--perso ${actif ? 'vue-puce--active' : ''}`}>
              <button
                type="button"
                className="vue-puce__corps"
                aria-pressed={actif}
                onClick={() => onChoisir(vues.some((v) => v.id === p.base) ? p.base : vues[0]?.id, p.reglages)}
              >
                <Bookmark className="vue-puce__icone" aria-hidden="true" />
                <span>{p.nom}</span>
              </button>
              <button
                type="button"
                className="vue-puce__suppr"
                onClick={() => supprimer(p.id)}
                title={t('Supprimer la vue « {nom} »', { nom: p.nom })}
                aria-label={t('Supprimer la vue « {nom} »', { nom: p.nom })}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          );
        })}

        {saisie === null ? (
          !compact && proposerEnregistrement && (
            <button type="button" className="vue-puce vue-puce--ajout" onClick={() => setSaisie('')}>
              <BookmarkPlus className="vue-puce__icone" aria-hidden="true" />
              <span>{t('Enregistrer cette vue')}</span>
            </button>
          )
        ) : (
          <form className="vue-saisie" onSubmit={enregistrer}>
            <input
              ref={champ}
              value={saisie}
              maxLength={40}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSaisie(null); }}
              placeholder={t('Nom de la vue')}
              aria-label={t('Nom de la vue')}
            />
            <button type="submit" className="vue-saisie__ok" disabled={!saisie.trim()} title={t('Enregistrer')} aria-label={t('Enregistrer')}>
              <Check aria-hidden="true" />
            </button>
            <button type="button" className="vue-saisie__annuler" onClick={() => setSaisie(null)} title={t('Annuler')} aria-label={t('Annuler')}>
              <X aria-hidden="true" />
            </button>
          </form>
        )}
      </div>

      {compact && (nbPlus > 0 || proposerEnregistrement) && (
        <div className="vues-plus" ref={zonePlus}>
          <button type="button" className={`vue-puce vues-plus__bouton ${plusOuvert ? 'is-ouvert' : ''}`} aria-haspopup="menu" aria-expanded={plusOuvert}
            onClick={() => setPlusOuvert((o) => !o)}>
            <span>{t('Plus')}</span>
            {nbPlus > 0 && <span className="vue-puce__compte">{nbPlus}</span>}
            <ChevronDown className="vue-puce__icone" aria-hidden="true" />
          </button>
          {plusOuvert && (
            <div className="vues-plus__menu" role="menu">
              {cachees.map((v) => {
                const Icone = v.icone;
                return (
                  <button key={v.id} type="button" role="menuitem" className="vues-plus__item" title={v.aide ? t(v.aide) : undefined}
                    onClick={() => { setPlusOuvert(false); onChoisir(v.id, { recherche: '', etat: 'all' }); }}>
                    {Icone ? <Icone className="vue-puce__icone" aria-hidden="true" /> : <span className="vue-puce__icone" />}
                    <span className="vues-plus__nom">{t(v.label)}</span>
                    <span className="vue-puce__compte">{chargement ? '…' : comptes[v.id]}</span>
                  </button>
                );
              })}
              {persoCachees.length > 0 && <div className="vues-plus__titre">{t('Mes vues enregistrées')}</div>}
              {persoCachees.map((p) => (
                <div key={p.id} className="vues-plus__item vues-plus__item--perso">
                  <button type="button" role="menuitem" className="vues-plus__corps"
                    onClick={() => { setPlusOuvert(false); onChoisir(vues.some((v) => v.id === p.base) ? p.base : vues[0]?.id, p.reglages); }}>
                    <Bookmark className="vue-puce__icone" aria-hidden="true" />
                    <span className="vues-plus__nom">{p.nom}</span>
                  </button>
                  <button type="button" className="vue-puce__suppr" onClick={() => supprimer(p.id)}
                    title={t('Supprimer la vue « {nom} »', { nom: p.nom })} aria-label={t('Supprimer la vue « {nom} »', { nom: p.nom })}>
                    <X aria-hidden="true" />
                  </button>
                </div>
              ))}
              {proposerEnregistrement && (
                <button type="button" role="menuitem" className="vues-plus__item vues-plus__item--ajout"
                  onClick={() => { setPlusOuvert(false); setSaisie(''); }}>
                  <BookmarkPlus className="vue-puce__icone" aria-hidden="true" />
                  <span className="vues-plus__nom">{t('Enregistrer cette vue')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
