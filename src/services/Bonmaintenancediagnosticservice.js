import api from './api';

const bonMaintenanceDiagnosticService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-diagnostic/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },

  async create(diagnostic) {
    const { data } = await api.post('/bon-maintenance-diagnostic', diagnostic);
    return data;
  },

  async update(id, diagnostic) {
    const { data } = await api.put(`/bon-maintenance-diagnostic/${id}`, diagnostic);
    return data;
  },

  async remove(id) {
    await api.delete(`/bon-maintenance-diagnostic/${id}`);
  },
};

export default bonMaintenanceDiagnosticService;