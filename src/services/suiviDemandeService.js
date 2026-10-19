import api from './api';

/**
 * « Mes demandes » : la personne qui a signalé une panne suit sa demande jusqu'à la réparation.
 * Backend : GET /api/suivi-demandes/personnel/{personnelId}
 */
const suiviDemandeService = {
  async getMesDemandes(personnelId) {
    if (personnelId == null) return [];
    const { data } = await api.get(`/suivi-demandes/personnel/${personnelId}`);
    return Array.isArray(data) ? data : [];
  },
};

export default suiviDemandeService;
