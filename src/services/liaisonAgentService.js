import api from './api';
import authService from './Authservice';

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const liaisonAgentService = {
  async parEquipement(equipementId) {
    const { data } = await api.get(`/equipements/${equipementId}/liaisons-agent`);
    return data ?? [];
  },

  async enregistrer(equipementId, liaison) {
    const { data } = liaison.id
      ? await api.put(`/equipements/${equipementId}/liaisons-agent/${liaison.id}`, liaison, { headers: enTeteAuteur() })
      : await api.post(`/equipements/${equipementId}/liaisons-agent`, liaison, { headers: enTeteAuteur() });
    return data;
  },

  async supprimer(liaisonId) {
    await api.delete(`/liaisons-agent/${liaisonId}`);
  },

  async liste(agentNom) {
    const { data } = await api.get('/liaisons-agent', { params: { agent: agentNom || undefined } });
    return data ?? [];
  },
};

export default liaisonAgentService;
