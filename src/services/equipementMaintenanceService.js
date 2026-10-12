import api from './api';

const BASE = '/equipement-maintenance';

/**
 * Miroir de vehiculeMaintenanceService.js, mais pour la maintenance
 * préventive RÉGLEMENTAIRE des équipements médicaux (calibration, contrôle
 * qualité périodique, vérification de sécurité...), basée sur une
 * périodicité calendaire (jours) plutôt qu'un kilométrage.
 */
const equipementMaintenanceService = {
  // ─── Référentiel configurable des échéances ───

  async getTypes() {
    const { data } = await api.get(`${BASE}/types`);
    return data;
  },

  async createType(payload) {
    const { data } = await api.post(`${BASE}/types`, payload);
    return data;
  },

  async updateType(id, payload) {
    const { data } = await api.put(`${BASE}/types/${id}`, payload);
    return data;
  },

  /** Désactive le type (pas de suppression physique côté serveur). */
  async removeType(id) {
    await api.delete(`${BASE}/types/${id}`);
  },

  // ─── Situation d'un équipement ───

  /**
   * Retourne un tableau de :
   * { typeId, typeCode, typeLibelle, intervalleJours, derniereDateMaintenance,
   *   prochaineEcheance, joursRestants, statut, declenchementId,
   *   bonMaintenanceId, dateDeclenchement }
   */
  async getStatuts(immobilisationId) {
    const { data } = await api.get(`${BASE}/immobilisation/${immobilisationId}/statuts`);
    return data;
  },

  /** Historique des maintenances automatiquement déclenchées. */
  async getDeclenchements(immobilisationId) {
    const { data } = await api.get(`${BASE}/immobilisation/${immobilisationId}/declenchements`);
    return data;
  },

  /** Types actifs applicables à un équipement (filtrés sur sa catégorie). */
  async getTypesApplicables(immobilisationId) {
    const { data } = await api.get(`${BASE}/immobilisation/${immobilisationId}/types`);
    return data;
  },

  /**
   * Crée un bon de maintenance à la demande depuis la fiche équipement.
   *
   * payload : { typeId, description, urgence, dateDemande, reinitialiserEcheance,
   *             personnelDemandantId, personnelDemandantNom }
   *
   * Retourne { bon, declenchement, origine }.
   * 409 si un bon est déjà ouvert pour ce type sur cet équipement.
   */
  async creerBonManuel(immobilisationId, payload) {
    const { data } = await api.post(`${BASE}/immobilisation/${immobilisationId}/bon`, payload);
    return data;
  },

  /** Relance manuelle du contrôle pour cet équipement. Idempotent. */
  async verifier(immobilisationId) {
    const { data } = await api.post(`${BASE}/immobilisation/${immobilisationId}/verifier`);
    return data;
  },

  /** Relance manuelle du contrôle pour TOUS les équipements actifs. */
  async verifierToutes() {
    const { data } = await api.post(`${BASE}/verifier-toutes`);
    return data;
  },
};

export const STATUT_LABELS = {
  OK: 'À jour',
  A_VENIR: 'À venir',
  ATTEINT: 'Échéance atteinte',
  EN_RETARD: 'En retard',
  EN_COURS: 'Bon en cours',
};

export const STATUT_COLORS = {
  OK: '#16a34a',
  A_VENIR: '#f59e0b',
  ATTEINT: '#ea580c',
  EN_RETARD: '#dc2626',
  EN_COURS: '#2563eb',
};

/** Niveaux d'urgence d'un bon de maintenance. */
export const URGENCE_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
  { value: 4, label: 'Urgente' },
];

/** EquipementMaintenanceDeclenchement.ORIGINE_* */
export const ORIGINE_AUTOMATIQUE = 0;
export const ORIGINE_MANUELLE = 1;

export const ORIGINE_LABELS = {
  0: 'Automatique',
  1: 'Manuelle',
};

/** États de EquipementMaintenanceDeclenchement. */
export const DECLENCHEMENT_ETATS = ['En cours', 'Effectué', 'Annulé'];

export default equipementMaintenanceService;