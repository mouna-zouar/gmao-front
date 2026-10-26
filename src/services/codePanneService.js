import api from './api';

/* Codes panne (catalogue) et suggestion IA pendant la saisie d'une réclamation. */
const codePanneService = {
  async liste(tous = false) {
    const { data } = await api.get('/codes-panne', { params: tous ? { tous: true } : {} });
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
  /* { description, lotArticleImmobilistationId, reclamationId } -> { source, codes, piste, semblables, message } */
  async suggestion(demande, signal) {
    const { data } = await api.post('/reclamations/suggestion', demande, { signal });
    return data;
  },
};

export default codePanneService;
