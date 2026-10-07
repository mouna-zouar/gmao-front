export const CARBURANT_TYPE_LABELS = {
  0: 'Essence',
  1: 'Diesel',
  2: 'GPL',
  3: 'Électrique',
  4: 'Hybride',
};

export const CARBURANT_TYPE_OPTIONS = Object.entries(CARBURANT_TYPE_LABELS).map(
  ([value, label]) => ({ value: Number(value), label })
);

export function carburantTypeLabel(type) {
  return CARBURANT_TYPE_LABELS[type] ?? '—';
}