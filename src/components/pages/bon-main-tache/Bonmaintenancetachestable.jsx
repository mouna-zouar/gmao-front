import React, { useState, useEffect, useMemo } from 'react';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import './BonMaintenanceTachesTable.css';

const ETAT_OPTIONS = [
  { value: 1, label: 'Nouveau' },
  { value: 2, label: 'Suspendu' },
  { value: 3, label: 'En cours' },
  { value: 4, label: 'Effectué' },
  { value: 10, label: 'Annulé' },
];

const ETAT_BADGE_CLASS = {
  1: 'bmtt-badge--nouveau',
  2: 'bmtt-badge--suspendu',
  3: 'bmtt-badge--encours',
  4: 'bmtt-badge--termine',
  10: 'bmtt-badge--annule',
};

function etatLabel(etat) {
  if (etat == null) return '—';
  return ETAT_OPTIONS.find((o) => o.value === etat)?.label ?? `État ${etat}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

const PAGE_SIZE = 7;

export default function BonMaintenanceTachesTable() {
  const [taches, setTaches] = useState([]);
  const [bonsParId, setBonsParId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTache, setSelectedTache] = useState(null);

  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', confirmText: 'Confirmer', onConfirm: null, error: null, confirming: false,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tachesPage, bonsPage] = await Promise.all([
        bonMaintenanceTacheService.getAll(0, 500),
        bonMaintenanceService.getAll(0, 500),
      ]);

      setTaches(tachesPage.content ?? []);

      const map = {};
      (bonsPage.content ?? []).forEach((b) => { map[b.id] = b; });
      setBonsParId(map);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les tâches. Vérifie que le serveur est bien lancé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedTache && !taches.some((t) => t.id === selectedTache.id)) {
      setSelectedTache(null);
    }
  }, [taches, selectedTache]);

  const changerEtatTache = async (nouvelEtat) => {
    if (!selectedTache) return;
    setSavingId(selectedTache.id);
    try {
      const updated = await bonMaintenanceTacheService.update(selectedTache.id, {
        ...selectedTache,
        etat: nouvelEtat,
      });
      setTaches((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTache(updated);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Échec du changement d'état de la tâche.";
      setErrorModal({ show: true, title: "Changement d'état refusé", message });
    } finally {
      setSavingId(null);
    }
  };

  const handleDemarrer = () => changerEtatTache(3);
  const handleTerminer = () => changerEtatTache(4);

  const handleAnnuler = () => {
    if (!selectedTache) return;
    setConfirmModal({
      show: true,
      title: 'Annuler la tâche',
      message: `Annuler la tâche "${selectedTache.designation}" ?`,
      confirmText: 'Annuler la tâche',
      error: null,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setSavingId(selectedTache.id);
        try {
          const updated = await bonMaintenanceTacheService.update(selectedTache.id, {
            ...selectedTache,
            etat: 10,
          });
          setTaches((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setSelectedTache(updated);
          setConfirmModal((prev) => ({ ...prev, show: false, confirming: false }));
        } catch (err) {
          console.error(err);
          const message = err.response?.data?.message || "Échec de l'annulation de la tâche.";
          setConfirmModal((prev) => ({ ...prev, confirming: false, error: message }));
        } finally {
          setSavingId(null);
        }
      },
    });
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false, error: null, confirming: false }));

  const handleRowClick = (tache) => {
    setSelectedTache((prev) => (prev?.id === tache.id ? null : tache));
  };

  const availableStatuses = useMemo(() => {
    const set = new Set(taches.map((t) => t.etat).filter((s) => s != null));
    return Array.from(set).sort((a, b) => a - b);
  }, [taches]);

  const filteredTaches = useMemo(() => {
    return taches.filter((t) => {
      const bon = bonsParId[t.bonMaintenanceId];
      const bonNum = bon?.num?.toLowerCase() || '';
      const bonTitre = bon?.titre?.toLowerCase() || '';
      const designation = t.designation?.toLowerCase() || '';
      const terme = searchTerm.toLowerCase();

      const matchesSearch = !searchTerm
        || designation.includes(terme)
        || bonNum.includes(terme)
        || bonTitre.includes(terme);

      const matchesStatus = statusFilter === 'all' || String(t.etat) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [taches, searchTerm, statusFilter, bonsParId]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const totalPages = Math.max(1, Math.ceil(filteredTaches.length / PAGE_SIZE));

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);
  useEffect(() => { 
    if (currentPage > totalPages) setCurrentPage(totalPages); 
  }, [currentPage, totalPages]);

  const paginatedTaches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTaches.slice(start, start + PAGE_SIZE);
  }, [filteredTaches, currentPage]);

  const etatActuel = selectedTache?.etat;
  const peutDemarrer = selectedTache && etatActuel === 1;
  const peutTerminer = selectedTache && etatActuel === 3;
  const peutAnnuler = selectedTache && etatActuel !== 4 && etatActuel !== 10;
  const enCoursDeSauvegarde = savingId === selectedTache?.id;

  return (
    <div className="bmtt-container">

      <div className="bmtt-header-card">
        <div className="bmtt-header-title-box">
          <svg className="bmtt-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <h2>Tâches — tous bons de maintenance</h2>
            <p className="bmtt-header-subtitle">Suivi des tâches assignées aux bons de maintenance</p>
          </div>
        </div>
        <span className="bmtt-badge-total">Total : {filteredTaches.length}</span>
      </div>

      <div className="bmtt-actions-bar">
        <button
          className={`bmtt-action-btn demarrer ${(!peutDemarrer || enCoursDeSauvegarde) ? 'disabled' : ''}`}
          disabled={!peutDemarrer || enCoursDeSauvegarde}
          onClick={handleDemarrer}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
          </svg>
          <span>Démarrer</span>
        </button>

        <button
          className={`bmtt-action-btn terminer ${(!peutTerminer || enCoursDeSauvegarde) ? 'disabled' : ''}`}
          disabled={!peutTerminer || enCoursDeSauvegarde}
          onClick={handleTerminer}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span>Terminer</span>
        </button>

        <button
          className={`bmtt-action-btn annuler ${(!peutAnnuler || enCoursDeSauvegarde) ? 'disabled' : ''}`}
          disabled={!peutAnnuler || enCoursDeSauvegarde}
          onClick={handleAnnuler}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Annuler</span>
        </button>

        {selectedTache && (
          <span className="bmtt-selection-info">
            Sélectionnée : <strong>{selectedTache.designation}</strong> ({etatLabel(selectedTache.etat)})
          </span>
        )}
      </div>

      <div className="bmtt-filter-panel">
        <div className="bmtt-filter-group">
          <span className="bmtt-filter-label">Recherche</span>
          <div className="bmtt-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par désignation, numéro ou titre de bon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bmtt-filter-group">
          <span className="bmtt-filter-label">État</span>
          <div className="bmtt-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>{etatLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="bmtt-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>
      </div>

      {error && <div className="bmtt-error-banner">{error}</div>}

      <div className="bmtt-table-wrap">
        <table className="bmtt-table">
          <thead>
            <tr>
              <th>Bon de maintenance</th>
              <th>Désignation</th>
              <th>Début</th>
              <th>Fin</th>
              <th style={{ width: 80, textAlign: 'center' }}>Qté</th>
              <th style={{ width: 140 }}>État</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="bmtt-table-empty">Chargement...</td>
              </tr>
            ) : paginatedTaches.length === 0 ? (
              <tr>
                <td colSpan={6} className="bmtt-table-empty">
                  {taches.length === 0 
                    ? "Aucune tâche pour l'instant." 
                    : 'Aucune tâche ne correspond à ces filtres.'}
                </td>
              </tr>
            ) : (
              paginatedTaches.map((t) => {
                const bon = bonsParId[t.bonMaintenanceId];
                const isSelected = selectedTache?.id === t.id;
                return (
                  <tr
                    key={t.id}
                    className={`bmtt-row ${isSelected ? 'bmtt-row--selected' : ''}`}
                    onClick={() => handleRowClick(t)}
                  >
                    <td className="bmtt-bon-cell">
                      {bon ? (bon.num || bon.titre || `Bon #${bon.id}`) : `Bon #${t.bonMaintenanceId}`}
                    </td>
                    <td className="bmtt-designation-cell">{t.designation}</td>
                    <td>{formatDateTime(t.dateDebut)}</td>
                    <td>{formatDateTime(t.dateFin)}</td>
                    <td style={{ textAlign: 'center' }}>{t.qte ?? '—'}</td>
                    <td>
                      <span className={`bmtt-badge ${ETAT_BADGE_CLASS[t.etat] || ''}`}>
                        {etatLabel(t.etat)}
                        {savingId === t.id && ' ⏳'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredTaches.length > 0 && (
        <div className="bmtt-pagination">
          <span className="bmtt-pagination-info">
            Page {currentPage} / {totalPages} — {filteredTaches.length} tâche{filteredTaches.length > 1 ? 's' : ''}
          </span>
          <div className="bmtt-pagination-controls">
            <button
              type="button"
              className="bmtt-pagination-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ◀ Précédent
            </button>
            <button
              type="button"
              className="bmtt-pagination-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant ▶
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        error={confirmModal.error}
        confirming={confirmModal.confirming}
      />

      {errorModal.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setErrorModal({ show: false, title: '', message: '' })}>
          <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <svg width="48" height="48" className="modal-confirm-icon danger" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="confirm-modal-text">
                <h3>{errorModal.title}</h3>
                <p>{errorModal.message}</p>
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button
                type="button"
                className="confirm-btn primary danger"
                onClick={() => setErrorModal({ show: false, title: '', message: '' })}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}