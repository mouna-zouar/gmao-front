import api from './api';

const articleStockDepotService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/article-stock-depot', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/article-stock-depot/${id}`);
    return data;
  },
};

export default articleStockDepotService;