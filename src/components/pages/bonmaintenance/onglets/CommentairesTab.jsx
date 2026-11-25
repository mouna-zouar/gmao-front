import { useEffect, useState } from 'react';
import { Edit, Trash2, Loader2, Inbox } from 'lucide-react';
import bonMaintenanceCommentaireService from '../../../../services/Bonmaintenancecommentaireservice';
import Button from '../../../ui/Button';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { formatDateTime } from '../BmdCommun';
import { t } from '../../../../i18n';

export function CommentairesTab({ bonMaintenanceId }) {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [editionId, setEditionId] = useState(null);
  const [texteEdition, setTexteEdition] = useState('');
  const [savingEdition, setSavingEdition] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceCommentaireService.getByBonMaintenance(bonMaintenanceId);
      setCommentaires(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await bonMaintenanceCommentaireService.create({ bonMaintenanceId, commentaire: text.trim() });
      setText('');
      await load();
    } catch (err) {
      console.error(err);
      alert(t("Échec de l'ajout du commentaire."));
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const commencerEdition = (c) => {
    setEditionId(c.id);
    setTexteEdition(c.commentaire || '');
  };
  const annulerEdition = () => {
    setEditionId(null);
    setTexteEdition('');
  };
  const enregistrerEdition = async (c) => {
    const texte = texteEdition.trim();
    if (!texte) return;
    setSavingEdition(true);
    try {
      const maj = await bonMaintenanceCommentaireService.update(c.id, { ...c, commentaire: texte });
      setCommentaires((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...(maj || {}), commentaire: texte } : x)));
      annulerEdition();
    } catch (err) {
      console.error(err);
      alert(t("Échec de la modification du commentaire."));
    } finally {
      setSavingEdition(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer le commentaire"),
      message: t("Supprimer ce commentaire ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceCommentaireService.remove(id);
          setCommentaires((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  return (
    <div>
      <form className="bmd-comment-form" onSubmit={handleAdd}>
        <textarea
          placeholder={t("Ajouter un commentaire...")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <Button type="submit" variant="primary" disabled={saving || !text.trim()}>
          {saving ? t("Envoi...") : t("Publier")}
        </Button>
      </form>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : commentaires.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun commentaire pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-list">
          {commentaires.map((c) => (
            <li key={c.id} className="bmd-list-item bmd-comment-item">
              <div>
                <span className="bmd-item-title">{c.personnelCreation ? `${c.personnelCreation.nom} ${c.personnelCreation.prenom}` : (c.personnelCreationNom || t("Anonyme"))}</span>
                <span className="bmd-item-sub">{formatDateTime(c.date)}</span>
                {editionId === c.id ? (
                  <div className="bmd-comment-edition">
                    <textarea
                      value={texteEdition}
                      onChange={(e) => setTexteEdition(e.target.value)}
                      rows={3}
                      autoFocus
                      aria-label={t("Modifier le commentaire")}
                      onKeyDown={(e) => { if (e.key === 'Escape') annulerEdition(); }}
                    />
                    <div className="bmd-comment-actions">
                      <Button type="button" variant="secondary" onClick={annulerEdition} disabled={savingEdition}>
                        {t("Annuler")}
                      </Button>
                      <Button type="button" variant="primary" onClick={() => enregistrerEdition(c)} disabled={savingEdition || !texteEdition.trim()}>
                        {savingEdition ? t("Enregistrement…") : t("Enregistrer")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="bmd-comment-text">{c.commentaire}</p>
                )}
              </div>
              {editionId !== c.id && (
                <div className="bmd-comment-actions">
                  <button type="button" className="bmd-edit-btn" onClick={() => commencerEdition(c)} title={t("Modifier")} aria-label={t("Modifier le commentaire")}>
                    <Edit size={14} />
                  </button>
                  <button type="button" className="bmd-delete-btn" onClick={() => handleDelete(c.id)} title={t("Supprimer")} aria-label={t("Supprimer le commentaire")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={t("Supprimer")}
      />
    </div>
  );
}
