import { useMemo, useState } from 'react';
import { AlarmClock, ArrowUpRight, Loader2, RefreshCw, Search, Timer, Wrench } from 'lucide-react';
import { t, locale } from '../../../i18n';
import { prioriteLabel } from '../../../constants/Priorite';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';

/*
 * Bons en dépassement SLA (délai de réponse et/ou de résolution), tous encore ouverts.
 * Données : GET /api/sla/depassements (SlaService.findEnDepassement).
 * Un clic sur une ligne ouvre le bon.
 */

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Retard en heures par rapport à une échéance (0 si pas encore atteinte). */
const heuresDeRetard = (echeance, maintenant) => {
  if (!echeance) return 0;
  const d = new Date(echeance);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (maintenant - d.getTime()) / 3600000);
};

const formatRetard = (heures) => {
  if (heures < 1) return t('< 1 h');
  if (heures < 24) return t('{n} h', { n: Math.floor(heures) });
  const j = Math.floor(heures / 24);
  const h = Math.floor(heures % 24);
  return h ? t('{j} j {h} h', { j, h }) : t('{j} j', { j });
};

const FILTRES = [
  { id: 'tous', label: 'Tous' },
  { id: 'reponse', label: 'Réponse en retard' },
  { id: 'resolution', label: 'Résolution en retard' },
];

export default function SlaRetards({ bons, chargement, erreur, onRecharger, onOuvrir }) {
  const [filtre, setFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [maintenant] = useState(() => Date.now());

  const lignes = useMemo(() => (bons || []).map((b) => {
    const reponse = b.statutReponse === 'DEPASSE';
    const resolution = b.statutResolution === 'DEPASSE';
    // Retard le plus important des deux délais dépassés
    const retard = Math.max(
      reponse ? heuresDeRetard(b.echeanceReponse, maintenant) : 0,
      resolution ? heuresDeRetard(b.echeanceResolution, maintenant) : 0,
    );
    return { ...b, reponse, resolution, retard };
  }).sort((a, b) => b.retard - a.retard), [bons, maintenant]);

  const comptes = useMemo(() => ({
    tous: lignes.length,
    reponse: lignes.filter((l) => l.reponse).length,
    resolution: lignes.filter((l) => l.resolution).length,
  }), [lignes]);

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return lignes.filter((l) => (filtre === 'tous' || l[filtre])
      && (!terme || `${l.num ?? ''} ${l.titre ?? ''}`.toLowerCase().includes(terme)));
  }, [lignes, filtre, recherche]);

  return (
    <div className="sla-retards">
      <div className="sla-retards__resume">
        <div className="sla-retards__chiffre sla-retards__chiffre--alerte">
          <AlarmClock size={20} aria-hidden="true" />
          <strong>{chargement && !bons ? '…' : comptes.tous}</strong>
          <span>{t('bons en retard SLA')}</span>
        </div>
        <div className="sla-retards__chiffre">
          <Timer size={18} aria-hidden="true" />
          <strong>{comptes.reponse}</strong>
          <span>{t('réponse en retard')}</span>
        </div>
        <div className="sla-retards__chiffre">
          <Wrench size={18} aria-hidden="true" />
          <strong>{comptes.resolution}</strong>
          <span>{t('résolution en retard')}</span>
        </div>
        <button type="button" className="sla-retards__recharger" onClick={onRecharger} disabled={chargement}>
          <RefreshCw size={15} className={chargement ? 'sla-retards__spin' : ''} aria-hidden="true" />
          {t('Actualiser')}
        </button>
      </div>

      <div className="sla-retards__outils">
        <div className="sla-retards__filtres" role="group" aria-label={t('Filtrer les retards')}>
          {FILTRES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`sla-retards__filtre ${filtre === f.id ? 'is-actif' : ''}`}
              aria-pressed={filtre === f.id}
              onClick={() => setFiltre(f.id)}
            >
              {t(f.label)} <span>{comptes[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="sla-retards__recherche">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('N° ou titre du bon…')}
            aria-label={t('Rechercher un bon')}
          />
        </label>
      </div>

      {erreur && <div className="sla-retards__erreur">{erreur}</div>}

      <div className="sla-retards__table-wrap">
        <table className="sla-retards__table">
          <thead>
            <tr>
              <th>{t('N°')}</th>
              <th>{t('Titre')}</th>
              <th>{t('Priorité')}</th>
              <th>{t('Délai dépassé')}</th>
              <th>{t('Échéance réponse')}</th>
              <th>{t('Échéance résolution')}</th>
              <th>{t('Retard')}</th>
              <th>{t('État')}</th>
              <th aria-label={t('Ouvrir')} />
            </tr>
          </thead>
          <tbody>
            {chargement && !bons ? (
              <tr><td colSpan={9} className="sla-retards__vide"><Loader2 size={20} className="sla-retards__spin" /> {t('Chargement...')}</td></tr>
            ) : visibles.length === 0 ? (
              <tr><td colSpan={9} className="sla-retards__vide">
                {lignes.length === 0 ? t('Aucun bon en retard SLA. Tous les délais sont respectés.') : t('Aucun bon ne correspond à ces filtres.')}
              </td></tr>
            ) : visibles.map((l) => (
              <tr key={l.bonMaintenanceId} className="sla-retards__ligne" onClick={() => onOuvrir(l)} title={t('Ouvrir le bon')}>
                <td className="sla-retards__num">{l.num || `#${l.bonMaintenanceId}`}</td>
                <td className="sla-retards__titre">{l.titre || '—'}</td>
                <td>{l.priorite ? <span className={`sla-retards__prio sla-retards__prio--${l.priorite}`}>{l.priorite} · {t(prioriteLabel(l.priorite))}</span> : '—'}</td>
                <td>
                  <span className="sla-retards__types">
                    {l.reponse && <span className="sla-retards__type">{t('Réponse')}</span>}
                    {l.resolution && <span className="sla-retards__type sla-retards__type--resolution">{t('Résolution')}</span>}
                  </span>
                </td>
                <td className={l.reponse ? 'sla-retards__depasse' : ''}>{formatDate(l.echeanceReponse)}</td>
                <td className={l.resolution ? 'sla-retards__depasse' : ''}>{formatDate(l.echeanceResolution)}</td>
                <td><strong className="sla-retards__retard">{formatRetard(l.retard)}</strong></td>
                <td><BadgeStatut type="bon" valeur={l.etat} taille="petit" /></td>
                <td>
                  <button
                    type="button"
                    className="sla-retards__ouvrir"
                    onClick={(e) => { e.stopPropagation(); onOuvrir(l); }}
                    aria-label={t('Ouvrir le bon {num}', { num: l.num || l.bonMaintenanceId })}
                  >
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
