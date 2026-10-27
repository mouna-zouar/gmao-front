import api from './api';

/* Assistant de questions en langage naturel sur les données de la GMAO. */
const assistantService = {
  async question(question, langue, historique = []) {
    const { data } = await api.post('/assistant/question', { question, langue, historique });
    return data;
  },
  async suggestions() {
    const { data } = await api.get('/assistant/suggestions');
    return data?.suggestions || [];
  },
};

export default assistantService;
