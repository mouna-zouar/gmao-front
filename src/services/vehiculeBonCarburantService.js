import api from './api';

const vehiculeBonCarburantService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get(
      '/vehicule-bon-carburant',
      {
        params: { page, size }
      }
    );

    return data;
  },

  async getById(id) {
    const { data } = await api.get(
      `/vehicule-bon-carburant/${id}`
    );

    return data;
  },

  async create(payload) {
    const { data } = await api.post(
      '/vehicule-bon-carburant',
      payload
    );

    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(
      `/vehicule-bon-carburant/${id}`,
      payload
    );

    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule-bon-carburant/${id}`);
  },

  async getByVehicule(vehiculeId, page = 0, size = 50) {
    const { data } = await api.get(
      '/vehicule-bon-carburant',
      {
        params: {
          vehiculeId,
          page,
          size
        }
      }
    );

    return data;
  },

  async getByPersonnel(personnelId, page = 0, size = 50) {
    const { data } = await api.get(
      '/vehicule-bon-carburant',
      {
        params: {
          personnelId,
          page,
          size
        }
      }
    );

    return data;
  },

  async getByVehiculeAndPeriode(
    vehiculeId,
    debut,
    fin
  ) {
    const { data } = await api.get(
      `/vehicule-bon-carburant/vehicule/${vehiculeId}/periode`,
      {
        params: {
          debut,
          fin
        }
      }
    );

    return data;
  },

  async getByPeriode(
    debut,
    fin,
    page = 0,
    size = 50
  ) {
    const { data } = await api.get(
      '/vehicule-bon-carburant',
      {
        params: {
          debut,
          fin,
          page,
          size
        }
      }
    );

    return data;
  },

  async getTotalMontant(
    vehiculeId,
    debut,
    fin
  ) {
    const { data } = await api.get(
      `/vehicule-bon-carburant/vehicule/${vehiculeId}/total`,
      {
        params: {
          debut,
          fin
        }
      }
    );

    return data;
  }
};

export default vehiculeBonCarburantService;