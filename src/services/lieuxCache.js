import hierarchieService from './hierarchieService';

/*
 * Carte des lieux partagée par les écrans (formulaires, filtres des listes) :
 * { lieux: [{ id, parentId, type, nom, code }], equipements: { immoId: lieuId } }.
 * Gardée 60 s ; oublierCarte() après une modification de l'arborescence.
 */
let promesse = null;
let quand = 0;

export function carteLieux() {
  if (!promesse || Date.now() - quand > 60000) {
    quand = Date.now();
    promesse = Promise.resolve().then(() => hierarchieService.carte()).catch((e) => { promesse = null; throw e; });
  }
  return promesse;
}

export function oublierCarte() { promesse = null; }

/** Lieux à plat dans l'ordre de l'arbre : [{ ...lieu, niveau, chemin: 'Bât. A › Étage 2 › Bloc' }] */
export function lieuxAplatis(carte) {
  const lieux = carte?.lieux ?? [];
  const ids = new Set(lieux.map((l) => l.id));
  const enfants = new Map();
  lieux.forEach((l) => {
    const k = l.parentId != null && ids.has(l.parentId) ? l.parentId : 'racine';
    if (!enfants.has(k)) enfants.set(k, []);
    enfants.get(k).push(l);
  });
  const sortie = [];
  const parcourir = (l, niveau, avant) => {
    const chemin = [...avant, l.nom];
    sortie.push({ ...l, niveau, chemin: chemin.join(' › ') });
    (enfants.get(l.id) || []).forEach((e) => parcourir(e, niveau + 1, chemin));
  };
  (enfants.get('racine') || []).forEach((r) => parcourir(r, 0, []));
  return sortie;
}

/** Le lieu et tous ses sous-lieux. */
export function lieuEtSousLieux(carte, lieuId) {
  const r = new Set();
  if (lieuId == null || lieuId === '') return r;
  const enfants = new Map();
  (carte?.lieux ?? []).forEach((l) => {
    if (l.parentId == null) return;
    if (!enfants.has(l.parentId)) enfants.set(l.parentId, []);
    enfants.get(l.parentId).push(l.id);
  });
  const pile = [Number(lieuId)];
  while (pile.length) {
    const x = pile.pop();
    if (!r.has(x)) { r.add(x); pile.push(...(enfants.get(x) || [])); }
  }
  return r;
}

/** Lieu d'une ligne (bon, réclamation…) : le lieu enregistré, sinon celui de son équipement. */
export function lieuDeLigne(carte, lieuId, immoId) {
  if (lieuId != null) return Number(lieuId);
  if (immoId == null || !carte?.equipements) return null;
  const l = carte.equipements[immoId] ?? carte.equipements[String(immoId)];
  return l == null ? null : Number(l);
}

/** Chemin lisible d'un lieu. */
export function cheminLieu(carte, lieuId) {
  if (lieuId == null) return '';
  const parId = new Map((carte?.lieux ?? []).map((l) => [l.id, l]));
  const noms = [];
  const vus = new Set();
  for (let l = parId.get(Number(lieuId)); l && !vus.has(l.id); l = parId.get(l.parentId)) { vus.add(l.id); noms.unshift(l.nom); }
  return noms.join(' › ');
}

/** Champ « Lieu » des formulaires (liste avec recherche, libellé = chemin complet). */
export const champLieu = (extra = {}) => ({
  nom: 'lieuId', label: 'Lieu', type: 'recherche',
  chargerOptions: async () => lieuxAplatis(await carteLieux()).map((l) => ({ value: l.id, label: l.chemin })),
  cleOptions: () => `lieux-${Math.floor(Date.now() / 60000)}`,
  optionVide: '— Aucun —', placeholder: 'Rechercher un lieu...',
  ...extra,
});
