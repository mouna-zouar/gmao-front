import { creerReferentiel } from './fabriques/creerReferentiel';
import personnelService from '../services/Personnelservice';
import serviceService from '../services/Serviceservice';
import equipementService from '../services/equipementService';
import codePanneService from '../services/codePanneService';
import gammeService from '../services/gammeService';
import cliniqueService from '../services/cliniqueService';
import calendrierService from '../services/Calendrierservice';
import hierarchieService from '../services/hierarchieService';

const MIN = 60 * 1000;

export const personnels = creerReferentiel({
  nom: 'personnels',
  charger: () => personnelService.getAll(0, 2000),
  validiteMs: 10 * MIN,
  invalidePar: /^personnel/,
});

export const personnelsMaintenance = creerReferentiel({
  nom: 'personnelsMaintenance',
  charger: () => personnelService.getMaintenance(0, 2000),
  validiteMs: 10 * MIN,
  invalidePar: /^personnel/,
});

export const services = creerReferentiel({
  nom: 'services',
  charger: () => serviceService.getAll(0, 1000),
  validiteMs: 30 * MIN,
  invalidePar: /^service(\/|\?|$)/,
});

export const familles = creerReferentiel({
  nom: 'familles',
  charger: () => equipementService.familles(),
  validiteMs: 10 * MIN,
  invalidePar: /^(equipements\/familles|gmao-cubix\/familles)/,
});

export const codesPanne = creerReferentiel({
  nom: 'codesPanne',
  charger: () => codePanneService.liste(true),
  validiteMs: 10 * MIN,
  invalidePar: /^codes-panne/,
});

export const gammes = creerReferentiel({
  nom: 'gammes',
  charger: () => gammeService.lister(),
  validiteMs: 2 * MIN,
  invalidePar: /^gammes/,
});

export const cliniques = creerReferentiel({
  nom: 'cliniques',
  charger: () => cliniqueService.getAll(0, 1000),
  validiteMs: 30 * MIN,
  invalidePar: /^clinique/,
});

export const calendriers = creerReferentiel({
  nom: 'calendriers',
  charger: () => calendrierService.getAll(0, 1000),
  validiteMs: 30 * MIN,
  invalidePar: /^calendrier/,
});

export const CARTE_VIDE = Object.freeze({ lieux: [], equipements: {} });
export const lieux = creerReferentiel({
  nom: 'lieux',
  charger: () => hierarchieService.carte(),
  validiteMs: MIN,
  invalidePar: /^hierarchie\/(lieux|affecter|equipements\/[^/]+\/parent)/,
  transformer: (carte) => (carte && typeof carte === 'object' ? { lieux: carte.lieux ?? [], equipements: carte.equipements ?? {} } : CARTE_VIDE),
});
