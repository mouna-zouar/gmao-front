import { useEffect, useMemo, useState } from 'react';
import {
  Fuel, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Car, User, Calendar, Gauge, Coins,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeBonCarburantService from '../../../../services/vehiculeBonCarburantService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeBonCarburantModal from '../../../ui/modals/VehiculeBonCarburantModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './VehiculeBonsCarburant.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMontant(v) {
  if (v == null) return '—';
  return t('{montant} DT', { montant: Number(v).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

function formatKm(v) {
  if (v == null) return '—';
  return t('{n} km', { n: Number(v).toLocaleString(locale()) });
}

/* Colonnes paramétrables (affichage + recherche) */
const VBC_COLUMNS_DEFAULT = [
  { key: 'vehicule',    label: 'Véhicule',     visible: true, searchable: true  },
  { key: 'conducteur',  label: 'Conducteur',   visible: true, searchable: true  },
  { key: 'date',        label: 'Date',         visible: true, searchable: false },
  { key: 'montant',     label: 'Montant',      visible: true, searchable: false },
  { key: 'kilometrage', label: 'Kilométrage',  visible: true, searchable: false },
];

export default function VehiculeBonsCarburant() {
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [vehiculeFilter, setVehiculeFilter] = useState('all');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(VBC_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: t("Confirmer"), onConfirm: null,
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
      setError(t("Impossible de charger les bons carburant. Vérifie que le serveur est bien lancé."));
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

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (b, key) => {
    const veh = vehiculesMap[b.vehiculeId];
    const pers = personnelsMap[b.personnelId];
    switch (key) {
      case 'vehicule':    return [veh?.matricule, veh?.marque].filter(Boolean).join(' ');
      case 'conducteur':  return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'date':        return formatDate(b.date);
      case 'montant':     return b.montant != null ? String(b.montant) : '';
      case 'kilometrage': return b.kilometrage != null ? String(b.kilometrage) : '';
      default:            return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (b, key) => {
    const veh = vehiculesMap[b.vehiculeId];
    const pers = personnelsMap[b.personnelId];
    switch (key) {
      case 'vehicule':    return veh?.matricule || '';
      case 'conducteur':  return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'date':        return b.date ? new Date(b.date).getTime() || 0 : 0;
      case 'montant':     return Number(b.montant ?? -1);
      case 'kilometrage': return Number(b.kilometrage ?? -1);
      default:            return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = bons.filter((b) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(b, key).toLowerCase().includes(term));
      const matchesVehicule = vehiculeFilter === 'all' || String(b.vehiculeId) === vehiculeFilter;
      return matchesSearch && matchesVehicule;
    });

    if (!sortColumn) return result;

    const sorted = [...result].sort((x, y) => {
      const vx = getSortValue(x, sortColumn);
      const vy = getSortValue(y, sortColumn);
      if (typeof vx === 'string') return vx.localeCompare(vy, locale(), { sensitivity: 'base', numeric: true });
      return vx - vy;
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bons, searchTerm, vehiculeFilter, vehiculesMap, personnelsMap, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="vbc-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="vbc-sort-icon active" />
      : <ArrowDown size={13} className="vbc-sort-icon active" />;
  };

  const openColumnSettings = () => {
    setColumnSettingsInstanceKey((k) => k + 1);
    setShowColumnSettings(true);
  };

  const toggleColumnVisibility = (key) => {
    setColumnSettings((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  const toggleColumnSearchability = (key) => {
    setColumnSettings((prev) => prev.map((c) => (c.key === key ? { ...c, searchable: !c.searchable } : c)));
  };

  const visibleColumns = columnSettings.filter((c) => c.visible);

  const renderCell = (key, b) => {
    const veh = vehiculesMap[b.vehiculeId];
    const pers = personnelsMap[b.personnelId];

    switch (key) {
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vbc-cell-vehicle">
              <div className="vbc-cell-vehicle-icon">
                <Car size={14} strokeWidth={2.2} />
              </div>
              <div className="vbc-cell-vehicle-text">
                <span className="vbc-cell-main">
                  {veh?.matricule || t('Véhicule #{id}', { id: b.vehiculeId })}
                </span>
                {veh?.marque && <span className="vbc-cell-sub">{veh.marque}</span>}
              </div>
            </div>
          </td>
        );
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers ? (
              <div className="vbc-cell-driver">
                <div className="vbc-cell-driver-avatar">
                  <User size={14} strokeWidth={2.2} />
                </div>
                <div className="vbc-cell-driver-text">
                  <span className="vbc-cell-main">
                    {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                  </span>
                  {pers.matricule && <span className="vbc-cell-sub">{pers.matricule}</span>}
                </div>
              </div>
            ) : (
              <span className="vbc-cell-empty">—</span>
            )}
          </td>
        );
      case 'date':
        return (
          <td key="date">
            <span className="vbc-cell-date">
              <Calendar size={12} strokeWidth={2.5} />
              {formatDate(b.date)}
            </span>
          </td>
        );
      case 'montant':
        return (
          <td key="montant">
            <span className="vbc-cell-amount">
              <Coins size={13} strokeWidth={2.5} />
              {formatMontant(b.montant)}
            </span>
          </td>
        );
      case 'kilometrage':
        return (
          <td key="kilometrage">
            <span className="vbc-cell-km">
              <Gauge size={13} strokeWidth={2.5} />
              {formatKm(b.kilometrage)}
            </span>
          </td>
        );
      default:
        return null;
    }
  };

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
      title: t("Supprimer le bon carburant"),
      message: t('Supprimer ce bon carburant ? Cette action est irréversible.'),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeBonCarburantService.remove(selected.id);
          setBons((prev) => prev.filter((b) => b.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Véhicule', 'Conducteur', 'Date', 'Montant (DT)', 'Kilométrage (km)'].map((e) => t(e));
    const lignes = filtered.map((b) => {
      const veh = vehiculesMap[b.vehiculeId];
      const pers = personnelsMap[b.personnelId];
      return [
        (veh?.matricule || '—'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        formatDate(b.date),
        b.montant ?? '—',
        b.kilometrage ?? '—',
      ];
    });
    return { entetes, lignes };
  };

  const handleExportExcel = () => {
    const { entetes, lignes } = donneesTableau();

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
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

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Bons carburant'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('Véhicule'), valeur: vehiculeFilter !== 'all' ? (vehiculesMap[vehiculeFilter]?.matricule || t('Véhicule #{id}', { id: vehiculeFilter })) : '' },
      ],
    });
  };

  const handleStats = () => alert(t("Dashboard à venir."));

  return (
    <div className="vbc-container">

      {/* HEADER */}
      <div className="vbc-header-card">
        <div className="vbc-header-left">
          <button
            type="button"
            className="vbc-header-icon-wrap vbc-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.carburant size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Bons carburant")}</h2>
            <p className="vbc-header-subtitle">
              {t("Suivi des pleins de carburant par véhicule et conducteur")}
            </p>
          </div>
        </div>

        <div className="vbc-stats">
          <div className="vbc-stat">
            <span className="vbc-stat-value">{stats.total}</span>
            <span className="vbc-stat-label">{t("Total")}</span>
          </div>
          <div className="vbc-stat stat-amount">
            <span className="vbc-stat-value">{formatMontant(stats.montantTotal)}</span>
            <span className="vbc-stat-label">{t("Montant")}</span>
          </div>
          <div className="vbc-stat stat-month">
            <span className="vbc-stat-value">{formatMontant(stats.montantMois)}</span>
            <span className="vbc-stat-label">{t("Ce mois")}</span>
          </div>
          <div className="vbc-stat stat-km">
            <span className="vbc-stat-value">{Number(stats.kmTotal).toLocaleString(locale())}</span>
            <span className="vbc-stat-label">{t("km cumulés")}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vbc-actions-bar">
        <button className="vbc-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Nouveau bon")}</span>
        </button>

        <button
          className={`vbc-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vbc-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="vbc-filter-panel">
        <div className="vbc-filter-group">
          <span className="vbc-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="vbc-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vbc-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vbc-filter-group">
          <span className="vbc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("Véhicule")}
          </span>
          <div className="vbc-filter-input-wrap">
            <select value={vehiculeFilter} onChange={(e) => setVehiculeFilter(e.target.value)}>
              <option value="all">{t("Tous les véhicules")}</option>
              {Object.values(vehiculesMap).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricule || t('Véhicule #{id}', { id: v.id })}{v.marque ? ` — ${v.marque}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="vbc-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="vbc-export-stack">
          <button className="vbc-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vbc-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vbc-export-btn stats" onClick={handleStats} title={t("Stats")}>
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
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`vbc-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="vbc-th-inner">
                    <span>{t(c.label)}</span>
                    {renderSortIcon(c.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vbc-table-empty">
                  <div className="vbc-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vbc-spin" />
                    <span>{t("Chargement des bons...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vbc-table-empty">
                  <div className="vbc-empty-state">
                    <Fuel size={32} strokeWidth={1.6} />
                    <span>
                      {bons.length === 0
                        ? t("Aucun bon carburant pour l'instant.")
                        : t("Aucun bon ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr
                  key={b.id}
                  className={`vbc-row ${selected?.id === b.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(b)}
                  onDoubleClick={() => { window.getSelection?.()?.removeAllRanges(); setSelected(b); setModalOpen(true); }}
                  title={t('Double-clic pour ouvrir la fiche')}
                >
                  {visibleColumns.map((c) => renderCell(c.key, b))}
                </tr>
              ))
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

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="bonCarburant"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
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