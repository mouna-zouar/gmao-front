import { useEffect, useMemo, useState } from 'react';
import compteurService from '../../../services/compteurService';
import CompteurModal from '../../ui/modals/Compteurmodal';
import './Compteurs.css';

const NATURE_LABELS = {
  0: 'Temps',
  1: 'Cycles',
  2: 'Distance',
};

function natureLabel(nature) {
  return NATURE_LABELS[nature] ?? `Code ${nature}`;
}

export default function Compteurs() {
  const [compteurs, setCompteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [natureFilter, setNatureFilter] = useState('all');

  const [selectedCompteur, setSelectedCompteur] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await compteurService.getAll(0, 100);
      setCompteurs(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les compteurs. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const availableNatures = useMemo(() => {
    const set = new Set(compteurs.map((c) => c.nature).filter((n) => n != null));
    return Array.from(set).sort((a, b) => a - b);
  }, [compteurs]);

  const filteredCompteurs = useMemo(() => {
    return compteurs.filter((c) => {
      const matchesSearch = !searchTerm
        || c.nom?.toLowerCase().includes(searchTerm.toLowerCase())
        || c.unite?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesNature = natureFilter === 'all' || String(c.nature) === natureFilter;

      return matchesSearch && matchesNature;
    });
  }, [compteurs, searchTerm, natureFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setNatureFilter('all');
  };

  const handleRowClick = (compteur) => {
    setSelectedCompteur((prev) => (prev?.id === compteur.id ? null : compteur));
  };

  const openCreate = () => {
    setSelectedCompteur(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedCompteur) return;
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (selectedCompteur) {
      await compteurService.update(selectedCompteur.id, payload);
    } else {
      await compteurService.create(payload);
    }
    setSelectedCompteur(null);
    await load();
  };

  const handleDelete = async () => {
    if (!selectedCompteur || isDeleting) return;
    if (!window.confirm(`Supprimer le compteur "${selectedCompteur.nom}" ?`)) return;

    setIsDeleting(true);
    try {
      await compteurService.remove(selectedCompteur.id);
      setCompteurs((prev) => prev.filter((c) => c.id !== selectedCompteur.id));
      setSelectedCompteur(null);
    } catch (err) {
      console.error(err);
      alert("Échec de la suppression de ce compteur.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="compteurs-container">

      <div className="compteurs-header-card">
        <div className="compteurs-header-title-box">
          <svg className="compteurs-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h2>Compteurs</h2>
            <p className="compteurs-header-subtitle">
              Unités de mesure suivies sur les équipements (heures, cycles, distance...)
            </p>
          </div>
        </div>
        <span className="compteurs-badge-total">Total : {filteredCompteurs.length}</span>
      </div>

      <div className="compteurs-actions-bar">
        <button className="compteurs-action-btn ajouter" onClick={openCreate}>
          <span className="compteurs-action-icon">+</span>
          <span>Ajouter</span>
        </button>

        <button
          className={`compteurs-action-btn modifier ${!selectedCompteur ? 'disabled' : ''}`}
          disabled={!selectedCompteur}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`compteurs-action-btn supprimer ${(!selectedCompteur || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedCompteur || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      <div className="compteurs-filter-panel">
        <div className="compteurs-filter-group">
          <span className="compteurs-filter-label">Recherche</span>
          <div className="compteurs-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par nom ou unité..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="compteurs-filter-group">
          <span className="compteurs-filter-label">Nature</span>
          <div className="compteurs-filter-input-wrap">
            <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)}>
              <option value="all">Toutes</option>
              {availableNatures.map((n) => (
                <option key={n} value={n}>{natureLabel(n)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="compteurs-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>
      </div>

      {error && <div className="compteurs-error-banner">{error}</div>}

      <div className="compteurs-table-wrap">
        <table className="compteurs-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Unité</th>
              <th>Nature</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="compteurs-table-empty">Chargement...</td>
              </tr>
            ) : filteredCompteurs.length === 0 ? (
              <tr>
                <td colSpan={3} className="compteurs-table-empty">
                  {compteurs.length === 0
                    ? "Aucun compteur pour l'instant. Ajoute le premier avec le bouton ci-dessus."
                    : "Aucun compteur ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              filteredCompteurs.map((c) => (
                <tr
                  key={c.id}
                  className={`compteurs-row ${selectedCompteur?.id === c.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(c)}
                >
                  <td style={{ fontWeight: 600 }}>{c.nom}</td>
                  <td>{c.unite || '—'}</td>
                  <td>{c.nature != null ? natureLabel(c.nature) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CompteurModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        compteur={selectedCompteur}
        isEditing={!!selectedCompteur}
      />
    </div>
  );
}