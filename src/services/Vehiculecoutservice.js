import api from './api';

/* Coût total par véhicule (/api/vehicule-couts) et frais fixes (/api/vehicule-frais) */
const vehiculeCoutService = {
  /** { debut, fin, vehicules: [...], totaux, kmParcourus, coutParKm } — debut/fin : 'YYYY-MM-DD' */
  async parc(debut, fin) {
    const { data } = await api.get('/vehicule-couts', { params: { debut, fin } });
    return data;
  },

  /** { resume, parMois: [{ mois, postes }], depenses: [...] } */
  async vehicule(vehiculeId, debut, fin) {
    const { data } = await api.get(`/vehicule-couts/${vehiculeId}`, { params: { debut, fin } });
    return data;
  },

  async frais(vehiculeId) {
    const { data } = await api.get('/vehicule-frais', { params: { vehiculeId } });
    return data;
  },

  async creerFrais(payload) {
    const { data } = await api.post('/vehicule-frais', payload);
    return data;
  },

  async modifierFrais(id, payload) {
    const { data } = await api.put(`/vehicule-frais/${id}`, payload);
    return data;
  },

  async supprimerFrais(id) {
    await api.delete(`/vehicule-frais/${id}`);
  },
};

export default vehiculeCoutService;