import api from './api';

const bonMaintenanceTacheService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-tache/bon-maintenance/${bonMaintenanceId}`);
    return data; // List<BonMaintenanceTacheDTO>
  },
  async create(tache) {
    const { data } = await api.post('/bon-maintenance-tache', tache);
    return data;
  },
  async update(id, tache) {
    const { data } = await api.put(`/bon-maintenance-tache/${id}`, tache);
    return data;
  },
  async remove(id) {
    await api.delete(`/bon-maintenance-tache/${id}`);
  },
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/bon-maintenance-tache', { params: { page, size } });
    return data; // Page<BonMaintenanceTacheDTO>
  },
};

export default bonMaintenanceTacheService;