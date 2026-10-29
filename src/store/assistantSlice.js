import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import assistantService from '../services/assistantService';


export const CLE_CONVERSATION = 'gmao.assistant.conversation';

function lireConversation() {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLE_CONVERSATION) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/** Envoie une question avec les 3 derniers échanges (pour les questions de suite). */
export const poserQuestion = createAsyncThunk('assistant/poserQuestion', async ({ question, langue }, { getState, rejectWithValue }) => {
  const historique = getState().assistant.messages
    .filter((m) => m.role === 'ia' && m.question).slice(-3)
    .map((m) => ({ question: m.question, reponse: m.reponse || '' }));
  try {
    return await assistantService.question(question, langue, historique);
  } catch (e) {
    return rejectWithValue(e?.response?.data?.message || null);
  }
});

const assistantSlice = createSlice({
  name: 'assistant',
  initialState: { messages: lireConversation(), enCours: false },
  reducers: {
    nouvelleConversation: (state) => { state.messages = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(poserQuestion.pending, (state, action) => {
        state.enCours = true;
        state.messages.push({ role: 'moi', texte: action.meta.arg.question });
      })
      .addCase(poserQuestion.fulfilled, (state, action) => {
        const r = action.payload || {};
        state.enCours = false;
        state.messages.push({
          role: 'ia', question: action.meta.arg.question, reponse: r.reponse, resultats: r.resultats || [],
          message: r.message, suggestions: r.suggestions || [],
        });
      })
      .addCase(poserQuestion.rejected, (state, action) => {
        state.enCours = false;
        // message null : le composant affiche « L'assistant est injoignable » dans la langue de l'utilisateur
        state.messages.push({ role: 'ia', question: action.meta.arg.question, message: action.payload || null, injoignable: !action.payload });
      });
  },
});

export const { nouvelleConversation } = assistantSlice.actions;

export const selectMessagesAssistant = (s) => s.assistant.messages;
export const selectAssistantEnCours = (s) => s.assistant.enCours;

export default assistantSlice.reducer;
