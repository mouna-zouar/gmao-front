import bonMaintenanceService from './bonMaintenanceService';
import bonMaintenanceTacheService from './bonMaintenanceTacheService';
import bonMaintenanceIntervenantService from './bonMaintenanceIntervenantService';
import bonMaintenanceCommentaireService from './bonMaintenanceCommentaireService';
import bonMaintenanceDocumentAchatService from './bonMaintenanceDocumentAchatService';

/**
 * Crée un BonMaintenance et l'intégralité de ses données enfants en une seule
 * opération côté client : le bon est créé d'abord (pour obtenir son id), puis
 * chaque tâche/intervenant/commentaire/document est créé avec bonMaintenanceId
 * injecté automatiquement.
 *
 * Chaque famille d'enfants est créée en parallèle (Promise.all) ; les familles
 * elles-mêmes sont séquentielles pour ne pas noyer le serveur de requêtes.
 * Une erreur sur un enfant n'annule pas les autres — les échecs sont
 * remontés dans le résultat pour affichage, plutôt que de tout faire planter
 * après que le bon a déjà été créé.
 */
const bonMaintenanceFullService = {
  async createFull(bonPayload, children = {}) {
    const { taches = [], intervenants = [], commentaires = [], documents = [] } = children;

    const bonMaintenance = await bonMaintenanceService.create(bonPayload);
    const bonMaintenanceId = bonMaintenance.id;

    const errors = [];

    const createAll = async (items, createFn, label) => {
      const results = await Promise.allSettled(
        items.map((item) => createFn({ ...item, bonMaintenanceId }))
      );
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`Erreur création ${label} #${idx}:`, r.reason);
          errors.push({ type: label, index: idx, error: r.reason });
        }
      });
      return results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);
    };

    const createdTaches = await createAll(taches, bonMaintenanceTacheService.create, 'tâche');
    const createdIntervenants = await createAll(intervenants, bonMaintenanceIntervenantService.create, 'intervenant');
    const createdCommentaires = await createAll(commentaires, bonMaintenanceCommentaireService.create, 'commentaire');
    const createdDocuments = await createAll(documents, bonMaintenanceDocumentAchatService.create, 'document');

    return {
      bonMaintenance,
      taches: createdTaches,
      intervenants: createdIntervenants,
      commentaires: createdCommentaires,
      documents: createdDocuments,
      errors,
    };
  },
};

export default bonMaintenanceFullService;