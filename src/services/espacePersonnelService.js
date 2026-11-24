import api from './api';

const espacePersonnelService = {
  async getMesBons(personnelId) {
    const { data } = await api.get(`/espace-personnel/${personnelId}/bons`);
    return data;
  },
  async getMesBonsAvecRoles(personnelId) {
    const { data } = await api.get(`/espace-personnel/${personnelId}/bons-roles`);
    return data;
  },
  async getMesTaches(personnelId) {
    const { data } = await api.get(`/espace-personnel/${personnelId}/taches`);
    return data;
  },
  async changerEtatTache(personnelId, tacheId, etat) {
    const { data } = await api.patch(`/espace-personnel/${personnelId}/taches/${tacheId}/etat`, { etat });
    return data;
  },
  async getMesReclamations(personnelId) {
    const { data } = await api.get(`/espace-personnel/${personnelId}/reclamations`);
    return data;
  },
};

export default espacePersonnelService;
