import api from './api';

const assistantService = {
  async question(question, langue, historique = []) {
    const { data } = await api.post('/assistant/question', { question, langue, historique });
    return data;
  },
  async agent(question, langue, historique = [], utilisateur = {}, lotArticleImmobilistationId = null) {
    const { data } = await api.post('/assistant/agent', {
      question, langue, historique, personnelId: utilisateur.id ?? null, personnelNom: utilisateur.nom ?? null,
      lotArticleImmobilistationId,
    });
    return data;
  },
  async suggestions() {
    const { data } = await api.get('/assistant/suggestions');
    return data?.suggestions || [];
  },
};

export default assistantService;
