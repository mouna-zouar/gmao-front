import api from './api';

const rcaCapaService = {
  async creerAnalyse(payload) {
    const { data } = await api.post('/rca-capa/analyses', payload);
    return data;
  },

  async modifierAnalyse(analyseRcaId, payload) {
    const { data } = await api.put(`/rca-capa/analyses/${analyseRcaId}`, payload);
    return data;
  },

  async getContexteEquipement(lotArticleImmobilistationId, moisPareto) {
    const { data } = await api.get(`/rca-capa/equipement/${lotArticleImmobilistationId}/contexte`, { params: moisPareto ? { moisPareto } : {} });
    return data;
  },

  async getAnalyse(analyseRcaId) {
    const { data } = await api.get(`/rca-capa/analyses/${analyseRcaId}`);
    return data;
  },

  async getParBon(bonMaintenanceId) {
    const { data } = await api.get(`/rca-capa/bon/${bonMaintenanceId}`);
    return data;
  },

  async getParEquipement(lotArticleImmobilistationId) {
    const { data } = await api.get(`/rca-capa/equipement/${lotArticleImmobilistationId}`);
    return data;
  },

  async ajouterAction(analyseRcaId, payload) {
    const { data } = await api.post(`/rca-capa/analyses/${analyseRcaId}/actions`, payload);
    return data;
  },

  async majStatutAction(actionId, payload) {
    const { data } = await api.patch(`/rca-capa/actions/${actionId}/statut`, payload);
    return data;
  },

  async getActionsEnRetard() {
    const { data } = await api.get('/rca-capa/actions/en-retard');
    return data;
  },

  async getBilan(periode = {}) {
    const { data } = await api.get('/rca-capa/bilan', { params: periode });
    return data;
  },
};

export default rcaCapaService;