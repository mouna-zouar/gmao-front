import api from './api';
import authService from './Authservice';

/* Alertes envoyées par les machines (SNMP, Syslog, HTTP) et alertes de la surveillance réseau. */

const enTeteAuteur = () => {
  const user = authService.getCurrentUser();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {};
};

const alerteMachineService = {
  /** Page<AlerteMachineDTO> ; statut : NOUVELLE | VUE | IGNOREE | RESOLUE | (vide = toutes) */
  async getAll(statut = '', page = 0, taille = 200) {
    const { data } = await api.get('/machines/alertes', { params: { statut: statut || undefined, page, taille } });
    return data;
  },

  async compterNouvelles() {
    const { data } = await api.get('/machines/alertes/count-nouvelles');
    return data?.count ?? 0;
  },

  async changerStatut(id, statut) {
    const { data } = await api.patch(`/machines/alertes/${id}/statut`, { statut }, { headers: enTeteAuteur() });
    return data;
  },

  /** Relie l'alerte à la réclamation créée depuis elle (l'alerte passe en « Vue »). */
  async lierReclamation(id, reclamationId) {
    const { data } = await api.patch(`/machines/alertes/${id}/reclamation`, { reclamationId }, { headers: enTeteAuteur() });
    return data;
  },

  /** 10 dernières alertes d'un équipement. */
  async parEquipement(equipementId) {
    const { data } = await api.get(`/equipements/${equipementId}/alertes`);
    return data;
  },
};

export default alerteMachineService;
