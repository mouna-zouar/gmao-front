import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Link,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import reclamationService from '../../../services/reclamationService';
import ReclamationModal from '../../ui/modals/ReclamationModal';
import ReclamationDetailsModal from '../../ui/modals/ReclamationDetailsModal';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import './Reclamations.css';

const ETAT_LABELS = {
  0: 'Ouverte',
  1: 'En cours',
  2: 'Clôturée',
  3: 'En attente de validation',
  4: 'Rejetée',
};

const ETAT_BADGE_CLASS = {
  0: 'reclamations-badge--ouverte',
  1: 'reclamations-badge--encours',
  2: 'reclamations-badge--cloturee',
  3: 'reclamations-badge--attente',
  4: 'reclamations-badge--rejetee',
};

const NIVEAU_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Élevée',
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ?? `État ${etat}`;
}

function niveauLabel(niveau) {
  if (niveau == null) return '—';
  return NIVEAU_LABELS[niveau] ?? `Niveau ${niveau}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Reclamations() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [associateOpen, setAssociateOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: 'Confirmer',
    onConfirm: null,
  });

  const [rejetModal, setRejetModal] = useState({ show: false, motif: '' });
  const [validating, setValidating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await reclamationService.getAll(0, 100);
      setReclamations(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les réclamations. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredReclamations = useMemo(() => {
    return reclamations.filter((r) => {
      const matchesSearch = !searchTerm
        || r.description?.toLowerCase().includes(searchTerm.toLowerCase())
        || r.num?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEtat = etatFilter === 'all' || String(r.etat) === etatFilter;

      return matchesSearch && matchesEtat;
    });
  }, [reclamations, searchTerm, etatFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReclamations.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, etatFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedReclamations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReclamations.slice(start, start + pageSize);
  }, [filteredReclamations, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) {
      range.push(i);
    }
    return range;
  }, [totalPages]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleRowClick = (reclamation) => {
    setSelectedReclamation((prev) => (prev?.id === reclamation.id ? null : reclamation));
  };

  const openCreate = () => {
    setSelectedReclamation(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedReclamation) return;
    setModalOpen(true);
  };

  const openAssociate = () => {
    if (!selectedReclamation) return;
    setAssociateOpen(true);
  };

  const openDetails = async () => {
    if (!selectedReclamation) return;
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const data = await reclamationService.getWithBonMaintenance(selectedReclamation.id);
      setDetailsData(data);
    } catch (err) {
      console.error('Erreur chargement des détails :', err);
      alert('Impossible de charger les détails de cette réclamation.');
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSave = async (payload) => {
    let saved;
    if (selectedReclamation) {
      saved = await reclamationService.update(selectedReclamation.id, payload);
    } else {
      saved = await reclamationService.create(payload);
      if (saved.bonMaintenanceId) {
        alert(`Réclamation créée. Bon de maintenance associé généré (id ${saved.bonMaintenanceId}).`);
      }
    }

    setSelectedReclamation(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedReclamation || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer la réclamation',
      message: `Supprimer la réclamation "${selectedReclamation.num || selectedReclamation.id}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await reclamationService.remove(selectedReclamation.id);
          setReclamations((prev) => prev.filter((r) => r.id !== selectedReclamation.id));
          setSelectedReclamation(null);
        } catch (err) {
          console.error(err);
          alert("Échec de la suppression de cette réclamation.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleValider = async () => {
    if (!selectedReclamation || validating) return;
    setValidating(true);
    try {
      const updated = await reclamationService.valider(selectedReclamation.id, {});
      alert(updated.bonMaintenanceId
        ? `Réclamation validée. Bon de maintenance lié (id ${updated.bonMaintenanceId}).`
        : 'Réclamation validée.');
      setSelectedReclamation(null);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec de la validation.');
    } finally {
      setValidating(false);
    }
  };

  const openRejetModal = () => {
    if (!selectedReclamation) return;
    setRejetModal({ show: true, motif: '' });
  };

  const confirmRejeter = async () => {
    const motif = rejetModal.motif.trim();
    if (!motif || !selectedReclamation) return;
    setRejetModal({ show: false, motif: '' });
    setValidating(true);
    try {
      await reclamationService.rejeter(selectedReclamation.id, { motifRejet: motif });
      setSelectedReclamation(null);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec du rejet.');
    } finally {
      setValidating(false);
    }
  };

  const handleExportExcel = () => {
    const entetes = ['Numéro', 'Description', 'Criticité', 'Urgence', 'Personnel affecté', 'Date', 'État'];
    const lignes = filteredReclamations.map((r) => [
      r.num || '',
      (r.description || '').replace(/"/g, '""'),
      niveauLabel(r.criticite),
      niveauLabel(r.urgence),
      r.personnelAffecte
        ? `${r.personnelAffecte.nom ?? ''} ${r.personnelAffecte.prenom ?? ''}`.trim()
        : (r.personnelAffecteNom || ''),
      formatDate(r.date),
      etatLabel(r.etat),
    ]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `reclamations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert('Ouvre le dashboard des réclamations pour les statistiques détaillées.');
  };

  return (
    <div className="reclamations-container">

      <div className="reclamations-header-card">
        <div className="reclamations-header-title-box">
          <div className="reclamations-header-icon">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2>Réclamations</h2>
            <p className="reclamations-header-subtitle">
              Gestion des réclamations
            </p>
          </div>
        </div>
        <span className="reclamations-badge-total">Total : {filteredReclamations.length}</span>
      </div>

      <div className="reclamations-actions-bar">
        <button className="reclamations-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} />
          <span>Ajouter</span>
        </button>

        <button
          className={`reclamations-action-btn modifier ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openEdit}
        >
          <Edit size={18} />
          <span>Modifier</span>
        </button>

        <button
          className={`reclamations-action-btn details ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openDetails}
        >
          <Eye size={18} />
          <span>Détails</span>
        </button>

        <button
          className={`reclamations-action-btn associer ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openAssociate}
        >
          <Link size={18} />
          <span>Associer</span>
        </button>

        <div className="reclamations-actions-divider" />

        <button
          className={`reclamations-action-btn valider ${(!selectedReclamation || validating) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || validating}
          onClick={handleValider}
        >
          <CheckCircle size={18} />
          <span>Valider</span>
        </button>

        <button
          className={`reclamations-action-btn rejeter ${(!selectedReclamation || validating) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || validating}
          onClick={openRejetModal}
        >
          <XCircle size={18} />
          <span>Rejeter</span>
        </button>

        <button
          className={`reclamations-action-btn supprimer ${(!selectedReclamation || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} />
          <span>Supprimer</span>
        </button>
      </div>

      <div className="reclamations-filter-panel">
        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">Recherche</span>
          <div className="reclamations-filter-input-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Rechercher par description ou numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">État</span>
          <div className="reclamations-filter-input-wrap">
            <Filter size={16} />
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="0">Ouverte</option>
              <option value="1">En cours</option>
              <option value="2">Clôturée</option>
              <option value="3">En attente de validation</option>
              <option value="4">Rejetée</option>
            </select>
          </div>
        </div>

        <button className="reclamations-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>

        <div className="reclamations-export-stack">
          <button className="reclamations-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="reclamations-export-btn print" title="Imprimer" onClick={handlePrint}>
            <Printer size={18} />
          </button>
          <button className="reclamations-export-btn stats" title="Statistiques" onClick={handleStats}>
            <BarChart3 size={18} />
          </button>
        </div>
      </div>

      {error && <div className="reclamations-error-banner">{error}</div>}

      <div className="reclamations-table-wrap">
        <table className="reclamations-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Description</th>
              <th>Service</th>
              <th>Criticité</th>
              <th>Urgence</th>
              <th>Personnel affecté</th>
              <th>Date</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="reclamations-table-empty">Chargement...</td>
              </tr>
            ) : filteredReclamations.length === 0 ? (
              <tr>
                <td colSpan={8} className="reclamations-table-empty">
                  {reclamations.length === 0
                    ? "Aucune réclamation pour l'instant. Ajoute la première avec le bouton ci-dessus."
                    : "Aucune réclamation ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              paginatedReclamations.map((r) => (
                <tr
                  key={r.id}
                  className={`reclamations-row ${selectedReclamation?.id === r.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(r)}
                >
                  <td style={{ fontWeight: 600 }}>{r.num || '—'}</td>
                  <td className="reclamations-desc-cell">{r.description}</td>
                  <td>{r.serviceNom || r.service?.description || '—'}</td>
                  <td>{niveauLabel(r.criticite)}</td>
                  <td>{niveauLabel(r.urgence)}</td>
                  <td>
                    {r.personnelAffecte
                      ? `${r.personnelAffecte.nom ?? ''} ${r.personnelAffecte.prenom ?? ''}`.trim()
                      : (r.personnelAffecteNom || '—')}
                  </td>
                  <td>{formatDate(r.date)}</td>
                  <td>
                    <span className={`reclamations-badge ${ETAT_BADGE_CLASS[r.etat] || ''}`}>
                      {etatLabel(r.etat)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredReclamations.length > 0 && (
        <div className="reclamations-pagination">
          <span className="reclamations-pagination-info">
            {filteredReclamations.length} résultat{filteredReclamations.length > 1 ? 's' : ''}
            {' — page '}{currentPage}{' / '}{totalPages}
          </span>

          <div className="reclamations-pagination-controls">
            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>

            {paginationRange.map((p) => (
              <button
                key={p}
                type="button"
                className={`reclamations-pagination-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <ReclamationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        reclamation={selectedReclamation}
        isEditing={!!selectedReclamation}
      />

      <ReclamationDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        loading={detailsLoading}
        data={detailsData}
      />

      <AssociateBonMaintenanceModal
        isOpen={associateOpen}
        onClose={() => setAssociateOpen(false)}
        reclamation={selectedReclamation}
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

      {rejetModal.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setRejetModal({ show: false, motif: '' })}>
          <div className="confirm-modal-container rejet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <XCircle className="modal-confirm-icon danger" size={48} strokeWidth={2} />
              </div>
              <div className="confirm-modal-text">
                <h3>Rejeter la réclamation</h3>
                <p>Indique le motif du rejet.</p>
                <textarea
                  className="confirm-modal-input"
                  value={rejetModal.motif}
                  onChange={(e) => setRejetModal((p) => ({ ...p, motif: e.target.value }))}
                  placeholder="Motif de rejet..."
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button type="button" className="confirm-btn secondary" onClick={() => setRejetModal({ show: false, motif: '' })}>
                Annuler
              </button>
              <button
                type="button"
                className="confirm-btn primary danger"
                onClick={confirmRejeter}
                disabled={!rejetModal.motif.trim()}
              >
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}