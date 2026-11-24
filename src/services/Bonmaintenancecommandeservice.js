import api from './api';

const bonMaintenanceCommandeService = {
  async getArticlesDisponibles(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-commande/bon-maintenance/${bonMaintenanceId}/articles-disponibles`);
    return data;
  },

  async getArticlesADemander(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-commande/bon-maintenance/${bonMaintenanceId}/articles-a-demander`);
    return data;
  },
};

export default bonMaintenanceCommandeService;