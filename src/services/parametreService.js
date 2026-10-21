import api from './api';

const parametreService = {
  async getAll() {
    const { data } = await api.get('/parametres');
    return data;
  },

  /** Enregistre plusieurs paramètres d'un coup ({ cle: valeur }) — tout ou rien côté serveur. */
  async saveMany(valeurs) {
    const { data } = await api.put('/parametres', valeurs);
    return data;
  },

  async reinitialiser(cle) {
    const { data } = await api.post(`/parametres/${cle}/reinitialiser`);
    return data;
  },

  /** Familles d'articles des immobilisations Cubix, avec leur nombre : [{ id, code, nom, nombre }] */
  async getFamillesCubix(prestataireId) {
    const { data } = await api.get('/gmao-cubix/familles-immobilisations', {
      params: { prestataireId: Number(prestataireId) > 0 ? prestataireId : undefined },
    });
    return (data ?? []).map((f) => ({ id: f.Id ?? f.id, code: f.Code ?? f.code, nom: f.Nom ?? f.nom, nombre: Number(f.Nombre ?? f.nombre ?? 0) }));
  },

  /** code : anomalies | blocages | parc_echeances */
  async executerTache(code) {
    const { data } = await api.post(`/parametres/taches/${code}/executer`);
    return data;
  },
};

export default parametreService;
