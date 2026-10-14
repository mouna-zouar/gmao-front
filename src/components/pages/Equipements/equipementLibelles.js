import { t, locale } from '../../../i18n';

/* Libellés et formats communs à la liste et à la fiche des équipements. */

export const ETATS_EQUIPEMENT = {
  EN_SERVICE: { label: 'En service', ton: 'ok' },
  EN_PANNE: { label: 'En panne', ton: 'alerte' },
  EN_REPARATION: { label: 'En réparation', ton: 'attention' },
  HORS_SERVICE: { label: 'Hors service', ton: 'neutre' },
};

export const CRITICITES = {
  C1: { label: 'Critique', ton: 'alerte' },
  C2: { label: 'Important', ton: 'attention' },
  C3: { label: 'Normal', ton: 'info' },
  C4: { label: 'Faible', ton: 'neutre' },
};

export const ETATS_BON = {
  1: { label: 'Nouveau', ton: 'info' },
  2: { label: 'Suspendu', ton: 'attention' },
  3: { label: 'En cours', ton: 'action' },
  4: { label: 'Effectué', ton: 'ok' },
  10: { label: 'Annulé', ton: 'neutre' },
};

export const ETATS_RECLAMATION = {
  0: { label: 'Ouverte', ton: 'info' },
  1: { label: 'En cours', ton: 'action' },
  2: { label: 'Clôturée', ton: 'ok' },
  3: { label: 'En attente de validation', ton: 'attention' },
  4: { label: 'Rejetée', ton: 'neutre' },
};

export const CATEGORIES_DOCUMENT = {
  MANUEL: 'Manuel',
  CERTIFICAT: 'Certificat',
  FACTURE: 'Facture',
  RAPPORT: 'Rapport',
  PHOTO: 'Photo',
  AUTRE: 'Autre',
};

export const dateCourte = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
};

export const montant = (v) => (v == null ? '—'
  : `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)} DT`);

/** Durée en heures, lisible : « 18 h » ou « 12 j » au-delà de 48 h. */
export const duree = (heures) => {
  if (heures == null) return '—';
  if (heures >= 48) return t('{n} j', { n: Math.round(heures / 24) });
  return t('{n} h', { n: Math.round(heures * 10) / 10 });
};

export const taille = (octets) => {
  if (octets == null) return '';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
};

/** Garantie en clair : { texte, ton } */
export function garantieEnClair(g) {
  if (!g || g.statut === 'INCONNUE' || !g.fin) return { texte: t('Garantie non renseignée'), ton: 'neutre' };
  if (g.statut === 'EXPIREE') return { texte: t('Garantie expirée le {date}', { date: dateCourte(g.fin) }), ton: 'neutre' };
  if (g.joursRestants != null && g.joursRestants <= 60) {
    return { texte: t('Garantie : fin le {date}', { date: dateCourte(g.fin) }), ton: 'attention' };
  }
  return { texte: t('Sous garantie jusqu’au {date}', { date: dateCourte(g.fin) }), ton: 'ok' };
}
