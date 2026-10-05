import api from './api';

const vehiculeMissionService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/vehicule-mission', {
      params: { page, size }
    });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/vehicule-mission/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/vehicule-mission', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/vehicule-mission/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule-mission/${id}`);
  },

  async getByVehicule(vehiculeId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule-mission', {
      params: {
        vehiculeId,
        page,
        size
      }
    });
    return data;
  },

  async getByConducteur(conducteurId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule-mission', {
      params: {
        conducteurId,
        page,
        size
      }
    });
    return data;
  },

  async getByEtat(etat, page = 0, size = 50) {
    const { data } = await api.get('/vehicule-mission', {
      params: {
        etat,
        page,
        size
      }
    });
    return data;
  },

  async getByProjet(projetId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule-mission', {
      params: {
        projetId,
        page,
        size
      }
    });
    return data;
  },

  async changerEtat(id, nouvelEtat) {
    const { data } = await api.patch(
      `/vehicule-mission/${id}/etat`,
      null,
      {
        params: { nouvelEtat }
      }
    );

    return data;
  },

  async demarrer(id) {
    const { data } = await api.post(
      `/vehicule-mission/${id}/demarrer`
    );

    return data;
  },

  async terminer(id, kilometrage = null, motifExecution = null) {
    const params = {};

    if (kilometrage !== null && kilometrage !== undefined) {
      params.kilometrage = kilometrage;
    }

    if (motifExecution !== null && motifExecution !== undefined) {
      params.motifExecution = motifExecution;
    }

    const { data } = await api.post(
      `/vehicule-mission/${id}/terminer`,
      null,
      { params }
    );

    return data;
  },

  async getProchainNumero() {
    const { data } = await api.get(
      '/vehicule-mission/prochain-numero'
    );

    return data;
  }
};

export default vehiculeMissionService;