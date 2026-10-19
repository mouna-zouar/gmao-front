import { useEffect, useMemo, useRef, useState } from 'react';
import { lire, ecrire } from './stockageVues';
import { Bookmark, BookmarkPlus, Check, X } from 'lucide-react';
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
 */

const memesReglages = (a = {}, b = {}) =>
  (a.recherche || '') === (b.recherche || '')
  && String(a.etat ?? 'all') === String(b.etat ?? 'all')
  && (a.tri || '') === (b.tri || '')
  && (a.sens || '') === (b.sens || '');

export default function VuesListe({ liste, userKey, vues, items, vueActive, reglages, onChoisir, chargement = false }) {
  const cle = `gmao-vues-${liste}-${userKey}`;
  const [perso, setPerso] = useState(() => lire(cle, []));
  const [saisie, setSaisie] = useState(null); // null = fermé, sinon le nom en cours
  const champ = useRef(null);

  useEffect(() => { if (saisie !== null) champ.current?.focus(); }, [saisie]);

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

  return (
    <div className="vues-liste" role="toolbar" aria-label={t('Vues de la liste')}>
      <div className="vues-liste__rail">
        {vues.map((v) => {
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

        {perso.length > 0 && <span className="vues-liste__separateur" aria-hidden="true" />}

        {perso.map((p) => {
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
          filtresModifies && !persoActive && (
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
    </div>
  );
}
