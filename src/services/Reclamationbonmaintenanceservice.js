import api from './api';

const reclamationBonMaintenanceService = {
  async link(reclamationId, bonMaintenanceId) {
    await api.post('/reclamation-bon-maintenance/link', null, {
      params: { reclamationId, bonMaintenanceId },
    });
  },

  async unlink(reclamationId, bonMaintenanceId) {
    await api.delete('/reclamation-bon-maintenance/unlink', {
      params: { reclamationId, bonMaintenanceId },
    });
  },

  async getBonMaintenancesByReclamation(reclamationId) {
    const { data } = await api.get(`/reclamation-bon-maintenance/reclamation/${reclamationId}/bon-maintenances`);
    return data; // List<BonMaintenanceDTO>
  },

  async getReclamationsByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/reclamation-bon-maintenance/bon-maintenance/${bonMaintenanceId}/reclamations`);
    return data; // List<ReclamationDTO>
  },
};

export default reclamationBonMaintenanceService;