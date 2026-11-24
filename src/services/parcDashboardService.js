import api from './api';

const parcDashboardService = {
  async getDashboard() {
    const { data } = await api.get('/parc/dashboard');
    return data;
  },
};

export default parcDashboardService;
