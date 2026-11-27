/*
 * Catalogue du tableau de bord des réclamations : cartes chiffrées, grandes cartes et indicateurs.
 * Les chemins des indicateurs suivent la réponse de GET /api/tableau-de-bord/reclamations.
 */
import { creerDisposition } from '../../commun/tableauPerso/outilsPerso';

export const STATS_RECLAMATIONS = [
  { id: 'recues', titre: 'Réclamations reçues' },
  { id: 'nouvelles', titre: 'Nouvelles' },
  { id: 'enFile', titre: 'En file' },
  { id: 'enCours', titre: 'En cours' },
  { id: 'aValider', titre: 'En attente de validation' },
  { id: 'nonAffectees', titre: 'Non affectées' },
  { id: 'cloturees', titre: 'Réclamations clôturées', defaut: false },
  { id: 'delai', titre: 'Délai moyen de résolution', defaut: false },
  { id: 'priseEnCharge', titre: 'Délai de prise en charge', defaut: false },
];

export const CARTES_RECLAMATIONS = [
  { id: 'activite', largeur: 'deux-tiers' },
  { id: 'etats', largeur: 'tiers' },
  { id: 'plusAnciennes', largeur: 'moitie' },
  { id: 'nonAffectees', largeur: 'moitie' },
  { id: 'responsables', largeur: 'moitie' },
  { id: 'services', largeur: 'moitie' },
  { id: 'niveaux', largeur: 'tiers' },
  { id: 'demandeurs', largeur: 'tiers' },
  { id: 'codesPanne', largeur: 'tiers' },
];

export const INDICATEURS_RECLAMATIONS = [
  { cle: 'detail.recuesPeriode', groupe: 'Réclamations', label: 'Réclamations reçues', format: 'nombre', precedent: 'reclamations.recuesPeriodePrecedente' },
  { cle: 'detail.clotureesPeriode', groupe: 'Réclamations', label: 'Réclamations clôturées', format: 'nombre', precedent: 'detail.clotureesPeriodePrecedente' },
  { cle: 'detail.actives', groupe: 'Réclamations', label: 'Réclamations actives', format: 'nombre' },
  { cle: 'reclamations.ouvertes', groupe: 'Réclamations', label: 'Réclamations nouvelles', format: 'nombre' },
  { cle: 'reclamations.enFile', groupe: 'Réclamations', label: 'Réclamations en file', format: 'nombre' },
  { cle: 'reclamations.enCours', groupe: 'Réclamations', label: 'Réclamations en cours', format: 'nombre' },
  { cle: 'reclamations.enAttenteValidation', groupe: 'Réclamations', label: 'Réclamations en attente de validation', format: 'nombre' },
  { cle: 'reclamations.nonAffectees', groupe: 'Réclamations', label: 'Réclamations non affectées', format: 'nombre' },
  { cle: 'reclamations.resolues', groupe: 'Réclamations', label: 'Réclamations résolues', format: 'nombre' },
  { cle: 'detail.parEtatPeriode.4', groupe: 'Réclamations', label: 'Réclamations annulées (reçues sur la période)', format: 'nombre' },
  { cle: 'detail.parCriticite.3', groupe: 'Réclamations', label: 'Réclamations de criticité élevée', format: 'nombre' },
  { cle: 'detail.parUrgence.3', groupe: 'Réclamations', label: 'Réclamations d’urgence élevée', format: 'nombre' },
  { cle: 'detail.anciennete.3', groupe: 'Réclamations', label: 'Réclamations actives depuis plus d’un mois', format: 'nombre' },
  { cle: 'reclamations.avecCodePanne', groupe: 'Réclamations', label: 'Réclamations avec code de panne', format: 'nombre' },
  { cle: 'reclamations.delaiMoyenResolutionJours', groupe: 'SLA', label: 'Délai moyen de résolution', format: 'jours' },
  { cle: 'detail.delaiPriseEnChargeHeures', groupe: 'SLA', label: 'Délai moyen de prise en charge', format: 'heures' },
];

export const PROFIL_RECLAMATIONS = {
  prefixe: 'gmao.tableau-reclamations', version: 1, stats: STATS_RECLAMATIONS, cartes: CARTES_RECLAMATIONS, indicateurs: INDICATEURS_RECLAMATIONS,
};

export const useDispositionReclamations = creerDisposition(PROFIL_RECLAMATIONS);
