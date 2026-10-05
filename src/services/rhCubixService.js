import api from './api';

/**
 * Services et Personnels RH lus via le relais Cubix (ApiRhController C#),
 * distinct de Serviceservice.js/Personnelservice.js existants (qui lisent
 * directement la base SQL Server locale via JPA).
 */
const rhCubixService = {
  async getServices() {
    const { data } = await api.get('/rh-cubix/services');
    return data;
  },

  async getServiceById(id) {
    const { data } = await api.get(`/rh-cubix/services/${id}`);
    return data;
  },

  async getPersonnels() {
    const { data } = await api.get('/rh-cubix/personnels');
    return data;
  },

  async getPersonnelById(id) {
    const { data } = await api.get(`/rh-cubix/personnels/${id}`);
    return data;
  },
};

export default rhCubixService;