import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Bookmark, Navigation, Wrench, Ban, XCircle, Tag, Loader2,
  AlertTriangle, Settings, Truck, ShieldCheck, HardHat, AlertOctagon,
  ChevronLeft, ChevronRight, ArrowLeft, Printer, FileText, Gauge,
  Info, Activity, History as HistoryIcon, Wallet, ChartColumn, Download, Search, SquarePen, Trash2 } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeService from '../../../../services/vehiculeService';
import vehiculeMaintenanceService from '../../../../services/vehiculeMaintenanceService';
import VehiculeMaintenancePanel from './VehiculeMaintenancePanel';
import VehiculeModal from '../../../ui/modals/VehiculeModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import VehiculeMaintenanceTypesSettings from './VehiculeMaintenanceTypesSettings';
import VehiculeKilometrageHistorique from './VehiculeKilometrageHistorique';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import PageModal from '../../../ui/modals/PageModal';
import VehiculeCouts from '../VehiculeCouts/VehiculeCouts';
import { VehiculeCoutOnglet } from '../VehiculeCouts/VehiculeCoutDetail';
import CoutsParcResume from '../VehiculeCouts/CoutsParcResume';
import {
  ETAT_VEHICULE_LABELS,
  etatVehiculeLabel,
  etatVehiculeColor,
  allowedNextEtats,
} from '../../../../constants/vehiculeEtat';
import { criticiteLabel, criticiteColor } from '../../../../constants/Criticite';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe, imprimerFiche } from '../../../../utils/imprimerListe';
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
  return TYPE_LABELS[type] ? t(TYPE_LABELS[type]) : t('Type {n}', { n: type });
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
  // Fenêtre « Coût par véhicule » (tout le parc)
  const [coutsOpen, setCoutsOpen] = useState(false);
  // Recharge le bandeau des coûts après la fenêtre (des frais ont pu être saisis)
  const [coutsVersion, setCoutsVersion] = useState(0);
  const fermerCouts = () => { setCoutsOpen(false); setCoutsVersion((v) => v + 1); };

  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('infos');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

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
    confirmText: t("Confirmer"),
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
      setError(t("Impossible de charger les véhicules. Vérifie que le serveur est bien lancé."));
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
      // libellé français + traduit : la recherche marche dans les deux langues
      case 'etat':        return `${etatVehiculeLabel(v.etat)} ${t(etatVehiculeLabel(v.etat))}`;
      case 'criticite':   return v.criticite
        ? `${v.criticite} ${criticiteLabel(v.criticite)} ${t(criticiteLabel(v.criticite))}`
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

  const handleSearch = () => {
    setAppliedFilters({ searchTerm, etatFilter });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
    setAppliedFilters({ searchTerm: '', etatFilter: 'all' });
  };

  const handleRowClick = (vehicule) => {
    setSelectedVehicule((prev) => (prev?.id === vehicule.id ? null : vehicule));
  };

  const handleViewDetails = () => {
    if (selectedVehicule && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTab('infos');
        setViewMode('details');
        setIsTransitioning(false);
      }, 180);
    }
  };

  const handleBackToList = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode('list');
      setActiveTab('infos');
      setIsTransitioning(false);
    }, 180);
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
      alert(err.response?.data?.message || t("Échec du changement d'état."));
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
      title: t("Supprimer le véhicule"),
      message: t('Supprimer le véhicule « {m} » ? Cette action est irréversible.', { m: selectedVehicule.matricule }),
      confirmText: t("Supprimer"),
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
          alert(t("Échec de la suppression de ce véhicule."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Matricule', 'Marque', 'N° Châssis', 'Type', 'Kilométrage', 'État'].map((e) => t(e));
    const lignes = filteredVehicules.map((v) => [
      (v.matricule || ''),
      (v.marque || '—'),
      (v.numChassis || '—'),
      typeLabel(v.type),
      v.kilometrage != null ? String(v.kilometrage) : '—',
      t(etatVehiculeLabel(v.etat)),
    ]);
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
    lien.download = `vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Véhicules'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: appliedFilters.searchTerm.trim() },
        { label: t('État'), valeur: appliedFilters.etatFilter !== 'all' ? t(ETAT_VEHICULE_LABELS[appliedFilters.etatFilter] ?? appliedFilters.etatFilter) : '' },
      ],
    });
  };

  // Impression de la fiche du véhicule (A4 portrait) : infos, maintenance préventive, derniers relevés
  const STATUT_MAINTENANCE = { OK: 'À jour', A_VENIR: 'À venir', ATTEINT: 'Atteint', EN_RETARD: 'En retard', EN_COURS: 'En cours' };
  const SOURCE_RELEVE = {
    MISSION: 'Mission', BON_CARBURANT: 'Bon carburant', SAISIE_ADMINISTRATEUR: 'Saisie manuelle', CORRECTION_VEHICULE: 'Correction (fiche véhicule)',
    MAINTENANCE: 'Maintenance', INCIDENT: 'Incident',
  };
  const kmTexte = (v) => (v == null ? '' : t('{n} km', { n: Number(v).toLocaleString(locale()) }));
  const handlePrint = async () => {
    const v = selectedVehicule;
    if (!v) return;
    const [statuts, releves] = await Promise.all([
      vehiculeMaintenanceService.getStatuts(v.id).catch(() => []),
      vehiculeService.getHistoriqueKilometrage(v.id, 0, 10).then((p) => p?.content ?? []).catch(() => []),
    ]);
    imprimerFiche({
      titre: v.matricule || `#${v.id}`,
      sousTitre: [t('Fiche détaillée'), v.marque].filter(Boolean).join(' · '),
      reference: typeLabel(v.type),
      statut: t(etatVehiculeLabel(v.etat)),
      sections: [
        {
          titre: t('Informations générales'),
          champs: [
            { label: t('Matricule'), valeur: v.matricule },
            { label: t('Marque'), valeur: v.marque },
            { label: t('N° Châssis'), valeur: v.numChassis },
            { label: t('Type'), valeur: typeLabel(v.type) },
            { label: t('Kilométrage'), valeur: kmTexte(v.kilometrage) },
            { label: t('Criticité'), valeur: `${v.criticite || 'C3'} · ${t(criticiteLabel(v.criticite))}` },
            { label: t('État actuel'), valeur: t(etatVehiculeLabel(v.etat)) },
          ],
        },
        {
          titre: t('Maintenance préventive'),
          colonnes: [t('Opération'), t('Statut'), { label: t('Intervalle'), align: 'end' }, { label: t('Prochain seuil'), align: 'end' }, { label: t('Restant'), align: 'end' }],
          lignes: (statuts ?? []).map((s) => [
            s.typeLibelle,
            STATUT_MAINTENANCE[s.statut] ? t(STATUT_MAINTENANCE[s.statut]) : s.statut,
            kmTexte(s.intervalleKm),
            kmTexte(s.prochainSeuilKm),
            s.kmRestants == null ? '' : s.kmRestants < 0
              ? t('{duree} de retard', { duree: kmTexte(Math.abs(s.kmRestants)) })
              : kmTexte(s.kmRestants),
          ]),
          vide: t('Aucun type de maintenance configuré.'),
        },
        {
          titre: t('Derniers relevés kilométriques'),
          colonnes: [t('Date'), { label: t('Relevé'), align: 'end' }, t('Source')],
          lignes: (releves ?? []).map((r) => [
            r.date ? new Date(r.date).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '',
            kmTexte(r.kilometrage),
            SOURCE_RELEVE[r.source] ? t(SOURCE_RELEVE[r.source]) : r.source,
          ]),
          vide: t('Aucun relevé enregistré pour ce véhicule.'),
        },
      ],
      signatures: [t('Responsable parc'), t('Conducteur')],
    });
  };

  const handleStats = () => {
    alert(t("Ouvre le dashboard des véhicules pour les statistiques détaillées."));
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
      label: t("Matricule"),
      cell: (v) => (
        <td key="matricule">
          <span className="vehicules-matricule-badge">
            {v.matricule || `#${v.id}`}
          </span>
        </td>
      ),
    },
    marque: {
      label: t("Marque"),
      cell: (v) => <td key="marque">{v.marque || '—'}</td>,
    },
    numChassis: {
      label: t("N° Châssis"),
      cell: (v) => <td key="numChassis">{v.numChassis || '—'}</td>,
    },
    type: {
      label: t("Type"),
      cell: (v) => <td key="type">{typeLabel(v.type)}</td>,
    },
    kilometrage: {
      label: t("Kilométrage"),
      cell: (v) => (
        <td key="kilometrage">
          {v.kilometrage != null
            ? t('{n} km', { n: Number(v.kilometrage).toLocaleString(locale()) })
            : '—'}
          {alertesMaintenance[v.id]?.enRetard > 0 && (
            <span
              className="vp-badge-retard"
              title={tp('maintenance en retard', alertesMaintenance[v.id].enRetard)}
            >
              <AlertTriangle size={12} strokeWidth={2.5} />
              {alertesMaintenance[v.id].enRetard}
            </span>
          )}
        </td>
      ),
    },
    etat: {
      label: t("État"),
      cell: (v) => (
        <td key="etat">
          <span className={`vehicules-pill color-${etatVehiculeColor(v.etat)}`}>
            {t(etatVehiculeLabel(v.etat))}
          </span>
        </td>
      ),
    },
    criticite: {
      label: t("Criticité"),
      cell: (v) => (
        <td key="criticite">
          <span className={`vehicules-pill color-${criticiteColor(v.criticite)}`}>
            {v.criticite || 'C3'} · {t(criticiteLabel(v.criticite))}
          </span>
        </td>
      ),
    },
  };

  const visibleColumns = columnSettings.filter((c) => c.visible);

  if (viewMode === 'details' && selectedVehicule) {
    const km = selectedVehicule.kilometrage != null
      ? t('{n} km', { n: Number(selectedVehicule.kilometrage).toLocaleString(locale()) })
      : '—';

    const TABS = [
      { key: 'infos',       label: t("Informations générales"), icon: Info },
      { key: 'maintenance', label: t("Maintenance préventive"), icon: Wrench },
      { key: 'historique',  label: t("Historique du compteur"), icon: HistoryIcon },
      { key: 'cout',        label: t("Coût"), icon: Wallet },
    ];

    return (
      <div className={`vehicules-container ${isTransitioning ? 'is-transitioning' : ''}`}>
        <div className="vd-page">

          <header className="vd-hero">
            <div className="vd-hero-bg" aria-hidden="true" />

            <div className="vd-hero-content">
              <div className="vd-hero-topbar">
                <button
                  type="button"
                  className="vd-hero-back"
                  onClick={handleBackToList}
                >
                  <ArrowLeft size={16} strokeWidth={2.4} className="rtl-miroir" />
                  {t("Retour à la liste")}
                </button>

                <div className="vd-hero-actions">
                  <button
                    type="button"
                    className="vd-hero-btn"
                    onClick={openEdit}
                  >
                    <FileText size={16} strokeWidth={2.4} />
                    {t("Modifier")}
                  </button>
                  <button
                    type="button"
                    className="vd-hero-btn"
                    onClick={handlePrint}
                  >
                    <Printer size={16} strokeWidth={2.4} />
                    {t("Imprimer")}
                  </button>
                </div>
              </div>

              <div className="vd-hero-main">
                <div className="vd-hero-left">
                  <div className="vd-hero-icon">
                    <Truck size={24} strokeWidth={2.2} />
                  </div>

                  <div className="vd-hero-text">
                    <span className="vd-hero-eyebrow">{t("Fiche détaillée")}</span>
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
                    {t(etatVehiculeLabel(selectedVehicule.etat))}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="vd-kpi-grid">
            <div className="vd-kpi kpi-blue">
              <div className="vd-kpi-icon">
                <Truck size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">{typeLabel(selectedVehicule.type)}</span>
                <span className="vd-kpi-label">{t("Type de véhicule")}</span>
              </div>
            </div>

            <div className="vd-kpi kpi-teal">
              <div className="vd-kpi-icon">
                <Gauge size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">{km}</span>
                <span className="vd-kpi-label">{t("Kilométrage actuel")}</span>
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
                  {t("Criticité")} · {t(criticiteLabel(selectedVehicule.criticite))}
                </span>
              </div>
            </div>

            <div className="vd-kpi kpi-green">
              <div className="vd-kpi-icon">
                <CheckCircle2 size={20} strokeWidth={2.3} />
              </div>
              <div className="vd-kpi-body">
                <span className="vd-kpi-value">
                  {t(etatVehiculeLabel(selectedVehicule.etat))}
                </span>
                <span className="vd-kpi-label">{t("État actuel")}</span>
              </div>
            </div>
          </div>

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
                    <span className="vd-tab-label">{t(tab.label)}</span>
                  </button>
                );
              })}
            </nav>

            <div className="vd-tab-content">

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
                          {t("Matricule")}
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
                          {t("Marque")}
                        </dt>
                        <dd>{selectedVehicule.marque || '—'}</dd>
                      </div>
                      <div>
                        <dt>
                          <FileText size={13} strokeWidth={2.4} />
                          {t("N° Châssis")}
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
                          {t("Type")}
                        </dt>
                        <dd>{typeLabel(selectedVehicule.type)}</dd>
                      </div>
                      <div>
                        <dt>
                          <Gauge size={13} strokeWidth={2.4} />
                          {t("Kilométrage")}
                        </dt>
                        <dd>{km}</dd>
                      </div>
                      <div>
                        <dt>
                          <AlertOctagon size={13} strokeWidth={2.4} />
                          {t("Criticité")}
                        </dt>
                        <dd>
                          <span className={`vehicules-pill color-${criticiteColor(selectedVehicule.criticite)}`}>
                            {selectedVehicule.criticite || 'C3'} · {t(criticiteLabel(selectedVehicule.criticite))}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <CheckCircle2 size={13} strokeWidth={2.4} />
                          {t("État actuel")}
                        </dt>
                        <dd>
                          <span className={`vehicules-pill color-${etatVehiculeColor(selectedVehicule.etat)}`}>
                            {t(etatVehiculeLabel(selectedVehicule.etat))}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

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

              {activeTab === 'historique' && (
                <div
                  className="vd-tabpanel"
                  role="tabpanel"
                  id="vd-tabpanel-historique"
                >
                  <VehiculeKilometrageHistorique vehiculeId={selectedVehicule.id} />
                </div>
              )}

              {activeTab === 'cout' && (
                <div
                  className="vd-tabpanel"
                  role="tabpanel"
                  id="vd-tabpanel-cout"
                >
                  {/* Carburant, entretien, incidents, amendes et frais fixes de ce véhicule */}
                  <VehiculeCoutOnglet vehicule={selectedVehicule} />
                </div>
              )}
            </div>
          </div>
        </div>

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
    <div className={`vehicules-container ${isTransitioning ? 'is-transitioning' : ''}`}>

      <div className="vehicules-header-card">
        <div className="vehicules-header-title-box">
          <button
            type="button"
            className="vehicules-header-icon vehicules-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.vehicules size={24} strokeWidth={2} aria-hidden="true" />
          </button>
          <div>
            <h2>{t("Véhicules")}</h2>
          </div>
        </div>
        <span className="vehicules-badge-total">{t("Total :")} {filteredVehicules.length}</span>
      </div>

      {/* Coûts du parc (année en cours) : carburant, entretien, incidents, amendes, frais fixes */}
      <CoutsParcResume version={coutsVersion} onOuvrir={() => setCoutsOpen(true)} />

      <div className="vehicules-kpi-grid">
        <div className="vehicules-kpi-card kpi-total">
          <div className="vehicules-kpi-icon">
            <Truck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.total}</span>
            <span className="vehicules-kpi-label">{t("Véhicules au total")}</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-service">
          <div className="vehicules-kpi-icon">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enService}</span>
            <span className="vehicules-kpi-label">{t("En service")}</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-maintenance">
          <div className="vehicules-kpi-icon">
            <HardHat size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enMaintenance}</span>
            <span className="vehicules-kpi-label">{t("En maintenance")}</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-alerte">
          <div className="vehicules-kpi-icon">
            <AlertOctagon size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enAlerte}</span>
            <span className="vehicules-kpi-label">{t("Alertes actives")}</span>
          </div>
        </div>
      </div>

      <div className="vehicules-actions-bar">
        <button className="vehicules-action-btn ajouter" onClick={openCreate}>
          <span className="vehicules-action-icon">+</span>
          <span>{t("Ajouter")}</span>
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
          <span>{t("Détails")}</span>
        </button>

        <button
          className={`vehicules-action-btn modifier ${!selectedVehicule ? 'disabled' : ''}`}
          disabled={!selectedVehicule}
          onClick={openEdit}
        >
          <SquarePen size={18} strokeWidth={2} aria-hidden="true" />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`vehicules-action-btn supprimer ${(!selectedVehicule || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedVehicule || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>

        {selectedVehicule && (
          <>
            <span className="vehicules-actions-sep" aria-hidden="true" />
            {nextEtats.length === 0 ? (
              <span className="vehicules-etat-locked">
                {t(etatVehiculeLabel(selectedVehicule.etat))} {t("— état terminal, aucune action.")}
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
                    title={t('Passer à : {etat}', { etat: t(etatVehiculeLabel(target)) })}
                    onClick={() => handleQuickEtat(target)}
                  >
                    {isUpdatingEtat ? (
                      <Loader2 size={16} strokeWidth={2.5} className="vehicules-spin" />
                    ) : (
                      <Icon size={16} strokeWidth={2.5} />
                    )}
                    <span>{t(etatVehiculeLabel(target))}</span>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      <div className="vehicules-filter-panel">
        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">{t("Recherche")}</span>
          <div className="vehicules-filter-input-wrap">
            <Search strokeWidth={2} aria-hidden="true" />
            <input
              type="text"
              placeholder={t("Rechercher par matricule, marque, châssis...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>
        </div>

        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">{t("État")}</span>
          <div className="vehicules-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous")}</option>
              {Object.entries(ETAT_VEHICULE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="vehicules-search-btn"
          onClick={handleSearch}
          title={t("Appliquer les filtres")}
        >
          <Search size={16} strokeWidth={2.5} aria-hidden="true" />
          {t("Chercher")}
        </button>

        <button className="vehicules-filter-reset" onClick={handleResetFilters}>
          {t("Réinitialiser")}
        </button>

        <button
          type="button"
          className="vp-settings-btn"
          onClick={() => setSettingsOpen(true)}
          title={t("Paramétrer les seuils de maintenance préventive")}
        >
          <Settings size={16} /> {t("Paramètres maintenance")}
        </button>


        <div className="vehicules-export-stack">
          <button className="vehicules-export-btn excel" title={t("Exporter en Excel (CSV)")} onClick={handleExportExcel}>
            <Download size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button className="vehicules-export-btn print" title={t("Imprimer")} onClick={handleImprimerListe}>
            <Printer size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button className="vehicules-export-btn stats" title={t("Statistiques")} onClick={handleStats}>
            <ChartColumn size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <div className="vehicules-error-banner">{error}</div>}

      <div className="vehicules-table-wrap">
        <table className="vehicules-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => {
                const def = TABLE_COLUMNS_DEF[c.key];
                if (!def) return null;
                return <th key={c.key}>{t(def.label)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vehicules-table-empty">
                  {t("Chargement...")}
                </td>
              </tr>
            ) : paginatedVehicules.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="vehicules-table-empty">
                  {vehicules.length === 0
                    ? t("Aucun véhicule pour l'instant. Ajoute le premier avec le bouton ci-dessus.")
                    : t("Aucun véhicule ne correspond à ces filtres.")}
                </td>
              </tr>
            ) : (
              paginatedVehicules.map((v) => (
                <tr
                  key={v.id}
                  className={`vehicules-row ${selectedVehicule?.id === v.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(v)}
                  title={t('Double-clic pour ouvrir le détail')}
                  onDoubleClick={() => {
                    window.getSelection?.()?.removeAllRanges();
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

        <div className="table-footer-pagination">
          <div className="pagination-left">
            {tp('véhicule', filteredVehicules.length)}
            {' — '}
            {filteredVehicules.length > 0
              ? t('{de}–{a} affichés', {
                  de: (currentPageSafe - 1) * PAGE_SIZE + 1,
                  a: Math.min(currentPageSafe * PAGE_SIZE, filteredVehicules.length),
                })
              : t('Page {p} sur {total}', { p: 1, total: 1 })}
          </div>

          <div className="pagination-right">
            <button
              type="button"
              className="pag-btn"
              disabled={currentPageSafe <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title={t("Page précédente")}
              aria-label={t("Page précédente")}
            >
              <ChevronLeft size={14} className="rtl-miroir" />
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
              title={t("Page suivante")}
              aria-label={t("Page suivante")}
            >
              <ChevronRight size={14} className="rtl-miroir" />
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="mtp-panel-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="mtp-panel-overlay__inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mtp-panel-overlay__close"
              onClick={() => setSettingsOpen(false)}
              aria-label={t("Fermer")}
            >
              {t("×")}
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

      <PageModal
        isOpen={coutsOpen}
        onClose={fermerCouts}
        title={t("Coût par véhicule")}
        subtitle={t("Carburant, entretien, incidents, amendes et frais fixes, avec le coût au kilomètre")}
        icon={Wallet}
        accent="#0794a4"
        size="full"
      >
        <VehiculeCouts isModal />
      </PageModal>

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