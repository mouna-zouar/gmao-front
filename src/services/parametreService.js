import api from './api';

const parametreService = {
  async getAll() {
    const { data } = await api.get('/parametres');
    return data;
  },

  async saveMany(valeurs) {
    const { data } = await api.put('/parametres', valeurs);
    return data;
  },

  async reinitialiser(cle) {
    const { data } = await api.post(`/parametres/${cle}/reinitialiser`);
    return data;
  },

  async getFamillesCubix(prestataireId) {
    const { data } = await api.get('/gmao-cubix/familles-immobilisations', {
      params: { prestataireId: Number(prestataireId) > 0 ? prestataireId : undefined },
    });
    return (data ?? []).map((f) => ({
      id: f.Id ?? f.id,
      code: f.Code ?? f.code,
      nom: f.Nom ?? f.nom,
      nombre: Number(f.Nombre ?? f.nombre ?? 0),
      parentId: f.ParentId ?? f.parentId ?? null,
      parentCode: f.ParentCode ?? f.parentCode ?? null,
      parentNom: f.ParentNom ?? f.parentNom ?? null,
    }));
  },

  async getArticlesFamilleCubix(familleId, prestataireId) {
    const { data } = await api.get(`/gmao-cubix/familles-immobilisations/${familleId}/articles`, {
      params: { prestataireId: Number(prestataireId) > 0 ? prestataireId : undefined },
    });
    return (data ?? []).map((a) => ({
      id: a.Id ?? a.id,
      code: a.Code ?? a.code,
      designation: a.Designation ?? a.designation,
      nombre: Number(a.Nombre ?? a.nombre ?? 0),
      immobilisations: (a.Immobilisations ?? a.immobilisations ?? []).map(String),
    }));
  },

  async executerTache(code) {
    const { data } = await api.post(`/parametres/taches/${code}/executer`);
    return data;
  },

  async famillesSansDepot() {
    try {
      const liste = await this.getAll();
      const p = (Array.isArray(liste) ? liste : []).find((x) => x.cle === 'cubix.familles_sans_depot');
      return new Set(String(p?.valeur || '').split(',').map((x) => x.trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  },

  async prestataireEquipements() {
    try {
      const liste = await this.getAll();
      const p = (Array.isArray(liste) ? liste : []).find((x) => x.cle === 'cubix.prestataire_id');
      const n = Number(p?.valeur);
      return n > 0 ? n : null;
    } catch {
      return null;
    }
  },
};

export default parametreService;
