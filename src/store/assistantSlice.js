import { serviceDiffere } from './fabriques/serviceDiffere';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import authService from '../services/Authservice';

const assistantService = serviceDiffere(() => import('../services/assistantService'));

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

export const poserQuestion = createAsyncThunk('assistant/poserQuestion', async ({ question, langue }, { getState, rejectWithValue }) => {
  const equipementId = getState().assistant.equipement?.id ?? null;
  const historique = getState().assistant.messages
    .filter((m) => m.role === 'ia' && m.question).slice(-3)
    .map((m) => ({ question: m.question, reponse: m.reponse || '' }));
  try {
    return await assistantService.agent(question, langue, historique, utilisateur(), equipementId);
  } catch (e) {
    return rejectWithValue(e?.response?.data?.message || null);
  }
});

const assistantSlice = createSlice({
  name: 'assistant',
  initialState: { messages: lireConversation(), enCours: false, equipement: null },
  reducers: {
    nouvelleConversation: (state) => { state.messages = []; },
    choisirEquipementAssistant: (state, action) => { state.equipement = action.payload || null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(poserQuestion.pending, (state, action) => {
        state.enCours = true;
        state.messages.push({ role: 'moi', texte: action.meta.arg.question, equipement: state.equipement?.nom || null });
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
        state.messages.push({ role: 'ia', question: action.meta.arg.question, message: action.payload || null, injoignable: !action.payload });
      });
  },
});

export const { nouvelleConversation, choisirEquipementAssistant } = assistantSlice.actions;

export const selectMessagesAssistant = (s) => s.assistant.messages;
export const selectAssistantEnCours = (s) => s.assistant.enCours;
export const selectEquipementAssistant = (s) => s.assistant.equipement;

export default assistantSlice.reducer;
