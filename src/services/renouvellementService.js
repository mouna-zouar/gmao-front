import api from './api';
import authService from './Authservice';

/* Plan de renouvellement du parc : classement des équipements à remplacer et scénarios de budget. */

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const renouvellementService = {
  async tableau(recalculer = false) {
    const { data } = await api.get('/renouvellement', { params: { recalculer: recalculer || undefined } });
    return data;
  },

  async scenarios(liste) {
    const { data } = await api.post('/renouvellement/scenarios', liste);
    return data ?? [];
  },

  /** { coutRemplacement, anneeForcee, exclu, commentaire } : tout vide = retour au calcul automatique. */
  async ajuster(equipementId, ajustement) {
    const { data } = await api.put(`/renouvellement/equipements/${equipementId}/ajustement`, ajustement, { headers: enTeteAuteur() });
    return data;
  },

  async dureesVie() {
    const { data } = await api.get('/renouvellement/durees-vie');
    return data ?? [];
  },

  async enregistrerDureesVie(lignes) {
    const { data } = await api.put('/renouvellement/durees-vie', lignes);
    return data ?? [];
  },
};

export default renouvellementService;
