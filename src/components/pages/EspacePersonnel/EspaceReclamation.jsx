import { useCallback, useEffect, useMemo, useState } from 'react';
import reclamationService from '../../../services/Reclamationservice';
import bonMaintenanceFullService from '../../../services/Bonmaintenancefullservice';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import ReclamationDetails from '../Reclamations/Reclamationdetails';
import { useActionsReclamation } from '../Reclamations/ReclamationActions';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import BonMaintenanceModal from '../../ui/modals/Bonmaintenancemodal';
import { t } from '../../../i18n';

export function EspaceReclamation({ reclamationId, onBack, onOuvrirBon }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modifierOuvert, setModifierOuvert] = useState(false);
  const [associerOuvert, setAssocierOuvert] = useState(false);
  const [creerBonOuvert, setCreerBonOuvert] = useState(false);

  const reclamation = data?.reclamation ?? data;

  const charger = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setLoading(true);
    try {
      setData(await reclamationService.getWithBonMaintenance(reclamationId));
    } catch (err) {
      console.error('Erreur chargement de la réclamation :', err);
      alert(t('Impossible de charger les détails de cette réclamation.'));
      onBack?.();
    } finally {
      setLoading(false);
    }
  }, [reclamationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger(); }, [charger]);

  const recharger = () => charger({ silencieux: true });

  const enregistrerModification = async (payload) => {
    await reclamationService.update(reclamationId, payload);
    await recharger();
  };

  const actionsRec = useActionsReclamation(() => recharger());

  const creerBon = async (payload, children) => {
    const result = await bonMaintenanceFullService.createFull(payload, children || {});
    const bon = result.bonMaintenance;
    try {
      await reclamationBonMaintenanceService.link(reclamationId, bon.id);
    } catch (err) {
      console.error(err);
      alert(t('Le bon {num} a été créé, mais son association à la réclamation a échoué. Utilisez le bouton « Associer » pour le lier manuellement.', { num: bon.num || `#${bon.id}` }));
    }
    if (result.errors?.length > 0) {
      const resume = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
      alert(t("Le bon a été créé, mais {n} élément(s) n'ont pas pu être ajoutés :", { n: result.errors.length }) + `\n${resume}`);
    }
    await recharger();
  };

  const valeursBon = useMemo(() => {
    if (!reclamation) return null;
    return {
      titre: reclamation.num ? t('Réclamation {num}', { num: reclamation.num }) : t('Réclamation'),
      description: reclamation.description || '',
      urgence: reclamation.urgence ?? '',
      lotArticleImmobilistationId: reclamation.lotArticleImmobilistationId ?? '',
    };
  }, [reclamation]);

  return (
    <>
      <ReclamationDetails
        data={data}
        loading={loading}
        validating={actionsRec.enCours}
        libelleRetour={t('Retour à mon espace')}
        onBack={onBack}
        onModifier={() => setModifierOuvert(true)}
        onAction={(nom) => actionsRec.lancer(nom, reclamation)}
        onCreerBon={() => setCreerBonOuvert(true)}
        onAssocier={() => setAssocierOuvert(true)}
        onOuvrirBon={onOuvrirBon}
      />

      <ReclamationModal
        isOpen={modifierOuvert}
        onClose={() => setModifierOuvert(false)}
        onSave={enregistrerModification}
        reclamation={reclamation}
        isEditing
      />

      <AssociateBonMaintenanceModal
        isOpen={associerOuvert}
        onClose={() => { setAssocierOuvert(false); recharger(); }}
        reclamation={reclamation}
      />

      <BonMaintenanceModal
        isOpen={creerBonOuvert}
        onClose={() => setCreerBonOuvert(false)}
        onSave={creerBon}
        bonMaintenance={null}
        isEditing={false}
        initialValues={valeursBon}
        titleOverride={t('Nouveau bon') + ` — ${reclamation?.num || t('Réclamation')}`}
      />

      {actionsRec.fenetres}
    </>
  );
}
