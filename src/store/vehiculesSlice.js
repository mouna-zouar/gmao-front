import { creerReferentiel } from './fabriques/creerReferentiel';
import vehiculeService from '../services/vehiculeService';

export const VALIDITE_MS = 2 * 60 * 1000;

export const vehicules = creerReferentiel({
  nom: 'vehicules',
  charger: () => vehiculeService.getAll(0, 2000),
  validiteMs: VALIDITE_MS,
  invalidePar: /^vehicule/,
});

export const chargerVehicules = vehicules.actions.charger;
export const viderVehicules = vehicules.actions.vider;
export const perimerVehicules = vehicules.actions.perimer;
export const selectVehicules = vehicules.selecteurs.liste;
export const selectVehiculesStatut = vehicules.selecteurs.statut;
export const selectVehiculeParId = vehicules.selecteurs.parId;
export default vehicules.reducer;
