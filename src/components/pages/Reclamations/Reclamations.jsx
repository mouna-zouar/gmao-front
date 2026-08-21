import { useEffect, useMemo, useState } from 'react';
import reclamationService from '../../../services/reclamationService';
import ReclamationModal from '../../ui/modals/ReclamationModal';
import ReclamationDetailsModal from '../../ui/modals/ReclamationDetailsModal';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import './Reclamations.css';

const ETAT_LABELS = {
  0: 'Ouverte',
  1: 'En cours',
  2: 'Clôturée',
};

const ETAT_BADGE_CLASS = {
  0: 'reclamations-badge--ouverte',
  1: 'reclamations-badge--encours',
  2: 'reclamations-badge--cloturee',
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

  // Filtre
  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  // Pagination (côté client, sur la liste déjà filtrée)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Sélection + modal
  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Association bon de maintenance (modale)
  const [associateOpen, setAssociateOpen] = useState(false);

  // Détails (réclamation + bon de maintenance + immobilisation)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);

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

  // Revenir à la page 1 quand la recherche/le filtre change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, etatFilter]);

  // Si la page courante dépasse le nombre de pages disponibles (ex: après une suppression), on recale
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
      // Le backend crée et lie automatiquement le BonMaintenance à partir de
      // payload.lotArticleImmobilistationId (voir ReclamationServiceImpl.create).
      saved = await reclamationService.create(payload);
      if (saved.bonMaintenanceId) {
        alert(`Réclamation créée. Bon de maintenance associé généré (id ${saved.bonMaintenanceId}).`);
      }
    }

    setSelectedReclamation(null);
    await load();
  };

  const handleDelete = async () => {
    if (!selectedReclamation || isDeleting) return;
    if (!window.confirm(`Supprimer la réclamation "${selectedReclamation.num || selectedReclamation.id}" ?`)) return;

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
  };

  return (
    <div className="reclamations-container">

      <div className="reclamations-header-card">
        <div className="reclamations-header-title-box">
          <svg className="reclamations-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <h2>Réclamations</h2>
            <p className="reclamations-header-subtitle">
              Réclamations signalées, pouvant être associées à un ou plusieurs bons de maintenance
            </p>
          </div>
        </div>
        <span className="reclamations-badge-total">Total : {filteredReclamations.length}</span>
      </div>

      <div className="reclamations-actions-bar">
        <button className="reclamations-action-btn ajouter" onClick={openCreate}>
          <span className="reclamations-action-icon">+</span>
          <span>Ajouter</span>
        </button>

        <button
          className={`reclamations-action-btn modifier ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`reclamations-action-btn details ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openDetails}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>Détails</span>
        </button>

        <button
          className={`reclamations-action-btn associer ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openAssociate}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <span>Associer</span>
        </button>

        <button
          className={`reclamations-action-btn supprimer ${(!selectedReclamation || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      <div className="reclamations-filter-panel">
        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">Recherche</span>
          <div className="reclamations-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
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
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="0">Ouverte</option>
              <option value="1">En cours</option>
              <option value="2">Clôturée</option>
            </select>
          </div>
        </div>

        <button className="reclamations-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>
      </div>

      {error && <div className="reclamations-error-banner">{error}</div>}

      <div className="reclamations-table-wrap">
        <table className="reclamations-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Description</th>
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
                <td colSpan={7} className="reclamations-table-empty">Chargement...</td>
              </tr>
            ) : filteredReclamations.length === 0 ? (
              <tr>
                <td colSpan={7} className="reclamations-table-empty">
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
              Précédent
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
              Suivant
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
    </div>
  );
}