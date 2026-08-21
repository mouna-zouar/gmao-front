import api from './api';

const bonMaintenancePieceService = {
  async findByBonMaintenanceId(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-piece/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/bon-maintenance-piece/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/bon-maintenance-piece', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/bon-maintenance-piece/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/bon-maintenance-piece/${id}`);
  },
};

export default bonMaintenancePieceService;