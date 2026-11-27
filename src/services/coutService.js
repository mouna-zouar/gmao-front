import api from './api';

const coutService = {
  async getPourBon(bonMaintenanceId) {
    const { data } = await api.get(`/cout/bon/${bonMaintenanceId}`);
    return data;
  },

  async getParPeriode(periode = {}) {
    const { data } = await api.get('/cout', { params: periode });
    return data;
  },

  async getVue(periode = {}) {
    const { data } = await api.get('/vues/cout', { params: periode });
    return data;
  },

  async getBilan(periode = {}) {
    const { data } = await api.get('/cout/bilan', { params: periode });
    return data;
  },
};

export default coutService;