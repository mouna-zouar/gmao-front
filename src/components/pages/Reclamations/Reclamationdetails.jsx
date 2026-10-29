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
} from 'lucide-react';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { qrSvg, urlReclamation } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import BmdChat from '../bonmaintenance/BmdChat';
import { chatReclamationService } from '../../../services/chatBonService';
import '../bonmaintenance/BmdEpure.css';
import './ReclamationDetails.css';

// États de la réclamation (identiques à Reclamations.jsx)
const ETAT = { OUVERTE: 0, EN_COURS: 1, CLOTUREE: 2, ATTENTE: 3, REJETEE: 4 };

const ETAT_EN_CLAIR = {
  0: { texte: 'Ouverte', ton: 'alerte' },
  1: { texte: 'En cours', ton: 'action' },
  2: { texte: 'Clôturée', ton: 'ok' },
  3: { texte: 'À valider', ton: 'attention' },
  4: { texte: 'Rejetée', ton: 'neutre' },
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
// Parcours : Déclarée → Validation → Réparation → Clôturée
// ------------------------------------------------------------
const ETAPES_DEF = [
  { key: 'declaree', label: 'Déclarée', aide: 'Le problème a été signalé', icon: Megaphone },
  { key: 'validation', label: 'Validation', aide: 'On vérifie que la demande est justifiée', icon: ShieldQuestion },
  { key: 'reparation', label: 'Réparation', aide: 'Un bon de maintenance est en cours', icon: Wrench },
  { key: 'cloturee', label: 'Clôturée', aide: 'La demande est traitée', icon: CheckCircle },
];

function construireParcours(reclamation, bons) {
  const etat = reclamation.etat;
  let indexActuel = 1;
  let probleme = false;
  if (etat === ETAT.EN_COURS) indexActuel = 2;
  if (etat === ETAT.CLOTUREE) indexActuel = ETAPES_DEF.length;
  if (etat === ETAT.REJETEE) { indexActuel = 1; probleme = true; }

  const details = {
    declaree: formatDate(reclamation.date),
    validation: etat === ETAT.REJETEE ? 'Rejetée' : (indexActuel > 1 ? 'Validée' : (etat === ETAT.ATTENTE ? 'En attente' : null)),
    reparation: bons.length > 0 ? tp('bon', bons.length) : null,
    cloturee: etat === ETAT.CLOTUREE ? 'Terminée' : null,
  };

  return ETAPES_DEF.map((def, i) => {
    let statut = 'avenir';
    if (i < indexActuel) statut = 'fait';
    else if (i === indexActuel) statut = probleme ? 'probleme' : 'actuel';
    if (etat === ETAT.REJETEE && i > indexActuel) statut = 'barre';
    return { ...def, statut, detail: details[def.key] };
  });
}

function prochaineAction(reclamation, bons) {
  switch (reclamation.etat) {
    case ETAT.OUVERTE:
    case ETAT.ATTENTE:
      return {
        ton: 'action',
        icon: ShieldQuestion,
        titre: reclamation.etat === ETAT.ATTENTE ? 'Cette réclamation attend votre validation' : 'Vérifiez cette réclamation',
        texte: t("Si le problème est réel, validez-la : la réparation pourra commencer. Sinon, rejetez-la en expliquant pourquoi."),
        bouton: { label: t("Valider la réclamation"), action: 'valider' },
        secondaire: { label: t("Rejeter"), action: 'rejeter' },
      };
    case ETAT.EN_COURS:
      if (bons.length > 0) {
        return {
          ton: 'action',
          icon: Wrench,
          titre: t("La réparation est en cours"),
          texte: t("Suivez l’avancement dans le bon de maintenance. La réclamation se clôture quand la réparation est finie."),
          bouton: { label: t('Suivre le bon {num}', { num: bons[0].num || '' }).trim(), action: 'ouvrirBon', bon: bons[0] },
        };
      }
      return {
        ton: 'action',
        icon: FilePlus,
        titre: t("Lancez la réparation"),
        texte: t("Aucun bon de maintenance n’est lié. Créez-en un, ou rattachez un bon qui existe déjà."),
        bouton: { label: t("Créer un bon de maintenance"), action: 'creerBon' },
        secondaire: { label: t("Associer un bon existant"), action: 'associer' },
      };
    case ETAT.CLOTUREE:
      return {
        ton: 'fini',
        icon: CheckCircle,
        titre: t("Réclamation traitée"),
        texte: t("Le problème a été réparé et la demande est fermée."),
        bouton: bons.length > 0 ? { label: t("Revoir le bon de maintenance"), action: 'ouvrirBon', bon: bons[0] } : null,
      };
    case ETAT.REJETEE:
      return {
        ton: 'neutre',
        icon: Ban,
        titre: t("Réclamation rejetée"),
        texte: reclamation.motifRejet
          ? t('Motif : {motif}', { motif: reclamation.motifRejet })
          : 'Aucune réparation ne sera lancée pour cette demande.',
        bouton: { label: t("Modifier la réclamation"), action: 'modifier' },
      };
    default:
      return null;
  }
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
  onCreerBon,
  onAssocier,
  onOuvrirBon,
  libelleRetour, // texte du bouton retour (ex. « Retour à mon espace »)
}) {
  const { reclamation, bons } = normaliser(data);
  const [equipement, setEquipement] = useState(null);
  const [aideMasquee, setAideMasquee] = useState(lireAideMasquee);
  const [qrOuvert, setQrOuvert] = useState(false);
  const titreRef = useRef(null);

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
  const nbFaites = etapes.filter((e) => e.statut === 'fait').length;
  // La barre remplie va jusqu'à l'étape en cours
  const progression = reclamation.etat === ETAT.CLOTUREE ? 1 : Math.min(nbFaites, ETAPES_DEF.length - 1) / (ETAPES_DEF.length - 1);
  const action = prochaineAction(reclamation, bons);
  const ActionIcon = action?.icon;

  const personnel = reclamation.personnelAffecte
    ? `${reclamation.personnelAffecte.nom ?? ''} ${reclamation.personnelAffecte.prenom ?? ''}`.trim()
    : (reclamation.personnelAffecteNom || null);
  const service = reclamation.serviceNom || reclamation.service?.description || null;
  const nomEquipement = equipement?.designation || null;
  const titre = nomEquipement || t('Réclamation {num}', { num: reclamation.num || `#${reclamation.id}` });

  const executer = (a) => {
    if (!a) return;
    switch (a.action) {
      case 'valider': onValider?.(); break;
      case 'rejeter': onRejeter?.(); break;
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

  const enAttente = reclamation.etat === ETAT.OUVERTE || reclamation.etat === ETAT.ATTENTE;

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
            { label: t('Personne affectée'), valeur: personnel || t('Personne pour l’instant') },
            { label: t('Criticité'), valeur: t(criticite?.texte || 'Non définie') },
            { label: t('Urgence'), valeur: t(urgence?.texte || 'Non définie') },
            reclamation.codePanneCode && { label: t('Code panne'), valeur: `${reclamation.codePanneCode} · ${reclamation.codePanneLibelle || ''}` },
          ],
        },
        { titre: t('Ce qui a été signalé'), texte: reclamation.description || t('Aucune description n’a été saisie.') },
        reclamation.etat === ETAT.REJETEE && { titre: t('Motif du rejet'), texte: reclamation.motifRejet },
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
    { icon: User, label: t("Personne affectée"), valeur: personnel || t("Personne pour l’instant") },
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
          <button type="button" className="bmz-btn" onClick={onModifier}>
            <Edit size={16} /> <span>{t("Modifier")}</span>
          </button>
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
            : reclamation.etat === ETAT.REJETEE ? t("Arrêté à la validation")
              : t('Étape {n} sur {total}', { n: Math.min(nbFaites + 1, ETAPES_DEF.length), total: ETAPES_DEF.length })}
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
                    <button type="button" className="bmz-btn bmz-btn--plein" onClick={() => executer(action.bouton)} disabled={validating && enAttente}>
                      {validating && enAttente ? <Loader2 size={15} className="rcx-tourne" /> : null}
                      {t(action.bouton.label)}
                    </button>
                  )}
                  {action.secondaire && (
                    <button type="button" className="bmz-btn" onClick={() => executer(action.secondaire)} disabled={validating && enAttente}>
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
            {reclamation.etat === ETAT.REJETEE && reclamation.motifRejet && (
              <p className="rcz-rejet"><AlertTriangle size={15} /> <span><strong>{t("Motif du rejet")} :</strong> {reclamation.motifRejet}</span></p>
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
                    {enAttente
                      ? t("Le bon de maintenance sera créé après la validation de la réclamation.")
                      : t("Aucun bon de maintenance n’est lié à cette réclamation.")}
                  </p>
                  {!enAttente && reclamation.etat !== ETAT.REJETEE && (
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
