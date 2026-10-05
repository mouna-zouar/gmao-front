import bonMaintenanceService from './bonMaintenanceService';
import bonMaintenanceTacheService from './bonMaintenanceTacheService';
import bonMaintenanceIntervenantService from './bonMaintenanceIntervenantService';
import bonMaintenanceCommentaireService from './bonMaintenanceCommentaireService';
import bonMaintenanceDocumentAchatService from './bonMaintenanceDocumentAchatService';

const bonMaintenanceFullService = {

  async createFull(bonPayload, children = {}) {
    const {
      taches = [],
      intervenants = [],
      commentaires = [],
      documents = []
    } = children;

    const bonMaintenance = await bonMaintenanceService.create(bonPayload);
    const bonMaintenanceId = bonMaintenance.id;

    const errors = [];

    const createAll = async (items, createFn, label) => {
      const results = await Promise.allSettled(
        items.map((item) =>
          createFn({
            ...item,
            bonMaintenanceId
          })
        )
      );

      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(
            `Erreur création ${label} #${idx}:`,
            r.reason
          );

          errors.push({
            type: label,
            index: idx,
            error: r.reason
          });
        }
      });

      return results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);
    };

    const createdTaches = await createAll(
      taches,
      bonMaintenanceTacheService.create,
      'tâche'
    );

    const createdIntervenants = await createAll(
      intervenants,
      bonMaintenanceIntervenantService.create,
      'intervenant'
    );

    const createdCommentaires = await createAll(
      commentaires,
      bonMaintenanceCommentaireService.create,
      'commentaire'
    );

    const createdDocuments = await createAll(
      documents,
      bonMaintenanceDocumentAchatService.create,
      'document'
    );

    return {
      bonMaintenance,
      taches: createdTaches,
      intervenants: createdIntervenants,
      commentaires: createdCommentaires,
      documents: createdDocuments,
      errors
    };
  },

  /**
   * Supprime un BonMaintenance et toutes ses données enfants.
   *
   * Ordre :
   * 1. Documents
   * 2. Commentaires
   * 3. Intervenants
   * 4. Tâches
   * 5. BonMaintenance
   */
  async deleteFull(bonMaintenanceId) {

  if (!bonMaintenanceId) {
    throw new Error('bonMaintenanceId est obligatoire');
  }

  const errors = [];

  const deleteAll = async (items, deleteFn, label) => {

    const results = await Promise.allSettled(
      (items ?? []).map((item) => {
        const id = typeof item === 'object'
          ? item.id
          : item;

        return deleteFn(id);
      })
    );

    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error(
          `Erreur suppression ${label} #${idx + 1}:`,
          r.reason
        );

        errors.push({
          type: label,
          index: idx,
          error: r.reason
        });
      }
    });

    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
  };

  // ==========================================
  // 1. RÉCUPÉRER LES ENFANTS
  // ==========================================

  let taches = [];
  let intervenants = [];
  let commentaires = [];
  let documents = [];

  try {
    taches = await bonMaintenanceTacheService
      .getByBonMaintenance(bonMaintenanceId);
  } catch (error) {
    console.error('Erreur récupération tâches:', error);

    errors.push({
      type: 'tâches',
      action: 'chargement',
      error
    });
  }

  try {
    intervenants = await bonMaintenanceIntervenantService
      .getByBonMaintenance(bonMaintenanceId);
  } catch (error) {
    console.error('Erreur récupération intervenants:', error);

    errors.push({
      type: 'intervenants',
      action: 'chargement',
      error
    });
  }

  try {
    commentaires = await bonMaintenanceCommentaireService
      .getByBonMaintenance(bonMaintenanceId);
  } catch (error) {
    console.error('Erreur récupération commentaires:', error);

    errors.push({
      type: 'commentaires',
      action: 'chargement',
      error
    });
  }

  try {
    documents = await bonMaintenanceDocumentAchatService
      .findByBonMaintenanceId(bonMaintenanceId);
  } catch (error) {
    console.error('Erreur récupération documents:', error);

    errors.push({
      type: 'documents',
      action: 'chargement',
      error
    });
  }

  // ==========================================
  // 2. SUPPRIMER LES ENFANTS
  // ==========================================

  const [
    deletedTaches,
    deletedIntervenants,
    deletedCommentaires,
    deletedDocuments
  ] = await Promise.all([

    deleteAll(
      taches,
      bonMaintenanceTacheService.remove,
      'tâche'
    ),

    deleteAll(
      intervenants,
      bonMaintenanceIntervenantService.remove,
      'intervenant'
    ),

    deleteAll(
      commentaires,
      bonMaintenanceCommentaireService.remove,
      'commentaire'
    ),

    deleteAll(
      documents,
      bonMaintenanceDocumentAchatService.remove,
      'document'
    )
  ]);

  // ==========================================
  // 3. SUPPRIMER LE BON
  // ==========================================

  let bonMaintenanceDeleted = null;

  if (errors.length === 0) {

    try {

      bonMaintenanceDeleted =
        await bonMaintenanceService.remove(bonMaintenanceId);

    } catch (error) {

      console.error(
        'Erreur suppression BonMaintenance:',
        error
      );

      errors.push({
        type: 'bonMaintenance',
        action: 'suppression',
        error
      });
    }
  }

  return {
    bonMaintenanceId,
    bonMaintenanceDeleted,
    taches: deletedTaches,
    intervenants: deletedIntervenants,
    commentaires: deletedCommentaires,
    documents: deletedDocuments,
    errors
  };
}
};

export default bonMaintenanceFullService;