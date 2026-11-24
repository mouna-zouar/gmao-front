import api from './api';
import authService from './Authservice';


const enTetesAuteur = () => {
  const user = authService.getCurrentUser();
  const id = user?.personnelId ?? user?.personnel?.id ?? user?.userId;
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return {
    ...(id != null ? { 'X-Personnel-Id': String(id) } : {}),
    ...(nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {}),
  };
};

const equipementService = {
  async rechercher(recherche = '', page = 0, taille = 30, familleId = null, serviceId = null, lieuId = null) {
    const { data } = await api.get('/equipements', {
      params: { recherche: recherche || undefined, familleId: familleId || undefined, serviceId: serviceId || undefined, lieuId: lieuId || undefined, page, taille },
    });
    return data;
  },

  async familles() {
    const { data } = await api.get('/equipements/familles');
    return data ?? [];
  },

  async resoudreCode(valeur) {
    const { data } = await api.get('/equipements/code', { params: { valeur } });
    return data.id;
  },

  async getFiche(id) {
    const { data } = await api.get(`/equipements/${id}/fiche`);
    return data;
  },

  async ajouterDocument(id, fichier, { titre, categorie } = {}) {
    const form = new FormData();
    form.append('fichier', fichier);
    if (titre) form.append('titre', titre);
    if (categorie) form.append('categorie', categorie);
    const { data } = await api.post(`/equipements/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data', ...enTetesAuteur() },
    });
    return data;
  },

  async supprimerDocument(documentId) {
    await api.delete(`/equipements/documents/${documentId}`);
  },

  async getConnexion(id) {
    const reponse = await api.get(`/equipements/${id}/connexion`);
    return reponse.status === 204 ? null : reponse.data;
  },

  async enregistrerConnexion(id, connexion) {
    const { data } = await api.put(`/equipements/${id}/connexion`, connexion, { headers: enTetesAuteur() });
    return data;
  },

  async supprimerConnexion(id) {
    await api.delete(`/equipements/${id}/connexion`);
  },

  async testerConnexion(id, saisie = null) {
    const { data } = await api.post(`/equipements/${id}/connexion/tester`, saisie || {});
    return data;
  },

  async listeConnexions() {
    const { data } = await api.get('/equipements/connexions');
    return data;
  },

  urlDocument(documentId) {
    return `${api.defaults.baseURL.replace(/\/$/, '')}/equipements/documents/${documentId}/fichier`;
  },

  urlFiche(id) {
    return `${window.location.origin}/equipement/${id}`;
  },
};

export default equipementService;