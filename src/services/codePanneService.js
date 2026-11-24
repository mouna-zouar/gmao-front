import api from './api';

const codePanneService = {
  async liste(tous = false, lotArticleImmobilistationId = null) {
    const params = {};
    if (tous) params.tous = true;
    if (lotArticleImmobilistationId) params.lotArticleImmobilistationId = lotArticleImmobilistationId;
    const { data } = await api.get('/codes-panne', { params });
    return Array.isArray(data) ? data : [];
  },
  async enregistrer(code) {
    const { data } = code.id
      ? await api.put(`/codes-panne/${code.id}`, code)
      : await api.post('/codes-panne', code);
    return data;
  },
  async desactiver(id) {
    await api.delete(`/codes-panne/${id}`);
  },
  async suggestion(demande, signal) {
    const { data } = await api.post('/reclamations/suggestion', demande, { signal });
    return data;
  },
};

export default codePanneService;
