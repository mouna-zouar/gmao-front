import api from './api';

/**
 * Immobilisations lues/modifiees via le relais Cubix (ApiGmaoController C#),
 * distinct de lotArticleImmobilistationService.js existant (qui lit directement
 * la base SQL Server locale via JPA en lecture seule). Celui-ci permet aussi
 * les modifications (quantite disponible, etat fonctionnel).
 */
const lotArticleImmobilistationCubixService = {
  async getAll() {
    const { data } = await api.get('/gmao-cubix/lot-article-immobilisations');
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/gmao-cubix/lot-article-immobilisations/${id}`);
    return data;
  },

  async modifierQuantiteDisponible(id, qteDisponible) {
    const { data } = await api.patch(
      `/gmao-cubix/lot-article-immobilisations/${id}/quantite-disponible`,
      { qteDisponible }
    );
    return data;
  },

  async modifierEtatFonc(id, etatFonc) {
    const { data } = await api.patch(
      `/gmao-cubix/lot-article-immobilisations/${id}/etat-fonc`,
      { etatFonc }
    );
    return data;
  },
};

export default lotArticleImmobilistationCubixService;