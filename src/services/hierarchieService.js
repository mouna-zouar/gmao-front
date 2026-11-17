import api from './api';
import authService from './Authservice';

const auteur = () => {
  const u = authService.getCurrentUser() || {};
  const nom = u.userNom || [u.prenom, u.nom].filter(Boolean).join(' ') || u.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

/* Hiérarchie des lieux (site → bâtiment → étage → service → local) et des équipements. */
const hierarchieService = {
  /** { lieux: [{ id, parentId, type, nom, nbDirects, nbEquipements, nbArretes, bonsOuverts, nbBons, cout }], sansLieu, total } */
  /** { lieux: [{ id, parentId, type, nom, code }], equipements: { immoId: lieuId } } */
  async carte() {
    const { data } = await api.get('/hierarchie/carte');
    return data;
  },

  async arbre() {
    const { data } = await api.get('/hierarchie/arbre');
    return data;
  },

  /** lieuId null = équipements sans lieu */
  async equipements(lieuId, sousLieux = true) {
    const { data } = await api.get('/hierarchie/equipements', { params: { lieuId: lieuId ?? undefined, sousLieux } });
    return data;
  },

  /** { chemin: [{ id, type, nom }], parent, sousEnsembles, degrade, parentArrete, lieuChoisi } */
  async position(immoId) {
    const { data } = await api.get(`/hierarchie/equipements/${immoId}`);
    return data;
  },

  async definirParent(immoId, parentImmoId) {
    const { data } = await api.put(`/hierarchie/equipements/${immoId}/parent`, { parentImmoId }, { headers: auteur() });
    return data;
  },

  /** lieuId null = revenir au lieu par défaut (équipement principal ou service) */
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
