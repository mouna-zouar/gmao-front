import { creerReferentiel } from './fabriques/creerReferentiel';
import prestataireArticleService from '../services/prestataireArticleService';

export const VALIDITE_MS = 2 * 60 * 1000;

export const articles = creerReferentiel({
  nom: 'articles',
  charger: () => prestataireArticleService.getMaintenance(),
  validiteMs: VALIDITE_MS,
  invalidePar: null,
});

export const chargerArticles = articles.actions.charger;
export const viderArticles = articles.actions.vider;
export const perimerArticles = articles.actions.perimer;
export const selectArticles = articles.selecteurs.liste;
export const selectArticlesStatut = articles.selecteurs.statut;
export const selectArticleParId = articles.selecteurs.parId;
export default articles.reducer;
