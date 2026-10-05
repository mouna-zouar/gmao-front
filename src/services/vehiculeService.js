import api from './api';

const vehiculeService = {
  async getAll(page = 0, size = 50) {
    const { data } = await api.get('/vehicule', {
      params: { page, size }
    });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/vehicule/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/vehicule', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/vehicule/${id}`, payload);
    return data;
  },

  async remove(id) {
    await api.delete(`/vehicule/${id}`);
  },

  async search(q, page = 0, size = 50) {
    const { data } = await api.get('/vehicule', {
      params: {
        q,
        page,
        size
      }
    });
    return data;
  },

  async getByClient(clientId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule', {
      params: {
        clientId,
        page,
        size
      }
    });
    return data;
  },

  async getByPrestataire(prestataireId, page = 0, size = 50) {
    const { data } = await api.get('/vehicule', {
      params: {
        prestataireId,
        page,
        size
      }
    });
    return data;
  },

  async getByEtat(etat, page = 0, size = 50) {
    const { data } = await api.get('/vehicule', {
      params: { etat, page, size }
    });
    return data;
  },

  /** Changement rapide d'état (cycle de vie) du véhicule. */
  async changeEtat(id, etat) {
    const { data } = await api.patch(`/vehicule/${id}/etat`, { etat });
    return data;
  },

  /**
   * PATCH /api/vehicule/{id}/kilometrage
   *
   * Passe par la même logique centralisée que les missions et les bons
   * carburant : un relevé inférieur au kilométrage actuel renvoie un 409
   * (err.response.data.message contient le détail à afficher).
   */
  async actualiserKilometrage(id, kilometrage, motif = null) {
    const { data } = await api.patch(`/vehicule/${id}/kilometrage`, {
      kilometrage,
      motif,
    });
    return data;
  },

    /** État courant du compteur, lu depuis la table dédiée. */
  async getCompteur(id) {
    const { data } = await api.get(`/vehicule/${id}/kilometrage`);
    return data;
  },

  /** Historique paginé des relevés kilométriques (mission, carburant, saisie...). */
  async getHistoriqueKilometrage(id, page = 0, size = 20) {
    const { data } = await api.get(`/vehicule/${id}/kilometrage/historique`, {
      params: { page, size },
    });
    return data;
  },
};

export default vehiculeService;
