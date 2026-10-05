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

// Si le backend répond 401 (session invalide/expirée), on nettoie la session locale
// et on renvoie l'utilisateur sur la page de connexion.
api.interceptors.response.use(
  (response) => response,
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