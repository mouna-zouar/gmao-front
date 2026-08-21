import api from './api';

const pieceLigneService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/piece-ligne', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/piece-ligne/${id}`);
    return data;
  },

  async getByPieceId(pieceId) {
    const { data } = await api.get(`/piece-ligne/piece/${pieceId}`);
    return data;
  },

  async getQuantiteDisponible(prestataireArticlesId) {
    const { data } = await api.get(`/piece-ligne/article/${prestataireArticlesId}/quantite-disponible`);
    return data;
  },
};

export default pieceLigneService;