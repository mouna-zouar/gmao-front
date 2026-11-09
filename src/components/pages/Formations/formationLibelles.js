import { t, locale } from '../../../i18n';

/* Libellés communs à la page Formations et à « Mon espace ». ton : couleur des badges communs. */
export const TYPES_FORMATION = {
  INTERNE: { label: 'Interne', ton: 'teal' },
  EXTERNE: { label: 'Externe', ton: 'orange' },
  CONSTRUCTEUR: { label: 'Constructeur', ton: 'bleu' },
};

export const STATUTS_FORMATION = {
  PLANIFIEE: { label: 'Planifiée', ton: 'ambre' },
  REALISEE: { label: 'Réalisée', ton: 'vert' },
  ANNULEE: { label: 'Annulée', ton: 'gris' },
};

export const RESULTATS_FORMATION = {
  INSCRIT: { label: 'Inscrit', ton: 'bleu' },
  REUSSI: { label: 'Réussi', ton: 'vert' },
  ECHOUE: { label: 'Échoué', ton: 'rouge' },
  ABSENT: { label: 'Absent', ton: 'gris' },
};

export const options = (dico) => Object.entries(dico).map(([value, d]) => ({ value, label: d.label }));

export const dateFormation = (v) => {
  if (!v) return '';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** « 12 mars 2026 → 14 mars 2026 », ou une seule date. */
export const periodeFormation = (f) => {
  const debut = dateFormation(f.dateDebut);
  const fin = dateFormation(f.dateFin);
  if (debut && fin && debut !== fin) return `${debut} → ${fin}`;
  return debut || fin || '';
};

export const nomPersonnel = (p) => [p?.nom, p?.prenom].filter(Boolean).join(' ') || (p?.id != null ? t('Personnel #{id}', { id: p.id }) : '');
