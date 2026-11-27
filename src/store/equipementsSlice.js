import { serviceDiffere } from './fabriques/serviceDiffere';
import { creerReferentiel } from './fabriques/creerReferentiel';

const lotArticleImmobilistationService = serviceDiffere(() => import('../services/Lotarticleimmobilistationservice'));

export const VALIDITE_MS = 5 * 60 * 1000;

export const equipements = creerReferentiel({
  nom: 'equipements',
  charger: () => lotArticleImmobilistationService.getAll(0, 5000),
  validiteMs: VALIDITE_MS,
  invalidePar: /^(lot-article-immobilistation|equipements|etat-equipement|renouvellement\/equipements)/,
});

export const chargerEquipements = equipements.actions.charger;
export const viderEquipements = equipements.actions.vider;
export const perimerEquipements = equipements.actions.perimer;
export const selectEquipements = equipements.selecteurs.liste;
export const selectEquipementsStatut = equipements.selecteurs.statut;
export const selectEquipementParId = equipements.selecteurs.parId;
export const selectEquipementsParService = (serviceId) => (s) =>
  s.equipements.liste.filter((e) => String(e.serviceId) === String(serviceId));
export default equipements.reducer;
