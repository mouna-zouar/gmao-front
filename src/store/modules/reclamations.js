import { creerModule } from '../fabriques/creerModule';
import reclamationService from '../../services/Reclamationservice';

export const PARAMS_LISTE_RECLAMATIONS = Object.freeze({ page: 0, taille: 100 });

export const reclamations = creerModule({
  nom: 'reclamations',
  service: {
    lister: ({ page = 0, taille = 100 } = {}) => reclamationService.getAll(page, taille),
    obtenir: (id) => reclamationService.getById(id),
    creer: (donnees) => reclamationService.create(donnees),
    modifier: (id, donnees) => reclamationService.update(id, donnees),
    supprimer: (id) => reclamationService.remove(id),
  },
  operations: {
    affecter: (id, corps) => reclamationService.affecter(id, corps),
    prendreEnCharge: (id, corps) => reclamationService.prendreEnCharge(id, corps),
    resoudre: (id, corps) => reclamationService.resoudre(id, corps),
    cloturer: (id, corps) => reclamationService.cloturer(id, corps),
    rouvrir: (id, corps) => reclamationService.rouvrir(id, corps),
    annuler: (id, corps) => reclamationService.annuler(id, corps),
    annulerParDemandeur: (id, corps) => reclamationService.annulerParDemandeur(id, corps),
    valider: (id, corps) => reclamationService.valider(id, corps),
    rejeter: (id, corps) => reclamationService.rejeter(id, corps),
  },
  validiteMs: 60 * 1000,
  invalidePar: /^reclamation/,
});
