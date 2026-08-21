import api from './api';

const bonMaintenanceIntervenantHistoriqueService = {
  async findByIntervenantId(bonMaintenanceIntervenantId) {
    const { data } = await api.get(`/bon-maintenance-intervenant-historique/intervenant/${bonMaintenanceIntervenantId}`);
    return data;
  },
};

export default bonMaintenanceIntervenantHistoriqueService;