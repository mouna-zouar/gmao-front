import api from './api';

/**
 * Étape ⑤ de la roadmap métier : Coûts (main d'œuvre, pièces dépôt, achats),
 * voir /api/cout (CoutController).
 */
const coutService = {
  /** Coût réel d'un bon précis. */
  async getPourBon(bonMaintenanceId) {
    const { data } = await api.get(`/cout/bon/${bonMaintenanceId}`);
    return data; // CoutBonDTO
  },

  /**
   * Coût de tous les bons créés sur une période, du plus coûteux au moins coûteux.
   * @param {{dateDebut?: string, dateFin?: string}} periode - ISO datetime, optionnel
   *        (défaut backend : 3 derniers mois).
   */
  async getParPeriode(periode = {}) {
    const { data } = await api.get('/cout', { params: periode });
    return data; // List<CoutBonDTO>
  },

  /** Bilan agrégé (répartition par nature, par mois, top équipements) sur une période. */
  async getBilan(periode = {}) {
    const { data } = await api.get('/cout/bilan', { params: periode });
    return data; // CoutBilanDTO
  },
};

export default coutService;