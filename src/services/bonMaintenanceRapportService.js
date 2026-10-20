import api from './api';

/* Rapport d'intervention d'un bon de maintenance (rédigé par l'IA, relu et validé) */
const bonMaintenanceRapportService = {
  /** Rapport du bon, ou null s'il n'a pas encore été généré (204). */
  async get(bonId) {
    const { data, status } = await api.get(`/bon-maintenance/${bonId}/rapport`);
    return status === 204 || !data ? null : data;
  },

  /** Génère (ou régénère) le brouillon. langue : fr, ar ou en. */
  async generer(bonId, langue = 'fr') {
    const { data } = await api.post(`/bon-maintenance/${bonId}/rapport/generer`, null, { params: { langue }, timeout: 120000 });
    return data;
  },

  /** contenu : { resume, panneConstatee, causeIdentifiee, remede, travauxRealises[], piecesRemplacees[], controlesEtRemiseEnService, recommandations[] } */
  async enregistrer(bonId, contenu) {
    const { data } = await api.put(`/bon-maintenance/${bonId}/rapport`, contenu);
    return data;
  },

  /** { personnelId, personnelNom, completerBon } */
  async valider(bonId, validation) {
    const { data } = await api.post(`/bon-maintenance/${bonId}/rapport/valider`, validation);
    return data;
  },

  /** Rapports validés d'un équipement, du plus récent au plus ancien. */
  async historiqueEquipement(lotArticleImmobilistationId) {
    const { data } = await api.get(`/bon-maintenance/rapports/equipement/${lotArticleImmobilistationId}`);
    return Array.isArray(data) ? data : [];
  },
};

export default bonMaintenanceRapportService;
