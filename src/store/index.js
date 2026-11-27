import { configureStore } from '@reduxjs/toolkit';
import authReducer, { rechargerSession } from './authSlice';
import notificationsReducer from './notificationsSlice';
import assistantReducer, { CLE_CONVERSATION } from './assistantSlice';
import { TOUS } from './registre';
import { correspond } from './fabriques/communs';

const CACHES = new Set(TOUS.map((e) => e.nom));

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notifications: notificationsReducer,
    assistant: assistantReducer,
    ...Object.fromEntries(TOUS.map((e) => [e.nom, e.reducer])),
  },
  middleware: (defaut) => defaut({ serializableCheck: false, immutableCheck: false }),
  devTools: import.meta.env.DEV && {
    trace: false,
    maxAge: 30,
    stateSanitizer: (etat) => Object.fromEntries(Object.entries(etat).map(([k, v]) => [k, CACHES.has(k) ? { statut: v?.statut, chargeLe: v?.chargeLe, contenu: '(masqué)' } : v])),
    actionSanitizer: (action) => (action.payload && typeof action.payload === 'object' ? { ...action, payload: '(masqué)' } : action),
  },
});

let derniereConversation;
store.subscribe(() => {
  const messages = store.getState().assistant.messages;
  if (messages === derniereConversation) return;
  derniereConversation = messages;
  try { sessionStorage.setItem(CLE_CONVERSATION, JSON.stringify(messages.slice(-20))); } catch {}
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === 'user' || e.key === 'privileges' || e.key === 'sessionId') store.dispatch(rechargerSession());
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('gmao:ecriture', (e) => {
    const url = e.detail?.url || '';
    TOUS.forEach((el) => { if (correspond(el.invalidePar, url)) store.dispatch(el.actions.perimer()); });
  });
}

export default store;
