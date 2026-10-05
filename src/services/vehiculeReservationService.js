import api from './api';

const vehiculeReservationService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/vehicule-reservations', {
      params: { page, size }
    });

    return data;
  },

  async getById(id) {
    const { data } = await api.get(
      `/vehicule-reservations/${id}`
    );

    return data;
  },

  async create(payload) {
    const { data } = await api.post(
      '/vehicule-reservations',
      payload
    );

    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(
      `/vehicule-reservations/${id}`,
      payload
    );

    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule-reservations/${id}`);
  },

  async getByVehicule(vehiculeId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-reservations/vehicule/${vehiculeId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByPersonnel(personnelId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-reservations/personnel/${personnelId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByConducteur(conducteurId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-reservations/conducteur/${conducteurId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByProjet(projetId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-reservations/projet/${projetId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByEtat(etat, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-reservations/etat/${etat}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByVehiculeAndEtat(
    vehiculeId,
    etat,
    page = 0,
    size = 50
  ) {
    const { data } = await api.get(
      `/vehicule-reservations/vehicule/${vehiculeId}/etat/${etat}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  /**
   * Vérification en temps réel des conflits de réservation pour un
   * véhicule sur une période donnée. `dateDebut`/`dateFin` au format
   * "YYYY-MM-DDTHH:mm". `excludeId` : réservation à ignorer (édition).
   * Renvoie un tableau (vide = pas de conflit).
   */
  async checkConflicts(vehiculeId, dateDebut, dateFin, excludeId) {
    if (!vehiculeId || !dateDebut || !dateFin) return [];
    const { data } = await api.get('/vehicule-reservations/conflicts', {
      params: { vehiculeId, dateDebut, dateFin, excludeId: excludeId || undefined }
    });
    return data;
  }
};

export default vehiculeReservationService;