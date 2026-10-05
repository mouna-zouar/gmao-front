// Référentiel de criticité des actifs (véhicules, équipements) — source unique de
// vérité côté front. DOIT rester synchronisé avec softsys.GMAO.models.Criticite
// (backend) : les valeurs sont les noms exacts de l'enum Java (sérialisés en string
// par @Enumerated(EnumType.STRING)), pas des codes numériques comme VEHICULE_ETAT.

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

// Couleur utilisée par les badges/pills (même convention que ETAT_VEHICULE_COLOR).
export const CRITICITE_COLOR = {
  C1: 'red',
  C2: 'amber',
  C3: 'blue',
  C4: 'slate',
};

export const CRITICITE_DEFAUT = 'C3';

// Hex directs (pas de dépendance à des tokens CSS custom non garantis présents
// sur toutes les pages qui consomment ce référentiel — cf. Etatequipement.css qui
// ne définit pas de token "amber"). Alignés sur les teintes red/blue/slate déjà
// utilisées ailleurs dans le projet (--red-500, --blue-500, --slate-500).
export const CRITICITE_HEX = {
  C1: '#ef4444', // red-500
  C2: '#f97316', // orange-500 (tient lieu d'amber, non défini dans les tokens existants)
  C3: '#3b82f6', // blue-500
  C4: '#64748b', // slate-500
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
