import store from './index';
import { copie } from './fabriques/communs';
import {
  incidentsParc, missionsParc, reservationsParc, bonsCarburantParc, conducteursParc, amendesParc, permisParc,
} from './modules/parc';

const erreurApi = (m) => {
  const e = new Error(typeof m === 'string' ? m : m?.message || 'Erreur');
  e.response = { data: { message: e.message } };
  return e;
};
const lancer = (action) => store.dispatch(action).unwrap().catch((m) => { throw erreurApi(m); });

export function creerFacade(module) {
  const a = module.actions;
  const facade = {
    async getAll(page = 0, taille = 500, { forcer = false } = {}) {
      await lancer(a.charger({ params: { page, taille }, forcer }));
      const liste = copie(module.selecteurs.elements(store.getState()));
      return { content: liste, totalElements: liste.length, totalPages: 1, number: 0 };
    },
    getById: (id) => lancer(a.obtenir(id)),
    create: (donnees) => lancer(a.creer(donnees)),
    update: (id, donnees) => lancer(a.modifier({ id, donnees })),
    remove: (id) => lancer(a.supprimer(id)),
  };
  module.operations.forEach((nom) => {
    facade[nom] = (id, ...args) => lancer(a[nom]({ id, args })).then((r) => r.resultat);
  });
  return facade;
}

export const facadeIncidents = creerFacade(incidentsParc);
export const facadeMissions = creerFacade(missionsParc);
export const facadeReservations = creerFacade(reservationsParc);
export const facadeBonsCarburant = creerFacade(bonsCarburantParc);
export const facadeConducteurs = creerFacade(conducteursParc);
export const facadeAmendes = creerFacade(amendesParc);
export const facadePermis = creerFacade(permisParc);
