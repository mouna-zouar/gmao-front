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

  /** code : anomalies | blocages | parc_echeances */
  async executerTache(code) {
    const { data } = await api.post(`/parametres/taches/${code}/executer`);
    return data;
  },
};

export default parametreService;
