import axios from 'axios';

const STORAGE_KEY = 'gmao_auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Joint l'id de session (obtenu via /auth/login) à chaque requête.
// Lu directement dans localStorage ici (plutôt que via authService) pour éviter
// une dépendance circulaire authService <-> api.
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.sessionId) {
      config.headers['X-Session-Id'] = session.sessionId;
    }
  } catch {
    // session invalide -> on part sans header, l'appel échouera proprement côté back si protégé
  }
  return config;
});

/*
 * Moins d'appels lancés en même temps :
 *  - deux lectures (GET) identiques en cours ne font qu'un seul appel au serveur ;
 *  - un écran peut « précharger » plusieurs lectures en un seul appel (ex. le résumé d'un bon) :
 *    pendant quelques secondes, ces lectures sont servies localement sans appel réseau.
 * Toute écriture réussie vide le préchargement, pour ne jamais servir une donnée périmée.
 */
const adapterBrut = axios.getAdapter(axios.defaults.adapter);

/* Au plus MAX_SIMULTANES appels réseau à la fois : les suivants attendent leur tour (file d'attente). */
const MAX_SIMULTANES = 4;
let appelsEnCours = 0;
const fileAttente = [];
const libererPlace = () => {
  appelsEnCours -= 1;
  const suivant = fileAttente.shift();
  if (suivant) suivant();
};
const adapterReseau = (config) => new Promise((resolve, reject) => {
  const lancer = () => {
    appelsEnCours += 1;
    adapterBrut(config).then(resolve, reject).finally(libererPlace);
  };
  if (appelsEnCours < MAX_SIMULTANES) lancer(); else fileAttente.push(lancer);
});

/* Une lecture qui vient de répondre est réutilisée quelques instants (écran qui recharge deux fois la même chose). */
const DUREE_REUTILISATION_MS = 2000;
const reponsesRecentes = new Map(); // clé → { jusqua, reponse }

/* POST qui ne font que lire (résumé d'un bon, infos de la liste, « lu ») : deux appels identiques en cours = un seul. */
const POST_LECTURE = /\/(resume|infos-liste|lu)$/;
const postsEnCours = new Map();

const lecturesEnCours = new Map();
const precharges = new Map(); // clé → { jusqua, reponse: Promise<{ s, d } | null> }
const DUREE_PRECHARGE_MS = 15000;
const cleLecture = (config) => ((config.method || 'get').toLowerCase() === 'get'
  ? `${config.url}|${JSON.stringify(config.params || {})}` : null);

api.defaults.adapter = async (config) => {
  const cle = cleLecture(config);
  if (!cle) {
    const methode = (config.method || '').toLowerCase();
    if (methode === 'post' && POST_LECTURE.test(config.url || '')) {
      const clePost = `${config.url}|${typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {})}`;
      if (!postsEnCours.has(clePost)) {
        postsEnCours.set(clePost, adapterReseau(config).finally(() => postsEnCours.delete(clePost)));
      }
      const reponse = await postsEnCours.get(clePost);
      return { ...reponse, config };
    }
    return adapterReseau(config);
  }
  const recente = reponsesRecentes.get(cle);
  if (recente && Date.now() < recente.jusqua) return { ...recente.reponse, config };
  const pre = precharges.get(cle);
  if (pre && Date.now() < pre.jusqua) {
    const entree = await pre.reponse;
    if (entree) return { data: entree.d, status: entree.s, statusText: 'OK', headers: {}, config, request: {} };
  }
  if (!lecturesEnCours.has(cle)) {
    lecturesEnCours.set(cle, adapterReseau(config)
      .then((r) => {
        if (r.status >= 200 && r.status < 300) {
          if (reponsesRecentes.size > 200) {
            const maintenant = Date.now();
            reponsesRecentes.forEach((v, k) => { if (v.jusqua <= maintenant) reponsesRecentes.delete(k); });
          }
          reponsesRecentes.set(cle, { jusqua: Date.now() + DUREE_REUTILISATION_MS, reponse: r });
        }
        return r;
      })
      .finally(() => lecturesEnCours.delete(cle)));
  }
  const reponse = await lecturesEnCours.get(cle);
  return { ...reponse, config };
};

/**
 * Précharge plusieurs lectures en un seul appel.
 * urlRegroupee : adresse qui renvoie { "<url>": { s: statut, d: données }, … } ;
 * urlsConnues  : adresses servies par ce regroupement, connues d'avance (servies dès que la réponse arrive).
 */
export function precharger(urlRegroupee, urlsConnues = []) {
  const jusqua = Date.now() + DUREE_PRECHARGE_MS;
  const groupe = api.get(urlRegroupee).then(({ data }) => data || {}).catch(() => ({}));
  urlsConnues.forEach((url) => {
    precharges.set(`${url}|{}`, { jusqua, reponse: groupe.then((g) => g[url] || null) });
  });
  groupe.then((g) => Object.entries(g).forEach(([url, entree]) => {
    if (!precharges.has(`${url}|{}`)) precharges.set(`${url}|{}`, { jusqua, reponse: Promise.resolve(entree) });
  }));
  return groupe;
}

// Si le backend répond 401 (session invalide/expirée), on nettoie la session locale
// et on renvoie l'utilisateur sur la page de connexion.
api.interceptors.response.use(
  (response) => {
    // Écriture réussie (POST, PUT, PATCH, DELETE) : on prévient le store Redux, qui marque
    // comme périmées les listes de référence concernées (événement plutôt qu'import : pas de dépendance circulaire).
    const methode = (response.config?.method || 'get').toLowerCase();
    // Écriture « silencieuse » (ex. marquer une fiche lue) : rien de ce qui est affiché ne change
    if (methode !== 'get' && response.config?.silencieux) return response;
    if (methode !== 'get') { precharges.clear(); reponsesRecentes.clear(); }
    if (methode !== 'get' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao:ecriture', { detail: { url: response.config?.url || '' } }));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;