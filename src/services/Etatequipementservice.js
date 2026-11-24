import api from './api';

const etatEquipementService = {
  async getAll() {
    const { data } = await api.get('/etat-equipement');
    return data;
  },

  async getHistorique(lotArticleImmobilistationId) {
    const { data } = await api.get(`/etat-equipement/${lotArticleImmobilistationId}/historique`);
    return data;
  },

  async recalculer(lotArticleImmobilistationId) {
    const { data } = await api.post(`/etat-equipement/${lotArticleImmobilistationId}/recalculer`);
    return data;
  },

  async recalculerTout() {
    const { data } = await api.post('/etat-equipement/recalculer-tout');
    return data;
  },

  async definirCriticite(lotArticleImmobilistationId, criticite) {
    const { data } = await api.put(
      `/etat-equipement/${lotArticleImmobilistationId}/criticite`,
      null,
      { params: { criticite } }
    );
    return data;
  },
};

export default etatEquipementService;