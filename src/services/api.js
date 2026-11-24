import axios from 'axios';

const STORAGE_KEY = 'gmao_auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.sessionId) {
      config.headers['X-Session-Id'] = session.sessionId;
    }
  } catch {
  }
  return config;
});

const adapterBrut = axios.getAdapter(axios.defaults.adapter);

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

const DUREE_REUTILISATION_MS = 2000;
const reponsesRecentes = new Map();

const POST_LECTURE = /\/(resume|infos-liste|lu)$/;
const postsEnCours = new Map();

const lecturesEnCours = new Map();
const precharges = new Map();
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

api.interceptors.response.use(
  (response) => {
    const methode = (response.config?.method || 'get').toLowerCase();
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