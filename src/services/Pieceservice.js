import api from './api';

const pieceService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/piece', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/piece/${id}`);
    return data;
  },
};

export default pieceService;