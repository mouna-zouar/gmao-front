import api from './api';

const lotArticleImmobilistationService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/lot-article-immobilistation', { params: { page, size } });
    return data; // Page<LotArticleImmobilistationSummaryDTO>
  },

  async getById(id) {
    const { data } = await api.get(`/lot-article-immobilistation/${id}`);
    return data;
  },
};

export default lotArticleImmobilistationService;