import { depots } from './depotsSlice';
import { prestataires } from './prestatairesSlice';
import { articles } from './articlesSlice';
import { vehicules } from './vehiculesSlice';
import { equipements } from './equipementsSlice';
import { emplacements } from './emplacementsSlice';
import {
  personnels, personnelsMaintenance, services, familles, codesPanne, gammes, cliniques, calendriers, lieux,
} from './listesReference';
import { bons } from './modules/bons';
import { reclamations } from './modules/reclamations';
import {
  planningEvenements, planningEquipe, planningTechniciens, planningConfig, tachesMaintenance, formations,
} from './modules/planification';
import {
  etatsEquipements, typesMaintenanceEquipement, connexionsEquipements, arbreLieux, disponibilites, risques,
  reglesConditionnelles, renouvellement, echeancierMetrologie, controlesMetrologie, incidentsMateriovigilance,
  delaisMateriovigilance, compteurs,
} from './modules/equipements';
import {
  incidentsParc, missionsParc, reservationsParc, bonsCarburantParc, conducteursParc, amendesParc, permisParc,
} from './modules/parc';
import { parametres, alertesStock, reglagesStock } from './modules/administration';
import {
  tableauDeBord, tableauBons, tableauReclamations, supervision, slaDepassements, slaParPeriode, slaBilan,
  coutParPeriode, coutBilan, indicateursPerformance, performanceEmployes, chronoEmployes, tableauParc,
  anomalies, blocages, actionsRcaEnRetard, alertesMachines, indicateursAlertes, agentsMachines, compteAlertesMachines,
} from './modules/analyses';

export const REFERENTIELS = {
  depots, prestataires, articles, vehicules, equipements, emplacements,
  personnels, personnelsMaintenance, services, familles, codesPanne, gammes, cliniques, calendriers, lieux,
  etatsEquipements, typesMaintenanceEquipement, connexionsEquipements, arbreLieux, parametres,
};

export const MODULES = {
  bons, reclamations, tachesMaintenance, formations, compteurs,
  incidentsParc, missionsParc, reservationsParc, bonsCarburantParc, conducteursParc, amendesParc, permisParc,
};

export const REQUETES = {
  planningEvenements, planningEquipe, planningTechniciens, planningConfig,
  disponibilites, risques, reglesConditionnelles, renouvellement,
  echeancierMetrologie, controlesMetrologie, incidentsMateriovigilance, delaisMateriovigilance,
  alertesStock, reglagesStock,
  tableauDeBord, tableauBons, tableauReclamations, supervision, slaDepassements, slaParPeriode, slaBilan,
  coutParPeriode, coutBilan, indicateursPerformance, performanceEmployes, chronoEmployes, tableauParc,
  anomalies, blocages, actionsRcaEnRetard, alertesMachines, indicateursAlertes, agentsMachines, compteAlertesMachines,
};

export const TOUS = [...Object.values(REFERENTIELS), ...Object.values(MODULES), ...Object.values(REQUETES)];

export function trouver(nomOuElement) {
  if (nomOuElement && typeof nomOuElement === 'object') return nomOuElement;
  const e = TOUS.find((x) => x.nom === nomOuElement);
  if (!e) throw new Error(`Redux : « ${nomOuElement} » n'est pas déclaré dans store/registre.js.`);
  return e;
}
