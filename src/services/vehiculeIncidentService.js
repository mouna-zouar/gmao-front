import api from './api';

const vehiculeIncidentService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/vehicule-incidents', {
      params: { page, size }
    });

    return data;
  },

  async getById(id) {
    const { data } = await api.get(
      `/vehicule-incidents/${id}`
    );

    return data;
  },

  async create(payload) {
    const { data } = await api.post(
      '/vehicule-incidents',
      payload
    );

    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(
      `/vehicule-incidents/${id}`,
      payload
    );

    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule-incidents/${id}`);
  },

  async getByVehicule(vehiculeId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-incidents/vehicule/${vehiculeId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByType(type, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-incidents/type/${type}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByEtat(etat, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-incidents/etat/${etat}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByGravite(gravite, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-incidents/gravite/${gravite}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByConducteur(conducteurId, page = 0, size = 50) {
    const { data } = await api.get(
      `/vehicule-incidents/conducteur/${conducteurId}`,
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getByVehiculeAndEtat(
    vehiculeId,
    etat,
    page = 0,
    size = 50
  ) {
    const { data } = await api.get(
      `/vehicule-incidents/vehicule/${vehiculeId}/etat/${etat}`,
      {
        params: { page, size }
      }
    );

    return data;
  }
};

export default vehiculeIncidentService;