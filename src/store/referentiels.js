import store from './index';
import { chargerDepots } from './depotsSlice';
import { chargerPrestataires } from './prestatairesSlice';
import { chargerArticles } from './articlesSlice';
import { chargerVehicules } from './vehiculesSlice';
import { chargerEquipements } from './equipementsSlice';
import { chargerEmplacements } from './emplacementsSlice';

export const obtenirDepots = (options) => store.dispatch(chargerDepots(options)).unwrap();
export const obtenirPrestataires = (options) => store.dispatch(chargerPrestataires(options)).unwrap();
export const obtenirArticles = (options) => store.dispatch(chargerArticles(options)).unwrap();
export const obtenirVehicules = (options) => store.dispatch(chargerVehicules(options)).unwrap();
export const obtenirEquipements = (options) => store.dispatch(chargerEquipements(options)).unwrap();
export const obtenirEmplacements = (options) => store.dispatch(chargerEmplacements(options)).unwrap();

export const commePage = (liste) => ({ content: liste, totalElements: liste.length, totalPages: 1, number: 0 });
