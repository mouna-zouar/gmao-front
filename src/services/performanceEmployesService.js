import api from './api';

/* Performance des employés (tableau de bord) et chrono en direct (liste des bons). */
const performanceEmployesService = {
  /** Indicateurs par employé sur les N derniers jours. */
  async performance(jours = 30) {
    const { data } = await api.get('/performance-employes', { params: { jours } });
    return data;
  },
  /** Qui travaille en ce moment, sur quoi, et depuis quand. */
  async chrono() {
    const { data } = await api.get('/performance-employes/chrono');
    return data;
  },
};

export default performanceEmployesService;
