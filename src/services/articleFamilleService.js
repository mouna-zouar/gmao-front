import api from './api';

const articleFamilleService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/article-famille', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/article-famille/${id}`);
    return data;
  },
};

export default articleFamilleService;