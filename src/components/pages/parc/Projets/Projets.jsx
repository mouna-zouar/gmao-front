import { useEffect, useMemo, useState } from 'react';
import {
  FolderKanban, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Calendar, Building2, MapPin, CheckCircle2, XCircle,
  Activity, Hourglass, FileText,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import projetService from '../../../../services/projetService';
import prestataireService from '../../../../services/prestataireService';
import emplacementService from '../../../../services/emplacementService';
import ProjetModal from '../../../ui/modals/ProjetModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import './Projets.css';

const ETAT_LABELS = {
  0: 'Planifié',
  1: 'En cours',
  2: 'Terminé',
  3: 'Annulé',
};

const ETAT_META = {
  0: { class: 'planned', Icon: Hourglass },
  1: { class: 'running', Icon: Activity },
  2: { class: 'done', Icon: CheckCircle2 },
  3: { class: 'cancelled', Icon: XCircle },
};

/* Colonnes paramétrables (affichage + recherche) */
const PRJ_COLUMNS_DEFAULT = [
  { key: 'code',        label: 'Code',        visible: true, searchable: true  },
  { key: 'nom',         label: 'Nom',         visible: true, searchable: true  },
  { key: 'prestataire', label: 'Prestataire', visible: true, searchable: true  },
  { key: 'emplacement', label: 'Emplacement', visible: true, searchable: true  },
  { key: 'periode',     label: 'Période',     visible: true, searchable: false },
  { key: 'etat',        label: 'État',        visible: true, searchable: false },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function etatLabel(e) { return ETAT_LABELS[e] ?? `État ${e}`; }

export default function Projets() {
  const [projets, setProjets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(PRJ_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [prestatairesMap, setPrestatairesMap] = useState({});
  const [emplacementsMap, setEmplacementsMap] = useState({});

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
      const [page, prestPage, empoPage] = await Promise.all([
        projetService.getAll(0, 100),
        prestataireService.getAll(0, 500),
        emplacementService.getAll(0, 500),
      ]);

      setProjets(page.content ?? []);

      const prMap = {};
      (prestPage.content ?? []).forEach((p) => { prMap[p.id] = p; });
      setPrestatairesMap(prMap);

      const emMap = {};
      (empoPage.content ?? []).forEach((e) => { emMap[e.id] = e; });
      setEmplacementsMap(emMap);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les projets. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = projets.length;
    const planifies = projets.filter((p) => p.etat === 0).length;
    const enCours = projets.filter((p) => p.etat === 1).length;
    const termines = projets.filter((p) => p.etat === 2).length;
    return { total, planifies, enCours, termines };
  }, [projets]);

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (p, key) => {
    const prest = prestatairesMap[p.prestataireId];
    const empo = emplacementsMap[p.emplacementId];
    switch (key) {
      case 'code':        return p.code || '';
      case 'nom':         return [p.nom, p.description].filter(Boolean).join(' ');
      case 'prestataire': return [prest?.raisonSociale, prest?.nom].filter(Boolean).join(' ');
      case 'emplacement': return [empo?.nom, empo?.adresse].filter(Boolean).join(' ');
      case 'periode':     return `${formatDate(p.dateDebut)} ${formatDate(p.dateFin)}`;
      case 'etat':        return etatLabel(p.etat);
      default:            return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (p, key) => {
    const prest = prestatairesMap[p.prestataireId];
    const empo = emplacementsMap[p.emplacementId];
    const time = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);
    switch (key) {
      case 'code':        return p.code || '';
      case 'nom':         return p.nom || '';
      case 'prestataire': return prest?.raisonSociale || prest?.nom || '';
      case 'emplacement': return empo?.nom || empo?.adresse || '';
      case 'periode':     return time(p.dateDebut);
      case 'etat':        return Number(p.etat ?? -1);
      default:            return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = projets.filter((p) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(p, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(p.etat) === etatFilter;
      return matchesSearch && matchesEtat;
    });

    if (!sortColumn) return result;

    const sorted = [...result].sort((x, y) => {
      const vx = getSortValue(x, sortColumn);
      const vy = getSortValue(y, sortColumn);
      if (typeof vx === 'string') return vx.localeCompare(vy, 'fr', { sensitivity: 'base', numeric: true });
      return vx - vy;
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projets, searchTerm, etatFilter, prestatairesMap, emplacementsMap, columnSettings, sortColumn, sortDirection]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="prj-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="prj-sort-icon active" />
      : <ArrowDown size={13} className="prj-sort-icon active" />;
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

  const renderCell = (key, p) => {
    const prest = prestatairesMap[p.prestataireId];
    const empo = emplacementsMap[p.emplacementId];
    const meta = ETAT_META[p.etat] ?? ETAT_META[0];
    const EtatIcon = meta.Icon;

    switch (key) {
      case 'code':
        return (
          <td key="code">
            <span className="prj-cell-code">{p.code || '—'}</span>
          </td>
        );
      case 'nom':
        return (
          <td key="nom">
            <div className="prj-cell-project">
              <div className="prj-cell-project-icon">
                <FileText size={14} strokeWidth={2.2} />
              </div>
              <div className="prj-cell-project-text">
                <span className="prj-cell-main">{p.nom || '—'}</span>
                {p.description && (
                  <span className="prj-cell-sub">{p.description}</span>
                )}
              </div>
            </div>
          </td>
        );
      case 'prestataire':
        return (
          <td key="prestataire">
            {prest ? (
              <div className="prj-cell-presta">
                <Building2 size={14} strokeWidth={2.2} />
                <span>{prest.raisonSociale || prest.nom}</span>
              </div>
            ) : (
              <span className="prj-cell-empty">—</span>
            )}
          </td>
        );
      case 'emplacement':
        return (
          <td key="emplacement">
            {empo ? (
              <div className="prj-cell-emplacement">
                <MapPin size={14} strokeWidth={2.2} />
                <span>{empo.nom || empo.adresse}</span>
              </div>
            ) : (
              <span className="prj-cell-empty">—</span>
            )}
          </td>
        );
      case 'periode':
        return (
          <td key="periode">
            <div className="prj-cell-period">
              <span className="prj-period-badge start">
                <Calendar size={11} strokeWidth={2.5} />
                {formatDate(p.dateDebut)}
              </span>
              <span className="prj-period-sep">→</span>
              <span className="prj-period-badge end">
                <Calendar size={11} strokeWidth={2.5} />
                {formatDate(p.dateFin)}
              </span>
            </div>
          </td>
        );
      case 'etat':
        return (
          <td key="etat">
            <span className={`prj-pill ${meta.class}`}>
              <EtatIcon
                size={12}
                strokeWidth={2.5}
                className={p.etat === 1 ? 'prj-spin' : ''}
              />
              {etatLabel(p.etat)}
            </span>
          </td>
        );
      default:
        return null;
    }
  };

  const handleRowClick = (p) => {
    setSelected((prev) => (prev?.id === p.id ? null : p));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await projetService.update(selected.id, payload);
    else await projetService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le projet',
      message: `Supprimer le projet "${selected.nom || selected.code}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await projetService.remove(selected.id);
          setProjets((prev) => prev.filter((p) => p.id !== selected.id));
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
    const entetes = ['Code', 'Nom', 'Prestataire', 'Emplacement', 'Début', 'Fin', 'État'];
    const lignes = filtered.map((p) => {
      const prest = prestatairesMap[p.prestataireId];
      const empo = emplacementsMap[p.emplacementId];
      return [
        (p.code || '—').replace(/"/g, '""'),
        (p.nom || '—').replace(/"/g, '""'),
        (prest?.raisonSociale || prest?.nom || '—').replace(/"/g, '""'),
        (empo?.nom || empo?.adresse || '—').replace(/"/g, '""'),
        formatDate(p.dateDebut),
        formatDate(p.dateFin),
        etatLabel(p.etat),
      ];
    });

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleStats = () => alert('Dashboard à venir.');

  return (
    <div className="prj-container">

      {/* HEADER */}
      <div className="prj-header-card">
        <div className="prj-header-left">
          <button
            type="button"
            className="prj-header-icon-wrap prj-header-icon-btn"
            onClick={openColumnSettings}
            title="Paramètres des colonnes"
            aria-label="Paramètres des colonnes"
          >
            <FolderKanban size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>Projets</h2>
            <p className="prj-header-subtitle">Gestion des projets et leur affectation</p>
          </div>
        </div>

        <div className="prj-stats">
          <div className="prj-stat">
            <span className="prj-stat-value">{stats.total}</span>
            <span className="prj-stat-label">Total</span>
          </div>
          <div className="prj-stat stat-planned">
            <span className="prj-stat-value">{stats.planifies}</span>
            <span className="prj-stat-label">Planifiés</span>
          </div>
          <div className="prj-stat stat-running">
            <span className="prj-stat-value">{stats.enCours}</span>
            <span className="prj-stat-label">En cours</span>
          </div>
          <div className="prj-stat stat-done">
            <span className="prj-stat-value">{stats.termines}</span>
            <span className="prj-stat-label">Terminés</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="prj-actions-bar">
        <button className="prj-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Nouveau projet</span>
        </button>

        <button
          className={`prj-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>

        <button
          className={`prj-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="prj-filter-panel">
        <div className="prj-filter-group">
          <span className="prj-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="prj-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="prj-filter-icon" />
            <input
              type="text"
              placeholder="Rechercher dans les colonnes actives..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="prj-filter-group">
          <span className="prj-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            État
          </span>
          <div className="prj-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous les états</option>
              {Object.entries(ETAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="prj-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="prj-export-stack">
          <button className="prj-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="prj-export-btn print" onClick={handlePrint} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="prj-export-btn stats" onClick={handleStats} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="prj-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="prj-table-wrap">
        <table className="prj-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`prj-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={`Trier par ${c.label}`}
                >
                  <span className="prj-th-inner">
                    <span>{c.label}</span>
                    {renderSortIcon(c.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="prj-table-empty">
                  <div className="prj-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="prj-spin" />
                    <span>Chargement des projets...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="prj-table-empty">
                  <div className="prj-empty-state">
                    <FolderKanban size={32} strokeWidth={1.6} />
                    <span>
                      {projets.length === 0
                        ? "Aucun projet pour l'instant."
                        : 'Aucun projet ne correspond à ces filtres.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`prj-row ${selected?.id === p.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(p)}
                >
                  {visibleColumns.map((c) => renderCell(c.key, p))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <ProjetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        projet={selected}
        isEditing={!!selected}
      />

      {/* PARAMÈTRES DES COLONNES */}
      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="projet"
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