import api from './api';

/**
 * Villes lues via le relais Cubix (ApiGmaoController C#).
 *
 * Endpoints Cubix :
 * GET /ApiGmao/GetVilles
 * GET /ApiGmao/GetVilleById?id={id}
 *
 * Le backend/frontend gateway doit exposer ces endpoints sous :
 * /gmao-cubix/villes
 */
const villeService = {
  async getAll() {
    const { data } = await api.get('/gmao-cubix/villes');
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/gmao-cubix/villes/${id}`);
    return data;
  },
};

export default villeService;