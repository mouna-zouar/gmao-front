import api from './api';

const bonMaintenanceRemiseEnServiceService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-remise-en-service/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },
  async create(remiseEnService) {
    const { data } = await api.post('/bon-maintenance-remise-en-service', remiseEnService);
    return data;
  },
  async update(id, remiseEnService) {
    const { data } = await api.put(`/bon-maintenance-remise-en-service/${id}`, remiseEnService);
    return data;
  },
  async remove(id) {
    await api.delete(`/bon-maintenance-remise-en-service/${id}`);
  },
};

export default bonMaintenanceRemiseEnServiceService;