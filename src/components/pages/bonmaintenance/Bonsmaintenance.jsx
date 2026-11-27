import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DROITS, DROITS_ACTIONS_BON, useDroits } from '../../../constants/privileges';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit,
  Eye,
  PackageSearch,
  ShoppingCart,
  Trash2,
  Play,
  RotateCcw,
  Pause,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  Building2,
  Loader2,
  Info,
  AlertTriangle,
  Ban,
  Gauge,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlarmClock,
  TriangleAlert,
  RadioTower,
  Timer,
  MapPin,
  ClipboardCheck,
} from 'lucide-react';
import { FenetreValidateurs, BoutonsDecision } from './ValidationBon';
import FiltreLieu, { useCarteLieux, useFiltreLieu } from '../../ui/FiltreLieu/FiltreLieu';
import { ICONES_MODULES } from '../../../constants/modules';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import bonMaintenanceFullService from '../../../services/Bonmaintenancefullservice';
import bonMaintenancePieceService from '../../../services/Bonmaintenancepieceservice';
import { prioriteLabel, prioriteRang, prioriteColor } from '../../../constants/Priorite';
import BonMaintenanceModal from '../../ui/modals/Bonmaintenancemodal';
import BonMaintenanceDetails from './BonMaintenanceDetailsDiffere';
import FicheBonMaintenance from '../Fichebonmaintenance/Fichebonmaintenance';
import ListeDocumentsAchat from './ListeDocumentsAchat';
import PieceEditor from '../../ui/PieceEditor/PieceEditor';
import PageModal from '../../ui/modals/PageModal';
import Button from '../../ui/Button';
import Anomalies from '../Anomalies/Anomalies';
import BlocagesImmobilisation from '../Blocagesimmobilisation/Blocagesimmobilisation';
import EquipementsEtEtat from '../Equipements/Equipementsetetat';
import ChronoEmployes from '../PerformanceEmployes/ChronoEmployes';
import AlertesMachines from '../AlertesMachines/AlertesMachines';
import slaService from '../../../services/slaService';
import { delaiSla } from '../../../utils/delaiSla';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';
import { t, tp } from '../../../i18n';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import { STATUTS, TONS } from '../../../constants/statuts';
import { imprimerListe } from '../../../utils/imprimerListe';
import api from '../../../services/api';
import VuesListe from '../../ui/Listes/VuesListe';
import { useVueActive } from '../../ui/Listes/stockageVues';
import CartesListe from '../../ui/Listes/CartesListe';
import SelectionMultiple, { CaseSelection } from '../../ui/Listes/SelectionMultiple';
import { bonArchive, bonEnRetard, contexteUtilisateur, echeanceBon, vuesBons } from '../../ui/Listes/vuesMetier';
import '../../ui/modals/Modal.css';
import '../../ui/modals/BonMaintenanceModal.css';
import './Bonsmaintenance.css';
import Pagination from '../../commun/Pagination';
import EtatLecture, { ResumeLecture } from '../../commun/EtatLecture';
import LignesChargement from '../../commun/LignesChargement';
import {
  AnnonceCopie,
  BoutonFiltresColonnes,
  BoutonMenuColonne,
  BoutonTri,
  ChampFiltre,
  choixColonnes,
  filtrerParColonnes,
  useFiltresColonnes,
} from '../../commun/TableauColonnes';
import {
  etatLabel,
  niveauLabel,
  formatDate,
  EXCEL_ALL_FIELDS,
  EXCEL_COLUMNS_OPTIONS,
  collectDynamicFields,
} from './exportBons';
import { MenuAchatsBons, MenuOutilsBons } from './MenusBons';
import { SlaRetards } from './SlaRetards';
import { useAppDispatch, useAppSelector, useExecuter } from '../../../store/hooks';
import { bons as moduleBons, PARAMS_LISTE_BONS } from '../../../store/modules/bons';
import { lireRequete } from '../../../store/referentiels';
import PrioritesDuJour from '../../commun/decision/PrioritesDuJour';

const ETAT = { NOUVEAU: 1, SUSPENDU: 2, EN_COURS: 3, EFFECTUE: 4, ANNULE: 10 };

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

const ETAT_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les états', icon: Filter },
  ...[ETAT.NOUVEAU, ETAT.SUSPENDU, ETAT.EN_COURS, ETAT.EFFECTUE, ETAT.ANNULE].map((e) => ({
    value: String(e), label: TRANSITIONS[e].label, icon: TRANSITIONS[e].icon, color: TRANSITIONS[e].color,
  })),
];

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

let lotBesoins = null;

const besoinsConnus = new Map();

if (typeof window !== 'undefined') window.addEventListener('gmao:ecriture', () => besoinsConnus.clear());

const besoinsEnCours = new Map();

function besoinsPieces(bonId) {
  const connu = besoinsConnus.get(bonId);
  if (connu && Date.now() < connu.jusqua) return Promise.resolve(connu.valeur);
  if (besoinsEnCours.has(bonId)) return besoinsEnCours.get(bonId);
  if (!lotBesoins) {
    const lot = { ids: new Set() };
    lotBesoins = lot;
    lot.promesse = Promise.resolve()
      .then(() => {
        lotBesoins = null;
        return api.get('/bon-maintenance/besoins-pieces', { params: { ids: [...lot.ids].join(',') } });
      })
      .then(({ data }) => {
        const parBon = new Map((data || []).map((x) => [x.bonId, x]));
        const jusqua = Date.now() + 5000;
        parBon.forEach((valeur, id) => besoinsConnus.set(id, { jusqua, valeur }));
        return parBon;
      });
  }
  lotBesoins.ids.add(bonId);
  const promesse = lotBesoins.promesse.then((parBon) => parBon.get(bonId))
    .finally(() => besoinsEnCours.delete(bonId));
  besoinsEnCours.set(bonId, promesse);
  return promesse;
}

async function computeBonMaintenanceNeeds(bonId) {
  let tooltip = t("Aucun document d'achat (Demander/Commander) pour ce bon.");
  try {
    const besoins = await besoinsPieces(bonId);
    const lignesTexte = (besoins?.documents ?? []).map((d) => {
      const typeLabel = d.type === 'COMMANDE' ? t('Commande') : t('Demande');
      const articlesTexte = (d.lignes ?? []).map((l) => t('Article #{id} (Qté {qte})', { id: l.prestataireArticlesId, qte: l.qte ?? '—' })).join(t(', '));
      return `${typeLabel} — ${articlesTexte || t('aucun article')}`;
    });
    if (lignesTexte.length > 0) tooltip = lignesTexte.join('\n');
    return { tooltip, commanderNecessaire: Boolean(besoins?.commanderNecessaire), demanderNecessaire: Boolean(besoins?.demanderNecessaire) };
  } catch (err) {
    console.error(`Erreur calcul des besoins en pièces du bon ${bonId} :`, err);
    return { tooltip, commanderNecessaire: false, demanderNecessaire: false };
  }
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
  lecture: (b) => (b.dateLecture ? 1 : 0),
};

const PAGE_SIZE = 10;

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
  { key: 'lecture',     label: 'Lu',          visible: true, searchable: false },
];

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

const COLONNES_TEXTE = BON_COLUMNS_DEFAULT.map((c) => ({
  cle: c.key,
  label: c.label,
  filtre: ['num', 'description', 'titre'].includes(c.key) ? 'texte' : (['criticite', 'urgence', 'priorite', 'etat', 'lecture'].includes(c.key) ? 'liste' : undefined),
  texte: (b) => {
    if (c.key === 'lecture') return b.dateLecture ? t('Lu') : t('Non lu');
    if (c.key === 'priorite') return t(prioriteLabel(b.priorite) || '');
    return t(getColumnSearchValue(b, c.key));
  },
}));

const COLONNE_TEXTE = Object.fromEntries(COLONNES_TEXTE.map((c) => [c.cle, c]));

export default function BonsMaintenance() {
  const aDroit = useDroits();

  const dispatch = useAppDispatch();
  const executer = useExecuter();
  const bons = useAppSelector(moduleBons.selecteurs.elements);
  const statutBons = useAppSelector(moduleBons.selecteurs.statut);
  const [loading, setLoading] = useState(statutBons !== 'pret');
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');
  const [lieuFilter, setLieuFilter] = useState('');
  const carteLieux = useCarteLieux();
  const dansLieu = useFiltreLieu(carteLieux, lieuFilter);

  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBon, setSelectedBon] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [commanderOpen, setCommanderOpen] = useState(false);
  const [demanderOpen, setDemanderOpen] = useState(false);

  const [demandesOpen, setDemandesOpen] = useState(false);
  const [listeAchat, setListeAchat] = useState(null);
  const [demandes, setDemandes] = useState([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [demandeActionLoading, setDemandeActionLoading] = useState(null);
  const [demandesError, setDemandesError] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const [moi] = useState(contexteUtilisateur);
  const [vueId, setVueId] = useVueActive('bons', moi.cle, 'tous');
  const [mesBonIds, setMesBonIds] = useState(null);
  const chargerMesBonsSepares = useCallback(() => {
    if (moi.personnelId == null) return;
    const ids = (liste) => new Set((liste || []).map((x) => String(x?.bon?.id ?? x?.id)).filter((x) => x !== 'undefined'));
    api.get(`/espace-personnel/${moi.personnelId}/bons-roles`)
      .then(({ data }) => setMesBonIds(ids(data)))
      .catch(() => api.get(`/espace-personnel/${moi.personnelId}/bons`)
        .then(({ data }) => setMesBonIds(ids(data)))
        .catch(() => { }));
  }, [moi.personnelId]);
  const [achatIds, setAchatIds] = useState(null);
  const vuesListe = useMemo(() => vuesBons(moi, mesBonIds, achatIds), [moi, mesBonIds, achatIds]);
  const vueCourante = vuesListe.find((v) => v.id === vueId) || vuesListe[0];
  const choisirVue = (id, reglages) => {
    setVueId(id);
    if (!reglages) return;
    setSearchTerm(reglages.recherche ?? '');
    setEtatFilter(String(reglages.etat ?? 'all'));
    if (reglages.tri) { setSortColumn(reglages.tri); setSortDirection(reglages.sens || 'asc'); }
  };

  const [parametres, setParametres] = useSearchParams();
  const idLien = Number(parametres.get('id')) || null;

  const etatLien = parametres.get('etat');
  const vueLien = parametres.get('vue');
  useEffect(() => {
    if (etatLien == null && vueLien == null) return;
    setSearchTerm('');
    fc.vider();
    setEtatFilter(etatLien != null && /^\d+$/.test(etatLien) ? etatLien : 'all');
    setVueId(vueLien && vuesListe.some((v) => v.id === vueLien) ? vueLien : 'tous');
    const reste = new URLSearchParams(parametres);
    reste.delete('etat');
    reste.delete('vue');
    setParametres(reste, { replace: true });
  }, [etatLien, vueLien]);
  useEffect(() => {
    if (!idLien) return;
    setSelectedBon((actuel) => (actuel?.id === idLien ? actuel : { id: idLien }));
    setViewMode('details');
  }, [idLien]);

  const chronoLien = parametres.get('chrono') === '1';
  useEffect(() => {
    if (!chronoLien) return;
    setIntelligenceOpen(true);
    setParametres({}, { replace: true });
  }, [chronoLien, setParametres]);

  const retourListe = () => {
    setViewMode('list');
    if (parametres.has('id')) setParametres({}, { replace: true });
  };

  const equipementsOpen = parametres.get('vue') === 'equipements';
  const ongletEquipements = parametres.get('onglet') === 'liste' ? 'liste' : 'etat';
  const ouvrirEquipements = (onglet = 'etat') => setParametres({ vue: 'equipements', onglet }, { replace: true });
  const fermerEquipements = useCallback(() => setParametres({}, { replace: true }), [setParametres]);

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
  const [alertesMachinesOpen, setAlertesMachinesOpen] = useState(false);
  const [validateursOpen, setValidateursOpen] = useState(false);
  const [nbAlertesMachines, setNbAlertesMachines] = useState(0);

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

  const [isExcelColumnsModalOpen, setIsExcelColumnsModalOpen] = useState(false);
  const [excelSelectedColumns, setExcelSelectedColumns] = useState([]);
  const [exportingExcel, setExportingExcel] = useState(false);

  const load = async ({ forcer = true } = {}) => {
    if (forcer || statutBons !== 'pret') setLoading(true);
    setError(null);
    try {
      await executer(moduleBons.actions.charger({ params: PARAMS_LISTE_BONS, forcer }));
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les bons de maintenance. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ forcer: false }); }, []);

  const [slaRetards, setSlaRetards] = useState(null);
  const [slaChargement, setSlaChargement] = useState(false);
  const [slaErreur, setSlaErreur] = useState(null);
  const recupererSlaRetards = useCallback(() => lireRequete('slaDepassements')
    .then((data) => { setSlaRetards(Array.isArray(data) ? data : []); setSlaErreur(null); })
    .catch((err) => {
      console.error('Erreur chargement dépassements SLA :', err);
      setSlaErreur(t('Impossible de charger les retards SLA.'));
    })
    .finally(() => setSlaChargement(false)), []);
  const chargerSlaRetards = () => { setSlaChargement(true); recupererSlaRetards(); };
  const nbSlaRetards = slaRetards?.length ?? 0;

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

  const mesBonsCharges = useRef(false);
  const chargerInfosListe = useCallback(async (avecRetards) => {
    const avecMesBons = !mesBonsCharges.current && moi.personnelId != null;
    try {
      const { data } = await api.post('/bon-maintenance/infos-liste', {
        ids: idsSla, depassements: !!avecRetards, personnelId: avecMesBons ? Number(moi.personnelId) : null,
      }, { silencieux: true });
      if (Array.isArray(data?.sla)) {
        const parBon = {};
        data.sla.forEach((s) => { parBon[s.bonMaintenanceId] = s; });
        setSlaParBon(parBon);
      }
      if (data?.alertesMachines != null) setNbAlertesMachines(Number(data.alertesMachines) || 0);
      if (Array.isArray(data?.depassements)) { setSlaRetards(data.depassements); setSlaErreur(null); }
      if (Array.isArray(data?.mesBonIds)) { setMesBonIds(new Set(data.mesBonIds.map(String))); mesBonsCharges.current = true; }
    } catch {
      recupererSlaOuverts();
      if (avecRetards) recupererSlaRetards();
      lireRequete('compteAlertesMachines').then(setNbAlertesMachines).catch(() => {});
      if (avecMesBons) { mesBonsCharges.current = true; chargerMesBonsSepares(); }
    }
  }, [idsSla, moi.personnelId, recupererSlaOuverts, recupererSlaRetards, chargerMesBonsSepares]);
  const tourInfos = useRef(0);
  useEffect(() => {
    if (loading) return undefined;
    chargerInfosListe(tourInfos.current % 5 === 0);
    const minuterie = setInterval(() => {
      if (document.hidden) return;
      tourInfos.current += 1;
      chargerInfosListe(tourInfos.current % 5 === 0);
    }, 60 * 1000);
    return () => clearInterval(minuterie);
  }, [chargerInfosListe, alertesMachinesOpen, loading]);
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
    setListeAchat('DEMANDE');
    await loadDemandes();
  };
  const openCommandes = () => { if (selectedBon) setListeAchat('COMMANDE'); };

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
    const visibles = bons.filter((b) => (vueCourante.archives ? bonArchive(b) : !bonArchive(b)));
    const stats = {};
    Object.values(ETAT).forEach((val) => { stats[val] = getEtatCount(visibles, val); });
    return stats;
  }, [bons, vueCourante]);

  const fc = useFiltresColonnes('bons');
  const choixCol = useMemo(() => choixColonnes(COLONNES_TEXTE, bonsAvecSla), [bonsAvecSla]);
  const filteredBons = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();
    const parColonne = filtrerParColonnes(bonsAvecSla, COLONNES_TEXTE, fc.filtres, choixCol);
    return parColonne.filter((b) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(b, key).toLowerCase().includes(term));
      const matchesEtat = etatFilter === 'all' || String(b.etat) === etatFilter;
      const matchesVue = !vueCourante.filtre || vueCourante.filtre(b);
      return matchesSearch && matchesEtat && matchesVue && dansLieu(b);
    });
  }, [bonsAvecSla, searchTerm, etatFilter, columnSettings, vueCourante, fc.filtres, choixCol, dansLieu]);

  useEffect(() => {
    const ids = bons.map((b) => b.id);
    if (ids.length === 0) { setAchatIds(new Set()); return undefined; }
    let annule = false;
    Promise.all(ids.map((id) => besoinsPieces(id).catch(() => null)))
      .then((liste) => {
        if (annule) return;
        setAchatIds(new Set(liste.filter((x) => x && (x.demanderNecessaire || x.commanderNecessaire)).map((x) => String(x.bonId))));
      });
    return () => { annule = true; };
  }, [bons, actionsRefreshKey]);

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

  useEffect(() => { setCurrentPage(1); }, [searchTerm, etatFilter, lieuFilter, sortColumn, sortDirection, vueId, fc.filtres]);
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
          const aPourvoir = needs.commanderNecessaire || needs.demanderNecessaire;
          const quoi = needs.demanderNecessaire && needs.commanderNecessaire ? t('Articles à demander ou à commander')
            : needs.demanderNecessaire ? t('Articles à demander') : t('Articles à commander');
          return [bon.id, {
            tooltip: aPourvoir ? `${quoi} (stock insuffisant)\n${needs.tooltip}` : needs.tooltip,
            stockInsuffisant: aPourvoir,
          }];
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
    num: { cell: (b) => <td key="num" className="liste-num">{b.num || '—'}</td> },
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
    lecture: {
      cell: (b) => (
        <td key="lecture">
          <EtatLecture objet={b} compact actif={[1, 2, 3].includes(Number(b.etat))} />
        </td>
      ),
    },
  };

  const openExcelColumnsModal = () => {
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

  const handleExportExcel = async () => {
    if (excelSelectedColumns.length === 0) {
      alert(t("Veuillez sélectionner au moins une colonne."));
      return;
    }

    try {
      setExportingExcel(true);

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

      const dynamicFields = collectDynamicFields(details);

      const allFields = [...EXCEL_ALL_FIELDS, ...dynamicFields];

      const selectedFields = allFields.filter((f) =>
        excelSelectedColumns.includes(f.key)
      );

      const headers = selectedFields.map((f) => t(f.label));

      const rows = details.map((b) =>
        selectedFields.map((f) => {
          const v = f.extract(b);
          if (v === null || v === undefined) return '';
          return typeof v === 'string' ? t(v) : v;
        })
      );

      const XLSX = await import('xlsx');
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

  const handleImprimerListe = () => {
    const valeur = (b, key) => {
      switch (key) {
        case 'urgence':  return t(niveauLabel(b.urgence));
        case 'priorite': return b.priorite ? `${b.priorite} · ${t(prioriteLabel(b.priorite))}` : '—';
        case 'etat':     return t(etatLabel(b.etat));
        case 'lecture':  return b.dateLecture ? t('Lu') : t('Non lu');
        default:         return getColumnSearchValue(b, key);
      }
    };
    imprimerListe({
      titre: t('Bons de maintenance'),
      colonnes: visibleColumns.map((c) => t(c.label)),
      lignes: sortedBons.map((b) => visibleColumns.map((c) => valeur(b, c.key))),
      filtres: [
        { label: t('Vue'), valeur: vueCourante.sansFiltre ? '' : t(vueCourante.label) },
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? t(etatLabel(Number(etatFilter))) : '' },
        ...COLONNES_TEXTE.filter((c) => fc.actif(c.cle)).map((c) => ({ label: t(c.label), valeur: fc.filtres[c.cle].trim() })),
      ],
    });
  };
  const handleResetFilters = () => { setSearchTerm(''); setEtatFilter('all'); setLieuFilter(''); setVueId('tous'); fc.vider(); };

  const handleRowClick = (bon) => {
    setSelectedBon((prev) => (prev?.id === bon.id ? null : bon));
  };

  const openCreate = () => { setSelectedBon(null); setModalOpen(true); };
  const openEdit = () => { if (selectedBon) setViewMode('edit'); };
  const bonFige = !!selectedBon && (Number(selectedBon.etat) === 4 || Number(selectedBon.etat) === 10);
  const raisonFige = !bonFige ? undefined : Number(selectedBon.etat) === 10
    ? t('Ce bon est annulé : il ne peut plus être modifié.') : t('Ce bon est effectué : il ne peut plus être modifié.');
  const openCommander = () => { if (selectedBon && !bonFige) setCommanderOpen(true); };
  const openDemander = () => { if (selectedBon && !bonFige) setDemanderOpen(true); };

  const handleSave = async (payload, children) => {
    if (selectedBon) {
      await executer(moduleBons.actions.modifier({ id: selectedBon.id, donnees: payload }));
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
      message: t('Supprimer le bon « {titre} » et tout ce qui lui est lié (tâches, intervenants, pièces, diagnostics, rapport, discussion, historique) ? La réclamation d’origine est gardée. Cette action est irréversible.', { titre: selectedBon.titre }),
      confirmText: t("Supprimer"),
      error: null,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setIsDeleting(true);
        try {
          await executer(moduleBons.actions.supprimer(selectedBon.id));
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

  const [coches, setCoches] = useState(() => new Set());
  const [derniereCoche, setDerniereCoche] = useState(null);
  const cochesValides = useMemo(() => bons.filter((b) => coches.has(b.id)).map((b) => b.id), [bons, coches]);
  const basculerCoche = (bon, index, plage) => {
    setCoches((prev) => {
      const suite = new Set(prev);
      const cocher = !prev.has(bon.id);
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

  const demanderSuppression = (ids, erreur = null) => {
    const apercu = bons.filter((b) => ids.includes(b.id)).slice(0, 5).map((b) => b.num || `#${b.id}`).join(', ');
    setConfirmModal({
      show: true,
      type: 'danger',
      title: ids.length === 1 ? t('Supprimer le bon de maintenance') : t('Supprimer {n} bons de maintenance', { n: ids.length }),
      message: ids.length === 1
        ? t('Supprimer le bon « {titre} » et tout ce qui lui est lié (tâches, intervenants, pièces, diagnostics, rapport, discussion, historique) ? La réclamation d’origine est gardée. Cette action est irréversible.', { titre: apercu })
        : `${t('Supprimer les {n} bons sélectionnés et tout ce qui leur est lié (tâches, intervenants, pièces, diagnostics, rapports, discussions, historique) ? Les réclamations d’origine sont gardées. Cette action est irréversible.', { n: ids.length })} (${apercu}${ids.length > 5 ? '…' : ''})`,
      confirmText: erreur ? t('Réessayer') : t('Supprimer la sélection'),
      error: erreur,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setIsDeleting(true);
        try {
          const resultats = await Promise.allSettled(ids.map((id) => executer(moduleBons.actions.supprimer(id))));
          const supprimes = ids.filter((_, i) => resultats[i].status === 'fulfilled');
          const echecs = ids.filter((_, i) => resultats[i].status === 'rejected');
          setSelectedBon((actuel) => (actuel && supprimes.includes(actuel.id) ? null : actuel));
          setCoches(new Set(echecs));
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

  const operation = (nom, ...args) => executer(moduleBons.actions[nom]({ id: selectedBon.id, args })).then((r) => r.element ?? r.resultat);

  const runTransition = async (action) => {
    if (!selectedBon || transitioning) return { ok: false, message: t("Aucun bon sélectionné.") };
    setTransitioning(true);
    try {
      const updated = await action();
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
    const result = await runTransition(() => operation('passerEnCours'));
    if (!result.ok) alert(result.message);
  };

  const handleReprendre = async () => {
    if (!selectedBon || transitioning) return;
    const result = await runTransition(() => operation('reprendre'));
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
    const result = await runTransition(() => operation('suspendre', motif));
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
    const result = await runTransition(() => operation('effectuer', etat));
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
        const result = await runTransition(() => operation('annuler'));
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
          ongletInitial={parametres.get('chat') === '1' ? 'chat' : null}
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

        <div className="bons-header-vues">
          <VuesListe
            liste="bons"
            userKey={moi.cle}
            vues={vuesListe}
            items={bons}
            chargement={loading}
            vueActive={vueCourante.id}
            reglages={{ recherche: searchTerm, etat: etatFilter, tri: sortColumn, sens: sortDirection }}
            onChoisir={choisirVue}
            max={4}
          />
        </div>

        <MenuOutilsBons
          nbAlertesMachines={nbAlertesMachines + nbSlaRetards}
          elements={[
            { cle: 'anomalies', icone: AlertTriangle, label: t('Anomalies'), aide: t('Pics de réclamations anormaux'), onClick: () => setAnomaliesOpen(true) },
            { cle: 'blocages', icone: Ban, label: t('Blocages'), aide: t('Équipements bloqués trop longtemps'), onClick: () => setBlocagesOpen(true) },
            { cle: 'equipements', icone: Gauge, label: t('Équipements'), aide: t('Fiche, historique, documents et QR code'), onClick: () => ouvrirEquipements('etat') },
            { cle: 'alertes', icone: RadioTower, label: t('Alertes machines'), aide: t('Alertes SNMP, Syslog et coupures réseau'), badge: nbAlertesMachines, onClick: () => setAlertesMachinesOpen(true) },
            { cle: 'sla', icone: AlarmClock, label: t('Retards SLA'), aide: t('Bons qui ont dépassé leur délai de réponse ou de résolution'), badge: nbSlaRetards, onClick: ouvrirSlaRetards },
            { cle: 'chrono', icone: Timer, label: t('Chrono des employés'), aide: t('Qui travaille en ce moment, et depuis quand'), onClick: () => setIntelligenceOpen(true) },
            { cle: 'validation', icone: ClipboardCheck, label: t('Validation des bons'), aide: t('Qui valide les bons effectués'), onClick: () => setValidateursOpen(true) },
          ]}
        />

      </div>

      <PrioritesDuJour onOuvrir={(ligne) => {
        setSelectedBon(bons.find((b) => b.id === ligne.id) || { id: ligne.id });
        setViewMode('details');
      }} />

      <div className="bons-actions-bar">
        {aDroit(DROITS.BON_AJOUTER_MODIFIER) && (
          <>
            <button className="bons-action-btn ajouter" onClick={openCreate}>
              <Plus size={18} />
              <span>{t("Ajouter")}</span>
            </button>

            <button className={`bons-action-btn modifier ${!selectedBon || bonFige ? 'disabled' : ''}`} disabled={!selectedBon || bonFige} onClick={openEdit}
              title={raisonFige}>
              <Edit size={18} />
              <span>{t("Modifier")}</span>
            </button>
          </>
        )}

        <button className={`bons-action-btn details ${!selectedBon ? 'disabled' : ''}`} disabled={!selectedBon} onClick={() => setViewMode('details')}>
          <Eye size={18} />
          <span>{t("Détails")}</span>
        </button>

        {aDroit(DROITS.BON_ARTICLES) && (
        <MenuAchatsBons
          actif={!!selectedBon}
          allume={!bonFige && (demanderAllume || commanderAllume)}
          elements={[
            { cle: 'demander', icone: PackageSearch, label: t('Demander'), actif: demanderAllume && !bonFige, allume: demanderAllume && !bonFige, onClick: openDemander },
            { cle: 'demandes', icone: PackageSearch, label: t('Demandes'), actif: true, onClick: openDemandes },
            { cle: 'commander', icone: ShoppingCart, label: t('Commander'), actif: commanderAllume && !bonFige, allume: commanderAllume && !bonFige, onClick: openCommander },
            { cle: 'commandes', icone: ShoppingCart, label: t('Commandes'), actif: true, onClick: openCommandes },
          ]}
        />
        )}

        {aDroit(DROITS.BON_AJOUTER_MODIFIER) && (
        <button className={`bons-action-btn supprimer ${!selectedBon || isDeleting || bonFige ? 'disabled' : ''}`} disabled={!selectedBon || isDeleting || bonFige} onClick={handleDelete}
          title={raisonFige}>
          <Trash2 size={18} />
          <span>{isDeleting ? t("Suppression...") : t("Supprimer")}</span>
        </button>
        )}

        <div className="bons-actions-divider" />

        {selectedBon && !isTerminalState(selectedBon) && (
          <>
            {getAvailableActions(selectedBon).filter((action) => aDroit(DROITS_ACTIONS_BON[action])).map((action) => {
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

        {selectedBon && selectedBon.validationStatut === 'A_VALIDER' && (
          <BoutonsDecision bon={selectedBon} compact onMaj={(maj) => { if (maj?.id) { dispatch(moduleBons.actions.upsert(maj)); setSelectedBon(maj); } setActionsRefreshKey((k) => k + 1); }} />
        )}

        {!selectedBon && (
          <span className="bons-no-selection-message">
            <Info size={16} />
            {t("Sélectionnez un bon pour voir les actions disponibles")}
          </span>
        )}
      </div>


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

        {(carteLieux?.lieux?.length > 0 || lieuFilter) && (
          <div className="bons-filter-group fl-groupe">
            <span className="bons-filter-label">{t("Lieu")}</span>
            <div className="bons-filter-input-wrap">
              <MapPin size={16} className="bons-filter-icon" />
              <FiltreLieu carte={carteLieux} valeur={lieuFilter} onChange={setLieuFilter} className="fl-liste" />
            </div>
          </div>
        )}

        <BoutonFiltresColonnes voir={fc.voir} onBasculer={() => fc.setVoir((v) => !v)} nb={fc.nb} />

        <button className="bons-filter-reset" onClick={handleResetFilters}>
          <RefreshCw size={16} />
          {t("Réinitialiser")}
        </button>

        <div className="bons-filter-info">
          <span className="bons-filter-result">
            {tp('résultat', filteredBons.length)}
            {!vueCourante.sansFiltre && ` • ${t(vueCourante.label)}`}
            {etatFilter !== 'all' && ` • ${t(getActiveFilterLabel())}`}
            {searchTerm && ` • "${searchTerm}"`}
          </span>
          <ResumeLecture
            elements={filteredBons}
            reference={(b) => b.num || `#${b.id}`}
            estActif={(b) => [1, 2, 3].includes(Number(b.etat))}
          />
        </div>

        <div className="bons-export-stack">
          <button className="bons-export-btn excel" title={t("Exporter en Excel (tous attributs)")} onClick={openExcelColumnsModal}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="bons-export-btn print" title={t("Imprimer")} onClick={handleImprimerListe}>
            <Printer size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bons-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <SelectionMultiple
        nombre={cochesValides.length}
        total={sortedBons.length}
        libelle={(n) => t('Bons sélectionnés : {n}', { n })}
        onToutSelectionner={toutCocher}
        onVider={viderCoches}
        onSupprimer={handleDeleteSelection}
        suppressionEnCours={isDeleting}
      />

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
                  onClick={() => fc.basculer(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Cliquer pour rechercher dans cette colonne')}
                >
                  <div className="cl-th">
                    <span className="bons-th-inner">
                      <span>{t(c.label)}</span>
                      <BoutonTri label={c.label} onTrier={() => handleSort(c.key)}>{renderSortIcon(c.key)}</BoutonTri>
                    </span>
                    <BoutonMenuColonne colonne={COLONNE_TEXTE[c.key]} triActif={sortColumn === c.key ? sortDirection : null}
                      filtreActif={fc.actif(c.key)}
                      onTrier={(sens) => { setSortColumn(c.key); setSortDirection(sens); }}
                      onCopier={(d) => fc.copier(COLONNE_TEXTE[c.key], sortedBons, d)}
                      onMasquer={() => setColumnSettings((prev) => prev.map((x) => (x.key === c.key ? { ...x, visible: false } : x)))}
                      onEffacer={() => fc.changer(c.key, '')} />
                  </div>
                  {fc.visible(c.key) && (
                    <ChampFiltre colonne={COLONNE_TEXTE[c.key]} valeur={fc.filtres[c.key]} choix={choixCol[c.key]} onChanger={fc.changer}
                      focus={fc.focus(c.key)} onFermer={() => fc.fermer(c.key)} />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <LignesChargement colonnes={visibleColumns.length + 1} premiereCase />
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
                  onDoubleClick={() => { window.getSelection?.()?.removeAllRanges(); setSelectedBon(b); setViewMode('details'); }}
                  title={rowInfo[b.id]?.tooltip || t('Double-clic pour ouvrir le détail')}
                >
                  <td className="selection-col" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
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

      {!loading && <Pagination base={1} page={currentPage} taille={PAGE_SIZE} total={sortedBons.length} onPage={goToPage} />}

      <BonMaintenanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        bonMaintenance={selectedBon}
        isEditing={!!selectedBon}
      />

      <PieceEditor
        ouvert={demanderOpen}
        type="DEMANDE"
        bonMaintenance={selectedBon}
        onFermer={() => setDemanderOpen(false)}
        onCree={() => setActionsRefreshKey((k) => k + 1)}
      />
      <PieceEditor
        ouvert={commanderOpen}
        type="COMMANDE"
        bonMaintenance={selectedBon}
        onFermer={() => setCommanderOpen(false)}
        onCree={() => setActionsRefreshKey((k) => k + 1)}
      />

      <ListeDocumentsAchat
        ouvert={!!listeAchat}
        type={listeAchat || 'DEMANDE'}
        bonMaintenance={selectedBon}
        onFermer={() => setListeAchat(null)}
        onChange={() => setActionsRefreshKey((k) => k + 1)}
        enfants={listeAchat === 'DEMANDE' && demandes.length > 0 && (
          <button type="button" className="cm-btn cm-btn--lien" onClick={() => { setListeAchat(null); setDemandesOpen(true); }}>
            <PackageSearch size={15} /> {t('Anciennes demandes de pièces')} ({demandes.length})
          </button>
        )}
      />

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

      <AnnonceCopie texte={fc.annonce} />

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="bon"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />

      {isExcelColumnsModalOpen && (
        <div
          className="bons-excel-modal-overlay"
          onClick={() => !exportingExcel && setIsExcelColumnsModalOpen(false)}
        >
          <div
            className="bons-excel-modal"
            onClick={(e) => e.stopPropagation()}
          >
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
        title={t("Chrono des employés")}
        subtitle={t("Qui travaille en ce moment, sur quel bon et depuis combien de temps")}
        icon={Timer}
        eyebrow={t('Bons de maintenance')}
        size="full"
      >
        <ChronoEmployes
          onOuvrirBon={(id) => {
            setIntelligenceOpen(false);
            setSelectedBon(bons.find((b) => b.id === id) || { id });
            setViewMode('details');
          }}
        />
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
      {validateursOpen && <FenetreValidateurs onClose={() => setValidateursOpen(false)} />}
    </div>
  );
}
