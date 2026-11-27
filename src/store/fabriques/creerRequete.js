import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { cleParametres, estReinitialisation, messageErreur } from './communs';

export function creerRequete({ nom, executer, validiteMs = 60 * 1000, invalidePar = null, maxEntrees = 12 }) {
  const enVol = new Map();

  const lancer = createAsyncThunk(`${nom}/executer`, async ({ params, forcer = false } = {}, { getState, rejectWithValue }) => {
    const cle = cleParametres(params);
    const entree = getState()[nom].parCle[cle];
    if (!forcer && entree?.statut === 'pret' && Date.now() - entree.chargeLe < validiteMs) return { cle, inchange: true };
    try {
      if (!enVol.has(cle)) enVol.set(cle, Promise.resolve().then(() => executer(params ?? {}, { forcer })).finally(() => enVol.delete(cle)));
      return { cle, donnees: await enVol.get(cle) };
    } catch (e) { return rejectWithValue(messageErreur(e)); }
  });

  const initial = { parCle: {} };
  const cleDe = (meta) => cleParametres(meta?.arg?.params);
  const slice = createSlice({
    name: nom,
    initialState: initial,
    reducers: {
      perimer(state) { Object.values(state.parCle).forEach((e) => { e.chargeLe = 0; }); },
      vider: () => initial,
    },
    extraReducers: (b) => {
      b.addCase(lancer.pending, (state, { meta }) => {
        const cle = cleDe(meta);
        const e = state.parCle[cle];
        if (e) { e.erreur = null; if (e.statut !== 'pret') e.statut = 'chargement'; e.enCours = true; } else {
          state.parCle[cle] = { donnees: null, statut: 'chargement', erreur: null, chargeLe: 0, enCours: true, vuLe: Date.now() };
        }
        state.parCle[cle].vuLe = Date.now();
        const cles = Object.keys(state.parCle);
        if (cles.length > maxEntrees) {
          cles.filter((k) => k !== cle).sort((a, c) => state.parCle[a].vuLe - state.parCle[c].vuLe)
            .slice(0, cles.length - maxEntrees).forEach((k) => { delete state.parCle[k]; });
        }
      })
        .addCase(lancer.fulfilled, (state, { payload }) => {
          const e = state.parCle[payload.cle];
          if (!e) return;
          e.enCours = false;
          e.statut = 'pret';
          if (!payload.inchange) { e.donnees = payload.donnees; e.chargeLe = Date.now(); }
        })
        .addCase(lancer.rejected, (state, { meta, payload, error }) => {
          const e = state.parCle[cleDe(meta)];
          if (!e) return;
          e.enCours = false;
          if (e.statut !== 'pret') e.statut = 'erreur';
          e.erreur = payload || messageErreur(error);
        })
        .addMatcher(estReinitialisation, () => initial);
    },
  });

  const VIDE = Object.freeze({ donnees: null, statut: 'vide', erreur: null, chargeLe: 0, enCours: false });
  const selecteurs = {
    entree: (params) => (s) => s[nom].parCle[cleParametres(params)] ?? VIDE,
  };

  return {
    type: 'requete',
    nom,
    invalidePar,
    validiteMs,
    reducer: slice.reducer,
    actions: { executer: lancer, perimer: slice.actions.perimer, vider: slice.actions.vider },
    selecteurs,
  };
}
