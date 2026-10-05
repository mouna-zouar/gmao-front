import api from './api';

 
const depotCubixService = {
  async getAll() {
    const { data } = await api.get('/gmao-cubix/depots');
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/gmao-cubix/depots/${id}`);
    return data;
  },

 
  async getPerstataireArticlesByDepotId(depotId) {
    const { data } = await api.get(`/gmao-cubix/depots/${depotId}/perstataire-articles`);
    return data;
  },
};

export default depotCubixService;