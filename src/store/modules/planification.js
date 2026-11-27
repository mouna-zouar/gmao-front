import { creerModule } from '../fabriques/creerModule';
import { creerRequete } from '../fabriques/creerRequete';
import planningService from '../../services/planningService';
import maintenanceTacheService from '../../services/maintenanceTacheService';
import formationService from '../../services/formationService';

const MIN = 60 * 1000;
const PERIME_PLANNING = /^(planning|bon-maintenance)/;
const date = (iso) => new Date(iso);

export const planningEvenements = creerRequete({
  nom: 'planningEvenements',
  executer: ({ mode, debut, fin }) => planningService.findEvenements(mode, date(debut), date(fin)).then((d) => d ?? []),
  validiteMs: MIN,
  invalidePar: PERIME_PLANNING,
});

export const planningEquipe = creerRequete({
  nom: 'planningEquipe',
  executer: ({ debut, fin }) => planningService.equipe(date(debut), date(fin)),
  validiteMs: MIN,
  invalidePar: PERIME_PLANNING,
});

export const planningTechniciens = creerRequete({
  nom: 'planningTechniciens',
  executer: ({ debut, fin }) => planningService.findPlanningTousTechniciens(date(debut), date(fin)).then((d) => d ?? []),
  validiteMs: MIN,
  invalidePar: PERIME_PLANNING,
});

export const planningConfig = creerRequete({
  nom: 'planningConfig',
  executer: () => planningService.findConfig(),
  validiteMs: 30 * MIN,
  invalidePar: /^planning\/config/,
});

export const tachesMaintenance = creerModule({
  nom: 'tachesMaintenance',
  service: {
    lister: ({ page = 0, taille = 500 } = {}) => maintenanceTacheService.getAll(page, taille),
    obtenir: (id) => maintenanceTacheService.getById(id),
    creer: (donnees) => maintenanceTacheService.create(donnees),
    modifier: (id, donnees) => maintenanceTacheService.update(id, donnees),
    supprimer: (id) => maintenanceTacheService.remove(id),
  },
  validiteMs: 5 * MIN,
  invalidePar: /^maintenance-tache/,
});

export const formations = creerModule({
  nom: 'formations',
  service: {
    lister: () => formationService.getAll(),
    creer: (donnees) => formationService.create(donnees),
    modifier: (id, donnees) => formationService.update(id, donnees),
    supprimer: (id) => formationService.remove(id),
  },
  validiteMs: 5 * MIN,
  invalidePar: /^formations/,
});
