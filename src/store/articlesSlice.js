import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import prestataireArticleService from '../services/prestataireArticleService';

/*
 * Articles de maintenance (Cubix, catégorie 15) : liste de référence partagée.
 * Ils portent la quantité disponible en stock, qui bouge : la liste gardée dans le store
 * n'est réutilisée que pendant VALIDITE_MS, puis elle est rechargée au prochain besoin.
 * Après une demande ou une commande, l'éditeur de pièce force le rechargement.
 *   dispatch(chargerArticles())                 → la liste (depuis le store si encore valable)
 *   dispatch(chargerArticles({ forcer: true })) → recharge depuis le serveur
 *   Hors composant : obtenirArticles() de store/referentiels.js
 */

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
  initialState: { liste: [], statut: 'vide', erreur: null, chargeLe: 0 }, // statut : vide | chargement | pret | erreur
  reducers: {
    viderArticles(state) { state.liste = []; state.statut = 'vide'; state.erreur = null; state.chargeLe = 0; },
  },
  extraReducers: (b) => {
    b.addCase(chargerArticles.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
      .addCase(chargerArticles.fulfilled, (state, { payload }) => {
        if (payload !== state.liste) state.chargeLe = Date.now(); // liste reprise du store : on garde sa date
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
