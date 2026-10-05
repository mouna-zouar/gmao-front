import { useEffect, useMemo, useState } from 'react';
import {
  Fuel, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Car, User, Calendar, Gauge, Coins,
} from 'lucide-react';
import vehiculeBonCarburantService from '../../../../services/vehiculeBonCarburantService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeBonCarburantModal from '../../../ui/modals/VehiculeBonCarburantModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import './VehiculeBonsCarburant.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMontant(v) {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formatKm(v) {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('fr-FR')} km`;
}

export default function VehiculeBonsCarburant() {
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [vehiculeFilter, setVehiculeFilter] = useState('all');

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
        vehiculeBonCarburantService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
      ]);

      setBons(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les bons carburant. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = bons.length;
    const montantTotal = bons.reduce((sum, b) => sum + (Number(b.montant) || 0), 0);
    const kmTotal = bons.reduce((sum, b) => sum + (Number(b.kilometrage) || 0), 0);
    const moisCourant = new Date().getMonth();
    const montantMois = bons
      .filter((b) => {
        const d = new Date(b.date);
        return !isNaN(d.getTime()) && d.getMonth() === moisCourant;
      })
      .reduce((sum, b) => sum + (Number(b.montant) || 0), 0);
    return { total, montantTotal, kmTotal, montantMois };
  }, [bons]);

  const filtered = useMemo(() => {
    return bons.filter((b) => {
      const veh = vehiculesMap[b.vehiculeId];
      const pers = personnelsMap[b.personnelId];

      const haystack = [
        veh?.matricule, veh?.marque,
        pers?.nom, pers?.prenom, pers?.matricule,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesVehicule = vehiculeFilter === 'all' || String(b.vehiculeId) === vehiculeFilter;

      return matchesSearch && matchesVehicule;
    });
  }, [bons, searchTerm, vehiculeFilter, vehiculesMap, personnelsMap]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setVehiculeFilter('all');
  };

  const handleRowClick = (b) => {
    setSelected((prev) => (prev?.id === b.id ? null : b));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await vehiculeBonCarburantService.update(selected.id, payload);
    else await vehiculeBonCarburantService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le bon carburant',
      message: `Supprimer ce bon carburant ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeBonCarburantService.remove(selected.id);
          setBons((prev) => prev.filter((b) => b.id !== selected.id));
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
    const entetes = ['Véhicule', 'Conducteur', 'Date', 'Montant (DT)', 'Kilométrage (km)'];
    const lignes = filtered.map((b) => {
      const veh = vehiculesMap[b.vehiculeId];
      const pers = personnelsMap[b.personnelId];
      return [
        (veh?.matricule || '—').replace(/"/g, '""'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—').replace(/"/g, '""'),
        formatDate(b.date),
        b.montant ?? '—',
        b.kilometrage ?? '—',
      ];
    });

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bons-carburant-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleStats = () => alert('Dashboard à venir.');

  return (
    <div className="vbc-container">

      {/* HEADER */}
      <div className="vbc-header-card">
        <div className="vbc-header-left">
          <div className="vbc-header-icon-wrap">
            <Fuel size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>Bons carburant</h2>
            <p className="vbc-header-subtitle">
              Suivi des pleins de carburant par véhicule et conducteur
            </p>
          </div>
        </div>

        <div className="vbc-stats">
          <div className="vbc-stat">
            <span className="vbc-stat-value">{stats.total}</span>
            <span className="vbc-stat-label">Total</span>
          </div>
          <div className="vbc-stat stat-amount">
            <span className="vbc-stat-value">{formatMontant(stats.montantTotal)}</span>
            <span className="vbc-stat-label">Montant</span>
          </div>
          <div className="vbc-stat stat-month">
            <span className="vbc-stat-value">{formatMontant(stats.montantMois)}</span>
            <span className="vbc-stat-label">Ce mois</span>
          </div>
          <div className="vbc-stat stat-km">
            <span className="vbc-stat-value">{Number(stats.kmTotal).toLocaleString('fr-FR')}</span>
            <span className="vbc-stat-label">km cumulés</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vbc-actions-bar">
        <button className="vbc-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Nouveau bon</span>
        </button>

        <button
          className={`vbc-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>

        <button
          className={`vbc-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="vbc-filter-panel">
        <div className="vbc-filter-group">
          <span className="vbc-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="vbc-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vbc-filter-icon" />
            <input
              type="text"
              placeholder="Véhicule, conducteur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vbc-filter-group">
          <span className="vbc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            Véhicule
          </span>
          <div className="vbc-filter-input-wrap">
            <select value={vehiculeFilter} onChange={(e) => setVehiculeFilter(e.target.value)}>
              <option value="all">Tous les véhicules</option>
              {Object.values(vehiculesMap).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricule || `Véhicule #${v.id}`}{v.marque ? ` — ${v.marque}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="vbc-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="vbc-export-stack">
          <button className="vbc-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vbc-export-btn print" onClick={handlePrint} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vbc-export-btn stats" onClick={handleStats} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vbc-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vbc-table-wrap">
        <table className="vbc-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Conducteur</th>
              <th>Date</th>
              <th>Montant</th>
              <th>Kilométrage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="vbc-table-empty">
                  <div className="vbc-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vbc-spin" />
                    <span>Chargement des bons...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="vbc-table-empty">
                  <div className="vbc-empty-state">
                    <Fuel size={32} strokeWidth={1.6} />
                    <span>
                      {bons.length === 0
                        ? "Aucun bon carburant pour l'instant."
                        : 'Aucun bon ne correspond à ces filtres.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const veh = vehiculesMap[b.vehiculeId];
                const pers = personnelsMap[b.personnelId];
                return (
                  <tr
                    key={b.id}
                    className={`vbc-row ${selected?.id === b.id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(b)}
                  >
                    <td>
                      <div className="vbc-cell-vehicle">
                        <div className="vbc-cell-vehicle-icon">
                          <Car size={14} strokeWidth={2.2} />
                        </div>
                        <div className="vbc-cell-vehicle-text">
                          <span className="vbc-cell-main">
                            {veh?.matricule || `Véhicule #${b.vehiculeId}`}
                          </span>
                          {veh?.marque && (
                            <span className="vbc-cell-sub">{veh.marque}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      {pers ? (
                        <div className="vbc-cell-driver">
                          <div className="vbc-cell-driver-avatar">
                            <User size={14} strokeWidth={2.2} />
                          </div>
                          <div className="vbc-cell-driver-text">
                            <span className="vbc-cell-main">
                              {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                            </span>
                            {pers.matricule && (
                              <span className="vbc-cell-sub">{pers.matricule}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="vbc-cell-empty">—</span>
                      )}
                    </td>

                    <td>
                      <span className="vbc-cell-date">
                        <Calendar size={12} strokeWidth={2.5} />
                        {formatDate(b.date)}
                      </span>
                    </td>

                    <td>
                      <span className="vbc-cell-amount">
                        <Coins size={13} strokeWidth={2.5} />
                        {formatMontant(b.montant)}
                      </span>
                    </td>

                    <td>
                      <span className="vbc-cell-km">
                        <Gauge size={13} strokeWidth={2.5} />
                        {formatKm(b.kilometrage)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <VehiculeBonCarburantModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        bonCarburant={selected}
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