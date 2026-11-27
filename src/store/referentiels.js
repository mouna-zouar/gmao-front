import store from './index';
import { trouver } from './registre';

const cloner = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const obtenirReferentiel = (nom, options) => store.dispatch(trouver(nom).actions.charger(options)).unwrap().then(cloner);
export const perimerReferentiel = (nom) => store.dispatch(trouver(nom).actions.perimer());

export async function lireRequete(nom, params = {}, { forcer = false } = {}) {
  const req = trouver(nom);
  await store.dispatch(req.actions.executer({ params, forcer })).unwrap().catch((m) => {
    const erreur = new Error(typeof m === 'string' ? m : m?.message || 'Erreur');
    erreur.response = { data: { message: erreur.message } };
    throw erreur;
  });
  return cloner(req.selecteurs.entree(params)(store.getState()).donnees);
}

export const obtenirDepots = (options) => obtenirReferentiel('depots', options);
export const obtenirPrestataires = (options) => obtenirReferentiel('prestataires', options);
export const obtenirArticles = (options) => obtenirReferentiel('articles', options);
export const obtenirVehicules = (options) => obtenirReferentiel('vehicules', options);
export const obtenirEquipements = (options) => obtenirReferentiel('equipements', options);
export const obtenirEmplacements = (options) => obtenirReferentiel('emplacements', options);

export const obtenirPersonnels = (options) => obtenirReferentiel('personnels', options);
export const obtenirPersonnelsMaintenance = (options) => obtenirReferentiel('personnelsMaintenance', options);
export const obtenirServices = (options) => obtenirReferentiel('services', options);
export const obtenirFamilles = (options) => obtenirReferentiel('familles', options);
export const obtenirCodesPanne = (options) => obtenirReferentiel('codesPanne', options);
export const obtenirGammes = (options) => obtenirReferentiel('gammes', options);
export const obtenirCliniques = (options) => obtenirReferentiel('cliniques', options);
export const obtenirCalendriers = (options) => obtenirReferentiel('calendriers', options);
export const obtenirCarteLieux = (options) => obtenirReferentiel('lieux', options);

export const commePage = (liste) => ({ content: liste, totalElements: liste.length, totalPages: 1, number: 0 });
