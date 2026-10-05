import api from './api';

const blocageImmobilisationService = {
  async getAll(page = 0, size = 20) {
    const { data } = await api.get('/blocages-immobilisation', { params: { page, size } });
    return data;
  },

  async countNonTraitees() {
    const { data } = await api.get('/blocages-immobilisation/count-non-traitees');
    return data;
  },

  async analyserMaintenant() {
    const { data } = await api.post('/blocages-immobilisation/analyser');
    return data;
  },

  async changerStatut(id, statut, personnelId = null, personnelNom = null) {
    const { data } = await api.patch(`/blocages-immobilisation/${id}/statut`, { statut, personnelId, personnelNom });
    return data;
  },
};

export default blocageImmobilisationService;