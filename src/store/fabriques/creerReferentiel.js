import { createAsyncThunk, createSlice, isDraft, original } from '@reduxjs/toolkit';
import { estReinitialisation, messageErreur, versListe } from './communs';

export function creerReferentiel({ nom, charger, validiteMs = 5 * 60 * 1000, invalidePar = null, transformer = versListe }) {
  let enVol = null;

  const chargerListe = createAsyncThunk(`${nom}/charger`, async ({ forcer = false } = {}, { getState }) => {
    const etat = getState()[nom];
    const frais = validiteMs == null || Date.now() - etat.chargeLe < validiteMs;
    if (!forcer && etat.statut === 'pret' && frais) return etat.liste;
    if (!enVol) enVol = Promise.resolve().then(charger).finally(() => { enVol = null; });
    return transformer(await enVol);
  });

  const initial = { liste: [], statut: 'vide', erreur: null, chargeLe: 0 };
  const slice = createSlice({
    name: nom,
    initialState: initial,
    reducers: {
      vider: () => initial,
      perimer(state) { state.chargeLe = 0; },
    },
    extraReducers: (b) => {
      b.addCase(chargerListe.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
        .addCase(chargerListe.fulfilled, (state, { payload }) => {
          const actuelle = isDraft(state.liste) ? original(state.liste) : state.liste;
          if (payload !== actuelle) { state.liste = payload; state.chargeLe = Date.now(); }
          state.statut = 'pret';
        })
        .addCase(chargerListe.rejected, (state, { error }) => {
          if (state.statut !== 'pret') state.statut = 'erreur';
          state.erreur = messageErreur(error);
        })
        .addMatcher(estReinitialisation, () => initial);
    },
  });

  const racine = (s) => s[nom];
  const selecteurs = {
    liste: (s) => racine(s).liste,
    statut: (s) => racine(s).statut,
    erreur: (s) => racine(s).erreur,
    chargeLe: (s) => racine(s).chargeLe,
    parId: (id) => (s) => racine(s).liste.find((x) => String(x.id) === String(id)) ?? null,
  };

  return {
    type: 'referentiel',
    nom,
    invalidePar,
    validiteMs,
    reducer: slice.reducer,
    actions: { charger: chargerListe, vider: slice.actions.vider, perimer: slice.actions.perimer },
    selecteurs,
  };
}
