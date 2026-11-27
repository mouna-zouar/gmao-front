import { creerModule } from '../fabriques/creerModule';
import bonMaintenanceService from '../../services/Bonmaintenanceservice';

export const PARAMS_LISTE_BONS = Object.freeze({ page: 0, taille: 200 });

export const bons = creerModule({
  nom: 'bons',
  service: {
    lister: ({ page = 0, taille = 500 } = {}) => bonMaintenanceService.getAll(page, taille),
    obtenir: (id) => bonMaintenanceService.getById(id),
    creer: (donnees) => bonMaintenanceService.create(donnees),
    modifier: (id, donnees) => bonMaintenanceService.update(id, donnees),
    supprimer: (id) => bonMaintenanceService.remove(id),
  },
  operations: {
    passerEnCours: (id) => bonMaintenanceService.passerEnCours(id),
    reprendre: (id) => bonMaintenanceService.reprendre(id),
    suspendre: (id, motif) => bonMaintenanceService.suspendre(id, motif),
    effectuer: (id, etatImmo = null) => bonMaintenanceService.marquerEffectue(id, etatImmo),
    annuler: (id) => bonMaintenanceService.annuler(id),
    changerEtat: (id, nouvelEtat, motif = null) => bonMaintenanceService.changerEtat(id, nouvelEtat, motif),
    recalculerPriorite: (id) => bonMaintenanceService.recalculerPriorite(id),
  },
  validiteMs: 60 * 1000,
  invalidePar: /^bon-maintenance/,
});
