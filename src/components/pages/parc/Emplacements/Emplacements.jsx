import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, Search, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Navigation, Home, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import emplacementService from '../../../../services/emplacementService';
import EmplacementModal from '../../../ui/modals/EmplacementModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './Emplacements.css';

/* Colonnes paramétrables (affichage + recherche) */
const EMP_COLUMNS_DEFAULT = [
  { key: 'nom',     label: 'Nom',     visible: true, searchable: true },
  { key: 'adresse', label: 'Adresse', visible: true, searchable: true },
];

export default function Emplacements() {
  const [emplacements, setEmplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(EMP_COLUMNS_DEFAULT);
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
      const page = await emplacementService.getAll(0, 200);
      setEmplacements(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les emplacements. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getColumnValue = (e, key) => {
    switch (key) {
      case 'nom':     return e.nom || '';
      case 'adresse': return e.adresse || '';
      default:        return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = emplacements.filter((e) => (
      !term || searchableCols.some((key) => getColumnValue(e, key).toLowerCase().includes(term))
    ));

    if (!sortColumn) return result;

    const sorted = [...result].sort((a, b) =>
      getColumnValue(a, sortColumn).localeCompare(getColumnValue(b, sortColumn), locale(), {
        sensitivity: 'base',
        numeric: true,
      })
    );
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [emplacements, searchTerm, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="emp-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="emp-sort-icon active" />
      : <ArrowDown size={13} className="emp-sort-icon active" />;
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

  const renderCell = (key, e) => {
    switch (key) {
      case 'nom':
        return (
          <td key="nom">
            <div className="emp-cell-name">
              <div className="emp-cell-name-icon">
                <Home size={14} strokeWidth={2.2} />
              </div>
              <span className="emp-cell-main">{e.nom || '—'}</span>
            </div>
          </td>
        );
      case 'adresse':
        return (
          <td key="adresse">
            {e.adresse ? (
              <div className="emp-cell-address">
                <Navigation size={13} strokeWidth={2.2} />
                <span>{e.adresse}</span>
              </div>
            ) : (
              <span className="emp-cell-empty">—</span>
            )}
          </td>
        );
      default:
        return null;
    }
  };

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
      title: t("Supprimer l'emplacement"),
      message: t('Supprimer « {nom} » ? Cette action est irréversible.', { nom: selected.nom || selected.adresse }),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await emplacementService.remove(selected.id);
          setEmplacements((prev) => prev.filter((e) => e.id !== selected.id));
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
    const entetes = ['Nom', 'Adresse'].map((e) => t(e));
    const lignes = filtered.map((e) => [
      (e.nom || '—'),
      (e.adresse || '—'),
    ]);
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
    a.download = `emplacements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Emplacements'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
      ],
    });
  };

  return (
    <div className="emp-container">

      <div className="emp-header-card">
        <div className="emp-header-left">
          <button
            type="button"
            className="emp-header-icon-wrap emp-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.emplacements size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Emplacements")}</h2>
            <p className="emp-header-subtitle">{t("Lieux et sites référencés")}</p>
          </div>
        </div>

        <div className="emp-stats">
          <div className="emp-stat">
            <span className="emp-stat-value">{filtered.length}</span>
            <span className="emp-stat-label">{t("Total")}</span>
          </div>
          <div className="emp-stat stat-adresses">
            <span className="emp-stat-value">
              {filtered.filter((e) => e.adresse).length}
            </span>
            <span className="emp-stat-label">{t("Avec adresse")}</span>
          </div>
        </div>
      </div>

      <div className="emp-actions-bar">
        <button className="emp-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Nouvel emplacement")}</span>
        </button>
        <button
          className={`emp-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>
        <button
          className={`emp-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
      </div>

      <div className="emp-filter-panel">
        <div className="emp-filter-group">
          <span className="emp-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="emp-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="emp-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button className="emp-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="emp-export-stack">
          <button className="emp-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="emp-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="emp-export-btn stats" onClick={() => alert(t("Dashboard à venir."))} title={t("Stats")}>
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
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`emp-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="emp-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="emp-table-empty">
                  <div className="emp-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="emp-spin" />
                    <span>{t("Chargement des emplacements...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="emp-table-empty">
                  <div className="emp-empty-state">
                    <MapPin size={32} strokeWidth={1.6} />
                    <span>
                      {emplacements.length === 0
                        ? t("Aucun emplacement pour l'instant.")
                        : t("Aucun emplacement ne correspond à ces filtres.")}
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
                  onDoubleClick={() => { window.getSelection?.()?.removeAllRanges(); setSelected(e); setModalOpen(true); }}
                  title={t('Double-clic pour ouvrir la fiche')}
                >
                  {visibleColumns.map((c) => renderCell(c.key, e))}
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

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="emplacement"
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