import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  Car, User, Calendar, Clock, MapPin, Flag,
  CheckCircle2, XCircle, Activity, Hourglass, Ban, CheckCheck,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeReservationService from '../../../../services/vehiculeReservationService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeReservationModal from '../../../ui/modals/VehiculeReservationModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import './VehiculeReservations.css';

// Codes alignés sur le backend (voir commentaire sur le champ `etat`
// dans VehiculeReservation.java) :
// 0 = En attente, 1 = Acceptée, 2 = Refusée, 3 = Annulée, 4 = Terminée
const ETAT_LABELS = {
  0: 'En attente',
  1: 'Acceptée',
  2: 'Refusée',
  3: 'Annulée',
  4: 'Terminée',
};

const ETAT_META = {
  0: { class: 'pending', Icon: Hourglass },
  1: { class: 'confirmed', Icon: CheckCircle2 },
  2: { class: 'cancelled', Icon: XCircle },
  3: { class: 'cancelled', Icon: XCircle },
  4: { class: 'done', Icon: Activity },
};

// Boutons de changement rapide d'état affichés dans la barre d'action,
// à côté de « Modifier » / « Supprimer ». Chaque action n'est activable
// que si la réservation sélectionnée est dans un des états `allowedFrom`.
const ETAT_ACTIONS = [
  { toEtat: 1, label: 'Accepter', Icon: CheckCircle2, className: 'accept', allowedFrom: [0] },
  { toEtat: 2, label: 'Refuser', Icon: XCircle, className: 'refuse', allowedFrom: [0] },
  { toEtat: 4, label: 'Terminer', Icon: CheckCheck, className: 'finish', allowedFrom: [1] },
  { toEtat: 3, label: 'Annuler', Icon: Ban, className: 'cancel', allowedFrom: [0, 1] },
];

/* Colonnes paramétrables (affichage + recherche) */
const VRS_COLUMNS_DEFAULT = [
  { key: 'vehicule',   label: 'Véhicule',   visible: true, searchable: true  },
  { key: 'conducteur', label: 'Conducteur', visible: true, searchable: true  },
  { key: 'periode',    label: 'Période',    visible: true, searchable: false },
  { key: 'motif',      label: 'Motif',      visible: true, searchable: true  },
  { key: 'etat',       label: 'État',       visible: true, searchable: false },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Libellé traduit : la recherche, le tableau et l'export suivent la langue choisie
function etatLabel(e) { return ETAT_LABELS[e] ? t(ETAT_LABELS[e]) : t('État {n}', { n: e }); }

export default function VehiculeReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [columnSettings, setColumnSettings] = useState(VRS_COLUMNS_DEFAULT);
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
        vehiculeReservationService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
      ]);

      setReservations(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les réservations. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Garde `selected` synchronisé avec la liste rechargée (même si l'id
  // reste sélectionné après un changement d'état).
  useEffect(() => {
    if (!selected) return;
    const fresh = reservations.find((r) => r.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [reservations]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = reservations.length;
    const enAttente = reservations.filter((r) => r.etat === 0).length;
    const confirmees = reservations.filter((r) => r.etat === 1).length;
    const enCours = reservations.filter((r) => r.etat === 2).length;
    const terminees = reservations.filter((r) => r.etat === 3).length;
    return { total, enAttente, confirmees, enCours, terminees };
  }, [reservations]);

  // Texte de recherche d'une colonne
  const getColumnSearchValue = (r, key) => {
    const veh = vehiculesMap[r.vehiculeId];
    const pers = personnelsMap[r.personnelId] ?? { nom: r.personnelNom };
    switch (key) {
      case 'vehicule':   return [veh?.matricule, veh?.marque].filter(Boolean).join(' ');
      case 'conducteur': return [pers?.nom, pers?.prenom, pers?.matricule].filter(Boolean).join(' ');
      case 'periode':    return `${formatDateTime(r.dateDebut)} ${formatDateTime(r.dateFin)}`;
      case 'motif':      return r.motif || '';
      case 'etat':       return etatLabel(r.etat);
      default:           return '';
    }
  };

  // Valeur utilisée pour trier une colonne
  const getSortValue = (r, key) => {
    const veh = vehiculesMap[r.vehiculeId];
    const pers = personnelsMap[r.personnelId] ?? { nom: r.personnelNom };
    const time = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);
    switch (key) {
      case 'vehicule':   return veh?.matricule || '';
      case 'conducteur': return pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '';
      case 'periode':    return time(r.dateDebut);
      case 'motif':      return r.motif || '';
      case 'etat':       return Number(r.etat ?? -1);
      default:           return '';
    }
  };

  const filtered = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const result = reservations.filter((r) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(r, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(r.etat) === etatFilter;
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
  }, [reservations, searchTerm, etatFilter, vehiculesMap, personnelsMap, columnSettings, sortColumn, sortDirection]);

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
    if (sortColumn !== column) return <ArrowUpDown size={13} className="vrs-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="vrs-sort-icon active" />
      : <ArrowDown size={13} className="vrs-sort-icon active" />;
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

  const renderCell = (key, r) => {
    const veh = vehiculesMap[r.vehiculeId];
    const pers = personnelsMap[r.personnelId] ?? { nom: r.personnelNom };
    const meta = ETAT_META[r.etat] ?? ETAT_META[0];
    const EtatIcon = meta.Icon;

    switch (key) {
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vrs-cell-vehicle">
              <div className="vrs-cell-vehicle-icon">
                <Car size={14} strokeWidth={2.2} />
              </div>
              <div className="vrs-cell-vehicle-text">
                <span className="vrs-cell-main">
                  {veh?.matricule || t('Véhicule #{id}', { id: r.vehiculeId })}
                </span>
                {veh?.marque && (
                  <span className="vrs-cell-sub">{veh.marque}</span>
                )}
              </div>
            </div>
          </td>
        );
      case 'conducteur':
        return (
          <td key="conducteur">
            {pers?.nom ? (
              <div className="vrs-cell-driver">
                <div className="vrs-cell-driver-avatar">
                  <User size={14} strokeWidth={2.2} />
                </div>
                <span className="vrs-cell-main">
                  {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                </span>
              </div>
            ) : (
              <span className="vrs-cell-empty">—</span>
            )}
          </td>
        );
      case 'periode':
        return (
          <td key="periode">
            <div className="vrs-cell-period">
              <span className="vrs-period-line">
                <Calendar size={12} strokeWidth={2.5} />
                {formatDateTime(r.dateDebut)}
              </span>
              <span className="vrs-period-sep rtl-miroir">→</span>
              <span className="vrs-period-line end">
                <Flag size={12} strokeWidth={2.5} />
                {formatDateTime(r.dateFin)}
              </span>
            </div>
          </td>
        );
      case 'motif':
        return (
          <td key="motif">
            <span className="vrs-cell-motif">{r.motif || '—'}</span>
          </td>
        );
      case 'etat':
        return (
          <td key="etat">
            <span className={`vrs-pill ${meta.class}`}>
              <EtatIcon size={12} strokeWidth={2.5} />
              {etatLabel(r.etat)}
            </span>
          </td>
        );
      default:
        return null;
    }
  };

  const handleRowClick = (r) => {
    setSelected((prev) => (prev?.id === r.id ? null : r));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    const enregistree = selected
      ? await vehiculeReservationService.update(selected.id, payload)
      : await vehiculeReservationService.create(payload);
    setSelected(null);
    await load();
    return enregistree;
  };

  // Changement rapide d'état depuis la barre d'action, sans passer par la
  // modale. Le backend remplace TOUS les champs à la mise à jour (PUT),
  // donc on renvoie la réservation sélectionnée complète avec uniquement
  // `etat` modifié — sinon les champs obligatoires (vehiculeId, personnelId,
  // dateDebut, dateFin, personnelCreationId...) seraient vidés en base.
  const handleQuickEtat = async (newEtat) => {
    if (!selected || isUpdatingEtat) return;
    setIsUpdatingEtat(true);
    try {
      const payload = {
        vehiculeId: selected.vehiculeId,
        personnelId: selected.personnelId,
        personnelNom: selected.personnelNom,
        dateDebut: selected.dateDebut,
        dateFin: selected.dateFin,
        conducteurId: selected.conducteurId,
        sourceId: selected.sourceId,
        destinationId: selected.destinationId,
        motif: selected.motif,
        projetId: selected.projetId,
        etat: newEtat,
        personnelCreationId: selected.personnelCreationId,
        personnelCreationNom: selected.personnelCreationNom,
        commentaire: selected.commentaire,
      };
      await vehiculeReservationService.update(selected.id, payload);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t("Échec du changement d'état."));
    } finally {
      setIsUpdatingEtat(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer la réservation"),
      message: t('Supprimer cette réservation ? Cette action est irréversible.'),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeReservationService.remove(selected.id);
          setReservations((prev) => prev.filter((r) => r.id !== selected.id));
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
    const entetes = ['Véhicule', 'Conducteur', 'Début', 'Fin', 'Motif', 'État'].map((e) => t(e));
    const lignes = filtered.map((r) => {
      const veh = vehiculesMap[r.vehiculeId];
      const pers = personnelsMap[r.personnelId] ?? { nom: r.personnelNom };
      return [
        (veh?.matricule || '—'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—'),
        formatDateTime(r.dateDebut),
        formatDateTime(r.dateFin),
        (r.motif || '—'),
        etatLabel(r.etat),
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
    a.download = `vehicule-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Réservations véhicule'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? etatLabel(Number(etatFilter)) : '' },
      ],
    });
  };

  const handleStats = () => alert(t("Dashboard à venir."));

  return (
    <div className="vrs-container">

      {/* HEADER */}
      <div className="vrs-header-card">
        <div className="vrs-header-left">
          <button
            type="button"
            className="vrs-header-icon-wrap vrs-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.reservations size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t("Réservations véhicule")}</h2>
            <p className="vrs-header-subtitle">
              {t("Planning des réservations et affectations de véhicules")}
            </p>
          </div>
        </div>

        <div className="vrs-stats">
          <div className="vrs-stat">
            <span className="vrs-stat-value">{stats.total}</span>
            <span className="vrs-stat-label">{t("Total")}</span>
          </div>
          <div className="vrs-stat stat-pending">
            <span className="vrs-stat-value">{stats.enAttente}</span>
            <span className="vrs-stat-label">{t("En attente")}</span>
          </div>
          <div className="vrs-stat stat-confirmed">
            <span className="vrs-stat-value">{stats.confirmees}</span>
            <span className="vrs-stat-label">{t("Confirmées")}</span>
          </div>
          <div className="vrs-stat stat-running">
            <span className="vrs-stat-value">{stats.enCours}</span>
            <span className="vrs-stat-label">{t("En cours")}</span>
          </div>
          <div className="vrs-stat stat-done">
            <span className="vrs-stat-value">{stats.terminees}</span>
            <span className="vrs-stat-label">{t("Terminées")}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vrs-actions-bar">
        <button className="vrs-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>{t("Nouvelle réservation")}</span>
        </button>

        <button
          className={`vrs-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vrs-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>

        <span className="vrs-actions-sep" aria-hidden="true" />

        {ETAT_ACTIONS.map((a) => {
          const Icon = a.Icon;
          const isAllowed = !!selected && a.allowedFrom.includes(selected.etat);
          const disabled = !isAllowed || isUpdatingEtat;
          return (
            <button
              key={a.toEtat}
              type="button"
              className={`vrs-action-btn etat-quick ${a.className} ${disabled ? 'disabled' : ''}`}
              disabled={disabled}
              title={
                !selected
                  ? t("Sélectionne une réservation")
                  : !isAllowed
                    ? t('Non disponible depuis « {etat} »', { etat: etatLabel(selected.etat) })
                    : t(a.label)
              }
              onClick={() => handleQuickEtat(a.toEtat)}
            >
              {isUpdatingEtat && isAllowed ? (
                <Loader2 size={18} strokeWidth={2.2} className="vrs-spin" />
              ) : (
                <Icon size={18} strokeWidth={2.2} />
              )}
              <span>{t(a.label)}</span>
            </button>
          );
        })}
      </div>

      {/* FILTRES */}
      <div className="vrs-filter-panel">
        <div className="vrs-filter-group">
          <span className="vrs-filter-label">
            <Search size={14} strokeWidth={2.5} />
            {t("Recherche")}
          </span>
          <div className="vrs-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vrs-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vrs-filter-group">
          <span className="vrs-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            {t("État")}
          </span>
          <div className="vrs-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous les états")}</option>
              {Object.entries(ETAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vrs-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          {t("Réinitialiser")}
        </button>

        <div className="vrs-export-stack">
          <button className="vrs-export-btn excel" onClick={handleExportExcel} title={t("Export CSV")}>
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vrs-export-btn print" onClick={handleImprimerListe} title={t("Imprimer")}>
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vrs-export-btn stats" onClick={handleStats} title={t("Stats")}>
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vrs-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vrs-table-wrap">
        <table className="vrs-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`vrs-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="vrs-th-inner">
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
                <td colSpan={visibleColumns.length || 1} className="vrs-table-empty">
                  <div className="vrs-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vrs-spin" />
                    <span>{t("Chargement des réservations...")}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vrs-table-empty">
                  <div className="vrs-empty-state">
                    <CalendarCheck size={32} strokeWidth={1.6} />
                    <span>
                      {reservations.length === 0
                        ? t("Aucune réservation pour l'instant.")
                        : t("Aucune réservation ne correspond à ces filtres.")}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`vrs-row ${selected?.id === r.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(r)}
                  onDoubleClick={() => { window.getSelection?.()?.removeAllRanges(); setSelected(r); setModalOpen(true); }}
                  title={t('Double-clic pour ouvrir la fiche')}
                >
                  {visibleColumns.map((c) => renderCell(c.key, r))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <VehiculeReservationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        reservation={selected}
        isEditing={!!selected}
      />

      {/* PARAMÈTRES DES COLONNES */}
      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="reservation"
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