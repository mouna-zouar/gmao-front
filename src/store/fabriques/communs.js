export const ACTIONS_REINITIALISATION = ['auth/deconnecter', 'auth/connecter/fulfilled'];
export const estReinitialisation = (action) => ACTIONS_REINITIALISATION.includes(action.type);

export function versListe(data) {
  const liste = data?.content ?? data?.data ?? data;
  return Array.isArray(liste) ? liste : [];
}

export function totalDe(data, liste) {
  const total = data?.totalElements ?? data?.total;
  return Number.isFinite(Number(total)) ? Number(total) : liste.length;
}

export const messageErreur = (e) => e?.response?.data?.message || e?.message || 'Erreur';

export function cleParametres(params) {
  if (params == null) return '∅';
  if (typeof params !== 'object') return String(params);
  const propre = Object.keys(params).sort()
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => [k, params[k] instanceof Date ? params[k].toISOString() : params[k]]);
  return JSON.stringify(propre);
}

export function correspond(invalidePar, url) {
  if (!invalidePar) return false;
  if (typeof invalidePar === 'function') return Boolean(invalidePar(url));
  const motifs = Array.isArray(invalidePar) ? invalidePar : [invalidePar];
  return motifs.some((m) => m.test(String(url || '').replace(/^\/+/, '')));
}

export const copie = (x) => {
  if (x == null || typeof x !== 'object') return x;
  try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); }
};
