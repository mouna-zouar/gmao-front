import api from './api';

const serviceService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/service', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/service/${id}`);
    return data;
  },
};

export default serviceService;