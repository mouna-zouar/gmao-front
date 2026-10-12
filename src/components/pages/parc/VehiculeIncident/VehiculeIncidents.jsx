import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2,
  Car, User, Calendar, Gauge, Coins, MapPin,
  ShieldAlert, Activity, XCircle, Clock,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import vehiculeIncidentService from '../../../../services/vehiculeIncidentService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeIncidentModal from '../../../ui/modals/VehiculeIncidentModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './VehiculeIncidents.css';

// Codes alignés sur le backend (voir commentaires sur les champs
// `type`, `gravite` et `etat` dans VehiculeIncident.java).
const TYPE_LABELS = {
  1: 'Accident',
  2: 'Panne',
  3: 'Vol',
  4: 'Dégradation',
  5: 'Autre',
};

const GRAVITE_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Grave',
};

const ETAT_LABELS = {
  0: 'Ouvert',
  1: 'En cours',
  2: 'Clôturé',
};

// `color` sert à la fois pour la pastille du tableau et pour les boutons
// de changement rapide d'état dans la barre d'actions.
const ETAT_META = {
  0: { class: 'declared',   Icon: AlertTriangle, color: 'amber' },
  1: { class: 'inprogress', Icon: Activity,      color: 'blue'  },
  2: { class: 'closed',     Icon: XCircle,       color: 'slate' },
};

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

// Libellés traduits : la recherche, le tableau et l'export suivent la langue choisie
function typeLabel(type) { return TYPE_LABELS[type] ? t(TYPE_LABELS[type]) : t('Type {n}', { n: type }); }
function graviteLabel(g) { return GRAVITE_LABELS[g] ? t(GRAVITE_LABELS[g]) : t('Gravité {niveau}', { niveau: g }); }
function etatLabel(e) { return ETAT_LABELS[e] ? t(ETAT_LABELS[e]) : t('État {n}', { n: e }); }

/* Colonnes paramétrables (affichage + recherche) */
const VIN_COLUMNS_DEFAULT = [
  { key: 'vehicule',   label: 'Véhicule',   visible: true, searchable: true  },
  { key: 'conducteur', label: 'Conducteur', visible: true, searchable: true  },
  { key: 'type',       label: 'Type',       visible: true, searchable: true  },
  { key: 'date',       label: 'Date',       visible: true, searchable: false },
  { key: 'gravite',    label: 'Gravité',    visible: true, searchable: false },
  { key: 'cout',       label: 'Coût',       visible: true, searchable: false },
  { key: 'etat',       label: 'État',       visible: true, searchable: false },
];

export default function VehiculeIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');
  const [graviteFilter, setGraviteFilter] = useState('all');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(VIN_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingEtat, setIsUpdatingEtat] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: t("Confirmer"), onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, vehPage, persPage] = await Promise.all([
        vehiculeIncidentService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
      ]);

      setIncidents(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les incidents. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Garde la sélection synchronisée après un rechargement de la liste
  // (utile après un changement d'état rapide).
  useEffect(() => {
    if (!selected) return;
    const fresh = incidents.find((i) => i.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [incidents]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = incidents.length;
    const declares = incidents.filter((i) => i.etat === 0).length;
    const enCours = incidents.filter((i) => i.etat === 1).length;
    const resolus = incidents.filter((i) => i.etat === 2 || i.etat === 3).length;
    const coutTotal = incidents.reduce((sum, i) => sum + (Number(i.cout) || 0), 0);
    return { total, declares, enCours, resolus, coutTotal };
  }, [incidents]);

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (i, key) => {
    const veh = vehiculesMap[i.vehiculeId];
    const pers = personnelsMap[i.conducteurId];
    switch (key) {
      case 'vehicule':   return [veh?.matricule, veh?.marque].filter(Boolean).join(' ');
      case 'conducteur': return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'type':       return [typeLabel(i.type), i.description].filter(Boolean).join(' ');
      case 'date':       return formatDate(i.dateIncident);
      case 'gravite':    return graviteLabel(i.gravite);
      case 'cout':       return i.cout != null ? String(i.cout) : '';
      case 'etat':       return etatLabel(i.etat);
      default:           return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (i, key) => {
    const veh = vehiculesMap[i.vehiculeId];
    const pers = personnelsMap[i.conducteurId];
    switch (key) {
      case 'vehicule':   return veh?.matricule || '';
      case 'conducteur': return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'type':       return Number(i.type ?? -1);
      case 'date':       return i.dateIncident ? new Date(i.dateIncident).getTime() || 0 : 0;
      case 'gravite':    return Number(i.gravite ?? -1);
      case 'cout':       return Number(i.cout ?? -1);
      case 'etat':       return Number(i.etat ?? -1);
      default:           return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = incidents.filter((i) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(i, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(i.etat) === etatFilter;
      const matchesGravite = graviteFilter === 'all' || String(i.gravite) === graviteFilter;
      return matchesSearch && matchesEtat && matchesGravite;
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
  }, [incidents, searchTerm, etatFilter, graviteFilter, vehiculesMap, personnelsMap, columnSettings, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="vin-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="vin-sort-icon active" />
      : <ArrowDown size={13} className="vin-sort-icon active" />;
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

  const renderCell = (key, i) => {
    const veh = vehiculesMap[i.vehiculeId];
    const pers = personnelsMap[i.conducteurId];
    const meta = ETAT_META[i.etat] ?? ETAT_META[0];
    const EtatIcon = meta.Icon;

    switch (key) {
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vin-cell-vehicle">
              <div className="vin-cell-vehicle-icon">
                <Car size={14} strokeWidth={2.2} />
              </div>
              <div className="vin-cell-vehicle-text">
                <span className="vin-cell-main">
                  {veh?.matricule || t('Véhicule #{id}', { id: i.vehiculeId })}
                </span>
                {veh?.marque && <span className="vin-cell-sub">{veh.marque}</span>}
              </div>
            </div>
          </td>
        );
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers ? (
              <div className="vin-cell-driver">
                <div className="vin-cell-driver-avatar">
                  <User size={14} strokeWidth={2.2} />
                </div>
                <span className="vin-cell-main">
                  {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                </span>
              </div>
            ) : (
              <span className="vin-cell-empty">—</span>
            )}
          </td>
        );
      case 'type':
        return (
          <td key="type">
            <span className="vin-tag">{typeLabel(i.type)}</span>
          </td>
        );
      case 'date':
        return (
          <td key="date">
            <span className="vin-cell-date">
              <Calendar size={12} strokeWidth={2.5} />
              {formatDate(i.dateIncident)}
            </span>
          </td>
        );
      case 'gravite':
        return (
          <td key="gravite">
            <span className={`vin-gravite gravite-${i.gravite}`}>
              {graviteLabel(i.gravite)}
            </span>
          </td>
        );
      case 'cout':
        return (
          <td key="cout">
            <span className="vin-cell-amount">
              <Coins size={13} strokeWidth={2.5} />
              {formatMontant(i.cout)}
            </span>
          </td>
        );
      case 'etat':
        return (
          <td key="etat">
            <span className={`vin-pill ${meta.class}`}>
              <EtatIcon
                size={12}
                strokeWidth={2.5}
                className={i.etat === 1 ? 'vin-spin' : ''}
              />
              {etatLabel(i.etat)}
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
    setGraviteFilter('all');
  };

  const handleRowClick = (i) => {
    setSelected((prev) => (prev?.id === i.id ? null : i));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await vehiculeIncidentService.update(selected.id, payload);
    else await vehiculeIncidentService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer l'incident"),
      message: t('Supprimer cet incident ? Cette action est irréversible.'),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeIncidentService.remove(selected.id);
          setIncidents((prev) => prev.filter((i) => i.id !== selected.id));
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

  // Changement rapide d'état depuis la barre d'action.
  // On reconstruit le payload complet à partir de l'incident sélectionné
  // pour ne modifier QUE le champ `etat`.
  const handleQuickEtat = async (newEtat) => {
    if (!selected || isUpdatingEtat) return;
    if (Number(selected.etat) === Number(newEtat)) return;

    setIsUpdatingEtat(true);
    try {
      const payload = {
        vehiculeId: selected.vehiculeId,
        type: selected.type,
        dateIncident: selected.dateIncident,
        emplacementId: selected.emplacementId,
        conducteurId: selected.conducteurId,
        description: selected.description,
        gravite: selected.gravite,
        etat: Number(newEtat),
        kilometrage: selected.kilometrage,
        cout: selected.cout,
        gmaoId: selected.gmaoId,
        personnelCreationId: selected.personnelCreationId,
        commentaire: selected.commentaire,
      };
      await vehiculeIncidentService.update(selected.id, payload);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t("Échec du changement d'état."));
    } finally {
      setIsUpdatingEtat(false);
    }
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Véhicule', 'Conducteur', 'Type', 'Date', 'Gravité', 'État', 'Coût (DT)'].map((e) => t(e));
    const lignes = filtered.map((i) => {
      const veh = vehiculesMap[i.vehiculeId];
      const pers = personnelsMap[i.conducteurId];
      return [
        (veh?.matricule || '—'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        typeLabel(i.type),
        formatDate(i.dateIncident),
        graviteLabel(i.gravite),
        etatLabel(i.etat),
        i.cout ?? '—',
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
    a.download = `vehicule-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Incidents véhicule'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? etatLabel(Number(etatFilter)) : '' },
        { label: t('Gravité'), valeur: graviteFilter !== 'all' ? graviteLabel(Number(graviteFilter)) : '' },
      ],
    });
  };

  const handleStats = () => alert(t("Dashboard à venir."));

  // États vers lesquels on peut basculer (tous sauf l'état courant).
  const nextEtats = selected
    ? Object.keys(ETAT_META)
        .map(Number)
        .filter((k) => k !== Number(selected.etat))
    : [];

  return (
    <div className="vin-container">

      {/* HEADER */}
      <div className="vin-header-card">
        <div className="vin-header-left">
          <button
            type="button"
            className="vin-header-icon-wrap vin-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <AlertTriangle size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Incidents véhicule")}</h2>
            <p className="vin-header-subtitle">
              {t("Suivi des accidents, pannes et événements sur le parc")}
            </p>
          </div>
        </div>

        <div className="vin-stats">
          <div className="vin-stat">
            <span className="vin-stat-value">{stats.total}</span>
            <span className="vin-stat-label">{t("Total")}</span>
          </div>
          <div className="vin-stat stat-declared">
            <span className="vin-stat-value">{stats.declares}</span>
            <span className="vin-stat-label">{t("Déclarés")}</span>
          </div>
          <div className="vin-stat stat-progress">
            <span className="vin-stat-value">{stats.enCours}</span>
            <span className="vin-stat-label">{t("En cours")}</span>
          </div>
          <div className="vin-stat stat-resolved">
            <span className="vin-stat-value">{stats.resolus}</span>
            <span className="vin-stat-label">{t("Résolus")}</span>
          </div>
          <div className="vin-stat stat-cost">
            <span className="vin-stat-value">{formatMontant(stats.coutTotal)}</span>
            <span className="vin-stat-label">{t("Coût")}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vin-actions-bar">
        <button className="vin-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Nouvel incident")}</span>
        </button>

        <button
          className={`vin-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vin-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>

        {/* Boutons de changement rapide d'état (visibles si un incident est sélectionné) */}
        {selected && nextEtats.length > 0 && (
          <>
            <span className="vin-actions-sep" aria-hidden="true" />
            {nextEtats.map((target) => {
              const meta = ETAT_META[target];
              const Icon = meta.Icon;
              return (
                <button
                  key={target}
                  type="button"
                  className={`vin-action-btn etat-quick color-${meta.color} ${isUpdatingEtat ? 'disabled' : ''}`}
                  disabled={isUpdatingEtat}
                  title={t('Passer à : {etat}', { etat: etatLabel(target) })}
                  onClick={() => handleQuickEtat(target)}
                >
                  {isUpdatingEtat ? (
                    <Loader2 size={16} strokeWidth={2.4} className="vin-spin" />
                  ) : (
                    <Icon size={16} strokeWidth={2.4} />
                  )}
                  <span>{etatLabel(target)}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* FILTRES */}
      <div className="vin-filter-panel">
        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="vin-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vin-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("État")}
          </span>
          <div className="vin-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous les états")}</option>
              {Object.entries(ETAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <ShieldAlert size={14} strokeWidth={2.5} />
            {t("Gravité")}
          </span>
          <div className="vin-filter-input-wrap">
            <select value={graviteFilter} onChange={(e) => setGraviteFilter(e.target.value)}>
              <option value="all">{t("Toutes les gravités")}</option>
              {Object.entries(GRAVITE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vin-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="vin-export-stack">
          <button className="vin-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vin-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vin-export-btn stats" onClick={handleStats} title={t("Stats")}>
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vin-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vin-table-wrap">
        <table className="vin-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`vin-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="vin-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="vin-table-empty">
                  <div className="vin-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vin-spin" />
                    <span>{t("Chargement des incidents...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vin-table-empty">
                  <div className="vin-empty-state">
                    <AlertTriangle size={32} strokeWidth={1.6} />
                    <span>
                      {incidents.length === 0
                        ? t("Aucun incident enregistré.")
                        : t("Aucun incident ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr
                  key={i.id}
                  className={`vin-row ${selected?.id === i.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(i)}
                >
                  {visibleColumns.map((c) => renderCell(c.key, i))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <VehiculeIncidentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        incident={selected}
        isEditing={!!selected}
      />

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="incident"
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