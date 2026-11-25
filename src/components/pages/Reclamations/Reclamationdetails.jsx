import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Megaphone,
  
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
  
  Inbox,
  ClipboardCheck,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { cheminLieu, lieuDeLigne } from '../../../services/lieuxCache';
import reclamationService from '../../../services/Reclamationservice';
import lectureService from '../../../services/lectureService';
import EtatLecture from '../../commun/EtatLecture';
import { DROITS, DROITS_ACTIONS_RECLAMATION, useDroits } from '../../../constants/privileges';
import { ETAT_REC, actionsPossibles, estAffectee, membresGroupe, reclamationVerrouillee, nomTechnicien, TYPES_HISTORIQUE } from './ReclamationActions';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { qrSvg, urlReclamation } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import BmdChat from '../bonmaintenance/BmdChat';
import { chatReclamationService } from '../../../services/chatBonService';
import '../bonmaintenance/BmdEpure.css';
import './Reclamationdetails.css';

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

const ETAPES_DEF = [
  { key: 'nouveau', label: 'Nouveau', aide: 'Le problème a été signalé', icon: Megaphone },
  { key: 'file', label: 'En file', aide: 'Affectée à un groupe ou un technicien', icon: UserCheck },
  { key: 'cours', label: 'En cours', aide: 'Prise en charge, bon de maintenance créé', icon: Wrench },
  { key: 'resolue', label: 'Résolue', aide: 'Le problème est réglé', icon: CheckCircle },
  { key: 'cloturee', label: 'Clôturée', aide: 'La demande est fermée', icon: Lock },
];

function indexEtape(r) {
  switch (r.etat ?? ETAT.NOUVEAU) {
    case ETAT.NOUVEAU: return 0;
    case ETAT.EN_FILE: return 1;
    case ETAT.EN_COURS: return 2;
    case ETAT.RESOLUE: return 3;
    case ETAT.CLOTUREE: return 4;
    default:
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

export default function ReclamationDetails({
  data,
  loading = false,
  validating = false,
  onBack,
  onModifier,
  onValider,
  onRejeter,
  onAction,
  onCreerBon,
  onAssocier,
  onOuvrirBon,
  libelleRetour,
  ongletInitial = null,
}) {
  const { reclamation, bons } = normaliser(data);
  const aDroit = useDroits();
  const resume = data?.__resume ?? null;
  const [equipement, setEquipement] = useState(null);
  const carteLieux = useCarteLieux();
  const [qrOuvert, setQrOuvert] = useState(false);
  const [onglet, setOnglet] = useState(ongletInitial || 'signalement');
  const [historique, setHistorique] = useState(null);
  const [lecture, setLecture] = useState(null);
  const titreRef = useRef(null);

  useEffect(() => {
    const id = reclamation?.id;
    if (resume) { setLecture(resume.lecture); return undefined; }
    setLecture(null);
    if (id == null) return undefined;
    let annule = false;
    lectureService.reclamation(id)
      .then((l) => {
        if (annule) return;
        setLecture(l);
        if (l?.nouvelle) reclamationService.historique(id).then((h) => { if (!annule) setHistorique(Array.isArray(h) ? h : []); }).catch(() => {});
      })
      .catch(() => { });
    return () => { annule = true; };
  }, [reclamation?.id, reclamation?.personnelAffecteId, resume]);

  useEffect(() => {
    const id = reclamation?.id;
    if (resume) { setHistorique(Array.isArray(resume.historique) ? resume.historique : []); return undefined; }
    if (id == null) return undefined;
    let annule = false;
    reclamationService.historique(id)
      .then((h) => { if (!annule) setHistorique(Array.isArray(h) ? h : []); })
      .catch(() => { if (!annule) setHistorique([]); });
    return () => { annule = true; };
  }, [reclamation?.id, reclamation?.etat, reclamation?.dateModification, resume]);

  useEffect(() => {
    const id = reclamation?.lotArticleImmobilistationId;
    if (resume && resume.equipement !== undefined) { setEquipement(resume.equipement); return undefined; }
    if (id == null) {
      setEquipement(null);
      return undefined;
    }
    let annule = false;
    lotArticleImmobilistationService.getById(id)
      .then((e) => { if (!annule) setEquipement(e); })
      .catch(() => { if (!annule) setEquipement(null); });
    return () => { annule = true; };
  }, [reclamation?.lotArticleImmobilistationId, resume]);

  useEffect(() => { if (!loading) titreRef.current?.focus(); }, [loading]);

  useEffect(() => { setOnglet('signalement'); }, [reclamation?.id]);

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
  const progression = reclamation.etat === ETAT.CLOTUREE ? 1 : Math.min(indexEtape(reclamation), ETAPES_DEF.length - 1) / (ETAPES_DEF.length - 1);
  const possibles = onAction ? actionsPossibles(reclamation, aDroit) : {};
  const permis = (b) => (b && aDroit(DROITS_ACTIONS_RECLAMATION[b.action]) ? b : null);
  const actionBrute = prochaineAction(reclamation, bons);
  const action = actionBrute && { ...actionBrute, bouton: permis(actionBrute.bouton), secondaire: permis(actionBrute.secondaire) };
  const ActionIcon = action?.icon;

  const personnel = nomTechnicien(reclamation) || null;
  const groupe = reclamation.groupeNom || null;
  const service = reclamation.serviceNom || reclamation.service?.description || null;
  const nomEquipement = equipement?.designation || null;
  const lieu = cheminLieu(carteLieux, lieuDeLigne(carteLieux, reclamation.lieuId, reclamation.lotArticleImmobilistationId)) || null;
  const titre = nomEquipement || lieu || t('Réclamation {num}', { num: reclamation.num || `#${reclamation.id}` });

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


  const avantPriseEnCharge = reclamation.etat == null || reclamation.etat === ETAT.NOUVEAU || reclamation.etat === ETAT.EN_FILE;

  const imprimerReclamation = async () => {
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
            { label: t('Lieu'), valeur: lieu },
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

  const pointTon = (ton) => (ton === 'alerte' ? 'alerte' : ton === 'attention' ? 'attention' : ton === 'ok' ? 'ok' : 'neutre');

  const verrouillee = reclamationVerrouillee(reclamation);
  const tuiles = [
    { key: 'criticite', icon: Gauge, label: t("Criticité"), valeur: criticite?.texte || 'Non définie', ton: criticite?.ton || 'neutre' },
    { key: 'urgence', icon: Flame, label: t("Urgence"), valeur: urgence?.texte || 'Non définie', ton: urgence?.ton || 'neutre' },
    { key: 'technicien', icon: personnel || !groupe ? User : Users, label: personnel || !groupe ? t("Technicien") : t("Groupe"),
      valeur: personnel || (membresGroupe(reclamation).length > 1 ? t('{n} personnes', { n: membresGroupe(reclamation).length }) : groupe) || t("Personne pour l’instant"),
      ton: personnel || groupe ? 'neutre' : 'attention' },
    { key: 'bon', icon: Wrench, label: t("Bon de maintenance"), valeur: bons.length === 0 ? 'Aucun' : (bons[0].num || `#${bons[0].id}`), ton: 'neutre', onglet: 'bon' },
  ];
  const groupesInfos = [
    {
      titre: t("Demande"),
      lignes: [
        { icon: Calendar, label: t("Date"), valeur: formatDate(reclamation.date) },
        { icon: Building2, label: t("Service"), valeur: service || '—' },
        reclamation.codePanneCode && { icon: Tag, label: t("Code panne"), valeur: `${reclamation.codePanneCode} · ${reclamation.codePanneLibelle || ''}`, large: true },
      ].filter(Boolean),
    },
    {
      titre: t("Équipement"),
      lignes: [
        { icon: Package, label: t("Équipement"), valeur: nomEquipement || '—' },
        { icon: MapPin, label: t("Lieu"), valeur: lieu || '—', large: true },
      ],
    },
    {
      titre: t("Affectation"),
      lignes: [
        { icon: User, label: t("Technicien"), valeur: personnel || t("Personne pour l’instant"), large: true,
          rendu: personnel ? (
            <span className="rcz-affecte">
              <span className="rcz-puce rcz-puce--tech"><User size={12} aria-hidden="true" /> {personnel}</span>
              {reclamation.dateAffectation && <small>{t('Affectée le {date}', { date: dateHeure(reclamation.dateAffectation) })}</small>}
            </span>
          ) : <span className="rcz-vide-txt">{t("Personne pour l’instant")}</span> },
        { icon: Users, label: membresGroupe(reclamation).length > 0 ? t('Groupe ({n})', { n: membresGroupe(reclamation).length }) : t("Groupe"),
          valeur: groupe || '—', large: true,
          rendu: membresGroupe(reclamation).length > 0 ? (
            <ul className="rcz-puces">
              {membresGroupe(reclamation).map((m) => (
                <li key={m.id} className="rcz-puce"><User size={12} aria-hidden="true" /> {m.nom || `#${m.id}`}</li>
              ))}
            </ul>
          ) : groupe ? <span className="rcz-puce">{groupe}</span> : <span className="rcz-vide-txt">—</span> },
      ],
    },
  ];
  const ONGLETS = [
    { key: 'signalement', icon: FileText, label: t("Signalement") },
    { key: 'bon', icon: Wrench, label: t("Bon de maintenance"), n: bons.length },
    { key: 'historique', icon: History, label: t("Historique"), n: historique?.length ?? null },
    { key: 'chat', icon: MessageCircle, label: t("Discussion"), n: null },
  ];

  const contenuOnglet = () => {
    switch (onglet) {
      case 'bon':
        return (
          <>
            {bons.length > 0 && !verrouillee && (
              <div className="rcz-carte-tete">
                <span />
                <button type="button" className="bmz-btn rcz-btn-petit" onClick={onAssocier}>
                  <LinkIcon size={14} /> {t("Associer un autre bon")}
                </button>
              </div>
            )}
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
          </>
        );
      case 'historique':
        return historique == null ? (
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
        );
      case 'chat':
        return (
          <div className="rcz-chat-corps rcz-chat-onglet">
            <BmdChat key={reclamation.id} bonId={reclamation.id} service={chatReclamationService} sujet="reclamation" />
          </div>
        );
      default:
        return (
          <>
            <p className="rcz-description">{reclamation.description || t("Aucune description n’a été saisie.")}</p>
            {reclamation.etat === ETAT.ANNULEE && (reclamation.motifAnnulation || reclamation.motifRejet) && (
              <p className="rcz-rejet"><AlertTriangle size={15} /> <span><strong>{t("Motif d’annulation")} :</strong> {reclamation.motifAnnulation || reclamation.motifRejet}</span></p>
            )}
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
          </>
        );
    }
  };

  return (
    <div className="rcx-page bmz-page bmz-page--onglets bmz-v4 rcz-page">
      <div className="bmz-haut">
      <header className="bmz-entete">
        <button type="button" className="bmz-retour" onClick={onBack}
          title={libelleRetour || t("Toutes les réclamations")} aria-label={libelleRetour || t("Toutes les réclamations")}>
          <ArrowLeft size={18} />
        </button>
        <div className="bmz-identite">
          <div className="bmz-identite-haut">
            <span className="bmz-num">{reclamation.num || t('Réclamation #{id}', { id: reclamation.id })}</span>
            <span className={`bmz-etat bmz-point--${pointTon(etatClair.ton)}`}>{t(etatClair.texte)}</span>
            {verrouillee && (
              <span className="bmz-lecture-seule" title={t('Cette réclamation est résolue, clôturée ou annulée : elle ne peut plus être modifiée.')}>
                <Lock size={12} aria-hidden="true" /> {t('Lecture seule')}
              </span>
            )}
          </div>
          <h1 className="bmz-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
          <p className="bmz-resume">
            {t("Déclarée le")} {formatDate(reclamation.date)}
            {joursDepuis(reclamation.date) ? t(', {quand}', { quand: joursDepuis(reclamation.date) }) : ''}
            {service ? t(', pour le service {service}', { service }) : ''}
          </p>
        </div>
        <div className="bmz-actions">
          <button type="button" className="bmz-btn" onClick={() => setOnglet('chat')} title={t("Discuter")}>
            <MessageCircle size={16} /> <span>{t("Discuter")}</span>
          </button>
          {possibles.affecter && (
            <button type="button" className="bmz-btn" onClick={() => onAction('affecter')} title={estAffectee(reclamation) ? t("Réaffecter") : t("Affecter")}>
              <UserCheck size={16} /> <span>{estAffectee(reclamation) ? t("Réaffecter") : t("Affecter")}</span>
            </button>
          )}
          {!verrouillee && aDroit(DROITS.RECLAMATION_AJOUTER) && (
            <button type="button" className="bmz-btn" onClick={onModifier} title={t("Modifier")}>
              <Edit size={16} /> <span>{t("Modifier")}</span>
            </button>
          )}
          {possibles.annuler && (
            <button type="button" className="bmz-btn" onClick={() => onAction('annuler')} title={t("Annuler la réclamation")}>
              <XCircle size={16} /> <span>{t("Annuler la réclamation")}</span>
            </button>
          )}
          <button type="button" className="bmz-btn" onClick={() => setQrOuvert(true)} title={t("QR code")}>
            <QrCode size={16} /> <span>{t("QR code")}</span>
          </button>
          <button type="button" className="bmz-btn" onClick={imprimerReclamation} title={t("Imprimer")}>
            <Printer size={16} /> <span>{t("Imprimer")}</span>
          </button>
        </div>
      </header>

      <section className="bmz-parcours" aria-label={t("Parcours de la réclamation")}>
        <ol className="bmz-ligne" style={{ '--bmz-p': progression, '--bmz-nb': ETAPES_DEF.length }}>
          {etapes.map((e) => {
            const Icon = e.statut === 'fait' ? Check : e.statut === 'probleme' ? XCircle : e.icon;
            return (
              <li key={e.key} className={`bmz-etape is-${e.statut}`}>
                <span className="bmz-etape-contenu" title={t(e.detail || e.aide)}>
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
      </div>

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

      <div className="bmz-plan">
      <div className="bmz-corps bmz-corps--sans-rapport">
        <div className="bmz-col">
          {action && (
            <section className={`bmz-carte bmz-maintenant bmz-maintenant--${action.ton} rcz-maintenant`} aria-label={t("À faire maintenant")}>
              <p className="bmz-surtitre"><ActionIcon size={15} /> {t("À faire maintenant")}</p>
              <h2 className="bmz-maintenant-titre">{t(action.titre)}</h2>
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
            <h2 className="bmz-carte-titre">{t("Informations")}</h2>

            <div className="bmz-infos-bloc" aria-label={t("En un coup d'œil")}>
              <h3 className="bmz-sous-titre">{t("En un coup d'œil")}</h3>
              <ul className="bmz-tuiles">
                {tuiles.map((v) => {
                  const Icon = v.icon;
                  const contenu = (
                    <>
                      <span className="bmz-tuile-label"><Icon size={14} /> {t(v.label)}</span>
                      <span className={`bmz-tuile-valeur bmz-point--${pointTon(v.ton)}`} title={t(v.valeur)}>{t(v.valeur)}</span>
                      {v.onglet && <ChevronRight size={14} className="bmz-tuile-fleche" />}
                    </>
                  );
                  return (
                    <li key={v.key}>
                      {v.onglet ? (
                        <button type="button" className="bmz-tuile is-cliquable" onClick={() => setOnglet(v.onglet)}>{contenu}</button>
                      ) : (
                        <div className="bmz-tuile">{contenu}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="bmz-lecture">
                <EtatLecture objet={lecture ?? reclamation} actif={[0, 5, 1].includes(Number(reclamation.etat ?? 0))} />
              </p>
            </div>

            <div className="bmz-infos-bloc">
              <h3 className="bmz-sous-titre">{t("Détails de la réclamation")}</h3>
              {groupesInfos.map((g) => (
                <div key={g.titre} className="bmz-info-groupe">
                  <h4>{g.titre}</h4>
                  <dl>
                    {g.lignes.map((i) => {
                      const Icon = i.icon;
                      return (
                        <div key={i.label} className={i.large ? 'rcz-large' : undefined}>
                          <dt><Icon size={13} /> {i.label}</dt>
                          <dd title={typeof i.valeur === 'string' ? i.valeur : undefined}>{i.rendu ?? i.valeur}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="bmz-carte bmz-do" aria-label={t('Dossier')}>
        <div className="bmz-do-barre" role="tablist" aria-label={t('Dossier')}>
          {ONGLETS.map((o) => {
            const Icon = o.icon;
            const actif = onglet === o.key;
            return (
              <button key={o.key} type="button" role="tab" aria-selected={actif}
                className={`bmz-do-onglet ${actif ? 'is-actif' : ''}`} onClick={() => setOnglet(o.key)}>
                <Icon size={15} aria-hidden="true" />
                <span>{o.label}</span>
                {o.n != null && <span className="bmz-nb">{o.n}</span>}
              </button>
            );
          })}
        </div>
        <div className={`bmz-do-contenu ${onglet === 'chat' ? 'rcz-do-chat' : ''}`} role="tabpanel">
          {contenuOnglet()}
        </div>
      </section>
      </div>
    </div>
  );
}
