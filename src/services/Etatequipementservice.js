import api from './api';

const etatEquipementService = {
  async getAll() {
    const { data } = await api.get('/etat-equipement');
    return data; // List<EtatEquipementDTO>
  },

  async getHistorique(lotArticleImmobilistationId) {
    const { data } = await api.get(`/etat-equipement/${lotArticleImmobilistationId}/historique`);
    return data; // List<EtatEquipementTransitionDTO>
  },

  async recalculer(lotArticleImmobilistationId) {
    const { data } = await api.post(`/etat-equipement/${lotArticleImmobilistationId}/recalculer`);
    return data;
  },

  async recalculerTout() {
    const { data } = await api.post('/etat-equipement/recalculer-tout');
    return data;
  },

  /**
   * Assigne la criticité structurelle (C1-C4) d'un équipement.
   * PUT /api/etat-equipement/{id}/criticite?criticite=C1
   */
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