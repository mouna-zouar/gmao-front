import api from './api';

const anomalieService = {
  async getAll(page = 0, size = 20) {
    const { data } = await api.get('/anomalies', { params: { page, size } });
    return data;
  },

  async countNonTraitees() {
    const { data } = await api.get('/anomalies/count-non-traitees');
    return data;
  },

  async analyserMaintenant() {
    const { data } = await api.post('/anomalies/analyser');
    return data; // nouvelles anomalies détectées par cet appel
  },

  async changerStatut(id, statut, personnelId = null, personnelNom = null) {
    const { data } = await api.patch(`/anomalies/${id}/statut`, { statut, personnelId, personnelNom });
    return data;
  },
};

export default anomalieService;