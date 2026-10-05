import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, Search, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Navigation, Home,
} from 'lucide-react';
import emplacementService from '../../../../services/emplacementService';
import EmplacementModal from '../../../ui/modals/EmplacementModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import './Emplacements.css';

export default function Emplacements() {
  const [emplacements, setEmplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: 'Confirmer', onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await emplacementService.getAll(0, 200);
      setEmplacements(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les emplacements. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return emplacements.filter((e) => {
      const haystack = [e.nom, e.adresse]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !searchTerm || haystack.includes(searchTerm.toLowerCase());
    });
  }, [emplacements, searchTerm]);

  const handleResetFilters = () => setSearchTerm('');

  const handleRowClick = (e) => {
    setSelected((prev) => (prev?.id === e.id ? null : e));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await emplacementService.update(selected.id, payload);
    else await emplacementService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: "Supprimer l'emplacement",
      message: `Supprimer "${selected.nom || selected.adresse}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await emplacementService.remove(selected.id);
          setEmplacements((prev) => prev.filter((e) => e.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Nom', 'Adresse'];
    const lignes = filtered.map((e) => [
      (e.nom || '—').replace(/"/g, '""'),
      (e.adresse || '—').replace(/"/g, '""'),
    ]);

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emplacements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="emp-container">

      <div className="emp-header-card">
        <div className="emp-header-left">
          <div className="emp-header-icon-wrap">
            <MapPin size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>Emplacements</h2>
            <p className="emp-header-subtitle">Lieux et sites référencés</p>
          </div>
        </div>

        <div className="emp-stats">
          <div className="emp-stat">
            <span className="emp-stat-value">{filtered.length}</span>
            <span className="emp-stat-label">Total</span>
          </div>
          <div className="emp-stat stat-adresses">
            <span className="emp-stat-value">
              {filtered.filter((e) => e.adresse).length}
            </span>
            <span className="emp-stat-label">Avec adresse</span>
          </div>
        </div>
      </div>

      <div className="emp-actions-bar">
        <button className="emp-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Nouvel emplacement</span>
        </button>
        <button
          className={`emp-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>
        <button
          className={`emp-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      <div className="emp-filter-panel">
        <div className="emp-filter-group">
          <span className="emp-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="emp-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="emp-filter-icon" />
            <input
              type="text"
              placeholder="Nom ou adresse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button className="emp-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="emp-export-stack">
          <button className="emp-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="emp-export-btn print" onClick={() => window.print()} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="emp-export-btn stats" onClick={() => alert('Dashboard à venir.')} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="emp-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      <div className="emp-table-wrap">
        <table className="emp-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Adresse</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="emp-table-empty">
                  <div className="emp-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="emp-spin" />
                    <span>Chargement des emplacements...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="emp-table-empty">
                  <div className="emp-empty-state">
                    <MapPin size={32} strokeWidth={1.6} />
                    <span>
                      {emplacements.length === 0
                        ? "Aucun emplacement pour l'instant."
                        : 'Aucun emplacement ne correspond à ces filtres.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className={`emp-row ${selected?.id === e.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(e)}
                >
                  <td>
                    <div className="emp-cell-name">
                      <div className="emp-cell-name-icon">
                        <Home size={14} strokeWidth={2.2} />
                      </div>
                      <span className="emp-cell-main">{e.nom || '—'}</span>
                    </div>
                  </td>
                  <td>
                    {e.adresse ? (
                      <div className="emp-cell-address">
                        <Navigation size={13} strokeWidth={2.2} />
                        <span>{e.adresse}</span>
                      </div>
                    ) : (
                      <span className="emp-cell-empty">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EmplacementModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        emplacement={selected}
        isEditing={!!selected}
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