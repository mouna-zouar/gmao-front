import api from './api';

const emplacementService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/emplacements', {
      params: { page, size }
    });

    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/emplacements/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/emplacements', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(
      `/emplacements/${id}`,
      payload
    );

    return data;
  },

  async remove(id) {
    await api.delete(`/emplacements/${id}`);
  },

  async getByVille(villeId, page = 0, size = 50) {
    const { data } = await api.get('/emplacements', {
      params: {
        villeId,
        page,
        size
      }
    });

    return data;
  },

  async search(query, page = 0, size = 50) {
    const { data } = await api.get('/emplacements', {
      params: {
        query,
        page,
        size
      }
    });

    return data;
  }
};

export default emplacementService;