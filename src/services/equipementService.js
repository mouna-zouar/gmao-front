import api from './api';
import authService from './Authservice';

/* Page « Équipements » et fiche d'un équipement. */

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
  /** Page<{ id, designation, marque, modele, numPiece, codeBarre, etatActuel, criticite, garantie }> */
  async rechercher(recherche = '', page = 0, taille = 30) {
    const { data } = await api.get('/equipements', { params: { recherche: recherche || undefined, page, taille } });
    return data;
  },

  /** Code lu sur une étiquette (URL de la fiche, identifiant ou code-barre) → identifiant. */
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
    // Content-Type explicite : sinon axios transformerait le FormData en JSON
    const { data } = await api.post(`/equipements/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data', ...enTetesAuteur() },
    });
    return data;
  },

  async supprimerDocument(documentId) {
    await api.delete(`/equipements/documents/${documentId}`);
  },

  /** Adresse du fichier, à ouvrir dans un nouvel onglet. */
  urlDocument(documentId) {
    return `${api.defaults.baseURL.replace(/\/$/, '')}/equipements/documents/${documentId}/fichier`;
  },

  /** Adresse encodée dans le QR code : la fiche de l'équipement. */
  urlFiche(id) {
    return `${window.location.origin}/equipement/${id}`;
  },
};

export default equipementService;