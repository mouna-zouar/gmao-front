import api from './api';
import authService from './Authservice';

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const alerteMachineService = {
  async getAll(statut = '', page = 0, taille = 200) {
    const { data } = await api.get('/machines/alertes', { params: { statut: statut || undefined, page, taille } });
    return data;
  },

  async compterNouvelles() {
    const { data } = await api.get('/machines/alertes/count-nouvelles');
    return data?.count ?? 0;
  },

  async changerStatut(id, statut, commentaire) {
    const { data } = await api.patch(`/machines/alertes/${id}/statut`, { statut, commentaire: commentaire || undefined }, { headers: enTeteAuteur() });
    return data;
  },

  async acquitter(id, commentaire) {
    const { data } = await api.post(`/machines/alertes/${id}/acquitter`, { commentaire: commentaire || undefined }, { headers: enTeteAuteur() });
    return data;
  },

  async acquitterPlusieurs(ids, commentaire) {
    const { data } = await api.post('/machines/alertes/acquitter', { ids, commentaire: commentaire || undefined }, { headers: enTeteAuteur() });
    return data ?? [];
  },

  async sourdine(id, minutes, motif) {
    const { data } = await api.post(`/machines/alertes/${id}/sourdine`, { minutes, motif: motif || undefined }, { headers: enTeteAuteur() });
    return data;
  },

  async commenter(id, texte) {
    const { data } = await api.post(`/machines/alertes/${id}/commentaire`, { texte }, { headers: enTeteAuteur() });
    return data;
  },

  async indicateurs() {
    const { data } = await api.get('/machines/alertes/indicateurs');
    return data;
  },

  async escalade() {
    const { data } = await api.get('/machines/alertes/escalade');
    return data;
  },

  async enregistrerEscalade(reglages) {
    const { data } = await api.put('/machines/alertes/escalade', reglages);
    return data;
  },

  async lierReclamation(id, reclamationId) {
    const { data } = await api.patch(`/machines/alertes/${id}/reclamation`, { reclamationId }, { headers: enTeteAuteur() });
    return data;
  },

  async agents() {
    const { data } = await api.get('/machines/agents');
    return data ?? [];
  },

  async supprimerAgent(id) {
    await api.delete(`/machines/agents/${id}`);
  },

  async parEquipement(equipementId) {
    const { data } = await api.get(`/equipements/${equipementId}/alertes`);
    return data;
  },
};

export default alerteMachineService;
