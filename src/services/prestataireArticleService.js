import api from './api';

// Articles du prestataire (Cubix : PerstataireArticles) dont l'article est de la catégorie 15 (maintenance).
// Chaque élément : { id (= prestataireArticlesId), articleId, designation, code, qteDisponible, depotId, ... }
const cache = new Map();

const prestataireArticleService = {
  async getMaintenance({ categorie = 15, depotId } = {}) {
    const { data } = await api.get('/gmao-cubix/perstataire-articles', {
      params: { categorie, depotId: depotId ?? undefined },
    });
    return Array.isArray(data) ? data : (data?.content ?? []);
  },

  // Un article du prestataire par son id (= prestataireArticlesId d'une ligne de pièce) :
  // { id, articleId, designation, code, uniteStock, ... }. Mis en cache pour la session.
  async getById(id) {
    const cle = String(id);
    if (!cache.has(cle)) {
      cache.set(cle, api.get(`/gmao-cubix/perstataire-articles/${id}`)
        .then(({ data }) => data)
        .catch((err) => { cache.delete(cle); throw err; }));
    }
    return cache.get(cle);
  },

  // Plusieurs ids d'un coup → { [id]: article } (les ids introuvables sont ignorés).
  async getParIds(ids) {
    const uniques = [...new Set((ids || []).filter((v) => v !== null && v !== undefined).map(String))];
    const res = await Promise.all(uniques.map((id) => prestataireArticleService.getById(id).catch(() => null)));
    return Object.fromEntries(uniques.map((id, i) => [id, res[i]]).filter(([, a]) => a));
  },
};

export default prestataireArticleService;