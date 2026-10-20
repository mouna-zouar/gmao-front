import { useEffect, useMemo, useState } from 'react';
import {
  IdCard, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  User, Calendar, CheckCircle2, XCircle, CreditCard, X,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import permisConduiteService from '../../../../services/permisConduiteService';
import personnelService from '../../../../services/personnelService';
import PermisConduiteModal from '../../../ui/modals/PermisConduiteModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe, imprimerFiche } from '../../../../utils/imprimerListe';
import './PermisConduite.css';

// Référentiel de secours des catégories (au cas où l'appel API échoue avant chargement).
const CATEGORIE_LABELS = {
  A1: 'A1', A: 'A', B: 'B', B_E: 'B+E', C: 'C', C_E: 'C+E', D: 'D', D_E: 'D+E', F: 'F',
};

function categorieLabel(code) {
  return CATEGORIE_LABELS[code] ?? code;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isExpire(dateExpiration) {
  if (!dateExpiration) return false;
  const d = new Date(dateExpiration);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/* Colonnes paramétrables (affichage + recherche) */
const PC_COLUMNS_DEFAULT = [
  { key: 'conducteur', label: 'Conducteur',  visible: true, searchable: true  },
  { key: 'numero',     label: 'N° permis',   visible: true, searchable: true  },
  { key: 'categories', label: 'Catégories',  visible: true, searchable: false },
  { key: 'delivrance', label: 'Délivrance',  visible: true, searchable: true  },
  { key: 'expiration', label: 'Expiration',  visible: true, searchable: false },
  { key: 'statut',     label: 'Statut',      visible: true, searchable: false },
];

export default function PermisConduite() {
  const [permis, setPermis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');

  const [personnelsMap, setPersonnelsMap] = useState({});

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(PC_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Popup détails du permis ────────────────────────────────────────
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPermis, setDetailsPermis] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: t("Confirmer"), onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, persPage] = await Promise.all([
        permisConduiteService.getAll(0, 200),
        personnelService.getAll(0, 500),
      ]);

      setPermis(page.content ?? []);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les permis de conduite. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── Échap ferme la popup détails ───────────────────────────────────
  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setDetailsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsOpen]);

  const stats = useMemo(() => {
    const total = permis.length;
    const valides = permis.filter((p) => !isExpire(p.dateExpiration)).length;
    const expires = permis.filter((p) => isExpire(p.dateExpiration)).length;
    const poidsLourd = permis.filter((p) =>
      (p.categories ?? []).some((c) => ['C', 'C_E', 'D', 'D_E'].includes(c))
    ).length;
    return { total, valides, expires, poidsLourd };
  }, [permis]);

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (p, key) => {
    const pers = personnelsMap[p.personnelId];
    switch (key) {
      case 'conducteur': return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'numero':     return p.numero || '';
      case 'categories': return (p.categories ?? []).map(categorieLabel).join(' ');
      case 'delivrance': return [formatDate(p.dateDelivrance), p.lieuDelivrance].filter(Boolean).join(' ');
      case 'expiration': return p.dateExpiration ? formatDate(p.dateExpiration) : t("Sans expiration");
      case 'statut':     return isExpire(p.dateExpiration) ? t("Expiré") : t("Valide");
      default:           return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (p, key) => {
    const pers = personnelsMap[p.personnelId];
    switch (key) {
      case 'conducteur': return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'numero':     return p.numero || '';
      case 'categories': return (p.categories ?? []).map(categorieLabel).join(' ');
      case 'delivrance': return p.dateDelivrance ? new Date(p.dateDelivrance).getTime() : 0;
      case 'expiration': return p.dateExpiration ? new Date(p.dateExpiration).getTime() : Number.MAX_SAFE_INTEGER;
      case 'statut':     return isExpire(p.dateExpiration) ? 1 : 0;
      default:           return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = permis.filter((p) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(p, key).toLowerCase().includes(term));
      const matchesCategorie = categorieFilter === 'all' || (p.categories ?? []).includes(categorieFilter);
      const expire = isExpire(p.dateExpiration);
      const matchesStatut =
        statutFilter === 'all' ||
        (statutFilter === 'valide' && !expire) ||
        (statutFilter === 'expire' && expire);

      return matchesSearch && matchesCategorie && matchesStatut;
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
  }, [permis, searchTerm, categorieFilter, statutFilter, personnelsMap, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="pc-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="pc-sort-icon active" />
      : <ArrowDown size={13} className="pc-sort-icon active" />;
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
    const pers = personnelsMap[p.personnelId];
    const expire = isExpire(p.dateExpiration);

    switch (key) {
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers ? (
              <div className="pc-cell-driver">
                <div className="pc-cell-driver-avatar">
                  <User size={14} strokeWidth={2.2} />
                </div>
                <div className="pc-cell-driver-text">
                  <span className="pc-cell-main">
                    {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                  </span>
                  {pers.matricule && <span className="pc-cell-sub">{pers.matricule}</span>}
                </div>
              </div>
            ) : (
              <span className="pc-cell-empty">—</span>
            )}
          </td>
        );
      case 'numero':
        return (
          <td key="numero">
            <span className="pc-cell-main">{p.numero || '—'}</span>
          </td>
        );
      case 'categories':
        return (
          <td key="categories">
            <div className="pc-cat-list">
              {(p.categories ?? []).length === 0 ? (
                <span className="pc-cell-empty">—</span>
              ) : (
                (p.categories ?? []).map((c) => (
                  <span key={c} className="pc-cat-chip">{categorieLabel(c)}</span>
                ))
              )}
            </div>
          </td>
        );
      case 'delivrance':
        return (
          <td key="delivrance">
            <span className="pc-date-badge">
              <Calendar size={11} strokeWidth={2.5} />
              {formatDate(p.dateDelivrance)}
            </span>
          </td>
        );
      case 'expiration':
        return (
          <td key="expiration">
            <span className="pc-date-badge">
              <Calendar size={11} strokeWidth={2.5} />
              {p.dateExpiration ? formatDate(p.dateExpiration) : t("Sans expiration")}
            </span>
          </td>
        );
      case 'statut':
        return (
          <td key="statut">
            <span className={`pc-pill ${expire ? 'expire' : 'valide'}`}>
              {expire ? (
                <XCircle size={11} strokeWidth={2.5} />
              ) : (
                <CheckCircle2 size={11} strokeWidth={2.5} />
              )}
              {expire ? t("Expiré") : t("Valide")}
            </span>
          </td>
        );
      default:
        return null;
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategorieFilter('all');
    setStatutFilter('all');
  };

  const handleRowClick = (p) => {
    setSelected((prev) => (prev?.id === p.id ? null : p));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const openDetails = (p) => {
    setDetailsPermis(p);
    setDetailsOpen(true);
  };

  const handleViewDetails = () => {
    if (selected) openDetails(selected);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    // petite temporisation pour éviter le flash pendant l'animation de sortie
    setTimeout(() => setDetailsPermis(null), 220);
  };

  const handleSave = async (payload) => {
    if (selected) await permisConduiteService.update(selected.id, payload);
    else await permisConduiteService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer le permis"),
      message: t("Supprimer ce permis de conduire ? Cette action est irréversible."),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await permisConduiteService.remove(selected.id);
          setPermis((prev) => prev.filter((p) => p.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression de ce permis."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Conducteur', 'Matricule', 'Numéro permis', 'Catégories', 'Date délivrance', "Date d'expiration", 'Lieu', 'Statut'].map((e) => t(e));
    const lignes = filtered.map((p) => {
      const pers = personnelsMap[p.personnelId];
      const expire = isExpire(p.dateExpiration);
      return [
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        (pers?.matricule || '—'),
        (p.numero || '—'),
        (p.categories ?? []).map(categorieLabel).join(' / '),
        formatDate(p.dateDelivrance),
        p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration'),
        (p.lieuDelivrance || '—'),
        expire ? t('Expiré') : t('Valide'),
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
    a.download = `permis-conduite-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Permis de conduire'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('Catégorie'), valeur: categorieFilter !== 'all' ? categorieLabel(categorieFilter) : '' },
        { label: t('Statut'), valeur: statutFilter === 'valide' ? t('Valide') : statutFilter === 'expire' ? t('Expiré') : '' },
      ],
    });
  };

  // Impression de la fiche du permis affiché (A4 portrait)
  const handlePrint = () => {
    const p = detailsPermis || selected;
    if (!p) return;
    const pers = personnelsMap[p.personnelId];
    const expire = isExpire(p.dateExpiration);
    imprimerFiche({
      titre: pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : t('Permis de conduire'),
      sousTitre: t('Permis de conduire'),
      reference: p.numero || '',
      statut: expire ? t('Expiré') : t('Valide'),
      sections: [
        {
          titre: t('Informations générales'),
          champs: [
            { label: t('Conducteur'), valeur: pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '' },
            { label: t('Matricule'), valeur: pers?.matricule },
            { label: t('Numéro permis'), valeur: p.numero },
            { label: t('Catégories'), valeur: (p.categories ?? []).map(categorieLabel).join(' · ') },
            { label: t('Date délivrance'), valeur: p.dateDelivrance ? formatDate(p.dateDelivrance) : '' },
            { label: t('Lieu'), valeur: p.lieuDelivrance },
            { label: t("Date d'expiration"), valeur: p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration') },
            { label: t('Statut'), valeur: expire ? t('Expiré') : t('Valide') },
          ],
        },
      ],
      signatures: [t('Responsable parc'), t('Conducteur')],
    });
  };
  const handleStats = () => alert(t("Dashboard à venir."));

  // ════════════════════════════════════════════════════════════════
  //  RENDU
  // ════════════════════════════════════════════════════════════════
  const detailsPers = detailsPermis ? personnelsMap[detailsPermis.personnelId] : null;
  const detailsExpire = detailsPermis ? isExpire(detailsPermis.dateExpiration) : false;

  return (
    <div className="pc-container">

      {/* HEADER */}
      <div className="pc-header-card">
        <div className="pc-header-left">
          <button
            type="button"
            className="pc-header-icon-wrap pc-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.permis size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Permis de conduire")}</h2>
            <p className="pc-header-subtitle">
              {t("Suivi des permis des conducteurs et de leurs catégories (réglementation tunisienne)")}
            </p>
          </div>
        </div>

        <div className="pc-stats">
          <div className="pc-stat">
            <span className="pc-stat-value">{stats.total}</span>
            <span className="pc-stat-label">{t("Total")}</span>
          </div>
          <div className="pc-stat stat-active">
            <span className="pc-stat-value">{stats.valides}</span>
            <span className="pc-stat-label">{t("Valides")}</span>
          </div>
          <div className="pc-stat stat-inactive">
            <span className="pc-stat-value">{stats.expires}</span>
            <span className="pc-stat-label">{t("Expirés")}</span>
          </div>
          <div className="pc-stat stat-principal">
            <span className="pc-stat-value">{stats.poidsLourd}</span>
            <span className="pc-stat-label">{t("Poids lourd / bus")}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="pc-actions-bar">
        <button className="pc-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Ajouter")}</span>
        </button>

        <button
          className={`pc-action-btn details ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={handleViewDetails}
          style={{
            color: '#0284c7',
            borderColor: 'rgba(2, 132, 199, 0.2)',
          }}
        >
          <CreditCard size={18} strokeWidth={2.2} />
          <span>{t("Voir le permis")}</span>
        </button>

        <button
          className={`pc-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`pc-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="pc-filter-panel">
        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="pc-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="pc-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("Catégorie")}
          </span>
          <div className="pc-filter-input-wrap">
            <select value={categorieFilter} onChange={(e) => setCategorieFilter(e.target.value)}>
              <option value="all">{t("Toutes les catégories")}</option>
              {Object.entries(CATEGORIE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("Statut")}
          </span>
          <div className="pc-filter-input-wrap">
            <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
              <option value="all">{t("Tous les statuts")}</option>
              <option value="valide">{t("Valide")}</option>
              <option value="expire">{t("Expiré")}</option>
            </select>
          </div>
        </div>

        <button className="pc-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="pc-export-stack">
          <button className="pc-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="pc-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="pc-export-btn stats" onClick={handleStats} title={t("Stats")}>
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="pc-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`pc-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="pc-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="pc-table-empty">
                  <div className="pc-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="pc-spin" />
                    <span>{t("Chargement des permis...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="pc-table-empty">
                  <div className="pc-empty-state">
                    <IdCard size={32} strokeWidth={1.6} />
                    <span>
                      {permis.length === 0
                        ? t("Aucun permis de conduire pour l'instant.")
                        : t("Aucun permis ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`pc-row ${selected?.id === p.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(p)}
                  onDoubleClick={() => openDetails(p)}
                >
                  {visibleColumns.map((c) => renderCell(c.key, p))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          POPUP DÉTAILS — Permis format tunisien 3D
          ═══════════════════════════════════════════════════════════ */}
      {detailsOpen && detailsPermis && (
        <div
          className="pcd-overlay"
          onClick={closeDetails}
          role="dialog"
          aria-modal="true"
          aria-label={t("Détails du permis de conduire")}
        >
          <div
            className="pcd-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barre d'actions de la popup */}
            <div className="pcd-modal-bar">
              <div className="pcd-modal-bar-left">
                <CreditCard size={16} strokeWidth={2.4} />
                <span>{t("Permis de conduire")}</span>
              </div>
              <div className="pcd-modal-bar-right">
                <button
                  type="button"
                  className="pcd-modal-btn"
                  onClick={() => {
                    setSelected(detailsPermis);
                    setTimeout(() => setModalOpen(true), 0);
                  }}
                  title={t("Modifier ce permis")}
                >
                  <Pencil size={14} strokeWidth={2.4} />
                  {t("Modifier")}
                </button>
                <button
                  type="button"
                  className="pcd-modal-btn"
                  onClick={handlePrint}
                  title={t("Imprimer")}
                >
                  <Printer size={14} strokeWidth={2.4} />
                  {t("Imprimer")}
                </button>
                <button
                  type="button"
                  className="pcd-modal-close"
                  onClick={closeDetails}
                  aria-label={t("Fermer")}
                >
                  <X size={18} strokeWidth={2.6} />
                </button>
              </div>
            </div>

            {/* Scène 3D */}
            <div className="pcd-permis-stage">
              <div className="pcd-permis-3d">
                <div className="pcd-permis">
                  <div className="pcd-permis-face">

                    {/* ─── EN-TÊTE ─── */}
                    <div className="pcd-permis-header">
                      <div className="pcd-header-fr">
                        <div className="pcd-country-fr">REPUBLIQUE TUNISIENNE</div>
                        <div className="pcd-title-fr">PERMIS DE CONDUIRE</div>
                      </div>

                      <div className="pcd-flag">
                        <div className="pcd-flag-circle">
                          <span className="pcd-flag-crescent">☪</span>
                          <span className="pcd-flag-star">★</span>
                        </div>
                      </div>

                      <div className="pcd-header-ar">
                        <div className="pcd-country-ar">الجمهورية التونسية</div>
                        <div className="pcd-title-ar">رخصة سياقة</div>
                      </div>
                    </div>

                    {/* ─── CORPS ─── */}
                    <div className="pcd-permis-body">

                      {/* Photo */}
                      <div className="pcd-photo-col">
                        <div className="pcd-photo">
                          {detailsPers ? (
                            <div className="pcd-photo-initials">
                              {(detailsPers.nom?.[0] || '').toUpperCase()}
                              {(detailsPers.prenom?.[0] || '').toUpperCase()}
                            </div>
                          ) : (
                            <User size={40} strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="pcd-photo-footer">
                          <div className="pcd-photo-badge">
                            <span className="pcd-photo-badge-icon">🅱</span>
                          </div>
                        </div>
                      </div>

                      {/* Lignes */}
                      <div className="pcd-lines">

                        <div className="pcd-line">
                          <span className="pcd-line-num">1.</span>
                          <span className="pcd-line-fr">
                            <strong>{detailsPers?.nom || '—'}</strong>
                            {detailsPers?.prenom ? ` ${detailsPers.prenom}` : ''}
                          </span>
                          <span className="pcd-line-ar">بن فلان</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">2.</span>
                          <span className="pcd-line-fr">
                            <strong>{detailsPers?.prenom || '—'}</strong>
                          </span>
                          <span className="pcd-line-ar">فلان</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">3.</span>
                          <span className="pcd-line-fr">
                            <strong>{detailsPers?.lieuNaissance || detailsPermis.lieuDelivrance || '—'}</strong>
                            <span className="pcd-line-date">
                              {detailsPers?.dateNaissance ? formatDate(detailsPers.dateNaissance) : '—'}
                            </span>
                          </span>
                          <span className="pcd-line-ar">البطان</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">4a.</span>
                          <span className="pcd-line-fr">
                            {formatDate(detailsPermis.dateDelivrance)}
                          </span>
                          <span className="pcd-line-ar">تاريخ</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">4b.</span>
                          <span className={`pcd-line-fr ${detailsExpire ? 'pcd-expired' : ''}`}>
                            {detailsPermis.dateExpiration ? formatDate(detailsPermis.dateExpiration) : '—'}
                          </span>
                          <span className="pcd-line-ar">ينتهي</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">4c.</span>
                          <span className="pcd-line-fr">
                            {detailsPermis.lieuDelivrance || 'A.T.T.T.'}
                          </span>
                          <span className="pcd-line-ar">السلطة</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">5.</span>
                          <span className="pcd-line-fr pcd-mono">
                            <strong>{detailsPermis.numero || '—'}</strong>
                          </span>
                          <span className="pcd-line-ar">رقم</span>
                        </div>

                        <div className="pcd-line">
                          <span className="pcd-line-num">7.</span>
                          <span className="pcd-line-fr pcd-mono">
                            {detailsPermis.reference || `${detailsPermis.id} / 270${String(detailsPermis.id).padStart(3, '0')}`}
                          </span>
                          <span className="pcd-line-ar">مرجع</span>
                        </div>

                        <div className="pcd-line pcd-line-signature">
                          <span className="pcd-line-num" />
                          <span className="pcd-signature">
                            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
                              <path
                                d="M10,28 C25,10 40,35 55,20 C70,5 85,32 100,18 C115,4 130,30 145,22 C160,14 175,28 190,20"
                                fill="none"
                                stroke="#831843"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                        </div>

                        <div className="pcd-line pcd-line-categories">
                          <span className="pcd-line-num">9.</span>
                          <span className="pcd-line-cat-label">A A B B E C C E D D E G H</span>
                          <span className="pcd-line-cat-ar">أ ب ج د هـ و ز ح ط ي</span>
                        </div>

                        <div className="pcd-categories-bar">
                          {['A', 'A1', 'B', 'B_E', 'C', 'C_E', 'D', 'D_E', 'F'].map((code) => {
                            const active = (detailsPermis.categories ?? []).includes(code);
                            return (
                              <div
                                key={code}
                                className={`pcd-cat-cell ${active ? 'is-active' : ''}`}
                                title={categorieLabel(code)}
                              >
                                {code.replace('_E', 'E')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Filigrane */}
                    <div className="pcd-watermark" aria-hidden="true">
                      <div className="pcd-watermark-circle" />
                      <div className="pcd-watermark-shield">🛡</div>
                    </div>

                    {/* Reflet */}
                    <div className="pcd-permis-shine" aria-hidden="true" />
                  </div>
                </div>

                <div className="pcd-permis-shadow" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modales édition / confirmation */}
      <PermisConduiteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        permis={selected}
        isEditing={!!selected}
      />

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="permis"
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