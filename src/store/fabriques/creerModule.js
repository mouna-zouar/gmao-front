import {
  createAsyncThunk, createEntityAdapter, createSlice, isAnyOf, isFulfilled, isPending, isRejected,
} from '@reduxjs/toolkit';
import { cleParametres, copie, estReinitialisation, messageErreur, totalDe, versListe } from './communs';

export function creerModule({
  nom, service = {}, operations = {}, idDe = (x) => x?.id, filtresInitiaux = {}, validiteMs = 60 * 1000,
  invalidePar = null, trier,
}) {
  const adaptateur = createEntityAdapter({ selectId: idDe, ...(trier ? { sortComparer: trier } : {}) });
  const enVol = new Map();

  const exiger = (fn, quoi) => {
    if (typeof fn !== 'function') throw new Error(`Module « ${nom} » : « ${quoi} » n'est pas défini dans le service.`);
    return fn;
  };
  const rejeter = (e, rejectWithValue) => rejectWithValue(messageErreur(e));

  const charger = createAsyncThunk(`${nom}/charger`, async ({ params, forcer = false } = {}, { getState, rejectWithValue }) => {
    const etat = getState()[nom];
    const cle = cleParametres(params);
    if (!forcer && etat.statut === 'pret' && etat.cle === cle && Date.now() - etat.chargeLe < validiteMs) return { inchange: true, cle };
    try {
      if (!enVol.has(cle)) enVol.set(cle, Promise.resolve().then(() => exiger(service.lister, 'lister')(params)).finally(() => enVol.delete(cle)));
      const data = await enVol.get(cle);
      const liste = versListe(data);
      return { liste, total: totalDe(data, liste), cle, params: params ?? null };
    } catch (e) { return rejeter(e, rejectWithValue); }
  });

  const obtenir = createAsyncThunk(`${nom}/obtenir`, async (id, { rejectWithValue }) => {
    try { return await exiger(service.obtenir, 'obtenir')(id); } catch (e) { return rejeter(e, rejectWithValue); }
  });

  const creer = createAsyncThunk(`${nom}/creer`, async (donnees, { rejectWithValue }) => {
    try { return await exiger(service.creer, 'creer')(donnees); } catch (e) { return rejeter(e, rejectWithValue); }
  });

  const modifier = createAsyncThunk(`${nom}/modifier`, async ({ id, donnees }, { rejectWithValue }) => {
    try { return await exiger(service.modifier, 'modifier')(id, donnees); } catch (e) { return rejeter(e, rejectWithValue); }
  });

  const supprimer = createAsyncThunk(`${nom}/supprimer`, async (id, { rejectWithValue }) => {
    try { await exiger(service.supprimer, 'supprimer')(id); return id; } catch (e) { return rejeter(e, rejectWithValue); }
  });

  const ops = Object.fromEntries(Object.entries(operations).map(([cle, fn]) => [cle, createAsyncThunk(
    `${nom}/${cle}`,
    async ({ id, args = [] } = {}, { dispatch, rejectWithValue }) => {
      try {
        const r = await fn(id, ...args);
        if (r && typeof r === 'object' && idDe(r) != null) return { id, element: r, resultat: r };
        if (id != null && typeof service.obtenir === 'function') await dispatch(obtenir(id));
        return { id, element: null, resultat: r };
      } catch (e) { return rejeter(e, rejectWithValue); }
    },
  )]));

  const initial = adaptateur.getInitialState({
    statut: 'vide', erreur: null, chargeLe: 0, cle: null, params: null, total: 0,
    filtres: filtresInitiaux, selectionId: null, enCours: {}, erreurAction: null,
  });

  const debutAction = (state, id) => { if (id != null) state.enCours[id] = true; state.erreurAction = null; };
  const finAction = (state, id) => { if (id != null) delete state.enCours[id]; };
  const idArg = (meta) => {
    const a = meta?.arg;
    return a == null ? null : typeof a === 'object' ? a.id ?? null : a;
  };

  const slice = createSlice({
    name: nom,
    initialState: initial,
    reducers: {
      definirFiltres(state, { payload }) { state.filtres = { ...state.filtres, ...payload }; },
      reinitialiserFiltres(state) { state.filtres = filtresInitiaux; },
      selectionner(state, { payload }) { state.selectionId = payload ?? null; },
      perimer(state) { state.chargeLe = 0; },
      vider: () => initial,
      upsert(state, { payload }) { adaptateur.upsertOne(state, copie(payload)); },
      retirer(state, { payload }) { adaptateur.removeOne(state, payload); },
    },
    extraReducers: (b) => {
      b.addCase(charger.pending, (state) => { if (state.statut !== 'pret') state.statut = 'chargement'; state.erreur = null; })
        .addCase(charger.fulfilled, (state, { payload }) => {
          state.statut = 'pret';
          if (payload.inchange) return;
          adaptateur.setAll(state, payload.liste);
          state.total = payload.total;
          state.cle = payload.cle;
          state.params = payload.params;
          state.chargeLe = Date.now();
          if (state.selectionId != null && !state.entities[state.selectionId]) state.selectionId = null;
        })
        .addCase(charger.rejected, (state, { payload, error }) => {
          if (state.statut !== 'pret') state.statut = 'erreur';
          state.erreur = payload || messageErreur(error);
        })
        .addCase(obtenir.fulfilled, (state, { payload }) => { if (payload && idDe(payload) != null) adaptateur.upsertOne(state, copie(payload)); })
        .addCase(creer.fulfilled, (state, { payload }) => {
          if (payload && idDe(payload) != null) { adaptateur.upsertOne(state, copie(payload)); state.total += 1; }
          state.chargeLe = 0;
        })
        .addCase(modifier.fulfilled, (state, { payload }) => { if (payload && idDe(payload) != null) adaptateur.upsertOne(state, copie(payload)); })
        .addCase(supprimer.fulfilled, (state, { payload }) => {
          if (state.entities[payload]) state.total = Math.max(0, state.total - 1);
          adaptateur.removeOne(state, payload);
          if (String(state.selectionId) === String(payload)) state.selectionId = null;
        });
      const suivis = [obtenir, creer, modifier, supprimer, ...Object.values(ops)];
      const operationsFaites = Object.values(ops).map((thunk) => thunk.fulfilled);
      if (operationsFaites.length) {
        b.addMatcher(isAnyOf(...operationsFaites), (state, { payload }) => { if (payload?.element) adaptateur.upsertOne(state, copie(payload.element)); });
      }
      b.addMatcher(isPending(...suivis), (state, { meta }) => debutAction(state, idArg(meta)))
        .addMatcher(isFulfilled(...suivis), (state, { meta }) => finAction(state, idArg(meta)))
        .addMatcher(isRejected(...suivis), (state, { meta, payload, error }) => {
          finAction(state, idArg(meta));
          state.erreurAction = payload || messageErreur(error);
        });
      b.addMatcher(estReinitialisation, () => initial);
    },
  });

  const racine = (s) => s[nom];
  const base = adaptateur.getSelectors(racine);
  const selecteurs = {
    elements: base.selectAll,
    parId: (id) => (s) => base.selectById(s, id) ?? null,
    ids: base.selectIds,
    total: (s) => racine(s).total,
    statut: (s) => racine(s).statut,
    erreur: (s) => racine(s).erreur,
    erreurAction: (s) => racine(s).erreurAction,
    filtres: (s) => racine(s).filtres,
    params: (s) => racine(s).params,
    selectionId: (s) => racine(s).selectionId,
    selection: (s) => { const r = racine(s); return r.selectionId == null ? null : r.entities[r.selectionId] ?? null; },
    enCours: (id) => (s) => Boolean(racine(s).enCours[id]),
  };

  return {
    type: 'module',
    nom,
    invalidePar,
    reducer: slice.reducer,
    actions: { charger, obtenir, creer, modifier, supprimer, ...ops, ...slice.actions },
    operations: Object.keys(operations),
    selecteurs,
  };
}
