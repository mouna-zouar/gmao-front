import api from './api';

const prestataireDepotService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/prestataire-depot', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/prestataire-depot/${id}`);
    return data;
  },

  async getDepotIdsByServiceId(serviceId) {
    const { data } = await api.get(`/prestataire-depot-services/by-service/${serviceId}`);
    return data;
  },

  async getServiceIdsByDepotId(prestataireDepotId) {
    const { data } = await api.get(`/prestataire-depot-services/by-depot/${prestataireDepotId}`);
    return data;
  },
};

export default prestataireDepotService;