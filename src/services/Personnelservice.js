import api from './api';

const personnelService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/personnel', { params: { page, size } });
    return data;
  },

  async getMaintenance(page = 0, size = 200) {
    const { data } = await api.get('/personnel/maintenance', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/personnel/${id}`);
    return data;
  },
};

export default personnelService;