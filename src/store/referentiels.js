import store from './index';
import { chargerDepots } from './depotsSlice';
import { chargerPrestataires } from './prestatairesSlice';
import { chargerArticles } from './articlesSlice';
import { chargerVehicules } from './vehiculesSlice';
import { chargerEquipements } from './equipementsSlice';
import { chargerEmplacements } from './emplacementsSlice';

/*
 * Accès aux listes de référence du store sous forme de promesse, pour le code qui n'est pas
 * un composant React (configuration de formulaire, fonctions d'impression, modales en async…).
 * Le premier appel interroge le serveur, les suivants répondent depuis le store.
 */
export const obtenirDepots = (options) => store.dispatch(chargerDepots(options)).unwrap();
export const obtenirPrestataires = (options) => store.dispatch(chargerPrestataires(options)).unwrap();
export const obtenirArticles = (options) => store.dispatch(chargerArticles(options)).unwrap();
export const obtenirVehicules = (options) => store.dispatch(chargerVehicules(options)).unwrap();
export const obtenirEquipements = (options) => store.dispatch(chargerEquipements(options)).unwrap();
export const obtenirEmplacements = (options) => store.dispatch(chargerEmplacements(options)).unwrap();

/** Pour le code qui attend une page Spring ({ content }) : obtenirVehicules().then(commePage) */
export const commePage = (liste) => ({ content: liste, totalElements: liste.length, totalPages: 1, number: 0 });
