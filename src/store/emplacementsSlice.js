import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import emplacementService from '../services/emplacementService';

/*
 * Emplacements (lieux de départ / destination des missions, sites des projets…) : liste de référence partagée.
 * Elle change rarement : gardée VALIDITE_MS, et toute écriture sur /emplacements la marque comme périmée
 * (voir store/index.js) : elle est rechargée au prochain besoin.
 *   dispatch(chargerEmplacements())                 → la liste (depuis le store si encore valable)
 *   dispatch(chargerEmplacements({ forcer: true })) → recharge depuis le serveur
 *   Hors composant : obtenirEmplacements() de store/referentiels.js
 */

export const VALIDITE_MS = 30 * 60 * 1000;
const TAILLE = 2000;
let enVol = null;

export const chargerEmplacements = createAsyncThunk('emplacements/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().emplacements;
  if (!forcer && etat.statut === 'pret' && Date.now() - etat.chargeLe < VALIDITE_MS) return etat.liste;
  if (!enVol) enVol = emplacementService.getAll(0, TAILLE).finally(() => { enVol = null; });
  const data = await enVol;
  const liste = data?.content ?? data;
  return Array.isArray(liste) ? liste : [];
});

const emplacementsSlice = createSlice({
  name: 'emplacements',
  initialState: { liste: [], statut: 'vide', erreur: null, chargeLe: 0 }, // statut : vide | chargement | pret | erreur
  reducers: {
    viderEmplacements(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; state.chargeLe = 0; },
    /** La liste reste affichable mais sera rechargée au prochain chargerEmplacements(). */
    perimerEmplacements(state) { state.chargeLe = 0; },
  },
  extraReducers: (b) => {
    b.addCase(chargerEmplacements.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerEmplacements.fulfilled, (state, { payload }) => {
        if (payload !== state.liste) state.chargeLe = Date.now();
        state.liste = payload;
        state.statut = 'pret';
      })
      .addCase(chargerEmplacements.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderEmplacements, perimerEmplacements } = emplacementsSlice.actions;
export const selectEmplacements = (s) => s.emplacements.liste;
export const selectEmplacementsStatut = (s) => s.emplacements.statut;
export const selectEmplacementParId = (id) => (s) => s.emplacements.liste.find((e) => String(e.id) === String(id)) ?? null;
export default emplacementsSlice.reducer;
