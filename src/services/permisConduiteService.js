import api from './api';

const permisConduiteService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/permis-conduite', {
      params: { page, size }
    });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/permis-conduite/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/permis-conduite', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/permis-conduite/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/permis-conduite/${id}`);
  },

  async getByPersonnel(personnelId, page = 0, size = 50) {
    const { data } = await api.get('/permis-conduite', {
      params: { personnelId, page, size }
    });
    return data;
  },

  async getAllByPersonnel(personnelId) {
    const { data } = await api.get(`/permis-conduite/personnel/${personnelId}`);
    return data;
  },

  async getDernierByPersonnel(personnelId) {
    const { data } = await api.get(`/permis-conduite/personnel/${personnelId}/dernier`);
    return data;
  },

  /**
   * Référentiel des catégories de permis tunisiennes (A1, A, B, B+E, C, C+E, D, D+E, F)
   * avec leurs libellés officiels, servi par le backend pour rester la source unique de vérité.
   */
  async getCategories() {
    const { data } = await api.get('/permis-conduite/categories');
    return data;
  }
};

export default permisConduiteService;
