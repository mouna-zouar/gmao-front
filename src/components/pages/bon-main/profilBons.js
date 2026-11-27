/*
 * Catalogue du tableau de bord des bons de maintenance : cartes chiffrées, grandes cartes et indicateurs.
 * Les chemins des indicateurs suivent la réponse de GET /api/tableau-de-bord/bons.
 */
import { creerDisposition } from '../../commun/tableauPerso/outilsPerso';

export const STATS_BONS = [
  { id: 'ouverts', titre: 'Bons ouverts' },
  { id: 'crees', titre: 'Bons créés' },
  { id: 'clotures', titre: 'Bons clôturés' },
  { id: 'retards', titre: 'Bons en retard (SLA)' },
  { id: 'arrets', titre: 'Arrêts obligatoires en cours' },
  { id: 'delai', titre: 'Délai moyen de clôture' },
  { id: 'sla', titre: 'Délais SLA respectés', defaut: false },
  { id: 'cout', titre: 'Coût de maintenance', defaut: false },
  { id: 'preventif', titre: 'Part de préventif', defaut: false },
];

export const CARTES_BONS = [
  { id: 'activite', largeur: 'deux-tiers' },
  { id: 'etats', largeur: 'tiers' },
  { id: 'retards', largeur: 'moitie' },
  { id: 'plusAnciens', largeur: 'moitie' },
  { id: 'techniciens', largeur: 'moitie' },
  { id: 'services', largeur: 'moitie' },
  { id: 'urgence', largeur: 'tiers' },
  { id: 'preventif', largeur: 'tiers' },
  { id: 'pannes', largeur: 'tiers' },
  { id: 'couts', largeur: 'deux-tiers' },
  { id: 'plusCouteux', largeur: 'tiers' },
];

export const INDICATEURS_BONS = [
  { cle: 'bons.ouverts', groupe: 'Bons', label: 'Bons ouverts', format: 'nombre' },
  { cle: 'bons.creesPeriode', groupe: 'Bons', label: 'Bons créés', format: 'nombre', precedent: 'bons.creesPeriodePrecedente' },
  { cle: 'bons.cloturesPeriode', groupe: 'Bons', label: 'Bons clôturés', format: 'nombre' },
  { cle: 'bons.parEtat.1', groupe: 'Bons', label: 'Bons nouveaux', format: 'nombre' },
  { cle: 'bons.parEtat.3', groupe: 'Bons', label: 'Bons en cours', format: 'nombre' },
  { cle: 'bons.parEtat.2', groupe: 'Bons', label: 'Bons suspendus', format: 'nombre' },
  { cle: 'detail.parEtatPeriode.4', groupe: 'Bons', label: 'Bons effectués (créés sur la période)', format: 'nombre' },
  { cle: 'detail.parEtatPeriode.10', groupe: 'Bons', label: 'Bons annulés (créés sur la période)', format: 'nombre' },
  { cle: 'bons.arretsObligatoires', groupe: 'Bons', label: 'Arrêts obligatoires en cours', format: 'nombre' },
  { cle: 'bons.anciennete.3', groupe: 'Bons', label: 'Bons ouverts depuis plus d’un mois', format: 'nombre' },
  { cle: 'bons.parPriorite.P1', groupe: 'Bons', label: 'Bons ouverts en priorité immédiate', format: 'nombre' },
  { cle: 'detail.parUrgence.3', groupe: 'Bons', label: 'Bons d’urgence élevée', format: 'nombre' },
  { cle: 'bons.parType.CURATIF', groupe: 'Bons', label: 'Bons curatifs', format: 'nombre' },
  { cle: 'bons.preventifsPeriode', groupe: 'Bons', label: 'Préventifs prévus', format: 'nombre' },
  { cle: 'bons.preventifsEffectues', groupe: 'Bons', label: 'Préventifs effectués', format: 'nombre' },
  { cle: 'bons.partPreventifPct', groupe: 'Bons', label: 'Part de préventif', format: 'pct' },
  { cle: 'sla.enRetard', groupe: 'SLA', label: 'Bons en retard (SLA)', format: 'nombre' },
  { cle: 'sla.respectReponsePct', groupe: 'SLA', label: 'Délais de réponse respectés', format: 'pct' },
  { cle: 'sla.respectResolutionPct', groupe: 'SLA', label: 'Délais de résolution respectés', format: 'pct' },
  { cle: 'bons.delaiMoyenClotureHeures', groupe: 'SLA', label: 'Délai moyen de clôture', format: 'heures' },
  { cle: 'couts.total', groupe: 'Coûts', label: 'Coût total', format: 'dt', precedent: 'couts.totalPrecedent' },
  { cle: 'couts.mainOeuvre', groupe: 'Coûts', label: 'Coût main-d’œuvre', format: 'dt' },
  { cle: 'couts.pieces', groupe: 'Coûts', label: 'Coût des pièces', format: 'dt' },
  { cle: 'couts.achats', groupe: 'Coûts', label: 'Coût des achats', format: 'dt' },
];

export const PROFIL_BONS = { prefixe: 'gmao.tableau-bons', version: 1, stats: STATS_BONS, cartes: CARTES_BONS, indicateurs: INDICATEURS_BONS };

export const useDispositionBons = creerDisposition(PROFIL_BONS);
