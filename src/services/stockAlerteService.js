import api from './api';

const stockAlerteService = {
  async synthese(forcer = false) {
    const { data } = await api.get('/stock/alertes', { params: forcer ? { forcer: true } : undefined });
    return data;
  },
  async compter() {
    const { data } = await api.get('/stock/alertes/compte');
    return data;
  },
  async reglages() {
    const { data } = await api.get('/stock/alertes/reglages');
    return data;
  },
  async enregistrerReglages(r) {
    const { data } = await api.put('/stock/alertes/reglages', r);
    return data;
  },
};

export default stockAlerteService;
