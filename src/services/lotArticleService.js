import api from './api';

const lotArticleService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/lot-article', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/lot-article/${id}`);
    return data;
  },
};

export default lotArticleService;