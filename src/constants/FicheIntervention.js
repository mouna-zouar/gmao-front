/*
 * Champs de la fiche d'intervention papier ENR-MMT 10 (Polyclinique Ibn Khaldoun)
 * repris dans la GMAO : type d'entretien et source de l'information.
 * Les codes sont ceux du backend (BonMaintenanceTypes, SourceInformation).
 */

// Type d'entretien du bon. Les trois premiers sont les cases de la fiche ;
// Correctif et Autre existent encore dans des données anciennes.
export const TYPES_ENTRETIEN = [
  { value: 1, label: 'Curatif', aide: 'Réparation après une panne' },
  { value: 3, label: 'Préventif', aide: 'Entretien planifié, sans panne' },
  { value: 4, label: 'Nouvelle installation', aide: 'Mise en place d’un nouvel équipement' },
];
const TYPES_ANCIENS = { 2: 'Correctif', 5: 'Autre' };

export const libelleTypeEntretien = (code) => {
  if (code == null || code === '') return '';
  const n = Number(code);
  return TYPES_ENTRETIEN.find((x) => x.value === n)?.label || TYPES_ANCIENS[n] || `Type ${n}`;
};

/** Options à afficher dans un select : garde l'ancien code du bon s'il n'est plus proposé. */
export const optionsTypeEntretien = (codeActuel) => {
  const n = codeActuel === '' || codeActuel == null ? null : Number(codeActuel);
  if (n == null || TYPES_ENTRETIEN.some((x) => x.value === n)) return TYPES_ENTRETIEN;
  return [...TYPES_ENTRETIEN, { value: n, label: libelleTypeEntretien(n) }];
};

// Source de l'information : comment la demande est arrivée au service maintenance.
export const SOURCES_INFORMATION = [
  { value: 1, label: 'Par téléphone' },
  { value: 2, label: 'Par email' },
  { value: 3, label: 'Directement' },
  { value: 4, label: 'Application GMAO' },
];

export const libelleSourceInformation = (code) => {
  if (code == null || code === '') return '';
  return SOURCES_INFORMATION.find((x) => x.value === Number(code))?.label || '';
};