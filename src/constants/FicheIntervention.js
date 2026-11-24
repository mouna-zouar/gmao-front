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

export const optionsTypeEntretien = (codeActuel) => {
  const n = codeActuel === '' || codeActuel == null ? null : Number(codeActuel);
  if (n == null || TYPES_ENTRETIEN.some((x) => x.value === n)) return TYPES_ENTRETIEN;
  return [...TYPES_ENTRETIEN, { value: n, label: libelleTypeEntretien(n) }];
};

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