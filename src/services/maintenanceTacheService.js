import api from './api';

const maintenanceTacheService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/maintenance-tache', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/maintenance-tache/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/maintenance-tache', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/maintenance-tache/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/maintenance-tache/${id}`);
  },
};

export default maintenanceTacheService;