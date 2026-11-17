import api from './api';
import authService from './Authservice';

const auteur = () => {
  const u = authService.getCurrentUser() || {};
  const nom = u.userNom || [u.prenom, u.nom].filter(Boolean).join(' ') || u.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

/* Gammes d'intervention : modèles de tâches réutilisables, appliqués à un bon en un clic. */
const gammeService = {
  async lister() {
    const { data } = await api.get('/gammes');
    return data ?? [];
  },

  async lire(id) {
    const { data } = await api.get(`/gammes/${id}`);
    return data;
  },

  /** Gammes validées qui conviennent à l'équipement du bon (correspondance : MODELE, FAMILLE, GENERALE). */
  async proposees(bonId) {
    const { data } = await api.get('/gammes/proposees', { params: { bonId } });
    return data ?? [];
  },

  /** Gammes validées pour un équipement (formulaire de création du bon) ; sans équipement : gammes générales. */
  async proposeesPourEquipement(immoId) {
    const { data } = await api.get('/gammes/proposees', { params: { immoId: immoId || undefined } });
    return data ?? [];
  },

  async creer(gamme) {
    const { data } = await api.post('/gammes', gamme, { headers: auteur() });
    return data;
  },

  async modifier(id, gamme) {
    const { data } = await api.put(`/gammes/${id}`, gamme, { headers: auteur() });
    return data;
  },

  /** action : valider | nouvelle-version | dupliquer | archiver */
  async action(id, action) {
    const { data } = await api.post(`/gammes/${id}/${action}`, {}, { headers: auteur() });
    return data;
  },

  async supprimer(id) {
    await api.delete(`/gammes/${id}`);
  },

  /** → { taches: n } */
  async appliquer(bonId, gammeId) {
    const u = authService.getCurrentUser() || {};
    const { data } = await api.post('/gammes/appliquer', {
      bonId, gammeId, personnelId: u.personnelId ?? u.userId ?? null, personnelNom: u.userNom || u.login || null,
    });
    return data;
  },
};

export default gammeService;
