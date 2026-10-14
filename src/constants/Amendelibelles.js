
export const TYPES_INFRACTION = {
  1: 'Excès de vitesse',
  2: 'Stationnement',
  3: 'Feu rouge / stop',
  4: 'Téléphone au volant',
  5: 'Ceinture',
  6: 'Documents du véhicule',
  7: 'Autre',
};

export const STATUTS = {
  0: 'À payer',
  1: 'Contestée',
  2: 'Payée',
  3: 'Annulée',
};

export const IMPUTATIONS = {
  0: "À la charge de l'établissement",
  1: 'Retenue sur le conducteur',
};

/**
 * Immatriculation, n° de mission ou de PV dans une phrase : toujours de gauche à droite,
 * même en arabe (« 123 TU 4567 » ne doit pas devenir « TU 4567 123 »).
 * Caractères d'isolement Unicode : utilisables aussi dans un <option>.
 */
export const ltr = (s) => (s == null || s === '' ? s : `\u2066${s}\u2069`);

/** Comment le conducteur a été trouvé */
export const ORIGINE = { SAISIE: 0, MISSION: 1, AFFECTATION: 2 };