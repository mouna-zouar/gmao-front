/*
 * Catalogue du Tableau de bord général. Le moteur (constantes partagées, hook de disposition)
 * est dans commun/tableauPerso/outilsPerso.js ; il est ré-exporté ici pour les imports existants.
 */
import { creerDisposition } from '../../commun/tableauPerso/outilsPerso';

export {
  LARGEURS, LIBELLE_LARGEUR, ICONES_CARTE, COULEURS_TONS, STYLE_PAR_GROUPE, couleurHex, variablesCouleur,
  PAGES_LIEN, lireChemin, PREFIXE_PERSO, deplacer,
} from '../../commun/tableauPerso/outilsPerso';

export const STATS = [
  { id: 'bons', titre: 'Bons ouverts' },
  { id: 'reclamations', titre: 'Réclamations ouvertes' },
  { id: 'arrets', titre: 'Équipements à l’arrêt' },
  { id: 'disponibilite', titre: 'Disponibilité moyenne' },
  { id: 'sla', titre: 'Délais SLA respectés' },
  { id: 'cout', titre: 'Coût de maintenance' },
];

export const CARTES = [
  { id: 'activite', largeur: 'deux-tiers' },
  { id: 'bonsOuverts', largeur: 'tiers' },
  { id: 'retards', largeur: 'moitie' },
  { id: 'arrets', largeur: 'moitie' },
  { id: 'slaPriorite', largeur: 'tiers' },
  { id: 'preventif', largeur: 'tiers' },
  { id: 'etatEquipements', largeur: 'tiers' },
  { id: 'couts', largeur: 'deux-tiers' },
  { id: 'plusCouteux', largeur: 'tiers' },
  { id: 'performance', largeur: 'moitie' },
  { id: 'indicateurs', largeur: 'moitie' },
  { id: 'plusAnciens', largeur: 'pleine' },
];

export const INDICATEURS = [
  { cle: 'bons.ouverts', groupe: 'Bons', label: 'Bons ouverts', format: 'nombre' },
  { cle: 'bons.creesPeriode', groupe: 'Bons', label: 'Bons créés', format: 'nombre', precedent: 'bons.creesPeriodePrecedente' },
  { cle: 'bons.cloturesPeriode', groupe: 'Bons', label: 'Bons clôturés', format: 'nombre' },
  { cle: 'bons.parEtat.3', groupe: 'Bons', label: 'Bons en cours', format: 'nombre' },
  { cle: 'bons.parEtat.2', groupe: 'Bons', label: 'Bons suspendus', format: 'nombre' },
  { cle: 'sla.enRetard', groupe: 'Bons', label: 'Bons en retard (SLA)', format: 'nombre' },
  { cle: 'bons.arretsObligatoires', groupe: 'Bons', label: 'Arrêts obligatoires en cours', format: 'nombre' },
  { cle: 'bons.preventifsPeriode', groupe: 'Bons', label: 'Préventifs prévus', format: 'nombre' },
  { cle: 'bons.preventifsEffectues', groupe: 'Bons', label: 'Préventifs effectués', format: 'nombre' },
  { cle: 'bons.partPreventifPct', groupe: 'Bons', label: 'Part de préventif', format: 'pct' },
  { cle: 'bons.delaiMoyenClotureHeures', groupe: 'Bons', label: 'Délai moyen de clôture', format: 'heures' },
  { cle: 'reclamations.recuesPeriode', groupe: 'Réclamations', label: 'Réclamations reçues', format: 'nombre', precedent: 'reclamations.recuesPeriodePrecedente' },
  { cle: 'reclamations.ouvertes', groupe: 'Réclamations', label: 'Réclamations nouvelles', format: 'nombre' },
  { cle: 'reclamations.enFile', groupe: 'Réclamations', label: 'Réclamations en file', format: 'nombre' },
  { cle: 'reclamations.enCours', groupe: 'Réclamations', label: 'Réclamations en cours', format: 'nombre' },
  { cle: 'reclamations.enAttenteValidation', groupe: 'Réclamations', label: 'Réclamations en attente de validation', format: 'nombre' },
  { cle: 'reclamations.nonAffectees', groupe: 'Réclamations', label: 'Réclamations non affectées', format: 'nombre' },
  { cle: 'reclamations.resolues', groupe: 'Réclamations', label: 'Réclamations résolues', format: 'nombre' },
  { cle: 'reclamations.delaiMoyenResolutionJours', groupe: 'Réclamations', label: 'Délai moyen de résolution', format: 'jours' },
  { cle: 'equipements.total', groupe: 'Équipements', label: 'Équipements suivis', format: 'nombre' },
  { cle: 'equipements.parEtat.EN_PANNE', groupe: 'Équipements', label: 'Équipements en panne', format: 'nombre' },
  { cle: 'equipements.parEtat.EN_REPARATION', groupe: 'Équipements', label: 'Équipements en réparation', format: 'nombre' },
  { cle: 'equipements.critiquesArretes', groupe: 'Équipements', label: 'Équipements critiques à l’arrêt', format: 'nombre' },
  { cle: 'disponibilite.pannes', groupe: 'Équipements', label: 'Pannes', format: 'nombre' },
  { cle: 'disponibilite.tauxMoyenPct', groupe: 'Équipements', label: 'Disponibilité moyenne', format: 'pct' },
  { cle: 'disponibilite.tauxCritiquesPct', groupe: 'Équipements', label: 'Disponibilité des équipements critiques', format: 'pct' },
  { cle: 'disponibilite.mtbfHeures', groupe: 'Équipements', label: 'MTBF', format: 'heures' },
  { cle: 'disponibilite.mttrHeures', groupe: 'Équipements', label: 'MTTR', format: 'heures' },
  { cle: 'alertes.ouvertes', groupe: 'Équipements', label: 'Alertes machines ouvertes', format: 'nombre' },
  { cle: 'alertes.critiquesOuvertes', groupe: 'Équipements', label: 'Alertes machines critiques', format: 'nombre' },
  { cle: 'renouvellement.remplacer', groupe: 'Équipements', label: 'Équipements à remplacer', format: 'nombre' },
  { cle: 'couts.total', groupe: 'Coûts', label: 'Coût total', format: 'dt', precedent: 'couts.totalPrecedent' },
  { cle: 'couts.mainOeuvre', groupe: 'Coûts', label: 'Coût main-d’œuvre', format: 'dt' },
  { cle: 'couts.pieces', groupe: 'Coûts', label: 'Coût des pièces', format: 'dt' },
  { cle: 'couts.achats', groupe: 'Coûts', label: 'Coût des achats', format: 'dt' },
  { cle: 'sla.respectReponsePct', groupe: 'SLA', label: 'Délais de réponse respectés', format: 'pct' },
  { cle: 'sla.respectResolutionPct', groupe: 'SLA', label: 'Délais de résolution respectés', format: 'pct' },
];

export const PROFIL_GENERAL = { prefixe: 'gmao.tableau-de-bord', version: 3, stats: STATS, cartes: CARTES, indicateurs: INDICATEURS };

export const useDisposition = creerDisposition(PROFIL_GENERAL);
