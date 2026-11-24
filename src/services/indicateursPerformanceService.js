import api from './api';

const indicateursPerformanceService = {
  async rapport({ debut, fin, groupe, lieuId } = {}) {
    const { data } = await api.get('/indicateurs-performance', {
      params: { debut: debut || undefined, fin: fin || undefined, groupe: groupe || undefined, lieuId: lieuId || undefined },
    });
    return data;
  },
};

export default indicateursPerformanceService;
