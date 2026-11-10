import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import assistantService from '../services/assistantService';
import authService from '../services/Authservice';

/** Personne connectée : auteur des actions faites par l'assistant. */
function utilisateur() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    id: id != null && id !== '' ? Number(id) : null,
    nom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}


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
    // L'agent répond ET peut agir (il se replie seul sur les questions si l'IA ne gère pas les outils)
    return await assistantService.agent(question, langue, historique, utilisateur());
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
          message: r.message, suggestions: r.suggestions || [], actions: r.actions || [],
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
