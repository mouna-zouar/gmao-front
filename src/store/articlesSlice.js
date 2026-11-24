import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import prestataireArticleService from '../services/prestataireArticleService';

export const VALIDITE_MS = 2 * 60 * 1000;
let enVol = null;

export const chargerArticles = createAsyncThunk('articles/charger', async ({ forcer = false } = {}, { getState }) => {
  const etat = getState().articles;
  if (!forcer && etat.statut === 'pret' && Date.now() - etat.chargeLe < VALIDITE_MS) return etat.liste;
  if (!enVol) enVol = prestataireArticleService.getMaintenance().finally(() => { enVol = null; });
  const data = await enVol;
  return Array.isArray(data) ? data : [];
});

const articlesSlice = createSlice({
  name: 'articles',
  initialState: { liste: [], statut: 'vide', erreur: null, chargeLe: 0 },
  reducers: {
    viderArticles(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; state.chargeLe = 0; },
  },
  extraReducers: (b) => {
    b.addCase(chargerArticles.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerArticles.fulfilled, (state, { payload }) => {
        if (payload !== state.liste) state.chargeLe = Date.now();
        state.liste = payload;
        state.statut = 'pret';
      })
      .addCase(chargerArticles.rejected, (state, { error }) => { if (state.statut !== 'pret') state.statut = 'erreur'; state.erreur = error?.message || 'Erreur'; });
  },
});

export const { viderArticles } = articlesSlice.actions;
export const selectArticles = (s) => s.articles.liste;
export const selectArticlesStatut = (s) => s.articles.statut;
export const selectArticleParId = (id) => (s) => s.articles.liste.find((a) => String(a.id) === String(id)) ?? null;
export default articlesSlice.reducer;
