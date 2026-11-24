export const CRITICITE_OPTIONS = [
  { value: 'C1', label: 'C1 – Critique' },
  { value: 'C2', label: 'C2 – Important' },
  { value: 'C3', label: 'C3 – Normal' },
  { value: 'C4', label: 'C4 – Faible' },
];

export const CRITICITE_LABELS = {
  C1: 'Critique',
  C2: 'Important',
  C3: 'Normal',
  C4: 'Faible',
};

export const CRITICITE_COLOR = {
  C1: 'red',
  C2: 'amber',
  C3: 'blue',
  C4: 'slate',
};

export const CRITICITE_DEFAUT = 'C3';

export const CRITICITE_HEX = {
  C1: '#ef4444',
  C2: '#f97316',
  C3: '#3b82f6',
  C4: '#64748b',
};

export function criticiteHex(criticite) {
  return CRITICITE_HEX[criticite] ?? CRITICITE_HEX[CRITICITE_DEFAUT];
}

export function criticiteLabel(criticite) {
  if (!criticite) return CRITICITE_LABELS[CRITICITE_DEFAUT];
  return CRITICITE_LABELS[criticite] ?? criticite;
}

export function criticiteColor(criticite) {
  if (!criticite) return CRITICITE_COLOR[CRITICITE_DEFAUT];
  return CRITICITE_COLOR[criticite] ?? 'slate';
}
