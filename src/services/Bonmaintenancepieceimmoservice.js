import api from './api';

const bonMaintenancePieceImmoService = {
  async findByBonMaintenanceId(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-piece-immo/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },

  async findByBonMaintenancePieceId(bonMaintenancePieceId) {
    const { data } = await api.get(`/bon-maintenance-piece-immo/bon-maintenance-piece/${bonMaintenancePieceId}`);
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/bon-maintenance-piece-immo/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/bon-maintenance-piece-immo', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/bon-maintenance-piece-immo/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/bon-maintenance-piece-immo/${id}`);
  },
};

export default bonMaintenancePieceImmoService;