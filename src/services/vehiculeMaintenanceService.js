import api from './api';

const BASE = '/vehicule-maintenance';

const vehiculeMaintenanceService = {
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

  async removeType(id) {
    await api.delete(`${BASE}/types/${id}`);
  },

  async getStatuts(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/statuts`);
    return data;
  },

  async getDeclenchements(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/declenchements`);
    return data;
  },

  async getTypesApplicables(vehiculeId) {
    const { data } = await api.get(`${BASE}/vehicule/${vehiculeId}/types`);
    return data;
  },

  async creerBonManuel(vehiculeId, payload) {
    const { data } = await api.post(`${BASE}/vehicule/${vehiculeId}/bon`, payload);
    return data;
  },

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

export const URGENCE_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
  { value: 4, label: 'Urgente' },
];

export const ORIGINE_AUTOMATIQUE = 0;
export const ORIGINE_MANUELLE = 1;

export const ORIGINE_LABELS = {
  0: 'Automatique',
  1: 'Manuelle',
};

export const DECLENCHEMENT_ETATS = ['En cours', 'Effectué', 'Annulé'];

export default vehiculeMaintenanceService;