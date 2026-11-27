import { serviceDiffere } from '../fabriques/serviceDiffere';
import { creerModule } from '../fabriques/creerModule';

const vehiculeIncidentService = serviceDiffere(() => import('../../services/vehiculeIncidentService'));
const vehiculeMissionService = serviceDiffere(() => import('../../services/vehiculeMissionService'));
const vehiculeReservationService = serviceDiffere(() => import('../../services/vehiculeReservationService'));
const vehiculeBonCarburantService = serviceDiffere(() => import('../../services/vehiculeBonCarburantService'));
const vehiculeConducteurService = serviceDiffere(() => import('../../services/vehiculeConducteurService'));
const vehiculeAmendeService = serviceDiffere(() => import('../../services/Vehiculeamendeservice'));
const permisConduiteService = serviceDiffere(() => import('../../services/permisConduiteService'));

const MIN = 60 * 1000;
const crud = (s) => ({
  lister: ({ page = 0, taille = 500 } = {}) => s.getAll(page, taille),
  obtenir: (id) => s.getById(id),
  creer: (d) => s.create(d),
  modifier: (id, d) => s.update(id, d),
  supprimer: (id) => s.remove(id),
});

export const incidentsParc = creerModule({
  nom: 'incidentsParc', service: crud(vehiculeIncidentService), validiteMs: 2 * MIN, invalidePar: /^vehicule-incidents/,
});

export const missionsParc = creerModule({
  nom: 'missionsParc',
  service: crud(vehiculeMissionService),
  operations: {
    demarrer: (id) => vehiculeMissionService.demarrer(id),
    terminer: (id, kilometrage, motif) => vehiculeMissionService.terminer(id, kilometrage, motif),
  },
  validiteMs: 2 * MIN,
  invalidePar: /^vehicule-mission/,
});

export const reservationsParc = creerModule({
  nom: 'reservationsParc', service: crud(vehiculeReservationService), validiteMs: 2 * MIN, invalidePar: /^vehicule-reservations/,
});

export const bonsCarburantParc = creerModule({
  nom: 'bonsCarburantParc', service: crud(vehiculeBonCarburantService), validiteMs: 2 * MIN, invalidePar: /^vehicule-bon-carburant/,
});

export const conducteursParc = creerModule({
  nom: 'conducteursParc', service: crud(vehiculeConducteurService), validiteMs: 2 * MIN, invalidePar: /^vehicule-conducteur/,
});

export const amendesParc = creerModule({
  nom: 'amendesParc',
  service: crud(vehiculeAmendeService),
  operations: {
    payer: (id, paiement) => vehiculeAmendeService.payer(id, paiement),
    changerStatut: (id, statut) => vehiculeAmendeService.changerStatut(id, statut),
  },
  validiteMs: 2 * MIN,
  invalidePar: /^vehicule-amendes/,
});

export const permisParc = creerModule({
  nom: 'permisParc', service: crud(permisConduiteService), validiteMs: 5 * MIN, invalidePar: /^permis-conduite/,
});
