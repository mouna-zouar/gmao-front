import api from './api';

const performanceEmployesService = {
  async performance(jours = 30) {
    const { data } = await api.get('/performance-employes', { params: { jours } });
    return data;
  },
  async chrono() {
    const { data } = await api.get('/performance-employes/chrono');
    return data;
  },
};

export default performanceEmployesService;
