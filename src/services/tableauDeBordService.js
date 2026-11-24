import api from './api';

const tableauDeBordService = {
  async tableau(jours = 30, recalculer = false, lieuId = null) {
    const { data } = await api.get('/tableau-de-bord', { params: { jours, recalculer: recalculer || undefined, lieuId: lieuId || undefined } });
    return data;
  },
};

export default tableauDeBordService;
