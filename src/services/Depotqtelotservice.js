import api from './api';

const depotQteLotService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/depot-qte-lot', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/depot-qte-lot/${id}`);
    return data;
  },

  async getByDepotQte(depotQteId) {
    const { data } = await api.get(`/depot-qte-lot/depot-qte/${depotQteId}`);
    return data;
  },
};

export default depotQteLotService;