import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import authService from '../services/Authservice';

/*
 * Utilisateur connecté (étape 1 du passage à Redux).
 * La session reste enregistrée dans le localStorage par authService (lue aussi par les services) ;
 * ce slice en garde une copie pour que les écrans se mettent à jour à la connexion / déconnexion.
 */

export const connecter = createAsyncThunk('auth/connecter', async ({ login, password }, { rejectWithValue }) => {
  try {
    return await authService.login(login, password);
  } catch (e) {
    return rejectWithValue(e?.response?.data?.message || e?.message || 'Connexion impossible');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: authService.getSession(),
    connexionEnCours: false,
    erreur: null,
  },
  reducers: {
    deconnecter(state) {
      authService.logout();
      state.user = null;
      state.erreur = null;
    },
    /** Relit la session du localStorage (ex. modifiée dans un autre onglet). */
    rechargerSession(state) {
      state.user = authService.getSession();
    },
  },
  extraReducers: (b) => {
    b.addCase(connecter.pending, (s) => { s.connexionEnCours = true; s.erreur = null; })
      .addCase(connecter.fulfilled, (s, a) => { s.connexionEnCours = false; s.user = a.payload; })
      .addCase(connecter.rejected, (s, a) => { s.connexionEnCours = false; s.erreur = a.payload || null; });
  },
});

export const { deconnecter, rechargerSession } = authSlice.actions;

// Sélecteurs
export const selectUtilisateur = (s) => s.auth.user;
export const selectEstConnecte = (s) => Boolean(s.auth.user);
export const selectPrivileges = (s) => s.auth.user?.privileges ?? [];
export const selectADroit = (code) => (s) => (s.auth.user?.privileges ?? []).includes(code);
export const selectEstAdmin = (s) => Boolean(s.auth.user?.admin);

export default authSlice.reducer;
