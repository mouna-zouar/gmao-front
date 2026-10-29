import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import prestataireService from '../services/prestataireService';

/*
 * Prestataires / fournisseurs (liste de référence partagée, en lecture seule dans la GMAO).
 * Chargés une seule fois puis gardés dans le store.
 *   dispatch(chargerPrestataires())                 → la liste (depuis le store si déjà chargée)
 *   dispatch(chargerPrestataires({ forcer: true })) → recharge depuis le serveur
 *   Hors composant : obtenirPrestataires() de store/referentiels.js
 */

const TAILLE = 1000;
let enVol = null;

export const chargerPrestataires = createAsyncThunk('prestataires/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().prestataires;
  if (!forcer && etat.statut === 'pret') return etat.liste;
  if (!enVol) enVol = prestataireService.getAll(0, TAILLE).finally(() => { enVol = null; });
  const data = await enVol;
  const liste = data?.content ?? data;
  return Array.isArray(liste) ? liste : [];
});

const prestatairesSlice = createSlice({
  name: 'prestataires',
  initialState: { liste: [], statut: 'vide', erreur: null }, // statut : vide | chargement | pret | erreur
  reducers: {
    viderPrestataires(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; },
  },
  extraReducers: (b) => {
    b.addCase(chargerPrestataires.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerPrestataires.fulfilled, (state, { payload }) => { state.liste = payload; state.statut = 'pret'; })
      .addCase(chargerPrestataires.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderPrestataires } = prestatairesSlice.actions;
export const selectPrestataires = (s) => s.prestataires.liste;
export const selectPrestatairesStatut = (s) => s.prestataires.statut;
export const selectPrestataireParId = (id) => (s) => s.prestataires.liste.find((p) => String(p.id) === String(id)) ?? null;
export default prestatairesSlice.reducer;
