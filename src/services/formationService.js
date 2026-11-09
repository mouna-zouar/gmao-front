import api from './api';

/* Formations des techniciens : sessions, participants et vérification avant affectation. */
const formationService = {
  async getAll() {
    const { data } = await api.get('/formations');
    return data ?? [];
  },
  async create(formation) {
    const { data } = await api.post('/formations', formation);
    return data;
  },
  async update(id, formation) {
    const { data } = await api.put(`/formations/${id}`, formation);
    return data;
  },
  async remove(id) {
    await api.delete(`/formations/${id}`);
  },
  /** Formations d'un technicien avec son résultat : [{ formation, resultat }] */
  async duPersonnel(personnelId) {
    const { data } = await api.get(`/formations/personnel/${personnelId}`);
    return data ?? [];
  },
  /** Assistant : intervenants proposés pour l'équipement du bon (ou l'équipement donné), les meilleurs d'abord. */
  async suggestionsIntervenants({ bonMaintenanceId, lotArticleImmobilistationId, limite = 5 }) {
    const { data } = await api.get('/formations/suggestions-intervenants', { params: { bonMaintenanceId, lotArticleImmobilistationId, limite } });
    return data ?? [];
  },
  /** { familleId, familleNom, forme (true | false | null), formations } */
  async verifier({ personnelId, bonMaintenanceId, lotArticleImmobilistationId }) {
    const { data } = await api.get('/formations/verifier', { params: { personnelId, bonMaintenanceId, lotArticleImmobilistationId } });
    return data;
  },
};

export default formationService;
