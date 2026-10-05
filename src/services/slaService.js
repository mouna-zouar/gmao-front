import api from './api';

/**
 * Étape ④ de la roadmap métier : SLA (délais de réponse et de résolution),
 * voir /api/sla (SlaController).
 */
const slaService = {
  /** SLA d'un bon précis. */
  async getPourBon(bonMaintenanceId) {
    const { data } = await api.get(`/sla/bon/${bonMaintenanceId}`);
    return data; // SlaBonDTO
  },

  /**
   * SLA de tous les bons créés sur une période.
   * @param {{dateDebut?: string, dateFin?: string}} periode - ISO datetime, optionnel
   *        (défaut backend : 3 derniers mois).
   */
  async getParPeriode(periode = {}) {
    const { data } = await api.get('/sla', { params: periode });
    return data; // List<SlaBonDTO>
  },

  /** Bons actuellement en dépassement SLA (réponse ou résolution), tous encore ouverts. */
  async getDepassements() {
    const { data } = await api.get('/sla/depassements');
    return data; // List<SlaBonDTO>
  },

  /** Bilan agrégé (taux de respect, répartition par priorité) sur une période. */
  async getBilan(periode = {}) {
    const { data } = await api.get('/sla/bilan', { params: periode });
    return data; // SlaBilanDTO
  },
};

export default slaService;