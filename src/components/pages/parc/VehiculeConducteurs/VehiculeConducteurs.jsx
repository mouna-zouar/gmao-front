import { useEffect, useMemo, useState } from 'react';
import {
  UserCheck, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Car, User, Calendar, Settings2, Info,
} from 'lucide-react';
import vehiculeConducteurService from '../../../../services/vehiculeConducteurService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeConducteurModal from '../../../ui/modals/VehiculeConducteurModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import './VehiculeConducteurs.css';

const MODE_LABELS = {
  0: 'Principal',
  1: 'Secondaire',
  2: 'Temporaire',
  3: 'Remplacement',
};

function modeLabel(mode) {
  return MODE_LABELS[mode] ?? `Mode ${mode}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function VehiculeConducteurs() {
  const [affectations, setAffectations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('all');

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});

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
      const [page, vehPage, persPage] = await Promise.all([
        vehiculeConducteurService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
      ]);

      setAffectations(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les affectations. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Stats basées UNIQUEMENT sur les champs du DTO
  const stats = useMemo(() => {
    const total = affectations.length;
    const principaux = affectations.filter((a) => a.modeAffectation === 0).length;
    const temporaires = affectations.filter((a) => a.modeAffectation === 2).length;
    const remplacements = affectations.filter((a) => a.modeAffectation === 3).length;
    return { total, principaux, temporaires, remplacements };
  }, [affectations]);

  const filtered = useMemo(() => {
    return affectations.filter((a) => {
      const veh = vehiculesMap[a.vehiculeId];
      const pers = personnelsMap[a.personnelId];

      const haystack = [
        veh?.matricule, veh?.marque, veh?.numChassis,
        pers?.nom, pers?.prenom, pers?.matricule,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesMode = modeFilter === 'all' || String(a.modeAffectation) === modeFilter;

      return matchesSearch && matchesMode;
    });
  }, [affectations, searchTerm, modeFilter, vehiculesMap, personnelsMap]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setModeFilter('all');
  };

  const handleRowClick = (a) => {
    setSelected((prev) => (prev?.id === a.id ? null : a));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await vehiculeConducteurService.update(selected.id, payload);
    else await vehiculeConducteurService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: "Supprimer l'affectation",
      message: `Supprimer cette affectation véhicule / conducteur ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeConducteurService.remove(selected.id);
          setAffectations((prev) => prev.filter((a) => a.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert("Échec de la suppression de cette affectation.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Véhicule', 'Marque', 'Conducteur', 'Matricule', "Date d'affectation", "Mode d'affectation"];
    const lignes = filtered.map((a) => {
      const veh = vehiculesMap[a.vehiculeId];
      const pers = personnelsMap[a.personnelId];
      return [
        (veh?.matricule || '—').replace(/"/g, '""'),
        (veh?.marque || '—').replace(/"/g, '""'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—').replace(/"/g, '""'),
        (pers?.matricule || '—').replace(/"/g, '""'),
        formatDateTime(a.dateAffectation),
        modeLabel(a.modeAffectation),
      ];
    });

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicule-conducteurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleStats = () => alert('Dashboard à venir.');

  return (
    <div className="vcd-container">

      {/* HEADER */}
      <div className="vcd-header-card">
        <div className="vcd-header-left">
          <div className="vcd-header-icon-wrap">
            <UserCheck size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>Véhicules / Conducteurs</h2>
            <p className="vcd-header-subtitle">
              Historique des affectations de conducteurs aux véhicules
            </p>
          </div>
        </div>

        <div className="vcd-stats">
          <div className="vcd-stat">
            <span className="vcd-stat-value">{stats.total}</span>
            <span className="vcd-stat-label">Total</span>
          </div>
          <div className="vcd-stat stat-active">
            <span className="vcd-stat-value">{stats.principaux}</span>
            <span className="vcd-stat-label">Principaux</span>
          </div>
          <div className="vcd-stat stat-principal">
            <span className="vcd-stat-value">{stats.temporaires}</span>
            <span className="vcd-stat-label">Temporaires</span>
          </div>
          <div className="vcd-stat stat-inactive">
            <span className="vcd-stat-value">{stats.remplacements}</span>
            <span className="vcd-stat-label">Remplacements</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vcd-actions-bar">
        <button className="vcd-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Affecter</span>
        </button>

        <button
          className={`vcd-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>

        <button
          className={`vcd-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="vcd-filter-panel">
        <div className="vcd-filter-group">
          <span className="vcd-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="vcd-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vcd-filter-icon" />
            <input
              type="text"
              placeholder="Véhicule, conducteur, matricule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vcd-filter-group">
          <span className="vcd-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            Mode
          </span>
          <div className="vcd-filter-input-wrap">
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">Tous les modes</option>
              {Object.entries(MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vcd-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="vcd-export-stack">
          <button className="vcd-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vcd-export-btn print" onClick={handlePrint} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vcd-export-btn stats" onClick={handleStats} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vcd-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vcd-table-wrap">
        <table className="vcd-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Conducteur</th>
              <th>Date d'affectation</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="vcd-table-empty">
                  <div className="vcd-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vcd-spin" />
                    <span>Chargement des affectations...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="vcd-table-empty">
                  <div className="vcd-empty-state">
                    <UserCheck size={32} strokeWidth={1.6} />
                    <span>
                      {affectations.length === 0
                        ? "Aucune affectation pour l'instant."
                        : "Aucune affectation ne correspond à ces filtres."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const veh = vehiculesMap[a.vehiculeId];
                const pers = personnelsMap[a.personnelId];

                const modeNum = Number(a.modeAffectation);
                const modeCls = modeNum === 0 ? 'principal' : modeNum === 1 ? 'secondary' : modeNum === 2 ? 'temporary' : 'replacement';

                return (
                  <tr
                    key={a.id}
                    className={`vcd-row ${selected?.id === a.id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(a)}
                  >
                    <td>
                      <div className="vcd-cell-vehicle">
                        <div className="vcd-cell-vehicle-icon">
                          <Car size={14} strokeWidth={2.2} />
                        </div>
                        <div className="vcd-cell-vehicle-text">
                          <span className="vcd-cell-main">
                            {veh?.matricule || `Véhicule #${a.vehiculeId}`}
                          </span>
                          {veh?.marque && (
                            <span className="vcd-cell-sub">{veh.marque}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      {pers ? (
                        <div className="vcd-cell-driver">
                          <div className="vcd-cell-driver-avatar">
                            <User size={14} strokeWidth={2.2} />
                          </div>
                          <div className="vcd-cell-driver-text">
                            <span className="vcd-cell-main">
                              {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                            </span>
                            {pers.matricule && (
                              <span className="vcd-cell-sub">{pers.matricule}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="vcd-cell-empty">—</span>
                      )}
                    </td>

                    <td>
                      <span className="vcd-date-badge">
                        <Calendar size={11} strokeWidth={2.5} />
                        {formatDateTime(a.dateAffectation)}
                      </span>
                    </td>

                    <td>
                      <span className={`vcd-pill ${modeCls}`}>
                        <Settings2 size={11} strokeWidth={2.5} />
                        {modeLabel(a.modeAffectation)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <VehiculeConducteurModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        vehiculeConducteur={selected}
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