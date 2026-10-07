import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Bookmark, Navigation, Wrench, Ban, XCircle, Tag, Loader2,
  AlertTriangle, Settings, Truck, ShieldCheck, HardHat, AlertOctagon,
  ChevronLeft, ChevronRight, ArrowLeft, Printer, FileText, Gauge,
  Info, Activity, History as HistoryIcon,
} from 'lucide-react';
import vehiculeService from '../../../../services/vehiculeService';
import vehiculeMaintenanceService from '../../../../services/vehiculeMaintenanceService';
import VehiculeMaintenancePanel from './VehiculeMaintenancePanel';
import VehiculeModal from '../../../ui/modals/VehiculeModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import VehiculeMaintenanceTypesSettings from './VehiculeMaintenanceTypesSettings';
import VehiculeKilometrageHistorique from './VehiculeKilometrageHistorique';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import {
  ETAT_VEHICULE_LABELS,
  etatVehiculeLabel,
  etatVehiculeColor,
  allowedNextEtats,
} from '../../../../constants/vehiculeEtat';
import { criticiteLabel, criticiteColor } from '../../../../constants/Criticite';
import './VehiculesPage.css';

const PAGE_SIZE = 10;

const TYPE_LABELS = {
  0: 'Véhicule léger',
  1: 'Camion',
  2: 'Engin',
  3: 'Tracteur',
  4: 'Autre',
};

function typeLabel(type) {
  return TYPE_LABELS[type] ?? `Type ${type}`;
}

const ETAT_TARGET_ICON = {
  0: CheckCircle2,
  1: Bookmark,
  2: Navigation,
  3: Wrench,
  4: Ban,
  5: XCircle,
  6: Tag,
};

const getPageNumbers = (current, total) => {
  const pages = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i += 1) pages.push(i);
    return pages;
  }

  pages.push(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('...');

  for (let i = start; i <= end; i += 1) pages.push(i);

  if (end < total - 1) pages.push('...');

  pages.push(total);

  return pages;
};

const VEHICULE_COLUMNS_DEFAULT = [
  { key: 'matricule',   label: 'Matricule',   visible: true,  searchable: true  },
  { key: 'marque',      label: 'Marque',      visible: true,  searchable: true  },
  { key: 'numChassis',  label: 'N° Châssis',  visible: false, searchable: true  },
  { key: 'type',        label: 'Type',        visible: true,  searchable: true  },
  { key: 'kilometrage', label: 'Kilométrage', visible: true,  searchable: false },
  { key: 'etat',        label: 'État',        visible: true,  searchable: true  },
  { key: 'criticite',   label: 'Criticité',   visible: true,  searchable: true  },
];

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ─── Vue : 'list' ou 'details' ──────────────────────────────────────
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('infos');

  // Filtres "brouillon"
  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  // Filtres appliqués
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    etatFilter: 'all',
  });

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedVehicule, setSelectedVehicule] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingEtat, setIsUpdatingEtat] = useState(false);

  const [alertesMaintenance, setAlertesMaintenance] = useState({});

  const [columnSettings, setColumnSettings] = useState(VEHICULE_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: 'Confirmer',
    onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await vehiculeService.getAll(0, 100);
      setVehicules(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les véhicules. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!vehicules.length) {
      setAlertesMaintenance({});
      return;
    }

    let annule = false;

    (async () => {
      const entrees = await Promise.all(
        vehicules.map(async (v) => {
          try {
            const statuts = await vehiculeMaintenanceService.getStatuts(v.id);
            return [
              v.id,
              {
                enRetard: statuts.filter((st) => st.statut === 'EN_RETARD').length,
                aVenir: statuts.filter(
                  (st) => st.statut === 'A_VENIR' || st.statut === 'ATTEINT'
                ).length,
              },
            ];
          } catch {
            return [v.id, { enRetard: 0, aVenir: 0 }];
          }
        })
      );
      if (!annule) setAlertesMaintenance(Object.fromEntries(entrees));
    })();

    return () => {
      annule = true;
    };
  }, [vehicules]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedVehicule) return;
    const fresh = vehicules.find((v) => v.id === selectedVehicule.id);
    if (fresh && fresh !== selectedVehicule) setSelectedVehicule(fresh);
    if (!fresh) setSelectedVehicule(null);
  }, [vehicules]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers colonnes ────────────────────────────────────────────────
  const openColumnSettings = () => {
    setColumnSettingsInstanceKey((k) => k + 1);
    setShowColumnSettings(true);
  };

  const isColVisible = (key) => {
    const col = columnSettings.find((c) => c.key === key);
    return col ? col.visible : true;
  };

  const toggleColumnVisibility = (key) => {
    setColumnSettings((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const toggleColumnSearchability = (key) => {
    setColumnSettings((prev) =>
      prev.map((col) => (col.key === key ? { ...col, searchable: !col.searchable } : col))
    );
  };

  const getColumnSearchValue = (v, key) => {
    switch (key) {
      case 'matricule':   return v.matricule || '';
      case 'marque':      return v.marque || '';
      case 'numChassis':  return v.numChassis || '';
      case 'type':        return typeLabel(v.type);
      case 'kilometrage': return v.kilometrage != null ? String(v.kilometrage) : '';
      case 'etat':        return etatVehiculeLabel(v.etat);
      case 'criticite':   return v.criticite
        ? `${v.criticite} ${criticiteLabel(v.criticite)}`
        : '';
      default:            return '';
    }
  };

  const filteredVehicules = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = appliedFilters.searchTerm.toLowerCase();

    return vehicules.filter((v) => {
      const matchesSearch = !term
        ? true
        : searchableCols.some((key) => {
            const val = getColumnSearchValue(v, key);
            return val && val.toString().toLowerCase().includes(term);
          });

      const matchesEtat =
        appliedFilters.etatFilter === 'all' ||
        String(v.etat ?? 0) === appliedFilters.etatFilter;

      return matchesSearch && matchesEtat;
    });
  }, [vehicules, appliedFilters, columnSettings]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicules.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);

  const paginatedVehicules = useMemo(
    () =>
      filteredVehicules.slice(
        (currentPageSafe - 1) * PAGE_SIZE,
        currentPageSafe * PAGE_SIZE
      ),
    [filteredVehicules, currentPageSafe]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  // ─── Actions filtres ────────────────────────────────────────────────
  const handleSearch = () => {
    setAppliedFilters({ searchTerm, etatFilter });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
    setAppliedFilters({ searchTerm: '', etatFilter: 'all' });
  };

  // ─── Sélection / navigation vers détails ────────────────────────────
  const handleRowClick = (vehicule) => {
    setSelectedVehicule((prev) => (prev?.id === vehicule.id ? null : vehicule));
  };

  const handleViewDetails = () => {
    if (selectedVehicule) {
      setActiveTab('infos');
      setViewMode('details');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setActiveTab('infos');
  };

  const openCreate = () => {
    setSelectedVehicule(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedVehicule) return;
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (selectedVehicule) {
      await vehiculeService.update(selectedVehicule.id, payload);
    } else {
      await vehiculeService.create(payload);
    }
    setSelectedVehicule(null);
    await load();
  };

  const handleQuickEtat = async (newEtat) => {
    if (!selectedVehicule || isUpdatingEtat) return;
    setIsUpdatingEtat(true);
    try {
      await vehiculeService.changeEtat(selectedVehicule.id, newEtat);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Échec du changement d'état.");
    } finally {
      setIsUpdatingEtat(false);
    }
  };

  const handleBonCree = () => {
    load();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedVehicule || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le véhicule',
      message: `Supprimer le véhicule "${selectedVehicule.matricule}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeService.remove(selectedVehicule.id);
          setVehicules((prev) => prev.filter((v) => v.id !== selectedVehicule.id));
          setSelectedVehicule(null);
          if (viewMode === 'details') setViewMode('list');
        } catch (err) {
          console.error(err);
          alert("Échec de la suppression de ce véhicule.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Matricule', 'Marque', 'N° Châssis', 'Type', 'Kilométrage', 'État'];
    const lignes = filteredVehicules.map((v) => [
      (v.matricule || '').replace(/"/g, '""'),
      (v.marque || '—').replace(/"/g, '""'),
      (v.numChassis || '—').replace(/"/g, '""'),
      typeLabel(v.type),
      v.kilometrage != null ? String(v.kilometrage) : '—',
      etatVehiculeLabel(v.etat),
    ]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert('Ouvre le dashboard des véhicules pour les statistiques détaillées.');
  };

  const nextEtats = allowedNextEtats(selectedVehicule?.etat);

  const stats = useMemo(() => {
    const total = vehicules.length;
    const enService = vehicules.filter((v) => (v.etat ?? 0) === 0).length;
    const enMaintenance = vehicules.filter((v) => (v.etat ?? 0) === 3).length;
    const enAlerte = Object.values(alertesMaintenance).filter(
      (a) => a.enRetard > 0
    ).length;
    return { total, enService, enMaintenance, enAlerte };
  }, [vehicules, alertesMaintenance]);

  const TABLE_COLUMNS_DEF = {
    matricule: {
      label: 'Matricule',
      cell: (v) => (
        <td key="matricule">
          <span className="vehicules-matricule-badge">
            {v.matricule || `#${v.id}`}
          </span>
        </td>
      ),
    },
    marque: {
      label: 'Marque',
      cell: (v) => <td key="marque">{v.marque || '—'}</td>,
    },
    numChassis: {
      label: 'N° Châssis',
      cell: (v) => <td key="numChassis">{v.numChassis || '—'}</td>,
    },
    type: {
      label: 'Type',
      cell: (v) => <td key="type">{typeLabel(v.type)}</td>,
    },
    kilometrage: {
      label: 'Kilométrage',
      cell: (v) => (
        <td key="kilometrage">
          {v.kilometrage != null
            ? `${Number(v.kilometrage).toLocaleString('fr-FR')} km`
            : '—'}
          {alertesMaintenance[v.id]?.enRetard > 0 && (
            <span
              className="vp-badge-retard"
              title={`${alertesMaintenance[v.id].enRetard} maintenance(s) en retard`}
            >
              <AlertTriangle size={12} strokeWidth={2.5} />
              {alertesMaintenance[v.id].enRetard}
            </span>
          )}
        </td>
      ),
    },
    etat: {
      label: 'État',
      cell: (v) => (
        <td key="etat">
          <span className={`vehicules-pill color-${etatVehiculeColor(v.etat)}`}>
            {etatVehiculeLabel(v.etat)}
          </span>
        </td>
      ),
    },
    criticite: {
      label: 'Criticité',
      cell: (v) => (
        <td key="criticite">
          <span className={`vehicules-pill color-${criticiteColor(v.criticite)}`}>
            {v.criticite || 'C3'} · {criticiteLabel(v.criticite)}
          </span>
        </td>
      ),
    },
  };

  const visibleColumns = columnSettings.filter((c) => c.visible);

  // ════════════════════════════════════════════════════════════════
  //  VUE DÉTAILS (page séparée, avec onglets)
  // ════════════════════════════════════════════════════════════════
  if (viewMode === 'details' && selectedVehicule) {
    const km = selectedVehicule.kilometrage != null
      ? `${Number(selectedVehicule.kilometrage).toLocaleString('fr-FR')} km`
      : '—';

    const TABS = [
      { key: 'infos',       label: 'Informations générales', icon: Info },
      { key: 'maintenance', label: 'Maintenance préventive', icon: Wrench },
      { key: 'historique',  label: 'Historique du compteur', icon: HistoryIcon },
    ];

    return (
      <div className="vehicules-container">
        <div className="vd-page">

          {/* ═══════════════ HERO ═══════════════ */}
          <header className="vd-hero">
            <div className="vd-hero-bg" aria-hidden="true" />

            <div className="vd-hero-content">
              <div className="vd-hero-topbar">
                <button
                  type="button"
                  className="vd-hero-back"
                  onClick={handleBackToList}
                >
                  <ArrowLeft size={16} strokeWidth={2.4} />
                  Retour à la liste
                </button>

                <div className="vd-hero-actions">
                  <button
                    type="button"
                    className="vd-hero-btn"
                    onClick={openEdit}
                  >
                    <FileText size={16} strokeWidth={2.4} />
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="vd-hero-btn"
                    onClick={handlePrint}
                  >
                    <Printer size={16} strokeWidth={2.4} />
                    Imprimer
                  </button>
                </div>
              </div>

              <div className="vd-hero-main">
                <div className="vd-hero-left">
                  <div className="vd-hero-icon">
                    <Truck size={24} strokeWidth={2.2} />
                  </div>

                  <div className="vd-hero-text">
                    <span className="vd-hero-eyebrow">Fiche détaillée</span>
                    <h3 className="vd-hero-title">
                      {selectedVehicule.matricule || `#${selectedVehicule.id}`}
                    </h3>
                    {selectedVehicule.marque && (
                      <p className="vd-hero-sub">{selectedVehicule.marque}</p>
                    )}
                  </div>
                </div>

                <div className="vd-hero-chips">
                  <span className="vd-hero-chip">
                    <Truck size={14} strokeWidth={2.4} />
                    {typeLabel(selectedVehicule.type)}
                  </span>
                  <span className="vd-hero-chip">
                    <Gauge size={14} strokeWidth={2.4} />
                    <strong>{km}</strong>
                  </span>
                  <span className="vd-hero-chip vd-hero-chip-state">
                    {etatVehiculeLabel(selectedVehicule.etat)}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* ═══════════════ KPI CARDS ═══════════════ */}
          <div className="vd-kpi-grid">
            <div className="vd-kpi kpi-blue">
              <div className="vd-kpi-icon">
                <Truck size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">{typeLabel(selectedVehicule.type)}</span>
                <span className="vd-kpi-label">Type de véhicule</span>
              </div>
            </div>

            <div className="vd-kpi kpi-teal">
              <div className="vd-kpi-icon">
                <Gauge size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">{km}</span>
                <span className="vd-kpi-label">Kilométrage actuel</span>
              </div>
            </div>

            <div className="vd-kpi kpi-amber">
              <div className="vd-kpi-icon">
                <AlertOctagon size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">
                  {selectedVehicule.criticite || 'C3'}
                </span>
                <span className="vd-kpi-label">
                  Criticité · {criticiteLabel(selectedVehicule.criticite)}
                </span>
              </div>
            </div>

            <div className="vd-kpi kpi-green">
              <div className="vd-kpi-icon">
                <CheckCircle2 size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">
                  {etatVehiculeLabel(selectedVehicule.etat)}
                </span>
                <span className="vd-kpi-label">État actuel</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ONGLETS
              ═══════════════════════════════════════════════════════════ */}
          <div className="vd-tabs-container">
            <nav className="vd-tabs" role="tablist">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`vd-tabpanel-${tab.key}`}
                    className={`vd-tab ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <span className="vd-tab-icon">
                      <TabIcon size={16} strokeWidth={2.4} />
                    </span>
                    <span className="vd-tab-label">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="vd-tab-content">

              {/* ═══════ ONGLET 1 : INFORMATIONS GÉNÉRALES ═══════ */}
              {activeTab === 'infos' && (
                <div
                  className="vd-tabpanel"
                  role="tabpanel"
                  id="vd-tabpanel-infos"
                >
                  <div className="vd-card">
                    <dl className="vd-dl">
                      <div>
                        <dt>
                          <FileText size={13} strokeWidth={2.4} />
                          Matricule
                        </dt>
                        <dd>
                          <span className="vd-mono">
                            {selectedVehicule.matricule || '—'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <Truck size={13} strokeWidth={2.4} />
                          Marque
                        </dt>
                        <dd>{selectedVehicule.marque || '—'}</dd>
                      </div>
                      <div>
                        <dt>
                          <FileText size={13} strokeWidth={2.4} />
                          N° Châssis
                        </dt>
                        <dd>
                          <span className="vd-mono">
                            {selectedVehicule.numChassis || '—'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <Truck size={13} strokeWidth={2.4} />
                          Type
                        </dt>
                        <dd>{typeLabel(selectedVehicule.type)}</dd>
                      </div>
                      <div>
                        <dt>
                          <Gauge size={13} strokeWidth={2.4} />
                          Kilométrage
                        </dt>
                        <dd>{km}</dd>
                      </div>
                      <div>
                        <dt>
                          <AlertOctagon size={13} strokeWidth={2.4} />
                          Criticité
                        </dt>
                        <dd>
                          <span className={`vehicules-pill color-${criticiteColor(selectedVehicule.criticite)}`}>
                            {selectedVehicule.criticite || 'C3'} · {criticiteLabel(selectedVehicule.criticite)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <CheckCircle2 size={13} strokeWidth={2.4} />
                          État actuel
                        </dt>
                        <dd>
                          <span className={`vehicules-pill color-${etatVehiculeColor(selectedVehicule.etat)}`}>
                            {etatVehiculeLabel(selectedVehicule.etat)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {/* ═══════ ONGLET 2 : MAINTENANCE PRÉVENTIVE ═══════ */}
              {activeTab === 'maintenance' && (
                <div
                  className="vd-tabpanel"
                  role="tabpanel"
                  id="vd-tabpanel-maintenance"
                >
                  <VehiculeMaintenancePanel
                    vehicule={selectedVehicule}
                    onOpenBon={(bonId) => { window.location.href = `/bons-maintenance?id=${bonId}`; }}
                    onBonCree={handleBonCree}
                  />
                </div>
              )}

              {/* ═══════ ONGLET 3 : HISTORIQUE DU COMPTEUR ═══════ */}
              {activeTab === 'historique' && (
                <div
                  className="vd-tabpanel"
                  role="tabpanel"
                  id="vd-tabpanel-historique"
                >
                  <VehiculeKilometrageHistorique vehiculeId={selectedVehicule.id} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modales accessibles depuis la vue détails */}
        <VehiculeModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          vehicule={selectedVehicule}
          isEditing={!!selectedVehicule}
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

  return (
    <div className="vehicules-container">

      <div className="vehicules-header-card">
        <div className="vehicules-header-title-box">
          <button
            type="button"
            className="vehicules-header-icon vehicules-header-icon-btn"
            onClick={openColumnSettings}
            title="Paramètres des colonnes"
            aria-label="Paramètres des colonnes"
          >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
</svg>
          </button>
          <div>
            <h2>Véhicules</h2>
            <p className="vehicules-header-subtitle">
              Parc de véhicules suivis (matricule, marque, cycle de vie...)
            </p>
          </div>
        </div>
        <span className="vehicules-badge-total">Total : {filteredVehicules.length}</span>
      </div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <div className="vehicules-kpi-grid">
        <div className="vehicules-kpi-card kpi-total">
          <div className="vehicules-kpi-icon">
            <Truck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.total}</span>
            <span className="vehicules-kpi-label">Véhicules au total</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-service">
          <div className="vehicules-kpi-icon">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enService}</span>
            <span className="vehicules-kpi-label">En service</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-maintenance">
          <div className="vehicules-kpi-icon">
            <HardHat size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enMaintenance}</span>
            <span className="vehicules-kpi-label">En maintenance</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-alerte">
          <div className="vehicules-kpi-icon">
            <AlertOctagon size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enAlerte}</span>
            <span className="vehicules-kpi-label">Alertes actives</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ ACTIONS BAR ═══════════════ */}
      <div className="vehicules-actions-bar">
        <button className="vehicules-action-btn ajouter" onClick={openCreate}>
          <span className="vehicules-action-icon">+</span>
          <span>Ajouter</span>
        </button>

        <button
          className={`vehicules-action-btn details ${!selectedVehicule ? 'disabled' : ''}`}
          disabled={!selectedVehicule}
          onClick={handleViewDetails}
          style={{
            color: '#0284c7',
            borderColor: 'rgba(2, 132, 199, 0.2)',
          }}
        >
          <FileText size={16} strokeWidth={2.5} />
          <span>Détails</span>
        </button>

        <button
          className={`vehicules-action-btn modifier ${!selectedVehicule ? 'disabled' : ''}`}
          disabled={!selectedVehicule}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`vehicules-action-btn supprimer ${(!selectedVehicule || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedVehicule || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>

        {selectedVehicule && (
          <>
            <span className="vehicules-actions-sep" aria-hidden="true" />
            {nextEtats.length === 0 ? (
              <span className="vehicules-etat-locked">
                {etatVehiculeLabel(selectedVehicule.etat)} — état terminal, aucune action.
              </span>
            ) : (
              nextEtats.map((target) => {
                const Icon = ETAT_TARGET_ICON[target] ?? CheckCircle2;
                return (
                  <button
                    key={target}
                    type="button"
                    className={`vehicules-action-btn etat-quick color-${etatVehiculeColor(target)} ${isUpdatingEtat ? 'disabled' : ''}`}
                    disabled={isUpdatingEtat}
                    title={`Passer à : ${etatVehiculeLabel(target)}`}
                    onClick={() => handleQuickEtat(target)}
                  >
                    {isUpdatingEtat ? (
                      <Loader2 size={16} strokeWidth={2.5} className="vehicules-spin" />
                    ) : (
                      <Icon size={16} strokeWidth={2.5} />
                    )}
                    <span>{etatVehiculeLabel(target)}</span>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ═══════════════ FILTER PANEL ═══════════════ */}
      <div className="vehicules-filter-panel">
        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">Recherche</span>
          <div className="vehicules-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par matricule, marque, châssis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
        </div>

        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">État</span>
          <div className="vehicules-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous</option>
              {Object.entries(ETAT_VEHICULE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="vehicules-search-btn"
          onClick={handleSearch}
          title="Appliquer les filtres"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Chercher
        </button>

        <button className="vehicules-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>

        <button
          type="button"
          className="vp-settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="Paramétrer les seuils de maintenance préventive"
        >
          <Settings size={16} /> Paramètres maintenance
        </button>

        <div className="vehicules-export-stack">
          <button className="vehicules-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button className="vehicules-export-btn print" title="Imprimer" onClick={handlePrint}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM9 9V5a2 2 0 012-2h2a2 2 0 012 2v4M7 13h10" />
            </svg>
          </button>
          <button className="vehicules-export-btn stats" title="Statistiques" onClick={handleStats}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="vehicules-error-banner">{error}</div>}

      {/* ═══════════════ TABLE ═══════════════ */}
      <div className="vehicules-table-wrap">
        <table className="vehicules-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => {
                const def = TABLE_COLUMNS_DEF[c.key];
                if (!def) return null;
                return <th key={c.key}>{def.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vehicules-table-empty">
                  Chargement...
                </td>
              </tr>
            ) : paginatedVehicules.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vehicules-table-empty">
                  {vehicules.length === 0
                    ? "Aucun véhicule pour l'instant. Ajoute le premier avec le bouton ci-dessus."
                    : "Aucun véhicule ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              paginatedVehicules.map((v) => (
                <tr
                  key={v.id}
                  className={`vehicules-row ${selectedVehicule?.id === v.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(v)}
                  onDoubleClick={() => {
                    setSelectedVehicule(v);
                    setActiveTab('infos');
                    setViewMode('details');
                  }}
                >
                  {visibleColumns.map((c) => TABLE_COLUMNS_DEF[c.key]?.cell(v))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ═══════════════ PAGINATION ═══════════════ */}
        <div className="table-footer-pagination">
          <div className="pagination-left">
            {filteredVehicules.length} véhicule(s)
            {filteredVehicules.length > 0 ? (
              <>
                {' '}— {(currentPageSafe - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPageSafe * PAGE_SIZE, filteredVehicules.length)}{' '}
                affiché(s)
              </>
            ) : (
              <> — Page 1 / 1</>
            )}
          </div>

          <div className="pagination-right">
            <button
              type="button"
              className="pag-btn"
              disabled={currentPageSafe <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Page précédente"
              aria-label="Page précédente"
            >
              <ChevronLeft size={14} />
            </button>

            {getPageNumbers(currentPageSafe, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="pag-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`pag-btn ${p === currentPageSafe ? 'active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                  disabled={totalPages <= 1}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="pag-btn"
              disabled={currentPageSafe >= totalPages || totalPages <= 1}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Page suivante"
              aria-label="Page suivante"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ MODALES ═══════════════ */}
      {settingsOpen && (
        <div className="vp-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="vp-settings-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="vp-settings-close"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
            <VehiculeMaintenanceTypesSettings />
          </div>
        </div>
      )}

      <VehiculeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        vehicule={selectedVehicule}
        isEditing={!!selectedVehicule}
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
        type="vehicule"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />
    </div>
  );
}