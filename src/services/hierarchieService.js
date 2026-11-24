import api from './api';
import authService from './Authservice';

const auteur = () => {
  const u = authService.getCurrentUser() || {};
  const nom = u.userNom || [u.prenom, u.nom].filter(Boolean).join(' ') || u.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const hierarchieService = {
  async carte() {
    const { data } = await api.get('/hierarchie/carte');
    return data;
  },

  async arbre() {
    const { data } = await api.get('/hierarchie/arbre');
    return data;
  },

  async equipements(lieuId, sousLieux = true) {
    const { data } = await api.get('/hierarchie/equipements', { params: { lieuId: lieuId ?? undefined, sousLieux } });
    return data;
  },

  async position(immoId) {
    const { data } = await api.get(`/hierarchie/equipements/${immoId}`);
    return data;
  },

  async definirParent(immoId, parentImmoId) {
    const { data } = await api.put(`/hierarchie/equipements/${immoId}/parent`, { parentImmoId }, { headers: auteur() });
    return data;
  },

  async affecter(equipements, lieuId) {
    const { data } = await api.post('/hierarchie/affecter', { equipements, lieuId }, { headers: auteur() });
    return data;
  },

  async creerLieu(lieu) {
    const { data } = await api.post('/hierarchie/lieux', lieu);
    return data;
  },

  async modifierLieu(id, lieu) {
    const { data } = await api.put(`/hierarchie/lieux/${id}`, lieu);
    return data;
  },

  async deplacerLieu(id, parentId) {
    const { data } = await api.put(`/hierarchie/lieux/${id}/parent`, { parentId });
    return data;
  },

  async desactiverLieu(id) {
    await api.delete(`/hierarchie/lieux/${id}`);
  },

  async servicesManquants() {
    const { data } = await api.post('/hierarchie/services-manquants');
    return data.nombre;
  },
};

export default hierarchieService;
