import api from './api';

const bonMaintenanceService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/bon-maintenance', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/bon-maintenance/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/bon-maintenance', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/bon-maintenance/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/bon-maintenance/${id}`);
  },

  async changerEtat(id, nouvelEtat, motif = null) {
    const { data } = await api.patch(`/bon-maintenance/${id}/etat`, { nouvelEtat, motif });
    return data;
  },

  async passerEnCours(id) {
    const { data } = await api.patch(`/bon-maintenance/${id}/en-cours`);
    return data;
  },

  async suspendre(id, motif) {
    const { data } = await api.patch(`/bon-maintenance/${id}/suspendre`, { motif });
    return data;
  },

    async marquerEffectue(id, etat = null) {
    const params = etat !== null && etat !== undefined ? { etat } : {};
    const { data } = await api.patch(`/bon-maintenance/${id}/effectuer`, null, { params });
    return data;
  },

  async annuler(id) {
    const { data } = await api.patch(`/bon-maintenance/${id}/annuler`);
    return data;
  },
    async getDashboard() {
    const { data } = await api.get('/bon-maintenance/dashboard');
    return data;
  },
};

export default bonMaintenanceService;