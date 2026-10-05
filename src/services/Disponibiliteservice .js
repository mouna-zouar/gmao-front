import api from './api';

/**
 * Étape ③ de la roadmap métier : Disponibilité (taux de disponibilité, MTBF, MTTR),
 * calculée côté backend à partir de l'historique EtatEquipementTransition —
 * voir /api/disponibilite (DisponibiliteController).
 */
const disponibiliteService = {
  /**
   * Disponibilité de tout le parc suivi, triée du plus problématique au meilleur.
   * @param {{dateDebut?: string, dateFin?: string}} periode - ISO datetime, optionnel
   *        (défaut backend : 12 derniers mois -> maintenant).
   */
  async getAll(periode = {}) {
    const { data } = await api.get('/disponibilite', { params: periode });
    return data; // List<DisponibiliteDTO>
  },

  /**
   * Disponibilité d'un équipement précis sur une période.
   */
  async getPourEquipement(lotArticleImmobilistationId, periode = {}) {
    const { data } = await api.get(
      `/disponibilite/equipement/${lotArticleImmobilistationId}`,
      { params: periode }
    );
    return data; // DisponibiliteDTO
  },
};

export default disponibiliteService;