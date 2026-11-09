// Page de détail d'une réclamation — même langage visuel que le « parcours de réparation » du bon
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Megaphone,
  ShieldQuestion,
  Wrench,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  User,
  Calendar,
  Gauge,
  Flame,
  FileText,
  FilePlus,
  Link as LinkIcon,
  ChevronRight,
  HelpCircle,
  Ban,
  Package,
  Printer,
  QrCode,
  Tag,
  UserCheck,
  Users,
  History,
  PlayCircle,
  Lock,
  RotateCcw,
  Inbox,
  ClipboardCheck,
} from 'lucide-react';
import reclamationService from '../../../services/Reclamationservice';
import lectureService from '../../../services/lectureService';
import EtatLecture from '../../commun/EtatLecture';
import { ETAT_REC, actionsPossibles, estAffectee, nomTechnicien, TYPES_HISTORIQUE } from './ReclamationActions';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { qrSvg, urlReclamation } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import BmdChat from '../bonmaintenance/BmdChat';
import { chatReclamationService } from '../../../services/chatBonService';
import '../bonmaintenance/BmdEpure.css';
import './ReclamationDetails.css';

// États de la réclamation (cycle IBM Maximo, identiques à Reclamations.jsx)
const ETAT = ETAT_REC;

const ETAT_EN_CLAIR = {
  0: { texte: 'Nouveau', ton: 'alerte' },
  5: { texte: 'En file', ton: 'attention' },
  1: { texte: 'En cours', ton: 'action' },
  3: { texte: 'Résolue', ton: 'ok' },
  2: { texte: 'Clôturée', ton: 'ok' },
  4: { texte: 'Annulée', ton: 'neutre' },
};

const NIVEAU = {
  1: { texte: 'Faible', ton: 'info' },
  2: { texte: 'Moyenne', ton: 'attention' },
  3: { texte: 'Élevée', ton: 'alerte' },
};

const ETAT_BON_EN_CLAIR = {
  1: { texte: 'Nouveau', ton: 'info' },
  2: { texte: 'En pause', ton: 'attention' },
  3: { texte: 'En cours', ton: 'action' },
  4: { texte: 'Terminé', ton: 'ok' },
  10: { texte: 'Annulé', ton: 'neutre' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function joursDepuis(iso) {
  if (!iso) return null;
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (isNaN(j) || j < 0) return null;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return tp('il y a jours', j);
}

// Le endpoint « getWithBonMaintenance » peut renvoyer plusieurs formes : on les accepte toutes
function normaliser(data) {
  if (!data) return { reclamation: null, bons: [] };
  const reclamation = data.reclamation ?? data;
  let bons = data.bonMaintenances ?? data.bons ?? reclamation.bonMaintenances ?? null;
  if (!bons) {
    const unique = data.bonMaintenance ?? reclamation.bonMaintenance ?? null;
    bons = unique ? [unique] : [];
  }
  if (bons.length === 0 && reclamation.bonMaintenanceId != null) {
    bons = [{ id: reclamation.bonMaintenanceId }];
  }
  return { reclamation, bons: bons.filter(Boolean) };
}

// ------------------------------------------------------------
// Parcours (modèle Maximo) : Nouveau → En file → En cours → Résolue → Clôturée
// ------------------------------------------------------------
const ETAPES_DEF = [
  { key: 'nouveau', label: 'Nouveau', aide: 'Le problème a été signalé', icon: Megaphone },
  { key: 'file', label: 'En file', aide: 'Affectée à un groupe ou un technicien', icon: UserCheck },
  { key: 'cours', label: 'En cours', aide: 'Prise en charge, bon de maintenance créé', icon: Wrench },
  { key: 'resolue', label: 'Résolue', aide: 'Le problème est réglé', icon: CheckCircle },
  { key: 'cloturee', label: 'Clôturée', aide: 'La demande est fermée', icon: Lock },
];

/** Index de l'étape en cours selon l'état ; pour une réclamation annulée, l'étape où elle s'est arrêtée. */
function indexEtape(r) {
  switch (r.etat ?? ETAT.NOUVEAU) {
    case ETAT.NOUVEAU: return 0;
    case ETAT.EN_FILE: return 1;
    case ETAT.EN_COURS: return 2;
    case ETAT.RESOLUE: return 3;
    case ETAT.CLOTUREE: return 4;
    default: // annulée : première étape non atteinte
      if (r.dateResolution) return 4;
      if (r.datePriseEnCharge) return 3;
      if (r.dateAffectation || estAffectee(r)) return 2;
      return 1;
  }
}

function construireParcours(reclamation, bons) {
  const annulee = reclamation.etat === ETAT.ANNULEE;
  const indexActuel = indexEtape(reclamation);
  const affectation = [reclamation.groupeNom, nomTechnicien(reclamation)].filter(Boolean).join(' · ');
  const details = {
    nouveau: formatDate(reclamation.date),
    file: affectation || null,
    cours: bons.length > 0 ? (bons[0].num || tp('bon', bons.length)) : (reclamation.datePriseEnCharge ? formatDate(reclamation.datePriseEnCharge) : null),
    resolue: reclamation.dateResolution ? formatDate(reclamation.dateResolution) : null,
    cloturee: reclamation.dateCloture ? formatDate(reclamation.dateCloture) : null,
  };

  return ETAPES_DEF.map((def, i) => {
    let statut = 'avenir';
    if (i < indexActuel) statut = 'fait';
    else if (i === indexActuel) statut = annulee ? 'probleme' : (reclamation.etat === ETAT.CLOTUREE ? 'fait' : 'actuel');
    if (annulee && i > indexActuel) statut = 'barre';
    const detail = annulee && i === indexActuel ? 'Annulée' : details[def.key];
    return { ...def, statut, detail };
  });
}

function prochaineAction(reclamation, bons) {
  const affectation = [reclamation.groupeNom, nomTechnicien(reclamation)].filter(Boolean).join(' · ');
  switch (reclamation.etat ?? ETAT.NOUVEAU) {
    case ETAT.NOUVEAU:
      return {
        ton: 'action',
        icon: Inbox,
        titre: t('Personne n’est encore affecté'),
        texte: t('Affectez la réclamation à un groupe et/ou un technicien. Vous pouvez aussi la prendre en charge directement : le bon de maintenance sera créé.'),
        bouton: { label: t('Affecter'), action: 'affecter' },
        secondaire: { label: t('Prendre en charge'), action: 'prendre' },
      };
    case ETAT.EN_FILE:
      return {
        ton: 'action',
        icon: PlayCircle,
        titre: t('En attente de prise en charge'),
        texte: affectation
          ? t('Affectée à {qui}. La prise en charge passe la réclamation « En cours » et crée le bon de maintenance.', { qui: affectation })
          : t('La prise en charge passe la réclamation « En cours » et crée le bon de maintenance.'),
        bouton: { label: t('Prendre en charge'), action: 'prendre' },
        secondaire: { label: t('Réaffecter'), action: 'affecter' },
      };
    case ETAT.EN_COURS:
      if (bons.length > 0) {
        return {
          ton: 'action',
          icon: Wrench,
          titre: t('La réparation est en cours'),
          texte: t('Suivez l’avancement dans le bon de maintenance. La réclamation passe « Résolue » quand le bon est effectué ; vous pouvez aussi la marquer résolue vous-même.'),
          bouton: { label: t('Suivre le bon {num}', { num: bons[0].num || '' }).trim(), action: 'ouvrirBon', bon: bons[0] },
          secondaire: { label: t('Marquer résolue'), action: 'resoudre' },
        };
      }
      return {
        ton: 'action',
        icon: FilePlus,
        titre: t('Lancez la réparation'),
        texte: t('Aucun bon de maintenance n’est lié. Créez-en un, ou rattachez un bon qui existe déjà.'),
        bouton: { label: t('Créer un bon de maintenance'), action: 'creerBon' },
        secondaire: { label: t('Associer un bon existant'), action: 'associer' },
      };
    case ETAT.RESOLUE:
      return {
        ton: 'action',
        icon: CheckCircle,
        titre: t('Vérifiez la réparation'),
        texte: t('Le problème est marqué comme réglé. Clôturez la réclamation, ou rouvrez-la si ce n’est pas le cas.'),
        bouton: { label: t('Clôturer'), action: 'cloturer' },
        secondaire: { label: t('Rouvrir'), action: 'rouvrir' },
      };
    case ETAT.CLOTUREE:
      return {
        ton: 'fini',
        icon: CheckCircle,
        titre: t('Réclamation traitée'),
        texte: t('Le problème a été réparé et la demande est fermée.'),
        bouton: bons.length > 0 ? { label: t('Revoir le bon de maintenance'), action: 'ouvrirBon', bon: bons[0] } : null,
      };
    case ETAT.ANNULEE: {
      const motif = reclamation.motifAnnulation || reclamation.motifRejet;
      return {
        ton: 'neutre',
        icon: Ban,
        titre: t('Réclamation annulée'),
        texte: motif ? t('Motif : {motif}', { motif }) : t('Aucune réparation ne sera lancée pour cette demande.'),
        bouton: null,
      };
    }
    default:
      return null;
  }
}

/* Une ligne de l'historique, en clair */
function ligneHistorique(h) {
  const titre = TYPES_HISTORIQUE[h.type] || h.type;
  const qui = (g, p) => [g, p].filter(Boolean).join(' · ');
  const avant = qui(h.ancienGroupeNom, h.ancienResponsableNom);
  const apres = qui(h.nouveauGroupeNom, h.nouveauResponsableNom);
  let detail = null;
  if (h.type === 'AFFECTATION' || h.type === 'REAFFECTATION' || h.type === 'DESAFFECTATION') {
    detail = avant && apres ? `${avant} → ${apres}` : (apres ? t('À {qui}', { qui: apres }) : (avant ? t('Retirée à {qui}', { qui: avant }) : null));
  } else if (h.ancienEtat != null && h.nouvelEtat != null && h.ancienEtat !== h.nouvelEtat) {
    detail = `${t(ETAT_EN_CLAIR[h.ancienEtat]?.texte || '')} → ${t(ETAT_EN_CLAIR[h.nouvelEtat]?.texte || '')}`;
  } else if (h.type === 'CREATION' && apres) {
    detail = t('Affectée à {qui}', { qui: apres });
  }
  const classe = h.type === 'ANNULATION' ? 'is-annulation'
    : ['AFFECTATION', 'REAFFECTATION', 'DESAFFECTATION'].includes(h.type) ? 'is-affectation'
      : h.type === 'CREATION' ? '' : 'is-etat';
  return { titre, detail, classe };
}

function dateHeure(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CLE_AIDE = 'rcx-aide-masquee';
function lireAideMasquee() {
  try { return window.localStorage.getItem(CLE_AIDE) === '1'; } catch { return false; }
}
function ecrireAideMasquee(v) {
  try { window.localStorage.setItem(CLE_AIDE, v ? '1' : '0'); } catch { /* stockage indisponible */ }
}

// ============================================================
// COMPOSANT
// ============================================================
export default function ReclamationDetails({
  data,
  loading = false,
  validating = false,
  onBack,
  onModifier,
  onValider,
  onRejeter,
  onAction, // cycle de vie : (nom) => …  nom = affecter | prendre | resoudre | cloturer | rouvrir | annuler
  onCreerBon,
  onAssocier,
  onOuvrirBon,
  libelleRetour, // texte du bouton retour (ex. « Retour à mon espace »)
}) {
  const { reclamation, bons } = normaliser(data);
  const [equipement, setEquipement] = useState(null);
  const [aideMasquee, setAideMasquee] = useState(lireAideMasquee);
  const [qrOuvert, setQrOuvert] = useState(false);
  const [historique, setHistorique] = useState(null);
  const [lecture, setLecture] = useState(null);
  const titreRef = useRef(null);

  // Ouverture : marque la réclamation « lue » si c'est son technicien (le serveur décide)
  useEffect(() => {
    const id = reclamation?.id;
    setLecture(null);
    if (id == null) return undefined;
    let annule = false;
    lectureService.reclamation(id)
      .then((l) => { if (!annule) setLecture(l); })
      .catch(() => { /* serveur pas à jour : on garde l'état reçu avec la réclamation */ });
    return () => { annule = true; };
  }, [reclamation?.id, reclamation?.personnelAffecteId]);

  // Historique des affectations et des états : rechargé à chaque modification de la réclamation
  useEffect(() => {
    const id = reclamation?.id;
    if (id == null) return undefined;
    let annule = false;
    reclamationService.historique(id)
      .then((h) => { if (!annule) setHistorique(Array.isArray(h) ? h : []); })
      .catch(() => { if (!annule) setHistorique([]); });
    return () => { annule = true; };
  }, [reclamation?.id, reclamation?.etat, reclamation?.dateModification, lecture?.nouvelle]);

  useEffect(() => {
    const id = reclamation?.lotArticleImmobilistationId;
    if (id == null) {
      setEquipement(null);
      return;
    }
    let annule = false;
    lotArticleImmobilistationService.getById(id)
      .then((e) => { if (!annule) setEquipement(e); })
      .catch(() => { if (!annule) setEquipement(null); });
    return () => { annule = true; };
  }, [reclamation?.lotArticleImmobilistationId]);

  useEffect(() => { if (!loading) titreRef.current?.focus(); }, [loading]);

  if (loading) {
    return (
      <div className="rcx-page">
        <div className="rcx-chargement">
          <Loader2 size={36} className="rcx-tourne" />
          <p>{t("Ouverture de la réclamation…")}</p>
        </div>
      </div>
    );
  }

  if (!reclamation) {
    return (
      <div className="rcx-page">
        <div className="rcx-erreur">
          <AlertCircle size={36} />
          <p>{t("Cette réclamation est introuvable. Elle a peut-être été supprimée.")}</p>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={onBack}>
            <ArrowLeft size={18} /> {libelleRetour || t("Revenir à la liste")}
          </button>
        </div>
      </div>
    );
  }

  const etatClair = ETAT_EN_CLAIR[reclamation.etat] || { texte: t("Inconnu"), ton: 'neutre' };
  const etapes = construireParcours(reclamation, bons);
  // La barre remplie va jusqu'à l'étape en cours
  const progression = reclamation.etat === ETAT.CLOTUREE ? 1 : Math.min(indexEtape(reclamation), ETAPES_DEF.length - 1) / (ETAPES_DEF.length - 1);
  const possibles = onAction ? actionsPossibles(reclamation) : {};
  const action = prochaineAction(reclamation, bons);
  const ActionIcon = action?.icon;

  const personnel = nomTechnicien(reclamation) || null;
  const groupe = reclamation.groupeNom || null;
  const service = reclamation.serviceNom || reclamation.service?.description || null;
  const nomEquipement = equipement?.designation || null;
  const titre = nomEquipement || t('Réclamation {num}', { num: reclamation.num || `#${reclamation.id}` });

  const executer = (a) => {
    if (!a) return;
    switch (a.action) {
      case 'valider': onValider?.(); break;
      case 'rejeter': onRejeter?.(); break;
      case 'affecter':
      case 'prendre':
      case 'resoudre':
      case 'cloturer':
      case 'rouvrir':
      case 'annuler': onAction?.(a.action); break;
      case 'creerBon': onCreerBon?.(); break;
      case 'associer': onAssocier?.(); break;
      case 'modifier': onModifier?.(); break;
      case 'ouvrirBon': onOuvrirBon?.(a.bon); break;
      default: break;
    }
  };

  const criticite = NIVEAU[reclamation.criticite];
  const urgence = NIVEAU[reclamation.urgence];

  const vitaux = [
    { key: 'etat', icon: FileText, label: t("État"), valeur: etatClair.texte, ton: etatClair.ton },
    { key: 'criticite', icon: Gauge, label: t("Criticité"), valeur: criticite?.texte || 'Non définie', ton: criticite?.ton || 'neutre' },
    { key: 'urgence', icon: Flame, label: t("Urgence"), valeur: urgence?.texte || 'Non définie', ton: urgence?.ton || 'neutre' },
    {
      key: 'bon',
      icon: Wrench,
      label: t("Bon de maintenance"),
      valeur: bons.length === 0 ? 'Aucun' : (bons[0].num || `#${bons[0].id}`),
      ton: bons.length === 0 ? 'neutre' : 'action',
      onClick: bons.length > 0 ? () => onOuvrirBon?.(bons[0]) : null,
    },
  ];

  const avantPriseEnCharge = reclamation.etat == null || reclamation.etat === ETAT.NOUVEAU || reclamation.etat === ETAT.EN_FILE;

  // Impression de la fiche de la réclamation (A4 portrait)
  const imprimerReclamation = async () => {
    // QR code dans l'en-tête : scanné, il rouvre cette réclamation dans la GMAO
    const qr = await qrSvg(urlReclamation(reclamation.id)).catch(() => null);
    imprimerFiche({
      qr,
      titre,
      sousTitre: t('Réclamation'),
      reference: reclamation.num || t('Réclamation #{id}', { id: reclamation.id }),
      statut: t(etatClair.texte),
      sections: [
        {
          titre: t('Informations générales'),
          champs: [
            { label: t('Date'), valeur: formatDate(reclamation.date) },
            { label: t('Service'), valeur: service },
            { label: t('Équipement'), valeur: nomEquipement },
            { label: t('Groupe'), valeur: groupe || '—' },
            { label: t('Technicien'), valeur: personnel || t('Personne pour l’instant') },
            { label: t('Criticité'), valeur: t(criticite?.texte || 'Non définie') },
            { label: t('Urgence'), valeur: t(urgence?.texte || 'Non définie') },
            reclamation.codePanneCode && { label: t('Code panne'), valeur: `${reclamation.codePanneCode} · ${reclamation.codePanneLibelle || ''}` },
          ],
        },
        { titre: t('Ce qui a été signalé'), texte: reclamation.description || t('Aucune description n’a été saisie.') },
        Array.isArray(reclamation.checklist) && reclamation.checklist.length > 0 && {
          titre: t('Vérifications faites par le demandeur'),
          colonnes: [t('Vérification'), t('Réponse')],
          lignes: reclamation.checklist.map((c) => [c.question, t(c.reponse || '—')]),
        },
        reclamation.etat === ETAT.ANNULEE && { titre: t('Motif d’annulation'), texte: reclamation.motifAnnulation || reclamation.motifRejet },
        historique?.length > 0 && {
          titre: t('Historique'),
          colonnes: [t('Date'), t('Action'), t('Détail'), t('Par')],
          lignes: historique.map((h) => {
            const l = ligneHistorique(h);
            return [dateHeure(h.date), t(l.titre), [l.detail, h.commentaire].filter(Boolean).join(' — '), h.auteurNom || ''];
          }),
        },
        {
          titre: t('Bons de maintenance liés'),
          colonnes: [t('Numéro'), t('Titre'), t('État'), t('Date')],
          lignes: bons.map((b) => [
            b.num || `#${b.id}`,
            b.titre,
            ETAT_BON_EN_CLAIR[b.etat] ? t(ETAT_BON_EN_CLAIR[b.etat].texte) : '',
            b.date ? formatDate(b.date) : '',
          ]),
          vide: t('Aucun bon de maintenance n’est lié à cette réclamation.'),
        },
      ],
      signatures: [t('Déclarant'), t('Responsable maintenance')],
    });
  };

  // Une seule couleur d'accent : seuls les points d'alerte gardent du rouge ou de l'orange
  const pointTon = (ton) => (ton === 'alerte' ? 'alerte' : ton === 'attention' ? 'attention' : ton === 'ok' ? 'ok' : 'neutre');
  const infos = [
    { icon: Building2, label: t("Service"), valeur: service || '—' },
    { icon: Users, label: t("Groupe"), valeur: groupe || '—' },
    { icon: User, label: t("Technicien"), valeur: personnel || t("Personne pour l’instant") },
    { icon: Calendar, label: t("Date"), valeur: formatDate(reclamation.date) },
    { icon: Package, label: t("Équipement"), valeur: nomEquipement || '—' },
    reclamation.codePanneCode && { icon: Tag, label: t("Code panne"), valeur: `${reclamation.codePanneCode} · ${reclamation.codePanneLibelle || ''}`, large: true },
  ].filter(Boolean);
  const fermerAide = () => { setAideMasquee(true); ecrireAideMasquee(true); };
  const ouvrirAide = () => { setAideMasquee(false); ecrireAideMasquee(false); };

  return (
    <div className="rcx-page bmz-page rcz-page">
      {/* ===== En-tête : retour, identité, actions ===== */}
      <header className="bmz-entete">
        <button type="button" className="bmz-retour" onClick={onBack}
          title={libelleRetour || t("Toutes les réclamations")} aria-label={libelleRetour || t("Toutes les réclamations")}>
          <ArrowLeft size={18} />
        </button>
        <div className="bmz-identite">
          <div className="bmz-identite-haut">
            <span className="bmz-num">{reclamation.num || t('Réclamation #{id}', { id: reclamation.id })}</span>
            <span className={`bmz-etat bmz-point--${pointTon(etatClair.ton)}`}>{t(etatClair.texte)}</span>
          </div>
          <h1 className="bmz-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
          <p className="bmz-resume">
            {t("Déclarée le")} {formatDate(reclamation.date)}
            {joursDepuis(reclamation.date) ? t(', {quand}', { quand: joursDepuis(reclamation.date) }) : ''}
            {service ? t(', pour le service {service}', { service }) : ''}
          </p>
        </div>
        <div className="bmz-actions">
          <div className="bmz-aide-zone">
            <button type="button" className="bmz-btn" onClick={aideMasquee ? ouvrirAide : fermerAide} aria-expanded={!aideMasquee}>
              <HelpCircle size={16} /> <span>{t("Aide")}</span>
            </button>
            {!aideMasquee && (
              <div className="bmz-aide" role="dialog" aria-label={t("Aide")}>
                <ol>
                  <li>{t("La ligne du parcours montre où en est la demande.")}</li>
                  <li>{t("Le bloc « À faire maintenant » vous dit quoi faire, avec un seul bouton.")}</li>
                  <li>{t("Au milieu, retrouvez le bon de maintenance lié ; à droite, la discussion.")}</li>
                </ol>
                <button type="button" className="bmz-btn bmz-btn--plein" onClick={fermerAide}>
                  <Check size={15} /> {t("J'ai compris")}
                </button>
              </div>
            )}
          </div>
          {possibles.affecter && (
            <button type="button" className="bmz-btn" onClick={() => onAction('affecter')}>
              <UserCheck size={16} /> <span>{estAffectee(reclamation) ? t("Réaffecter") : t("Affecter")}</span>
            </button>
          )}
          <button type="button" className="bmz-btn" onClick={onModifier}>
            <Edit size={16} /> <span>{t("Modifier")}</span>
          </button>
          {possibles.annuler && (
            <button type="button" className="bmz-btn" onClick={() => onAction('annuler')}>
              <XCircle size={16} /> <span>{t("Annuler la réclamation")}</span>
            </button>
          )}
          <button type="button" className="bmz-btn" onClick={() => setQrOuvert(true)}>
            <QrCode size={16} /> <span>{t("QR code")}</span>
          </button>
          <button type="button" className="bmz-btn" onClick={imprimerReclamation}>
            <Printer size={16} /> <span>{t("Imprimer")}</span>
          </button>
        </div>
      </header>

      {qrOuvert && (
        <ModaleQrCode
          url={urlReclamation(reclamation.id)}
          titre={titre}
          sousTitre={t('Réclamation')}
          reference={reclamation.num || t('Réclamation #{id}', { id: reclamation.id })}
          appel={t('Scannez pour suivre la réclamation')}
          onClose={() => setQrOuvert(false)}
        />
      )}

      {/* ===== Parcours de la demande ===== */}
      <section className="bmz-parcours" aria-label={t("Parcours de la réclamation")}>
        <ol className="bmz-ligne" style={{ '--bmz-p': progression, '--bmz-nb': ETAPES_DEF.length }}>
          {etapes.map((e) => {
            const Icon = e.statut === 'fait' ? Check : e.statut === 'probleme' ? XCircle : e.icon;
            return (
              <li key={e.key} className={`bmz-etape is-${e.statut}`}>
                <span className="bmz-etape-contenu">
                  <span className="bmz-etape-point" aria-hidden="true"><Icon size={14} strokeWidth={2.6} /></span>
                  <span className="bmz-etape-nom">{t(e.label)}</span>
                  <span className="bmz-etape-aide">{t(e.detail || e.aide)}</span>
                  {(e.statut === 'actuel' || e.statut === 'probleme') && <span className="rcx-sr">{t("Étape actuelle")}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <span className="bmz-parcours-compte">
          {reclamation.etat === ETAT.CLOTUREE ? t("Terminé")
            : reclamation.etat === ETAT.ANNULEE ? t("Annulée")
              : t('Étape {n} sur {total}', { n: Math.min(indexEtape(reclamation) + 1, ETAPES_DEF.length), total: ETAPES_DEF.length })}
        </span>
      </section>

      {/* ===== Corps : trois colonnes, sans défilement de la page ===== */}
      <div className="bmz-corps">
        <div className="bmz-col">
          {action && (
            <section className={`bmz-carte bmz-maintenant bmz-maintenant--${action.ton}`} aria-label={t("À faire maintenant")}>
              <p className="bmz-surtitre"><ActionIcon size={15} /> {t("À faire maintenant")}</p>
              <h2 className="bmz-maintenant-titre">{t(action.titre)}</h2>
              <p className="bmz-maintenant-texte">{t(action.texte)}</p>
              {(action.bouton || action.secondaire) && (
                <div className="bmz-maintenant-actions">
                  {action.bouton && (
                    <button type="button" className="bmz-btn bmz-btn--plein" onClick={() => executer(action.bouton)} disabled={validating}>
                      {validating ? <Loader2 size={15} className="rcx-tourne" /> : null}
                      {t(action.bouton.label)}
                    </button>
                  )}
                  {action.secondaire && (
                    <button type="button" className="bmz-btn" onClick={() => executer(action.secondaire)} disabled={validating}>
                      {t(action.secondaire.label)}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="bmz-carte bmz-infos" aria-label={t("Informations générales de la réclamation")}>
            <h2 className="bmz-carte-titre">{t("Ce qui a été signalé")}</h2>
            <p className="rcz-description">{reclamation.description || t("Aucune description n’a été saisie.")}</p>
            {reclamation.etat === ETAT.ANNULEE && (reclamation.motifAnnulation || reclamation.motifRejet) && (
              <p className="rcz-rejet"><AlertTriangle size={15} /> <span><strong>{t("Motif d’annulation")} :</strong> {reclamation.motifAnnulation || reclamation.motifRejet}</span></p>
            )}
            <p className="rcz-lecture">
              <EtatLecture objet={lecture ?? reclamation} actif={[0, 5, 1].includes(Number(reclamation.etat ?? 0))} />
            </p>
            {Array.isArray(reclamation.checklist) && reclamation.checklist.length > 0 && (
              <details className="rcz-checklist" open>
                <summary>
                  <ClipboardCheck size={15} /> {t("Vérifications faites par le demandeur")}
                  <span className="rcz-checklist-compte">{reclamation.checklist.length}</span>
                </summary>
                <ul>
                  {reclamation.checklist.map((c, i) => (
                    <li key={i}>
                      <span>{c.question}</span>
                      <strong className={`rcz-ck-rep rcz-ck-rep--${String(c.reponse || '').toLowerCase().replace(/\s+/g, '-')}`}>{t(c.reponse || '—')}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <dl>
              {infos.map((i) => {
                const Icon = i.icon;
                return (
                  <div key={i.label} className={i.large ? 'rcz-large' : undefined}>
                    <dt><Icon size={14} /> {i.label}</dt>
                    <dd title={i.valeur}>{i.valeur}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        </div>

        <div className="bmz-col">
          <section className="bmz-carte bmz-vitaux" aria-label={t("En un coup d'œil")}>
            <h2 className="bmz-carte-titre">{t("En un coup d'œil")}</h2>
            <ul>
              {vitaux.map((v) => {
                const Icon = v.icon;
                const contenu = (
                  <>
                    <Icon size={15} className="bmz-vital-icone" />
                    <span className="bmz-vital-label">{t(v.label)}</span>
                    <span className={`bmz-vital-valeur bmz-point--${pointTon(v.ton)}`}>{t(v.valeur)}</span>
                  </>
                );
                return (
                  <li key={v.key}>
                    {v.onClick ? (
                      <button type="button" className="bmz-vital" onClick={v.onClick}>
                        {contenu}<ChevronRight size={15} className="bmz-fleche" />
                      </button>
                    ) : (
                      <div className="bmz-vital">{contenu}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bmz-carte rcz-bons" aria-label={t("Bons de maintenance liés")}>
            <div className="rcz-carte-tete">
              <h2 className="bmz-carte-titre">{t("Bon de maintenance lié")}</h2>
              {bons.length > 0 && (
                <button type="button" className="bmz-btn rcz-btn-petit" onClick={onAssocier}>
                  <LinkIcon size={14} /> {t("Associer un autre bon")}
                </button>
              )}
            </div>
            <div className="bmz-defile">
              {bons.length === 0 ? (
                <div className="rcz-vide">
                  <p>
                    {avantPriseEnCharge
                      ? t("Le bon de maintenance sera créé à la prise en charge de la réclamation.")
                      : t("Aucun bon de maintenance n’est lié à cette réclamation.")}
                  </p>
                  {reclamation.etat === ETAT.EN_COURS && (
                    <div className="bmz-maintenant-actions">
                      <button type="button" className="bmz-btn bmz-btn--plein" onClick={onCreerBon}>
                        <FilePlus size={15} /> {t("Créer un bon")}
                      </button>
                      <button type="button" className="bmz-btn" onClick={onAssocier}>
                        <LinkIcon size={15} /> {t("Associer un bon existant")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="rcz-bons-liste">
                  {bons.map((b) => {
                    const eb = ETAT_BON_EN_CLAIR[b.etat];
                    return (
                      <li key={b.id}>
                        <button type="button" className="rcz-bon" onClick={() => onOuvrirBon?.(b)}>
                          <Wrench size={16} className="bmz-rubrique-icone" />
                          <span className="rcz-bon-texte">
                            <span className="rcz-bon-num">{b.num || t('Bon #{id}', { id: b.id })}</span>
                            <span className="rcz-bon-titre">{b.titre || t("Ouvrir le bon pour voir son parcours")}</span>
                          </span>
                          {eb && <span className={`bmz-etat bmz-point--${pointTon(eb.ton)}`}>{t(eb.texte)}</span>}
                          <ChevronRight size={15} className="bmz-fleche" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="bmz-carte rcz-historique" aria-label={t("Historique de la réclamation")}>
            <h2 className="bmz-carte-titre"><History size={15} /> {t("Historique")}</h2>
            <div className="bmz-defile">
              {historique == null ? (
                <p className="rch-vide">{t("Chargement…")}</p>
              ) : historique.length === 0 ? (
                <p className="rch-vide">{t("Aucune affectation ni changement d’état enregistré pour l’instant.")}</p>
              ) : (
                <ol className="rch-liste">
                  {[...historique].reverse().map((h) => {
                    const l = ligneHistorique(h);
                    return (
                      <li key={h.id} className={`rch-item ${l.classe}`}>
                        <span className="rch-point" aria-hidden="true" />
                        <span className="rch-texte">
                          <span className="rch-titre">{t(l.titre)}</span>
                          {l.detail && <span className="rch-detail">{l.detail}</span>}
                          {h.commentaire && <span className="rch-commentaire">« {h.commentaire} »</span>}
                          <span className="rch-meta">{dateHeure(h.date)}{h.auteurNom ? ` · ${h.auteurNom}` : ''}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>

        {/* ===== Discussion en direct (demandeur, personne affectée, équipe du bon lié) ===== */}
        <section className="bmz-col bmz-carte rcz-chat" aria-label={t("Discussion")}>
          <div className="rcz-carte-tete">
            <h2 className="bmz-carte-titre">{t("Discussion")}</h2>
            <span className="rcz-chat-aide">{t("Demandeur, personne affectée et équipe du bon")}</span>
          </div>
          <div className="rcz-chat-corps">
            <BmdChat
              key={reclamation.id}
              bonId={reclamation.id}
              service={chatReclamationService}
              sujet="reclamation"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
