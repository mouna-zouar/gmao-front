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
} from 'lucide-react';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import { t, tp, locale } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { qrSvg, urlReclamation } from '../../../utils/qrCode';
import ModaleQrCode from '../../ui/QrCode/ModaleQrCode';
import BmdChat from '../bonmaintenance/BmdChat';
import { chatReclamationService } from '../../../services/chatBonService';
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
  const progression = reclamation.etat === ETAT.CLOTUREE ? 1 : Math.max(nbFaites - 1, 0) / (ETAPES_DEF.length - 1);
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

  return (
    <div className="rcx-page">
      {/* ===== Barre du haut ===== */}
      <div className="rcx-barre">
        <button type="button" className="rcx-btn rcx-btn--clair" onClick={onBack}>
          <ArrowLeft size={18} /> {libelleRetour || t("Toutes les réclamations")}
        </button>
        <div className="rcx-barre-droite">
          {aideMasquee && (
            <button
              type="button"
              className="rcx-btn rcx-btn--fantome"
              onClick={() => { setAideMasquee(false); ecrireAideMasquee(false); }}
            >
              <HelpCircle size={18} /> {t("Comment ça marche ?")}
            </button>
          )}
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={onModifier}>
            <Edit size={17} /> {t("Modifier")}
          </button>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={() => setQrOuvert(true)}>
            <QrCode size={17} /> {t("QR code")}
          </button>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={imprimerReclamation}>
            <Printer size={17} /> {t("Imprimer la fiche")}
          </button>
        </div>
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

      {/* ===== PARTIE 1 : la réclamation, en clair ===== */}
      <section className="rcx-identite" aria-label={t("Informations générales de la réclamation")}>
        <div className={`rcx-bracelet rcx-ton--${etatClair.ton}`}>
          <span className="rcx-bracelet-etat">{t(etatClair.texte)}</span>
          <span className="rcx-bracelet-num">{reclamation.num || t('Réclamation #{id}', { id: reclamation.id })}</span>
          <span className="rcx-bracelet-trou" aria-hidden="true" />
        </div>

        <h1 className="rcx-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
        <p className="rcx-resume">
          {t("Déclarée le")} {formatDate(reclamation.date)}
          {joursDepuis(reclamation.date) ? t(', {quand}', { quand: joursDepuis(reclamation.date) }) : ''}
          {service ? t(', pour le service {service}', { service }) : ''}{t('.')}
        </p>

        <figure className="rcx-citation">
          <figcaption>{t("Ce qui a été signalé")}</figcaption>
          <blockquote>{reclamation.description || t("Aucune description n’a été saisie.")}</blockquote>
        </figure>

        <dl className="rcx-fiche">
          <div><dt><Building2 size={15} /> {t("Service")}</dt><dd>{service || '—'}</dd></div>
          <div><dt><User size={15} /> {t("Personne affectée")}</dt><dd>{personnel || t("Personne pour l’instant")}</dd></div>
          <div><dt><Calendar size={15} /> {t("Date")}</dt><dd>{formatDate(reclamation.date)}</dd></div>
          {nomEquipement && (
            <div><dt><Package size={15} /> {t("Équipement")}</dt><dd>{nomEquipement}</dd></div>
          )}
        </dl>
      </section>

      {/* ===== Deux colonnes : le suivi à gauche, l'essentiel et la discussion à droite ===== */}
      <div className="rcx-grille">
      <div className="rcx-col-principale">

      {!aideMasquee && (
        <section className="rcx-aide" aria-label={t("Aide")}>
          <div>
            <h2>{t("Comment lire cette page ?")}</h2>
            <ol>
              <li>{t("La ligne du parcours montre où en est la demande.")}</li>
              <li>{t("Le bloc foncé vous dit quoi faire maintenant.")}</li>
              <li>{t("En bas, retrouvez le bon de maintenance lié à cette réclamation.")}</li>
            </ol>
          </div>
          <button
            type="button"
            className="rcx-btn rcx-btn--clair"
            onClick={() => { setAideMasquee(true); ecrireAideMasquee(true); }}
          >
            <Check size={16} /> {t("J'ai compris")}
          </button>
        </section>
      )}

      {/* ===== PARTIE 2 : le parcours ===== */}
      <section className="rcx-parcours" aria-label={t("Parcours de la réclamation")}>
        <div className="rcx-parcours-entete">
          <h2>{t("Parcours de la demande")}</h2>
          <span className="rcx-parcours-compte">
            {reclamation.etat === ETAT.CLOTUREE ? t("Terminé")
              : reclamation.etat === ETAT.REJETEE ? t("Arrêté à la validation")
                : t('Étape {n} sur {total}', { n: Math.min(nbFaites + 1, ETAPES_DEF.length), total: ETAPES_DEF.length })}
          </span>
        </div>

        <ol className="rcx-ligne" style={{ '--rcx-p': progression }}>
          {etapes.map((e) => {
            const Icon = e.statut === 'fait' ? Check : e.statut === 'probleme' ? XCircle : e.icon;
            return (
              <li key={e.key} className={`rcx-station is-${e.statut}`}>
                <span className="rcx-station-point" aria-hidden="true"><Icon size={18} strokeWidth={2.4} /></span>
                <span className="rcx-station-nom">{t(e.label)}</span>
                <span className="rcx-station-aide">{t(e.detail || e.aide)}</span>
                {(e.statut === 'actuel' || e.statut === 'probleme') && <span className="rcx-sr">{t("Étape actuelle")}</span>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ===== À faire maintenant ===== */}
      <div className="rcx-duo rcx-duo--seul">
        {action && (
          <section className={`rcx-maintenant rcx-maintenant--${action.ton}`} aria-label={t("À faire maintenant")}>
            <span className="rcx-maintenant-icone"><ActionIcon size={26} /></span>
            <p className="rcx-maintenant-sur">{t("À faire maintenant")}</p>
            <h2 className="rcx-maintenant-titre">{t(action.titre)}</h2>
            <p className="rcx-maintenant-texte">{t(action.texte)}</p>
            {(action.bouton || action.secondaire) && (
              <div className="rcx-maintenant-actions">
                {action.bouton && (
                  <button
                    type="button"
                    className="rcx-btn rcx-btn--principal"
                    onClick={() => executer(action.bouton)}
                    disabled={validating && enAttente}
                  >
                    {validating && enAttente ? <Loader2 size={18} className="rcx-tourne" /> : null}
                    {t(action.bouton.label)}
                  </button>
                )}
                {action.secondaire && (
                  <button
                    type="button"
                    className="rcx-btn rcx-btn--sur-fonce"
                    onClick={() => executer(action.secondaire)}
                    disabled={validating && enAttente}
                  >
                    {t(action.secondaire.label)}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

      </div>

      {/* ===== Motif de rejet ===== */}
      {reclamation.etat === ETAT.REJETEE && reclamation.motifRejet && (
        <section className="rcx-rejet" aria-label={t("Motif du rejet")}>
          <AlertTriangle size={20} />
          <div>
            <h2>{t("Pourquoi elle a été rejetée")}</h2>
            <p>{reclamation.motifRejet}</p>
          </div>
        </section>
      )}

      {/* ===== Bons de maintenance liés ===== */}
      <section className="rcx-bons" aria-label={t("Bons de maintenance liés")}>
        <div className="rcx-bons-entete">
          <h2>{t("Bon de maintenance lié")}</h2>
          {bons.length > 0 && (
            <button type="button" className="rcx-btn rcx-btn--fantome" onClick={onAssocier}>
              <LinkIcon size={17} /> {t("Associer un autre bon")}
            </button>
          )}
        </div>

        {bons.length === 0 ? (
          <div className="rcx-vide">
            <p>
              {enAttente
                ? t("Le bon de maintenance sera créé après la validation de la réclamation.")
                : t("Aucun bon de maintenance n’est lié à cette réclamation.")}
            </p>
            {!enAttente && reclamation.etat !== ETAT.REJETEE && (
              <div className="rcx-vide-actions">
                <button type="button" className="rcx-btn rcx-btn--plein" onClick={onCreerBon}>
                  <FilePlus size={17} /> {t("Créer un bon")}
                </button>
                <button type="button" className="rcx-btn rcx-btn--clair" onClick={onAssocier}>
                  <LinkIcon size={17} /> {t("Associer un bon existant")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="rcx-bons-liste">
            {bons.map((b) => {
              const eb = ETAT_BON_EN_CLAIR[b.etat];
              return (
                <li key={b.id}>
                  <button type="button" className="rcx-bon" onClick={() => onOuvrirBon?.(b)}>
                    <span className="rcx-bon-icone"><Wrench size={20} /></span>
                    <span className="rcx-bon-texte">
                      <span className="rcx-bon-num">{b.num || t('Bon #{id}', { id: b.id })}</span>
                      <span className="rcx-bon-titre">{b.titre || t("Ouvrir le bon pour voir son parcours")}</span>
                    </span>
                    {eb && <span className={`rcx-pastille rcx-ton--${eb.ton}`}>{t(eb.texte)}</span>}
                    {b.date && <span className="rcx-bon-date">{formatDate(b.date)}</span>}
                    <span className="rcx-bon-ouvrir">{t("Ouvrir")} <ChevronRight size={16} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      </div>

      <aside className="rcx-col-cote">
        <section className="rcx-vitaux" aria-label={t("En un coup d'œil")}>
          <h2>{t("En un coup d'œil")}</h2>
          <ul>
            {vitaux.map((v) => {
              const Icon = v.icon;
              const contenu = (
                <>
                  <span className="rcx-vital-icone"><Icon size={17} /></span>
                  <span className="rcx-vital-label">{t(v.label)}</span>
                  <span className={`rcx-vital-valeur rcx-ton--${v.ton}`}>{t(v.valeur)}</span>
                </>
              );
              return (
                <li key={v.key}>
                  {v.onClick ? (
                    <button type="button" className="rcx-vital" onClick={v.onClick}>
                      {contenu}
                      <ChevronRight size={16} className="rcx-vital-fleche" />
                    </button>
                  ) : (
                    <div className="rcx-vital">{contenu}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

      {/* ===== Discussion en direct (demandeur, personne affectée, équipe du bon lié) ===== */}
      <section className="rcx-chat" aria-label={t("Discussion")}>
        <div className="rcx-chat-entete">
          <h2>{t("Discussion")}</h2>
          <span>{t("Demandeur, personne affectée et équipe du bon")}</span>
        </div>
        <BmdChat
          key={reclamation.id}
          bonId={reclamation.id}
          service={chatReclamationService}
          sujet="reclamation"
        />
      </section>
      </aside>
      </div>
    </div>
  );
}