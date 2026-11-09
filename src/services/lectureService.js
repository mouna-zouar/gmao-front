import api from './api';
import authService from './Authservice';

/*
 * « Lu / non lu » des réclamations et des bons : à l'ouverture d'une fiche, on prévient le serveur,
 * qui la marque lue si c'est son responsable (technicien affecté, intervenant du bon).
 * Appel « silencieux » : ne vide pas les lectures préchargées de la page (voir api.js).
 */
function lecteur() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    personnelId: id != null ? Number(id) : null,
    personnelNom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}

const lectureService = {
  /** → { lu, nouvelle, dateAttenteLecture, dateLecture, luParId, luParNom, delaiSecondes } */
  async reclamation(id) {
    const { data } = await api.post(`/reclamation/${id}/lu`, lecteur(), { silencieux: true });
    return data;
  },

  async bon(id) {
    const { data } = await api.post(`/bon-maintenance/${id}/lu`, lecteur(), { silencieux: true });
    return data;
  },
};

export default lectureService;
