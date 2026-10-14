import api from './api';
import authService from './Authservice';

/*
 * Chat en direct d'un bon de maintenance.
 * L'auteur est la personne connectée : son identifiant personnel (X-Personnel-Id, comme
 * dans Mon espace), et la session (X-Session-Id) quand le serveur la connaît.
 */

const personnelConnecte = () => {
  const user = authService.getCurrentUser();
  return user?.personnelId ?? user?.personnel?.id ?? user?.userId ?? null;
};

const enTeteSession = () => {
  const user = authService.getCurrentUser();
  const sessionId = authService.getSessionId();
  const personnelId = personnelConnecte();
  const nom = user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.login || '';
  return {
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    ...(personnelId != null ? { 'X-Personnel-Id': String(personnelId) } : {}),
    // Encodé : un en-tête HTTP ne peut pas contenir d'accents ni d'arabe
    ...(nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {}),
    ...(user?.admin ? { 'X-Admin': 'true' } : {}),
  };
};

// Personnel déjà refusé par le serveur : on n'insiste pas (évite une erreur 403 à chaque page)
let personnelRefuse = null;

const config = (extra = {}) => ({ ...extra, headers: { ...enTeteSession(), ...(extra.headers || {}) } });

/**
 * Type d'erreur lisible par le panneau :
 *  - 'session' : session inconnue du serveur (backend redémarré) → se reconnecter
 *  - 'compte'  : login sans fiche dans la table Personnel (MEDSYS)
 *  - 'acces'   : la personne ne travaille pas sur ce bon
 *  - 'reseau'  : serveur injoignable ou autre erreur
 */
export const typeErreurChat = (err) => {
  const status = err?.response?.status ?? err?.status;
  const message = err?.response?.data?.message ?? err?.message;
  if (status === 403 && message === 'SESSION_CHAT_INCONNUE') return 'session';
  if (status === 403 && (message === 'COMPTE_SANS_PERSONNEL' || message === 'PERSONNEL_INCONNU')) return 'compte';
  if (status === 403) return 'acces';
  if (status === 400) return 'invalide';
  return 'reseau';
};

const chatBonService = {
  /** { participants, messages (50 derniers), plusAnciens, dernierMessageLuId, moiPersonnelId } */
  async getConversation(bonId) {
    const { data } = await api.get(`/chat-bon/${bonId}`, config());
    return data;
  },

  async getMessagesAvant(bonId, avantId) {
    const { data } = await api.get(`/chat-bon/${bonId}/messages`, config({ params: { avant: avantId } }));
    return data;
  },

  async getMessagesApres(bonId, apresId) {
    const { data } = await api.get(`/chat-bon/${bonId}/messages`, config({ params: { apres: apresId } }));
    return data;
  },

  async envoyer(bonId, contenu) {
    const { data } = await api.post(`/chat-bon/${bonId}/messages`, { contenu }, config());
    return data;
  },

  async marquerLu(bonId, dernierMessageId) {
    await api.post(`/chat-bon/${bonId}/lu`, { dernierMessageId }, config());
  },

  /**
   * Liste des discussions : pour chaque bon, { bonMaintenanceId, dernierMessage | null, nonLus }.
   */
  async getResumes(bonIds) {
    const ids = [...new Set((bonIds || []).filter((id) => id != null))];
    if (ids.length === 0 || personnelConnecte() == null) return [];
    const { data } = await api.get('/chat-bon/resumes', config({ params: { bons: ids.join(',') } }));
    return data || [];
  },

  /** Map { bonId: nombre de messages non lus } pour une liste de bons. */
  async getNonLus(bonIds) {
    const ids = [...new Set((bonIds || []).filter((id) => id != null))];
    // Sans session (ancienne connexion), inutile d'appeler le serveur : il refuserait
    const personnelId = personnelConnecte();
    if (ids.length === 0 || personnelId == null || personnelId === personnelRefuse) return {};
    let data;
    try {
      ({ data } = await api.get('/chat-bon/non-lus', config({ params: { bons: ids.join(',') } })));
    } catch (err) {
      if (err?.response?.status === 403) {
        personnelRefuse = personnelId;
        console.warn('[Chat] Refusé par le serveur :', err.response.data?.message);
        return {};
      }
      throw err;
    }
    return Object.fromEntries((data || []).map((d) => [d.bonMaintenanceId, d.nonLus]));
  },

  /**
   * Ouvre le flux temps réel (Server-Sent Events) du chat d'un bon.
   * fetch plutôt qu'EventSource : EventSource ne sait pas envoyer l'en-tête X-Session-Id.
   * Se reconnecte tout seul (1 s, 2 s, 4 s… jusqu'à 30 s) ; onConnecte est rappelé à chaque
   * (re)connexion pour rattraper les messages manqués.
   *
   * @returns {() => void} fonction qui ferme le flux
   */
  ouvrirFlux(bonId, { onMessage, onPresence, onConnecte, onDeconnecte, onErreurFatale }) {
    let ferme = false;
    let controleur = null;
    let delai = 1000;
    let minuterie = null;

    const url = `${api.defaults.baseURL.replace(/\/$/, '')}/chat-bon/${bonId}/flux`;

    const traiterEvenement = (bloc) => {
      let nom = 'message';
      const lignes = [];
      bloc.split(/\r?\n/).forEach((ligne) => {
        if (ligne.startsWith('event:')) nom = ligne.slice(6).trim();
        else if (ligne.startsWith('data:')) lignes.push(ligne.slice(5).replace(/^ /, ''));
      });
      if (lignes.length === 0) return; // commentaire « ping »
      let donnees;
      try { donnees = JSON.parse(lignes.join('\n')); } catch { return; }
      if (nom === 'message') onMessage?.(donnees);
      else if (nom === 'presence') onPresence?.(donnees);
    };

    const programmerReconnexion = () => {
      if (ferme) return;
      onDeconnecte?.();
      minuterie = setTimeout(connecter, delai);
      delai = Math.min(delai * 2, 30000);
    };

    async function connecter() {
      if (ferme) return;
      controleur = new AbortController();
      try {
        const reponse = await fetch(url, {
          headers: { Accept: 'text/event-stream', ...enTeteSession() },
          signal: controleur.signal,
          cache: 'no-store',
        });
        if (reponse.status === 403) {
          let message = '';
          try { message = (await reponse.json())?.message; } catch { /* corps non JSON */ }
          onErreurFatale?.(message === 'SESSION_CHAT_INCONNUE' ? 'session'
            : (message === 'COMPTE_SANS_PERSONNEL' || message === 'PERSONNEL_INCONNU') ? 'compte' : 'acces');
          return;
        }
        if (!reponse.ok || !reponse.body) throw new Error(`HTTP ${reponse.status}`);

        delai = 1000;
        onConnecte?.();

        const lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        let tampon = '';
        for (;;) {
          const { value, done } = await lecteur.read();
          if (done) break;
          tampon += decodeur.decode(value, { stream: true });
          let fin;
          while ((fin = tampon.search(/\r?\n\r?\n/)) >= 0) {
            const bloc = tampon.slice(0, fin);
            tampon = tampon.slice(fin).replace(/^\r?\n\r?\n/, '');
            traiterEvenement(bloc);
          }
        }
        programmerReconnexion(); // le serveur a fermé (durée de vie atteinte)
      } catch (e) {
        if (ferme || e?.name === 'AbortError') return;
        programmerReconnexion();
      }
    }

    connecter();

    return () => {
      ferme = true;
      clearTimeout(minuterie);
      controleur?.abort();
    };
  },
};

export default chatBonService;