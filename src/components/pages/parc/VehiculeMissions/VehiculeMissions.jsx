import { useEffect, useMemo, useState } from 'react';
import {
  Route,
  Plus,
  Pencil,
  Play,
  CheckCircle2,
  Trash2,
  Search,
  Filter,
  RotateCcw,
  Download,
  Printer,
  BarChart3,
  MapPin,
  Calendar,
  User,
  Car,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Clock,
  XCircle,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import vehiculeMissionService from '../../../../services/vehiculeMissionService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import emplacementService from '../../../../services/emplacementService';
import VehiculeMissionModal from '../../../ui/modals/VehiculeMissionModal';
import PageModal from '../../../ui/modals/PageModal';
import VehiculeTracage from './VehiculeTracage';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './VehiculeMissions.css';
import TerminerMissionModal from '../../../ui/modals/TerminerMissionModal';
import { t, tp, locale } from '../../../../i18n';

const ETAT_LABELS = {
  0: 'Planifiée',
  1: 'En cours',
  2: 'Terminée',
  3: 'Annulée',
};

const ETAT_META = {
  0: { class: 'planned', Icon: Clock },
  1: { class: 'running', Icon: Loader2 },
  2: { class: 'done', Icon: CheckCircle2 },
  3: { class: 'cancelled', Icon: XCircle },
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ? t(ETAT_LABELS[etat]) : t('Code {code}', { code: etat });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function destinationLabel(mission, emplacementsMap) {
  const emp = emplacementsMap[mission.destinationId];
  return emp?.nom || mission.destination || mission.lieu || '';
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
const VMS_COLUMNS_DEFAULT = [
  { key: 'num',         label: 'N°',          visible: true, searchable: true  },
  { key: 'vehicule',    label: 'Véhicule',    visible: true, searchable: true  },
  { key: 'conducteur',  label: 'Conducteur',  visible: true, searchable: true  },
  { key: 'depart',      label: 'Départ',      visible: true, searchable: false },
  { key: 'retour',      label: 'Retour',      visible: true, searchable: false },
  { key: 'destination', label: 'Destination', visible: true, searchable: true  },
  { key: 'parcourus',   label: 'Parcourus',   visible: true, searchable: false },
  { key: 'etat',        label: 'État',        visible: true, searchable: false },
];

export default function VehiculeMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(VMS_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});
  const [emplacementsMap, setEmplacementsMap] = useState({});

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tracageOpen, setTracageOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [terminerOpen, setTerminerOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: t("Confirmer"),
    onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, vehPage, persPage, empPage] = await Promise.all([
        vehiculeMissionService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
        emplacementService.getAll(0, 500).catch(() => ({ content: [] })),
      ]);

      setMissions(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);

      const eMap = {};
      (empPage.content ?? empPage ?? []).forEach((e) => { eMap[e.id] = e; });
      setEmplacementsMap(eMap);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les missions. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ─── Statistiques rapides ───
  const stats = useMemo(() => {
    const total = missions.length;
    const planifiees = missions.filter((m) => m.etat === 0).length;
    const enCours = missions.filter((m) => m.etat === 1).length;
    const terminees = missions.filter((m) => m.etat === 2).length;
    const annulees = missions.filter((m) => m.etat === 3).length;
    return { total, planifiees, enCours, terminees, annulees };
  }, [missions]);

  const availableEtats = useMemo(() => {
    const set = new Set(missions.map((m) => m.etat).filter((e) => e != null));
    return Array.from(set).sort((a, b) => a - b);
  }, [missions]);

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (m, key) => {
    const veh = vehiculesMap[m.vehiculeId];
    const pers = personnelsMap[m.conducteurId ?? m.personnelId];
    switch (key) {
      case 'num':         return [m.num, m.numero, m.libelle, m.description].filter(Boolean).join(' ');
      case 'vehicule':    return [veh?.nom, veh?.immatriculation].filter(Boolean).join(' ');
      case 'conducteur':  return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'depart':      return formatDateTime(m.dateDepart || m.dateDebut);
      case 'retour':      return formatDateTime(m.dateRetour || m.dateFin);
      case 'destination': return [destinationLabel(m, emplacementsMap), m.localisation].filter(Boolean).join(' ');
      case 'parcourus':   return m.kilometrageParcouru != null ? String(m.kilometrageParcouru) : '';
      case 'etat':        return etatLabel(m.etat);
      default:            return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (m, key) => {
    const veh = vehiculesMap[m.vehiculeId];
    const pers = personnelsMap[m.conducteurId ?? m.personnelId];
    const time = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);
    switch (key) {
      case 'num':         return String(m.num || m.numero || '');
      case 'vehicule':    return veh?.nom || '';
      case 'conducteur':  return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'depart':      return time(m.dateDepart || m.dateDebut);
      case 'retour':      return time(m.dateRetour || m.dateFin);
      case 'destination': return destinationLabel(m, emplacementsMap);
      case 'parcourus':   return Number(m.kilometrageParcouru ?? m.kilometrageDepart ?? -1);
      case 'etat':        return Number(m.etat ?? -1);
      default:            return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = missions.filter((m) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(m, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(m.etat) === etatFilter;
      return matchesSearch && matchesEtat;
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
  }, [missions, searchTerm, etatFilter, vehiculesMap, personnelsMap, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="vms-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="vms-sort-icon active" />
      : <ArrowDown size={13} className="vms-sort-icon active" />;
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

  const renderCell = (key, m) => {
    const veh = vehiculesMap[m.vehiculeId];
    const pers = personnelsMap[m.conducteurId ?? m.personnelId];
    const meta = ETAT_META[m.etat] ?? ETAT_META[0];
    const EtatIcon = meta.Icon;
    const hasCoords = m.latitude != null && m.longitude != null;

    switch (key) {
      case 'num':
        return (
          <td key="num">
            <span className="vms-cell-num">{m.num || m.numero || `#${m.id}`}</span>
          </td>
        );
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vms-cell-vehicle">
              <div className="vms-cell-vehicle-icon">
                <Car size={14} strokeWidth={2.2} />
              </div>
              <div className="vms-cell-vehicle-text">
                <span className="vms-cell-main">
                  {veh?.nom || t('Véhicule #{id}', { id: m.vehiculeId })}
                </span>
                {veh?.immatriculation && (
                  <span className="vms-cell-sub">{veh.immatriculation}</span>
                )}
              </div>
            </div>
          </td>
        );
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers ? (
              <div className="vms-cell-driver">
                <User size={14} strokeWidth={2.2} className="vms-cell-driver-icon" />
                <span>{`${pers.nom || ''} ${pers.prenom || ''}`.trim()}</span>
              </div>
            ) : (
              <span className="vms-cell-empty">—</span>
            )}
          </td>
        );
      case 'depart':
        return (
          <td key="depart">
            <span className="vms-cell-date">{formatDateTime(m.dateDepart || m.dateDebut)}</span>
          </td>
        );
      case 'retour':
        return (
          <td key="retour">
            <span className="vms-cell-date">{formatDateTime(m.dateRetour || m.dateFin)}</span>
          </td>
        );
      case 'destination':
        return (
          <td key="destination">
            <div className="vms-cell-destination">
              <span>{destinationLabel(m, emplacementsMap) || '—'}</span>
              {hasCoords && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=16/${m.latitude}/${m.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vms-cell-map-link"
                  title={t("Voir sur OpenStreetMap")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin size={13} strokeWidth={2.5} />
                  <ExternalLink size={11} strokeWidth={2.5} />
                </a>
              )}
            </div>
          </td>
        );
      case 'parcourus':
        return (
          <td key="parcourus">
            {m.kilometrageParcouru != null
              ? t('{n} km', { n: Number(m.kilometrageParcouru).toLocaleString(locale()) })
              : m.kilometrageDepart != null
                ? <>{t('{n} km', { n: Number(m.kilometrageDepart).toLocaleString(locale()) })} <span className="rtl-miroir">→</span></>
                : '—'}
          </td>
        );
      case 'etat':
        return (
          <td key="etat">
            <span className={`vms-pill ${meta.class}`}>
              <EtatIcon
                size={12}
                strokeWidth={2.5}
                className={m.etat === 1 ? 'vms-spin' : ''}
              />
              {etatLabel(m.etat)}
            </span>
          </td>
        );
      default:
        return null;
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleRowClick = (m) => {
    setSelected((prev) => (prev?.id === m.id ? null : m));
  };

  const openCreate = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setModalOpen(true);
  };

  // Renvoie la mission enregistrée : la fenêtre s'en sert pour lier les bons de carburant ajoutés à la création
  const handleSave = async (payload) => {
    const enregistree = selected
      ? await vehiculeMissionService.update(selected.id, payload)
      : await vehiculeMissionService.create(payload);
    setSelected(null);
    await load();
    return enregistree;
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer la mission"),
      message: t('Supprimer la mission « {num} » ? Cette action est irréversible.', { num: selected.num || selected.numero || selected.id }),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeMissionService.remove(selected.id);
          setMissions((prev) => prev.filter((m) => m.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression de cette mission."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDemarrer = async () => {
    if (!selected) return;
    try {
      await vehiculeMissionService.demarrer(selected.id);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('Échec du démarrage de la mission.'));
    }
  };

  /**
   * Ouvre le modal de clôture. Les window.prompt() précédents ne permettaient
   * aucun contrôle de saisie : le kilométrage de retour doit être validé
   * contre le kilométrage de départ et le compteur du véhicule.
   */
  const handleTerminer = () => {
    if (!selected) return;
    setTerminerOpen(true);
  };

  /** Appelé par TerminerMissionModal ; les erreurs 409 remontent au modal. */
  const confirmTerminer = async (kmRetour, motif) => {
    await vehiculeMissionService.terminer(selected.id, kmRetour, motif);
    await load();
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['N°', 'Véhicule', 'Immatriculation', 'Conducteur', 'Départ', 'Retour', 'Destination', 'Localisation', 'Km parcourus', 'État'].map((e) => t(e));
    const lignes = filtered.map((m) => {
      const veh = vehiculesMap[m.vehiculeId];
      const pers = personnelsMap[m.conducteurId ?? m.personnelId];
      return [
        (m.num || m.numero || '—'),
        (veh?.nom || '—'),
        (veh?.immatriculation || '—'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        formatDateTime(m.dateDepart || m.dateDebut),
        formatDateTime(m.dateRetour || m.dateFin),
        (destinationLabel(m, emplacementsMap) || '—'),
        (m.localisation || '—'),
        m.kilometrageParcouru != null ? String(m.kilometrageParcouru) : '—',
        etatLabel(m.etat),
      ];
    });
    return { entetes, lignes };
  };

  const handleExportExcel = () => {
    const { entetes, lignes } = donneesTableau();

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${String(cellule ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `vehicule-missions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Missions véhicules'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? etatLabel(Number(etatFilter)) : '' },
      ],
    });
  };

  const handleStats = () => alert(t("Ouvre le dashboard des missions pour les statistiques détaillées."));

  return (
    <div className="vms-container">

      {/* ── HEADER ── */}
      <div className="vms-header-card">
        <div className="vms-header-left">
          <button
            type="button"
            className="vms-header-icon-wrap vms-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <Route size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Missions véhicules")}</h2>
            <p className="vms-header-subtitle">
              {t("Déplacements, affectations et suivi des missions par véhicule")}
            </p>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="vms-stats">
          <div className="vms-stat">
            <span className="vms-stat-value">{stats.total}</span>
            <span className="vms-stat-label">{t("Total")}</span>
          </div>
          <div className="vms-stat stat-planned">
            <span className="vms-stat-value">{stats.planifiees}</span>
            <span className="vms-stat-label">{t("Planifiées")}</span>
          </div>
          <div className="vms-stat stat-running">
            <span className="vms-stat-value">{stats.enCours}</span>
            <span className="vms-stat-label">{t("En cours")}</span>
          </div>
          <div className="vms-stat stat-done">
            <span className="vms-stat-value">{stats.terminees}</span>
            <span className="vms-stat-label">{t("Terminées")}</span>
          </div>
        </div>
      </div>

      {/* ── BARRE D'ACTIONS ── */}
      <div className="vms-actions-bar">
        <button className="vms-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Nouvelle mission")}</span>
        </button>

        <button
          className={`vms-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vms-action-btn tracage ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={() => setTracageOpen(true)}
          title={t("Ouvrir le traçage et les détails de la mission")}
        >
          <Navigation size={18} strokeWidth={2.2} />
          <span>{t("Traçage")}</span>
        </button>

        <button
          className={`vms-action-btn demarrer ${(!selected || selected?.etat !== 0) ? 'disabled' : ''}`}
          disabled={!selected || selected?.etat !== 0}
          onClick={handleDemarrer}
          title={t("Démarrer la mission sélectionnée")}
        >
          <Play size={18} strokeWidth={2.2} />
          <span>{t("Démarrer")}</span>
        </button>

        <button
          className={`vms-action-btn terminer ${(!selected || selected?.etat !== 1) ? 'disabled' : ''}`}
          disabled={!selected || selected?.etat !== 1}
          onClick={handleTerminer}
          title={t("Terminer la mission sélectionnée")}
        >
          <CheckCircle2 size={18} strokeWidth={2.2} />
          <span>{t("Terminer")}</span>
        </button>

        <button
          className={`vms-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
      </div>

      {/* ── FILTRES ── */}
      <div className="vms-filter-panel">
        <div className="vms-filter-group">
          <span className="vms-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="vms-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vms-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vms-filter-group">
          <span className="vms-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("État")}
          </span>
          <div className="vms-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous les états")}</option>
              {availableEtats.map((e) => (
                <option key={e} value={e}>{etatLabel(e)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vms-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="vms-export-stack">
          <button className="vms-export-btn excel" title={t("Exporter en Excel (CSV)")} onClick={handleExportExcel}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vms-export-btn print" title={t("Imprimer")} onClick={handleImprimerListe}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vms-export-btn stats" title={t("Statistiques")} onClick={handleStats}>
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vms-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* ── TABLEAU ── */}
      <div className="vms-table-wrap">
        <table className="vms-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`vms-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="vms-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="vms-table-empty">
                  <div className="vms-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vms-spin" />
                    <span>{t("Chargement des missions...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vms-table-empty">
                  <div className="vms-empty-state">
                    <Route size={32} strokeWidth={1.6} />
                    <span>
                      {missions.length === 0
                        ? t("Aucune mission pour l'instant. Crée la première avec le bouton ci-dessus.")
                        : t("Aucune mission ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`vms-row ${selected?.id === m.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(m)}
                >
                  {visibleColumns.map((c) => renderCell(c.key, m))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODALE ÉDITION / CRÉATION ── */}
      <VehiculeMissionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        vehiculeMission={selected}
        isEditing={!!selected}
      />

      {/* ── MODALE TRAÇAGE + DÉTAILS (avec onglets) ── */}
      <PageModal
        isOpen={tracageOpen}
        onClose={() => setTracageOpen(false)}
        title={t("Traçage véhicule")}
        subtitle={t('Suivi en temps réel, historique et détails de la mission')}
        icon={Navigation}
        accent="#0d9488"
        size="full"
      >
        <VehiculeTracage
          isModal
          initialVehiculeId={selected?.vehiculeId ?? null}
          initialMission={selected ?? null}
        />
      </PageModal>

      {/* ── MODALE DE CLÔTURE (saisie du kilométrage de retour) ── */}
      <TerminerMissionModal
        isOpen={terminerOpen}
        onClose={() => setTerminerOpen(false)}
        mission={selected}
        vehicule={selected ? vehiculesMap[selected.vehiculeId] : null}
        onConfirm={confirmTerminer}
      />

      {/* ── PARAMÈTRES DES COLONNES ── */}
      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="mission"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />

      {/* ── CONFIRMATION ── */}
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