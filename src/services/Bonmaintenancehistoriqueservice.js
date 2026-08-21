import api from './api';

const bonMaintenanceHistoriqueService = {
  async findByBonMaintenanceId(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-historique/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },
};

export default bonMaintenanceHistoriqueService;