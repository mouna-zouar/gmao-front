import { creerReferentiel } from './fabriques/creerReferentiel';
import emplacementService from '../services/emplacementService';

export const VALIDITE_MS = 30 * 60 * 1000;

export const emplacements = creerReferentiel({
  nom: 'emplacements',
  charger: () => emplacementService.getAll(0, 2000),
  validiteMs: VALIDITE_MS,
  invalidePar: /^emplacements/,
});

export const chargerEmplacements = emplacements.actions.charger;
export const viderEmplacements = emplacements.actions.vider;
export const perimerEmplacements = emplacements.actions.perimer;
export const selectEmplacements = emplacements.selecteurs.liste;
export const selectEmplacementsStatut = emplacements.selecteurs.statut;
export const selectEmplacementParId = emplacements.selecteurs.parId;
export default emplacements.reducer;
