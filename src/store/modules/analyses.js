import { creerRequete } from '../fabriques/creerRequete';
import tableauDeBordService from '../../services/tableauDeBordService';
import supervisionService from '../../services/supervisionService';
import slaService from '../../services/slaService';
import coutService from '../../services/coutService';
import indicateursPerformanceService from '../../services/indicateursPerformanceService';
import performanceEmployesService from '../../services/performanceEmployesService';
import parcDashboardService from '../../services/parcDashboardService';
import anomalieService from '../../services/Anomalieservice';
import blocageImmobilisationService from '../../services/Blocageimmobilisationservice';
import rcaCapaService from '../../services/rcaCapaService';
import alerteMachineService from '../../services/alerteMachineService';

const S = 1000;
const MIN = 60 * S;
const METIER = /^(bon-maintenance|reclamation|etat-equipement|machines|planning|cout|sla(?!\/bons)|vehicule|demande|piece)/;

export const tableauDeBord = creerRequete({
  nom: 'tableauDeBord',
  executer: ({ jours, lieuId }, { forcer }) => tableauDeBordService.tableau(jours, forcer, lieuId ?? null),
  validiteMs: MIN, invalidePar: METIER,
});
export const tableauBons = creerRequete({
  nom: 'tableauBons',
  executer: ({ jours, lieuId }, { forcer }) => tableauDeBordService.bons(jours, forcer, lieuId ?? null),
  validiteMs: MIN, invalidePar: METIER,
});
export const tableauReclamations = creerRequete({
  nom: 'tableauReclamations',
  executer: ({ jours, lieuId }, { forcer }) => tableauDeBordService.reclamations(jours, forcer, lieuId ?? null),
  validiteMs: MIN, invalidePar: METIER,
});

export const supervision = creerRequete({
  nom: 'supervision',
  executer: ({ heures }) => supervisionService.tableau(heures),
  validiteMs: 20 * S, invalidePar: /^machines/,
});

export const slaDepassements = creerRequete({
  nom: 'slaDepassements', executer: () => slaService.getDepassements(), validiteMs: MIN, invalidePar: METIER,
});
export const slaParPeriode = creerRequete({
  nom: 'slaParPeriode', executer: (bornes) => slaService.getParPeriode(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
});
export const slaBilan = creerRequete({
  nom: 'slaBilan', executer: (bornes) => slaService.getBilan(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
});

export const coutParPeriode = creerRequete({
  nom: 'coutParPeriode', executer: (bornes) => coutService.getParPeriode(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
});
export const coutBilan = creerRequete({
  nom: 'coutBilan', executer: (bornes) => coutService.getBilan(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
});

export const indicateursPerformance = creerRequete({
  nom: 'indicateursPerformance', executer: (p) => indicateursPerformanceService.rapport(p), validiteMs: 2 * MIN, invalidePar: METIER,
});
export const performanceEmployes = creerRequete({
  nom: 'performanceEmployes', executer: ({ jours }) => performanceEmployesService.performance(jours), validiteMs: 2 * MIN, invalidePar: METIER,
});
export const chronoEmployes = creerRequete({
  nom: 'chronoEmployes', executer: () => performanceEmployesService.chrono(), validiteMs: 15 * S, invalidePar: METIER,
});

export const tableauParc = creerRequete({
  nom: 'tableauParc', executer: () => parcDashboardService.getDashboard(), validiteMs: MIN, invalidePar: /^(vehicule|permis-conduite)/,
});

export const anomalies = creerRequete({
  nom: 'anomalies', executer: ({ page = 0, taille = 50 }) => anomalieService.getAll(page, taille), validiteMs: MIN, invalidePar: /^anomalies/,
});
export const blocages = creerRequete({
  nom: 'blocages',
  executer: ({ page = 0, taille = 50 }) => blocageImmobilisationService.getAll(page, taille),
  validiteMs: MIN, invalidePar: /^blocages-immobilisation/,
});
export const actionsRcaEnRetard = creerRequete({
  nom: 'actionsRcaEnRetard', executer: () => rcaCapaService.getActionsEnRetard(), validiteMs: 2 * MIN, invalidePar: /^rca/,
});

export const alertesMachines = creerRequete({
  nom: 'alertesMachines',
  executer: ({ statut = '', page = 0, taille = 300 }) => alerteMachineService.getAll(statut, page, taille),
  validiteMs: 20 * S, invalidePar: /^machines/,
});
export const indicateursAlertes = creerRequete({
  nom: 'indicateursAlertes', executer: () => alerteMachineService.indicateurs(), validiteMs: 30 * S, invalidePar: /^machines/,
});
export const agentsMachines = creerRequete({
  nom: 'agentsMachines', executer: () => alerteMachineService.agents(), validiteMs: 30 * S, invalidePar: /^machines\/agents/,
});
export const compteAlertesMachines = creerRequete({
  nom: 'compteAlertesMachines', executer: () => alerteMachineService.compterNouvelles(), validiteMs: 30 * S, invalidePar: /^machines/,
});
