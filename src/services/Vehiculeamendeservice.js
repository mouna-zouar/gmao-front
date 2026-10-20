import api from './api';

/* Amendes (contraventions) des véhicules du parc — /api/vehicule-amendes */
const vehiculeAmendeService = {
  async getAll(page = 0, size = 500) {
    const { data } = await api.get('/vehicule-amendes', { params: { page, size, sort: 'dateInfraction,desc' } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/vehicule-amendes/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/vehicule-amendes', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/vehicule-amendes/${id}`, payload);
    return data;
  },

  /** Amendes reçues pendant une mission. */
  async getByMission(missionId) {
    const { data } = await api.get(`/vehicule-amendes/mission/${missionId}`);
    return Array.isArray(data) ? data : [];
  },

  async remove(id) {
    await api.delete(`/vehicule-amendes/${id}`);
  },

  /** Qui conduisait ce véhicule à cette date ? → { origine, conducteurId, conducteurNom, missionId, missionNum, missionDebut, missionFin } */
  async identifierConducteur(vehiculeId, date) {
    const { data } = await api.get('/vehicule-amendes/identifier-conducteur', { params: { vehiculeId, date } });
    return data;
  },

  /** { datePaiement, montantPaye, imputation } */
  async payer(id, paiement) {
    const { data } = await api.post(`/vehicule-amendes/${id}/paiement`, paiement);
    return data;
  },

  /** 0 = À payer, 1 = Contestée, 3 = Annulée */
  async changerStatut(id, statut) {
    const { data } = await api.patch(`/vehicule-amendes/${id}/statut`, null, { params: { statut } });
    return data;
  },
};

export default vehiculeAmendeService;