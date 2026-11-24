import api from './api';
import authService from './Authservice';

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const metrologieService = {
  async controles(equipementId) {
    const { data } = await api.get('/metrologie/controles', { params: equipementId ? { equipementId } : undefined });
    return data;
  },
  async echeancier() {
    const { data } = await api.get('/metrologie/echeancier');
    return data;
  },
  async enregistrer(id, controle) {
    const { data } = id
      ? await api.put(`/metrologie/controles/${id}`, controle, { headers: enTeteAuteur() })
      : await api.post('/metrologie/controles', controle, { headers: enTeteAuteur() });
    return data;
  },
  async supprimer(id) {
    await api.delete(`/metrologie/controles/${id}`);
  },

  async incidents() {
    const { data } = await api.get('/materiovigilance/incidents');
    return data;
  },
  async enregistrerIncident(id, incident) {
    const { data } = id
      ? await api.put(`/materiovigilance/incidents/${id}`, incident, { headers: enTeteAuteur() })
      : await api.post('/materiovigilance/incidents', incident, { headers: enTeteAuteur() });
    return data;
  },
  async changerStatut(id, changement) {
    const { data } = await api.post(`/materiovigilance/incidents/${id}/statut`, changement, { headers: enTeteAuteur() });
    return data;
  },
  async supprimerIncident(id) {
    await api.delete(`/materiovigilance/incidents/${id}`);
  },
  async delais() {
    const { data } = await api.get('/materiovigilance/delais');
    return data;
  },
  async enregistrerDelais(d) {
    const { data } = await api.put('/materiovigilance/delais', d);
    return data;
  },
};

export default metrologieService;
