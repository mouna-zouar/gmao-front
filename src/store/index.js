import { configureStore } from '@reduxjs/toolkit';
import authReducer, { rechargerSession } from './authSlice';
import notificationsReducer from './notificationsSlice';
import assistantReducer, { CLE_CONVERSATION } from './assistantSlice';
import depotsReducer from './depotsSlice';
import prestatairesReducer from './prestatairesSlice';
import articlesReducer from './articlesSlice';
import vehiculesReducer, { perimerVehicules } from './vehiculesSlice';
import equipementsReducer, { perimerEquipements } from './equipementsSlice';
import emplacementsReducer, { perimerEmplacements } from './emplacementsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notifications: notificationsReducer,
    assistant: assistantReducer,
    depots: depotsReducer,
    prestataires: prestatairesReducer,
    articles: articlesReducer,
    vehicules: vehiculesReducer,
    equipements: equipementsReducer,
    emplacements: emplacementsReducer,
  },
  devTools: import.meta.env.DEV,
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

const PERIMER_SUR_ECRITURE = [
  { motif: /^\/?vehicule/, action: perimerVehicules },
  { motif: /^\/?(lot-article-immobilistation|equipements|etat-equipement|renouvellement\/equipements)/, action: perimerEquipements },
  { motif: /^\/?emplacements/, action: perimerEmplacements },
];
if (typeof window !== 'undefined') {
  window.addEventListener('gmao:ecriture', (e) => {
    const url = e.detail?.url || '';
    PERIMER_SUR_ECRITURE.forEach(({ motif, action }) => { if (motif.test(url)) store.dispatch(action()); });
  });
}

export default store;
