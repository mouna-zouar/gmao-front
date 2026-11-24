import api from './api';
import authService from './Authservice';

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
    ...(nom ? { 'X-Personnel-Nom': encodeURIComponent(nom) } : {}),
    ...(user?.admin ? { 'X-Admin': 'true' } : {}),
  };
};


const config = (extra = {}) => ({ ...extra, headers: { ...enTeteSession(), ...(extra.headers || {}) } });

export const typeErreurChat = (err) => {
  const status = err?.response?.status ?? err?.status;
  const message = err?.response?.data?.message ?? err?.message;
  if (status === 403 && message === 'SESSION_CHAT_INCONNUE') return 'session';
  if (status === 403 && (message === 'COMPTE_SANS_PERSONNEL' || message === 'PERSONNEL_INCONNU')) return 'compte';
  if (status === 403) return 'acces';
  if (status === 400) return 'invalide';
  return 'reseau';
};

export function creerServiceChat(base) {
  let personnelRefuse = null;

  return {
  async getConversation(bonId) {
    const { data } = await api.get(`/${base}/${bonId}`, config());
    return data;
  },

  async getMessagesAvant(bonId, avantId) {
    const { data } = await api.get(`/${base}/${bonId}/messages`, config({ params: { avant: avantId } }));
    return data;
  },

  async getMessagesApres(bonId, apresId) {
    const { data } = await api.get(`/${base}/${bonId}/messages`, config({ params: { apres: apresId } }));
    return data;
  },

  async envoyer(bonId, contenu) {
    const { data } = await api.post(`/${base}/${bonId}/messages`, { contenu }, config());
    return data;
  },

  async marquerLu(bonId, dernierMessageId) {
    await api.post(`/${base}/${bonId}/lu`, { dernierMessageId }, config());
  },

  async getResumes(bonIds) {
    const ids = [...new Set((bonIds || []).filter((id) => id != null))];
    if (ids.length === 0 || personnelConnecte() == null) return [];
    const { data } = await api.get(`/${base}/resumes`, config({ params: { bons: ids.join(',') } }));
    return data || [];
  },

  async getNonLus(bonIds) {
    const ids = [...new Set((bonIds || []).filter((id) => id != null))];
    const personnelId = personnelConnecte();
    if (ids.length === 0 || personnelId == null || personnelId === personnelRefuse) return {};
    let data;
    try {
      ({ data } = await api.get(`/${base}/non-lus`, config({ params: { bons: ids.join(',') } })));
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

  ouvrirFlux(bonId, { onMessage, onPresence, onConnecte, onDeconnecte, onErreurFatale }) {
    let ferme = false;
    let controleur = null;
    let delai = 1000;
    let minuterie = null;

    const url = `${api.defaults.baseURL.replace(/\/$/, '')}/${base}/${bonId}/flux`;

    const traiterEvenement = (bloc) => {
      let nom = 'message';
      const lignes = [];
      bloc.split(/\r?\n/).forEach((ligne) => {
        if (ligne.startsWith('event:')) nom = ligne.slice(6).trim();
        else if (ligne.startsWith('data:')) lignes.push(ligne.slice(5).replace(/^ /, ''));
      });
      if (lignes.length === 0) return;
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
          try { message = (await reponse.json())?.message; } catch {}
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
        programmerReconnexion();
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
}

const chatBonService = creerServiceChat('chat-bon');
export const chatReclamationService = creerServiceChat('chat-reclamation');

export default chatBonService;