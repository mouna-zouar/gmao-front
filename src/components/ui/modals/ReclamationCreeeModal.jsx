import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import { t } from '../../../i18n';

/*
 * Confirmation après la création d'une réclamation (même fenêtre partout).
 * reclamation : la réponse du serveur ({ id, num, bonMaintenanceId }) ; null = fermée.
 * lienBon : propose « Voir le bon » quand un bon a été créé (false dans Mon espace).
 */
export default function ReclamationCreeeModal({ reclamation, onClose, lienBon = true }) {
  const navigate = useNavigate();
  if (!reclamation) return null;
  const num = reclamation.num || (reclamation.id != null ? `#${reclamation.id}` : '');
  const bonId = reclamation.bonMaintenanceId;
  const voirBon = lienBon && bonId != null;
  return (
    <ConfirmModal
      show
      type="success"
      title={t('Réclamation créée')}
      message={bonId != null
        ? t('La réclamation {num} est enregistrée. Un bon de maintenance a été créé automatiquement : l’équipe de maintenance l’a reçu.', { num })
        : t('La réclamation {num} est enregistrée : l’équipe de maintenance l’a reçue.', { num })}
      confirmText={voirBon ? t('Voir le bon') : t('OK')}
      cancelText={voirBon ? t('Fermer') : null}
      onClose={onClose}
      onConfirm={() => {
        onClose();
        if (voirBon) navigate(`/bons-maintenance?id=${bonId}`);
      }}
    />
  );
}
