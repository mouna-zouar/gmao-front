import api from './api';

const cache = new Map();

const prestataireArticleService = {
  async getMaintenance({ categorie = 15, depotId } = {}) {
    const { data } = await api.get('/gmao-cubix/perstataire-articles', {
      params: { categorie, depotId: depotId ?? undefined },
    });
    return Array.isArray(data) ? data : (data?.content ?? []);
  },

  async getById(id) {
    const cle = String(id);
    if (!cache.has(cle)) {
      cache.set(cle, api.get(`/gmao-cubix/perstataire-articles/${id}`)
        .then(({ data }) => data)
        .catch((err) => { cache.delete(cle); throw err; }));
    }
    return cache.get(cle);
  },

  async getParIds(ids) {
    const uniques = [...new Set((ids || []).filter((v) => v !== null && v !== undefined).map(String))];
    const res = await Promise.all(uniques.map((id) => prestataireArticleService.getById(id).catch(() => null)));
    return Object.fromEntries(uniques.map((id, i) => [id, res[i]]).filter(([, a]) => a));
  },
};

export default prestataireArticleService;