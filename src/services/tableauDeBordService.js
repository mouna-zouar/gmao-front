import api from './api';

/* Tableau de bord global de la GMAO : tous les modules pour une période (en jours). */
const tableauDeBordService = {
  // lieuId : limiter au lieu de l'arborescence (et ses sous-lieux)
  async tableau(jours = 30, recalculer = false, lieuId = null) {
    const { data } = await api.get('/tableau-de-bord', { params: { jours, recalculer: recalculer || undefined, lieuId: lieuId || undefined } });
    return data;
  },
};

export default tableauDeBordService;
