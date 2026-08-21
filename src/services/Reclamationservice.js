import api from './api';

const reclamationService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/reclamation', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/reclamation/${id}`);
    return data;
  },

  async create(reclamation) {
    const { data } = await api.post('/reclamation', reclamation);
    return data;
  },

  async update(id, reclamation) {
    const { data } = await api.put(`/reclamation/${id}`, reclamation);
    return data;
  },

  async remove(id) {
    await api.delete(`/reclamation/${id}`);
  },

  async getWithBonMaintenance(id) {
    const { data } = await api.get(`/reclamation/${id}/details`);
    return data;
  },

  async getDashboard() {
    const { data } = await api.get('/reclamation/dashboard');
    return data;
  },
};

export default reclamationService;