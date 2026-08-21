import api from './api';

const calendrierService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/calendrier', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/calendrier/${id}`);
    return data;
  },

  async getByCode(code) {
    const { data } = await api.get(`/calendrier/by-code/${code}`);
    return data;
  },
};

export default calendrierService;