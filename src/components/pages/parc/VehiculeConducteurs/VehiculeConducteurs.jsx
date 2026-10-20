import { useEffect, useMemo, useState } from 'react';
import {
  UserCheck, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Car, User, Calendar, Settings2, Info, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeConducteurService from '../../../../services/vehiculeConducteurService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeConducteurModal from '../../../ui/modals/VehiculeConducteurModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './VehiculeConducteurs.css';

const MODE_LABELS = {
  0: 'Principal',
  1: 'Secondaire',
  2: 'Temporaire',
  3: 'Remplacement',
};

function modeLabel(mode) {
  // Libellé traduit : la recherche, le tableau et l'export suivent la langue choisie
  return MODE_LABELS[mode] ? t(MODE_LABELS[mode]) : t('Mode {n}', { n: mode });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* Colonnes paramétrables (affichage + recherche) */
const VC_COLUMNS_DEFAULT = [
  { key: 'vehicule',   label: 'Véhicule',          visible: true, searchable: true  },
  { key: 'conducteur', label: 'Conducteur',        visible: true, searchable: true  },
  { key: 'date',       label: "Date d'affectation", visible: true, searchable: false },
  { key: 'mode',       label: 'Mode',              visible: true, searchable: false },
];

export default function VehiculeConducteurs() {
  const [affectations, setAffectations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('all');

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(VC_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

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
      setError(t("Impossible de charger les affectations. Vérifie que le serveur est bien lancé."));
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

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (a, key) => {
    const veh = vehiculesMap[a.vehiculeId];
    const pers = personnelsMap[a.personnelId];
    switch (key) {
      case 'vehicule':   return [veh?.matricule, veh?.marque, veh?.numChassis].filter(Boolean).join(' ');
      case 'conducteur': return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'date':       return formatDateTime(a.dateAffectation);
      case 'mode':       return modeLabel(a.modeAffectation);
      default:           return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (a, key) => {
    const veh = vehiculesMap[a.vehiculeId];
    const pers = personnelsMap[a.personnelId];
    switch (key) {
      case 'vehicule':   return veh?.matricule || '';
      case 'conducteur': return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'date':       return a.dateAffectation ? new Date(a.dateAffectation).getTime() : 0;
      case 'mode':       return Number(a.modeAffectation ?? -1);
      default:           return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = affectations.filter((a) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(a, key).toLowerCase().includes(term));
      const matchesMode = modeFilter === 'all' || String(a.modeAffectation) === modeFilter;
      return matchesSearch && matchesMode;
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
  }, [affectations, searchTerm, modeFilter, vehiculesMap, personnelsMap, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="vcd-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="vcd-sort-icon active" />
      : <ArrowDown size={13} className="vcd-sort-icon active" />;
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

  const renderCell = (key, a) => {
    const veh = vehiculesMap[a.vehiculeId];
    const pers = personnelsMap[a.personnelId];

    switch (key) {
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vcd-cell-vehicle">
              <div className="vcd-cell-vehicle-icon">
                <Car size={14} strokeWidth={2.2} />
              </div>
              <div className="vcd-cell-vehicle-text">
                <span className="vcd-cell-main">
                  {veh?.matricule || t('Véhicule #{id}', { id: a.vehiculeId })}
                </span>
                {veh?.marque && <span className="vcd-cell-sub">{veh.marque}</span>}
              </div>
            </div>
          </td>
        );
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers ? (
              <div className="vcd-cell-driver">
                <div className="vcd-cell-driver-avatar">
                  <User size={14} strokeWidth={2.2} />
                </div>
                <div className="vcd-cell-driver-text">
                  <span className="vcd-cell-main">
                    {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                  </span>
                  {pers.matricule && <span className="vcd-cell-sub">{pers.matricule}</span>}
                </div>
              </div>
            ) : (
              <span className="vcd-cell-empty">—</span>
            )}
          </td>
        );
      case 'date':
        return (
          <td key="date">
            <span className="vcd-date-badge">
              <Calendar size={11} strokeWidth={2.5} />
              {formatDateTime(a.dateAffectation)}
            </span>
          </td>
        );
      case 'mode': {
        const modeNum = Number(a.modeAffectation);
        const modeCls = modeNum === 0 ? 'principal' : modeNum === 1 ? 'secondary' : modeNum === 2 ? 'temporary' : 'replacement';
        return (
          <td key="mode">
            <span className={`vcd-pill ${modeCls}`}>
              <Settings2 size={11} strokeWidth={2.5} />
              {modeLabel(a.modeAffectation)}
            </span>
          </td>
        );
      }
      default:
        return null;
    }
  };

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
      title: t("Supprimer l'affectation"),
      message: t('Supprimer cette affectation véhicule / conducteur ? Cette action est irréversible.'),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeConducteurService.remove(selected.id);
          setAffectations((prev) => prev.filter((a) => a.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression de cette affectation."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Véhicule', 'Marque', 'Conducteur', 'Matricule', "Date d'affectation", "Mode d'affectation"].map((e) => t(e));
    const lignes = filtered.map((a) => {
      const veh = vehiculesMap[a.vehiculeId];
      const pers = personnelsMap[a.personnelId];
      return [
        (veh?.matricule || '—'),
        (veh?.marque || '—'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        (pers?.matricule || '—'),
        formatDateTime(a.dateAffectation),
        modeLabel(a.modeAffectation),
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
    a.download = `vehicule-conducteurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Véhicules / Conducteurs'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('Mode'), valeur: modeFilter !== 'all' ? modeLabel(Number(modeFilter)) : '' },
      ],
    });
  };

  const handleStats = () => alert(t("Dashboard à venir."));

  return (
    <div className="vcd-container">

      {/* HEADER */}
      <div className="vcd-header-card">
        <div className="vcd-header-left">
          <button
            type="button"
            className="vcd-header-icon-wrap vcd-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.conducteurs size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Véhicules / Conducteurs")}</h2>
            <p className="vcd-header-subtitle">
              {t("Historique des affectations de conducteurs aux véhicules")}
            </p>
          </div>
        </div>

        <div className="vcd-stats">
          <div className="vcd-stat">
            <span className="vcd-stat-value">{stats.total}</span>
            <span className="vcd-stat-label">{t("Total")}</span>
          </div>
          <div className="vcd-stat stat-active">
            <span className="vcd-stat-value">{stats.principaux}</span>
            <span className="vcd-stat-label">{t("Principaux")}</span>
          </div>
          <div className="vcd-stat stat-principal">
            <span className="vcd-stat-value">{stats.temporaires}</span>
            <span className="vcd-stat-label">{t("Temporaires")}</span>
          </div>
          <div className="vcd-stat stat-inactive">
            <span className="vcd-stat-value">{stats.remplacements}</span>
            <span className="vcd-stat-label">{t("Remplacements")}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vcd-actions-bar">
        <button className="vcd-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Affecter")}</span>
        </button>

        <button
          className={`vcd-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vcd-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="vcd-filter-panel">
        <div className="vcd-filter-group">
          <span className="vcd-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="vcd-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vcd-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vcd-filter-group">
          <span className="vcd-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("Mode")}
          </span>
          <div className="vcd-filter-input-wrap">
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">{t("Tous les modes")}</option>
              {Object.entries(MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vcd-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="vcd-export-stack">
          <button className="vcd-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vcd-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vcd-export-btn stats" onClick={handleStats} title={t("Stats")}>
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
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`vcd-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="vcd-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="vcd-table-empty">
                  <div className="vcd-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vcd-spin" />
                    <span>{t("Chargement des affectations...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vcd-table-empty">
                  <div className="vcd-empty-state">
                    <UserCheck size={32} strokeWidth={1.6} />
                    <span>
                      {affectations.length === 0
                        ? t("Aucune affectation pour l'instant.")
                        : t("Aucune affectation ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr
                  key={a.id}
                  className={`vcd-row ${selected?.id === a.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(a)}
                >
                  {visibleColumns.map((c) => renderCell(c.key, a))}
                </tr>
              ))
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

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="vehiculeConducteur"
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