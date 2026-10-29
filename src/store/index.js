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

/*
 * Store Redux de la GMAO (Redux Toolkit + React-Redux).
 * Une « tranche » (slice) par sujet partagé entre plusieurs écrans :
 *   - auth          : utilisateur connecté, ses privilèges (useAuth le lit ici) ;
 *   - notifications : compteur et liste de la cloche (lus partout, rafraîchis toutes les 30 s) ;
 *   - assistant     : conversation de « Demander à l'IA » (gardée pendant la session) ;
 *   - depots        : dépôts Cubix, chargés une fois et partagés (listes de référence, étape 1) ;
 *   - prestataires  : prestataires / fournisseurs, chargés une fois et partagés (étape 2) ;
 *   - articles      : articles de maintenance avec leur stock, gardés 2 min (étape 3) ;
 *   - vehicules     : véhicules du parc, gardés 2 min et périmés à chaque écriture sur /vehicule… (étape 4) ;
 *   - equipements   : équipements (immobilisations), gardés 5 min et périmés à chaque écriture sur un équipement (étape 5) ;
 *   - emplacements  : lieux (missions, projets), gardés 30 min et périmés à chaque écriture sur /emplacements (étape 6).
 * Hors composant, store/referentiels.js donne ces listes sous forme de promesse.
 * Pour ajouter un sujet : créer src/store/xxxSlice.js puis l'ajouter dans `reducer` ci-dessous.
 */
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

// La conversation de l'assistant survit à un rechargement de la page (onglet courant seulement)
let derniereConversation;
store.subscribe(() => {
  const messages = store.getState().assistant.messages;
  if (messages === derniereConversation) return;
  derniereConversation = messages;
  try { sessionStorage.setItem(CLE_CONVERSATION, JSON.stringify(messages.slice(-20))); } catch { /* stockage indisponible */ }
});

// Connexion / déconnexion faite dans un autre onglet : on resynchronise
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === 'user' || e.key === 'privileges' || e.key === 'sessionId') store.dispatch(rechargerSession());
  });
}

// Écriture réussie envoyée au serveur (services/api.js) : listes de référence à recharger
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
