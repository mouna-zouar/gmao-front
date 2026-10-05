import api from './api';

const BASE = '/vehicule-maintenance';

const vehiculeMaintenanceService = {
  // ─── Référentiel configurable des seuils kilométriques ───

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

  // ─── Situation d'un véhicule ───

  /**
   * Retourne un tableau de :
   * { typeId, typeCode, typeLibelle, intervalleKm, kilometrageActuel,
   *   dernierKmMaintenance, prochainSeuilKm, kmRestants, statut,
   *   declenchementId, bonMaintenanceId, dateDeclenchement }
   */
  async getStatuts(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/statuts`);
    return data;
  },

  /** Historique des maintenances automatiquement déclenchées. */
  async getDeclenchements(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/declenchements`);
    return data;
  },

  /** Types actifs applicables à un véhicule (filtrés sur sa nature). */
  async getTypesApplicables(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/types`);
    return data;
  },

  /**
   * Crée un bon de maintenance à la demande depuis la fiche véhicule.
   *
   * payload : { typeId, description, urgence, dateDemande, reinitialiserSeuil,
   *             personnelDemandantId, personnelDemandantNom }
   *
   * Le véhicule, l'immatriculation et le kilométrage ne sont pas envoyés :
   * le serveur les relit lui-même pour éviter tout compteur périmé.
   *
   * Retourne { bon, declenchement, origine, kilometrage }.
   * 409 si un bon est déjà ouvert pour ce type sur ce véhicule.
   */
  async creerBonManuel(vehiculeId, payload) {
    const { data } = await api.post(`${BASE}/vehicule/${vehiculeId}/bon`, payload);
    return data;
  },

  /** Relance manuelle du contrôle. Idempotent. */
  async verifier(vehiculeId) {
    const { data } = await api.post(`${BASE}/vehicule/${vehiculeId}/verifier`);
    return data;
  },
};

export const STATUT_LABELS = {
  OK: 'À jour',
  A_VENIR: 'À venir',
  ATTEINT: 'Seuil atteint',
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

/** VehiculeMaintenanceDeclenchement.ORIGINE_* */
export const ORIGINE_AUTOMATIQUE = 0;
export const ORIGINE_MANUELLE = 1;

export const ORIGINE_LABELS = {
  0: 'Automatique',
  1: 'Manuelle',
};

/** États de VehiculeMaintenanceDeclenchement. */
export const DECLENCHEMENT_ETATS = ['En cours', 'Effectué', 'Annulé'];

export default vehiculeMaintenanceService;