import api from './api';

const bonMaintenanceIntervenantService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-intervenant/bon-maintenance/${bonMaintenanceId}`);
    return data; // List<BonMaintenanceIntervenantDTO>
  },
  async create(intervenant) {
    const { data } = await api.post('/bon-maintenance-intervenant', intervenant);
    return data;
  },
  async update(id, intervenant) {
    const { data } = await api.put(`/bon-maintenance-intervenant/${id}`, intervenant);
    return data;
  },
  async remove(id) {
    await api.delete(`/bon-maintenance-intervenant/${id}`);
  },
};

export default bonMaintenanceIntervenantService;