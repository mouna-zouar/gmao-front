import api from './api';

const tableauDeBordService = {
  async tableau(jours = 30, recalculer = false, lieuId = null) {
    const { data } = await api.get('/tableau-de-bord', { params: { jours, recalculer: recalculer || undefined, lieuId: lieuId || undefined } });
    return data;
  },

  /** Tableau de bord des bons de maintenance (mêmes paramètres). */
  async bons(jours = 30, recalculer = false, lieuId = null) {
    const { data } = await api.get('/tableau-de-bord/bons', { params: { jours, recalculer: recalculer || undefined, lieuId: lieuId || undefined } });
    return data;
  },

  /** Tableau de bord des réclamations (mêmes paramètres). */
  async reclamations(jours = 30, recalculer = false, lieuId = null) {
    const { data } = await api.get('/tableau-de-bord/reclamations', { params: { jours, recalculer: recalculer || undefined, lieuId: lieuId || undefined } });
    return data;
  },
};

export default tableauDeBordService;
