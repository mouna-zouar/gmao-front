import api from './api';

const repartitionInterventionsService = {
  async suggererTechniciens({ lotArticleImmobilistationId, dateDebut, dateFin }) {
    const { data } = await api.post('/repartition-interventions/suggestions', {
      lotArticleImmobilistationId: lotArticleImmobilistationId || null,
      dateDebut: dateDebut || null,
      dateFin: dateFin || null,
    });
    return data; // List<SuggestionTechnicien>
  },
};

export default repartitionInterventionsService;