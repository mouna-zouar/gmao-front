/*
 * Calculs communs aux indicateurs des tableaux de bord (bons, réclamations, parc).
 * Tout est calculé côté navigateur à partir des listes déjà exposées par l'API.
 */

export const JOUR = 24 * 3600 * 1000;

/** Période glissante : les `jours` derniers jours (fin = maintenant) et la période d'avant, de même durée. */
export function periodes(jours = 30, maintenant = Date.now()) {
  const fin = maintenant;
  const debut = fin - jours * JOUR;
  return {
    courante: { debut, fin },
    precedente: { debut: debut - jours * JOUR, fin: debut },
  };
}

export const enMs = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

export const dans = (v, { debut, fin }) => {
  const t = enMs(v);
  return t != null && t >= debut && t < fin;
};

/** Liste brute d'une réponse API : tableau, page Spring ({ content }) ou rien. */
export const liste = (rep) => (Array.isArray(rep) ? rep : Array.isArray(rep?.content) ? rep.content : []);

export function moyenne(valeurs) {
  const v = valeurs.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export const somme = (valeurs) => valeurs.reduce((a, b) => a + (Number(b) || 0), 0);

/** Durée en heures entre deux dates (null si l'une manque ou si négative). */
export function heuresEntre(debut, fin) {
  const a = enMs(debut);
  const b = enMs(fin);
  if (a == null || b == null || b < a) return null;
  return (b - a) / 3600000;
}

export const pourcentage = (n, total) => (total > 0 ? (n / total) * 100 : null);

/**
 * Classement des N premiers : [{ cle, libelle, valeur }], trié par valeur décroissante.
 * `cleDe(item)` regroupe ; `libelleDe(item)` nomme le groupe ; `valeurDe(item)` (défaut 1) additionne.
 */
export function classement(items, cleDe, libelleDe, { valeurDe = () => 1, n = 5 } = {}) {
  const groupes = new Map();
  items.forEach((it) => {
    const cle = cleDe(it);
    if (cle == null || cle === '') return;
    const g = groupes.get(cle) || { cle, libelle: libelleDe(it), valeur: 0 };
    g.valeur += Number(valeurDe(it)) || 0;
    if (!g.libelle) g.libelle = libelleDe(it);
    groupes.set(cle, g);
  });
  return [...groupes.values()].sort((a, b) => b.valeur - a.valeur).slice(0, n);
}

/** Clés « AAAA-MM » des 12 derniers mois (le mois courant en dernier). */
export function douzeMois(maintenant = new Date()) {
  const cles = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    cles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return cles;
}

/** Série mensuelle sur 12 mois : nombre (ou somme de `valeurDe`) d'éléments par mois de `dateDe(item)`. */
export function serieMensuelle(items, dateDe, { valeurDe = () => 1, mois = douzeMois() } = {}) {
  const index = Object.fromEntries(mois.map((m) => [m, 0]));
  items.forEach((it) => {
    const t = enMs(dateDe(it));
    if (t == null) return;
    const d = new Date(t);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (cle in index) index[cle] += Number(valeurDe(it)) || 0;
  });
  return mois.map((m) => index[m]);
}
