import { INTERVENANT_ETAT_LABELS, TACHE_ETAT_LABELS } from '../bonmaintenance/BmdCommun';
import { t, locale } from '../../../i18n';

const ETAT_LABELS = {
  bons: { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' },
  reclamations: {
    0: 'Nouveau',
    5: 'En file',
    1: 'En cours',
    3: 'Résolue',
    2: 'Clôturée',
    4: 'Annulée',
  },
  taches: TACHE_ETAT_LABELS,
  interventions: INTERVENANT_ETAT_LABELS,
};

const ETAT_TONS = {
  bons: { 1: 'info', 2: 'attention', 3: 'action', 4: 'ok', 10: 'neutre' },
  reclamations: { 0: 'info', 1: 'action', 2: 'ok', 3: 'attention', 4: 'neutre' },
  taches: { 1: 'info', 2: 'attention', 3: 'action', 4: 'ok', 10: 'neutre' },
  interventions: { 0: 'info', 1: 'action', 2: 'ok', 10: 'neutre' },
};

export const etatLabel = (type, value) => {
  if (value === null || value === undefined || value === '') return '—';
  const label = ETAT_LABELS[type]?.[value];
  return label ? t(label) : String(value);
};

export const etatTon = (type, value) => ETAT_TONS[type]?.[value] ?? 'neutre';

export const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
};
