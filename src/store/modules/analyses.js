import { serviceDiffere } from '../fabriques/serviceDiffere';
import { creerRequete } from '../fabriques/creerRequete';

const tableauDeBordService = serviceDiffere(() => import('../../services/tableauDeBordService'));
const supervisionService = serviceDiffere(() => import('../../services/supervisionService'));
const slaService = serviceDiffere(() => import('../../services/slaService'));
const coutService = serviceDiffere(() => import('../../services/coutService'));
const indicateursPerformanceService = serviceDiffere(() => import('../../services/indicateursPerformanceService'));
const performanceEmployesService = serviceDiffere(() => import('../../services/performanceEmployesService'));
const parcDashboardService = serviceDiffere(() => import('../../services/parcDashboardService'));
const anomalieService = serviceDiffere(() => import('../../services/Anomalieservice'));
const blocageImmobilisationService = serviceDiffere(() => import('../../services/Blocageimmobilisationservice'));
const rcaCapaService = serviceDiffere(() => import('../../services/rcaCapaService'));
const alerteMachineService = serviceDiffere(() => import('../../services/alerteMachineService'));
const decisionService = serviceDiffere(() => import('../../services/decisionService'));

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

export const reparerOuRemplacer = creerRequete({
  nom: 'reparerOuRemplacer', executer: ({ id }) => decisionService.reparerOuRemplacer(id), validiteMs: 5 * MIN, invalidePar: METIER,
});
export const conseilsPreventif = creerRequete({
  nom: 'conseilsPreventif', executer: () => decisionService.conseilsPreventif(), validiteMs: 10 * MIN,
  invalidePar: /^(equipement-maintenance|bon-maintenance)/,
});
export const prioritesPersonnel = creerRequete({
  nom: 'prioritesPersonnel', executer: ({ personnelId, limite = 5 }) => decisionService.prioritesPersonnel(personnelId, limite),
  validiteMs: MIN, invalidePar: METIER,
});
export const previsionsStock = creerRequete({
  nom: 'previsionsStock', executer: ({ delaiJours = 14, tout = false }) => decisionService.previsionsStock(delaiJours, tout),
  validiteMs: 5 * MIN, invalidePar: /^(bon-maintenance|piece|stock)/,
});
export const prioritesDuJour = creerRequete({
  nom: 'prioritesDuJour', executer: ({ limite = 5, personnelId = null }) => decisionService.prioritesDuJour(limite, personnelId), validiteMs: MIN, invalidePar: METIER,
});

export const coutVue = creerRequete({
  nom: 'coutVue', executer: (bornes) => coutService.getVue(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
});
export const slaVue = creerRequete({
  nom: 'slaVue', executer: (bornes) => slaService.getVue(bornes), validiteMs: 2 * MIN, invalidePar: METIER,
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
