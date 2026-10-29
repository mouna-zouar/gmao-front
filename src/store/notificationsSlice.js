import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import notificationService from '../services/notificationService';


export const chargerCompteur = createAsyncThunk('notifications/chargerCompteur', () => notificationService.countNonLues());

export const chargerNotifications = createAsyncThunk('notifications/chargerListe', async () => {
  const page = await notificationService.getAll(0, 20);
  return page?.content ?? [];
});

export const marquerLue = createAsyncThunk('notifications/marquerLue', async (id) => {
  await notificationService.marquerLue(id);
  return id;
});

export const marquerToutesLues = createAsyncThunk('notifications/marquerToutesLues', async () => {
  await notificationService.marquerToutesLues();
});

const initialState = { count: 0, liste: [], chargement: false };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /** À la déconnexion : rien ne doit rester de l'utilisateur précédent. */
    viderNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(chargerCompteur.fulfilled, (state, action) => { state.count = Number(action.payload) || 0; })
      .addCase(chargerNotifications.pending, (state) => { state.chargement = true; })
      .addCase(chargerNotifications.fulfilled, (state, action) => { state.liste = action.payload; state.chargement = false; })
      .addCase(chargerNotifications.rejected, (state) => { state.chargement = false; })
      .addCase(marquerLue.fulfilled, (state, action) => {
        state.liste = state.liste.filter((n) => n.id !== action.payload);
        state.count = Math.max(0, state.count - 1);
      })
      .addCase(marquerToutesLues.fulfilled, (state) => { state.liste = []; state.count = 0; });
  },
});

export const { viderNotifications } = notificationsSlice.actions;

export const selectNotifCount = (s) => s.notifications.count;
export const selectNotifications = (s) => s.notifications.liste;
export const selectNotifChargement = (s) => s.notifications.chargement;

export default notificationsSlice.reducer;
