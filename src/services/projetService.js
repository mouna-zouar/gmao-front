import api from './api';

const projetService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/projets', {
      params: { page, size }
    });

    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/projets/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/projets', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/projets/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/projets/${id}`);
  },

  async getByEtat(etat, page = 0, size = 50) {
    const { data } = await api.get('/projets', {
      params: {
        etat,
        page,
        size
      }
    });

    return data;
  },

  async getByPrestataire(prestataireId, page = 0, size = 50) {
    const { data } = await api.get('/projets', {
      params: {
        prestataireId,
        page,
        size
      }
    });

    return data;
  },

  async search(query, page = 0, size = 50) {
    const { data } = await api.get('/projets', {
      params: {
        query,
        page,
        size
      }
    });

    return data;
  }
};

export default projetService;