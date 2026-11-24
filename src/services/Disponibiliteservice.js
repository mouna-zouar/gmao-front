import api from './api';

const disponibiliteService = {
  async getAll(periode = {}) {
    const { data } = await api.get('/disponibilite', { params: periode });
    return data;
  },

  async getPourEquipement(lotArticleImmobilistationId, periode = {}) {
    const { data } = await api.get(
      `/disponibilite/equipement/${lotArticleImmobilistationId}`,
      { params: periode }
    );
    return data;
  },
};

export default disponibiliteService;