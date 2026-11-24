import api from './api';
import authService from './Authservice';

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const personnelId = user?.personnelId ?? user?.personnel?.id ?? user?.userId ?? null;
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return {
    ...(personnelId != null ? { 'X-Personnel-Id': String(personnelId) } : {}),
    ...(nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {}),
    ...(user?.admin ? { 'X-Admin': 'true' } : {}),
  };
};

const validationBonService = {
  async droits(bonId) {
    const { data } = await api.get(`/bon-maintenance/${bonId}/validation`, { headers: enTeteAuteur() });
    return data;
  },

  async valider(bonId, commentaire) {
    const { data } = await api.post(`/bon-maintenance/${bonId}/valider`, { commentaire: commentaire || undefined }, { headers: enTeteAuteur() });
    return data;
  },

  async refuser(bonId, motif) {
    const { data } = await api.post(`/bon-maintenance/${bonId}/refuser`, { motif }, { headers: enTeteAuteur() });
    return data;
  },

  async compter() {
    const { data } = await api.get('/bons/validation/compte');
    return data?.count ?? 0;
  },

  async reglages() {
    const { data } = await api.get('/bons/validation/reglages');
    return data;
  },

  async enregistrerReglages(r) {
    const { data } = await api.put('/bons/validation/reglages', r);
    return data;
  },
};

export default validationBonService;
