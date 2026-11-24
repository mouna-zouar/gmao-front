import api from './api';

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