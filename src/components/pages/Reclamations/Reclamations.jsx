import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Link,
  FilePlus,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import reclamationService from '../../../services/reclamationService';
import ReclamationModal from '../../ui/modals/ReclamationModal';
import ReclamationDetails from './ReclamationDetails';
// ⚠️ Adapte ce chemin au dossier où se trouve BonMaintenanceDetails.jsx
import BonMaintenanceDetails from '../BonMaintenance/BonMaintenanceDetails';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import BonMaintenanceModal from '../../ui/modals/BonMaintenanceModal';
import bonMaintenanceFullService from '../../../services/bonMaintenanceFullService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';
import { t, locale } from '../../../i18n';
import './Reclamations.css';

const ETAT_LABELS = {
  0: 'Ouverte',
  1: 'En cours',
  2: 'Clôturée',
  3: 'En attente de validation',
  4: 'Rejetée',
};

const ETAT_BADGE_CLASS = {
  0: 'reclamations-badge--ouverte',
  1: 'reclamations-badge--encours',
  2: 'reclamations-badge--cloturee',
  3: 'reclamations-badge--attente',
  4: 'reclamations-badge--rejetee',
};

const NIVEAU_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Élevée',
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ?? t('État {n}', { n: etat });
}

function niveauLabel(niveau) {
  if (niveau == null) return '—';
  return NIVEAU_LABELS[niveau] ?? t('Niveau {n}', { n: niveau });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function personnelLabel(r) {
  return r.personnelAffecte
    ? `${r.personnelAffecte.nom ?? ''} ${r.personnelAffecte.prenom ?? ''}`.trim()
    : (r.personnelAffecteNom || '');
}

/* Colonnes paramétrables (affichage + recherche) */
const RECLAMATION_COLUMNS_DEFAULT = [
  { key: 'num',         label: 'Numéro',            visible: true, searchable: true  },
  { key: 'description', label: 'Description',       visible: true, searchable: true  },
  { key: 'service',     label: 'Service',           visible: true, searchable: false },
  { key: 'criticite',   label: 'Criticité',         visible: true, searchable: false },
  { key: 'urgence',     label: 'Urgence',           visible: true, searchable: false },
  { key: 'personnel',   label: 'Personnel affecté', visible: true, searchable: false },
  { key: 'date',        label: 'Date',              visible: true, searchable: false },
  { key: 'etat',        label: 'État',              visible: true, searchable: false },
];

function getColumnSearchValue(r, key) {
  switch (key) {
    case 'num':         return r.num || '';
    case 'description': return r.description || '';
    case 'service':     return r.serviceNom || r.service?.description || '';
    case 'criticite':   return niveauLabel(r.criticite);
    case 'urgence':     return niveauLabel(r.urgence);
    case 'personnel':   return personnelLabel(r);
    case 'date':        return formatDate(r.date);
    case 'etat':        return etatLabel(r.etat);
    default:            return '';
  }
}

/* Valeurs utilisées pour le tri */
const SORTABLE_COLUMNS = {
  num:         (r) => r.num || '',
  description: (r) => r.description || '',
  service:     (r) => r.serviceNom || r.service?.description || '',
  criticite:   (r) => r.criticite ?? -1,
  urgence:     (r) => r.urgence ?? -1,
  personnel:   (r) => personnelLabel(r),
  date:        (r) => (r.date ? new Date(r.date).getTime() : 0),
  etat:        (r) => r.etat ?? -1,
};

export default function Reclamations() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  // ✅ Tri par défaut : date la plus récente en premier
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const [columnSettings, setColumnSettings] = useState(RECLAMATION_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [associateOpen, setAssociateOpen] = useState(false);
  const [createBonOpen, setCreateBonOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);
  const [bonOuvert, setBonOuvert] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: t("Confirmer"),
    onConfirm: null,
  });

  const [rejetModal, setRejetModal] = useState({ show: false, motif: '' });
  const [validating, setValidating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await reclamationService.getAll(0, 100);
      setReclamations(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les réclamations. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredReclamations = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const filtered = reclamations.filter((r) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(r, key).toLowerCase().includes(term));

      const matchesEtat = etatFilter === 'all' || String(r.etat) === etatFilter;

      return matchesSearch && matchesEtat;
    });

    const extractor = sortColumn ? SORTABLE_COLUMNS[sortColumn] : null;
    if (!extractor) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'fr', { sensitivity: 'base', numeric: true });
      return va - vb;
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [reclamations, searchTerm, etatFilter, columnSettings, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredReclamations.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, etatFilter, sortColumn, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedReclamations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReclamations.slice(start, start + pageSize);
  }, [filteredReclamations, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) {
      range.push(i);
    }
    return range;
  }, [totalPages]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="reclamations-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="reclamations-sort-icon active" />
      : <ArrowDown size={13} className="reclamations-sort-icon active" />;
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

  // Pré-remplissage du bon à partir de la réclamation sélectionnée
  const bonInitialValues = useMemo(() => {
    if (!selectedReclamation) return null;
    const r = selectedReclamation;
    return {
      titre: r.num ? t('Réclamation {num}', { num: r.num }) : t('Réclamation #{id}', { id: r.id }),
      description: r.description || '',
      urgence: r.urgence ?? '',
      lotArticleImmobilistationId: r.lotArticleImmobilistationId ?? '',
    };
  }, [selectedReclamation]);

  const TABLE_COLUMNS_DEF = {
    num: { cell: (r) => <td key="num" style={{ fontWeight: 600 }}>{r.num || '—'}</td> },
    description: { cell: (r) => <td key="description" className="reclamations-desc-cell">{t(r.description)}</td> },
    service: { cell: (r) => <td key="service">{r.serviceNom || r.service?.description || '—'}</td> },
    criticite: { cell: (r) => <td key="criticite">{t(niveauLabel(r.criticite))}</td> },
    urgence: { cell: (r) => <td key="urgence">{t(niveauLabel(r.urgence))}</td> },
    personnel: { cell: (r) => <td key="personnel">{personnelLabel(r) || '—'}</td> },
    date: { cell: (r) => <td key="date">{formatDate(r.date)}</td> },
    etat: {
      cell: (r) => (
        <td key="etat">
          <span className={`reclamations-badge ${ETAT_BADGE_CLASS[r.etat] || ''}`}>
            {t(etatLabel(r.etat))}
          </span>
        </td>
      ),
    },
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleRowClick = (reclamation) => {
    setSelectedReclamation((prev) => (prev?.id === reclamation.id ? null : reclamation));
  };

  const openCreate = () => {
    setSelectedReclamation(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedReclamation) return;
    setModalOpen(true);
  };

  const openAssociate = () => {
    if (!selectedReclamation) return;
    setAssociateOpen(true);
  };

  const openCreateBon = () => {
    if (!selectedReclamation) return;
    setCreateBonOpen(true);
  };

  /**
   * Crée le bon de maintenance (avec ses enfants éventuels) puis le lie
   * automatiquement à la réclamation sélectionnée.
   */
  const handleCreateBon = async (payload, children) => {
    if (!selectedReclamation) return;
    const result = await bonMaintenanceFullService.createFull(payload, children || {});
    const bon = result.bonMaintenance;

    try {
      await reclamationBonMaintenanceService.link(selectedReclamation.id, bon.id);
    } catch (err) {
      console.error(err);
      alert(t('Le bon {num} a été créé, mais son association à la réclamation a échoué. Utilisez le bouton « Associer » pour le lier manuellement.', { num: bon.num || `#${bon.id}` }));
    }

    if (result.errors.length > 0) {
      const summary = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
      alert(t("Le bon a été créé, mais {n} élément(s) n'ont pas pu être ajoutés :", { n: result.errors.length }) + `\n${summary}`);
    }

    await apresAction();
  };

  const rechargerDetails = async (id, { silencieux = false } = {}) => {
    if (!silencieux) {
      setDetailsLoading(true);
      setDetailsData(null);
    }
    try {
      const data = await reclamationService.getWithBonMaintenance(id);
      setDetailsData(data);
      // Garde la sélection à jour (les actions Valider / Rejeter / Modifier s'appuient dessus)
      const rec = data?.reclamation ?? data;
      if (rec?.id) setSelectedReclamation(rec);
    } catch (err) {
      console.error('Erreur chargement des détails :', err);
      alert(t("Impossible de charger les détails de cette réclamation."));
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openDetails = async (reclamation = selectedReclamation) => {
    if (!reclamation) return;
    setSelectedReclamation(reclamation);
    setDetailsOpen(true);
    await rechargerDetails(reclamation.id);
  };

  const fermerDetails = () => {
    setDetailsOpen(false);
    setDetailsData(null);
    setSelectedReclamation(null);
  };

  // Après une action : sur la page de détail on la rafraîchit, sur la liste on désélectionne
  const apresAction = async () => {
    await load();
    if (detailsOpen && selectedReclamation) {
      await rechargerDetails(selectedReclamation.id, { silencieux: true });
    } else {
      setSelectedReclamation(null);
    }
  };

  const handleSave = async (payload) => {
    let saved;
    if (selectedReclamation) {
      saved = await reclamationService.update(selectedReclamation.id, payload);
    } else {
      saved = await reclamationService.create(payload);
      if (saved.bonMaintenanceId) {
        alert(t('Réclamation créée. Bon de maintenance associé généré (id {id}).', { id: saved.bonMaintenanceId }));
      }
    }

    await apresAction();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedReclamation || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer la réclamation"),
      message: t('Supprimer la réclamation « {num} » ? Cette action est irréversible.', { num: selectedReclamation.num || selectedReclamation.id }),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await reclamationService.remove(selectedReclamation.id);
          setReclamations((prev) => prev.filter((r) => r.id !== selectedReclamation.id));
          setSelectedReclamation(null);
          setDetailsOpen(false);
          setDetailsData(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression de cette réclamation."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleValider = async () => {
    if (!selectedReclamation || validating) return;
    setValidating(true);
    try {
      const updated = await reclamationService.valider(selectedReclamation.id, {});
      // Sur la page de détail, le parcours se met à jour : pas besoin d'alerte
      if (!detailsOpen) {
        alert(updated.bonMaintenanceId
          ? t('Réclamation validée. Bon de maintenance lié (id {id}).', { id: updated.bonMaintenanceId })
          : 'Réclamation validée.');
      }
      await apresAction();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec de la validation.');
    } finally {
      setValidating(false);
    }
  };

  const openRejetModal = () => {
    if (!selectedReclamation) return;
    setRejetModal({ show: true, motif: '' });
  };

  const confirmRejeter = async () => {
    const motif = rejetModal.motif.trim();
    if (!motif || !selectedReclamation) return;
    setRejetModal({ show: false, motif: '' });
    setValidating(true);
    try {
      await reclamationService.rejeter(selectedReclamation.id, { motifRejet: motif });
      await apresAction();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec du rejet.');
    } finally {
      setValidating(false);
    }
  };

  const handleExportExcel = () => {
    const entetes = ['Numéro', 'Description', 'Criticité', 'Urgence', 'Personnel affecté', 'Date', 'État'].map((e) => t(e));
    const lignes = filteredReclamations.map((r) => [
      r.num || '',
      (r.description || '').replace(/"/g, '""'),
      niveauLabel(r.criticite),
      niveauLabel(r.urgence),
      personnelLabel(r),
      formatDate(r.date),
      etatLabel(r.etat),
    ]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `reclamations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert(t("Ouvre le dashboard des réclamations pour les statistiques détaillées."));
  };

  // Un bon ouvert depuis la page de détail s'affiche en plein écran, avec retour vers la réclamation
  if (bonOuvert) {
    return (
      <BonMaintenanceDetails
        bonMaintenance={bonOuvert}
        onBack={() => {
          setBonOuvert(null);
          if (selectedReclamation) rechargerDetails(selectedReclamation.id, { silencieux: true });
        }}
      />
    );
  }

  return (
    <>
    {detailsOpen ? (
      <ReclamationDetails
        data={detailsData}
        loading={detailsLoading}
        validating={validating}
        onBack={fermerDetails}
        onModifier={openEdit}
        onValider={handleValider}
        onRejeter={openRejetModal}
        onCreerBon={openCreateBon}
        onAssocier={openAssociate}
        onOuvrirBon={(bon) => setBonOuvert(bon)}
      />
    ) : (
    <div className="reclamations-container">

      <div className="reclamations-header-card">
        <div className="reclamations-header-title-box">
          <button
            type="button"
            className="reclamations-header-icon reclamations-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <AlertCircle size={24} />
          </button>
          <div>
            <h2>{t("Réclamations")}</h2>
            <p className="reclamations-header-subtitle">
              {t("Gestion des réclamations")}
            </p>
          </div>
        </div>
        <span className="reclamations-badge-total">{t("Total :")} {filteredReclamations.length}</span>
      </div>

      <div className="reclamations-actions-bar">
        <button className="reclamations-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} />
          <span>{t("Ajouter")}</span>
        </button>

        <button
          className={`reclamations-action-btn modifier ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openEdit}
        >
          <Edit size={18} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`reclamations-action-btn details ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={() => openDetails()}
        >
          <Eye size={18} />
          <span>{t("Détails")}</span>
        </button>

        <button
          className={`reclamations-action-btn associer ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openAssociate}
        >
          <Link size={18} />
          <span>{t("Associer")}</span>
        </button>

        <button
          className={`reclamations-action-btn creer-bon ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openCreateBon}
          title={t("Créer un bon de maintenance pour cette réclamation")}
        >
          <FilePlus size={18} />
          <span>{t("Créer un bon")}</span>
        </button>

        <div className="reclamations-actions-divider" />

        <button
          className={`reclamations-action-btn valider ${(!selectedReclamation || validating) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || validating}
          onClick={handleValider}
        >
          <CheckCircle size={18} />
          <span>{t("Valider")}</span>
        </button>

        <button
          className={`reclamations-action-btn rejeter ${(!selectedReclamation || validating) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || validating}
          onClick={openRejetModal}
        >
          <XCircle size={18} />
          <span>{t("Rejeter")}</span>
        </button>

        <button
          className={`reclamations-action-btn supprimer ${(!selectedReclamation || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} />
          <span>{t("Supprimer")}</span>
        </button>
      </div>

      <div className="reclamations-filter-panel">
        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">{t("Recherche")}</span>
          <div className="reclamations-filter-input-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">{t("État")}</span>
          <div className="reclamations-filter-input-wrap">
            <Filter size={16} />
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous")}</option>
              <option value="0">{t("Ouverte")}</option>
              <option value="1">{t("En cours")}</option>
              <option value="2">{t("Clôturée")}</option>
              <option value="3">{t("En attente de validation")}</option>
              <option value="4">{t("Rejetée")}</option>
            </select>
          </div>
        </div>

        <button className="reclamations-filter-reset" onClick={handleResetFilters}>
          {t("Réinitialiser")}
        </button>

        <div className="reclamations-export-stack">
          <button className="reclamations-export-btn excel" title={t("Exporter en Excel (CSV)")} onClick={handleExportExcel}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="reclamations-export-btn print" title={t("Imprimer")} onClick={handlePrint}>
            <Printer size={18} />
          </button>
          <button className="reclamations-export-btn stats" title={t("Statistiques")} onClick={handleStats}>
            <BarChart3 size={18} />
          </button>
        </div>
      </div>

      {error && <div className="reclamations-error-banner">{error}</div>}

      <div className="reclamations-table-wrap">
        <table className="reclamations-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`reclamations-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="reclamations-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="reclamations-table-empty">{t("Chargement...")}</td>
              </tr>
            ) : filteredReclamations.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="reclamations-table-empty">
                  {reclamations.length === 0
                    ? t("Aucune réclamation pour l'instant. Ajoute la première avec le bouton ci-dessus.")
                    : t("Aucune réclamation ne correspond à ces filtres.")}
                </td>
              </tr>
            ) : (
              paginatedReclamations.map((r) => (
                <tr
                  key={r.id}
                  className={`reclamations-row ${selectedReclamation?.id === r.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(r)}
                  onDoubleClick={() => openDetails(r)}
                  title={t("Double-cliquez pour voir le détail")}
                >
                  {visibleColumns.map((c) => TABLE_COLUMNS_DEF[c.key]?.cell(r))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredReclamations.length > 0 && (
        <div className="reclamations-pagination">
          <span className="reclamations-pagination-info">
            {filteredReclamations.length} {t("résultat")}{filteredReclamations.length > 1 ? 's' : ''}
            {t(" — page ")}{currentPage}{' / '}{totalPages}
          </span>

          <div className="reclamations-pagination-controls">
            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>

            {paginationRange.map((p) => (
              <button
                key={p}
                type="button"
                className={`reclamations-pagination-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
    )}

      <ReclamationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        reclamation={selectedReclamation}
        isEditing={!!selectedReclamation}
      />

      <AssociateBonMaintenanceModal
        isOpen={associateOpen}
        onClose={() => {
          setAssociateOpen(false);
          if (detailsOpen && selectedReclamation) rechargerDetails(selectedReclamation.id, { silencieux: true });
        }}
        reclamation={selectedReclamation}
      />

      <BonMaintenanceModal
        isOpen={createBonOpen}
        onClose={() => setCreateBonOpen(false)}
        onSave={handleCreateBon}
        bonMaintenance={null}
        isEditing={false}
        initialValues={bonInitialValues}
        titleOverride={t('Nouveau bon') + ` — ${selectedReclamation?.num || t('Réclamation #{id}', { id: selectedReclamation?.id ?? '' })}`}
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

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="reclamation"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />

      {rejetModal.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setRejetModal({ show: false, motif: '' })}>
          <div className="confirm-modal-container rejet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <XCircle className="modal-confirm-icon danger" size={48} strokeWidth={2} />
              </div>
              <div className="confirm-modal-text">
                <h3>{t("Rejeter la réclamation")}</h3>
                <p>{t("Indique le motif du rejet.")}</p>
                <textarea
                  className="confirm-modal-input"
                  value={rejetModal.motif}
                  onChange={(e) => setRejetModal((p) => ({ ...p, motif: e.target.value }))}
                  placeholder={t("Motif de rejet...")}
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button type="button" className="confirm-btn secondary" onClick={() => setRejetModal({ show: false, motif: '' })}>
                {t("Annuler")}
              </button>
              <button
                type="button"
                className="confirm-btn primary danger"
                onClick={confirmRejeter}
                disabled={!rejetModal.motif.trim()}
              >
                {t("Rejeter")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}