import api from './api';

/**
 * GET /api/parc/dashboard — vue d'ensemble du parc de véhicules.
 * Voir softsys.GMAO.PARC.dto.ParcDashboardDTO côté backend pour le détail
 * de chaque champ.
 */
const parcDashboardService = {
  async getDashboard() {
    const { data } = await api.get('/parc/dashboard');
    return data;
  },
};

export default parcDashboardService;
