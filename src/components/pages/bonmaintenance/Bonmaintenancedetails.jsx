import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Calendar,
  Activity,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Info,
  Play,
  Pause,
  RotateCcw,
  Download,
  Printer,
  ChevronDown,
  Eye,
  PackageSearch,
  ShoppingCart,
  Users,
  ClipboardList,
  FileCheck,
  RotateCw,
  Circle,
  Link,
  Unlink,
  ExternalLink,
  Workflow,
  Inbox,
  X,
  Check,
  Euro,
  TrendingUp,
  Target,
  ShieldCheck,
  Wrench,
  Stethoscope,
  Power,
  Flag,
  Wallet,
  Gauge,
  Flame,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  MessageCircle,
  QrCode,
  History,
} from 'lucide-react';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import { prioriteLabel, prioriteColor } from '../../../constants/Priorite';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../services/Bonmaintenanceintervenanthistoriqueservice';
import bonMaintenanceCommentaireService from '../../../services/Bonmaintenancecommentaireservice';
import chatBonService from '../../../services/chatBonService';
import BmdChat from './BmdChat';
import { qrSvg, urlBon } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import bonMaintenancePieceImmoService from '../../../services/Bonmaintenancepieceimmoservice';
import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import slaService from '../../../services/slaService';
import coutService from '../../../services/coutService';
import rcaCapaService from '../../../services/rcaCapaService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import personnelService from '../../../services/Personnelservice';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import lotArticleService from '../../../services/lotArticleService';
import pieceLigneService from '../../../services/PieceLigneService';
import articleService from '../../../services/articleService';
import pieceService from '../../../services/Pieceservice';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import Tracage3DTab from './Tracage3DTab';
import { useCelebration } from './BmdCelebration';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import './BonMaintenanceDetails.css';
import {
  DiagnosticTab,
  TachesTab,
  IntervenantsTab,
  ControleEquipementTab,
  RemiseEnServiceTab,
} from './BmdSousOnglets';
import {
  SearchableSelect,
  INTERVENANT_ETAT_LABELS,
  TACHE_ETAT_LABELS,
  GRAVITE_LABELS,
  ETAT_IMMOBILISATION_OPTIONS,
  formatDateTime,
  formatDate,
  formatMontant,
  coutIntervenant,
  nomIntervenantAffiche,
} from './bmdShared';
import './BmdPage.css';

// Constantes d'état
const ETAT = {
  NOUVEAU: 1,
  SUSPENDU: 2,
  EN_COURS: 3,
  EFFECTUE: 4,
  ANNULE: 10,
};

const ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const ETAT_CLASSES = {
  1: 'etat-nouveau',
  2: 'etat-suspendu',
  3: 'etat-encours',
  4: 'etat-effectue',
  10: 'etat-annule',
};

const ETAT_ICONS = {
  1: Circle,
  2: Pause,
  3: Activity,
  4: CheckCircle,
  10: XCircle,
};

function getEtatLabel(etat) {
  return ETAT_LABELS[etat] || t("Inconnu");
}

function getEtatClass(etat) {
  return ETAT_CLASSES[etat] || '';
}

function getEtatIcon(etat) {
  return ETAT_ICONS[etat] || Circle;
}

const SLA_STATUT_LABELS = {
  RESPECTE: 'Respecté',
  DEPASSE: 'Dépassé',
  EN_COURS: 'En cours',
  NON_APPLICABLE: 'N/A',
};

const SLA_STATUT_CLASS = {
  RESPECTE: 'bmd-sla-statut--respecte',
  DEPASSE: 'bmd-sla-statut--depasse',
  EN_COURS: 'bmd-sla-statut--encours',
  NON_APPLICABLE: 'bmd-sla-statut--na',
};

function slaGlobalClass(sla) {
  if (!sla) return 'bmd-sla-btn--na';
  if (sla.statutReponse === 'DEPASSE' || sla.statutResolution === 'DEPASSE') return 'bmd-sla-btn--depasse';
  if (sla.statutReponse === 'NON_APPLICABLE' && sla.statutResolution === 'NON_APPLICABLE') return 'bmd-sla-btn--na';
  if (sla.statutReponse === 'EN_COURS' || sla.statutResolution === 'EN_COURS') return 'bmd-sla-btn--encours';
  return 'bmd-sla-btn--respecte';
}

function formatDureeHeures(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return t('{n} h', { n: heures.toFixed(1) });
  return t('{n} j', { n: (heures / 24).toFixed(1) });
}

const METHODE_RCA_LABELS = {
  CINQ_POURQUOI: '5 Pourquoi',
  ISHIKAWA: 'Ishikawa',
  PARETO: 'Pareto',
  AUTRE: 'Autre',
};

const TYPE_ACTION_LABELS = { CORRECTIVE: 'Corrective', PREVENTIVE: 'Préventive' };

const STATUT_ACTION_LABELS = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VERIFIEE_EFFICACE: 'Vérifiée efficace',
  VERIFIEE_INEFFICACE: 'Vérifiée inefficace',
};

const STATUT_ACTION_CLASS = {
  A_FAIRE: 'bmd-capa-statut--afaire',
  EN_COURS: 'bmd-capa-statut--encours',
  TERMINEE: 'bmd-capa-statut--terminee',
  VERIFIEE_EFFICACE: 'bmd-capa-statut--efficace',
  VERIFIEE_INEFFICACE: 'bmd-capa-statut--inefficace',
};

function nouvelleActionVide() {
  return { type: 'CORRECTIVE', description: '', responsable: '', dateEcheance: '' };
}

function rcaGlobalClass(analyses) {
  if (!analyses) return 'bmd-rca-btn--na';
  if (analyses.length === 0) return 'bmd-rca-btn--na';
  const actions = analyses.flatMap((a) => a.actions || []);
  if (actions.some((a) => a.enRetard)) return 'bmd-rca-btn--retard';
  if (actions.length > 0 && actions.every((a) => a.statut === 'TERMINEE' || a.statut === 'VERIFIEE_EFFICACE' || a.statut === 'VERIFIEE_INEFFICACE')) {
    return 'bmd-rca-btn--ok';
  }
  return 'bmd-rca-btn--encours';
}

// ============================================================
// PARCOURS DE RÉPARATION — construction des étapes et de la prochaine action
// ============================================================
const ETAPES_DEF = [
  { key: 'signale', label: 'Signalé', aide: 'La panne a été déclarée', icon: Flag, rubrique: 'flow' },
  { key: 'diagnostic', label: 'Diagnostic', aide: 'On cherche la cause', icon: Stethoscope, rubrique: 'diagnostic' },
  { key: 'reparation', label: 'Réparation', aide: 'Les techniciens réparent', icon: Wrench, rubrique: 'intervenants' },
  { key: 'controle', label: 'Contrôle', aide: 'On vérifie que tout marche', icon: ShieldCheck, rubrique: 'controle' },
  { key: 'remise', label: 'Remise en service', aide: "L'équipement retourne au service", icon: Power, rubrique: 'remiseEnService' },
  { key: 'cloture', label: 'Clôturé', aide: 'Le dossier est fermé', icon: CheckCircle, rubrique: 'historique' },
];

function construireParcours({ bon, nbDiagnostics, intervenants, controle, remise }) {
  const termines = intervenants.filter((i) => i.etat === 2).length;
  const actifs = intervenants.filter((i) => i.etat !== 10);
  const reparationFaite = actifs.length > 0 && actifs.every((i) => i.etat === 2);
  const cloture = bon.etat === ETAT.EFFECTUE;

  const etat = {
    signale: { fait: true, detail: formatDate(bon.date) },
    diagnostic: { fait: nbDiagnostics > 0, detail: nbDiagnostics > 0 ? tp('diagnostic fait', nbDiagnostics) : null },
    reparation: {
      fait: reparationFaite,
      detail: intervenants.length > 0 ? tp('terminé sur', termines, { total: actifs.length }) : null,
    },
    controle: {
      fait: controle?.conforme === true,
      probleme: controle?.conforme === false,
      detail: controle ? (controle.conforme ? 'Conforme' : 'Non conforme') : null,
    },
    remise: {
      fait: remise?.conforme === true,
      probleme: remise?.conforme === false,
      detail: remise ? (remise.conforme ? 'Autorisée' : 'Refusée') : null,
    },
    cloture: { fait: cloture, detail: cloture ? formatDate(bon.dateCloture) : null },
  };

  const indexActuel = cloture ? ETAPES_DEF.length : ETAPES_DEF.findIndex((e) => !etat[e.key].fait);

  const etapes = ETAPES_DEF.map((def, i) => {
    let statut = 'avenir';
    if (cloture || i < indexActuel) statut = 'fait';
    else if (i === indexActuel) statut = etat[def.key].probleme ? 'probleme' : 'actuel';
    return { ...def, ...etat[def.key], statut };
  });

  return { etapes, indexActuel, cloture };
}

function prochaineAction({ bon, parcours, intervenants }) {
  if (bon.etat === ETAT.ANNULE) {
    return {
      ton: 'neutre', icon: XCircle,
      titre: t("Ce bon a été annulé"),
      texte: t("Aucune action n'est attendue. L'historique garde la trace de ce qui a été fait."),
      bouton: { label: t("Voir l'historique"), rubrique: 'historique' },
    };
  }
  if (parcours.cloture) {
    return {
      ton: 'fini', icon: CheckCircle,
      titre: t("Réparation terminée"),
      texte: t("L'équipement est de retour dans son service et le dossier est fermé."),
      bouton: { label: t("Revoir tout le parcours"), rubrique: 'tracage' },
    };
  }
  const actuelle = parcours.etapes[parcours.indexActuel];
  switch (actuelle?.key) {
    case 'diagnostic':
      return {
        ton: 'action', icon: Stethoscope,
        titre: t("Trouvez la cause de la panne"),
        texte: t("Notez ce que vous constatez sur l’équipement et indiquez si une pièce doit être changée."),
        bouton: { label: t("Faire le diagnostic"), rubrique: 'diagnostic', form: true },
      };
    case 'reparation':
      if (intervenants.length === 0) {
        return {
          ton: 'action', icon: Users,
          titre: t("Choisissez qui va réparer"),
          texte: t("Ajoutez un technicien de l’équipe ou un sous-traitant pour cette réparation."),
          bouton: { label: t("Ajouter un intervenant"), rubrique: 'intervenants', form: true },
        };
      }
      return {
        ton: 'action', icon: Wrench,
        titre: t("La réparation est en cours"),
        texte: t("Quand un intervenant a fini, changez son état en « Terminé ». L’étape suivante se débloque toute seule."),
        bouton: { label: t("Suivre la réparation"), rubrique: 'intervenants' },
        secondaire: { label: t("Ajouter un intervenant"), rubrique: 'intervenants', form: true },
      };
    case 'controle':
      if (actuelle.probleme) {
        return {
          ton: 'alerte', icon: AlertTriangle,
          titre: t("Le contrôle n’est pas bon"),
          texte: t("L’équipement n’a pas passé le dernier contrôle. Faites une nouvelle réparation, puis contrôlez à nouveau."),
          bouton: { label: t("Faire un nouveau contrôle"), rubrique: 'controle', form: true },
          secondaire: { label: t("Ajouter une réparation"), rubrique: 'intervenants', form: true },
        };
      }
      return {
        ton: 'action', icon: ShieldCheck,
        titre: t("Vérifiez que l’équipement fonctionne"),
        texte: t("Testez l’équipement et indiquez s’il est conforme. Une valeur mesurée peut être ajoutée."),
        bouton: { label: t("Faire le contrôle"), rubrique: 'controle', form: true },
      };
    case 'remise':
      if (actuelle.probleme) {
        return {
          ton: 'alerte', icon: AlertTriangle,
          titre: t("La remise en service a été refusée"),
          texte: t("Corrigez ce qui bloque, puis enregistrez une nouvelle décision."),
          bouton: { label: t("Enregistrer une nouvelle décision"), rubrique: 'remiseEnService', form: true },
        };
      }
      return {
        ton: 'action', icon: Power,
        titre: t("Rendez l’équipement à son service"),
        texte: t("Indiquez qui autorise la remise en service et dans quel état se trouve l’équipement."),
        bouton: { label: t("Autoriser la remise en service"), rubrique: 'remiseEnService', form: true },
      };
    default:
      return {
        ton: 'action', icon: CheckCircle,
        titre: t("Toutes les étapes sont faites"),
        texte: t("Le bon va se clôturer. Vous pouvez vérifier le journal des actions."),
        bouton: { label: t("Voir l'historique"), rubrique: 'historique' },
      };
  }
}

function joursDepuis(iso) {
  if (!iso) return null;
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (isNaN(j) || j < 0) return null;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return tp('il y a jours', j);
}

// Traduction des statuts SLA en langage simple
function slaEnClair(sla) {
  if (!sla || (sla.statutReponse === 'NON_APPLICABLE' && sla.statutResolution === 'NON_APPLICABLE')) {
    return { ton: 'neutre', texte: t("Pas de délai fixé") };
  }
  if (sla.statutReponse === 'DEPASSE' || sla.statutResolution === 'DEPASSE') return { ton: 'alerte', texte: t("En retard") };
  if (sla.statutReponse === 'EN_COURS' || sla.statutResolution === 'EN_COURS') {
    const echeance = sla.echeanceResolution || sla.echeanceReponse;
    return { ton: 'attention', texte: echeance ? t('À finir avant le {date}', { date: formatDate(echeance) }) : 'Dans les temps' };
  }
  return { ton: 'ok', texte: t("Dans les temps") };
}

function rcaEnClair(analyses) {
  if (!analyses || analyses.length === 0) return { ton: 'neutre', texte: t("Pas encore analysée") };
  const actions = analyses.flatMap((a) => a.actions || []);
  if (actions.some((a) => a.enRetard)) return { ton: 'alerte', texte: t("Action en retard") };
  const ouvertes = actions.filter((a) => a.statut === 'A_FAIRE' || a.statut === 'EN_COURS').length;
  if (ouvertes > 0) return { ton: 'attention', texte: tp('action', ouvertes) };
  return { ton: 'ok', texte: t("Analysée") };
}

const ETAT_EN_CLAIR = {
  1: { texte: 'Nouveau', ton: 'info' },
  2: { texte: 'En pause', ton: 'attention' },
  3: { texte: 'En cours', ton: 'action' },
  4: { texte: 'Terminé', ton: 'ok' },
  10: { texte: 'Annulé', ton: 'neutre' },
};

// Rubriques regroupées par intention, ouvertes dans le panneau latéral
const GROUPES_RUBRIQUES = [
  {
    titre: 'Comprendre',
    aide: 'Voir où en est le dossier',
    rubriques: [
      { key: 'flow', label: "Vue d'ensemble", aide: 'Tout le dossier, étape par étape', icon: Eye },
      { key: 'tracage', label: 'Traçage 3D', aide: 'Qui a fait quoi, et quand', icon: Activity },
      { key: 'historique', label: 'Historique', aide: 'Le journal des actions', icon: History },
    ],
  },
  {
    titre: 'Réparer',
    aide: 'Le travail sur l’équipement',
    rubriques: [
      { key: 'diagnostic', label: 'Diagnostic', aide: 'La cause de la panne', icon: Stethoscope },
      { key: 'taches', label: 'Tâches', aide: 'Les travaux à planifier', icon: ClipboardList },
      { key: 'intervenants', label: 'Intervenants', aide: 'Qui répare', icon: Users },
    ],
  },
  {
    titre: 'Valider',
    aide: 'Avant de rendre l’équipement',
    rubriques: [
      { key: 'controle', label: 'Contrôle', aide: 'Les tests de bon fonctionnement', icon: ShieldCheck },
      { key: 'remiseEnService', label: 'Remise en service', aide: 'Le feu vert pour le service', icon: Power },
    ],
  },
  {
    titre: 'Échanger',
    aide: 'Discussion, notes et achats',
    rubriques: [
      { key: 'chat', label: 'Chat en direct', aide: 'Discuter avec l’équipe du bon', icon: MessageCircle },
      { key: 'commentaires', label: 'Commentaires', aide: 'Les messages de l’équipe', icon: MessageSquare },
      { key: 'documents', label: "Documents d'achat", aide: 'Commandes et demandes de pièces', icon: FileText },
    ],
  },
];

const TITRES_TIROIR = {
  sla: { label: 'Délais', icon: Clock },
  cout: { label: 'Coût de la réparation', icon: Wallet },
  rca: { label: 'Cause racine', icon: Search },
};
GROUPES_RUBRIQUES.forEach((g) => g.rubriques.forEach((r) => { TITRES_TIROIR[r.key] = r; }));

const CLE_AIDE = 'bmx-aide-masquee';
function lireAideMasquee() {
  try { return window.localStorage.getItem(CLE_AIDE) === '1'; } catch { return false; }
}
function ecrireAideMasquee(v) {
  try { window.localStorage.setItem(CLE_AIDE, v ? '1' : '0'); } catch { /* stockage indisponible */ }
}

// Panneau latéral
function Tiroir({ rubrique, onClose, children }) {
  const panneauRef = useRef(null);

  useEffect(() => {
    if (!rubrique) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const ancien = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panneauRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ancien;
    };
  }, [rubrique, onClose]);

  if (!rubrique) return null;
  const def = TITRES_TIROIR[rubrique] || { label: rubrique };
  const Icon = def.icon;

  return (
    <div className="bmx-tiroir-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        className="bmx-tiroir"
        role="dialog"
        aria-modal="true"
        aria-label={t(def.label)}
        tabIndex={-1}
        ref={panneauRef}
      >
        <header className="bmx-tiroir-entete">
          {Icon && <span className="bmx-tiroir-icone"><Icon size={20} /></span>}
          <div className="bmx-tiroir-titres">
            <h2>{t(def.label)}</h2>
            {def.aide && <p>{t(def.aide)}</p>}
          </div>
          <button type="button" className="bmx-tiroir-fermer" onClick={onClose} aria-label={t("Fermer le panneau")}>
            <X size={20} />
          </button>
        </header>
        <div className="bmx-tiroir-corps">{children}</div>
      </aside>
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function BonMaintenanceDetails({ bonMaintenance, onBack }) {
  const [bon, setBon] = useState(bonMaintenance);
  const [loading, setLoading] = useState(!bonMaintenance);
  const [error, setError] = useState(null);
  const [recalculatingPriorite, setRecalculatingPriorite] = useState(false);
  const [tiroir, setTiroir] = useState(null); // { key, form }
  const [aideMasquee, setAideMasquee] = useState(lireAideMasquee);
  const [celebrer, celebrationElement] = useCelebration();
  const [impressionEnCours, setImpressionEnCours] = useState(false);
  const [nonLusChat, setNonLusChat] = useState(0);
  const [qrOuvert, setQrOuvert] = useState(false);
  const fermerQr = useCallback(() => setQrOuvert(false), []);
  const etatBonRef = useRef(bonMaintenance?.etat);
  useEffect(() => { etatBonRef.current = bon?.etat; }, [bon?.etat]);

  const [reclamations, setReclamations] = useState([]);
  const [loadingReclamations, setLoadingReclamations] = useState(false);
  const [equipement, setEquipement] = useState(null);
  const [dernierControle, setDernierControle] = useState(null);
  const [derniereRemiseEnService, setDerniereRemiseEnService] = useState(null);
  const [intervenantsFlow, setIntervenantsFlow] = useState([]);
  const [loadingIntervenantsFlow, setLoadingIntervenantsFlow] = useState(false);
  const [historiqueFlow, setHistoriqueFlow] = useState([]);
  const [nbDiagnostics, setNbDiagnostics] = useState(0);
  const [nbTaches, setNbTaches] = useState(null);
  const [resumePret, setResumePret] = useState(false);
  const [slaInfo, setSlaInfo] = useState(null);
  const [coutInfo, setCoutInfo] = useState(null);

  const [rcaAnalyses, setRcaAnalyses] = useState([]);
  const [loadingRca, setLoadingRca] = useState(false);
  const [savingRca, setSavingRca] = useState(false);
  const [majActionId, setMajActionId] = useState(null);
  const [rcaForm, setRcaForm] = useState({
    probleme: '',
    methode: 'CINQ_POURQUOI',
    causeRacine: '',
    analyseDetaillee: '',
    auteur: '',
    actions: [nouvelleActionVide()],
  });
  const [expandedSections, setExpandedSections] = useState({
    reclamation: true,
    bon: true,
    equipement: true,
    interventions: true,
    controle: true,
    remiseService: true,
    historique: false,
  });

  useEffect(() => {
    if (!bonMaintenance || !bonMaintenance.id) {
      setLoading(false);
      return;
    }
    const loadBonDetails = async () => {
      setLoading(true);
      try {
        const bonDetails = await bonMaintenanceService.getById(bonMaintenance.id);
        setBon(bonDetails);
      } catch (err) {
        console.error('Erreur chargement détails du bon:', err);
        setError(t("Impossible de charger ce bon de maintenance. Vérifiez la connexion puis réessayez."));
        setBon(bonMaintenance);
      } finally {
        setLoading(false);
      }
    };
    loadBonDetails();
  }, [bonMaintenance]);

  const chargerSlaEtCout = useCallback(() => {
    if (!bon?.id) return;
    slaService.getPourBon(bon.id).then(setSlaInfo).catch(() => setSlaInfo(null));
    coutService.getPourBon(bon.id).then(setCoutInfo).catch(() => setCoutInfo(null));
  }, [bon?.id]);

  useEffect(() => { chargerSlaEtCout(); }, [chargerSlaEtCout]);

  // Messages non lus du chat (badge) ; silencieux si le chat n'est pas accessible
  const idBonChat = bon?.id;
  const chargerNonLusChat = useCallback(() => {
    if (!idBonChat) return;
    chatBonService.getNonLus([idBonChat])
      .then((parBon) => setNonLusChat(parBon[idBonChat] || 0))
      .catch(() => setNonLusChat(0));
  }, [idBonChat]);

  useEffect(() => { chargerNonLusChat(); }, [chargerNonLusChat]);

  const chargerRca = useCallback(() => {
    if (!bon?.id) {
      setRcaAnalyses([]);
      return;
    }
    setLoadingRca(true);
    rcaCapaService.getParBon(bon.id)
      .then((data) => setRcaAnalyses(data ?? []))
      .catch((err) => {
        console.error('Erreur chargement RCA/CAPA :', err);
        setRcaAnalyses([]);
      })
      .finally(() => setLoadingRca(false));
  }, [bon?.id]);

  useEffect(() => { chargerRca(); }, [chargerRca]);

  // Résumé utilisé par le parcours et les compteurs : rechargé à la fermeture du panneau
  const chargerResume = useCallback(async () => {
    const id = bonMaintenance?.id;
    if (!id) return;
    setLoadingIntervenantsFlow(true);
    const [diagnostics, taches, intervenants, controles, remises, historique] = await Promise.all([
      bonMaintenanceDiagnosticService.getByBonMaintenance(id).catch(() => []),
      bonMaintenanceTacheService.getByBonMaintenance(id).catch(() => null),
      bonMaintenanceIntervenantService.getByBonMaintenance(id).catch(() => []),
      bonMaintenanceControleEquipementService.getByBonMaintenance(id).catch(() => []),
      bonMaintenanceRemiseEnServiceService.getByBonMaintenance(id).catch(() => []),
      bonMaintenanceHistoriqueService.findByBonMaintenanceId(id).catch(() => []),
    ]);
    setNbDiagnostics((diagnostics ?? []).length);
    setNbTaches(taches ? taches.length : null);
    setIntervenantsFlow(intervenants ?? []);
    setDernierControle((controles ?? [])[0] ?? null);
    setDerniereRemiseEnService((remises ?? [])[0] ?? null);
    setHistoriqueFlow(historique ?? []);
    setLoadingIntervenantsFlow(false);
    setResumePret(true);
  }, [bonMaintenance?.id]);

  useEffect(() => { chargerResume(); }, [chargerResume]);

  const handleRcaFormChange = (champ, valeur) => {
    setRcaForm((f) => ({ ...f, [champ]: valeur }));
  };

  const handleRcaActionChange = (index, champ, valeur) => {
    setRcaForm((f) => {
      const actions = [...f.actions];
      actions[index] = { ...actions[index], [champ]: valeur };
      return { ...f, actions };
    });
  };

  const handleRcaAjouterLigneAction = () => {
    setRcaForm((f) => ({ ...f, actions: [...f.actions, nouvelleActionVide()] }));
  };

  const handleRcaSupprimerLigneAction = (index) => {
    setRcaForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== index) }));
  };

  const handleRcaSubmit = async () => {
    if (!rcaForm.probleme.trim() || !rcaForm.causeRacine.trim()) {
      alert(t("Le problème et la cause racine sont obligatoires."));
      return;
    }
    setSavingRca(true);
    try {
      const actionsValides = rcaForm.actions
        .filter((a) => a.description.trim())
        .map((a) => ({
          type: a.type,
          description: a.description,
          responsable: a.responsable || null,
          dateEcheance: a.dateEcheance ? new Date(a.dateEcheance).toISOString() : null,
        }));

      await rcaCapaService.creerAnalyse({
        bonMaintenanceId: bon.id,
        lotArticleImmobilistationId: bon.lotArticleImmobilistationId,
        probleme: rcaForm.probleme,
        methode: rcaForm.methode,
        causeRacine: rcaForm.causeRacine,
        analyseDetaillee: rcaForm.analyseDetaillee || null,
        auteur: rcaForm.auteur || null,
        actions: actionsValides,
      });

      setRcaForm({
        probleme: '', methode: 'CINQ_POURQUOI', causeRacine: '', analyseDetaillee: '', auteur: '',
        actions: [nouvelleActionVide()],
      });
      chargerRca();
    } catch (err) {
      console.error('Erreur création analyse RCA :', err);
      alert(t("Impossible d'enregistrer l'analyse RCA."));
    } finally {
      setSavingRca(false);
    }
  };

  const handleMajStatutAction = async (actionId, statut) => {
    setMajActionId(actionId);
    try {
      await rcaCapaService.majStatutAction(actionId, { statut });
      chargerRca();
    } catch (err) {
      console.error('Erreur mise à jour statut action CAPA :', err);
      alert(t("Impossible de mettre à jour le statut de l'action."));
    } finally {
      setMajActionId(null);
    }
  };

  const handleRecalculerPriorite = async () => {
    if (!bon?.id) return;
    setRecalculatingPriorite(true);
    try {
      const updated = await bonMaintenanceService.recalculerPriorite(bon.id);
      setBon(updated);
      chargerSlaEtCout();
    } catch (err) {
      console.error('Erreur recalcul priorité :', err);
    } finally {
      setRecalculatingPriorite(false);
    }
  };

  useEffect(() => {
    if (!bonMaintenance || !bonMaintenance.id) return;
    const loadReclamations = async () => {
      setLoadingReclamations(true);
      try {
        const data = await reclamationBonMaintenanceService.getReclamationsByBonMaintenance(bonMaintenance.id);
        setReclamations(data || []);
      } catch (err) {
        console.error('Erreur chargement réclamations:', err);
      } finally {
        setLoadingReclamations(false);
      }
    };
    loadReclamations();
  }, [bonMaintenance]);

  useEffect(() => {
    if (!bon?.lotArticleImmobilistationId) {
      setEquipement(null);
      return;
    }
    lotArticleImmobilistationService.getById(bon.lotArticleImmobilistationId)
      .then(setEquipement)
      .catch((err) => {
        console.error('Erreur chargement équipement :', err);
        setEquipement(null);
      });
  }, [bon?.lotArticleImmobilistationId]);

  // Recharge le bon après une action qui peut déclencher sa clôture automatique
  const rafraichirBon = useCallback(async () => {
    if (!bonMaintenance?.id) return;
    try {
      const bonMaj = await bonMaintenanceService.getById(bonMaintenance.id);
      if (etatBonRef.current !== ETAT.EFFECTUE && bonMaj?.etat === ETAT.EFFECTUE) {
        celebrer('bon-cloture', bonMaj.num || t('Bon #{id}', { id: bonMaj.id }));
      }
      setBon(bonMaj);
      chargerResume();
      slaService.getPourBon(bonMaintenance.id).then(setSlaInfo).catch(() => {});
      coutService.getPourBon(bonMaintenance.id).then(setCoutInfo).catch(() => {});
    } catch (err) {
      console.error('Erreur rafraîchissement du bon :', err);
    }
  }, [bonMaintenance?.id, celebrer, chargerResume]);

  const ouvrir = (key, form = false) => setTiroir({ key, form });
  const fermerTiroir = useCallback(() => {
    setTiroir(null);
    chargerResume();
    chargerSlaEtCout();
    chargerNonLusChat();
  }, [chargerResume, chargerSlaEtCout, chargerNonLusChat]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const masquerAide = () => { setAideMasquee(true); ecrireAideMasquee(true); };
  const afficherAide = () => { setAideMasquee(false); ecrireAideMasquee(false); };

  if (loading) {
    return (
      <div className="bmd-container bmx-page">
        <div className="bmx-chargement">
          <Loader2 size={36} className="bmx-tourne" />
          <p>{t("Ouverture du dossier…")}</p>
        </div>
      </div>
    );
  }

  if (error || !bon) {
    return (
      <div className="bmd-container bmx-page">
        <div className="bmx-erreur">
          <AlertCircle size={36} />
          <p>{error || t("Ce bon de maintenance est introuvable.")}</p>
          <button type="button" onClick={onBack} className="bmx-btn bmx-btn--clair">
            <ArrowLeft size={18} /> {t("Revenir à la liste")}
          </button>
        </div>
      </div>
    );
  }

  const reclamation = reclamations.length > 0 ? reclamations[0] : null;
  const parcours = construireParcours({
    bon,
    nbDiagnostics,
    intervenants: intervenantsFlow,
    controle: dernierControle,
    remise: derniereRemiseEnService,
  });
  const action = prochaineAction({ bon, parcours, intervenants: intervenantsFlow });
  const ActionIcon = action.icon;
  const etatClair = ETAT_EN_CLAIR[bon.etat] || { texte: t("Inconnu"), ton: 'neutre' };
  const sla = slaEnClair(slaInfo);
  const rca = rcaEnClair(rcaAnalyses);
  const nbFaites = parcours.etapes.filter((e) => e.statut === 'fait').length;
  const progression = parcours.cloture ? 100 : Math.round((Math.max(nbFaites - 1, 0) / (ETAPES_DEF.length - 1)) * 100);

  const compteurs = {
    diagnostic: resumePret ? nbDiagnostics : null,
    taches: nbTaches,
    intervenants: resumePret ? intervenantsFlow.length : null,
    historique: resumePret ? historiqueFlow.length : null,
    controle: dernierControle ? 1 : null,
    chat: nonLusChat > 0 ? nonLusChat : null,
  };

  const nomEquipement = equipement?.designation || bon.titre || 'Équipement non renseigné';
  const urgenceTexte = bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : 'Non définie';

  // ---------- Impression de la fiche complète du bon (A4 portrait) ----------
  // Les listes (diagnostics, tâches…) sont rechargées au moment d'imprimer pour être à jour.
  const imprimerBon = async () => {
    if (impressionEnCours) return;
    setImpressionEnCours(true);
    try {
      const id = bon.id;
      const [diagnostics, taches, intervenants, controles, remises] = await Promise.all([
        bonMaintenanceDiagnosticService.getByBonMaintenance(id).catch(() => []),
        bonMaintenanceTacheService.getByBonMaintenance(id).catch(() => []),
        bonMaintenanceIntervenantService.getByBonMaintenance(id).catch(() => []),
        bonMaintenanceControleEquipementService.getByBonMaintenance(id).catch(() => []),
        bonMaintenanceRemiseEnServiceService.getByBonMaintenance(id).catch(() => []),
      ]);
      const oui = (v) => (v == null ? '' : v ? t('Oui') : t('Non'));
      const periode = (debut, fin) => ((debut || fin) ? `${formatDateTime(debut)} → ${formatDateTime(fin)}` : '');
      const immo = (lotId) => (lotId == null ? '' : (lotId === bon.lotArticleImmobilistationId && equipement?.designation) || t('Équipement #{id}', { id: lotId }));
      const etatImmo = (v) => {
        const o = ETAT_IMMOBILISATION_OPTIONS.find((x) => x.value === v);
        return o ? t(o.label) : '';
      };
      const intervenantNom = (intervenantId) => {
        const i = (intervenants ?? []).find((x) => x.id === intervenantId);
        return i ? nomIntervenantAffiche(i) : (intervenantId != null ? `#${intervenantId}` : '');
      };

      // QR code dans l'en-tête : scanné, il rouvre ce bon dans la GMAO
      const qr = await qrSvg(urlBon(id)).catch(() => null);
      imprimerFiche({
        qr,
        titre: nomEquipement === 'Équipement non renseigné' ? t(nomEquipement) : nomEquipement,
        sousTitre: t('Bon de maintenance'),
        reference: bon.num || t('Bon #{id}', { id: bon.id }),
        statut: t(etatClair.texte),
        sections: [
          {
            titre: t('Informations générales'),
            champs: [
              { label: t('Titre'), valeur: bon.titre, large: true },
              { label: t('Date'), valeur: formatDate(bon.date) },
              { label: t('Date de clôture'), valeur: bon.dateCloture ? formatDate(bon.dateCloture) : '' },
              { label: t('Priorité'), valeur: bon.priorite ? `${bon.priorite} · ${t(prioriteLabel(bon.priorite))}` : '' },
              { label: t('Urgence'), valeur: t(urgenceTexte) },
              { label: t('Service'), valeur: bon.serviceNom || bon.service?.description },
              { label: t('Clinique'), valeur: bon.cliniqueNom || bon.clinique?.nom },
              { label: t('Dépôt'), valeur: bon.depotNom || bon.depot?.codeDepots },
              { label: t('Modèle'), valeur: [equipement?.marque, equipement?.modele].filter(Boolean).join(' ') },
              { label: t('Prestataire'), valeur: bon.prestataire?.raisonSociale || bon.prestataire?.nom },
              { label: t('Sous-traitant'), valeur: bon.sousTraitant },
              { label: t('Réclamation'), valeur: reclamation ? (reclamation.num || `#${reclamation.id}`) : '' },
            ],
          },
          { titre: t('Description'), texte: bon.description },
          {
            titre: t('Diagnostics'),
            colonnes: [t('Date'), t('Technicien'), t('Gravité'), t('Pièce'), t('Cause probable'), { label: t('Durée est.'), align: 'end' }],
            lignes: (diagnostics ?? []).map((d) => [
              formatDateTime(d.dateDiagnostic),
              d.personnelNom,
              d.gravite != null ? t(GRAVITE_LABELS[d.gravite] || String(d.gravite)) : '',
              oui(d.besoinPiece),
              d.causeProbable,
              d.dureeEstimeeHeures != null ? t('{n} h', { n: d.dureeEstimeeHeures }) : '',
            ]),
            vide: t("Aucun diagnostic pour l'instant."),
          },
          {
            titre: t('Tâches'),
            colonnes: [{ label: t('N°'), largeur: '8%' }, t('Désignation'), t('État'), t('Planifié'), t('Intervenant')],
            lignes: (taches ?? []).map((tache) => [
              tache.ordre,
              [tache.designation, tache.nom].filter(Boolean).join(' — '),
              tache.etat != null ? t(TACHE_ETAT_LABELS[tache.etat] || String(tache.etat)) : '',
              periode(tache.dateDebut, tache.dateFin),
              tache.intervenantId != null ? intervenantNom(tache.intervenantId) : '',
            ]),
            vide: t("Aucune tâche pour l'instant."),
          },
          {
            titre: t('Intervenants'),
            colonnes: [t('Intervenant'), t('État'), t('Période'), { label: t('Heures'), align: 'end' }, { label: t('Coût total'), align: 'end' }],
            lignes: (intervenants ?? []).map((i) => [
              nomIntervenantAffiche(i),
              i.etat != null ? t(INTERVENANT_ETAT_LABELS[i.etat] || String(i.etat)) : '',
              periode(i.dateDebutIntervention, i.dateFinIntervention),
              i.nbrHeure != null ? t('{n} h', { n: i.nbrHeure }) : '',
              coutIntervenant(i) != null ? formatMontant(coutIntervenant(i)) : '',
            ]),
            vide: t("Aucun intervenant pour l'instant."),
          },
          {
            titre: t('Contrôles équipement'),
            colonnes: [t('Date'), t('Type'), t('Contrôleur'), { label: t('Mesuré / attendu'), align: 'end' }, t('Conformité')],
            lignes: (controles ?? []).map((c) => [
              formatDateTime(c.dateControle),
              c.typeControle ? t(c.typeControle) : t('Contrôle'),
              c.personnelNom,
              (c.valeurMesuree != null || c.valeurAttendue != null) ? `${c.valeurMesuree ?? '—'} / ${c.valeurAttendue ?? '—'}` : '',
              c.conforme == null ? '' : c.conforme ? t('Conforme') : t('Non conforme'),
            ]),
            vide: t("Aucun contrôle pour l'instant."),
          },
          {
            titre: t('Remise en service'),
            colonnes: [t('Date'), t('Décision'), t('Autorisé par'), t('Immobilisation'), t('État après')],
            lignes: (remises ?? []).map((d) => [
              formatDateTime(d.date),
              d.conforme == null ? '' : d.conforme ? t('Autorisée') : t('Refusée'),
              d.autoriseParNom,
              immo(d.lotArticleImmobilistationId),
              etatImmo(d.etatApres),
            ]),
            vide: t("Aucune décision de remise en service pour l'instant."),
          },
          coutInfo && {
            titre: t('Coût de la réparation'),
            champs: [
              { label: t("Main d'œuvre"), valeur: coutInfo.coutMainOeuvre != null ? formatMontant(coutInfo.coutMainOeuvre) : '' },
              { label: t('Pièces du dépôt'), valeur: coutInfo.coutPiecesDepot != null ? formatMontant(coutInfo.coutPiecesDepot) : '' },
              { label: t('Achats fournisseur'), valeur: coutInfo.coutAchats != null ? formatMontant(coutInfo.coutAchats) : '' },
              { label: t('Coût total'), valeur: coutInfo.coutTotal != null ? formatMontant(coutInfo.coutTotal) : '' },
            ],
          },
        ],
        signatures: [t('Technicien'), t('Responsable maintenance'), t('Service demandeur')],
      });
    } finally {
      setImpressionEnCours(false);
    }
  };

  const signesVitaux = [
    { key: 'sla', icon: Clock, label: t("Délai"), valeur: sla.texte, ton: sla.ton, rubrique: 'sla' },
    { key: 'cout', icon: Wallet, label: t("Coût"), valeur: coutInfo ? formatMontant(coutInfo.coutTotal) : '—', ton: 'neutre', rubrique: 'cout' },
    { key: 'priorite', icon: Gauge, label: t("Priorité"), valeur: prioriteLabel(bon.priorite), ton: `prio-${prioriteColor(bon.priorite)}`, priorite: true },
    { key: 'urgence', icon: Flame, label: t("Urgence"), valeur: urgenceTexte, ton: bon.urgence === 3 ? 'alerte' : bon.urgence === 2 ? 'attention' : 'neutre' },
    { key: 'rca', icon: Search, label: t("Cause racine"), valeur: loadingRca ? '…' : rca.texte, ton: rca.ton, rubrique: 'rca' },
  ];

  // ---------- Contenu du panneau latéral ----------
  const contenuTiroir = () => {
    if (!tiroir) return null;
    const auto = tiroir.form;
    switch (tiroir.key) {
      case 'flow':
        return (
          <FlowTab
            bon={bon}
            reclamation={reclamation}
            reclamations={reclamations}
            equipement={equipement}
            interventions={intervenantsFlow}
            loadingInterventions={loadingIntervenantsFlow}
            controle={dernierControle}
            remiseService={derniereRemiseEnService}
            historique={historiqueFlow}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            loadingReclamations={loadingReclamations}
            handleRecalculerPriorite={handleRecalculerPriorite}
            recalculatingPriorite={recalculatingPriorite}
          />
        );
      case 'tracage':
        return <Tracage3DTab bon={bon} reclamations={reclamations} />;
      case 'diagnostic':
        return <DiagnosticTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} autoOpenForm={auto} />;
      case 'taches':
        return <TachesTab bonMaintenanceId={bon.id} autoOpenForm={auto} />;
      case 'intervenants':
        return <IntervenantsTab bonMaintenanceId={bon.id} onBonMaybeChanged={rafraichirBon} onCelebrer={celebrer} autoOpenForm={auto} />;
      case 'controle':
        return <ControleEquipementTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} autoOpenForm={auto} />;
      case 'remiseEnService':
        return <RemiseEnServiceTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} onBonMaybeChanged={rafraichirBon} onCelebrer={celebrer} autoOpenForm={auto} />;
      case 'chat':
        return <BmdChat bonId={bon.id} onNonLusChange={setNonLusChat} />;
      case 'commentaires':
        return <CommentairesTab bonMaintenanceId={bon.id} />;
      case 'historique':
        return <HistoriqueTab bonMaintenanceId={bon.id} />;
      case 'documents':
        return <DocumentsTab bonMaintenanceId={bon.id} />;
      case 'sla':
        return <PanneauDelais sla={slaInfo} />;
      case 'cout':
        return <PanneauCout cout={coutInfo} />;
      case 'rca':
        return (
          <div className="bmx-rca">
            <div className="bmd-rca-panel">
          {loadingRca ? (
            <p className="bmd-sla-panel__empty">{t("Chargement...")}</p>
          ) : rcaAnalyses.length > 0 ? (
            rcaAnalyses.map((analyse) => (
              <div key={analyse.id} className="bmd-rca-analyse">
                <div className="bmd-rca-analyse__header">
                  <span className="bmd-rca-methode-pill">{METHODE_RCA_LABELS[analyse.methode] || analyse.methode}</span>
                  <span className="bmd-rca-analyse__meta">
                    {analyse.auteur ? `${analyse.auteur} · ` : ''}{formatDateTime(analyse.dateAnalyse)}
                  </span>
                </div>

                <div className="bmd-rca-analyse__champ">
                  <span className="bmd-sla-panel__title">{t("Problème constaté")}</span>
                  <p>{analyse.probleme}</p>
                </div>
                <div className="bmd-rca-analyse__champ">
                  <span className="bmd-sla-panel__title">{t("Cause racine")}</span>
                  <p>{analyse.causeRacine}</p>
                </div>
                {analyse.analyseDetaillee && (
                  <div className="bmd-rca-analyse__champ">
                    <span className="bmd-sla-panel__title">{t("Analyse détaillée")}</span>
                    <p className="bmd-rca-analyse__detail">{analyse.analyseDetaillee}</p>
                  </div>
                )}

                {analyse.actions?.length > 0 && (
                  <div className="bmd-rca-actions">
                    <span className="bmd-sla-panel__title">{t("Actions CAPA")}</span>
                    <ul className="bmd-rca-actions__list">
                      {analyse.actions.map((action) => (
                        <li key={action.id} className={`bmd-rca-action ${action.enRetard ? 'is-retard' : ''}`}>
                          <div className="bmd-rca-action__top">
                            <span className="bmd-rca-type-pill">{TYPE_ACTION_LABELS[action.type] || action.type}</span>
                            <span className="bmd-rca-action__desc">{t(action.description)}</span>
                          </div>
                          <div className="bmd-rca-action__bottom">
                            <span className="bmd-rca-action__meta">
                              {action.responsable ? `${action.responsable} · ` : ''}
                              {action.dateEcheance ? t('Échéance {date}', { date: formatDate(action.dateEcheance) }) : t('Sans échéance')}
                              {action.enRetard && <span className="bmd-rca-retard-tag"> {t("· En retard")}</span>}
                            </span>
                            <select
                              className={`bmd-capa-statut-select ${STATUT_ACTION_CLASS[action.statut] || ''}`}
                              value={action.statut}
                              disabled={majActionId === action.id}
                              onChange={(e) => handleMajStatutAction(action.id, e.target.value)}
                            >
                              {Object.entries(STATUT_ACTION_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bmd-rca-form">
              <p className="bmd-rca-form__intro">
                {t("Aucune analyse RCA pour ce bon. Documenter la cause racine évite de traiter seulement le symptôme.")}
              </p>

              <label className="bmd-rca-form__label">{t("Problème constaté *")}</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={2}
                value={rcaForm.probleme}
                onChange={(e) => handleRcaFormChange('probleme', e.target.value)}
                placeholder={t("Ex : la pompe tombe en panne toutes les 2 semaines depuis 3 mois")}
              />

              <div className="bmd-rca-form__row">
                <div className="bmd-rca-form__col">
                  <label className="bmd-rca-form__label">{t("Méthode")}</label>
                  <select
                    className="bmd-rca-form__select"
                    value={rcaForm.methode}
                    onChange={(e) => handleRcaFormChange('methode', e.target.value)}
                  >
                    {Object.entries(METHODE_RCA_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="bmd-rca-form__col">
                  <label className="bmd-rca-form__label">{t("Auteur")}</label>
                  <input
                    type="text"
                    className="bmd-rca-form__input"
                    value={rcaForm.auteur}
                    onChange={(e) => handleRcaFormChange('auteur', e.target.value)}
                    placeholder={t("Nom de l'analyste")}
                  />
                </div>
              </div>

              <label className="bmd-rca-form__label">{t("Cause racine *")}</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={2}
                value={rcaForm.causeRacine}
                onChange={(e) => handleRcaFormChange('causeRacine', e.target.value)}
                placeholder={t("La cause profonde identifiée, pas le symptôme")}
              />

              <label className="bmd-rca-form__label">{t("Analyse détaillée (optionnel)")}</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={3}
                value={rcaForm.analyseDetaillee}
                onChange={(e) => handleRcaFormChange('analyseDetaillee', e.target.value)}
                placeholder={t("Les 5 pourquoi enchaînés, ou les notes du diagramme Ishikawa")}
              />

              <div className="bmd-rca-form__actions-header">
                <span className="bmd-rca-form__label">{t("Actions CAPA")}</span>
                <button type="button" className="bmd-rca-form__add-btn" onClick={handleRcaAjouterLigneAction}>
                  {t("+ Ajouter une action")}
                </button>
              </div>

              {rcaForm.actions.map((action, index) => (
                <div key={index} className="bmd-rca-form__action-row">
                  <select
                    className="bmd-rca-form__select bmd-rca-form__select--type"
                    value={action.type}
                    onChange={(e) => handleRcaActionChange(index, 'type', e.target.value)}
                  >
                    {Object.entries(TYPE_ACTION_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="bmd-rca-form__input bmd-rca-form__input--desc"
                    placeholder={t("Description de l'action")}
                    value={action.description}
                    onChange={(e) => handleRcaActionChange(index, 'description', e.target.value)}
                  />
                  <input
                    type="text"
                    className="bmd-rca-form__input bmd-rca-form__input--resp"
                    placeholder={t("Responsable")}
                    value={action.responsable}
                    onChange={(e) => handleRcaActionChange(index, 'responsable', e.target.value)}
                  />
                  <input
                    type="date"
                    className="bmd-rca-form__input bmd-rca-form__input--date"
                    value={action.dateEcheance}
                    onChange={(e) => handleRcaActionChange(index, 'dateEcheance', e.target.value)}
                  />
                  {rcaForm.actions.length > 1 && (
                    <button
                      type="button"
                      className="bmd-rca-form__remove-btn"
                      onClick={() => handleRcaSupprimerLigneAction(index)}
                    >
                      {t("×")}
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="bmd-rca-form__submit-btn"
                onClick={handleRcaSubmit}
                disabled={savingRca}
              >
                {savingRca ? t("Enregistrement...") : t("Enregistrer l'analyse RCA")}
              </button>
            </div>
          )}
        </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bmd-container bmx-page">
      {/* ===== Barre du haut ===== */}
      <div className="bmx-barre">
        <button type="button" className="bmx-btn bmx-btn--clair" onClick={onBack}>
          <ArrowLeft size={18} /> {t("Tous les bons")}
        </button>
        <div className="bmx-barre-droite">
          {aideMasquee && (
            <button type="button" className="bmx-btn bmx-btn--fantome" onClick={afficherAide}>
              <HelpCircle size={18} /> {t("Comment ça marche ?")}
            </button>
          )}
          <button type="button" className="bmx-btn bmx-btn--clair bmx-btn-chat" onClick={() => ouvrir('chat')}>
            <MessageCircle size={18} /> {t('Discuter')}
            {nonLusChat > 0 && (
              <span className="bmx-btn-pastille" aria-label={tp('message non lu', nonLusChat)}>{nonLusChat}</span>
            )}
          </button>
          <button type="button" className="bmx-btn bmx-btn--clair" onClick={() => setQrOuvert(true)}>
            <QrCode size={18} /> {t('QR code')}
          </button>
          <button type="button" className="bmx-btn bmx-btn--clair" onClick={imprimerBon} disabled={impressionEnCours}>
            {impressionEnCours ? <Loader2 size={18} className="bmx-spin" /> : <Printer size={18} />}
            {impressionEnCours ? t('Préparation…') : t('Imprimer la fiche')}
          </button>
        </div>
      </div>

      {/* ===== PARTIE 1 : le bon, en clair ===== */}
      <section className="bmx-identite" aria-label={t("Informations générales du bon")}>
        <div className={`bmx-bracelet bmx-ton--${etatClair.ton}`}>
          <span className="bmx-bracelet-etat">{t(etatClair.texte)}</span>
          <span className="bmx-bracelet-num">{bon.num || t('Bon #{id}', { id: bon.id })}</span>
          <span className="bmx-bracelet-trou" aria-hidden="true" />
        </div>

        <h1 className="bmx-titre">{nomEquipement}</h1>
        <p className="bmx-resume">
          {bon.titre && bon.titre !== nomEquipement ? <>{t(bon.titre)}. </> : null}
          {t('Signalé le {date}', { date: formatDate(bon.date) })}
          {joursDepuis(bon.date) ? t(', {quand}', { quand: joursDepuis(bon.date) }) : ''}
          {reclamation ? t(' suite à la réclamation {num}', { num: reclamation.num || `#${reclamation.id}` }) : ''}{t('.')}
        </p>

        <dl className="bmx-fiche">
          <div><dt><Building2 size={15} /> {t("Service")}</dt><dd>{bon.serviceNom || bon.service?.description || '—'}</dd></div>
          <div><dt><Building2 size={15} /> {t("Clinique")}</dt><dd>{bon.cliniqueNom || bon.clinique?.nom || '—'}</dd></div>
          <div><dt><PackageSearch size={15} /> {t("Dépôt")}</dt><dd>{bon.depotNom || bon.depot?.codeDepots || '—'}</dd></div>
          {(equipement?.marque || equipement?.modele) && (
            <div><dt><Wrench size={15} /> {t("Modèle")}</dt><dd>{[equipement.marque, equipement.modele].filter(Boolean).join(' ')}</dd></div>
          )}
          {(bon.prestataire?.raisonSociale || bon.prestataire?.nom) && (
            <div><dt><Users size={15} /> {t("Prestataire")}</dt><dd>{bon.prestataire.raisonSociale || bon.prestataire.nom}</dd></div>
          )}
        </dl>
      </section>

      {!aideMasquee && (
        <section className="bmx-aide" aria-label={t("Aide")}>
          <div className="bmx-aide-texte">
            <h2>{t("Première fois sur cette page ?")}</h2>
            <ol>
              <li>{t("La ligne du parcours montre où en est la réparation.")}</li>
              <li>{t("Le bloc foncé vous dit quoi faire maintenant, avec un seul bouton.")}</li>
              <li>{t("Pour tout voir ou corriger, ouvrez une rubrique en bas de la page.")}</li>
            </ol>
          </div>
          <button type="button" className="bmx-btn bmx-btn--clair" onClick={masquerAide}>
            <Check size={16} /> {t("J'ai compris")}
          </button>
        </section>
      )}

      {/* ===== PARTIE 2 : le parcours ===== */}
      <section className="bmx-parcours" aria-label={t("Parcours de la réparation")}>
        <div className="bmx-parcours-entete">
          <h2>{t("Parcours de la réparation")}</h2>
          <span className="bmx-parcours-compte">
            {parcours.cloture ? t('Terminé') : t('Étape {n} sur {total}', { n: Math.min(parcours.indexActuel + 1, ETAPES_DEF.length), total: ETAPES_DEF.length })}
          </span>
        </div>

        <ol className="bmx-ligne" style={{ '--bmx-p': progression / 100 }}>
          {parcours.etapes.map((etape) => {
            const Icon = etape.icon;
            const IconStatut = etape.statut === 'fait' ? Check : etape.statut === 'probleme' ? AlertTriangle : Icon;
            return (
              <li key={etape.key} className={`bmx-station is-${etape.statut}`}>
                <button
                  type="button"
                  className="bmx-station-btn"
                  onClick={() => ouvrir(etape.rubrique)}
                  aria-current={etape.statut === 'actuel' || etape.statut === 'probleme' ? 'step' : undefined}
                >
                  <span className="bmx-station-point"><IconStatut size={18} strokeWidth={2.4} /></span>
                  <span className="bmx-station-nom">{t(etape.label)}</span>
                  <span className="bmx-station-aide">{t(etape.detail || etape.aide)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ===== À faire maintenant + en un coup d'œil ===== */}
      <div className="bmx-duo">
        <section className={`bmx-maintenant bmx-maintenant--${action.ton}`} aria-label={t("À faire maintenant")}>
          <span className="bmx-maintenant-icone"><ActionIcon size={26} /></span>
          <p className="bmx-maintenant-sur">{t("À faire maintenant")}</p>
          <h2 className="bmx-maintenant-titre">{t(action.titre)}</h2>
          <p className="bmx-maintenant-texte">{t(action.texte)}</p>
          <div className="bmx-maintenant-actions">
            <button
              type="button"
              className="bmx-btn bmx-btn--principal"
              onClick={() => ouvrir(action.bouton.rubrique, action.bouton.form)}
            >
              {t(action.bouton.label)}
            </button>
            {action.secondaire && (
              <button
                type="button"
                className="bmx-btn bmx-btn--sur-fonce"
                onClick={() => ouvrir(action.secondaire.rubrique, action.secondaire.form)}
              >
                {t(action.secondaire.label)}
              </button>
            )}
          </div>
        </section>

        <section className="bmx-vitaux" aria-label={t("En un coup d'œil")}>
          <h2>{t("En un coup d'œil")}</h2>
          <ul>
            {signesVitaux.map((v) => {
              const Icon = v.icon;
              const contenu = (
                <>
                  <span className="bmx-vital-icone"><Icon size={17} /></span>
                  <span className="bmx-vital-label">{t(v.label)}</span>
                  <span className={`bmx-vital-valeur bmx-ton--${v.ton}`}>{t(v.valeur)}</span>
                </>
              );
              return (
                <li key={v.key}>
                  {v.rubrique ? (
                    <button type="button" className="bmx-vital" onClick={() => ouvrir(v.rubrique)}>
                      {contenu}
                      <ChevronRight size={16} className="bmx-vital-fleche" />
                    </button>
                  ) : v.priorite ? (
                    <div className="bmx-vital">
                      {contenu}
                      <button
                        type="button"
                        className="bmx-vital-recalc"
                        onClick={handleRecalculerPriorite}
                        disabled={recalculatingPriorite}
                        title={t("Recalculer la priorité")}
                        aria-label={t("Recalculer la priorité")}
                      >
                        <RefreshCw size={15} className={recalculatingPriorite ? 'bmx-tourne' : ''} />
                      </button>
                    </div>
                  ) : (
                    <div className="bmx-vital">{contenu}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* ===== Tout le dossier ===== */}
      <section className="bmx-dossier" aria-label={t("Tout le dossier")}>
        <h2 className="bmx-dossier-titre">{t("Tout le dossier")}</h2>
        <div className="bmx-groupes">
          {GROUPES_RUBRIQUES.map((groupe) => (
            <div key={groupe.titre} className="bmx-groupe">
              <h3>{t(groupe.titre)}</h3>
              <p>{t(groupe.aide)}</p>
              <ul>
                {groupe.rubriques.map((r) => {
                  const Icon = r.icon;
                  const n = compteurs[r.key];
                  return (
                    <li key={r.key}>
                      <button type="button" className="bmx-rubrique" onClick={() => ouvrir(r.key)}>
                        <span className="bmx-rubrique-icone"><Icon size={18} /></span>
                        <span className="bmx-rubrique-texte">
                          <span className="bmx-rubrique-nom">{t(r.label)}</span>
                          <span className="bmx-rubrique-aide">{t(r.aide)}</span>
                        </span>
                        {n != null && (
                          <span
                            className={`bmx-rubrique-nb ${r.key === 'chat' ? 'bmx-rubrique-nb--alerte' : ''}`}
                            title={r.key === 'chat' ? tp('message non lu', n) : undefined}
                          >
                            {n}
                          </span>
                        )}
                        <ChevronRight size={16} className="bmx-rubrique-fleche" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Tiroir rubrique={tiroir?.key} onClose={fermerTiroir}>
        <div key={`${tiroir?.key}-${tiroir?.form}`}>{contenuTiroir()}</div>
      </Tiroir>

      {qrOuvert && (
        <ModaleQrCode
          url={urlBon(bon.id)}
          titre={nomEquipement === 'Équipement non renseigné' ? t(nomEquipement) : nomEquipement}
          sousTitre={bon.titre && bon.titre !== nomEquipement ? bon.titre : t('Bon de maintenance')}
          reference={bon.num || t('Bon #{id}', { id: bon.id })}
          appel={t('Scannez pour ouvrir le bon')}
          onClose={fermerQr}
        />
      )}

      {celebrationElement}
    </div>
  );
}

// ============================================================
// PANNEAUX DÉLAIS ET COÛT (dans le panneau latéral)
// ============================================================
function PanneauDelais({ sla }) {
  if (!sla || (sla.statutReponse === 'NON_APPLICABLE' && sla.statutResolution === 'NON_APPLICABLE')) {
    return (
      <p className="bmx-vide">
        {t("Aucun délai n'est fixé pour ce bon. Les délais apparaissent quand la priorité est calculée.")}
      </p>
    );
  }
  const lignes = [
    {
      titre: t("Premier passage"),
      aide: t("Temps pour qu’un technicien commence"),
      statut: sla.statutReponse,
      cible: sla.delaiReponseCibleHeures,
      reel: sla.delaiReponseReelHeures,
      echeance: sla.echeanceReponse,
    },
    {
      titre: t("Réparation complète"),
      aide: t("Temps pour rendre l’équipement"),
      statut: sla.statutResolution,
      cible: sla.delaiResolutionCibleHeures,
      reel: sla.delaiResolutionReelHeures,
      echeance: sla.echeanceResolution,
    },
  ];
  const tonStatut = { RESPECTE: 'ok', EN_COURS: 'attention', DEPASSE: 'alerte', NON_APPLICABLE: 'neutre' };
  const texteStatut = { RESPECTE: 'Dans les temps', EN_COURS: 'En cours', DEPASSE: 'En retard', NON_APPLICABLE: 'Sans délai' };

  return (
    <div className="bmx-delais">
      {lignes.map((l) => {
        const ratio = l.cible && l.reel != null ? Math.min(l.reel / l.cible, 1.3) : null;
        return (
          <div key={l.titre} className="bmx-delai">
            <div className="bmx-delai-haut">
              <div>
                <h3>{t(l.titre)}</h3>
                <p>{t(l.aide)}</p>
              </div>
              <span className={`bmx-pastille bmx-ton--${tonStatut[l.statut] || 'neutre'}`}>
                {texteStatut[l.statut] || l.statut}
              </span>
            </div>
            {ratio != null && (
              <div className="bmx-jauge" aria-hidden="true">
                <span style={{ width: `${(ratio / 1.3) * 100}%` }} className={ratio > 1 ? 'is-depasse' : ''} />
                <i style={{ left: `${(1 / 1.3) * 100}%` }} />
              </div>
            )}
            <p className="bmx-delai-chiffres">
              {t("Objectif :")} {formatDureeHeures(l.cible)}
              {l.reel != null ? t('. Réel : {duree}.', { duree: formatDureeHeures(l.reel) }) : '.'}
              {l.reel == null && l.echeance ? ' ' + t('À faire avant le {date}', { date: formatDateTime(l.echeance) }) + '.' : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PanneauCout({ cout }) {
  if (!cout) {
    return <p className="bmx-vide">{t("Aucun coût enregistré pour l'instant. Il se calcule avec les intervenants, les pièces et les achats.")}</p>;
  }
  const total = Number(cout.coutTotal) || 0;
  const parts = [
    { label: t("Main d'œuvre"), valeur: Number(cout.coutMainOeuvre) || 0, classe: 'mo' },
    { label: t("Pièces du dépôt"), valeur: Number(cout.coutPiecesDepot) || 0, classe: 'pieces' },
    { label: t("Achats fournisseur"), valeur: Number(cout.coutAchats) || 0, classe: 'achats' },
  ];
  return (
    <div className="bmx-cout">
      <p className="bmx-cout-total">{formatMontant(total)}</p>
      <p className="bmx-cout-sous">{t("Coût total de la réparation")}</p>
      {total > 0 && (
        <div className="bmx-cout-barre" aria-hidden="true">
          {parts.map((p) => (
            <span key={p.classe} className={`is-${p.classe}`} style={{ width: `${(p.valeur / total) * 100}%` }} />
          ))}
        </div>
      )}
      <ul className="bmx-cout-liste">
        {parts.map((p) => (
          <li key={p.classe}>
            <span className={`bmx-cout-puce is-${p.classe}`} />
            <span>{t(p.label)}</span>
            <strong>{formatMontant(p.valeur)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// ONGLET FLOW
// ============================================================
function FlowTab({
  bon,
  reclamation,
  reclamations,
  equipement,
  interventions,
  loadingInterventions,
  controle,
  remiseService,
  historique,
  expandedSections,
  toggleSection,
  loadingReclamations,
  handleRecalculerPriorite,
  recalculatingPriorite
}) {
  const renderStepConnector = () => (
    <div className="bmd-flow-connector">
      <ChevronDown size={18} className="connector-arrow" />
    </div>
  );

  const renderStepIcon = (type) => {
    const icons = {
      reclamation: { icon: AlertCircle, class: 'reclamation' },
      bon: { icon: FileText, class: 'bon' },
      equipement: { icon: Building2, class: 'equipement' },
      intervention: { icon: Activity, class: 'intervention' },
      controle: { icon: CheckCircle, class: 'controle' },
      remise: { icon: RotateCcw, class: 'remise' },
    };
    const { icon: Icon, class: className } = icons[type] || icons.bon;
    return (
      <div className={`bmd-flow-icon ${className}`}>
        <Icon size={20} />
      </div>
    );
  };

  const renderEtatBadge = (etat) => {
    const Icon = getEtatIcon(etat);
    return (
      <span className={`bmd-badge-etat ${getEtatClass(etat)}`}>
        <Icon size={12} />
        {t(getEtatLabel(etat))}
      </span>
    );
  };

  return (
    <div className="bmd-flow-container">
      <div className="bmd-flow-title">
        <Workflow size={24} className="text-primary" />
        <div>
          <h3>{t("Chaîne de traitement")}</h3>
        </div>
      </div>

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('reclamation')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('reclamation')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 1")}</span>
              <h4>{t("Réclamation")}</h4>
              {reclamation && <span className="bmd-flow-subtitle">{reclamation.num || t("REC-XXXX")}</span>}
              {reclamations.length > 1 && (
                <span className="bmd-flow-subtitle badge-multiple">
                  +{reclamations.length - 1} {t("autre(s)")}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.reclamation ? '−' : '+'}
          </button>
        </div>
        {expandedSections.reclamation && (
          <div className="bmd-flow-content">
            {loadingReclamations ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> {t("Chargement...")}</p>
            ) : reclamations.length === 0 ? (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucune réclamation associée")}
              </p>
            ) : (
              <div className="bmd-flow-details">
                {reclamations.map((r, index) => (
                  <div key={r.id} className="bmd-reclamation-item">
                    <div className="bmd-reclamation-header">
                      <span className="bmd-reclamation-num">#{index + 1}</span>
                      <span className="bmd-reclamation-title">{r.num || `REC-${r.id}`}</span>
                      {r.priorite && (
                        <span className={`priorite-badge priorite-${r.priorite}`}>
                          {r.priorite === 1 ? t("Basse") : r.priorite === 2 ? t("Moyenne") : t("Haute")}
                        </span>
                      )}
                    </div>
                    <div className="bmd-reclamation-details">
                      <div className="detail-row">
                        <span className="detail-label">{t("Date")}</span>
                        <span className="detail-value">{formatDate(r.date)}</span>
                      </div>
                      {r.description && (
                        <div className="detail-row">
                          <span className="detail-label">{t("Description")}</span>
                          <span className="detail-value">{t(r.description)}</span>
                        </div>
                      )}
                      {r.statut && (
                        <div className="detail-row">
                          <span className="detail-label">{t("Statut")}</span>
                          <span className="detail-value">{r.statut}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step active">
        <div className="bmd-flow-header" onClick={() => toggleSection('bon')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('bon')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 2")}</span>
              <h4>{t("Bon de Maintenance")}</h4>
              <span className="bmd-flow-subtitle">{bon.num || t("BM-XXXX")} • {renderEtatBadge(bon.etat)}</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.bon ? '−' : '+'}
          </button>
        </div>
        {expandedSections.bon && (
          <div className="bmd-flow-content">
            <div className="bmd-flow-details">
              <div className="detail-row">
                <span className="detail-label">{t("Titre")}</span>
                <span className="detail-value">{bon.titre || t("Sans titre")}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Description")}</span>
                <span className="detail-value">{bon.description || t("Aucune description")}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Urgence")}</span>
                <span className="detail-value">
                  <span className={`bmd-urgence-badge urgence-${bon.urgence || 0}`}>
                    {bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : t("Non définie")}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Priorité")}</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`bmd-urgence-badge priorite-color-${prioriteColor(bon.priorite)}`}>
                    {t(prioriteLabel(bon.priorite))}
                  </span>
                  <button
                    type="button"
                    className="bmd-icon-btn"
                    title={t("Recalculer la priorité (criticité + urgence + disponibilité d'alternative)")}
                    onClick={handleRecalculerPriorite}
                    disabled={recalculatingPriorite}
                  >
                    <RefreshCw size={14} className={recalculatingPriorite ? 'spin' : ''} />
                  </button>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Prestataire")}</span>
                <span className="detail-value">{bon.prestataire?.raisonSociale || bon.prestataire?.nom || t("Non spécifié")}</span>
              </div>
              {bon.sousTraitant && (
                <div className="detail-row">
                  <span className="detail-label">{t("Sous-traitant")}</span>
                  <span className="detail-value">{bon.sousTraitant}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('equipement')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('equipement')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 3")}</span>
              <h4>{t("Équipement")}</h4>
              {equipement && <span className="bmd-flow-subtitle">{equipement.designation || 'N/A'}</span>}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.equipement ? '−' : '+'}
          </button>
        </div>
        {expandedSections.equipement && (
          <div className="bmd-flow-content">
            {equipement ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Désignation")}</span>
                  <span className="detail-value">{equipement.designation || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("Marque")}</span>
                  <span className="detail-value">{equipement.marque || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("Modèle")}</span>
                  <span className="detail-value">{equipement.modele || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("N° pièce")}</span>
                  <span className="detail-value">{equipement.numPiece || 'N/A'}</span>
                </div>
                {equipement.codeBarre && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Code-barre")}</span>
                    <span className="detail-value">{equipement.codeBarre}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucun équipement associé")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('interventions')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('intervention')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 4")}</span>
              <h4>{t("Interventions")}</h4>
              <span className="bmd-flow-subtitle">{interventions.length} {t("intervention(s)")}</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.interventions ? '−' : '+'}
          </button>
        </div>
        {expandedSections.interventions && (
          <div className="bmd-flow-content">
            {loadingInterventions ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> {t("Chargement...")}</p>
            ) : interventions.length > 0 ? (
              <div className="bmd-flow-details">
                {interventions.map((intervention, index) => {
                  const nomIntervenant = intervention.personnel
                    ? `${intervention.personnel.nom} ${intervention.personnel.prenom}`
                    : (intervention.sousTraitant?.raisonSociale
                        || intervention.intervenantNom
                        || t('Intervenant #{id}', { id: intervention.id }));
                  return (
                    <div key={intervention.id ?? index} className="bmd-intervention-item">
                      <div className="bmd-intervention-header">
                        <span className="bmd-intervention-num">#{index + 1}</span>
                        <span className="bmd-intervention-titre">{nomIntervenant}</span>
                        {intervention.nbrHeure != null && (
                          <span className="bmd-intervention-duree">
                            <Clock size={14} />
                            {intervention.nbrHeure}{t("h")}
                          </span>
                        )}
                      </div>
                      {intervention.commentaire && (
                        <p className="bmd-intervention-description">{intervention.commentaire}</p>
                      )}
                      <div className="bmd-intervention-meta">
                        {intervention.dateDebutIntervention && (
                          <span><Calendar size={14} /> {formatDateTime(intervention.dateDebutIntervention)} → {formatDateTime(intervention.dateFinIntervention)}</span>
                        )}
                        {intervention.etat != null && (
                          <span className={`intervention-statut statut-${intervention.etat}`}>
                            {INTERVENANT_ETAT_LABELS[intervention.etat] || t('État {n}', { n: intervention.etat })}
                          </span>
                        )}
                        {coutIntervenant(intervention) != null && (
                          <span>{formatMontant(coutIntervenant(intervention))}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucune intervention enregistrée")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('controle')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('controle')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 5")}</span>
              <h4>{t("Contrôle")}</h4>
              {controle && (
                <span className={`bmd-flow-subtitle ${controle.conforme ? 'conforme' : 'non-conforme'}`}>
                  {controle.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> {t("Conforme")}</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> {t("Non conforme")}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.controle ? '−' : '+'}
          </button>
        </div>
        {expandedSections.controle && (
          <div className="bmd-flow-content">
            {controle ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Statut")}</span>
                  <span className={`detail-value ${controle.conforme ? 'text-success' : 'text-danger'}`}>
                    {controle.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> {t("Conforme")}</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> {t("Non conforme")}</>
                    )}
                  </span>
                </div>
                {controle.dateControle && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Date")}</span>
                    <span className="detail-value">{formatDateTime(controle.dateControle)}</span>
                  </div>
                )}
                {controle.personnelNom && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Contrôleur")}</span>
                    <span className="detail-value">{controle.personnelNom}</span>
                  </div>
                )}
                {controle.typeControle && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Type")}</span>
                    <span className="detail-value">{controle.typeControle}</span>
                  </div>
                )}
                {controle.valeurMesuree != null && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Valeur mesurée")}</span>
                    <span className="detail-value">{controle.valeurMesuree}</span>
                  </div>
                )}
                {controle.valeurAttendue != null && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Valeur attendue")}</span>
                    <span className="detail-value">{controle.valeurAttendue}</span>
                  </div>
                )}
                {controle.resultat && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Résultat")}</span>
                    <span className="detail-value">{controle.resultat}</span>
                  </div>
                )}
                {controle.observations && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Observations")}</span>
                    <span className="detail-value">{controle.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Contrôle non encore effectué")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('remiseService')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('remise')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 6")}</span>
              <h4>{t("Remise en service")}</h4>
              {remiseService && (
                <span className={`bmd-flow-subtitle ${remiseService.conforme ? 'effectuee' : 'non-effectuee'}`}>
                  {remiseService.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> {t("Autorisée")}</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> {t("Refusée")}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.remiseService ? '−' : '+'}
          </button>
        </div>
        {expandedSections.remiseService && (
          <div className="bmd-flow-content">
            {remiseService ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Statut")}</span>
                  <span className={`detail-value ${remiseService.conforme ? 'text-success' : 'text-danger'}`}>
                    {remiseService.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> {t("Autorisée")}</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> {t("Refusée")}</>
                    )}
                  </span>
                </div>
                {remiseService.date && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Date")}</span>
                    <span className="detail-value">{formatDateTime(remiseService.date)}</span>
                  </div>
                )}
                {remiseService.autoriseParNom && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Autorisé par")}</span>
                    <span className="detail-value">{remiseService.autoriseParNom}</span>
                  </div>
                )}
                {remiseService.etatApres != null && (
                  <div className="detail-row">
                    <span className="detail-label">{t("État après")}</span>
                    <span className="detail-value">
                      {ETAT_IMMOBILISATION_OPTIONS.find(o => o.value === remiseService.etatApres)?.label || 'N/A'}
                    </span>
                  </div>
                )}
                {remiseService.observations && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Observations")}</span>
                    <span className="detail-value">{remiseService.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Remise en service non encore effectuée")}
              </p>
            )}
          </div>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bmd-flow-historique">
          <div className="bmd-flow-header" onClick={() => toggleSection('historique')}>
            <div className="bmd-flow-header-left">
              <div className="bmd-flow-icon historique">
                <Clock size={20} />
              </div>
              <div className="bmd-flow-header-text">
                <h4>{t("Historique")}</h4>
                <span className="bmd-flow-subtitle">{historique.length} {t("événement(s)")}</span>
              </div>
            </div>
            <button className="bmd-flow-toggle">
              {expandedSections.historique ? '−' : '+'}
            </button>
          </div>
          {expandedSections.historique && (
            <div className="bmd-flow-content">
              <div className="bmd-timeline">
                {historique.map((event, index) => (
                  <div key={index} className="bmd-timeline-item">
                    <div className="bmd-timeline-dot"></div>
                    <div className="bmd-timeline-content">
                      <div className="bmd-timeline-header">
                        <span className="bmd-timeline-date">{formatDateTime(event.date)}</span>
                        <span className="bmd-timeline-action">{event.action || event.type}</span>
                      </div>
                      {event.description && (
                        <p className="bmd-timeline-description">{t(event.description)}</p>
                      )}
                      {event.utilisateur && (
                        <span className="bmd-timeline-user">
                          <User size={12} />
                          {event.utilisateur}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ONGLET TRAÇAGE 3D
// ============================================================
function TracageTab({ bon, historique: historiqueProp, reclamations, slaInfo, coutInfo }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    historique: historiqueProp ?? [],
    intervenants: [],
    taches: [],
    diagnostics: [],
    controles: [],
    remises: [],
    documents: [],
    sla: slaInfo,
    cout: coutInfo,
  });

  useEffect(() => {
    if (!bon?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      try {
        const [
          historique,
          intervenants,
          taches,
          diagnostics,
          controles,
          remises,
          documents,
          sla,
          cout,
        ] = await Promise.all([
          bonMaintenanceHistoriqueService.findByBonMaintenanceId(bon.id).catch(() => []),
          bonMaintenanceIntervenantService.getByBonMaintenance(bon.id).catch(() => []),
          bonMaintenanceTacheService.getByBonMaintenance(bon.id).catch(() => []),
          bonMaintenanceDiagnosticService.getByBonMaintenance(bon.id).catch(() => []),
          bonMaintenanceControleEquipementService.getByBonMaintenance(bon.id).catch(() => []),
          bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bon.id).catch(() => []),
          bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bon.id).catch(() => []),
          slaService.getPourBon(bon.id).catch(() => null),
          coutService.getPourBon(bon.id).catch(() => null),
        ]);

        if (!cancelled) {
          setData({
            historique: historique ?? [],
            intervenants: intervenants ?? [],
            taches: taches ?? [],
            diagnostics: diagnostics ?? [],
            controles: controles ?? [],
            remises: remises ?? [],
            documents: documents ?? [],
            sla: sla ?? slaInfo,
            cout: cout ?? coutInfo,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, [bon?.id]);

  const axeTemps = buildAxeTemps(data);
  const axeActeurs = buildAxeActeurs(data);
  const axeImpact = buildAxeImpact(data, bon);

  if (loading) {
    return (
      <div className="bmd-empty">
        <Loader2 size={24} className="spinner" />
        {t("Chargement du traçage...")}
      </div>
    );
  }

  return (
    <div className="bmd-tracage">
      {/* AXE 1 : TEMPS */}
      <section className="bmd-tracage__axe">
        <header className="bmd-tracage__axe-header">
          <Clock size={20} />
          <h3>{t("Axe 1 — Chronologie")}</h3>
          <span className="bmd-tracage__count">{axeTemps.length} {t("étape(s)")}</span>
        </header>

        {axeTemps.length === 0 ? (
          <p className="bmd-flow-empty">
            <Inbox size={20} className="empty-icon" /> {t("Aucun événement enregistré pour ce bon.")}
          </p>
        ) : (
          <div className="bmd-tracage__timeline">
            {axeTemps.map((etape, i) => (
              <div key={i} className={`bmd-tracage__step is-${etape.statut}`}>
                <div className="bmd-tracage__step-dot" />
                <div className="bmd-tracage__step-content">
                  <div className="bmd-tracage__step-header">
                    <span className="bmd-tracage__step-label">{t(etape.label)}</span>
                    <span className="bmd-tracage__step-date">{etape.date}</span>
                  </div>
                  {etape.description && (
                    <p className="bmd-tracage__step-desc">{t(etape.description)}</p>
                  )}
                  {etape.acteur && (
                    <span className="bmd-tracage__step-acteur">
                      <User size={12} /> {etape.acteur}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AXE 2 : ACTEURS */}
      <section className="bmd-tracage__axe">
        <header className="bmd-tracage__axe-header">
          <Users size={20} />
          <h3>{t("Axe 2 — Acteurs")}</h3>
          <span className="bmd-tracage__count">{axeActeurs.length} {t("acteur(s)")}</span>
        </header>

        {axeActeurs.length === 0 ? (
          <p className="bmd-flow-empty">
            <Inbox size={20} className="empty-icon" /> {t("Aucun acteur identifié.")}
          </p>
        ) : (
          <div className="bmd-tracage__acteurs">
            {axeActeurs.map((acteur, i) => (
              <div key={i} className="bmd-tracage__acteur-card">
                <div className="bmd-tracage__acteur-avatar">
                  {acteur.type === 'interne' ? <User size={20} /> : <Users size={20} />}
                </div>
                <div className="bmd-tracage__acteur-info">
                  <span className="bmd-tracage__acteur-nom">{acteur.nom}</span>
                  <span className="bmd-tracage__acteur-role">{acteur.role}</span>
                </div>
                <div className="bmd-tracage__acteur-stats">
                  <span>{acteur.nbActions} {t("action(s)")}</span>
                  {acteur.heures != null && <span>{acteur.heures}{t("h")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AXE 3 : IMPACT */}
      <section className="bmd-tracage__axe">
        <header className="bmd-tracage__axe-header">
          <Target size={20} />
          <h3>{t("Axe 3 — Impact")}</h3>
        </header>

        <div className="bmd-tracage__impact-grid">
          <ImpactCard
            icon={Euro}
            label={t("Coût total")}
            value={axeImpact.coutTotal}
            color="slate"
          />
          <ImpactCard
            icon={Clock}
            label={t("SLA réponse")}
            value={axeImpact.slaReponse}
            color={axeImpact.slaReponseColor}
          />
          <ImpactCard
            icon={Clock}
            label={t("SLA résolution")}
            value={axeImpact.slaResolution}
            color={axeImpact.slaResolutionColor}
          />
          <ImpactCard
            icon={ShieldCheck}
            label={t("Conformité")}
            value={axeImpact.conformite}
            color={axeImpact.conformiteColor}
          />
          <ImpactCard
            icon={TrendingUp}
            label={t("Durée totale")}
            value={axeImpact.dureeTotale}
            color="teal"
          />
        </div>
      </section>
    </div>
  );
}

// ---------- HELPERS TRAÇAGE ----------

function buildAxeTemps({ historique, intervenants, taches, diagnostics, controles, remises }) {
  const events = [];

  historique.forEach((h) => events.push({
    date: h.date,
    label: h.action || 'Événement',
    description: h.description || '',
    acteur: h.personnelCreationNom,
    statut: 'info',
  }));

  diagnostics.forEach((d) => events.push({
    date: d.dateDiagnostic,
    label: t("Diagnostic enregistré"),
    description: d.observations || d.causeProbable || '',
    acteur: d.personnelNom,
    statut: 'info',
  }));

  taches.forEach((tache) => events.push({
    date: tache.dateDebut || tache.dateDebutIntervention,
    label: t('Tâche : {nom}', { nom: tache.designation || `#${tache.id}` }),
    description: tache.etat != null ? t('État : {etat}', { etat: t(TACHE_ETAT_LABELS[tache.etat] || String(tache.etat)) }) : '',
    acteur: tache.intervenantNom,
    statut: tache.etat === 4 ? 'success' : tache.etat === 10 ? 'danger' : 'info',
  }));

  intervenants.forEach((i) => events.push({
    date: i.dateDebutIntervention,
    label: t('Intervention — {nom}', { nom: i.personnel ? `${i.personnel.nom} ${i.personnel.prenom}` : (i.sousTraitant?.raisonSociale || i.intervenantNom || `#${i.id}`) }),
    description: i.commentaire || (i.nbrHeure != null ? `${i.nbrHeure}h` : ''),
    acteur: i.intervenantNom,
    statut: i.etat === 2 ? 'success' : 'info',
  }));

  controles.forEach((c) => events.push({
    date: c.dateControle,
    label: t('Contrôle — {type}', { type: t(c.typeControle || 'Équipement') }),
    description: c.observations || c.resultat || '',
    acteur: c.personnelNom,
    statut: c.conforme ? 'success' : 'danger',
  }));

  remises.forEach((r) => events.push({
    date: r.date,
    label: r.conforme ? 'Remise en service autorisée' : 'Remise en service refusée',
    description: r.observations || '',
    acteur: r.autoriseParNom,
    statut: r.conforme ? 'success' : 'danger',
  }));

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((e) => ({ ...e, date: formatDateTime(e.date) }));
}

function buildAxeActeurs({ intervenants, controles, diagnostics, historique }) {
  const map = new Map();

  const add = (nom, role, heures = null) => {
    if (!nom) return;
    const key = `${nom}::${role}`;
    const existing = map.get(key) || { nom, role, nbActions: 0, heures: 0 };
    existing.nbActions += 1;
    if (heures != null) existing.heures += Number(heures) || 0;
    map.set(key, existing);
  };

  intervenants.forEach((i) => add(
    i.personnel
      ? `${i.personnel.nom} ${i.personnel.prenom}`
      : (i.sousTraitant?.raisonSociale || i.intervenantNom),
    i.personnelId ? 'Technicien interne' : 'Sous-traitant',
    i.nbrHeure
  ));
  controles.forEach((c) => add(c.personnelNom, 'Contrôleur'));
  diagnostics.forEach((d) => add(d.personnelNom, 'Diagnostiqueur'));
  historique.forEach((h) => add(h.personnelCreationNom, 'Acteur système'));

  return Array.from(map.values()).map((a) => ({
    ...a,
    type: a.role === 'Sous-traitant' ? 'externe' : 'interne',
    heures: a.heures > 0 ? a.heures.toFixed(1) : null,
  }));
}

function buildAxeImpact({ sla, cout, controles, remises }, bon) {
  const coutTotal = cout?.coutTotal != null
    ? t('{montant} DT', { montant: cout.coutTotal.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
    : '—';

  const slaReponse = SLA_STATUT_LABELS[sla?.statutReponse] || 'N/A';
  const slaReponseColor =
    sla?.statutReponse === 'RESPECTE' ? 'success'
    : sla?.statutReponse === 'DEPASSE' ? 'danger'
    : sla?.statutReponse === 'EN_COURS' ? 'warning'
    : 'slate';

  const slaResolution = SLA_STATUT_LABELS[sla?.statutResolution] || 'N/A';
  const slaResolutionColor =
    sla?.statutResolution === 'RESPECTE' ? 'success'
    : sla?.statutResolution === 'DEPASSE' ? 'danger'
    : sla?.statutResolution === 'EN_COURS' ? 'warning'
    : 'slate';

  const dernierControle = controles[0];
  const conformite = dernierControle
    ? (dernierControle.conforme ? 'Conforme' : 'Non conforme')
    : (remises[0] ? (remises[0].conforme ? 'Autorisée' : 'Refusée') : '—');
  const conformiteColor = (dernierControle?.conforme || remises[0]?.conforme)
    ? 'success'
    : (dernierControle || remises[0]) ? 'danger' : 'slate';

  let dureeTotale = '—';
  if (bon?.date) {
    const debut = new Date(bon.date).getTime();
    const fin = bon.dateCloture ? new Date(bon.dateCloture).getTime() : Date.now();
    const heures = (fin - debut) / 3600000;
    if (!isNaN(heures) && heures >= 0) {
      dureeTotale = heures < 48 ? t('{n} h', { n: heures.toFixed(1) }) : t('{n} j', { n: (heures / 24).toFixed(1) });
    }
  }

  return {
    coutTotal,
    slaReponse,
    slaReponseColor,
    slaResolution,
    slaResolutionColor,
    conformite,
    conformiteColor,
    dureeTotale,
  };
}

function ImpactCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`bmd-tracage__impact-card is-${color}`}>
      <Icon size={18} />
      <span className="bmd-tracage__impact-label">{label}</span>
      <span className="bmd-tracage__impact-value">{value}</span>
    </div>
  );
}

// ============================================================
// ONGLET DOCUMENTS
// ============================================================
function DocumentsTab({ bonMaintenanceId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pieceId, setPieceId] = useState('');
  const [piecesDisponibles, setPiecesDisponibles] = useState([]);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonMaintenanceId);
      setDocuments(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    pieceService.getAll(0, 200).then((p) => setPiecesDisponibles(p.content ?? [])).catch(console.error);
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!pieceId) return;
    setSaving(true);
    try {
      await bonMaintenanceDocumentAchatService.create({ bonMaintenanceId, pieceId: Number(pieceId) });
      setPieceId('');
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert(t("Échec de l'ajout du document."));
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Retirer le document"),
      message: t("Retirer ce document ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceDocumentAchatService.remove(id);
          setDocuments((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>{t("Documents d'achat")}</h3>
          <span className="bmd-panel-count">{documents.length}</span>
        </div>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="pieceId"
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            options={piecesDisponibles}
            placeholder={t("Rechercher une pièce (MEDSYS)...")}
            emptyMessage={t("Aucune pièce ne correspond")}
            getValue={(p) => p.id}
            getLabel={(p) => `${p.numPiece || `#${p.id}`}${p.description ? ` — ${p.description}` : ''}`}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? t("Ajout...") : t("Ajouter")}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          {t("Impossible de charger les documents d'achat :")} {loadError}
        </p>
      ) : documents.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun document d'achat pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-list">
          {documents.map((d) => (
            <li key={d.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' ? t("Commande fournisseur")
                    : d.piece?.codePieceType === '.D_Fourniture' ? t("Demande de fourniture")
                    : (d.piece?.numPiece || t('Pièce #{id}', { id: d.pieceId }))}
                </span>
                <span className="bmd-item-sub">
                  {(d.lignes ?? []).map((l) => {
                    const article = articles.find((a) => String(a.id) === String(l.prestataireArticlesId));
                    return `${article?.designation || t('Article #{id}', { id: l.prestataireArticlesId })} (${t('Qté')} ${l.qte})`;
                  }).join(', ')}
                  {d.piece?.cibleId != null
                    ? ` · ${prestataires.find((p) => String(p.id) === String(d.piece.cibleId))?.raisonSociale || t('Sous-traitant #{id}', { id: d.piece.cibleId })}`
                    : ''}
                  {d.piece?.description ? ` · ${d.piece.description}` : ''}
                </span>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={t("Retirer")}
      />
    </div>
  );
}

// ============================================================
// ONGLET COMMENTAIRES
// ============================================================
function CommentairesTab({ bonMaintenanceId }) {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceCommentaireService.getByBonMaintenance(bonMaintenanceId);
      setCommentaires(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await bonMaintenanceCommentaireService.create({ bonMaintenanceId, commentaire: text.trim() });
      setText('');
      await load();
    } catch (err) {
      console.error(err);
      alert(t("Échec de l'ajout du commentaire."));
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer le commentaire"),
      message: t("Supprimer ce commentaire ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceCommentaireService.remove(id);
          setCommentaires((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  return (
    <div>
      <form className="bmd-comment-form" onSubmit={handleAdd}>
        <textarea
          placeholder={t("Ajouter un commentaire...")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <Button type="submit" variant="primary" disabled={saving || !text.trim()}>
          {saving ? t("Envoi...") : t("Publier")}
        </Button>
      </form>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : commentaires.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun commentaire pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-list">
          {commentaires.map((c) => (
            <li key={c.id} className="bmd-list-item bmd-comment-item">
              <div>
                <span className="bmd-item-title">{c.personnelCreation ? `${c.personnelCreation.nom} ${c.personnelCreation.prenom}` : (c.personnelCreationNom || t("Anonyme"))}</span>
                <span className="bmd-item-sub">{formatDateTime(c.date)}</span>
                <p className="bmd-comment-text">{c.commentaire}</p>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(c.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={t("Supprimer")}
      />
    </div>
  );
}

// ============================================================
// ONGLET HISTORIQUE
// ============================================================
function HistoriqueTab({ bonMaintenanceId }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceHistoriqueService.findByBonMaintenanceId(bonMaintenanceId);
      setHistorique(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>{t("Historique")}</h3>
          <span className="bmd-panel-count">{historique.length}</span>
        </div>
      </div>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          {t("Impossible de charger l'historique :")} {loadError}
        </p>
      ) : historique.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun historique pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-history-list">
          {historique.map((h) => (
            <li key={h.id} className="bmd-history-row">
              <span className="bmd-history-action">{h.action}</span>
              <span className="bmd-history-date">{formatDateTime(h.date)}</span>
              <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}