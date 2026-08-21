import api from './api';

const compteurService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/compteur', { params: { page, size } });
    return data; 
  },

  async getById(id) {
    const { data } = await api.get(`/compteur/${id}`);
    return data;
  },

  async create(compteur) {
    const { data } = await api.post('/compteur', compteur);
    return data;
  },

  async update(id, compteur) {
    const { data } = await api.put(`/compteur/${id}`, compteur);
    return data;
  },

  async remove(id) {
    await api.delete(`/compteur/${id}`);
  },
};

export default compteurService;