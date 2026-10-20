import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Plus, Edit, Eye, PackageSearch, ShoppingCart, Trash2, Play, RotateCcw,
  Pause, CheckCircle, XCircle, FileSpreadsheet, Printer, BarChart3, Search,
  Filter, RefreshCw, AlertCircle, Clock, Calendar, Users, Building2, ChevronLeft, ChevronRight, Loader2, Info,
  AlertTriangle, Ban, Gauge, Sparkles, ArrowUp, ArrowDown, ArrowUpDown, AlarmClock, X, TriangleAlert, RadioTower } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';

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
import Button from '../../ui/Button';

import Anomalies from '../Anomalies/Anomalies';
import BlocagesImmobilisation from '../BlocagesImmobilisation/BlocagesImmobilisation';
import EquipementsEtEtat from '../Equipements/EquipementsEtEtat';
import Intelligence from '../Intelligence/Intelligence';
import AlertesMachines from '../AlertesMachines/AlertesMachines';
import alerteMachineService from '../../../services/alerteMachineService';
import SlaRetards from './SlaRetards';
import slaService from '../../../services/slaService';
import { delaiSla } from '../../../utils/delaiSla';

import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';

import ConfirmModal from '../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';

import { t, tp, locale } from '../../../i18n';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import { STATUTS, TONS } from '../../../constants/statuts';
import { imprimerListe } from '../../../utils/imprimerListe';
import api from '../../../services/api';
import VuesListe from '../../ui/Listes/VuesListe';
import { useVueActive } from '../../ui/Listes/stockageVues';
import CartesListe from '../../ui/Listes/CartesListe';
import SelectionMultiple, { CaseSelection } from '../../ui/Listes/SelectionMultiple';
import { bonEnRetard, contexteUtilisateur, echeanceBon, vuesBons } from '../../ui/Listes/vuesMetier';
import './BonsMaintenance.css';

const ETAT = { NOUVEAU: 1, SUSPENDU: 2, EN_COURS: 3, EFFECTUE: 4, ANNULE: 10 };

// Libellé, couleur et icône de chaque état : registre commun (constants/statuts.js)
const avecStatut = (etat, def) => ({
  ...def,
  label: STATUTS.bon[etat].libelle,
  color: TONS[STATUTS.bon[etat].ton].couleur,
  icon: STATUTS.bon[etat].Icone,
});

const TRANSITIONS = {
  [ETAT.NOUVEAU]: avecStatut(ETAT.NOUVEAU, { actions: ['demarrer', 'suspendre', 'annuler'] }),
  [ETAT.EN_COURS]: avecStatut(ETAT.EN_COURS, { actions: ['suspendre', 'effectuer', 'annuler'] }),
  [ETAT.SUSPENDU]: avecStatut(ETAT.SUSPENDU, { actions: ['reprendre', 'annuler'] }),
  [ETAT.EFFECTUE]: avecStatut(ETAT.EFFECTUE, { actions: [], isTerminal: true }),
  [ETAT.ANNULE]: avecStatut(ETAT.ANNULE, { actions: [], isTerminal: true }),
};

const ACTION_LABELS = { demarrer: 'Démarrer', reprendre: 'Reprendre', suspendre: 'Suspendre', effectuer: 'Effectuer', annuler: 'Annuler' };
const ACTION_CLASSES = { demarrer: 'bons-action-btn demarrer', reprendre: 'bons-action-btn reprendre', suspendre: 'bons-action-btn suspendre', effectuer: 'bons-action-btn effectuer', annuler: 'bons-action-btn annuler' };
const ACTION_ICONS = { demarrer: Play, reprendre: RotateCcw, suspendre: Pause, effectuer: CheckCircle, annuler: XCircle };

const ETAT_LABELS = Object.fromEntries(Object.entries(STATUTS.bon).map(([k, v]) => [k, v.libelle]));

const ETAT_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les états', icon: Filter },
  ...[ETAT.NOUVEAU, ETAT.SUSPENDU, ETAT.EN_COURS, ETAT.EFFECTUE, ETAT.ANNULE].map((e) => ({
    value: String(e), label: TRANSITIONS[e].label, icon: TRANSITIONS[e].icon, color: TRANSITIONS[e].color,
  })),
];

const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

const ETAT_IMMOBILISATION_OPTIONS = [
  { value: '', label: "Ne pas changer l'état" },
  { value: 1, label: 'Fonctionnel avec problème' },
  { value: 2, label: 'En panne' },
  { value: 3, label: 'À changer' },
  { value: 4, label: 'Hors service' },
];

const DEMANDE_ETAT_MAP = {
  EN_ATTENTE: { label: 'En attente', cls: 'dmd2-etat--attente' },
  ACCEPTEE:   { label: 'Acceptée',   cls: 'dmd2-etat--acceptee' },
  REFUSEE:    { label: 'Refusée',    cls: 'dmd2-etat--refusee' },
  COMMANDE:   { label: 'Commandée',  cls: 'dmd2-etat--commande' },
  SERVIE:     { label: 'Servie',     cls: 'dmd2-etat--servie' },
};

function demandeEtatLabel(etat) {
  return DEMANDE_ETAT_MAP[etat]?.label || etat || '—';
}

function demandeEtatClass(etat) {
  return DEMANDE_ETAT_MAP[etat]?.cls || '';
}


function etatLabel(etat) { return etat == null ? '—' : ETAT_LABELS[etat] ?? t('État {n}', { n: etat }); }
function niveauLabel(niveau) { return niveau == null ? '—' : NIVEAU_LABELS[niveau] ?? t('Niveau {n}', { n: niveau }); }

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
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

function getAvailableActions(bon) {
  if (!bon) return [];
  const tache = TRANSITIONS[bon.etat];
  return tache ? tache.actions : [];
}

function isTerminalState(bon) {
  if (!bon) return false;
  const tache = TRANSITIONS[bon.etat];
  return tache ? tache.isTerminal || false : false;
}

function getEtatCount(bons, etatValue) {
  return bons.filter((b) => b.etat === etatValue).length;
}


async function computeBonMaintenanceNeeds(bonId) {
  let tooltip = t("Aucun document d'achat (Demander/Commander) pour ce bon.");
  let commanderNecessaire = false;
  let demanderNecessaire = false;
  const dejaCommandeParArticle = {};
  const dejaDemandeParArticle = {};

  try {
    const documents = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonId);

    const lignesTexte = (documents ?? [])
      .filter((d) => d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' || d.piece?.codePieceType === '.D_Fourniture')
      .map((d) => {
        const typeLabel = d.piece.codePieceType === '.COMMANDE_FOURNISSEUR' ? t('Commande') : t('Demande');
        const articlesTexte = (d.lignes ?? []).map((l) => t('Article #{id} (Qté {qte})', { id: l.prestataireArticlesId, qte: l.qte ?? '—' })).join(t(', '));
        return `${typeLabel} — ${articlesTexte || t('aucun article')}`;
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
    const tachesAvecArticle = (taches ?? []).filter((tache) => tache.prestataireArticlesId != null);

    await Promise.all(tachesAvecArticle.map(async (tache) => {
      try {
        const disponible = await pieceLigneService.getQuantiteDisponible(tache.prestataireArticlesId);
        const qte = tache.qte ?? 0;
        const manquant = disponible != null ? Math.max(0, qte - disponible) : qte;
        if (manquant <= 0) return;

        const dejaCommande = dejaCommandeParArticle[tache.prestataireArticlesId] ?? 0;
        const dejaDemande = dejaDemandeParArticle[tache.prestataireArticlesId] ?? 0;
        const resteACommander = manquant - dejaCommande;
        const resteADemander = manquant - dejaDemande;

        if (resteADemander > 0) demanderNecessaire = true;
        if (resteACommander > 0 && tache.sousTraitantId != null) commanderNecessaire = true;
      } catch { /* ignore */ }
    }));
  } catch (err) {
    console.error(`Erreur vérification stock pour le bon ${bonId} :`, err);
  }

  return { tooltip, commanderNecessaire, demanderNecessaire };
}


const SORTABLE_COLUMNS = {
  num: (b) => b.num || '',
  titre: (b) => b.titre || '',
  prestataire: (b) => b.prestataire?.raisonSociale || b.prestataire?.nom || '',
  service: (b) => b.serviceNom || '',
  urgence: (b) => b.urgence ?? -1,
  priorite: (b) => prioriteRang(b.priorite),
  delai: (b) => delaiSla(b.sla)?.echeance ?? Number.MAX_SAFE_INTEGER,
  date: (b) => (b.date ? new Date(b.date).getTime() : 0),
  etat: (b) => b.etat ?? -1,
};

const PAGE_SIZE = 10;

/* =========================================================
   COLONNES TABLEAU (paramétrables)
   ========================================================= */
const BON_COLUMNS_DEFAULT = [
  { key: 'num',         label: 'Numéro',      visible: true, searchable: true  },
  { key: 'titre',       label: 'Titre',       visible: true, searchable: true  },
  { key: 'prestataire', label: 'Prestataire', visible: true, searchable: false },
  { key: 'service',     label: 'Service',     visible: true, searchable: false },
  { key: 'urgence',     label: 'Urgence',     visible: true, searchable: false },
  { key: 'priorite',    label: 'Priorité',    visible: true, searchable: false },
  { key: 'delai',       label: 'Délai',       visible: true, searchable: false },
  { key: 'date',        label: 'Date',        visible: true, searchable: false },
  { key: 'etat',        label: 'État',        visible: true, searchable: false },
];

/* =========================================================
   EXPORT EXCEL — Liste complète des attributs (avec extract)
   ========================================================= */
const EXCEL_ALL_FIELDS = [
  // --- Identification ---
  { key: 'id',                          label: 'ID',                        extract: (b) => b.id ?? '' },
  { key: 'num',                         label: 'Numéro',                    extract: (b) => b.num || '' },
  { key: 'titre',                       label: 'Titre',                     extract: (b) => b.titre || '' },
  { key: 'description',                 label: 'Description',               extract: (b) => b.description || '' },

  // --- État & classification ---
  { key: 'etat',                        label: 'État',                      extract: (b) => etatLabel(b.etat) },
  { key: 'urgence',                     label: 'Urgence',                   extract: (b) => niveauLabel(b.urgence) },
  { key: 'priorite',                    label: 'Priorité (code)',           extract: (b) => b.priorite ?? '' },
  { key: 'prioriteLabel',               label: 'Priorité (libellé)',        extract: (b) => prioriteLabel(b.priorite) },

  // --- Dates ---
  { key: 'date',                        label: 'Date',                      extract: (b) => formatDate(b.date) },
  { key: 'dateCreation',                label: 'Date de création',          extract: (b) => formatDate(b.dateCreation) },
  { key: 'dateDebut',                   label: 'Date de début',             extract: (b) => formatDate(b.dateDebut) },
  { key: 'dateFin',                     label: 'Date de fin',               extract: (b) => formatDate(b.dateFin) },
  { key: 'dateCloture',                 label: 'Date de clôture',           extract: (b) => formatDate(b.dateCloture) },

  // --- Prestataire ---
  { key: 'prestataireId',               label: 'Prestataire ID',            extract: (b) => b.prestataireId ?? b.prestataire?.id ?? '' },
  { key: 'prestataireNom',              label: 'Prestataire',               extract: (b) => b.prestataire?.raisonSociale || b.prestataire?.nom || '' },
  { key: 'prestataireCode',             label: 'Code prestataire',          extract: (b) => b.prestataire?.code || '' },

  // --- Sous-traitant ---
  { key: 'sousTraitantId',              label: 'Sous-traitant ID',          extract: (b) => b.sousTraitantId ?? '' },
  { key: 'sousTraitant',                label: 'Sous-traitant',             extract: (b) => b.sousTraitant || '' },

  // --- Service ---
  { key: 'serviceId',                   label: 'Service ID',                extract: (b) => b.serviceId ?? b.service?.id ?? '' },
  { key: 'serviceNom',                  label: 'Service',                   extract: (b) => b.serviceNom || b.service?.description || b.service?.label || '' },

  // --- Dépôt ---
  { key: 'depotId',                     label: 'Dépôt ID',                  extract: (b) => b.depotId ?? b.depot?.id ?? '' },
  { key: 'depotNom',                    label: 'Dépôt',                     extract: (b) => b.depotNom || b.depot?.codeDepots || b.depot?.libelle || '' },

  // --- Équipement / Immobilisation ---
  { key: 'lotArticleImmobilistationId', label: 'Immobilisation ID',         extract: (b) => b.lotArticleImmobilistationId ?? '' },

  // --- Personnel ---
  { key: 'personnelId',                 label: 'Personnel ID',              extract: (b) => b.personnelId ?? '' },
  { key: 'personnelNom',                label: 'Personnel',                 extract: (b) => b.personnelNom || (b.personnel ? `${b.personnel.nom || ''} ${b.personnel.prenom || ''}`.trim() : '') },

  // --- Création / modification ---
  { key: 'personnelCreationNom',        label: 'Créé par',                  extract: (b) => b.personnelCreationNom || '' },
  { key: 'personnelModificationNom',    label: 'Modifié par',               extract: (b) => b.personnelModificationNom || '' },

  // --- Champs libres ---
  { key: 'motifSuspension',             label: 'Motif suspension',          extract: (b) => b.motifSuspension || '' },
  { key: 'observations',                label: 'Observations',              extract: (b) => b.observations || '' },
  { key: 'commentaire',                 label: 'Commentaire',               extract: (b) => b.commentaire || '' },

  // --- SLA & coût ---
  { key: 'slaReponse',                  label: 'SLA réponse',               extract: (b) => b.sla?.statutReponse || '' },
  { key: 'slaResolution',               label: 'SLA résolution',            extract: (b) => b.sla?.statutResolution || '' },
  { key: 'coutTotal',                   label: 'Coût total',                extract: (b) => b.cout?.coutTotal ?? '' },
];

const EXCEL_COLUMNS_OPTIONS = EXCEL_ALL_FIELDS.map(({ key, label }) => ({ key, label }));

/**
 * Extrait les champs dynamiques non listés (fallback).
 * Permet de capturer les attributs bruts non prévus.
 */
function collectDynamicFields(bons) {
  const knownKeys = new Set(EXCEL_ALL_FIELDS.map((f) => f.key));
  const skipKeys = new Set([
    'prestataire', 'service', 'depot', 'clinique', 'cliniqueId', 'cliniqueNom', 'personnel',
    'sla', 'cout', 'rcaAnalyses', 'commentaires', 'intervenants',
    'taches', 'diagnostics', 'controles', 'remisesEnService',
    'documents', 'historique', 'reclamations', 'pieces', 'lignes',
  ]);

  const dynamicKeys = new Set();

  bons.forEach((b) => {
    Object.keys(b || {}).forEach((k) => {
      if (knownKeys.has(k) || skipKeys.has(k)) return;
      const v = b[k];
      if (v === null || v === undefined) return;
      if (typeof v === 'object') return;
      dynamicKeys.add(k);
    });
  });

  return Array.from(dynamicKeys).map((k) => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    extract: (b) => {
      const v = b[k];
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? t("Oui") : t("Non");
      return String(v);
    },
  }));
}

function getColumnSearchValue(b, key) {
  switch (key) {
    case 'num':         return b.num || '';
    case 'titre':       return b.titre || '';
    case 'prestataire': return b.prestataire?.raisonSociale || b.prestataire?.nom || '';
    case 'service':     return b.serviceNom || b.service?.description || '';
    case 'urgence':     return niveauLabel(b.urgence);
    case 'priorite':    return `${b.priorite || ''} ${prioriteLabel(b.priorite)}`;
    case 'delai':       return delaiSla(b.sla)?.texte || '';
    case 'date':        return formatDate(b.date);
    case 'etat':        return etatLabel(b.etat);
    default:            return '';
  }
}

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

  // Vues de la liste (« Mes bons en retard », « Urgents de mon service »…) et vues enregistrées
  const [moi] = useState(contexteUtilisateur);
  const [vueId, setVueId] = useVueActive('bons', moi.cle, 'tous');
  const [mesBonIds, setMesBonIds] = useState(null);
  useEffect(() => {
    if (moi.personnelId == null) return undefined;
    let annule = false;
    const ids = (liste) => new Set((liste || []).map((x) => String(x?.bon?.id ?? x?.id)).filter((x) => x !== 'undefined'));
    api.get(`/espace-personnel/${moi.personnelId}/bons-roles`)
      .then(({ data }) => { if (!annule) setMesBonIds(ids(data)); })
      .catch(() => api.get(`/espace-personnel/${moi.personnelId}/bons`)
        .then(({ data }) => { if (!annule) setMesBonIds(ids(data)); })
        .catch(() => { /* « Mes bons » se limite alors aux bons créés ou demandés */ }));
    return () => { annule = true; };
  }, [moi.personnelId]);
  const vuesListe = useMemo(() => vuesBons(moi, mesBonIds), [moi, mesBonIds]);
  const vueCourante = vuesListe.find((v) => v.id === vueId) || vuesListe[0];
  const choisirVue = (id, reglages) => {
    setVueId(id);
    if (!reglages) return;
    setSearchTerm(reglages.recherche ?? '');
    setEtatFilter(String(reglages.etat ?? 'all'));
    if (reglages.tri) { setSortColumn(reglages.tri); setSortDirection(reglages.sens || 'asc'); }
  };

  // Lien direct /bons-maintenance?id=12 (QR code d'une fiche, notification) : ouvre ce bon
  const [parametres, setParametres] = useSearchParams();
  const idLien = Number(parametres.get('id')) || null;
  useEffect(() => {
    if (!idLien) return;
    setSelectedBon((actuel) => (actuel?.id === idLien ? actuel : { id: idLien }));
    setViewMode('details');
  }, [idLien]);

  const retourListe = () => {
    setViewMode('list');
    if (parametres.has('id')) setParametres({}, { replace: true });
  };

  // Équipements + état des équipements dans une même fenêtre (?vue=equipements&onglet=etat|liste) :
  // en revenant d'une fiche équipement avec « Retour », la fenêtre se rouvre sur le même onglet.
  const equipementsOpen = parametres.get('vue') === 'equipements';
  const ongletEquipements = parametres.get('onglet') === 'liste' ? 'liste' : 'etat';
  const ouvrirEquipements = (onglet = 'etat') => setParametres({ vue: 'equipements', onglet }, { replace: true });
  const fermerEquipements = useCallback(() => setParametres({}, { replace: true }), [setParametres]);

  // Bons en retard SLA dans une fenêtre (?sla=retard) : lien des notifications « délai SLA dépassé »
  const slaOpen = parametres.get('sla') === 'retard';
  const ouvrirSlaRetards = () => setParametres({ sla: 'retard' }, { replace: true });
  const fermerSlaRetards = useCallback(() => setParametres({}, { replace: true }), [setParametres]);
  const ouvrirBonEnRetard = (ligne) => {
    const bon = bons.find((b) => b.id === ligne.bonMaintenanceId) || { id: ligne.bonMaintenanceId };
    setParametres({}, { replace: true });
    setSelectedBon(bon);
    setViewMode('details');
  };
  const [demanderAllume, setDemanderAllume] = useState(false);
  const [commanderAllume, setCommanderAllume] = useState(false);
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);

  const [anomaliesOpen, setAnomaliesOpen] = useState(false);
  const [blocagesOpen, setBlocagesOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  // Alertes envoyées par les machines (SNMP / Syslog) : badge = alertes à traiter
  const [alertesMachinesOpen, setAlertesMachinesOpen] = useState(false);
  const [nbAlertesMachines, setNbAlertesMachines] = useState(0);
  useEffect(() => {
    const compter = () => alerteMachineService.compterNouvelles().then(setNbAlertesMachines).catch(() => {});
    compter();
    const minuterie = setInterval(compter, 60 * 1000);
    return () => clearInterval(minuterie);
  }, [alertesMachinesOpen]);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: t("Confirmer"), onConfirm: null, error: null, confirming: false,
  });

  const [motifModal, setMotifModal] = useState({ show: false, motif: '', error: null, confirming: false });
  const [etatModal, setEtatModal] = useState({ show: false, etat: '', error: null, confirming: false });
  const [rowInfo, setRowInfo] = useState({});

  const [columnSettings, setColumnSettings] = useState(BON_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  /* --- Export Excel : colonnes sélectionnables --- */
  const [isExcelColumnsModalOpen, setIsExcelColumnsModalOpen] = useState(false);
  const [excelSelectedColumns, setExcelSelectedColumns] = useState([]);
  const [exportingExcel, setExportingExcel] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await bonMaintenanceService.getAll(0, 200);
      setBons(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les bons de maintenance. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ── SLA : bons ouverts dont le délai de réponse ou de résolution est dépassé ── */
  const [slaRetards, setSlaRetards] = useState(null);
  const [slaChargement, setSlaChargement] = useState(false);
  const [slaErreur, setSlaErreur] = useState(null);
  const [slaBandeauMasque, setSlaBandeauMasque] = useState(false);
  // Lecture des retards : les mises à jour d'état ont lieu à l'arrivée de la réponse
  const recupererSlaRetards = useCallback(() => slaService.getDepassements()
    .then((data) => { setSlaRetards(Array.isArray(data) ? data : []); setSlaErreur(null); })
    .catch((err) => {
      console.error('Erreur chargement dépassements SLA :', err);
      setSlaErreur(t('Impossible de charger les retards SLA.'));
    })
    .finally(() => setSlaChargement(false)), []);
  const chargerSlaRetards = () => { setSlaChargement(true); recupererSlaRetards(); };
  useEffect(() => {
    recupererSlaRetards();
    const minuterie = setInterval(recupererSlaRetards, 5 * 60 * 1000); // les délais SLA se comptent en heures
    return () => clearInterval(minuterie);
  }, [recupererSlaRetards]);
  const nbSlaRetards = slaRetards?.length ?? 0;

  /* ── Délai SLA de chaque bon (colonne « Délai ») : temps restant, ou résultat pour un bon effectué ── */
  const [slaParBon, setSlaParBon] = useState({});
  const idsSla = useMemo(
    () => bons.filter((b) => Number(b.etat) !== ETAT.ANNULE).map((b) => b.id).filter((id) => id != null),
    [bons],
  );
  const recupererSlaOuverts = useCallback(() => slaService.getPourBons(idsSla)
    .then((liste) => {
      const parBon = {};
      (Array.isArray(liste) ? liste : []).forEach((s) => { parBon[s.bonMaintenanceId] = s; });
      setSlaParBon(parBon);
    })
    .catch((err) => console.error('Erreur chargement des délais SLA :', err)), [idsSla]);
  useEffect(() => { recupererSlaOuverts(); }, [bons, recupererSlaOuverts]);
  useEffect(() => {
    const minuterie = setInterval(recupererSlaOuverts, 60 * 1000); // le temps restant avance
    return () => clearInterval(minuterie);
  }, [recupererSlaOuverts]);
  const bonsAvecSla = useMemo(
    () => bons.map((b) => (slaParBon[b.id] ? { ...b, sla: slaParBon[b.id] } : b)),
    [bons, slaParBon],
  );

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
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();
    return bonsAvecSla.filter((b) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(b, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(b.etat) === etatFilter;
      const matchesVue = !vueCourante.filtre || vueCourante.filtre(b);
      return matchesSearch && matchesEtat && matchesVue;
    });
  }, [bonsAvecSla, searchTerm, etatFilter, columnSettings, vueCourante]);

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

  useEffect(() => { setCurrentPage(1); }, [searchTerm, etatFilter, sortColumn, sortDirection, vueId]);
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

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="bons-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="bons-sort-icon active" />
      : <ArrowDown size={13} className="bons-sort-icon active" />;
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

  const TABLE_COLUMNS_DEF = {
    num: { cell: (b) => <td key="num" style={{ fontWeight: 600 }}>{b.num || '—'}</td> },
    titre: { cell: (b) => <td key="titre">{t(b.titre)}</td> },
    prestataire: { cell: (b) => <td key="prestataire">{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td> },
    service: { cell: (b) => <td key="service">{b.serviceNom || b.service?.description || '—'}</td> },
    urgence: {
      cell: (b) => (
        <td key="urgence">
          {b.urgence ? <BadgeStatut type="niveau" valeur={b.urgence} taille="petit" /> : '—'}
        </td>
      ),
    },
    priorite: {
      cell: (b) => (
        <td key="priorite">
          <span className={`bons-priorite-badge priorite-color-${prioriteColor(b.priorite)}`}>
            {b.priorite || '—'} · {t(prioriteLabel(b.priorite))}
          </span>
        </td>
      ),
    },
    delai: {
      cell: (b) => {
        const d = delaiSla(b.sla);
        return (
          <td key="delai">
            {d ? (
              <span className={`bons-delai-badge bons-delai-badge--${d.ton}`} title={d.titre}>
                {d.texte}
              </span>
            ) : '—'}
          </td>
        );
      },
    },
    date: {
      cell: (b) => (
        <td key="date">
          <span className="bons-date-cell"><Calendar size={14} />{formatDate(b.date)}</span>
        </td>
      ),
    },
    etat: {
      cell: (b) => (
        <td key="etat">
          <BadgeStatut type="bon" valeur={b.etat} />
        </td>
      ),
    },
  };

  /* =========================================================
     EXPORT EXCEL — Modale de sélection
     ========================================================= */
  const openExcelColumnsModal = () => {
    // Toutes les colonnes cochées par défaut
    setExcelSelectedColumns(EXCEL_COLUMNS_OPTIONS.map((c) => c.key));
    setIsExcelColumnsModalOpen(true);
  };

  const toggleExcelColumn = (key) => {
    setExcelSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAllExcelColumns = () => {
    if (excelSelectedColumns.length === EXCEL_COLUMNS_OPTIONS.length) {
      setExcelSelectedColumns([]);
    } else {
      setExcelSelectedColumns(EXCEL_COLUMNS_OPTIONS.map((c) => c.key));
    }
  };

  /* =========================================================
     EXPORT EXCEL — Génération complète
     ========================================================= */
  const handleExportExcel = async () => {
    if (excelSelectedColumns.length === 0) {
      alert(t("Veuillez sélectionner au moins une colonne."));
      return;
    }

    try {
      setExportingExcel(true);

      // 1. Charger les détails complets (tous attributs) de chaque bon
      const details = await Promise.all(
        sortedBons.map(async (b) => {
          try {
            const full = await bonMaintenanceService.getById(b.id);
            return full ?? b;
          } catch (err) {
            console.warn(`Impossible de charger le détail du bon #${b.id}`, err);
            return b;
          }
        })
      );

      // 2. Récupérer les champs dynamiques (fallback pour capturer les attributs non listés)
      const dynamicFields = collectDynamicFields(details);

      // 3. Construire la liste complète des colonnes disponibles
      const allFields = [...EXCEL_ALL_FIELDS, ...dynamicFields];

      // 4. Filtrer selon les colonnes cochées
      const selectedFields = allFields.filter((f) =>
        excelSelectedColumns.includes(f.key)
      );

      const headers = selectedFields.map((f) => t(f.label));

      const rows = details.map((b) =>
        selectedFields.map((f) => {
          const v = f.extract(b);
          if (v === null || v === undefined) return '';
          return typeof v === 'string' ? t(v) : v; // libellés d'état traduits ; données saisies inchangées
        })
      );

      // 5. Générer le fichier XLSX
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      const colWidths = headers.map((h, idx) => {
        let maxLen = String(h).length;
        rows.forEach((row) => {
          const cellLen = String(row[idx] ?? '').length;
          if (cellLen > maxLen) maxLen = cellLen;
        });
        return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t('Bons de maintenance').slice(0, 31));

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `bons-maintenance-complet-${today}.xlsx`);

      setIsExcelColumnsModalOpen(false);
    } catch (err) {
      console.error('Erreur export Excel:', err);
      alert(t("Erreur lors de l'export Excel."));
    } finally {
      setExportingExcel(false);
    }
  };

  // Impression : document mis en page avec les colonnes visibles du tableau et l'ordre de tri actuel
  const handleImprimerListe = () => {
    const valeur = (b, key) => {
      switch (key) {
        case 'urgence':  return t(niveauLabel(b.urgence));
        case 'priorite': return b.priorite ? `${b.priorite} · ${t(prioriteLabel(b.priorite))}` : '—';
        case 'etat':     return t(etatLabel(b.etat));
        default:         return getColumnSearchValue(b, key);
      }
    };
    imprimerListe({
      titre: t('Bons de maintenance'),
      colonnes: visibleColumns.map((c) => t(c.label)),
      lignes: sortedBons.map((b) => visibleColumns.map((c) => valeur(b, c.key))),
      filtres: [
        { label: t('Vue'), valeur: vueCourante.filtre ? t(vueCourante.label) : '' },
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? t(etatLabel(Number(etatFilter))) : '' },
      ],
    });
  };
  const handleResetFilters = () => { setSearchTerm(''); setEtatFilter('all'); setVueId('tous'); };

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
        alert(`${t("Le bon a été créé, mais {n} élément(s) n'ont pas pu être ajoutés :", { n: result.errors.length })}\n${summary}\n\n${t("Vous pouvez les ajouter depuis la page de détail du bon.")}`);
      }
      const conflits = (result.intervenants || []).filter((i) => i.conflitPeriode);
      if (conflits.length > 0) {
        const detail = conflits.map((i) => `- ${i.personnel?.nom || ''} ${i.personnel?.prenom || ''} : ${i.conflitMessage}`).join('\n');
        alert(`⚠️ ${t('Conflit de planning détecté pour {n} intervenant(s) :', { n: conflits.length })}\n${detail}\n\n${t('Le bon a bien été créé. Vérifiez la disponibilité de ces techniciens si besoin.')}`);
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
      title: t("Supprimer le bon de maintenance"),
      message: t('Supprimer le bon « {titre} » ? Cette action est irréversible.', { titre: selectedBon.titre }),
      confirmText: t("Supprimer"),
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

  /* ── Sélection multiple (cases à cocher) pour supprimer plusieurs bons d'un coup ── */
  const [coches, setCoches] = useState(() => new Set());
  const [derniereCoche, setDerniereCoche] = useState(null);
  // On ne garde que les bons encore présents (après suppression, rechargement…)
  const cochesValides = useMemo(() => bons.filter((b) => coches.has(b.id)).map((b) => b.id), [bons, coches]);
  const basculerCoche = (bon, index, plage) => {
    setCoches((prev) => {
      const suite = new Set(prev);
      const cocher = !prev.has(bon.id);
      // Maj+clic : coche (ou décoche) toute la plage depuis la dernière case cliquée
      if (plage && derniereCoche != null) {
        const [a, b] = [Math.min(derniereCoche, index), Math.max(derniereCoche, index)];
        paginatedBons.slice(a, b + 1).forEach((x) => (cocher ? suite.add(x.id) : suite.delete(x.id)));
      } else if (cocher) suite.add(bon.id);
      else suite.delete(bon.id);
      return suite;
    });
    setDerniereCoche(index);
  };
  const pageCochee = paginatedBons.length > 0 && paginatedBons.every((b) => coches.has(b.id));
  const pagePartielle = !pageCochee && paginatedBons.some((b) => coches.has(b.id));
  const basculerPage = () => setCoches((prev) => {
    const suite = new Set(prev);
    paginatedBons.forEach((b) => (pageCochee ? suite.delete(b.id) : suite.add(b.id)));
    return suite;
  });
  const toutCocher = () => setCoches(new Set(sortedBons.map((b) => b.id)));
  const viderCoches = () => { setCoches(new Set()); setDerniereCoche(null); };

  // Confirmation puis suppression d'une liste de bons ; en cas d'échec partiel,
  // la fenêtre propose de réessayer avec les seuls bons restants.
  const demanderSuppression = (ids, erreur = null) => {
    const apercu = bons.filter((b) => ids.includes(b.id)).slice(0, 5).map((b) => b.num || `#${b.id}`).join(', ');
    setConfirmModal({
      show: true,
      type: 'danger',
      title: ids.length === 1 ? t('Supprimer le bon de maintenance') : t('Supprimer {n} bons de maintenance', { n: ids.length }),
      message: ids.length === 1
        ? t('Supprimer le bon « {titre} » ? Cette action est irréversible.', { titre: apercu })
        : `${t('Supprimer les {n} bons sélectionnés ? Cette action est irréversible.', { n: ids.length })} (${apercu}${ids.length > 5 ? '…' : ''})`,
      confirmText: erreur ? t('Réessayer') : t('Supprimer la sélection'),
      error: erreur,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setIsDeleting(true);
        try {
          const resultats = await Promise.allSettled(ids.map((id) => bonMaintenanceService.remove(id)));
          const supprimes = ids.filter((_, i) => resultats[i].status === 'fulfilled');
          const echecs = ids.filter((_, i) => resultats[i].status === 'rejected');
          setBons((prev) => prev.filter((b) => !supprimes.includes(b.id)));
          setSelectedBon((actuel) => (actuel && supprimes.includes(actuel.id) ? null : actuel));
          setCoches(new Set(echecs)); // les bons non supprimés restent cochés
          if (echecs.length === 0) {
            closeConfirmModal();
          } else {
            const raison = resultats.find((r) => r.status === 'rejected')?.reason?.response?.data?.message;
            demanderSuppression(
              echecs,
              t('Supprimés : {ok} · non supprimés : {ko} (ils restent cochés).', { ok: supprimes.length, ko: echecs.length }) + (raison ? ` ${raison}` : ''),
            );
          }
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteSelection = () => {
    if (!cochesValides.length || isDeleting) return;
    demanderSuppression(cochesValides);
  };

  const runTransition = async (action) => {
    if (!selectedBon || transitioning) return { ok: false, message: t("Aucun bon sélectionné.") };
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
      title: t("Annuler le bon de maintenance"),
      message: t('Annuler le bon « {titre} » ?', { titre: selectedBon.titre }),
      confirmText: t("Annuler le bon"),
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
    return option ? option.label : t("Tous les états");
  };

  if (viewMode === 'details' && selectedBon) {
    return (
      <div>
        <BonMaintenanceDetails
          bonMaintenance={selectedBon}
          onBack={retourListe}
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
          <button
            type="button"
            className="bons-header-icon-wrapper bons-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <ICONES_MODULES.bonsMaintenance size={28} className="bons-header-icon" />
          </button>
          <div>
            <h2>{t("Bons de maintenance")}</h2>
            <p className="bons-header-subtitle">{t("Gestion des interventions de maintenance")}</p>
          </div>
        </div>

        <div className="bons-header-stats">
          <span className="bons-badge-total">{t('Total : {n}', { n: bons.length })}</span>


          <button className="bons-toggle-stats" title={t("Anomalies")} onClick={() => setAnomaliesOpen(true)}>
            <AlertTriangle size={20} />
            <span>{t("Anomalies")}</span>
          </button>

          <button className="bons-toggle-stats" title={t("Blocages")} onClick={() => setBlocagesOpen(true)}>
            <Ban size={20} />
            <span>{t("Blocages")}</span>
          </button>

          <button className="bons-toggle-stats" title={t("Équipements et leur état : fiche, historique, documents et QR code")} onClick={() => ouvrirEquipements('etat')}>
            <Gauge size={20} />
            <span>{t("Équipements")}</span>
          </button>

          <button className="bons-toggle-stats" title={t("Alertes envoyées par les machines (SNMP, Syslog) et coupures réseau")} onClick={() => setAlertesMachinesOpen(true)}>
            <RadioTower size={20} />
            <span>{t("Alertes machines")}</span>
            {nbAlertesMachines > 0 && <span className="bons-toggle-badge" aria-label={t('{n} alertes à traiter', { n: nbAlertesMachines })}>{nbAlertesMachines > 99 ? '99+' : nbAlertesMachines}</span>}
          </button>

          <button className="bons-toggle-stats" title={t("Intelligence")} onClick={() => setIntelligenceOpen(true)}>
            <Sparkles size={20} />
            <span>{t("Intelligence")}</span>
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
                title={`${t(option.label)} : ${tp('bon (compte)', count)}`}
              >
                <Icon size={18} style={{ color: option.color }} />
                <span className="bons-stat-label">{t(option.label)}</span>
                <span className="bons-stat-count">{count}</span>
                <div className="bons-stat-bar-bg">
                  <div className="bons-stat-bar-fill" style={{ width: `${percentage}%`, backgroundColor: option.color }} />
                </div>
              </div>
            );
          })}
          <div
            className={`bons-stat-item bons-stat-item--sla ${nbSlaRetards > 0 ? 'is-retard' : ''}`}
            onClick={ouvrirSlaRetards}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirSlaRetards(); } }}
            role="button"
            tabIndex={0}
            style={{ '--stat-color': '#d9434b' }}
            title={t('Voir les bons en retard SLA')}
          >
            {nbSlaRetards > 0 && <span className="bons-stat-point" aria-hidden="true" />}
            <AlarmClock size={18} style={{ color: nbSlaRetards > 0 ? '#d9434b' : '#7f969d' }} />
            <span className="bons-stat-label">{t('SLA en retard')}</span>
            <span className="bons-stat-count">{slaRetards == null ? '…' : nbSlaRetards}</span>
            <div className="bons-stat-bar-bg">
              <div
                className="bons-stat-bar-fill"
                style={{ width: `${Math.round((nbSlaRetards / (bons.length || 1)) * 100)}%`, backgroundColor: '#d9434b' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ALERTE SLA */}
      {nbSlaRetards > 0 && !slaBandeauMasque && (
        <div className="bons-sla-bandeau" role="alert">
          <AlarmClock size={18} aria-hidden="true" />
          <span>
            {nbSlaRetards === 1
              ? t('1 bon a dépassé son délai SLA.')
              : t('{n} bons ont dépassé leur délai SLA.', { n: nbSlaRetards })}
          </span>
          <button type="button" className="bons-sla-bandeau__voir" onClick={ouvrirSlaRetards}>
            {t('Voir les bons en retard')}
          </button>
          <button type="button" className="bons-sla-bandeau__fermer" onClick={() => setSlaBandeauMasque(true)} aria-label={t('Masquer')}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ACTIONS */}
      <div className="bons-actions-bar">
        <button className="bons-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} />
          <span>{t("Ajouter")}</span>
        </button>

        <button className={`bons-action-btn modifier ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={openEdit}>
          <Edit size={18} />
          <span>{t("Modifier")}</span>
        </button>

        <button className={`bons-action-btn details ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={() => setViewMode('details')}>
          <Eye size={18} />
          <span>{t("Détails")}</span>
        </button>

        <button
          className={`bons-action-btn demander ${!selectedBon || !demanderAllume ? 'disabled' : ''} ${demanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !demanderAllume}
          onClick={openDemander}
        >
          <PackageSearch size={18} />
          <span>{t("Demander")}</span>
        </button>

        <button className={`bons-action-btn demandes ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={openDemandes}>
          <PackageSearch size={18} />
          <span>{t("Demandes")}</span>
        </button>

        <button
          className={`bons-action-btn commander ${!selectedBon || !commanderAllume ? 'disabled' : ''} ${commanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !commanderAllume}
          onClick={openCommander}
        >
          <ShoppingCart size={18} />
          <span>{t("Commander")}</span>
        </button>

        <button className={`bons-action-btn supprimer ${!selectedBon || isDeleting ? 'disabled' : ''}`} disabled={!selectedBon || isDeleting} onClick={handleDelete}>
          <Trash2 size={18} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
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
                  <span>{t(ACTION_LABELS[action])}</span>
                </button>
              );
            })}
          </>
        )}

        {selectedBon && isTerminalState(selectedBon) && (
          <div className="bons-terminal-state">
            <BadgeStatut type="bon" valeur={selectedBon.etat} taille="grand" />
          </div>
        )}

        {!selectedBon && (
          <span className="bons-no-selection-message">
            <Info size={16} />
            {t("Sélectionnez un bon pour voir les actions disponibles")}
          </span>
        )}
      </div>

      {/* VUES */}
      <VuesListe
        liste="bons"
        userKey={moi.cle}
        vues={vuesListe}
        items={bons}
        chargement={loading}
        vueActive={vueCourante.id}
        reglages={{ recherche: searchTerm, etat: etatFilter, tri: sortColumn, sens: sortDirection }}
        onChoisir={choisirVue}
      />

      {/* FILTRES */}
      <div className="bons-filter-panel">
        <div className="bons-filter-group">
          <span className="bons-filter-label">{t("Recherche")}</span>
          <div className="bons-filter-input-wrap">
            <Search size={16} className="bons-filter-icon" />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="bons-filter-clear" onClick={() => setSearchTerm('')} title={t("Effacer la recherche")}>
                <XCircle size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="bons-filter-group">
          <span className="bons-filter-label">{t("État")}</span>
          <div className="bons-filter-input-wrap">
            <Filter size={16} className="bons-filter-icon" />
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              {ETAT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value !== 'all'
                    ? `${t(option.label)} (${etatStats[Number(option.value)] || 0})`
                    : t(option.label)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="bons-filter-reset" onClick={handleResetFilters}>
          <RefreshCw size={16} />
          {t("Réinitialiser")}
        </button>

        <div className="bons-filter-info">
          <span className="bons-filter-result">
            {tp('résultat', filteredBons.length)}
            {vueCourante.filtre && ` • ${t(vueCourante.label)}`}
            {etatFilter !== 'all' && ` • ${t(getActiveFilterLabel())}`}
            {searchTerm && ` • "${searchTerm}"`}
          </span>
        </div>

        <div className="bons-export-stack">
          <button className="bons-export-btn excel" title={t("Exporter en Excel (tous attributs)")} onClick={openExcelColumnsModal}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="bons-export-btn print" title={t("Imprimer")} onClick={handleImprimerListe}>
            <Printer size={18} />
          </button>
          <button className="bons-export-btn stats" title={t("Statistiques")} onClick={() => setShowFilterStats(!showFilterStats)}>
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

      {/* SÉLECTION MULTIPLE */}
      <SelectionMultiple
        nombre={cochesValides.length}
        total={sortedBons.length}
        libelle={(n) => t('Bons sélectionnés : {n}', { n })}
        onToutSelectionner={toutCocher}
        onVider={viderCoches}
        onSupprimer={handleDeleteSelection}
        suppressionEnCours={isDeleting}
      />

      {/* TABLE */}
      <div className="bons-table-wrap liste-adaptative__tableau">
        <table className="bons-table">
          <thead>
            <tr>
              <th className="selection-col">
                <CaseSelection
                  coche={pageCochee}
                  partiel={pagePartielle}
                  disabled={paginatedBons.length === 0}
                  onChange={basculerPage}
                  label={pageCochee ? t('Décocher les bons de cette page') : t('Cocher les bons de cette page')}
                />
              </th>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`bons-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="bons-th-inner">
                    <span>{t(c.label)}</span>
                    {renderSortIcon(c.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={visibleColumns.length + 1} className="bons-table-empty">
                <Loader2 size={24} className="bons-spinner" />
                <span>{t("Chargement...")}</span>
              </td></tr>
            ) : sortedBons.length === 0 ? (
              <tr><td colSpan={visibleColumns.length + 1} className="bons-table-empty">
                {bons.length === 0 ? (
                  <><AlertCircle size={24} /><span>{t("Aucun bon de maintenance pour l'instant. Ajoute le premier avec le bouton ci-dessus.")}</span></>
                ) : (
                  <><Search size={24} /><span>{t("Aucun bon ne correspond à ces filtres. Essaye de modifier ta recherche.")}</span></>
                )}
              </td></tr>
            ) : (
              paginatedBons.map((b, index) => (
                <tr
                  key={b.id}
                  className={`bons-row ${selectedBon?.id === b.id ? 'selected' : ''} ${coches.has(b.id) ? 'is-coche' : ''} ${rowInfo[b.id]?.stockInsuffisant ? 'stock-insuffisant' : ''}`}
                  onClick={() => handleRowClick(b)}
                  title={rowInfo[b.id]?.tooltip || ''}
                >
                  <td className="selection-col" onClick={(e) => e.stopPropagation()}>
                    <CaseSelection
                      coche={coches.has(b.id)}
                      onChange={(e) => basculerCoche(b, index, e.nativeEvent?.shiftKey)}
                      label={t('Sélectionner le bon {num}', { num: b.num || b.id })}
                    />
                  </td>
                  {visibleColumns.map((c) => TABLE_COLUMNS_DEF[c.key]?.cell(b))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CARTES (téléphone) */}
      <CartesListe
        lignes={loading ? [] : paginatedBons.map((b) => {
          const retard = bonEnRetard(b);
          return {
            id: b.id,
            source: b,
            num: b.num || `#${b.id}`,
            titre: b.titre,
            statut: { type: 'bon', valeur: b.etat },
            niveau: b.urgence ? { valeur: b.urgence, prefixe: 'Urgence' } : null,
            meta: [
              { icone: Building2, texte: b.serviceNom },
              { icone: retard ? AlertTriangle : Calendar, texte: retard ? t('En retard depuis le {date}', { date: formatDate(echeanceBon(b)) }) : formatDate(b.date), alerte: retard },
            ],
          };
        })}
        selectionId={selectedBon?.id}
        onChoisir={handleRowClick}
        coches={coches}
        onCocher={(b) => basculerCoche(b, paginatedBons.indexOf(b), false)}
        onOuvrir={(b) => { setSelectedBon(b); setViewMode('details'); }}
        vide={loading ? t('Chargement...') : (bons.length === 0 ? t("Aucun bon de maintenance pour l'instant. Ajoute le premier avec le bouton ci-dessus.") : t('Aucun bon ne correspond à ces filtres. Essaye de modifier ta recherche.'))}
      />

      {/* PAGINATION */}
      {!loading && sortedBons.length > 0 && (
        <div className="bons-pagination">
          <span className="bons-pagination-info">
            {tp('résultat', sortedBons.length)} — {t('page {p} / {total}', { p: currentPage, total: totalPages })}
          </span>
          <div className="bons-pagination-controls">
            <button type="button" className="bons-pagination-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft size={16} />
              {t("Précédent")}
            </button>
            {paginationRange.map((p) => (
              <button key={p} type="button" className={`bons-pagination-btn ${p === currentPage ? 'active' : ''}`} onClick={() => goToPage(p)}>
                {p}
              </button>
            ))}
            <button type="button" className="bons-pagination-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
              {t("Suivant")}
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
          alert(t("✅ Demande créée avec succès."));
          setActionsRefreshKey((k) => k + 1);
        }}
      />

      {/* MODAL COMMANDER */}
      <CommanderModal
        isOpen={commanderOpen}
        onClose={() => setCommanderOpen(false)}
        bonMaintenance={selectedBon}
        onCommandeCreee={() => {
          alert(t("✅ Commande créée avec succès."));
          setActionsRefreshKey((k) => k + 1);
        }}
      />

      {/* MODAL DEMANDES */}
      {demandesOpen && (
        <div
          className="modal-overlay"
          onClick={() => { if (!demandeActionLoading) setDemandesOpen(false); }}
        >
          <div className="bmm-modal cmd-modal dmd2-modal" onClick={(e) => e.stopPropagation()}>

            <div className="bmm-header">
              <div className="bmm-header-left">
                <div className="bmm-header-icon-wrap">
                  <PackageSearch size={22} strokeWidth={2} />
                </div>
                <div>
                  <span className="bmm-eyebrow">{t("Bon de maintenance")}</span>
                  <h2>
                    {t('Demandes — {bon}', { bon: selectedBon?.num || selectedBon?.titre || t('Bon #{id}', { id: selectedBon?.id }) })}
                  </h2>
                </div>
              </div>
              <div className="bmm-header-right">
                <span className="bmm-type-badge">{tp('demande', demandes.length)}</span>
                <button
                  type="button"
                  className="bmm-close-btn"
                  onClick={() => setDemandesOpen(false)}
                  disabled={!!demandeActionLoading}
                  aria-label={t("Fermer")}
                >
                  <XCircle size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="bmm-content cmd-body dmd2-body">
              {demandesError && (
                <div className="bmm-error">
                  <AlertTriangle size={16} strokeWidth={2.5} />
                  <span>{demandesError}</span>
                </div>
              )}

              {demandesLoading ? (
                <div className="dmd2-empty">
                  <Loader2 size={22} className="bmm-spin" />
                  <span>{t("Chargement des demandes...")}</span>
                </div>
              ) : demandes.length === 0 ? (
                <div className="dmd2-empty">
                  <PackageSearch size={26} />
                  <span>{t("Aucune demande pour ce bon de maintenance.")}</span>
                </div>
              ) : (
                <>
                  <div className="cmd-toolbar">
                    <div className="cmd-toolbar__count">
                      <span>{tp('demande', demandes.length)}</span>
                      <span className="cmd-toolbar__sep">·</span>
                      <span className="cmd-toolbar__hint">
                        {t('{n} en attente', { n: demandes.filter((d) => d.etat === 'EN_ATTENTE').length })}
                      </span>
                    </div>
                  </div>

                  <div className="cmd-table-wrap">
                    <table className="cmd-table">
                      <thead>
                        <tr>
                          <th>{t("Article")}</th>
                          <th style={{ width: 80, textAlign: 'center' }}>{t("Qté")}</th>
                          <th style={{ width: 90, textAlign: 'center' }}>{t("Mode stock")}</th>
                          <th style={{ width: 130, textAlign: 'center' }}>{t("État")}</th>
                          <th style={{ width: 200, textAlign: 'end' }}>{t("Actions")}</th>
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
                              <td className="cmd-cell-article">
                                {demande.designation || t('Article #{id}', { id: demande.prestataireArticlesId })}
                                {demande.prestataireArticlesId && demande.designation && (
                                  <span className="cmd-cell-article__ref">
                                    {t("Réf. #")}{demande.prestataireArticlesId}
                                  </span>
                                )}
                              </td>

                              <td className="cmd-cell-num">
                                <span className="cmd-cell-besoin__pill">{demande.qte}</span>
                              </td>

                              <td className="cmd-cell-num">
                                {demande.modeStock != null ? (
                                  <span className="cmd-cell-stock__pill">{demande.modeStock}</span>
                                ) : (
                                  <span className="cmd-cell-stock__pill cmd-cell-stock__pill--empty">—</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <span className={`dmd2-etat-badge ${etatCls}`}>{t(etatTxt)}</span>
                              </td>

                              <td>
                                {isEnAttente ? (
                                  <div className="dmd2-row-actions">
                                    <button
                                      type="button"
                                      className="dmd2-btn dmd2-btn--accept"
                                      onClick={() => handleAccepterDemande(demande.id)}
                                      disabled={isLoading}
                                    >
                                      {isLoading ? (
                                        <Loader2 size={13} className="bmm-spin" />
                                      ) : (
                                        <CheckCircle size={13} strokeWidth={2.5} />
                                      )}
                                      <span>{isLoading ? '...' : t("Accepter")}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="dmd2-btn dmd2-btn--refuse"
                                      onClick={() => handleRefuserDemande(demande.id)}
                                      disabled={isLoading}
                                    >
                                      {isLoading ? (
                                        <Loader2 size={13} className="bmm-spin" />
                                      ) : (
                                        <XCircle size={13} strokeWidth={2.5} />
                                      )}
                                      <span>{isLoading ? '...' : t("Refuser")}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="dmd2-no-action" style={{ textAlign: 'end' }}>—</div>
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

            <div className="bmm-footer">
              <div className="bmm-footer-left">
                <span className="bmm-footer-step">
                  {t('{n} en attente', { n: demandes.filter((d) => d.etat === 'EN_ATTENTE').length })}
                </span>
              </div>
              <div className="bmm-footer-right">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={loadDemandes}
                  disabled={demandesLoading || !!demandeActionLoading}
                >
                  <RefreshCw
                    size={15}
                    strokeWidth={2.5}
                    className={demandesLoading ? 'bmm-spin' : ''}
                    style={{ marginRight: 6 }}
                  />
                  {t("Actualiser")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setDemandesOpen(false)}
                  disabled={!!demandeActionLoading}
                >
                  {t("Fermer")}
                </Button>
              </div>
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
                <h3>{t("Motif de suspension")}</h3>
                <p>{t("Indique pourquoi ce bon de maintenance est suspendu.")}</p>
                <textarea
                  className="confirm-modal-input"
                  value={motifModal.motif}
                  onChange={(e) => setMotifModal((p) => ({ ...p, motif: e.target.value, error: null }))}
                  placeholder={t("Motif de suspension...")}
                  rows={3}
                  autoFocus
                  disabled={motifModal.confirming}
                />
              </div>
            </div>

            {motifModal.error && (
              <div className="confirm-modal-error">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
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
                {t("Annuler")}
              </button>
              <button
                type="button"
                className="confirm-btn primary warning"
                onClick={confirmSuspendre}
                disabled={!motifModal.motif.trim() || motifModal.confirming}
              >
                <Pause size={16} />
                {motifModal.confirming ? t("Patientez...") : t("Suspendre")}
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
                <h3>{t("Marquer effectué")}</h3>
                <p>{t("État final de l'immobilisation (laisser vide si non applicable).")}</p>
                <select
                  className="confirm-modal-input"
                  value={etatModal.etat}
                  onChange={(e) => setEtatModal((p) => ({ ...p, etat: e.target.value, error: null }))}
                  autoFocus
                  disabled={etatModal.confirming}
                >
                  {ETAT_IMMOBILISATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            {etatModal.error && (
              <div className="confirm-modal-error">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
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
                {t("Annuler")}
              </button>
              <button
                type="button"
                className="confirm-btn primary success"
                onClick={confirmEffectuer}
                disabled={etatModal.confirming}
              >
                <CheckCircle size={16} />
                {etatModal.confirming ? t("Patientez...") : t("Marquer effectué")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARAMÈTRES DES COLONNES */}
      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="bon"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />

      {/* MODALE EXPORT EXCEL — Choix des colonnes */}
      {isExcelColumnsModalOpen && (
        <div
          className="bons-excel-modal-overlay"
          onClick={() => !exportingExcel && setIsExcelColumnsModalOpen(false)}
        >
          <div
            className="bons-excel-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="bons-excel-header">
              <div className="bons-excel-header-left">
                <div className="bons-excel-header-icon">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3>{t("Exporter en Excel")}</h3>
                  <small>
                    {EXCEL_COLUMNS_OPTIONS.length} {t("attributs disponibles — sélectionnez ceux à inclure")}
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="bons-excel-close-btn"
                onClick={() => setIsExcelColumnsModalOpen(false)}
                disabled={exportingExcel}
                aria-label={t("Fermer")}
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="bons-excel-body">
              <div className="bons-excel-toolbar">
                <span className="bons-excel-count">
                  {excelSelectedColumns.length} / {EXCEL_COLUMNS_OPTIONS.length} {t("sélectionné(s)")}
                </span>
                <button
                  type="button"
                  className="bons-excel-toggle-all"
                  onClick={toggleAllExcelColumns}
                  disabled={exportingExcel}
                >
                  {excelSelectedColumns.length === EXCEL_COLUMNS_OPTIONS.length
                    ? t("Tout décocher")
                    : t("Tout cocher")}
                </button>
              </div>

              <div className="bons-excel-grid">
                {EXCEL_COLUMNS_OPTIONS.map((col) => {
                  const checked = excelSelectedColumns.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      className={`bons-excel-col-item ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExcelColumn(col.key)}
                        disabled={exportingExcel}
                      />
                      {t(col.label)}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* FOOTER */}
            <div className="bons-excel-footer">
              <small className="bons-excel-footer-info">
                📊 {sortedBons.length} {t("bon(s) à exporter")}
              </small>

              <div className="bons-excel-footer-actions">
                <button
                  type="button"
                  className="bons-excel-btn secondary"
                  onClick={() => setIsExcelColumnsModalOpen(false)}
                  disabled={exportingExcel}
                >
                  {t("Annuler")}
                </button>
                <button
                  type="button"
                  className="bons-excel-btn primary"
                  onClick={handleExportExcel}
                  disabled={excelSelectedColumns.length === 0 || exportingExcel}
                >
                  <FileSpreadsheet size={16} />
                  {exportingExcel ? t("Export...") : t("Exporter")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALES PAGES EXTERNES */}
      <PageModal
        isOpen={slaOpen}
        onClose={fermerSlaRetards}
        title={t('Bons en retard SLA')}
        subtitle={t('Bons ouverts dont le délai de réponse ou de résolution est dépassé — cliquez sur un bon pour l\'ouvrir')}
        icon={AlarmClock}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <SlaRetards
          bons={slaRetards}
          chargement={slaChargement}
          erreur={slaErreur}
          onRecharger={chargerSlaRetards}
          onOuvrir={ouvrirBonEnRetard}
        />
      </PageModal>

      <PageModal
        isOpen={anomaliesOpen}
        onClose={() => setAnomaliesOpen(false)}
        title={t("Détection d'anomalies")}
        subtitle={t("Pics anormaux de réclamations par équipement ou par service")}
        icon={AlertTriangle}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <Anomalies isModal />
      </PageModal>

      <PageModal
        isOpen={blocagesOpen}
        onClose={() => setBlocagesOpen(false)}
        title={t("Blocages d'équipement")}
        subtitle={t("Équipements sans suite après arrêt obligatoire")}
        icon={Ban}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <BlocagesImmobilisation isModal />
      </PageModal>

      <PageModal
        isOpen={equipementsOpen}
        onClose={fermerEquipements}
        title={t("Équipements")}
        subtitle={t("État, fiche, historique des pannes, documents et étiquettes QR")}
        icon={Gauge}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <EquipementsEtEtat onglet={ongletEquipements} onChangerOnglet={ouvrirEquipements} />
      </PageModal>

      <PageModal
        isOpen={intelligenceOpen}
        onClose={() => setIntelligenceOpen(false)}
        title={t("Intelligence")}
        subtitle={t("Vue consolidée : Risques, Anomalies et RCA/CAPA croisés")}
        icon={Sparkles}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <Intelligence isModal />
      </PageModal>

      <PageModal
        isOpen={alertesMachinesOpen}
        onClose={() => setAlertesMachinesOpen(false)}
        title={t("Alertes machines")}
        subtitle={t("Warnings envoyés par les machines (SNMP, Syslog) et coupures détectées par la surveillance réseau")}
        icon={RadioTower}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <AlertesMachines isModal />
      </PageModal>
    </div>
  );
}