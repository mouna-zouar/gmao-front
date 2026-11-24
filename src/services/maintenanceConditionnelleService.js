import api from './api';
import authService from './Authservice';

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const maintenanceConditionnelleService = {
  async regles(equipementId) {
    const { data } = await api.get('/maintenance-conditionnelle/regles', { params: { equipementId: equipementId || undefined } });
    return data ?? [];
  },

  async enregistrer(regle) {
    const { data } = regle.id
      ? await api.put(`/maintenance-conditionnelle/regles/${regle.id}`, regle, { headers: enTeteAuteur() })
      : await api.post('/maintenance-conditionnelle/regles', regle, { headers: enTeteAuteur() });
    return data;
  },

  async supprimer(id) {
    const { data } = await api.delete(`/maintenance-conditionnelle/regles/${id}`);
    return data;
  },

  async tester(id) {
    const { data } = await api.post(`/maintenance-conditionnelle/regles/${id}/tester`);
    return data;
  },

  async evaluer(id) {
    const { data } = await api.post(`/maintenance-conditionnelle/regles/${id}/evaluer`);
    return data;
  },

  async declenchements(equipementId) {
    const { data } = await api.get('/maintenance-conditionnelle/declenchements', { params: { equipementId: equipementId || undefined } });
    return data ?? [];
  },
};

export default maintenanceConditionnelleService;
