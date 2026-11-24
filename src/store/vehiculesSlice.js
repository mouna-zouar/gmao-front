import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import vehiculeService from '../services/vehiculeService';

export const VALIDITE_MS = 2 * 60 * 1000;
const TAILLE = 2000;
let enVol = null;

export const chargerVehicules = createAsyncThunk('vehicules/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().vehicules;
  if (!forcer && etat.statut === 'pret' && Date.now() - etat.chargeLe < VALIDITE_MS) return etat.liste;
  if (!enVol) enVol = vehiculeService.getAll(0, TAILLE).finally(() => { enVol = null; });
  const data = await enVol;
  const liste = data?.content ?? data;
  return Array.isArray(liste) ? liste : [];
});

const vehiculesSlice = createSlice({
  name: 'vehicules',
  initialState: { liste: [], statut: 'vide', erreur: null, chargeLe: 0 },
  reducers: {
    viderVehicules(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; state.chargeLe = 0; },
    perimerVehicules(state) { state.chargeLe = 0; },
  },
  extraReducers: (b) => {
    b.addCase(chargerVehicules.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerVehicules.fulfilled, (state, { payload }) => {
        if (payload !== state.liste) state.chargeLe = Date.now();
        state.liste = payload;
        state.statut = 'pret';
      })
      .addCase(chargerVehicules.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderVehicules, perimerVehicules } = vehiculesSlice.actions;
export const selectVehicules = (s) => s.vehicules.liste;
export const selectVehiculesStatut = (s) => s.vehicules.statut;
export const selectVehiculeParId = (id) => (s) => s.vehicules.liste.find((v) => String(v.id) === String(id)) ?? null;
export default vehiculesSlice.reducer;
