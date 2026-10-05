import api from './api';

const depotQteService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/depot-qte', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/depot-qte/${id}`);
    return data;
  },

  async getByArticle(prestataireArticleId) {
    const { data } = await api.get(`/depot-qte/article/${prestataireArticleId}`);
    return data;
  },

  async getByDepot(depotId) {
    const { data } = await api.get(`/depot-qte/depot/${depotId}`);
    return data;
  },
};

export default depotQteService;