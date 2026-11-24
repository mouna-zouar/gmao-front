import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  
  Edit,
  Trash2,
  Search,
  
  Loader2,
  
  
  Pause,
  RotateCcw,
  
  Printer,
  Send,
  CloudCheck,
  ChevronDown,
  Eye,
  PackageSearch,
  ShoppingCart,
  Users,
  ClipboardList,
  FileCheck,
  
  Circle,
  
  
  
  Workflow,
  Inbox,
  X,
  Check,
  
  
  
  ShieldCheck,
  Wrench,
  Stethoscope,
  Power,
  Flag,
  Wallet,
  Gauge,
  Flame,
  AlertTriangle,
  MessageSquare,
  MessageCircle,
  QrCode,
  History,
  Phone,
  Tag,
  UserRound,
  ScanSearch,
  MapPin,
  ListOrdered,
  Lock,
  BellOff,
} from 'lucide-react';
import { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { cheminLieu, lieuDeLigne } from '../../../services/lieuxCache';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import { prioriteLabel, prioriteColor } from '../../../constants/Priorite';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceCommentaireService from '../../../services/Bonmaintenancecommentaireservice';
import chatBonService from '../../../services/chatBonService';
import BmdChat from './BmdChat';
import { qrSvg, urlBon } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import PieceEditor from '../../ui/PieceEditor/PieceEditor';
import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import lectureService from '../../../services/lectureService';
import EtatLecture from '../../commun/EtatLecture';
import Modale from '../../commun/Modale';
import slaService from '../../../services/slaService';
import coutService from '../../../services/coutService';
import rcaCapaService from '../../../services/rcaCapaService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import reclamationServiceComplet from '../../../services/Reclamationservice';
import prestataireService from '../../../services/prestataireService';
import { obtenirPrestataires } from '../../../store/referentiels';
import { precharger } from '../../../services/api';
import parametreService from '../../../services/parametreService';
import depotCubixService from '../../../services/depotCubixService';
import authService from '../../../services/Authservice';
import { imprimerPiece } from '../../../utils/imprimerPiece';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationCubixService';
import articleService from '../../../services/articleService';
import prestataireArticleService from '../../../services/prestataireArticleService';
import pieceService from '../../../services/Pieceservice';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import Tracage3DTab from './Tracage3DTab';
import BmdRapport from './BmdRapport';
import { BandeauValidation, BoutonsDecision } from './ValidationBon';
import bonMaintenanceRapportService from '../../../services/bonMaintenanceRapportService';
import { libelleTypeEntretien, libelleSourceInformation } from '../../../constants/FicheIntervention';
import { useCelebration } from './BmdCommun';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import './Bonmaintenancedetails.css';
import {
  DiagnosticTab,
  TachesTab,
  IntervenantsTab,
  ControleEquipementTab,
  RemiseEnServiceTab,
} from './Bmdsousonglets';
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
} from './BmdCommun';
import './BmdEpure.css';
import RecapImmobilisation from './RecapImmobilisation';

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


const RUBRIQUES_VERROUILLEES = new Set(['diagnostic', 'reparation', 'taches', 'intervenants', 'controle', 'remiseEnService', 'commentaires']);

const ETAPES_DEF = [
  { key: 'signale', label: 'Signalé', aide: 'La panne a été déclarée', icon: Flag, rubrique: 'historique' },
  { key: 'diagnostic', label: 'Diagnostic', aide: 'On cherche la cause', icon: Stethoscope, rubrique: 'diagnostic' },
  { key: 'reparation', label: 'Réparation', aide: 'Les techniciens réparent', icon: Wrench, rubrique: 'reparation' },
  { key: 'controle', label: 'Contrôle', aide: 'On vérifie que tout marche', icon: ShieldCheck, rubrique: 'controle' },
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

// eslint-disable-next-line no-unused-vars
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
        texte: t("Notez ce que vous constatez sur l’équipement."),
        bouton: { label: t("Faire le diagnostic"), rubrique: 'diagnostic', form: true },
      };
    case 'reparation':
      if (intervenants.length === 0) {
        return {
          ton: 'action', icon: Users,
          titre: t("Choisissez qui va réparer"),
          texte: t("Ajoutez un technicien de l’équipe ou un sous-traitant pour cette réparation."),
          bouton: { label: t("Ajouter un intervenant"), rubrique: 'reparation', form: true },
        };
      }
      return {
        ton: 'action', icon: Wrench,
        titre: t("La réparation est en cours"),
        texte: t("Quand un intervenant a fini, changez son état en « Terminé ». L’étape suivante se débloque toute seule."),
        bouton: { label: t("Suivre la réparation"), rubrique: 'reparation' },
        secondaire: { label: t("Ajouter un intervenant"), rubrique: 'reparation', form: true },
      };
    case 'controle':
      if (actuelle.probleme) {
        return {
          ton: 'alerte', icon: AlertTriangle,
          titre: t("Le contrôle n’est pas bon"),
          texte: t("L’équipement n’a pas passé le dernier contrôle. Faites une nouvelle réparation, puis contrôlez à nouveau."),
          bouton: { label: t("Faire un nouveau contrôle"), rubrique: 'controle', form: true },
          secondaire: { label: t("Ajouter une réparation"), rubrique: 'reparation', form: true },
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

const GROUPES_RUBRIQUES = [
  {
    titre: 'Comprendre',
    icon: Eye,
    aide: 'Voir où en est le dossier',
    rubriques: [
      { key: 'rapport', label: "Rapport d'intervention", aide: 'Le compte rendu de la réparation (rédigé par l’IA, relu et validé)', icon: FileCheck },
      { key: 'tracage', label: 'Traçage ', aide: 'Qui a fait quoi, et quand', icon: Activity },
      { key: 'historique', label: 'Historique', aide: 'Le journal des actions', icon: History },
    ],
  },
  {
    titre: 'Réparer',
    icon: Wrench,
    aide: 'Le travail sur l’équipement',
    rubriques: [
      { key: 'diagnostic', label: 'Diagnostic', aide: 'La cause de la panne', icon: Stethoscope },
      { key: 'taches', label: 'Tâches', aide: 'Les travaux à planifier', icon: ClipboardList },
      { key: 'intervenants', label: 'Intervenants', aide: 'Qui répare', icon: Users },
    ],
  },
  {
    titre: 'Valider',
    icon: ShieldCheck,
    aide: 'Avant de rendre l’équipement',
    rubriques: [
      { key: 'controle', label: 'Contrôle', aide: 'Les tests de bon fonctionnement', icon: ShieldCheck },
      { key: 'remiseEnService', label: 'Remise en service', aide: 'Le feu vert pour le service (après le contrôle)', icon: Power },
    ],
  },
  {
    titre: 'Échanger',
    icon: MessageCircle,
    aide: 'Discussion, notes et achats',
    rubriques: [
      { key: 'chat', label: 'Chat en direct', aide: 'Discuter avec l’équipe du bon', icon: MessageCircle },
      { key: 'commentaires', label: 'Commentaires', aide: 'Les messages de l’équipe', icon: MessageSquare },
      { key: 'documents', label: "Documents d'achat", aide: 'Commandes et demandes de pièces', icon: FileText },
    ],
  },
];

const ONGLETS_DOSSIER = GROUPES_RUBRIQUES.flatMap((g, i) => g.rubriques
  .filter((r) => !r.masque)
  .map((r, j) => ({ ...r, groupe: g.titre, debutGroupe: i > 0 && j === 0 })));
const CLES_ONGLETS = new Set(ONGLETS_DOSSIER.map((r) => r.key));

const TITRES_TIROIR = {
  sla: { label: 'Délais', icon: Clock },
  cout: { label: 'Coût de la réparation', icon: Wallet },
  rca: { label: 'Cause racine', icon: Search },
};
GROUPES_RUBRIQUES.forEach((g) => g.rubriques.forEach((r) => { TITRES_TIROIR[r.key] = r; }));
TITRES_TIROIR.reparation = { label: 'Réparation', aide: 'Étape 1 : les intervenants · Étape 2 : les tâches', icon: Wrench };


function Tiroir({ rubrique, onClose, children }) {
  if (!rubrique) return null;
  const def = TITRES_TIROIR[rubrique] || { label: rubrique };
  return (
    <Modale ouvert onFermer={onClose} icone={def.icon} titre={t(def.label)} taille={def.large ? 'xl' : 'lg'} className="bmx-modale">
      <div className="bmx-page bmx-tiroir bmx-tiroir--modale">{children}</div>
    </Modale>
  );
}

const ETAPES_REPARATION = [
  { key: 'intervenants', label: 'Intervenants', aide: 'Qui répare', icon: Users },
  { key: 'taches', label: 'Tâches', aide: 'Les travaux à faire', icon: ClipboardList },
];
function ReparationEtapes({ intervenants, taches }) {
  const [etape, setEtape] = useState(0);
  const contenus = [intervenants, taches];
  return (
    <div className="bmx-rep">
      <ol className="bmx-rep-etapes" role="tablist" aria-label={t('Étapes de la réparation')}>
        {ETAPES_REPARATION.map((e, i) => {
          const Icon = e.icon;
          const etat = i === etape ? 'is-actif' : i < etape ? 'is-passe' : '';
          return (
            <li key={e.key} className={`bmx-rep-etape ${etat}`}>
              <button type="button" role="tab" aria-selected={i === etape} onClick={() => setEtape(i)}>
                <span className="bmx-rep-num">{i < etape ? <Check size={14} /> : i + 1}</span>
                <span className="bmx-rep-texte">
                  <strong><Icon size={15} /> {t(e.label)}</strong>
                  <small>{t(e.aide)}</small>
                </span>
              </button>
              {i < ETAPES_REPARATION.length - 1 && <span className="bmx-rep-trait" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <div className="bmx-rep-contenu" role="tabpanel">{contenus[etape]}</div>
      <div className="bmx-rep-nav">
        {etape > 0 ? (
          <button type="button" className="bmz-btn" onClick={() => setEtape(etape - 1)}>
            <ArrowLeft size={15} /> {t('Étape précédente : {e}', { e: t(ETAPES_REPARATION[etape - 1].label) })}
          </button>
        ) : <span />}
        {etape < ETAPES_REPARATION.length - 1 && (
          <button type="button" className="bmz-btn bmz-btn--plein" onClick={() => setEtape(etape + 1)}>
            {t('Étape suivante : {e}', { e: t(ETAPES_REPARATION[etape + 1].label) })} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function prechargerBon(id) {
  if (!id) return null;
  const b = `/bon-maintenance/${id}`;
  return precharger(`${b}/resume`, [
    b,
    `/bon-maintenance-diagnostic${b}`,
    `/bon-maintenance-tache${b}`,
    `/bon-maintenance-intervenant${b}`,
    `/bon-maintenance-controle-equipement${b}`,
    `/bon-maintenance-remise-en-service${b}`,
    `/bon-maintenance-historique${b}`,
    `/bon-maintenance-document-achat${b}`,
    `/reclamation-bon-maintenance${b}/reclamations`,
    `/sla/bon/${id}`,
    `/cout/bon/${id}`,
    `/rca-capa/bon/${id}`,
    `${b}/rapport`,
  ]);
}

export default function BonMaintenanceDetails({ bonMaintenance, onBack }) {
  useMemo(() => prechargerBon(bonMaintenance?.id), [bonMaintenance?.id]);
  const [bon, setBon] = useState(bonMaintenance);
  const [loading, setLoading] = useState(!bonMaintenance);
  const [error, setError] = useState(null);
  const [tiroir, setTiroir] = useState(null);
  const [ongletDossier, setOngletDossier] = useState({ key: 'rapport', form: false, version: 0 });
  const refOnglets = useRef(null);
  const [celebrer, celebrationElement] = useCelebration();
  const [impressionEnCours, setImpressionEnCours] = useState(false);
  const [nonLusChat, setNonLusChat] = useState(0);
  const [qrOuvert, setQrOuvert] = useState(false);
  const [editeurPiece, setEditeurPiece] = useState(null);
  const [versionDocuments, setVersionDocuments] = useState(0);
  const [rapportIa, setRapportIa] = useState(null);
  useEffect(() => {
    if (!bon?.id) return undefined;
    let annule = false;
    bonMaintenanceRapportService.get(bon.id)
      .then((r) => { if (!annule) setRapportIa(r); })
      .catch(() => { });
    return () => { annule = true; };
  }, [bon?.id]);
  const fermerQr = useCallback(() => setQrOuvert(false), []);
  const [recapImmoOuvert, setRecapImmoOuvert] = useState(false);
  const fermerRecapImmo = useCallback(() => setRecapImmoOuvert(false), []);
  const etatBonRef = useRef(bonMaintenance?.etat);
  useEffect(() => { etatBonRef.current = bon?.etat; }, [bon?.etat]);

  const [reclamations, setReclamations] = useState([]);
  const [loadingReclamations, setLoadingReclamations] = useState(false);
  const [equipement, setEquipement] = useState(null);
  const carteLieux = useCarteLieux();
  const lieuBon = cheminLieu(carteLieux, lieuDeLigne(carteLieux, bon?.lieuId, bon?.lotArticleImmobilistationId));
  const [dernierControle, setDernierControle] = useState(null);
  const [derniereRemiseEnService, setDerniereRemiseEnService] = useState(null);
  const [intervenantsFlow, setIntervenantsFlow] = useState([]);

  const [lectureBon, setLectureBon] = useState(null);
  const nbIntervenants = intervenantsFlow.length;
  const [loadingIntervenantsFlow, setLoadingIntervenantsFlow] = useState(false);
  const [historiqueFlow, setHistoriqueFlow] = useState([]);
  const [nbDiagnostics, setNbDiagnostics] = useState(0);
  const [nbTaches, setNbTaches] = useState(null);
  const [resumePret, setResumePret] = useState(false);
  const [slaInfo, setSlaInfo] = useState(null);
  const [coutInfo, setCoutInfo] = useState(null);
  useEffect(() => {
    const id = bonMaintenance?.id;
    if (id == null || !resumePret) return undefined;
    let annule = false;
    lectureService.bon(id)
      .then((l) => { if (!annule) setLectureBon(l); })
      .catch(() => { });
    return () => { annule = true; };
  }, [bonMaintenance?.id, nbIntervenants, resumePret]);

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

  const prioriteBon = bon?.priorite;
  const etatBon = bon?.etat;
  useEffect(() => { chargerSlaEtCout(); }, [chargerSlaEtCout, prioriteBon, etatBon]);

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

  useEffect(() => {
    if (!bonMaintenance || !bonMaintenance.id) return;
    const loadReclamations = async () => {
      setLoadingReclamations(true);
      try {
        const data = await reclamationBonMaintenanceService.getReclamationsByBonMaintenance(bonMaintenance.id);
        const liste = data || [];
        setReclamations(liste);
        const completes = await Promise.all(liste.map(async (r) => (
          r && r.id != null && !('checklist' in r && 'codePanneCode' in r)
            ? { ...r, ...(await reclamationServiceComplet.getById(r.id).catch(() => ({}))) }
            : r
        )));
        setReclamations(completes);
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

  const ouvrir = (key, form = false) => {
    if (CLES_ONGLETS.has(key)) {
      if (ongletDossier.key !== key) { chargerResume(); chargerSlaEtCout(); chargerNonLusChat(); }
      setOngletDossier((o) => ({ key, form, version: o.version + 1 }));
      setTimeout(() => refOnglets.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
      return;
    }
    setTiroir({ key, form });
  };
  const fermerTiroir = useCallback(() => {
    setTiroir(null);
    chargerResume();
    chargerSlaEtCout();
    chargerNonLusChat();
  }, [chargerResume, chargerSlaEtCout, chargerNonLusChat]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };


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
  const etatClair = ETAT_EN_CLAIR[bon.etat] || { texte: t("Inconnu"), ton: 'neutre' };
  const sla = slaEnClair(slaInfo);
  const rca = rcaEnClair(rcaAnalyses);
  const nbFaites = parcours.etapes.filter((e) => e.statut === 'fait').length;
  const progression = parcours.cloture ? 100 : Math.round((Math.min(nbFaites, ETAPES_DEF.length - 1) / (ETAPES_DEF.length - 1)) * 100);

  const compteurs = {
    diagnostic: resumePret ? nbDiagnostics : null,
    taches: nbTaches,
    intervenants: resumePret ? intervenantsFlow.length : null,
    historique: resumePret ? historiqueFlow.length : null,
    controle: dernierControle ? 1 : null,
    chat: nonLusChat > 0 ? nonLusChat : null,
    rapport: rapportIa?.contenu ? 1 : null,
  };

  const nomEquipement = equipement?.designation || bon.titre || 'Équipement non renseigné';
  const urgenceTexte = bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : 'Non définie';

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
              { label: t("Type d'entretien"), valeur: bon.type != null ? t(libelleTypeEntretien(bon.type)) : '' },
              { label: t("Source de l'information"), valeur: bon.sourceInformation != null ? t(libelleSourceInformation(bon.sourceInformation)) : '' },
              { label: t('Demandeur'), valeur: bon.personnelDemandantNom },
              { label: t('Service'), valeur: bon.serviceNom || bon.service?.description },
              { label: t('Dépôt'), valeur: bon.depotNom || bon.depot?.codeDepots },
              { label: t('Modèle'), valeur: [equipement?.marque, equipement?.modele].filter(Boolean).join(' ') },
              { label: t('Lieu'), valeur: lieuBon, large: true },
              { label: t('Gamme'), valeur: bon.gammeLibelle, large: true },
              { label: t('Prestataire'), valeur: bon.prestataire?.raisonSociale || bon.prestataire?.nom },
              { label: t('Sous-traitant'), valeur: bon.sousTraitant },
              { label: t('Réclamation'), valeur: reclamation ? (reclamation.num || `#${reclamation.id}`) : '' },
            ],
          },
          { titre: t('Description'), texte: bon.description },
          rapportIa?.contenu && {
            titre: rapportIa.statut === 1 ? t("Rapport d'intervention") : t("Rapport d'intervention (brouillon)"),
            texte: [
              rapportIa.contenu.resume,
              rapportIa.contenu.panneConstatee && `${t('Panne constatée')} : ${rapportIa.contenu.panneConstatee}`,
              rapportIa.contenu.causeIdentifiee && `${t('Cause identifiée')} : ${rapportIa.contenu.causeIdentifiee}`,
              rapportIa.contenu.remede && `${t('Remède')} : ${rapportIa.contenu.remede}`,
              rapportIa.contenu.travauxRealises?.length > 0 && `${t('Travaux réalisés')} :\n${rapportIa.contenu.travauxRealises.map((x) => `• ${x}`).join('\n')}`,
              rapportIa.contenu.piecesRemplacees?.length > 0 && `${t('Pièces remplacées')} :\n${rapportIa.contenu.piecesRemplacees.map((x) => `• ${x}`).join('\n')}`,
              rapportIa.contenu.controlesEtRemiseEnService && `${t('Contrôles et remise en service')} : ${rapportIa.contenu.controlesEtRemiseEnService}`,
              rapportIa.contenu.recommandations?.length > 0 && `${t('Recommandations')} :\n${rapportIa.contenu.recommandations.map((x) => `• ${x}`).join('\n')}`,
              rapportIa.statut === 1 && t('Validé par {nom} le {date}.', { nom: rapportIa.valideParNom || '—', date: rapportIa.valideLe ? new Date(rapportIa.valideLe).toLocaleDateString(locale()) : '—' }),
            ].filter(Boolean).join('\n\n'),
          },
          {
            titre: t('Diagnostics'),
            colonnes: [t('Date'), t('Technicien'), t('Gravité'), t('Cause probable'), { label: t('Durée est.'), align: 'end' }],
            lignes: (diagnostics ?? []).map((d) => [
              formatDateTime(d.dateDiagnostic),
              d.personnelNom,
              d.gravite != null ? t(GRAVITE_LABELS[d.gravite] || String(d.gravite)) : '',
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

  const annule = bon.etat === ETAT.ANNULE;
  const verrouille = bon.etat === ETAT.EFFECTUE || annule;
  const achatsBloques = verrouille;
  const enLectureSeule = (cle) => (verrouille && RUBRIQUES_VERROUILLEES.has(cle))
    || (cle === 'rapport' && (annule || bon.validationStatut === 'VALIDE'));
  const contenuTiroir = () => (tiroir ? (
    <fieldset className="bmz-verrou" disabled={enLectureSeule(tiroir.key)}>{contenuRubrique(tiroir.key, tiroir.form)}</fieldset>
  ) : null);
  const contenuRubrique = (cle, auto) => {
    switch (cle) {
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
          />
        );
      case 'rapport':
        return (
          <BmdRapport
            bon={bon}
            equipementNom={nomEquipement === 'Équipement non renseigné' ? t(nomEquipement) : nomEquipement}
            onChange={setRapportIa}
            onBonModifie={rafraichirBon}
          />
        );
      case 'tracage':
        return <Tracage3DTab bon={bon} reclamations={reclamations} />;
      case 'diagnostic':
        return <DiagnosticTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} autoOpenForm={auto} />;
      case 'reparation':
        return (
          <ReparationEtapes
            intervenants={<IntervenantsTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} onBonMaybeChanged={rafraichirBon} onCelebrer={celebrer} autoOpenForm={auto} />}
            taches={<TachesTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} />}
          />
        );
      case 'taches':
        return <TachesTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} autoOpenForm={auto} />;
      case 'intervenants':
        return <IntervenantsTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} onBonMaybeChanged={rafraichirBon} onCelebrer={celebrer} autoOpenForm={auto} />;
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
        return <DocumentsTab key={versionDocuments} bonMaintenanceId={bon.id} bon={bon} />;
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

  const GROUPES_INFOS = [
    {
      titre: t("Demande"),
      lignes: [
        { icon: UserRound, label: t("Demandeur"), valeur: bon.personnelDemandantNom || '—' },
        { icon: Tag, label: t("Type d'entretien"), valeur: bon.type != null ? t(libelleTypeEntretien(bon.type)) : '—' },
        { icon: Phone, label: t("Source de l'information"), valeur: bon.sourceInformation != null ? t(libelleSourceInformation(bon.sourceInformation)) : '—' },
      ],
    },
    {
      titre: t("Équipement"),
      lignes: [
        { icon: Wrench, label: t("Modèle"), valeur: [equipement?.marque, equipement?.modele].filter(Boolean).join(' ') || '—' },
        { icon: MapPin, label: t("Lieu"), valeur: lieuBon || '—' },
        ...(bon.gammeLibelle ? [{ icon: ListOrdered, label: t("Gamme"), valeur: bon.gammeLibelle }] : []),
        { icon: Building2, label: t("Service"), valeur: bon.serviceNom || bon.service?.description || '—' },
        { icon: PackageSearch, label: t("Dépôt"), valeur: bon.depotNom || bon.depot?.codeDepots || '—' },
      ],
    },
    {
      titre: t("Intervention"),
      lignes: [
        { icon: Users, label: t("Prestataire"), valeur: bon.prestataire?.raisonSociale || bon.prestataire?.nom || '—' },
      ],
    },
  ];
  const pointTon = (ton) => (['alerte', 'prio-red'].includes(ton) ? 'alerte' : ['attention', 'prio-amber'].includes(ton) ? 'attention' : ton === 'ok' ? 'ok' : 'neutre');

  return (
    <div className="bmd-container bmx-page bmz-page bmz-page--onglets bmz-v4">
      <div className="bmz-haut">
      <header className="bmz-entete">
        <button type="button" className="bmz-retour" onClick={onBack} title={t("Tous les bons")} aria-label={t("Tous les bons")}>
          <ArrowLeft size={18} />
        </button>
        <div className="bmz-identite">
          <div className="bmz-identite-haut">
            <span className="bmz-num">{bon.num || t('Bon #{id}', { id: bon.id })}</span>
            <span className={`bmz-etat bmz-point--${pointTon(etatClair.ton)}`}>{t(etatClair.texte)}</span>
            {(bon.etat === ETAT.EN_COURS || bon.etat === ETAT.SUSPENDU) && bon.lotArticleImmobilistationId && (
              <span className="bmz-lecture-seule" title={t('Mode maintenance : les alertes de cet équipement (agent, réseau) arrivent sans notification jusqu’à la fin du bon.')}>
                <BellOff size={12} aria-hidden="true" /> {t('Alertes en sourdine')}
              </span>
            )}
            {verrouille && (
              <span className="bmz-lecture-seule" title={annule ? t('Ce bon est annulé : il ne peut plus être modifié.')
                : bon.validationStatut === 'VALIDE'
                  ? t('Ce bon est validé et archivé : il ne peut plus être modifié.') : t('Ce bon est effectué : il ne peut plus être modifié.')}>
                <Lock size={12} aria-hidden="true" /> {bon.validationStatut === 'VALIDE' ? t('Archivé') : t('Lecture seule')}
              </span>
            )}
          </div>
          <h1 className="bmz-titre">{nomEquipement}</h1>
          <p className="bmz-resume">
            {bon.titre && bon.titre !== nomEquipement ? <>{t(bon.titre)} · </> : null}
            {t('Signalé le {date}', { date: formatDate(bon.date) })}
            {joursDepuis(bon.date) ? t(', {quand}', { quand: joursDepuis(bon.date) }) : ''}
            {reclamation ? t(' suite à la réclamation {num}', { num: reclamation.num || `#${reclamation.id}` }) : ''}
          </p>
        </div>
        <div className="bmz-actions">
          {bon.validationStatut === 'A_VALIDER' && <BoutonsDecision bon={bon} onMaj={() => rafraichirBon()} compact />}
          <button type="button" className="bmz-btn" onClick={() => ouvrir('chat')}>
            <MessageCircle size={16} /> <span>{t('Discuter')}</span>
            {nonLusChat > 0 && <span className="bmz-pastille" aria-label={tp('message non lu', nonLusChat)}>{nonLusChat}</span>}
          </button>
          {bon.lotArticleImmobilistationId && (
            <button type="button" className="bmz-btn" onClick={() => setRecapImmoOuvert(true)}
              title={t('État, pannes, coûts, préventif et historique de l’équipement')}>
              <ScanSearch size={16} /> <span>{t('Récap équipement')}</span>
            </button>
          )}
          <button type="button" className="bmz-btn" onClick={() => setEditeurPiece('DEMANDE')} disabled={achatsBloques}
            title={achatsBloques ? (annule ? t('Ce bon est annulé : il ne peut plus être modifié.') : t('Ce bon est effectué : plus de demande ni de commande possible.')) : t('Demande de fourniture')}>
            <PackageSearch size={16} /> <span>{t('Demander')}</span>
          </button>
          <button type="button" className="bmz-btn" onClick={() => setEditeurPiece('COMMANDE')} disabled={achatsBloques}
            title={achatsBloques ? (annule ? t('Ce bon est annulé : il ne peut plus être modifié.') : t('Ce bon est effectué : plus de demande ni de commande possible.')) : t('Commande fournisseur')}>
            <ShoppingCart size={16} /> <span>{t('Commander')}</span>
          </button>
          <button type="button" className="bmz-btn" onClick={() => setQrOuvert(true)}>
            <QrCode size={16} /> <span>{t('QR code')}</span>
          </button>
          <button type="button" className="bmz-btn" onClick={imprimerBon} disabled={impressionEnCours}>
            {impressionEnCours ? <Loader2 size={16} className="bmx-spin" /> : <Printer size={16} />}
            <span>{impressionEnCours ? t('Préparation…') : t('Imprimer')}</span>
          </button>
        </div>
      </header>

      <section className="bmz-parcours" aria-label={t("Parcours de la réparation")}>
        <ol className="bmz-ligne" style={{ '--bmz-p': progression / 100, '--bmz-nb': ETAPES_DEF.length }}>
          {parcours.etapes.map((etape) => {
            const IconStatut = etape.statut === 'fait' ? Check : etape.statut === 'probleme' ? AlertTriangle : etape.icon;
            return (
              <li key={etape.key} className={`bmz-etape is-${etape.statut}`}>
                <button type="button" onClick={() => ouvrir(etape.rubrique)} title={t(etape.detail || etape.aide)}
                  aria-current={etape.statut === 'actuel' || etape.statut === 'probleme' ? 'step' : undefined}>
                  <span className="bmz-etape-point"><IconStatut size={14} strokeWidth={2.6} /></span>
                  <span className="bmz-etape-nom">{t(etape.label)}</span>
                  <span className="bmz-etape-aide">{t(etape.detail || etape.aide)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <span className="bmz-parcours-compte">
          {parcours.cloture ? t('Terminé') : t('Étape {n} sur {total}', { n: Math.min(parcours.indexActuel + 1, ETAPES_DEF.length), total: ETAPES_DEF.length })}
        </span>
      </section>

      </div>

      <BandeauValidation bon={bon} />

      <div className="bmz-plan">
      <div className="bmz-corps bmz-corps--sans-rapport">

        <div className="bmz-col">
          <section className="bmz-carte bmz-infos" aria-label={t("Informations générales du bon")}>
            <h2 className="bmz-carte-titre">{t("Informations")}</h2>

            <div className="bmz-infos-bloc" aria-label={t("En un coup d'œil")}>
              <h3 className="bmz-sous-titre">{t("En un coup d'œil")}</h3>
              <ul className="bmz-tuiles">
                {signesVitaux.map((v) => {
                  const Icon = v.icon;
                  const contenu = (
                    <>
                      <span className="bmz-tuile-label"><Icon size={14} /> {t(v.label)}</span>
                      <span className={`bmz-tuile-valeur bmz-point--${pointTon(v.ton)}`} title={t(v.valeur)}>{t(v.valeur)}</span>
                      {v.rubrique && <ChevronRight size={14} className="bmz-tuile-fleche" />}
                    </>
                  );
                  return (
                    <li key={v.key}>
                      {v.rubrique ? (
                        <button type="button" className="bmz-tuile is-cliquable" onClick={() => ouvrir(v.rubrique)}>
                          {contenu}
                        </button>
                      ) : (
                        <div className="bmz-tuile" title={v.priorite ? t("Priorité calculée automatiquement (criticité + urgence + disponibilité d'alternative)") : undefined}>
                          {contenu}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="bmz-lecture">
                <EtatLecture objet={lectureBon ?? bon} actif={[1, 2, 3].includes(Number(bon?.etat))} />
              </p>
            </div>

            <div className="bmz-infos-bloc">
              <h3 className="bmz-sous-titre">{t("Détails du bon")}</h3>
              {GROUPES_INFOS.map((g) => (
                <div key={g.titre} className="bmz-info-groupe">
                  <h4>{g.titre}</h4>
                  <dl>
                    {g.lignes.map((i) => {
                      const Icon = i.icon;
                      return (
                        <div key={i.label}>
                          <dt><Icon size={13} /> {i.label}</dt>
                          <dd title={i.valeur}>{i.valeur}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        </div>

        {reclamations.length > 0 && (
          <section className="bmz-col bmz-carte bmz-reclamations" aria-label={t('Réclamation')}>
            <h2 className="bmz-carte-titre">{reclamations.length > 1 ? t('Réclamations') : t('Réclamation')}</h2>
            <div className="bmz-defile">
              {reclamations.map((r) => <InfosReclamation key={r.id} reclamation={r} />)}
            </div>
          </section>
        )}

      </div>

      <section className="bmz-carte bmz-do" ref={refOnglets} aria-label={t('Dossier')}>
        <div className="bmz-do-barre" role="tablist" aria-label={t('Dossier')}>
          {ONGLETS_DOSSIER.map((r) => {
            const Icon = r.icon;
            const n = compteurs[r.key];
            const actif = ongletDossier.key === r.key;
            return (
              <Fragment key={r.key}>
                {r.debutGroupe && <span className="bmz-do-sep" aria-hidden="true" />}
                <button
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  className={`bmz-do-onglet ${actif ? 'is-actif' : ''}`}
                  onClick={() => ouvrir(r.key)}
                  title={`${t(r.groupe)} · ${t(r.aide)}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{t(r.label)}</span>
                  {n != null && (
                    <span className={`bmz-nb ${r.key === 'chat' && n > 0 ? 'bmz-nb--alerte' : ''}`}
                      title={r.key === 'chat' ? tp('message non lu', n) : undefined}>{n}</span>
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
        <div className="bmz-do-contenu" role="tabpanel" key={`${ongletDossier.key}-${ongletDossier.version}`}>
          <fieldset className="bmz-verrou" disabled={enLectureSeule(ongletDossier.key)}>
            {contenuRubrique(ongletDossier.key, ongletDossier.form)}
          </fieldset>
        </div>
      </section>
      </div>

      <PieceEditor
        ouvert={editeurPiece != null}
        type={editeurPiece || 'DEMANDE'}
        bonMaintenance={bon}
        onFermer={() => setEditeurPiece(null)}
        onCree={() => setVersionDocuments((v) => v + 1)}
      />

      <Tiroir rubrique={tiroir?.key} onClose={fermerTiroir}>
        <div key={`${tiroir?.key}-${tiroir?.form}`}>{contenuTiroir()}</div>
      </Tiroir>

      {recapImmoOuvert && bon.lotArticleImmobilistationId && (
        <RecapImmobilisation lotArticleImmobilistationId={bon.lotArticleImmobilistationId} bonCourantId={bon.id} onFermer={fermerRecapImmo} />
      )}
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

const TON_REPONSE = { Oui: 'oui', Non: 'non', 'Sans objet': 'na' };

function InfosReclamation({ reclamation: r }) {
  const verifs = Array.isArray(r.checklist) ? r.checklist.filter((c) => c && c.question) : [];
  const lignes = [
    { icon: FileText, label: t('Description'), valeur: r.description ? t(r.description) : '—' },
    { icon: Tag, label: t('Code panne'), valeur: r.codePanneCode ? `${r.codePanneCode} · ${t(r.codePanneLibelle || '')}` : '—' },
    { icon: User, label: t('Signalée par'), valeur: r.personnelCreationNom || '—' },
    { icon: Calendar, label: t('Date'), valeur: r.date ? formatDate(r.date) : '—' },
  ];
  return (
    <div className="bmz-infos-bloc bmz-reclamation">
      <h3 className="bmz-sous-titre bmz-reclamation-num">{r.num || `#${r.id}`}</h3>
      <div className="bmz-info-groupe">
        <dl>
          {lignes.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.label}>
                <dt><Icon size={13} /> {i.label}</dt>
                <dd title={i.valeur}>{i.valeur}</dd>
              </div>
            );
          })}
        </dl>
      </div>
      {verifs.length > 0 && (
        <div className="bmz-info-groupe">
          <h4>{t('Vérifications')}</h4>
          <ul className="bmz-verifs">
            {verifs.map((c, i) => (
              <li key={`${i}-${c.question}`}>
                <span className="bmz-verif-q">{t(c.question)}</span>
                <span className={`bmz-verif-r bmz-verif-r--${TON_REPONSE[c.reponse] || 'na'}`}>{t(c.reponse || '—')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
  loadingReclamations
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
                  <span
                    className={`bmd-urgence-badge priorite-color-${prioriteColor(bon.priorite)}`}
                    title={t("Priorité calculée automatiquement (criticité + urgence + disponibilité d'alternative)")}
                  >
                    {t(prioriteLabel(bon.priorite))}
                  </span>
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





const TYPES_PIECE = { '.COMMANDE_FOURNISSEUR': 'Commande fournisseur', '.D_Fourniture': 'Demande de fourniture' };

async function enteteImpression() {
  const params = await parametreService.getAll().catch(() => []);
  const v = (cle) => (params || []).find((p) => p.cle === cle)?.valeur?.trim() || '';
  const contexte = authService.getContexteMetier() || {};
  let presta = null;
  if ((!v('impression.societe.nom') || !v('impression.societe.telephone')) && Number(contexte.prestataireId) > 0) {
    presta = await prestataireService.getById(contexte.prestataireId).catch(() => null);
  }
  const nomPresta = presta ? (presta.raisonSociale || `${presta.nom || ''} ${presta.prenom || ''}`.trim()) : '';
  return {
    nom: v('impression.societe.nom') || nomPresta || contexte.prestataireNom || '',
    adresse: v('impression.societe.adresse'),
    ville: v('impression.societe.ville'),
    codePostal: v('impression.societe.code_postal'),
    matriculeFiscal: v('impression.societe.matricule_fiscal'),
    telephone: v('impression.societe.telephone') || presta?.telephone || '',
  };
}

const CIRCUIT_ACHAT = [
  { cle: 'BROUILLON', label: 'Brouillon' },
  { cle: 'EN_ATTENTE_VALIDATION', label: 'En attente de validation' },
  { cle: 'VALIDE', label: 'Validé' },
  { cle: 'COMMANDE', label: 'Commandé', labelDemande: 'Transmis' },
  { cle: 'PARTIELLEMENT_RECEPTIONNE', label: 'Partiellement réceptionné' },
  { cle: 'RECEPTIONNE', label: 'Réceptionné' },
  { cle: 'CLOTURE', label: 'Clôturé' },
];
const statutAchat = (piece) => piece?.statutAchat || (piece?.cubixPieceId != null ? 'COMMANDE' : 'BROUILLON');
const libelleStatutAchat = (cle, piece) => {
  const e = CIRCUIT_ACHAT.find((x) => x.cle === cle);
  if (!e) return cle;
  return t(piece?.codePieceType === '.D_Fourniture' && e.labelDemande ? e.labelDemande : e.label);
};
const lireSuiviAchat = (piece) => {
  try { const v = JSON.parse(piece?.suiviAchat || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

function CircuitAchat({ piece }) {
  const [ouvert, setOuvert] = useState(false);
  const actuel = statutAchat(piece);
  const index = CIRCUIT_ACHAT.findIndex((e) => e.cle === actuel);
  const suivi = lireSuiviAchat(piece);
  const dernier = suivi[suivi.length - 1];
  const refus = actuel === 'BROUILLON' && dernier?.commentaire?.startsWith('Refusé');
  return (
    <div className="bmd-achat">
      <ol className="bmd-achat-etapes" aria-label={t("Circuit d'achat")}>
        {CIRCUIT_ACHAT.map((e, i) => (
          <li key={e.cle} className={`${i < index ? 'is-faite' : ''} ${i === index ? 'is-actuelle' : ''}`}
            title={libelleStatutAchat(e.cle, piece)}>
            <span className="bmd-achat-point">{i < index ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
            {i === index && <span className="bmd-achat-label">{libelleStatutAchat(e.cle, piece)}</span>}
          </li>
        ))}
      </ol>
      {suivi.length > 0 && (
        <button type="button" className="bmd-achat-suivi-btn" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
          <History size={12} /> {t('Suivi')} ({suivi.length})
        </button>
      )}
      {refus && <span className="bmd-achat-refus"><AlertTriangle size={12} /> {dernier.commentaire}</span>}
      {ouvert && (
        <ul className="bmd-achat-suivi">
          {suivi.map((s, i) => (
            <li key={i}>
              <strong>{libelleStatutAchat(s.statut, piece)}</strong>
              <span>{s.date ? new Date(s.date).toLocaleString(locale()) : ''}{s.parNom ? ` · ${s.parNom}` : ''}</span>
              {s.commentaire && <em>{s.commentaire}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsTab({ bonMaintenanceId, bon }) {
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
  const [impressionId, setImpressionId] = useState(null);
  const [transfertId, setTransfertId] = useState(null);
  const [messageCubix, setMessageCubix] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [refus, setRefus] = useState(null);
  const [reception, setReception] = useState(null);

  const auteur = () => {
    const u = authService.getCurrentUser() || {};
    return { personnelId: u.personnelId ?? u.userId ?? null, personnelNom: u.userNom || u.login || null };
  };

  const actionCircuit = async (d, action, corps = {}) => {
    setActionId(d.id);
    setMessageCubix(null);
    try {
      await bonMaintenanceDocumentAchatService.workflow(d.pieceId, action, { ...auteur(), ...corps });
      await load();
      return true;
    } catch (err) {
      setMessageCubix({ ok: false, texte: err?.response?.data?.message || t("L'action n'a pas pu être enregistrée.") });
      return false;
    } finally {
      setActionId(null);
    }
  };

  const confirmerEtape = (d, action, titre, message, texteBouton) => setConfirmModal({
    show: true, title: titre, type: 'info', confirmText: texteBouton, message,
    onConfirm: async () => { closeConfirmModal(); await actionCircuit(d, action); },
  });

  const ouvrirReception = async (d) => {
    setReception({ doc: d, lignes: [], saisies: {}, chargement: true });
    try {
      const lignes = await bonMaintenanceDocumentAchatService.lignesPiece(d.pieceId);
      setReception({ doc: d, lignes, saisies: Object.fromEntries(lignes.map((l) => [l.id, String(l.qteRecue ?? 0)])), chargement: false });
    } catch {
      setReception(null);
      setMessageCubix({ ok: false, texte: t('Les lignes de la pièce sont introuvables.') });
    }
  };

  const validerReception = async () => {
    const receptions = reception.lignes.map((l) => ({ ligneId: l.id, qteRecue: reception.saisies[l.id] }));
    if (await actionCircuit(reception.doc, 'receptionner', { receptions })) setReception(null);
  };
  const [articlesLignes, setArticlesLignes] = useState({});
  const articleDeLigne = (l) => articlesLignes[String(l.prestataireArticlesId)]
    || articles.find((a) => String(a.id) === String(l.prestataireArticlesId));

  const transfererCubix = (d) => {
    const piece = d.piece || {};
    const commande = piece.codePieceType === '.COMMANDE_FOURNISSEUR';
    setConfirmModal({
      show: true,
      title: t('Transférer à Cubix'),
      type: 'info',
      confirmText: t('Transférer'),
      message: commande
        ? t('Créer la commande fournisseur {num} dans Cubix ? Le stock du dépôt sera crédité.', { num: piece.numPiece || `#${d.pieceId}` })
        : t('Créer le bon de fourniture de la demande {num} dans Cubix ? Les articles sortiront du dépôt source et entreront dans le dépôt destinataire.', { num: piece.numPiece || `#${d.pieceId}` }),
      onConfirm: async () => {
        closeConfirmModal();
        setTransfertId(d.id);
        setMessageCubix(null);
        const u = authService.getCurrentUser() || {};
        const r = await bonMaintenanceDocumentAchatService.transfererCubix(d.pieceId, {
          id: u.personnelId ?? u.userId ?? null, nom: u.userNom || u.login || null,
        });
        setTransfertId(null);
        setMessageCubix({ ok: r?.succes === true, texte: r?.message || t('Cubix est injoignable pour le moment.') });
        if (r?.succes) await load();
      },
    });
  };

  const imprimerDocument = async (d) => {
    const piece = d.piece || {};
    setImpressionId(d.id);
    try {
      const commande = piece.codePieceType === '.COMMANDE_FOURNISSEUR';
      const [entete, depotCubix, depotDest, cible, artsLignes] = await Promise.all([
        enteteImpression(),
        piece.depotId ? depotCubixService.getById(piece.depotId).catch(() => null) : Promise.resolve(null),
        !commande && piece.depotDestinationId
          ? depotCubixService.getById(piece.depotDestinationId).catch(() => null) : Promise.resolve(null),
        piece.cibleId ? prestataireService.getById(piece.cibleId).catch(() => null) : Promise.resolve(null),
        prestataireArticleService.getParIds((d.lignes ?? []).map((l) => l.prestataireArticlesId)).catch(() => ({})),
      ]);
      const depotNom = depotCubix?.nom || depotCubix?.codeDepots || bon?.depotNom || bon?.depot?.codeDepots;
      const user = authService.getCurrentUser() || {};
      const titre = TYPES_PIECE[piece.codePieceType] || piece.description || t("Pièce");
      imprimerPiece({
        type: commande ? 'COMMANDE' : 'DEMANDE',
        entete,
        titre,
        numero: piece.numPiece || piece.num || `#${d.pieceId}`,
        date: piece.date || piece.dateCreation,
        dateLivraison: piece.dateLivraison,
        saisiePar: piece.personnelCreationNom || user.userNom || user.login || '',
        cubixNumPiece: piece.cubixNumPiece,
        objet: piece.description && piece.description !== titre ? piece.description : null,
        note: piece.note || piece.commentaire,
        devise: piece.devise,
        reference: {
          bonNum: bon?.num ? String(bon.num) : (bon?.id ? `#${bon.id}` : null),
          bonTitre: bon?.titre,
          demandeur: bon?.personnelDemandantNom,
        },
        depot: depotNom ? { nom: depotNom } : null,
        depotDestination: depotDest ? { nom: depotDest.nom || depotDest.codeDepots } : null,
        cible: cible ? { nom: cible.raisonSociale || `${cible.nom || ''} ${cible.prenom || ''}`.trim(), telephone: cible.telephone } : null,
        service: bon?.serviceNom || bon?.service?.description || null,
        totaux: { tht: piece.tht, tremise: piece.tRemise, ttva: piece.ttva, timbre: piece.timbre, ttc: piece.ttc },
        lignes: (d.lignes ?? []).map((l) => {
          const art = artsLignes[String(l.prestataireArticlesId)] || articleDeLigne(l);
          return {
            code: art?.code,
            designation: art?.designation || t('Article #{id}', { id: l.prestataireArticlesId }),
            unite: l.unite || art?.uniteStock,
            qte: l.qte,
            qteEmballage: l.qteColisee,
            prixUnitaire: l.prixUnitaire,
            remise: l.remise,
            tva: l.tva,
            montantHT: l.netHT ?? l.montantHT,
            gratuit: l.estGratuit === true,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      alert(t("L'impression n'a pas pu être préparée."));
    } finally {
      setImpressionId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonMaintenanceId);
      setDocuments(data ?? []);
      const ids = (data ?? []).flatMap((doc) => (doc.lignes ?? []).map((l) => l.prestataireArticlesId));
      prestataireArticleService.getParIds(ids)
        .then((m) => setArticlesLignes((prev) => ({ ...prev, ...m })))
        .catch(console.error);
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
    obtenirPrestataires().then(setPrestataires).catch(console.error);
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

      {messageCubix && (
        <p className={`bmd-cubix-message ${messageCubix.ok ? 'is-ok' : 'is-erreur'}`} role="status">
          {messageCubix.ok ? <CloudCheck size={15} /> : <AlertTriangle size={15} />}
          <span>{messageCubix.texte}</span>
          <button type="button" onClick={() => setMessageCubix(null)} aria-label={t('Fermer')}><X size={13} /></button>
        </p>
      )}

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
                    const article = articleDeLigne(l);
                    return `${article?.designation || t('Article #{id}', { id: l.prestataireArticlesId })} (${t('Qté')} ${l.qte})`;
                  }).join(', ')}
                  {d.piece?.cibleId != null
                    ? ` · ${prestataires.find((p) => String(p.id) === String(d.piece.cibleId))?.raisonSociale || t('Sous-traitant #{id}', { id: d.piece.cibleId })}`
                    : ''}
                  {d.piece?.description ? ` · ${d.piece.description}` : ''}
                </span>
                {d.piece?.cubixNumPiece && (
                  <span className="bmd-cubix-badge" title={d.piece.dateTransfertCubix ? new Date(d.piece.dateTransfertCubix).toLocaleString() : undefined}>
                    <CloudCheck size={13} /> {t('Cubix')} : {d.piece.cubixNumPiece}
                  </span>
                )}
                {['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && <CircuitAchat piece={d.piece} />}
              </div>
              <div className="bmd-doc-actions">
                {['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && (() => {
                  const s = statutAchat(d.piece);
                  const occupe = actionId === d.id;
                  const num = d.piece?.numPiece || `#${d.pieceId}`;
                  const bouton = (cle, Icone, texte, onClick, classe = '') => (
                    <button key={cle} type="button" className={`bmd-doc-imprimer bmd-doc-etape ${classe}`} onClick={onClick} disabled={occupe}>
                      {occupe ? <Loader2 size={14} className="spinner" /> : <Icone size={14} />}
                      <span>{texte}</span>
                    </button>
                  );
                  if (s === 'BROUILLON') return bouton('s', Send, t('Soumettre à validation'),
                    () => confirmerEtape(d, 'soumettre', t('Soumettre à validation'), t('Envoyer {num} au responsable pour validation ?', { num }), t('Soumettre')));
                  if (s === 'EN_ATTENTE_VALIDATION') return [
                    bouton('v', Check, t('Valider'), () => confirmerEtape(d, 'valider', t('Valider'), t('Valider {num} ? Elle pourra ensuite être transférée à Cubix.', { num }), t('Valider')), 'is-ok'),
                    bouton('r', X, t('Refuser'), () => setRefus({ doc: d, motif: '' }), 'is-refus'),
                  ];
                  if (s === 'COMMANDE' || s === 'PARTIELLEMENT_RECEPTIONNE') return bouton('rc', PackageSearch, t('Réceptionner'), () => ouvrirReception(d));
                  if (s === 'RECEPTIONNE') return bouton('c', FileCheck, t('Clôturer'),
                    () => confirmerEtape(d, 'cloturer', t('Clôturer'), t('Clôturer {num} ? Documents et mouvements de stock sont rapprochés.', { num }), t('Clôturer')));
                  return null;
                })()}
                {!d.piece?.cubixNumPiece && statutAchat(d.piece) === 'VALIDE' && ['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && (
                  <button type="button" className="bmd-doc-imprimer bmd-doc-cubix" onClick={() => transfererCubix(d)} disabled={transfertId === d.id}
                    title={t('Transférer à Cubix')} aria-label={t('Transférer à Cubix')}>
                    {transfertId === d.id ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
                    <span>{t('Transférer à Cubix')}</span>
                  </button>
                )}
                <button type="button" className="bmd-doc-imprimer" onClick={() => imprimerDocument(d)} disabled={impressionId === d.id}
                  title={t("Imprimer ce document")} aria-label={t("Imprimer ce document")}>
                  {impressionId === d.id ? <Loader2 size={14} className="spinner" /> : <Printer size={14} />}
                  <span>{t("Imprimer")}</span>
                </button>
                <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modale ouvert={!!refus} onFermer={() => setRefus(null)} icone={X} taille="sm" titre={t('Refuser')}
        sousTitre={refus?.doc?.piece?.numPiece}
        pied={<>
          <button type="button" className="cm-btn" onClick={() => setRefus(null)}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--danger" disabled={!refus?.motif?.trim() || actionId != null}
            onClick={async () => { if (await actionCircuit(refus.doc, 'refuser', { commentaire: refus.motif })) setRefus(null); }}>
            {t('Refuser')}
          </button>
        </>}>
        <label className="bmd-achat-champ">
          <span>{t('Motif')} *</span>
          <textarea rows={3} value={refus?.motif || ''} onChange={(e) => setRefus((r) => ({ ...r, motif: e.target.value }))} />
        </label>
      </Modale>

      <Modale ouvert={!!reception} onFermer={() => setReception(null)} icone={PackageSearch} taille="md" titre={t('Réceptionner')}
        sousTitre={reception?.doc?.piece?.numPiece}
        pied={<>
          <button type="button" className="cm-btn" onClick={() => setReception(null)}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" disabled={reception?.chargement || actionId != null} onClick={validerReception}>
            {t('Enregistrer')}
          </button>
        </>}>
        {reception?.chargement ? (
          <p className="bmd-empty"><Loader2 size={20} className="spinner" /></p>
        ) : (
          <table className="bmd-achat-reception">
            <thead><tr><th>{t('Article')}</th><th>{t('Commandé')}</th><th>{t('Reçu')}</th></tr></thead>
            <tbody>
              {(reception?.lignes ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{articles.find((a) => String(a.id) === String(l.prestataireArticlesId))?.designation || l.designation}</td>
                  <td>{l.qte}{l.unite ? ` ${l.unite}` : ''}</td>
                  <td>
                    <input type="number" min="0" max={l.qte} step="any" value={reception.saisies[l.id] ?? ''}
                      onChange={(e) => setReception((r) => ({ ...r, saisies: { ...r.saisies, [l.id]: e.target.value } }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modale>

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type || 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || t("Retirer")}
      />
    </div>
  );
}

function CommentairesTab({ bonMaintenanceId }) {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [editionId, setEditionId] = useState(null);
  const [texteEdition, setTexteEdition] = useState('');
  const [savingEdition, setSavingEdition] = useState(false);

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

  const commencerEdition = (c) => {
    setEditionId(c.id);
    setTexteEdition(c.commentaire || '');
  };
  const annulerEdition = () => {
    setEditionId(null);
    setTexteEdition('');
  };
  const enregistrerEdition = async (c) => {
    const texte = texteEdition.trim();
    if (!texte) return;
    setSavingEdition(true);
    try {
      const maj = await bonMaintenanceCommentaireService.update(c.id, { ...c, commentaire: texte });
      setCommentaires((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...(maj || {}), commentaire: texte } : x)));
      annulerEdition();
    } catch (err) {
      console.error(err);
      alert(t("Échec de la modification du commentaire."));
    } finally {
      setSavingEdition(false);
    }
  };

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
                {editionId === c.id ? (
                  <div className="bmd-comment-edition">
                    <textarea
                      value={texteEdition}
                      onChange={(e) => setTexteEdition(e.target.value)}
                      rows={3}
                      autoFocus
                      aria-label={t("Modifier le commentaire")}
                      onKeyDown={(e) => { if (e.key === 'Escape') annulerEdition(); }}
                    />
                    <div className="bmd-comment-actions">
                      <Button type="button" variant="secondary" onClick={annulerEdition} disabled={savingEdition}>
                        {t("Annuler")}
                      </Button>
                      <Button type="button" variant="primary" onClick={() => enregistrerEdition(c)} disabled={savingEdition || !texteEdition.trim()}>
                        {savingEdition ? t("Enregistrement…") : t("Enregistrer")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="bmd-comment-text">{c.commentaire}</p>
                )}
              </div>
              {editionId !== c.id && (
                <div className="bmd-comment-actions">
                  <button type="button" className="bmd-edit-btn" onClick={() => commencerEdition(c)} title={t("Modifier")} aria-label={t("Modifier le commentaire")}>
                    <Edit size={14} />
                  </button>
                  <button type="button" className="bmd-delete-btn" onClick={() => handleDelete(c.id)} title={t("Supprimer")} aria-label={t("Supprimer le commentaire")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
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