export const CARBURANT_TYPE_LABELS = {
  0: 'Essence',
  1: 'Diesel',
  2: 'GPL',
  3: 'Électrique',
};

export const CARBURANT_TYPE_ELECTRIQUE = 3;

export const CARBURANT_TYPE_OPTIONS = Object.entries(CARBURANT_TYPE_LABELS).map(
  ([value, label]) => ({ value: Number(value), label })
);

export function carburantTypeLabel(type) {
  return CARBURANT_TYPE_LABELS[type] ?? '—';
}

export function uniteQuantiteCarburant(type) {
  return Number(type) === CARBURANT_TYPE_ELECTRIQUE ? 'kWh' : 'L';
}

export function libelleQuantiteCarburant(type) {
  return Number(type) === CARBURANT_TYPE_ELECTRIQUE ? 'Énergie (kWh)' : 'Litres';
}