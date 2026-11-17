// ============================================================
// Familles d'articles Cubix en arbre : famille sans parent = racine (parent),
// sinon rangée sous sa famille parente (ArticleFamille.ParentFamilleID).
// Utilisé par Paramètres système et par le filtre « Famille » de la liste des équipements.
// ============================================================
import { locale } from '../i18n';

/**
 * Arbre des familles : une famille sans parent est une racine (parent), les autres sont rangées
 * sous leur famille parente (fils). Un parent qui n'a pas d'équipement à lui (absent de la liste
 * Cubix) est ajouté pour regrouper ses fils (« virtuel » : il ne se coche pas pour lui-même).
 */
export function arbreFamilles(familles) {
  const noeuds = new Map();
  (familles || []).forEach((f) => noeuds.set(String(f.id), { ...f, enfants: [] }));
  (familles || []).forEach((f) => {
    if (f.parentId != null && !noeuds.has(String(f.parentId))) {
      noeuds.set(String(f.parentId), {
        id: f.parentId, code: f.parentCode, nom: f.parentNom, nombre: 0, parentId: null, virtuel: true, enfants: [],
      });
    }
  });
  const racines = [];
  noeuds.forEach((n) => {
    const p = n.parentId != null && String(n.parentId) !== String(n.id) ? noeuds.get(String(n.parentId)) : null;
    if (p) p.enfants.push(n); else racines.push(n);
  });
  // Famille prise dans une boucle de parents (A → B → A) : remontée à la racine pour ne pas la perdre
  const vus = new Set();
  const marquer = (n) => { if (vus.has(n)) return; vus.add(n); n.enfants.forEach(marquer); };
  racines.forEach(marquer);
  noeuds.forEach((n) => { if (!vus.has(n)) { racines.push(n); marquer(n); } });
  const trier = (l) => l.sort((x, y) => String(x.nom || '').localeCompare(String(y.nom || ''), locale()));
  const total = (n, chemin = new Set()) => {
    if (chemin.has(n)) return 0;
    chemin.add(n);
    trier(n.enfants);
    n.total = n.nombre + n.enfants.reduce((s, e) => s + total(e, chemin), 0);
    // Identifiants cochables du sous-arbre (la famille elle-même si elle existe dans Cubix + ses fils)
    n.ids = [...(n.virtuel ? [] : [String(n.id)]), ...n.enfants.flatMap((e) => e.ids || [])];
    chemin.delete(n);
    return n.total;
  };
  racines.forEach((r) => total(r));
  return trier(racines);
}

/**
 * Lignes visibles d'un arbre de familles : les parents, et les fils des parents ouverts.
 * Avec une recherche : les familles qui correspondent, leurs parents et leurs fils.
 * → [{ noeud, niveau, ouvert }]
 */
export function lignesArbre(arbre, ouverts, recherche = '') {
  const q = recherche.trim().toLowerCase();
  const correspond = (n) => !q || `${n.nom || ''} ${n.code || ''}`.toLowerCase().includes(q);
  const visible = (n, parentOk, chemin) => !chemin.has(n)
    && (parentOk || correspond(n) || n.enfants.some((e) => visible(e, false, new Set(chemin).add(n))));
  const res = [];
  const parcourir = (n, niveau, parentOk, chemin) => {
    if (!visible(n, parentOk, chemin)) return;
    const ouvert = q ? true : ouverts.has(String(n.id));
    res.push({ noeud: n, niveau, ouvert });
    if (ouvert) n.enfants.forEach((e) => parcourir(e, niveau + 1, parentOk || (q && correspond(n)), new Set(chemin).add(n)));
  };
  arbre.forEach((r) => parcourir(r, 0, false, new Set()));
  return res;
}

export const basculerDansSet = (setter) => (cle) => setter((avant) => {
  const n = new Set(avant);
  const k = String(cle);
  if (n.has(k)) n.delete(k); else n.add(k);
  return n;
});
