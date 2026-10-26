import api from './api';

/* Tableau de bord global de la GMAO : tous les modules pour une période (en jours). */
const tableauDeBordService = {
  async tableau(jours = 30, recalculer = false) {
    const { data } = await api.get('/tableau-de-bord', { params: { jours, recalculer: recalculer || undefined } });
    return data;
  },
};

export default tableauDeBordService;
