import api from './api';

const diagnosticAssistantService = {
  async suggerer({ titre, description, lotArticleImmobilistationId }) {
    const { data } = await api.post('/diagnostic-assistant/suggestions', {
      titre: titre || '',
      description: description || '',
      lotArticleImmobilistationId: lotArticleImmobilistationId || null,
    });
    return data; // List<DiagnosticSuggestion>
  },
};

export default diagnosticAssistantService;