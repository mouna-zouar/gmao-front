import { useState } from 'react';

/* Lecture et écriture prudentes dans localStorage (navigation privée, stockage plein…) */
export const lire = (cle, defaut) => {
  try {
    const v = localStorage.getItem(cle);
    return v == null ? defaut : JSON.parse(v);
  } catch {
    return defaut;
  }
};
export const ecrire = (cle, valeur) => {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage indisponible */ }
};

/** Vue choisie d'une liste, mémorisée d'une visite à l'autre. */
export function useVueActive(liste, userKey, defaut) {
  const cle = `gmao-vue-active-${liste}-${userKey}`;
  const [vue, setVue] = useState(() => lire(cle, defaut));
  const changer = (id) => { setVue(id); ecrire(cle, id); };
  return [vue, changer];
}
