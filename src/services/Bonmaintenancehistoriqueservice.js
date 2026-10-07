import api from './api';

const bonMaintenanceHistoriqueService = {
  async findByBonMaintenanceId(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-historique/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },

  // alias utilisé par BonMaintenanceDetails.jsx
  async getByBonMaintenance(bonMaintenanceId) {
    return bonMaintenanceHistoriqueService.findByBonMaintenanceId(bonMaintenanceId);
  },
};

export default bonMaintenanceHistoriqueService;