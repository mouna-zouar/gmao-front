import api from './api';

// Articles du prestataire (Cubix : PerstataireArticles) dont l'article est de la catégorie 15 (maintenance).
// Chaque élément : { id (= prestataireArticlesId), articleId, designation, code, qteDisponible, depotId, ... }
const prestataireArticleService = {
  async getMaintenance({ categorie = 15, depotId } = {}) {
    const { data } = await api.get('/gmao-cubix/perstataire-articles', {
      params: { categorie, depotId: depotId ?? undefined },
    });
    return Array.isArray(data) ? data : (data?.content ?? []);
  },
};

export default prestataireArticleService;