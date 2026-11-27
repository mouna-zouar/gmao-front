import api from './api';

const slaService = {
  async getPourBon(bonMaintenanceId) {
    const { data } = await api.get(`/sla/bon/${bonMaintenanceId}`);
    return data;
  },

  async getParPeriode(periode = {}) {
    const { data } = await api.get('/sla', { params: periode });
    return data;
  },

  async getPourBons(ids) {
    if (!ids?.length) return [];
    const { data } = await api.post('/sla/bons', ids);
    return data;
  },

  async getOuverts() {
    const { data } = await api.get('/sla/ouverts');
    return data;
  },

  async getDepassements() {
    const { data } = await api.get('/sla/depassements');
    return data;
  },

  async getVue(periode = {}) {
    const { data } = await api.get('/vues/sla', { params: periode });
    return data;
  },

  async getBilan(periode = {}) {
    const { data } = await api.get('/sla/bilan', { params: periode });
    return data;
  },
};

export default slaService;