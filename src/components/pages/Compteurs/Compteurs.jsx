import { useEffect, useMemo, useState } from 'react';
import compteurService from '../../../services/compteurService';
import CompteurModal from '../../ui/modals/Compteurmodal';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import { ChartColumn, Download, Printer, Search, SquarePen, Trash2 } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';
import './Compteurs.css';

const NATURE_LABELS = {
  0: 'Temps',
  1: 'Cycles',
  2: 'Distance',
};

function natureLabel(nature) {
  return NATURE_LABELS[nature] ?? `Code ${nature}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedCompteur || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le compteur',
      message: `Supprimer le compteur "${selectedCompteur.nom}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
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
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Nom', 'Unité', 'Nature'];
    const lignes = filteredCompteurs.map((c) => [
      (c.nom || '').replace(/"/g, '""'),
      (c.unite || '—').replace(/"/g, '""'),
      c.nature != null ? natureLabel(c.nature) : '—',
    ]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `compteurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert('Ouvre le dashboard des compteurs pour les statistiques détaillées.');
  };

  return (
    <div className="compteurs-container">

      <div className="compteurs-header-card">
        <div className="compteurs-header-title-box">
          <ICONES_MODULES.compteurs strokeWidth={2} className="compteurs-header-icon" aria-hidden="true" />
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
          <SquarePen size={18} strokeWidth={2} aria-hidden="true" />
          <span>Modifier</span>
        </button>

        <button
          className={`compteurs-action-btn supprimer ${(!selectedCompteur || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedCompteur || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      <div className="compteurs-filter-panel">
        <div className="compteurs-filter-group">
          <span className="compteurs-filter-label">Recherche</span>
          <div className="compteurs-filter-input-wrap">
            <Search strokeWidth={2} aria-hidden="true" />
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

        {/* Pile Export / Imprimer / Stats */}
        <div className="compteurs-export-stack">
          <button className="compteurs-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <Download size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button className="compteurs-export-btn print" title="Imprimer" onClick={handlePrint}>
            <Printer size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button className="compteurs-export-btn stats" title="Statistiques" onClick={handleStats}>
            <ChartColumn size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
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
                  onDoubleClick={() => { window.getSelection?.()?.removeAllRanges(); setSelectedCompteur(c); setModalOpen(true); }}
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