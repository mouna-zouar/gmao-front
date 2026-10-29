import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import depotCubixService from '../services/depotCubixService';

/*
 * Dépôts Cubix (liste de référence partagée).
 * Chargés une seule fois puis gardés dans le store : les écrans suivants les reçoivent sans nouvel appel.
 *   dispatch(chargerDepots())                 → la liste (depuis le store si déjà chargée)
 *   dispatch(chargerDepots({ forcer: true })) → recharge depuis le serveur
 *   useAppSelector(selectDepots), selectDepotParId(id)
 */

let enVol = null; // évite deux appels simultanés quand plusieurs écrans s'ouvrent en même temps

export const chargerDepots = createAsyncThunk('depots/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().depots;
  if (!forcer && etat.statut === 'pret') return etat.liste;
  if (!enVol) enVol = depotCubixService.getAll().finally(() => { enVol = null; });
  const data = await enVol;
  return Array.isArray(data) ? data : [];
});

const depotsSlice = createSlice({
  name: 'depots',
  initialState: { liste: [], statut: 'vide', erreur: null }, // statut : vide | chargement | pret | erreur
  reducers: {
    viderDepots(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; },
  },
  extraReducers: (b) => {
    b.addCase(chargerDepots.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerDepots.fulfilled, (state, { payload }) => { state.liste = payload; state.statut = 'pret'; })
      .addCase(chargerDepots.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderDepots } = depotsSlice.actions;
export const selectDepots = (s) => s.depots.liste;
export const selectDepotsStatut = (s) => s.depots.statut;
export const selectDepotParId = (id) => (s) => s.depots.liste.find((d) => String(d.id) === String(id)) ?? null;
export default depotsSlice.reducer;
