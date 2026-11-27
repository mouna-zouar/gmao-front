import { creerReferentiel } from './fabriques/creerReferentiel';
import depotCubixService from '../services/depotCubixService';

export const depots = creerReferentiel({
  nom: 'depots',
  charger: () => depotCubixService.getAll(),
  validiteMs: null,
  invalidePar: null,
});

export const chargerDepots = depots.actions.charger;
export const viderDepots = depots.actions.vider;
export const perimerDepots = depots.actions.perimer;
export const selectDepots = depots.selecteurs.liste;
export const selectDepotsStatut = depots.selecteurs.statut;
export const selectDepotParId = depots.selecteurs.parId;
export default depots.reducer;
