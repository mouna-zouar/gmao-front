import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { t, locale } from '../../../i18n';

/*
 * Temps passé sur une tâche ou par un intervenant d'un bon.
 * Le serveur tient un chronomètre (tempsPasseSecondes + enCoursDepuis) : il tourne tant que l'élément
 * est « en cours » et se met en pause sinon. Pour les éléments plus anciens que ce chronomètre,
 * on retombe sur les dates d'intervention (début → fin, ou début → maintenant s'il est en cours).
 */

export const TACHE_EN_COURS = 3;
export const INTERVENANT_EN_COURS = 1;

/** { secondes, enCours, estime } ou null si rien ne permet de calculer. */
export function tempsPasse(o, etatEnCours, maintenant = Date.now()) {
  if (!o) return null;
  const enCours = Number(o.etat) === etatEnCours;
  // Chronomètre du serveur ; un cumul à 0 sans période en cours vient d'un élément plus ancien que le chronomètre
  if (Number(o.tempsPasseSecondes) > 0 || o.enCoursDepuis) {
    const enPlus = o.enCoursDepuis ? Math.max(0, (maintenant - new Date(o.enCoursDepuis).getTime()) / 1000) : 0;
    return { secondes: (Number(o.tempsPasseSecondes) || 0) + enPlus, enCours: Boolean(o.enCoursDepuis), estime: false };
  }
  // Repli sur les dates d'intervention
  const zero = o.tempsPasseSecondes != null ? { secondes: 0, enCours: false, estime: false } : null;
  const debut = o.dateDebutIntervention ? new Date(o.dateDebutIntervention).getTime() : null;
  if (!debut || Number.isNaN(debut)) return zero;
  const fin = o.dateFinIntervention ? new Date(o.dateFinIntervention).getTime() : (enCours ? maintenant : null);
  if (!fin || fin < debut) return zero;
  return { secondes: (fin - debut) / 1000, enCours: enCours && !o.dateFinIntervention, estime: true };
}

/** « 2 h 15 min », « 45 min », « 3 j 4 h », « < 1 min » */
export function formatTemps(secondes) {
  if (secondes == null) return '—';
  const min = Math.floor(secondes / 60);
  if (min < 1) return t('< 1 min');
  const j = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const n = (v) => v.toLocaleString(locale());
  if (j > 0) return h > 0 ? t('{j} j {h} h', { j: n(j), h: n(h) }) : t('{j} j', { j: n(j) });
  if (h > 0) return m > 0 ? t('{h} h {m} min', { h: n(h), m: String(m).padStart(2, '0') }) : t('{h} h', { h: n(h) });
  return t('{m} min', { m: n(m) });
}

/** Heure courante, rafraîchie toutes les 30 s seulement si un chronomètre tourne. */
export function useMaintenant(actif) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return undefined;
    setMaintenant(Date.now());
    const id = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(id);
  }, [actif]);
  return maintenant;
}

/** Somme des temps passés d'une liste (en secondes) et indicateur « au moins un en cours ». */
export function totalTemps(liste, etatEnCours, maintenant) {
  let secondes = 0;
  let enCours = false;
  let connu = false;
  (liste || []).forEach((o) => {
    const tp = tempsPasse(o, etatEnCours, maintenant);
    if (!tp) return;
    connu = true;
    secondes += tp.secondes;
    enCours = enCours || tp.enCours;
  });
  return connu ? { secondes, enCours } : null;
}

/** Pastille « ⏱ 2 h 15 min » ; un point vert indique que le chronomètre tourne. */
export function TempsPasse({ objet, etatEnCours, maintenant, vide = '—' }) {
  const tp = tempsPasse(objet, etatEnCours, maintenant);
  if (!tp) return vide;
  return (
    <span
      className={`bmd-temps ${tp.enCours ? 'is-en-cours' : ''}`}
      title={tp.enCours ? t('En cours : le temps continue de tourner') : tp.estime ? t('Calculé à partir des dates d’intervention') : t('Temps de travail mesuré')}
    >
      <Timer size={13} aria-hidden="true" /> {formatTemps(tp.secondes)}{tp.estime ? ' *' : ''}
    </span>
  );
}
