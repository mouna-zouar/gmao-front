import api from './api';

const bonMaintenanceRapportService = {
  async get(bonId) {
    const { data, status } = await api.get(`/bon-maintenance/${bonId}/rapport`);
    return status === 204 || !data ? null : data;
  },

  async generer(bonId, langue = 'fr') {
    const { data } = await api.post(`/bon-maintenance/${bonId}/rapport/generer`, null, { params: { langue }, timeout: 120000 });
    return data;
  },

  async enregistrer(bonId, contenu) {
    const { data } = await api.put(`/bon-maintenance/${bonId}/rapport`, contenu);
    return data;
  },

  async valider(bonId, validation) {
    const { data } = await api.post(`/bon-maintenance/${bonId}/rapport/valider`, validation);
    return data;
  },

  async historiqueEquipement(lotArticleImmobilistationId) {
    const { data } = await api.get(`/bon-maintenance/rapports/equipement/${lotArticleImmobilistationId}`);
    return Array.isArray(data) ? data : [];
  },
};

export default bonMaintenanceRapportService;
