import { useEffect, useMemo, useState } from 'react';
import maintenanceTacheService from '../../../services/maintenanceTacheService';
import MaintenanceTacheModal from '../../ui/modals/MaintenanceTacheModal';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import './MaintenanceTaches.css';

export default function MaintenanceTaches() {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTache, setSelectedTache] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: 'Confirmer',
    onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await maintenanceTacheService.getAll(0, 200);
      setTaches(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les tâches de maintenance. Vérifie que le serveur est bien lancé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredTaches = useMemo(() => {
    if (!searchTerm) return taches;
    return taches.filter((t) => t.nom?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [taches, searchTerm]);

  const handleRowClick = (tache) => {
    setSelectedTache((prev) => (prev?.id === tache.id ? null : tache));
  };

  const openCreate = () => {
    setSelectedTache(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedTache) return;
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (selectedTache) {
      await maintenanceTacheService.update(selectedTache.id, payload);
    } else {
      await maintenanceTacheService.create(payload);
    }
    setSelectedTache(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedTache || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer la tâche',
      message: `Supprimer la tâche "${selectedTache.nom}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await maintenanceTacheService.remove(selectedTache.id);
          setTaches((prev) => prev.filter((t) => t.id !== selectedTache.id));
          setSelectedTache(null);
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression de cette tâche.');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Nom'];
    const lignes = filteredTaches.map((t) => [(t.nom || '').replace(/"/g, '""')]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `taches-maintenance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert('Ouvre le dashboard des tâches de maintenance pour les statistiques détaillées.');
  };

  return (
    <div className="mtaches-container">

      <div className="mtaches-header-card">
        <div className="mtaches-header-title-box">
          <svg className="mtaches-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <h2>Tâches de maintenance</h2>
            <p className="mtaches-header-subtitle">Référentiel des tâches types réutilisables</p>
          </div>
        </div>
        <span className="mtaches-badge-total">Total : {filteredTaches.length}</span>
      </div>

      <div className="mtaches-actions-bar">
        <button className="mtaches-action-btn ajouter" onClick={openCreate}>
          <span className="mtaches-action-icon">+</span>
          <span>Ajouter</span>
        </button>

        <button
          className={`mtaches-action-btn modifier ${!selectedTache ? 'disabled' : ''}`}
          disabled={!selectedTache}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`mtaches-action-btn supprimer ${(!selectedTache || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedTache || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      <div className="mtaches-filter-panel">
        <div className="mtaches-filter-input-wrap">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Pile Export / Imprimer / Stats */}
        <div className="mtaches-export-stack">
          <button className="mtaches-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button className="mtaches-export-btn print" title="Imprimer" onClick={handlePrint}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM9 9V5a2 2 0 012-2h2a2 2 0 012 2v4M7 13h10" />
            </svg>
          </button>
          <button className="mtaches-export-btn stats" title="Statistiques" onClick={handleStats}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="mtaches-error-banner">{error}</div>}

      <div className="mtaches-table-wrap">
        <table className="mtaches-table">
          <thead>
            <tr>
              <th>Nom</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="mtaches-table-empty">Chargement...</td>
              </tr>
            ) : filteredTaches.length === 0 ? (
              <tr>
                <td className="mtaches-table-empty">
                  {taches.length === 0
                    ? "Aucune tâche pour l'instant. Ajoute la première avec le bouton ci-dessus."
                    : 'Aucune tâche ne correspond à cette recherche.'}
                </td>
              </tr>
            ) : (
              filteredTaches.map((t) => (
                <tr
                  key={t.id}
                  className={`mtaches-row ${selectedTache?.id === t.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(t)}
                >
                  <td style={{ fontWeight: 600 }}>{t.nom}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MaintenanceTacheModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        maintenanceTache={selectedTache}
        isEditing={!!selectedTache}
      />

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
}