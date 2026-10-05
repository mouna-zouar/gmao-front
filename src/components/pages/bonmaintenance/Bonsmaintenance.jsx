import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit, Eye, PackageSearch, ShoppingCart, Trash2, Play, RotateCcw,
  Pause, CheckCircle, XCircle, FileSpreadsheet, Printer, BarChart3, Search,
  Filter, RefreshCw, AlertCircle, Clock, Calendar, Users, Building2,
  Activity, ChevronLeft, ChevronRight, Circle, Loader2, Info,
  AlertTriangle, Ban, Gauge, Sparkles
} from 'lucide-react';

import bonMaintenanceService from '../../../services/bonMaintenanceService';
import bonMaintenanceFullService from '../../../services/bonMaintenanceFullService';
import bonMaintenancePieceService from '../../../services/bonMaintenancePieceService';
import { prioriteLabel, prioriteRang, prioriteColor } from '../../../constants/Priorite';

import BonMaintenanceModal from '../../ui/modals/BonMaintenanceModal';
import BonMaintenanceDetails from './BonMaintenanceDetails';
import FicheBonMaintenance from '../Fichebonmaintenance/FicheBonMaintenance';
import CommanderModal from '../../ui/modals/CommanderModal';
import DemanderModal from '../../ui/modals/DemanderModal';
import PageModal from '../../ui/modals/PageModal';

import Anomalies from '../Anomalies/Anomalies';
import BlocagesImmobilisation from '../BlocagesImmobilisation/BlocagesImmobilisation';
import EtatEquipement from '../EtatEquipement/EtatEquipement';
import Intelligence from '../Intelligence/Intelligence';

import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';

import ConfirmModal from '../../ui/modals/ConfirmModal';

import './BonsMaintenance.css';

/* =========================================================
   CONSTANTES
   ========================================================= */
const ETAT = { NOUVEAU: 1, SUSPENDU: 2, EN_COURS: 3, EFFECTUE: 4, ANNULE: 10 };

const TRANSITIONS = {
  [ETAT.NOUVEAU]: { actions: ['demarrer', 'suspendre', 'annuler'], label: 'Nouveau', color: '#2563eb', icon: Circle },
  [ETAT.EN_COURS]: { actions: ['suspendre', 'effectuer', 'annuler'], label: 'En cours', color: '#0f766e', icon: Activity },
  [ETAT.SUSPENDU]: { actions: ['reprendre', 'annuler'], label: 'Suspendu', color: '#b45309', icon: Pause },
  [ETAT.EFFECTUE]: { actions: [], label: 'Effectué', isTerminal: true, color: '#16a34a', icon: CheckCircle },
  [ETAT.ANNULE]: { actions: [], label: 'Annulé', isTerminal: true, color: '#64748b', icon: XCircle },
};

const ACTION_LABELS = { demarrer: 'Démarrer', reprendre: 'Reprendre', suspendre: 'Suspendre', effectuer: 'Effectuer', annuler: 'Annuler' };
const ACTION_CLASSES = { demarrer: 'bons-action-btn demarrer', reprendre: 'bons-action-btn reprendre', suspendre: 'bons-action-btn suspendre', effectuer: 'bons-action-btn effectuer', annuler: 'bons-action-btn annuler' };
const ACTION_ICONS = { demarrer: Play, reprendre: RotateCcw, suspendre: Pause, effectuer: CheckCircle, annuler: XCircle };

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const ETAT_BADGE_CLASS = { 1: 'bons-badge--nouveau', 2: 'bons-badge--suspendu', 3: 'bons-badge--encours', 4: 'bons-badge--effectue', 10: 'bons-badge--annule' };

const ETAT_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les états', icon: Filter },
  { value: '1', label: 'Nouveau', icon: Circle, color: '#2563eb' },
  { value: '2', label: 'Suspendu', icon: Pause, color: '#b45309' },
  { value: '3', label: 'En cours', icon: Activity, color: '#0f766e' },
  { value: '4', label: 'Effectué', icon: CheckCircle, color: '#16a34a' },
  { value: '10', label: 'Annulé', icon: XCircle, color: '#64748b' },
];

const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

const ETAT_IMMOBILISATION_OPTIONS = [
  { value: '', label: "Ne pas changer l'état" },
  { value: 1, label: 'Fonctionnel avec problème' },
  { value: 2, label: 'En panne' },
  { value: 3, label: 'À changer' },
  { value: 4, label: 'Hors service' },
];

/* =========================================================
   MAPPING ÉTAT DEMANDE
   ========================================================= */
const DEMANDE_ETAT_MAP = {
  EN_ATTENTE: { label: 'En attente', cls: 'dmd-etat--attente' },
  ACCEPTEE:   { label: 'Acceptée',   cls: 'dmd-etat--acceptee' },
  REFUSEE:    { label: 'Refusée',    cls: 'dmd-etat--refusee' },
  COMMANDE:   { label: 'Commandée',  cls: 'dmd-etat--commande' },
  SERVIE:     { label: 'Servie',     cls: 'dmd-etat--servie' },
};

function demandeEtatLabel(etat) {
  return DEMANDE_ETAT_MAP[etat]?.label || etat || '—';
}

function demandeEtatClass(etat) {
  return DEMANDE_ETAT_MAP[etat]?.cls || '';
}

/* =========================================================
   UTILITAIRES
   ========================================================= */
function etatLabel(etat) { return etat == null ? '—' : ETAT_LABELS[etat] ?? `État ${etat}`; }
function niveauLabel(niveau) { return niveau == null ? '—' : NIVEAU_LABELS[niveau] ?? `Niveau ${niveau}`; }

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getAvailableActions(bon) {
  if (!bon) return [];
  const t = TRANSITIONS[bon.etat];
  return t ? t.actions : [];
}

function isTerminalState(bon) {
  if (!bon) return false;
  const t = TRANSITIONS[bon.etat];
  return t ? t.isTerminal || false : false;
}

function getEtatCount(bons, etatValue) {
  return bons.filter((b) => b.etat === etatValue).length;
}

/* =========================================================
   CALCUL DES BESOINS
   ========================================================= */
async function computeBonMaintenanceNeeds(bonId) {
  let tooltip = "Aucun document d'achat (Demander/Commander) pour ce bon.";
  let commanderNecessaire = false;
  let demanderNecessaire = false;
  const dejaCommandeParArticle = {};
  const dejaDemandeParArticle = {};

  try {
    const documents = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonId);

    const lignesTexte = (documents ?? [])
      .filter((d) => d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' || d.piece?.codePieceType === '.D_Fourniture')
      .map((d) => {
        const typeLabel = d.piece.codePieceType === '.COMMANDE_FOURNISSEUR' ? 'Commande' : 'Demande';
        const articlesTexte = (d.lignes ?? []).map((l) => `Article #${l.prestataireArticlesId} (Qté ${l.qte ?? '—'})`).join(', ');
        return `${typeLabel} — ${articlesTexte || 'aucun article'}`;
      });

    if (lignesTexte.length > 0) tooltip = lignesTexte.join('\n');

    (documents ?? []).forEach((d) => {
      const cible = d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' ? dejaCommandeParArticle
        : d.piece?.codePieceType === '.D_Fourniture' ? dejaDemandeParArticle : null;
      if (!cible) return;
      (d.lignes ?? []).forEach((l) => {
        if (l.prestataireArticlesId == null) return;
        cible[l.prestataireArticlesId] = (cible[l.prestataireArticlesId] ?? 0) + (l.qte ?? 0);
      });
    });
  } catch (err) {
    console.error(`Erreur chargement documents d'achat pour le bon ${bonId} :`, err);
  }

  try {
    const taches = await bonMaintenanceTacheService.getByBonMaintenance(bonId);
    const tachesAvecArticle = (taches ?? []).filter((t) => t.prestataireArticlesId != null);

    await Promise.all(tachesAvecArticle.map(async (t) => {
      try {
        const disponible = await pieceLigneService.getQuantiteDisponible(t.prestataireArticlesId);
        const qte = t.qte ?? 0;
        const manquant = disponible != null ? Math.max(0, qte - disponible) : qte;
        if (manquant <= 0) return;

        const dejaCommande = dejaCommandeParArticle[t.prestataireArticlesId] ?? 0;
        const dejaDemande = dejaDemandeParArticle[t.prestataireArticlesId] ?? 0;
        const resteACommander = manquant - dejaCommande;
        const resteADemander = manquant - dejaDemande;

        if (resteADemander > 0) demanderNecessaire = true;
        if (resteACommander > 0 && t.sousTraitantId != null) commanderNecessaire = true;
      } catch { /* ignore */ }
    }));
  } catch (err) {
    console.error(`Erreur vérification stock pour le bon ${bonId} :`, err);
  }

  return { tooltip, commanderNecessaire, demanderNecessaire };
}

/* =========================================================
   COLONNES TRI
   ========================================================= */
const SORTABLE_COLUMNS = {
  num: (b) => b.num || '',
  titre: (b) => b.titre || '',
  prestataire: (b) => b.prestataire?.raisonSociale || b.prestataire?.nom || '',
  service: (b) => b.serviceNom || '',
  urgence: (b) => b.urgence ?? -1,
  priorite: (b) => prioriteRang(b.priorite),
  date: (b) => (b.date ? new Date(b.date).getTime() : 0),
  etat: (b) => b.etat ?? -1,
};

const PAGE_SIZE = 10;

/* =========================================================
   COMPOSANT PRINCIPAL
   ========================================================= */
export default function BonsMaintenance() {
  const navigate = useNavigate();

  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');
  const [showFilterStats, setShowFilterStats] = useState(true);

  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBon, setSelectedBon] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [commanderOpen, setCommanderOpen] = useState(false);
  const [demanderOpen, setDemanderOpen] = useState(false);

  const [demandesOpen, setDemandesOpen] = useState(false);
  const [demandes, setDemandes] = useState([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [demandeActionLoading, setDemandeActionLoading] = useState(null);
  const [demandesError, setDemandesError] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [demanderAllume, setDemanderAllume] = useState(false);
  const [commanderAllume, setCommanderAllume] = useState(false);
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);

  const [anomaliesOpen, setAnomaliesOpen] = useState(false);
  const [blocagesOpen, setBlocagesOpen] = useState(false);
  const [etatEquipOpen, setEtatEquipOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: 'Confirmer', onConfirm: null, error: null, confirming: false,
  });

  const [motifModal, setMotifModal] = useState({ show: false, motif: '', error: null, confirming: false });
  const [etatModal, setEtatModal] = useState({ show: false, etat: '', error: null, confirming: false });
  const [rowInfo, setRowInfo] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await bonMaintenanceService.getAll(0, 200);
      setBons(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les bons de maintenance. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadDemandes = async () => {
    if (!selectedBon?.id) return;
    try {
      setDemandesLoading(true);
      setDemandesError(null);
      const data = await bonMaintenancePieceService.findByBonMaintenanceId(selectedBon.id);
      setDemandes(data ?? []);
    } catch (err) {
      console.error('Erreur chargement demandes :', err);
      setDemandesError(err.response?.data?.message || 'Impossible de charger les demandes de pièces.');
    } finally {
      setDemandesLoading(false);
    }
  };

  const openDemandes = async () => {
    if (!selectedBon) return;
    setDemandesError(null);
    setDemandesOpen(true);
    await loadDemandes();
  };

  const handleAccepterDemande = async (id) => {
    try {
      setDemandeActionLoading(id);
      setDemandesError(null);
      await bonMaintenancePieceService.accepter(id);
      await loadDemandes();
      setActionsRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Erreur acceptation demande :', err);
      setDemandesError(err.response?.data?.message || 'Impossible d\'accepter cette demande.');
    } finally {
      setDemandeActionLoading(null);
    }
  };

  const handleRefuserDemande = async (id) => {
    try {
      setDemandeActionLoading(id);
      setDemandesError(null);
      await bonMaintenancePieceService.refuser(id);
      await loadDemandes();
      setActionsRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Erreur refus demande :', err);
      setDemandesError(err.response?.data?.message || 'Impossible de refuser cette demande.');
    } finally {
      setDemandeActionLoading(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const calculer = async () => {
      if (!selectedBon) {
        setDemanderAllume(false);
        setCommanderAllume(false);
        return;
      }
      try {
        const needs = await computeBonMaintenanceNeeds(selectedBon.id);
        if (cancelled) return;
        setDemanderAllume(needs.demanderNecessaire);
        setCommanderAllume(needs.commanderNecessaire);
      } catch (err) {
        console.error('Erreur calcul allumage Demander/Commander :', err);
        if (!cancelled) { setDemanderAllume(false); setCommanderAllume(false); }
      }
    };
    calculer();
    return () => { cancelled = true; };
  }, [selectedBon, actionsRefreshKey]);

  const etatStats = useMemo(() => {
    const stats = {};
    Object.values(ETAT).forEach((val) => { stats[val] = getEtatCount(bons, val); });
    return stats;
  }, [bons]);

  const filteredBons = useMemo(() => {
    return bons.filter((b) => {
      const matchesSearch = !searchTerm
        || b.titre?.toLowerCase().includes(searchTerm.toLowerCase())
        || b.num?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEtat = etatFilter === 'all' || String(b.etat) === etatFilter;
      return matchesSearch && matchesEtat;
    });
  }, [bons, searchTerm, etatFilter]);

  const sortedBons = useMemo(() => {
    const extractor = SORTABLE_COLUMNS[sortColumn];
    if (!extractor) return filteredBons;
    const sorted = [...filteredBons].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
      return va - vb;
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [filteredBons, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedBons.length / PAGE_SIZE));

  useEffect(() => { setCurrentPage(1); }, [searchTerm, etatFilter, sortColumn, sortDirection]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const paginatedBons = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedBons.slice(start, start + PAGE_SIZE);
  }, [sortedBons, currentPage]);

  useEffect(() => {
    let cancelled = false;
    const calculerTout = async () => {
      const entries = await Promise.all(
        paginatedBons.map(async (bon) => {
          const needs = await computeBonMaintenanceNeeds(bon.id);
          return [bon.id, { tooltip: needs.tooltip, stockInsuffisant: needs.commanderNecessaire }];
        })
      );
      if (!cancelled) setRowInfo(Object.fromEntries(entries));
    };
    if (paginatedBons.length > 0) calculerTout();
    else setRowInfo({});
    return () => { cancelled = true; };
  }, [paginatedBons, actionsRefreshKey]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) range.push(i);
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

  const sortIndicator = (column) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleExportExcel = () => {
    const entetes = ['Numéro', 'Titre', 'Prestataire', 'Urgence', 'Priorité', 'Date', 'État'];
    const lignes = sortedBons.map((b) => [
      b.num || '',
      (b.titre || '').replace(/"/g, '""'),
      b.prestataire?.raisonSociale || b.prestataire?.nom || '',
      niveauLabel(b.urgence),
      prioriteLabel(b.priorite),
      formatDate(b.date),
      etatLabel(b.etat),
    ]);
    const csv = [entetes, ...lignes].map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `bons-maintenance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleResetFilters = () => { setSearchTerm(''); setEtatFilter('all'); };

  const handleRowClick = (bon) => {
    setSelectedBon((prev) => (prev?.id === bon.id ? null : bon));
  };

  const openCreate = () => { setSelectedBon(null); setModalOpen(true); };
  const openEdit = () => { if (selectedBon) setViewMode('edit'); };
  const openCommander = () => { if (selectedBon) setCommanderOpen(true); };
  const openDemander = () => { if (selectedBon) setDemanderOpen(true); };

  const handleSave = async (payload, children) => {
    if (selectedBon) {
      await bonMaintenanceService.update(selectedBon.id, payload);
    } else {
      const result = await bonMaintenanceFullService.createFull(payload, children || {});
      if (result.errors.length > 0) {
        const summary = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
        alert(`Le bon a été créé, mais ${result.errors.length} élément(s) enfant(s) n'ont pas pu être ajoutés :\n${summary}\n\nTu peux les ajouter manuellement depuis l'onglet Détails du bon.`);
      }
      const conflits = (result.intervenants || []).filter((i) => i.conflitPeriode);
      if (conflits.length > 0) {
        const detail = conflits.map((i) => `- ${i.personnel?.nom || ''} ${i.personnel?.prenom || ''} : ${i.conflitMessage}`).join('\n');
        alert(`⚠️ Conflit de planning détecté pour ${conflits.length} intervenant(s) :\n${detail}\n\nLe bon a bien été créé — vérifie la disponibilité de ces techniciens si besoin.`);
      }
    }
    setSelectedBon(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false, error: null, confirming: false }));

  const handleDelete = () => {
    if (!selectedBon || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le bon de maintenance',
      message: `Supprimer le bon "${selectedBon.titre}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      error: null,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setIsDeleting(true);
        try {
          await bonMaintenanceService.remove(selectedBon.id);
          setBons((prev) => prev.filter((b) => b.id !== selectedBon.id));
          setSelectedBon(null);
          closeConfirmModal();
        } catch (err) {
          console.error(err);
          const message = err.response?.data?.message || "Échec de la suppression de ce bon de maintenance.";
          setConfirmModal((prev) => ({ ...prev, confirming: false, error: message }));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const runTransition = async (action) => {
    if (!selectedBon || transitioning) return { ok: false, message: 'Aucun bon sélectionné.' };
    setTransitioning(true);
    try {
      const updated = await action();
      setBons((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBon(updated);
      return { ok: true };
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Transition d'état refusée.";
      return { ok: false, message };
    } finally {
      setTransitioning(false);
    }
  };

  const handleDemarrer = async () => {
    if (!selectedBon || transitioning) return;
    const result = await runTransition(() => bonMaintenanceService.passerEnCours(selectedBon.id));
    if (!result.ok) alert(result.message);
  };

  const handleReprendre = async () => {
    if (!selectedBon || transitioning) return;
    const result = await runTransition(() => bonMaintenanceService.reprendre(selectedBon.id));
    if (!result.ok) alert(result.message);
  };

  const handleSuspendre = () => {
    if (!selectedBon) return;
    setMotifModal({ show: true, motif: '', error: null, confirming: false });
  };

  const confirmSuspendre = async () => {
    const motif = motifModal.motif.trim();
    if (!motif) {
      setMotifModal((prev) => ({ ...prev, error: 'Le motif est obligatoire.' }));
      return;
    }
    setMotifModal((prev) => ({ ...prev, confirming: true, error: null }));
    const result = await runTransition(() => bonMaintenanceService.suspendre(selectedBon.id, motif));
    if (result.ok) {
      setMotifModal({ show: false, motif: '', error: null, confirming: false });
    } else {
      setMotifModal((prev) => ({ ...prev, confirming: false, error: result.message }));
    }
  };

  const handleEffectuer = () => {
    if (!selectedBon) return;
    setEtatModal({ show: true, etat: '', error: null, confirming: false });
  };

  const confirmEffectuer = async () => {
    const saisie = etatModal.etat.trim();
    if (saisie !== '' && Number.isNaN(Number(saisie))) {
      setEtatModal((prev) => ({ ...prev, error: "Valeur invalide pour l'état de l'immobilisation." }));
      return;
    }
    const etat = saisie === '' ? null : Number(saisie);
    setEtatModal((prev) => ({ ...prev, confirming: true, error: null }));
    const result = await runTransition(() => bonMaintenanceService.marquerEffectue(selectedBon.id, etat));
    if (result.ok) {
      setEtatModal({ show: false, etat: '', error: null, confirming: false });
    } else {
      setEtatModal((prev) => ({ ...prev, confirming: false, error: result.message }));
    }
  };

  const handleAnnuler = () => {
    if (!selectedBon) return;
    setConfirmModal({
      show: true,
      type: 'warning',
      title: 'Annuler le bon de maintenance',
      message: `Annuler le bon "${selectedBon.titre}" ?`,
      confirmText: 'Annuler le bon',
      error: null,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        const result = await runTransition(() => bonMaintenanceService.annuler(selectedBon.id));
        if (result.ok) closeConfirmModal();
        else setConfirmModal((prev) => ({ ...prev, confirming: false, error: result.message }));
      },
    });
  };

  const getActiveFilterLabel = () => {
    const option = ETAT_FILTER_OPTIONS.find((o) => o.value === etatFilter);
    return option ? option.label : 'Tous les états';
  };

  const renderEtatIcon = (etat, size = 16) => {
    const transition = TRANSITIONS[etat];
    if (!transition) return null;
    const Icon = transition.icon;
    return <Icon size={size} style={{ color: transition.color }} />;
  };

  if (viewMode === 'details' && selectedBon) {
    return (
      <div className="bons-container">
        <BonMaintenanceDetails
          bonMaintenance={selectedBon}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  if (viewMode === 'edit' && selectedBon) {
    return (
      <FicheBonMaintenance
        bonMaintenanceId={selectedBon.id}
        startInEditMode
        onClose={async () => {
          setViewMode('list');
          setSelectedBon(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="bons-container">
      {/* HEADER */}
      <div className="bons-header-card">
        <div className="bons-header-title-box">
          <div className="bons-header-icon-wrapper">
            <Activity size={28} className="bons-header-icon" />
          </div>
          <div>
            <h2>Bons de maintenance</h2>
            <p className="bons-header-subtitle">Gestion des interventions de maintenance</p>
          </div>
        </div>

        <div className="bons-header-stats">
          <span className="bons-badge-total">Total : {bons.length}</span>

          <button className="bons-toggle-stats" title="Anomalies" onClick={() => setAnomaliesOpen(true)}>
            <AlertTriangle size={20} />
            <span>Anomalies</span>
          </button>

          <button className="bons-toggle-stats" title="Blocages" onClick={() => setBlocagesOpen(true)}>
            <Ban size={20} />
            <span>Blocages</span>
          </button>

          <button className="bons-toggle-stats" title="État des équipements" onClick={() => setEtatEquipOpen(true)}>
            <Gauge size={20} />
            <span>État équipements</span>
          </button>

          <button className="bons-toggle-stats" title="Intelligence" onClick={() => setIntelligenceOpen(true)}>
            <Sparkles size={20} />
            <span>Intelligence</span>
          </button>

          <button className="bons-toggle-stats" onClick={() => setShowFilterStats(!showFilterStats)} title="Afficher/masquer les statistiques">
            <BarChart3 size={20} />
          </button>
        </div>
      </div>

      {/* STATISTIQUES */}
      {showFilterStats && (
        <div className="bons-stats-bar">
          {ETAT_FILTER_OPTIONS.filter((opt) => opt.value !== 'all').map((option) => {
            const count = etatStats[Number(option.value)] || 0;
            const total = bons.length || 1;
            const percentage = Math.round((count / total) * 100);
            const isActive = etatFilter === option.value;
            const Icon = option.icon;
            return (
              <div
                key={option.value}
                className={`bons-stat-item ${isActive ? 'active' : ''}`}
                onClick={() => setEtatFilter(option.value)}
                style={{ '--stat-color': option.color }}
                title={`${option.label}: ${count} bon(s)`}
              >
                <Icon size={18} style={{ color: option.color }} />
                <span className="bons-stat-label">{option.label}</span>
                <span className="bons-stat-count">{count}</span>
                <div className="bons-stat-bar-bg">
                  <div className="bons-stat-bar-fill" style={{ width: `${percentage}%`, backgroundColor: option.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ACTIONS */}
      <div className="bons-actions-bar">
        <button className="bons-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} />
          <span>Ajouter</span>
        </button>

        <button className={`bons-action-btn modifier ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={openEdit}>
          <Edit size={18} />
          <span>Modifier</span>
        </button>

        <button className={`bons-action-btn details ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={() => setViewMode('details')}>
          <Eye size={18} />
          <span>Détails</span>
        </button>

        <button
          className={`bons-action-btn demander ${!selectedBon || !demanderAllume ? 'disabled' : ''} ${demanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !demanderAllume}
          onClick={openDemander}
        >
          <PackageSearch size={18} />
          <span>Demander</span>
        </button>

        <button className={`bons-action-btn demandes ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={openDemandes}>
          <PackageSearch size={18} />
          <span>Demandes</span>
        </button>

        <button
          className={`bons-action-btn commander ${!selectedBon || !commanderAllume ? 'disabled' : ''} ${commanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !commanderAllume}
          onClick={openCommander}
        >
          <ShoppingCart size={18} />
          <span>Commander</span>
        </button>

        <button className={`bons-action-btn supprimer ${!selectedBon || isDeleting ? 'disabled' : ''}`} disabled={!selectedBon || isDeleting} onClick={handleDelete}>
          <Trash2 size={18} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>

        <div className="bons-actions-divider" />

        {selectedBon && !isTerminalState(selectedBon) && (
          <>
            {getAvailableActions(selectedBon).map((action) => {
              const Icon = ACTION_ICONS[action];
              return (
                <button
                  key={action}
                  className={`${ACTION_CLASSES[action]} ${transitioning ? 'disabled' : ''}`}
                  disabled={transitioning}
                  onClick={() => {
                    switch (action) {
                      case 'demarrer': handleDemarrer(); break;
                      case 'reprendre': handleReprendre(); break;
                      case 'suspendre': handleSuspendre(); break;
                      case 'effectuer': handleEffectuer(); break;
                      case 'annuler': handleAnnuler(); break;
                      default: break;
                    }
                  }}
                >
                  <Icon size={16} />
                  <span>{ACTION_LABELS[action]}</span>
                </button>
              );
            })}
          </>
        )}

        {selectedBon && isTerminalState(selectedBon) && (
          <div className="bons-terminal-state">
            <span className="bons-terminal-badge">
              {renderEtatIcon(selectedBon.etat)}
              {TRANSITIONS[selectedBon.etat]?.label || 'Terminé'}
            </span>
          </div>
        )}

        {!selectedBon && (
          <span className="bons-no-selection-message">
            <Info size={16} />
            Sélectionnez un bon pour voir les actions disponibles
          </span>
        )}
      </div>

      {/* FILTRES */}
      <div className="bons-filter-panel">
        <div className="bons-filter-group">
          <span className="bons-filter-label">Recherche</span>
          <div className="bons-filter-input-wrap">
            <Search size={16} className="bons-filter-icon" />
            <input
              type="text"
              placeholder="Rechercher par titre ou numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="bons-filter-clear" onClick={() => setSearchTerm('')} title="Effacer la recherche">
                <XCircle size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="bons-filter-group">
          <span className="bons-filter-label">État</span>
          <div className="bons-filter-input-wrap">
            <Filter size={16} className="bons-filter-icon" />
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              {ETAT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value !== 'all'
                    ? `${option.label} (${etatStats[Number(option.value)] || 0})`
                    : option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="bons-filter-reset" onClick={handleResetFilters}>
          <RefreshCw size={16} />
          Réinitialiser
        </button>

        <div className="bons-filter-info">
          <span className="bons-filter-result">
            {filteredBons.length} résultat{filteredBons.length > 1 ? 's' : ''}
            {etatFilter !== 'all' && ` • ${getActiveFilterLabel()}`}
            {searchTerm && ` • "${searchTerm}"`}
          </span>
        </div>

        <div className="bons-export-stack">
          <button className="bons-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="bons-export-btn print" title="Imprimer" onClick={handlePrint}>
            <Printer size={18} />
          </button>
          <button className="bons-export-btn stats" title="Statistiques" onClick={() => setShowFilterStats(!showFilterStats)}>
            <BarChart3 size={18} />
          </button>
        </div>
      </div>

      {/* ERREUR */}
      {error && (
        <div className="bons-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLE */}
      <div className="bons-table-wrap">
        <table className="bons-table">
          <thead>
            <tr>
              <th className="bons-th-sortable" onClick={() => handleSort('num')}>
                <span>Numéro</span><span className="bons-sort-indicator">{sortIndicator('num')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('titre')}>
                <span>Titre</span><span className="bons-sort-indicator">{sortIndicator('titre')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('prestataire')}>
                <span>Prestataire</span><span className="bons-sort-indicator">{sortIndicator('prestataire')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('service')}>
                <span>Service</span><span className="bons-sort-indicator">{sortIndicator('service')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('urgence')}>
                <span>Urgence</span><span className="bons-sort-indicator">{sortIndicator('urgence')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('priorite')}>
                <span>Priorité</span><span className="bons-sort-indicator">{sortIndicator('priorite')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('date')}>
                <span>Date</span><span className="bons-sort-indicator">{sortIndicator('date')}</span>
              </th>
              <th className="bons-th-sortable" onClick={() => handleSort('etat')}>
                <span>État</span><span className="bons-sort-indicator">{sortIndicator('etat')}</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="bons-table-empty">
                <Loader2 size={24} className="bons-spinner" />
                <span>Chargement...</span>
              </td></tr>
            ) : sortedBons.length === 0 ? (
              <tr><td colSpan={8} className="bons-table-empty">
                {bons.length === 0 ? (
                  <><AlertCircle size={24} /><span>Aucun bon de maintenance pour l'instant. Ajoute le premier avec le bouton ci-dessus.</span></>
                ) : (
                  <><Search size={24} /><span>Aucun bon ne correspond à ces filtres. Essaye de modifier ta recherche.</span></>
                )}
              </td></tr>
            ) : (
              paginatedBons.map((b) => (
                <tr
                  key={b.id}
                  className={`bons-row ${selectedBon?.id === b.id ? 'selected' : ''} ${rowInfo[b.id]?.stockInsuffisant ? 'stock-insuffisant' : ''}`}
                  onClick={() => handleRowClick(b)}
                  title={rowInfo[b.id]?.tooltip || ''}
                >
                  <td style={{ fontWeight: 600 }}>{b.num || '—'}</td>
                  <td>{b.titre}</td>
                  <td>{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td>
                  <td>{b.serviceNom || b.service?.description || '—'}</td>
                  <td>
                    <span className={`bons-urgence-badge urgence-${b.urgence || 0}`}>
                      {niveauLabel(b.urgence)}
                    </span>
                  </td>
                  <td>
                    <span className={`bons-priorite-badge priorite-color-${prioriteColor(b.priorite)}`}>
                      {b.priorite || '—'} · {prioriteLabel(b.priorite)}
                    </span>
                  </td>
                  <td>
                    <span className="bons-date-cell">
                      <Calendar size={14} />
                      {formatDate(b.date)}
                    </span>
                  </td>
                  <td>
                    <span className={`bons-badge ${ETAT_BADGE_CLASS[b.etat] || ''}`}>
                      {renderEtatIcon(b.etat)}
                      {etatLabel(b.etat)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {!loading && sortedBons.length > 0 && (
        <div className="bons-pagination">
          <span className="bons-pagination-info">
            {sortedBons.length} résultat{sortedBons.length > 1 ? 's' : ''} — page {currentPage} / {totalPages}
          </span>
          <div className="bons-pagination-controls">
            <button type="button" className="bons-pagination-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft size={16} />
              Précédent
            </button>
            {paginationRange.map((p) => (
              <button key={p} type="button" className={`bons-pagination-btn ${p === currentPage ? 'active' : ''}`} onClick={() => goToPage(p)}>
                {p}
              </button>
            ))}
            <button type="button" className="bons-pagination-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
              Suivant
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREATION / MODIFICATION */}
      <BonMaintenanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        bonMaintenance={selectedBon}
        isEditing={!!selectedBon}
      />

      {/* MODAL DEMANDER */}
      <DemanderModal
        isOpen={demanderOpen}
        onClose={() => setDemanderOpen(false)}
        bonMaintenance={selectedBon}
        onDemandeCreee={() => {
          alert('✅ Demande créée avec succès.');
          setActionsRefreshKey((k) => k + 1);
        }}
      />

      {/* MODAL COMMANDER */}
      <CommanderModal
        isOpen={commanderOpen}
        onClose={() => setCommanderOpen(false)}
        bonMaintenance={selectedBon}
        onCommandeCreee={() => {
          alert('✅ Commande créée avec succès.');
          setActionsRefreshKey((k) => k + 1);
        }}
      />

      {/* =========================================================
          MODAL DEMANDES — Style premium aligné
          ========================================================= */}
      {demandesOpen && (
        <div
          className="dmd-overlay"
          onClick={() => {
            if (!demandeActionLoading) setDemandesOpen(false);
          }}
        >
          <div className="dmd-modal" onClick={(e) => e.stopPropagation()}>

            {/* HEADER */}
            <div className="dmd-header">
              <div className="dmd-header__text">
                <span className="dmd-header__eyebrow">Bon de maintenance</span>
                <h2>Demandes de pièces</h2>
                <p className="dmd-header__subtitle">
                  Suivi et validation des demandes pour le bon{' '}
                  <strong>{selectedBon?.num || `#${selectedBon?.id}`}</strong>
                </p>
              </div>

              <button
                type="button"
                className="dmd-close-btn"
                onClick={() => setDemandesOpen(false)}
                disabled={!!demandeActionLoading}
                aria-label="Fermer"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* BODY */}
            <div className="dmd-body">

              {demandesError && (
                <div className="dmd-form-error">
                  <AlertCircle size={16} />
                  <span>{demandesError}</span>
                </div>
              )}

              {demandesLoading ? (
                <div className="dmd-empty">
                  <span className="dmd-spinner" />
                  <span>Chargement des demandes...</span>
                </div>
              ) : demandes.length === 0 ? (
                <div className="dmd-empty dmd-empty--empty">
                  <PackageSearch size={28} />
                  <span>Aucune demande pour ce bon de maintenance.</span>
                </div>
              ) : (
                <>
                  <div className="dmd-toolbar">
                    <div className="dmd-toolbar__count">
                      <span className="dmd-toolbar__count-num">{demandes.length}</span>
                      <span>demande{demandes.length > 1 ? 's' : ''}</span>
                      <span className="dmd-toolbar__sep">·</span>
                      <span className="dmd-toolbar__hint">
                        {demandes.filter((d) => d.etat === 'EN_ATTENTE').length} en attente
                      </span>
                    </div>
                  </div>

                  <div className="dmd-table-wrap">
                    <table className="dmd-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th style={{ width: 100, textAlign: 'center' }}>Quantité</th>
                          <th style={{ width: 110, textAlign: 'center' }}>Mode stock</th>
                          <th style={{ width: 140, textAlign: 'center' }}>État</th>
                          <th style={{ width: 220, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demandes.map((demande) => {
                          const isLoading = demandeActionLoading === demande.id;
                          const etatCls = demandeEtatClass(demande.etat);
                          const etatTxt = demandeEtatLabel(demande.etat);
                          const isEnAttente = demande.etat === 'EN_ATTENTE';

                          return (
                            <tr key={demande.id}>
                              <td className="dmd-cell-article">
                                Article #{demande.prestataireArticlesId}
                                {demande.designation && (
                                  <span className="dmd-cell-article__ref">
                                    {demande.designation}
                                  </span>
                                )}
                              </td>

                              <td className="dmd-cell-num">
                                <span className="dmd-cell-qte__pill">{demande.qte}</span>
                              </td>

                              <td className="dmd-cell-num">
                                {demande.modeStock != null ? (
                                  <span className="dmd-cell-mode__pill">{demande.modeStock}</span>
                                ) : (
                                  <span className="dmd-cell-mode__pill dmd-cell-mode__pill--empty">—</span>
                                )}
                              </td>

                              <td className="dmd-cell-num">
                                <span className={`dmd-etat-badge ${etatCls}`}>{etatTxt}</span>
                              </td>

                              <td>
                                {isEnAttente ? (
                                  <div className="dmd-row-actions">
                                    <button
                                      type="button"
                                      className="dmd-btn dmd-btn--accept"
                                      onClick={() => handleAccepterDemande(demande.id)}
                                      disabled={isLoading}
                                    >
                                      {isLoading ? <span className="dmd-spinner-sm" /> : <CheckCircle size={14} />}
                                      <span>{isLoading ? 'Traitement...' : 'Accepter'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="dmd-btn dmd-btn--refuse"
                                      onClick={() => handleRefuserDemande(demande.id)}
                                      disabled={isLoading}
                                    >
                                      {isLoading ? <span className="dmd-spinner-sm" /> : <XCircle size={14} />}
                                      <span>{isLoading ? 'Traitement...' : 'Refuser'}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="dmd-no-action">—</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* FOOTER */}
            <div className="dmd-footer">
              <div className="dmd-nav-buttons">
                <button
                  type="button"
                  className="dmd-submit-btn"
                  onClick={loadDemandes}
                  disabled={demandesLoading || !!demandeActionLoading}
                >
                  <RefreshCw size={15} className={demandesLoading ? 'dmd-spin' : ''} />
                  <span>Actualiser</span>
                </button>
              </div>

              <button
                type="button"
                className="dmd-cancel-btn"
                onClick={() => setDemandesOpen(false)}
                disabled={!!demandeActionLoading}
              >
                <span>Fermer</span>
                <kbd>ESC</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE / ANNULER */}
      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        error={confirmModal.error}
        confirming={confirmModal.confirming}
      />

      {/* MODAL SUSPENSION */}
      {motifModal.show && (
        <div
          className="modal-overlay confirm-overlay"
          onClick={() => {
            if (!motifModal.confirming) {
              setMotifModal({ show: false, motif: '', error: null, confirming: false });
            }
          }}
        >
          <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <Pause size={48} className="modal-confirm-icon warning" />
              </div>
              <div className="confirm-modal-text">
                <h3>Motif de suspension</h3>
                <p>Indique pourquoi ce bon de maintenance est suspendu.</p>
                <textarea
                  className="confirm-modal-input"
                  value={motifModal.motif}
                  onChange={(e) => setMotifModal((p) => ({ ...p, motif: e.target.value, error: null }))}
                  placeholder="Motif de suspension..."
                  rows={3}
                  autoFocus
                  disabled={motifModal.confirming}
                />
              </div>
            </div>

            {motifModal.error && (
              <div className="confirm-modal-error">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192-3 1.732-3z" />
                </svg>
                <span>{motifModal.error}</span>
              </div>
            )}

            <div className="confirm-modal-footer">
              <button
                type="button"
                className="confirm-btn secondary"
                onClick={() => setMotifModal({ show: false, motif: '', error: null, confirming: false })}
                disabled={motifModal.confirming}
              >
                Annuler
              </button>
              <button
                type="button"
                className="confirm-btn primary warning"
                onClick={confirmSuspendre}
                disabled={!motifModal.motif.trim() || motifModal.confirming}
              >
                <Pause size={16} />
                {motifModal.confirming ? 'Patientez...' : 'Suspendre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EFFECTUER */}
      {etatModal.show && (
        <div
          className="modal-overlay confirm-overlay"
          onClick={() => {
            if (!etatModal.confirming) {
              setEtatModal({ show: false, etat: '', error: null, confirming: false });
            }
          }}
        >
          <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <CheckCircle size={48} className="modal-confirm-icon success" />
              </div>
              <div className="confirm-modal-text">
                <h3>Marquer effectué</h3>
                <p>État final de l'immobilisation (laisser vide si non applicable).</p>
                <select
                  className="confirm-modal-input"
                  value={etatModal.etat}
                  onChange={(e) => setEtatModal((p) => ({ ...p, etat: e.target.value, error: null }))}
                  autoFocus
                  disabled={etatModal.confirming}
                >
                  {ETAT_IMMOBILISATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {etatModal.error && (
              <div className="confirm-modal-error">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192-3 1.732-3z" />
                </svg>
                <span>{etatModal.error}</span>
              </div>
            )}

            <div className="confirm-modal-footer">
              <button
                type="button"
                className="confirm-btn secondary"
                onClick={() => setEtatModal({ show: false, etat: '', error: null, confirming: false })}
                disabled={etatModal.confirming}
              >
                Annuler
              </button>
              <button
                type="button"
                className="confirm-btn primary success"
                onClick={confirmEffectuer}
                disabled={etatModal.confirming}
              >
                <CheckCircle size={16} />
                {etatModal.confirming ? 'Patientez...' : 'Marquer effectué'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES PAGES EXTERNES */}
      <PageModal
        isOpen={anomaliesOpen}
        onClose={() => setAnomaliesOpen(false)}
        title="Détection d'anomalies"
        subtitle="Pics anormaux de réclamations par équipement ou par service"
        icon={AlertTriangle}
        accent="#dc2626"
        size="full"
      >
        <Anomalies isModal />
      </PageModal>

      <PageModal
        isOpen={blocagesOpen}
        onClose={() => setBlocagesOpen(false)}
        title="Blocages d'équipement"
        subtitle="Équipements sans suite après arrêt obligatoire"
        icon={Ban}
        accent="#9f1239"
        size="full"
      >
        <BlocagesImmobilisation isModal />
      </PageModal>

      <PageModal
        isOpen={etatEquipOpen}
        onClose={() => setEtatEquipOpen(false)}
        title="État des équipements"
        subtitle="Statut logique calculé à chaque événement"
        icon={Gauge}
        accent="#4338ca"
        size="full"
      >
        <EtatEquipement isModal />
      </PageModal>

      <PageModal
        isOpen={intelligenceOpen}
        onClose={() => setIntelligenceOpen(false)}
        title="Intelligence"
        subtitle="Vue consolidée : Risques, Anomalies et RCA/CAPA croisés"
        icon={Sparkles}
        accent="#7c3aed"
        size="full"
      >
        <Intelligence isModal />
      </PageModal>
    </div>
  );
}