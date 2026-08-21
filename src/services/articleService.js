import api from './api';

const articleService = {
  async getAll(page = 0, size = 300) {
    const { data } = await api.get('/article', { params: { page, size } });
    return data; // Page<ArticleSummaryDTO>
  },

  async getById(id) {
    const { data } = await api.get(`/article/${id}`);
    return data;
  },
};

export default articleService;