import api from './api';

const reclamationService = {
  async getAll(page = 0, size = 100) {
    const { data } = await api.get('/reclamation', { params: { page, size } });
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/reclamation/${id}`);
    return data;
  },

  async create(reclamation) {
    const { data } = await api.post('/reclamation', reclamation);
    return data;
  },

  async update(id, reclamation) {
    const { data } = await api.put(`/reclamation/${id}`, reclamation);
    return data;
  },

  async remove(id) {
    await api.delete(`/reclamation/${id}`);
  },

  async getWithBonMaintenance(id) {
    const { data } = await api.get(`/reclamation/${id}/details`);
    return data;
  },

  async getDashboard() {
    const { data } = await api.get('/reclamation/dashboard');
    return data;
  },

  async valider(id, payload) {
    const { data } = await api.patch(`/reclamation/${id}/valider`, payload);
    return data;
  },

  async rejeter(id, payload) {
    const { data } = await api.patch(`/reclamation/${id}/rejeter`, payload);
    return data;
  },

  /* Cycle de vie (modèle IBM Maximo) : corps { groupeId, groupeNom, personnelAffecteId, personnelAffecteNom, motif, auteurId, auteurNom } */
  async affecter(id, corps) {
    const { data } = await api.patch(`/reclamation/${id}/affecter`, corps);
    return data;
  },

  async prendreEnCharge(id, corps = {}) {
    const { data } = await api.patch(`/reclamation/${id}/prendre-en-charge`, corps);
    return data;
  },

  async resoudre(id, corps = {}) {
    const { data } = await api.patch(`/reclamation/${id}/resoudre`, corps);
    return data;
  },

  async cloturer(id, corps = {}) {
    const { data } = await api.patch(`/reclamation/${id}/cloturer`, corps);
    return data;
  },

  async rouvrir(id, corps) {
    const { data } = await api.patch(`/reclamation/${id}/rouvrir`, corps);
    return data;
  },

  async annuler(id, corps) {
    const { data } = await api.patch(`/reclamation/${id}/annuler`, corps);
    return data;
  },

  /* Check-lists à remplir avant d'envoyer une réclamation */
  async checklist(lotArticleImmobilistationId) {
    const { data } = await api.get('/reclamation/checklist', { params: { lotArticleImmobilistationId } });
    return data; // { famille, familleId, familleNom, parDefaut, questions: [...], questionFinale }
  },

  async checklists() {
    const { data } = await api.get('/reclamation/checklists');
    return data;
  },

  /** famille : id de la famille ou « defaut » ; questions vides = revenir aux questions par défaut */
  async enregistrerChecklist(famille, familleNom, questions) {
    const { data } = await api.put(`/reclamation/checklists/${famille}`, { familleNom, questions });
    return data;
  },

  /** Historique des affectations et des changements d'état. */
  async historique(id) {
    const { data } = await api.get(`/reclamation/${id}/historique`);
    return data;
  },
};

export default reclamationService;