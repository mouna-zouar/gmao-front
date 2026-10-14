import { t, tp } from '../../../i18n';

/*
 * Travaux à faire de l'espace personnel : tâches et bons sur lesquels la personne travaille,
 * avec leur échéance. Utilisé par le mini calendrier, la liste « À surveiller » et le kanban.
 */

export const JOUR_MS = 24 * 60 * 60 * 1000;

/** Colonnes du kanban des tâches (BonMaintenanceTache.etat), dans l'ordre d'affichage. */
export const COLONNES_KANBAN = [
  { etat: 1, label: 'À faire', ton: 'info' },
  { etat: 3, label: 'En cours', ton: 'action' },
  { etat: 2, label: 'Suspendu', ton: 'attention' },
  { etat: 4, label: 'Effectué', ton: 'ok' },
  { etat: 10, label: 'Annulé', ton: 'neutre' },
];

/** Une échéance à 2 jours ou moins est « très proche ». */
export const JOURS_PROCHE = 2;

// États actifs (ni terminés, ni annulés)
const TACHE_ACTIVE = [1, 2, 3];
const BON_ACTIF = [1, 2, 3];
const ROLES_TERRAIN = ['INTERVENANT', 'DIAGNOSTIQUEUR', 'CONTROLEUR', 'REMISE_EN_SERVICE'];

export const versDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const debutJour = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const cleJour = (d) => {
  const x = debutJour(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

/** Écart en jours calendaires entre aujourd'hui et une date (négatif = passé). */
export const joursAvant = (date, maintenant = new Date()) =>
  Math.round((debutJour(date) - debutJour(maintenant)) / JOUR_MS);

/**
 * Situation d'une échéance : { niveau: 'retard' | 'aujourdhui' | 'proche' | 'plus-tard', jours, texte }
 * ou null s'il n'y a pas d'échéance.
 */
export function statutEcheance(echeance, maintenant = new Date()) {
  const d = versDate(echeance);
  if (!d) return null;
  const jours = joursAvant(d, maintenant);
  if (jours < 0) return { niveau: 'retard', jours, texte: tp('jour de retard', -jours) };
  if (jours === 0) return { niveau: 'aujourdhui', jours, texte: t("Aujourd'hui") };
  if (jours === 1) return { niveau: 'proche', jours, texte: t('Demain') };
  if (jours <= JOURS_PROCHE) return { niveau: 'proche', jours, texte: tp('dans jours', jours) };
  return { niveau: 'plus-tard', jours, texte: tp('dans jours', jours) };
}

export const estUrgent = (statut) => !!statut && statut.niveau !== 'plus-tard';

const ORDRE_NIVEAU = { retard: 0, aujourdhui: 1, proche: 2, 'plus-tard': 3 };

/** Tri : en retard d'abord, puis échéance la plus proche, puis sans échéance. */
export function comparerEcheances(a, b) {
  const na = a.statut ? ORDRE_NIVEAU[a.statut.niveau] : 9;
  const nb = b.statut ? ORDRE_NIVEAU[b.statut.niveau] : 9;
  if (na !== nb) return na - nb;
  const da = versDate(a.echeance)?.getTime() ?? Infinity;
  const db = versDate(b.echeance)?.getTime() ?? Infinity;
  return da - db || String(a.cle).localeCompare(String(b.cle));
}

/** Référence courte d'un bon : « BM-0041 ». */
export const refBon = (bon, bonId) => bon?.num || (bonId != null ? `#${bonId}` : '');

/**
 * Liste des travaux à faire, triée par urgence.
 * Chaque élément : { cle, type: 'tache' | 'bon', titre, sousTitre, debut, fin, echeance, statut, source, bon }
 */
export function construireTravaux({ bons = [], taches = [] }, maintenant = new Date()) {
  const bonsParId = new Map(bons.map((b) => [b.id, b]));
  const travaux = [];

  taches.filter((tache) => TACHE_ACTIVE.includes(tache.etat)).forEach((tache) => {
    const bon = bonsParId.get(tache.bonMaintenanceId);
    const echeance = tache.dateFin || tache.dateDebut || null;
    travaux.push({
      cle: `tache-${tache.id}`,
      type: 'tache',
      titre: tache.designation || tache.nom || t('Tâche #{id}', { id: tache.id }),
      sousTitre: [refBon(bon, tache.bonMaintenanceId), bon?.titre].filter(Boolean).join(' · '),
      debut: tache.dateDebut || null,
      fin: tache.dateFin || null,
      echeance,
      statut: statutEcheance(echeance, maintenant),
      source: tache,
      bon,
    });
  });

  bons
    .filter((b) => BON_ACTIF.includes(b.etat) && (b.roles || []).some((r) => ROLES_TERRAIN.includes(r)))
    .forEach((bon) => {
      const debut = bon.date || bon.dateIntervention || null;
      const fin = bon.dateFinIntervention || null;
      const echeance = fin || debut;
      travaux.push({
        cle: `bon-${bon.id}`,
        type: 'bon',
        titre: bon.titre || refBon(bon, bon.id),
        sousTitre: refBon(bon, bon.id),
        debut,
        fin,
        echeance,
        statut: statutEcheance(echeance, maintenant),
        source: bon,
        bon,
      });
    });

  return travaux.sort(comparerEcheances);
}

/** Jours (clés) couverts par un travail : du début à la fin, limité à 62 jours. */
export function joursCouverts(travail) {
  const debut = versDate(travail.debut) || versDate(travail.fin);
  if (!debut) return [];
  let fin = versDate(travail.fin) || debut;
  if (fin < debut) fin = debut;
  const cles = [];
  const curseur = debutJour(debut);
  const limite = debutJour(fin);
  for (let i = 0; i < 62 && curseur <= limite; i += 1) {
    cles.push(cleJour(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return cles;
}