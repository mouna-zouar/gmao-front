import api from './api';

/**
 * Étape ⑦ de la roadmap métier : RCA (Root Cause Analysis) / CAPA (Corrective And
 * Preventive Actions), voir /api/rca-capa (RcaCapaController).
 */
const rcaCapaService = {
  async creerAnalyse(payload) {
    const { data } = await api.post('/rca-capa/analyses', payload);
    return data; // AnalyseRcaDTO
  },

  async getAnalyse(analyseRcaId) {
    const { data } = await api.get(`/rca-capa/analyses/${analyseRcaId}`);
    return data;
  },

  /** Analyses RCA liées à un bon précis (le plus souvent une seule, la plus récente en premier). */
  async getParBon(bonMaintenanceId) {
    const { data } = await api.get(`/rca-capa/bon/${bonMaintenanceId}`);
    return data; // List<AnalyseRcaDTO>
  },

  /** Historique RCA d'un équipement. */
  async getParEquipement(lotArticleImmobilistationId) {
    const { data } = await api.get(`/rca-capa/equipement/${lotArticleImmobilistationId}`);
    return data;
  },

  async ajouterAction(analyseRcaId, payload) {
    const { data } = await api.post(`/rca-capa/analyses/${analyseRcaId}/actions`, payload);
    return data; // ActionCapaDTO
  },

  async majStatutAction(actionId, payload) {
    const { data } = await api.patch(`/rca-capa/actions/${actionId}/statut`, payload);
    return data; // ActionCapaDTO
  },

  /** Actions CAPA en retard, toutes analyses confondues. */
  async getActionsEnRetard() {
    const { data } = await api.get('/rca-capa/actions/en-retard');
    return data;
  },

  /** Bilan agrégé sur une période. */
  async getBilan(periode = {}) {
    const { data } = await api.get('/rca-capa/bilan', { params: periode });
    return data;
  },
};

export default rcaCapaService;