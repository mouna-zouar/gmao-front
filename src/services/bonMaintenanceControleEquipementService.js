import api from './api';

const bonMaintenanceControleEquipementService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-controle-equipement/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },
  async create(controle) {
    const { data } = await api.post('/bon-maintenance-controle-equipement', controle);
    return data;
  },
  async update(id, controle) {
    const { data } = await api.put(`/bon-maintenance-controle-equipement/${id}`, controle);
    return data;
  },
  async remove(id) {
    await api.delete(`/bon-maintenance-controle-equipement/${id}`);
  },
};

export default bonMaintenanceControleEquipementService;