export const JOUR = 24 * 3600 * 1000;

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

export const liste = (rep) => (Array.isArray(rep) ? rep : Array.isArray(rep?.content) ? rep.content : []);

export function moyenne(valeurs) {
  const v = valeurs.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export const somme = (valeurs) => valeurs.reduce((a, b) => a + (Number(b) || 0), 0);

export function heuresEntre(debut, fin) {
  const a = enMs(debut);
  const b = enMs(fin);
  if (a == null || b == null || b < a) return null;
  return (b - a) / 3600000;
}

export const pourcentage = (n, total) => (total > 0 ? (n / total) * 100 : null);

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

export function douzeMois(maintenant = new Date()) {
  const cles = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    cles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return cles;
}

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
