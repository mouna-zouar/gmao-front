import { creerReferentiel } from './fabriques/creerReferentiel';
import prestataireService from '../services/prestataireService';

export const prestataires = creerReferentiel({
  nom: 'prestataires',
  charger: () => prestataireService.getAll(0, 1000),
  validiteMs: null,
  invalidePar: /^prestataire/,
});

export const chargerPrestataires = prestataires.actions.charger;
export const viderPrestataires = prestataires.actions.vider;
export const perimerPrestataires = prestataires.actions.perimer;
export const selectPrestataires = prestataires.selecteurs.liste;
export const selectPrestatairesStatut = prestataires.selecteurs.statut;
export const selectPrestataireParId = prestataires.selecteurs.parId;
export default prestataires.reducer;
