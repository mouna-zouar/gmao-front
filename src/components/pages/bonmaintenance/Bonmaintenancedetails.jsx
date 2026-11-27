import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DROITS, useDroits } from '../../../constants/privileges';
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  Clock,
  Building2,
  Activity,
  ChevronRight,
  Search,
  Loader2,
  Printer,
  Eye,
  PackageSearch,
  ShoppingCart,
  Users,
  ClipboardList,
  FileCheck,
  Check,
  ShieldCheck,
  Wrench,
  Stethoscope,
  Power,
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
import chatBonService from '../../../services/chatBonService';
import BmdChat from './BmdChat';
import { qrSvg, urlBon } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import PieceEditor from '../../ui/PieceEditor/PieceEditor';
import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import lectureService from '../../../services/lectureService';
import EtatLecture from '../../commun/EtatLecture';
import Modale from '../../commun/Modale';
import slaService from '../../../services/slaService';
import coutService from '../../../services/coutService';
import rcaCapaService from '../../../services/rcaCapaService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import reclamationServiceComplet from '../../../services/Reclamationservice';
import { precharger } from '../../../services/api';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationCubixService';
import Tracage3DTab from './Tracage3DTab';
import BmdRapport from './BmdRapport';
import { BandeauValidation, BoutonsDecision } from './ValidationBon';
import bonMaintenanceRapportService from '../../../services/bonMaintenanceRapportService';
import { libelleTypeEntretien, libelleSourceInformation } from '../../../constants/FicheIntervention';
import {
  useCelebration,
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
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import './Bonmaintenancedetails.css';
import { DiagnosticTab } from './onglets/DiagnosticTab';
import { TachesTab } from './onglets/TachesTab';
import { IntervenantsTab } from './onglets/IntervenantsTab';
import { ControleEquipementTab } from './onglets/ControleEquipementTab';
import { RemiseEnServiceTab } from './onglets/RemiseEnServiceTab';
import './BmdEpure.css';
import RecapImmobilisation from './RecapImmobilisation';
import { ETAT, ETAPES_DEF, construireParcours } from './parcoursBon';
import { FlowTab } from './onglets/FlowTab';
import { ReparationEtapes, PanneauDelais, PanneauCout, InfosReclamation } from './PanneauxBon';
import { CommentairesTab } from './onglets/CommentairesTab';
import { HistoriqueTab } from './onglets/HistoriqueTab';
import { DocumentsTab } from './onglets/DocumentsTab';
import { CauseRacineTab } from './onglets/CauseRacineTab';
import { useExecuter } from '../../../store/hooks';
import { bons as moduleBons } from '../../../store/modules/bons';

const RUBRIQUES_VERROUILLEES = new Set(['diagnostic', 'reparation', 'taches', 'intervenants', 'controle', 'remiseEnService', 'commentaires']);

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

export default function BonMaintenanceDetails({ bonMaintenance, onBack, ongletInitial = null }) {
  const aDroit = useDroits();
  useMemo(() => prechargerBon(bonMaintenance?.id), [bonMaintenance?.id]);
  const [bon, setBon] = useState(bonMaintenance);
  const executer = useExecuter();
  const [loading, setLoading] = useState(!bonMaintenance);
  const [error, setError] = useState(null);
  const [tiroir, setTiroir] = useState(null);
  const [ongletDossier, setOngletDossier] = useState({ key: ongletInitial && CLES_ONGLETS.has(ongletInitial) ? ongletInitial : 'rapport', form: false, version: 0 });
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
        const bonDetails = await executer(moduleBons.actions.obtenir(bonMaintenance.id));
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
  }, [bonMaintenance, executer]);

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
      const bonMaj = await executer(moduleBons.actions.obtenir(bonMaintenance.id));
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
  }, [bonMaintenance?.id, celebrer, chargerResume, executer]);

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
        return <CauseRacineTab bon={bon} reclamations={reclamations} analyses={rcaAnalyses} loading={loadingRca} onRecharger={chargerRca} />;
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
          {aDroit(DROITS.BON_ARTICLES) && (
          <button type="button" className="bmz-btn" onClick={() => setEditeurPiece('DEMANDE')} disabled={achatsBloques}
            title={achatsBloques ? (annule ? t('Ce bon est annulé : il ne peut plus être modifié.') : t('Ce bon est effectué : plus de demande ni de commande possible.')) : t('Demande de fourniture')}>
            <PackageSearch size={16} /> <span>{t('Demander')}</span>
          </button>
          )}
          {aDroit(DROITS.BON_ARTICLES) && (
          <button type="button" className="bmz-btn" onClick={() => setEditeurPiece('COMMANDE')} disabled={achatsBloques}
            title={achatsBloques ? (annule ? t('Ce bon est annulé : il ne peut plus être modifié.') : t('Ce bon est effectué : plus de demande ni de commande possible.')) : t('Commande fournisseur')}>
            <ShoppingCart size={16} /> <span>{t('Commander')}</span>
          </button>
          )}
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
