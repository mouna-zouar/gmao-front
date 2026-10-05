import api from './api';

/**
 * Étape ⑥ de la roadmap métier : Risques (score prédictif de panne 0-100 par
 * équipement), voir /api/maintenance-risque (MaintenanceRisqueController).
 */
const risqueService = {
  /**
   * Équipements les plus à risque, triés par score décroissant.
   * @param {number} limite - nombre max d'équipements renvoyés (défaut backend : 50).
   */
  async getRisques(limite) {
    const { data } = await api.get('/maintenance-risque', {
      params: limite ? { limite } : {},
    });
    return data; // List<RisqueEquipementDTO>
  },
};

export default risqueService;