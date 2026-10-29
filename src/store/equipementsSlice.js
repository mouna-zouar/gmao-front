import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import lotArticleImmobilistationService from '../services/Lotarticleimmobilistationservice';

/*
 * Équipements (immobilisations Cubix) : liste de référence partagée, utilisée dans les listes de choix
 * (bons, réclamations, véhicules, contrôles, réglages de maintenance).
 * Gardée VALIDITE_MS ; toute écriture sur un équipement ou son état la marque comme périmée
 * (voir store/index.js) : elle est rechargée au prochain besoin.
 *   dispatch(chargerEquipements())                 → la liste (depuis le store si encore valable)
 *   dispatch(chargerEquipements({ forcer: true })) → recharge depuis le serveur
 *   Hors composant : obtenirEquipements() de store/referentiels.js
 */

export const VALIDITE_MS = 5 * 60 * 1000;
const TAILLE = 5000;
let enVol = null;

export const chargerEquipements = createAsyncThunk('equipements/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().equipements;
  if (!forcer && etat.statut === 'pret' && Date.now() - etat.chargeLe < VALIDITE_MS) return etat.liste;
  if (!enVol) enVol = lotArticleImmobilistationService.getAll(0, TAILLE).finally(() => { enVol = null; });
  const data = await enVol;
  const liste = data?.content ?? data?.data ?? data;
  return Array.isArray(liste) ? liste : [];
});

const equipementsSlice = createSlice({
  name: 'equipements',
  initialState: { liste: [], statut: 'vide', erreur: null, chargeLe: 0 }, // statut : vide | chargement | pret | erreur
  reducers: {
    viderEquipements(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; state.chargeLe = 0; },
    /** La liste reste affichable mais sera rechargée au prochain chargerEquipements(). */
    perimerEquipements(state) { state.chargeLe = 0; },
  },
  extraReducers: (b) => {
    b.addCase(chargerEquipements.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerEquipements.fulfilled, (state, { payload }) => {
        if (payload !== state.liste) state.chargeLe = Date.now();
        state.liste = payload;
        state.statut = 'pret';
      })
      .addCase(chargerEquipements.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderEquipements, perimerEquipements } = equipementsSlice.actions;
export const selectEquipements = (s) => s.equipements.liste;
export const selectEquipementsStatut = (s) => s.equipements.statut;
export const selectEquipementParId = (id) => (s) => s.equipements.liste.find((e) => String(e.id) === String(id)) ?? null;
export default equipementsSlice.reducer;
