import { t, locale } from '../i18n';

export const POSTES = [
  { cle: 'carburant', libelle: 'Carburant', couleur: '#2a78d6' },
  { cle: 'entretien', libelle: 'Entretien', couleur: '#eb6834' },
  { cle: 'incidents', libelle: 'Incidents', couleur: '#1baf7a' },
  { cle: 'amendes', libelle: 'Amendes', couleur: '#eda100' },
  { cle: 'frais', libelle: 'Frais fixes', couleur: '#e87ba4' },
];

export const montantPoste = (postes, cle) => {
  if (!postes) return 0;
  if (cle === 'frais') {
    return (postes.assurance || 0) + (postes.vignette || 0) + (postes.visiteTechnique || 0) + (postes.autresFrais || 0);
  }
  return postes[cle] || 0;
};

export const TYPES_FRAIS = {
  1: 'Assurance',
  2: 'Vignette',
  3: 'Visite technique',
  4: 'Autre frais',
};

export const POSTES_DEPENSE = {
  carburant: { libelle: 'Carburant', groupe: 'carburant' },
  entretien: { libelle: 'Entretien', groupe: 'entretien' },
  incident: { libelle: 'Incident', groupe: 'incidents' },
  amende: { libelle: 'Amende', groupe: 'amendes' },
  assurance: { libelle: 'Assurance', groupe: 'frais' },
  vignette: { libelle: 'Vignette', groupe: 'frais' },
  visiteTechnique: { libelle: 'Visite technique', groupe: 'frais' },
  autreFrais: { libelle: 'Autre frais', groupe: 'frais' },
};

export const couleurPoste = (groupe) => POSTES.find((p) => p.cle === groupe)?.couleur || '#94a3b8';

export const ltr = (s) => (s == null || s === '' ? s : `⁦${s}⁩`);

export const formatDT = (v, decimales = 3) => t('{montant} DT', {
  montant: Number(v || 0).toLocaleString(locale(), { minimumFractionDigits: decimales, maximumFractionDigits: decimales }),
});

const isoLocal = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export const PERIODES = [
  { cle: 'annee', libelle: 'Année en cours' },
  { cle: '12mois', libelle: '12 derniers mois' },
  { cle: 'precedente', libelle: 'Année précédente' },
  { cle: 'perso', libelle: 'Personnalisée' },
];

export function bornesPeriode(cle, perso) {
  const auj = new Date();
  const annee = auj.getFullYear();
  switch (cle) {
    case '12mois': {
      const d = new Date(auj);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return { debut: isoLocal(d), fin: isoLocal(auj) };
    }
    case 'precedente':
      return { debut: `${annee - 1}-01-01`, fin: `${annee - 1}-12-31` };
    case 'perso':
      return perso;
    default:
      return { debut: `${annee}-01-01`, fin: isoLocal(auj) };
  }
}