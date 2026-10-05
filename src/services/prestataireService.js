import api from './api';

const prestataireService = {
  async getAll(page = 0, size = 200) {
    const { data } = await api.get('/prestataire', { params: { page, size } });
    return data; 
  },

  async getById(id) {
    const { data } = await api.get(`/prestataire/${id}`);
    return data;
  },
};

export default prestataireService;