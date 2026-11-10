import api from './api';

const bonMaintenanceDocumentAchatService = {
  async findByBonMaintenanceId(bonMaintenanceId) {
    const { data } = await api.get(`/bon-maintenance-document-achat/bon-maintenance/${bonMaintenanceId}`);
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/bon-maintenance-document-achat/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/bon-maintenance-document-achat', payload);
    return data;
  },

  async demander(payload) {
    const { data } = await api.post('/bon-maintenance-document-achat/demander', payload);
    return data;
  },

  async commander(payload) {
    const { data } = await api.post('/bon-maintenance-document-achat/commander', payload);
    return data;
  },

  /** Transfère la pièce à Cubix (bon de fourniture BF-… / commande CMD-…) ; renvoie { succes, cubixNumPiece, message }. */
  async transfererCubix(pieceId, personnel = {}) {
    try {
      const { data } = await api.post(`/piece-editor/${pieceId}/transferer-cubix`, {
        personnelId: personnel.id ?? null, personnelNom: personnel.nom ?? null,
      });
      return data;
    } catch (e) {
      return e?.response?.data?.message ? e.response.data : { succes: false, message: null };
    }
  },

  async remove(id) {
    await api.delete(`/bon-maintenance-document-achat/${id}`);
  },
};

export default bonMaintenanceDocumentAchatService;