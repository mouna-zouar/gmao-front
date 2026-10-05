import api from './api';

const cliniqueStockDepotService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/clinique-stock-depot', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/clinique-stock-depot/${id}`);
    return data;
  },

  async getByClinique(cliniqueId) {
    const { data } = await api.get(`/clinique-stock-depot/clinique/${cliniqueId}`);
    return data;
  },
};

export default cliniqueStockDepotService;