// Référentiel de priorité d'intervention — DOIT rester synchronisé avec
// softsys.GMAO.models.Priorite (backend). Valeurs = noms exacts de l'enum Java.

export const PRIORITE_LABELS = {
  P1: 'Immédiate',
  P2: 'Urgente',
  P3: 'Normale',
  P4: 'Planifiable',
};

// Ordre de gravité, du plus urgent au moins urgent — utilisé pour le tri de colonne.
export const PRIORITE_RANG = { P1: 0, P2: 1, P3: 2, P4: 3 };

export const PRIORITE_COLOR = {
  P1: 'red',
  P2: 'amber',
  P3: 'blue',
  P4: 'slate',
};

export function prioriteLabel(priorite) {
  if (!priorite) return 'Non calculée';
  return PRIORITE_LABELS[priorite] ?? priorite;
}

export function prioriteRang(priorite) {
  if (!priorite) return 99; // non calculée -> en dernier au tri croissant
  return PRIORITE_RANG[priorite] ?? 99;
}

export function prioriteColor(priorite) {
  if (!priorite) return 'slate';
  return PRIORITE_COLOR[priorite] ?? 'slate';
}
