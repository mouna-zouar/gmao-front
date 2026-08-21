import api from './api';

const bonMaintenanceCommentaireService = {
  async getByBonMaintenance(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-commentaire/bon-maintenance/${bonMaintenanceId}`);
    return data; // List<BonMaintenanceCommentaireDTO>
  },
  async create(commentaire) {
    const { data } = await api.post('/bon-maintenance-commentaire', commentaire);
    return data;
  },
  async remove(id) {
    await api.delete(`/bon-maintenance-commentaire/${id}`);
  },
};

export default bonMaintenanceCommentaireService;