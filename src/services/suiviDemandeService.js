import api from './api';

const suiviDemandeService = {
  async getMesDemandes(personnelId) {
    if (personnelId == null) return [];
    const { data } = await api.get(`/suivi-demandes/personnel/${personnelId}`);
    return Array.isArray(data) ? data : [];
  },
};

export default suiviDemandeService;
