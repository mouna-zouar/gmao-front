import { useCallback, useEffect, useMemo, useState } from 'react';
import { XCircle } from 'lucide-react';
import reclamationService from '../../../services/Reclamationservice';
import bonMaintenanceFullService from '../../../services/Bonmaintenancefullservice';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import ReclamationDetails from '../Reclamations/Reclamationdetails';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import BonMaintenanceModal from '../../ui/modals/Bonmaintenancemodal';
import { t } from '../../../i18n';
import '../../ui/modals/ConfirmModal.css';
import '../Reclamations/Reclamations.css';

/**
 * Réclamation ouverte en pleine page depuis Mon espace (même écran que dans « Réclamations »),
 * avec les mêmes actions : modifier, valider, rejeter, créer / associer un bon, ouvrir le bon lié.
 * « Retour » ramène à Mon espace.
 *
 * Props :
 *   reclamationId : réclamation à afficher
 *   onBack()      : retour à Mon espace (qui se recharge)
 *   onOuvrirBon(bon) : ouvre le bon lié dans Mon espace
 */
export default function EspaceReclamation({ reclamationId, onBack, onOuvrirBon }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [modifierOuvert, setModifierOuvert] = useState(false);
  const [associerOuvert, setAssocierOuvert] = useState(false);
  const [creerBonOuvert, setCreerBonOuvert] = useState(false);
  const [rejet, setRejet] = useState({ show: false, motif: '' });

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

  const valider = async () => {
    if (validating) return;
    setValidating(true);
    try {
      await reclamationService.valider(reclamationId, {});
      await recharger();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('Échec de la validation.'));
    } finally {
      setValidating(false);
    }
  };

  const confirmerRejet = async () => {
    const motif = rejet.motif.trim();
    if (!motif) return;
    setRejet({ show: false, motif: '' });
    setValidating(true);
    try {
      await reclamationService.rejeter(reclamationId, { motifRejet: motif });
      await recharger();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('Échec du rejet.'));
    } finally {
      setValidating(false);
    }
  };

  /** Crée le bon (avec ses éléments) puis le lie à la réclamation, comme dans « Réclamations ». */
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
        validating={validating}
        libelleRetour={t('Retour à mon espace')}
        onBack={onBack}
        onModifier={() => setModifierOuvert(true)}
        onValider={valider}
        onRejeter={() => setRejet({ show: true, motif: '' })}
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

      {rejet.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setRejet({ show: false, motif: '' })}>
          <div className="confirm-modal-container rejet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <XCircle className="modal-confirm-icon danger" size={48} strokeWidth={2} />
              </div>
              <div className="confirm-modal-text">
                <h3>{t('Rejeter la réclamation')}</h3>
                <p>{t('Indique le motif du rejet.')}</p>
                <textarea
                  className="confirm-modal-input"
                  value={rejet.motif}
                  onChange={(e) => setRejet((r) => ({ ...r, motif: e.target.value }))}
                  placeholder={t('Motif de rejet...')}
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button type="button" className="confirm-btn secondary" onClick={() => setRejet({ show: false, motif: '' })}>
                {t('Annuler')}
              </button>
              <button type="button" className="confirm-btn primary danger" onClick={confirmerRejet} disabled={!rejet.motif.trim()}>
                {t('Rejeter')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
