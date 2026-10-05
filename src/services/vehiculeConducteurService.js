import api from './api';

const vehiculeConducteurService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/vehicule-conducteur', {
      params: { page, size }
    });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/vehicule-conducteur/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/vehicule-conducteur', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/vehicule-conducteur/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule-conducteur/${id}`);
  },

  async getByPersonnel(personnelId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule-conducteur', {
      params: {
        personnelId,
        page,
        size
      }
    });
    return data;
  },

  async getHistoriqueByVehicule(vehiculeId) {
    const { data } = await api.get(
      `/vehicule-conducteur/vehicule/${vehiculeId}/historique`
    );
    return data;
  },

  async getConducteurActuel(vehiculeId) {
    const { data } = await api.get(
      `/vehicule-conducteur/vehicule/${vehiculeId}/conducteur-actuel`
    );
    return data;
  },

  async getVehiculeActuel(personnelId) {
    const { data } = await api.get(
      `/vehicule-conducteur/personnel/${personnelId}/vehicule-actuel`
    );
    return data;
  },

  /**
   * Vérifie si un conducteur est habilité (permis valide de catégorie compatible)
   * à conduire un véhicule donné, sans créer d'affectation. Utilisé pour
   * prévenir avant soumission du formulaire d'affectation.
   */
  async verifierEligibilite(personnelId, vehiculeId) {
    const { data } = await api.get('/vehicule-conducteur/eligibilite', {
      params: { personnelId, vehiculeId }
    });
    return data;
  }
};

export default vehiculeConducteurService;