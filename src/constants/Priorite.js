export const PRIORITE_LABELS = {
  P1: 'Immédiate',
  P2: 'Urgente',
  P3: 'Normale',
  P4: 'Planifiable',
};

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
  if (!priorite) return 99;
  return PRIORITE_RANG[priorite] ?? 99;
}

export function prioriteColor(priorite) {
  if (!priorite) return 'slate';
  return PRIORITE_COLOR[priorite] ?? 'slate';
}
