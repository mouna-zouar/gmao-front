// Cycle de vie du véhicule — source unique de vérité côté front.
// Les codes DOIVENT rester synchronisés avec le commentaire sur le champ
// `etat` dans Vehicule.java et avec ALLOWED_TRANSITIONS dans
// VehiculeServiceImpl.java (backend). Si vous changez un code ici,
// changez-le aussi côté backend.

export const VEHICULE_ETAT = {
  DISPONIBLE: 0,
  RESERVE: 1,
  EN_MISSION: 2,
  EN_MAINTENANCE: 3,
  IMMOBILISE: 4,
  HORS_SERVICE: 5,
  VENDU: 6,
};

export const ETAT_VEHICULE_LABELS = {
  0: 'Disponible',
  1: 'Réservé',
  2: 'En mission',
  3: 'En maintenance',
  4: 'Immobilisé',
  5: 'Hors service',
  6: 'Vendu',
};

// Couleur utilisée par les badges/pills (voir CSS des pages/modales).
export const ETAT_VEHICULE_COLOR = {
  0: 'green',
  1: 'blue',
  2: 'indigo',
  3: 'amber',
  4: 'red',
  5: 'slate',
  6: 'slate',
};

// Doit être IDENTIQUE à ALLOWED_TRANSITIONS dans VehiculeServiceImpl.java.
// Sert uniquement à grisér/activer les options côté front (UX) — le
// backend reste la seule source de vérité et revalide tout de toute façon.
export const ETAT_VEHICULE_TRANSITIONS = {
  0: [1, 2, 3, 4, 5, 6], // Disponible →
  1: [0, 2, 4, 5],        // Réservé →
  2: [0, 4, 5],           // En mission →
  3: [0, 4, 5, 6],        // En maintenance →
  4: [3, 0, 5],           // Immobilisé →
  5: [0, 3, 6],           // Hors service →
  6: [],                  // Vendu → (terminal)
};

export function etatVehiculeLabel(etat) {
  if (etat === null || etat === undefined) return ETAT_VEHICULE_LABELS[0];
  return ETAT_VEHICULE_LABELS[etat] ?? `État ${etat}`;
}

export function etatVehiculeColor(etat) {
  if (etat === null || etat === undefined) return ETAT_VEHICULE_COLOR[0];
  return ETAT_VEHICULE_COLOR[etat] ?? 'slate';
}

export function allowedNextEtats(currentEtat) {
  const current = currentEtat === null || currentEtat === undefined ? 0 : currentEtat;
  return ETAT_VEHICULE_TRANSITIONS[current] ?? [];
}

export function isVehiculeDisponiblePourMission(etat) {
  const e = etat === null || etat === undefined ? VEHICULE_ETAT.DISPONIBLE : etat;
  return e === VEHICULE_ETAT.DISPONIBLE || e === VEHICULE_ETAT.RESERVE;
}