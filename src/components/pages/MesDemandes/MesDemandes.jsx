import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, UserCheck, Wrench, CheckCircle2, PauseCircle, XCircle, Ban,
  Plus, RefreshCw, AlertCircle, Inbox, Users, Building2, Monitor, ExternalLink, ChevronDown,
} from 'lucide-react';
import suiviDemandeService from '../../../services/suiviDemandeService';
import reclamationService from '../../../services/Reclamationservice';
import authService from '../../../services/Authservice';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import ReclamationCreeeModal from '../../ui/modals/ReclamationCreeeModal';
import { t, locale } from '../../../i18n';
import './MesDemandes.css';


const PARCOURS = [
  { cle: 'ENVOYEE', libelle: 'Envoyée', Icone: Send },
  { cle: 'PRISE_EN_CHARGE', libelle: 'Prise en charge', Icone: UserCheck },
  { cle: 'EN_REPARATION', libelle: 'En réparation', Icone: Wrench },
  { cle: 'REPAREE', libelle: 'Réparée', Icone: CheckCircle2 },
];

const ETAPES = {
  ENVOYEE: { libelle: 'Envoyée', ton: 'bleu', Icone: Send, phrase: 'Votre demande est arrivée au service maintenance.' },
  PRISE_EN_CHARGE: { libelle: 'Prise en charge', ton: 'indigo', Icone: UserCheck, phrase: 'Le service maintenance a pris votre demande en main.' },
  EN_REPARATION: { libelle: 'En réparation', ton: 'ambre', Icone: Wrench, phrase: 'Un technicien intervient sur l\'équipement.' },
  EN_PAUSE: { libelle: 'En attente', ton: 'orange', Icone: PauseCircle, phrase: 'La réparation est en pause.' },
  REPAREE: { libelle: 'Réparée', ton: 'vert', Icone: CheckCircle2, phrase: 'La réparation est terminée.' },
  REFUSEE: { libelle: 'Refusée', ton: 'rouge', Icone: XCircle, phrase: 'Votre demande a été refusée.' },
  ANNULEE: { libelle: 'Annulée', ton: 'gris', Icone: Ban, phrase: 'La demande a été annulée par le service maintenance.' },
};

const TERMINEES = new Set(['REPAREE', 'REFUSEE', 'ANNULEE']);

const FILTRES = [
  { cle: 'en-cours', libelle: 'En cours' },
  { cle: 'terminees', libelle: 'Terminées' },
  { cle: 'toutes', libelle: 'Toutes' },
];

function formaterDate(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Rang de l'étape dans le parcours normal ; la pause se situe pendant la réparation. */
function rang(etape) {
  if (etape === 'EN_PAUSE') return 2;
  const i = PARCOURS.findIndex((p) => p.cle === etape);
  return i < 0 ? 0 : i;
}

function personnelConnecte() {
  const u = authService.getCurrentUser();
  return u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
}

/* ───────────────────────── Frise des étapes ───────────────────────── */

function Frise({ demande }) {
  const etape = demande.etape;
  const interrompue = etape === 'REFUSEE' || etape === 'ANNULEE';
  const courant = rang(etape);
  const dates = {
    ENVOYEE: demande.dateDemande,
    EN_REPARATION: demande.datePriseEnCharge,
    REPAREE: demande.dateReparation,
  };

  return (
    <ol className={`md-frise${interrompue ? ' md-frise--interrompue' : ''}`} aria-label={t('Avancement de la demande')}>
      {PARCOURS.map((p, i) => {
        let statut = 'avenir';
        if (!interrompue) {
          if (i < courant || etape === 'REPAREE') statut = 'fait';
          else if (i === courant) statut = etape === 'EN_PAUSE' ? 'pause' : 'courant';
        } else if (i === 0) {
          statut = 'fait';
        }
        const Icone = statut === 'pause' ? PauseCircle : p.Icone;
        const date = statut !== 'avenir' ? formaterDate(dates[p.cle]) : null;
        return (
          <li key={p.cle} className={`md-frise__etape md-frise__etape--${statut}`} aria-current={statut === 'courant' || statut === 'pause' ? 'step' : undefined}>
            <span className="md-frise__pastille"><Icone size={15} aria-hidden="true" /></span>
            <span className="md-frise__libelle">{statut === 'pause' ? t('En attente') : t(p.libelle)}</span>
            {date && <span className="md-frise__date">{date}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── Barre d'avancement (compacte) ───────────────────────── */

function Avancement({ demande, info }) {
  const etape = demande.etape;
  const interrompue = etape === 'REFUSEE' || etape === 'ANNULEE';
  const courant = rang(etape);
  return (
    <div className="md-avancement">
      <div className="md-avancement__barre" aria-hidden="true">
        {PARCOURS.map((p, i) => {
          let etat = 'avenir';
          if (interrompue) etat = i === 0 ? 'fait' : 'coupe';
          else if (etape === 'REPAREE' || i < courant) etat = 'fait';
          else if (i === courant) etat = 'courant';
          return <span key={p.cle} className={`md-segment md-segment--${etat}`} />;
        })}
      </div>
      <span className="md-avancement__texte">
        {interrompue
          ? t(info.libelle)
          : t('Étape {n} sur {total}', { n: courant + 1, total: PARCOURS.length }) + ' · ' + t(info.libelle)}
      </span>
    </div>
  );
}

/* ───────────────────────── Ligne d'une demande ───────────────────────── */

function CarteDemande({ demande, miseEnAvant, refCarte, onOuvrir }) {
  const info = ETAPES[demande.etape] ?? ETAPES.ENVOYEE;
  const { Icone } = info;
  const motif = demande.etape === 'REFUSEE' ? demande.motifRejet : demande.etape === 'EN_PAUSE' ? demande.bonMotif : null;
  const [ouverte, setOuverte] = useState(miseEnAvant);
  useEffect(() => { if (miseEnAvant) setOuverte(true); }, [miseEnAvant]);
  const idDetail = `md-detail-${demande.reclamationId}`;

  return (
    <article
      ref={refCarte}
      className={`md-carte md-carte--${info.ton}${miseEnAvant ? ' md-carte--mise-en-avant' : ''}${ouverte ? ' md-carte--ouverte' : ''}`}
    >
      <div className="md-ligne">
        <span className="md-ligne__icone" aria-hidden="true"><Icone size={20} /></span>

        <div className="md-ligne__corps">
          <div className="md-ligne__ref">
            <strong>{demande.reclamationNum || t('Sans numéro')}</strong>
            <span>{formaterDate(demande.dateDemande)}</span>
          </div>
          <h4 className="md-ligne__texte">{demande.description || t('Sans description')}</h4>
          {(demande.equipementDesignation || demande.serviceNom) && (
            <div className="md-ligne__meta">
              {demande.equipementDesignation && (
                <span><Monitor size={13} aria-hidden="true" />{demande.equipementDesignation}</span>
              )}
              {demande.serviceNom && (
                <span><Building2 size={13} aria-hidden="true" />{demande.serviceNom}</span>
              )}
            </div>
          )}
          <Avancement demande={demande} info={info} />
          {motif && (
            <p className="md-carte__motif">
              <strong>{demande.etape === 'REFUSEE' ? t('Motif du refus :') : t('Raison :')}</strong> {motif}
            </p>
          )}
        </div>

        <div className="md-ligne__actions">
          <span className={`md-badge md-badge--${info.ton}`}>
            <Icone size={14} aria-hidden="true" />
            {t(info.libelle)}
          </span>
          <div className="md-ligne__boutons">
            <button
              type="button"
              className="md-bouton-ico"
              onClick={() => setOuverte((o) => !o)}
              aria-expanded={ouverte}
              aria-controls={idDetail}
              title={ouverte ? t('Masquer le détail') : t('Voir le détail')}
              aria-label={ouverte ? t('Masquer le détail') : t('Voir le détail')}
            >
              <ChevronDown size={18} className="md-chevron" aria-hidden="true" />
            </button>
            {onOuvrir && (
              <button type="button" className="md-bouton md-bouton--principal md-bouton--petit" onClick={() => onOuvrir(demande.reclamationId)}>
                <ExternalLink size={14} aria-hidden="true" />
                {t('Ouvrir')}
              </button>
            )}
          </div>
        </div>
      </div>

      {ouverte && (
        <div className="md-detail" id={idDetail}>
          <p className="md-carte__phrase">{t(info.phrase)}</p>
          <Frise demande={demande} />
          {(demande.bonNum || demande.intervenants?.length > 0) && (
            <dl className="md-carte__infos">
              {demande.bonNum && (
                <div><dt><Wrench size={14} aria-hidden="true" />{t('Bon de maintenance')}</dt><dd>{demande.bonNum}</dd></div>
              )}
              {demande.intervenants?.length > 0 && (
                <div><dt><Users size={14} aria-hidden="true" />{t('Intervenant(s)')}</dt><dd>{demande.intervenants.join(', ')}</dd></div>
              )}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function MesDemandes({ integre = false, onCharge, onOuvrir } = {}) {
  const [searchParams] = useSearchParams();
  const demandeCible = Number(searchParams.get('demande')) || null;

  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('en-cours');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [reclamationCreee, setReclamationCreee] = useState(null);
  const refCible = useRef(null);
  const personnelId = personnelConnecte();

  const charger = useCallback(async ({ silencieux = false } = {}) => {
    if (personnelId == null) {
      setChargement(false);
      return;
    }
    if (!silencieux) setChargement(true);
    setErreur(null);
    try {
      const liste = await suiviDemandeService.getMesDemandes(personnelId);
      setDemandes(liste);
      onCharge?.(liste);
    } catch (e) {
      console.error(e);
      setErreur(t('Impossible de charger vos demandes. Vérifiez que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, [personnelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger(); }, [charger]);

  // Revenir sur l'onglet met la liste à jour (la réparation a pu avancer entre-temps)
  useEffect(() => {
    const auRetour = () => { if (document.visibilityState === 'visible') charger({ silencieux: true }); };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [charger]);

  // Ouverte depuis une notification : afficher la demande visée, même si elle est terminée
  useEffect(() => {
    if (!demandeCible || demandes.length === 0) return;
    const cible = demandes.find((d) => d.reclamationId === demandeCible);
    if (cible && TERMINEES.has(cible.etape)) setFiltre((f) => (f === 'en-cours' ? 'toutes' : f));
  }, [demandeCible, demandes]);

  useEffect(() => {
    if (refCible.current) refCible.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [demandes, filtre]);

  const compteurs = useMemo(() => {
    const terminees = demandes.filter((d) => TERMINEES.has(d.etape)).length;
    return { 'en-cours': demandes.length - terminees, terminees, toutes: demandes.length };
  }, [demandes]);

  const visibles = useMemo(() => demandes.filter((d) => {
    if (filtre === 'en-cours') return !TERMINEES.has(d.etape);
    if (filtre === 'terminees') return TERMINEES.has(d.etape);
    return true;
  }), [demandes, filtre]);

  const enregistrer = async (payload) => {
    const creee = await reclamationService.create(payload);
    setReclamationCreee(creee || {});
    setFiltre('en-cours');
    await charger({ silencieux: true });
  };

  const filtres = (
    <div className="md-filtres" role="tablist" aria-label={t('Filtrer les demandes')}>
      {FILTRES.map((f) => (
        <button
          key={f.cle}
          type="button"
          role="tab"
          aria-selected={filtre === f.cle}
          className={`md-filtre${filtre === f.cle ? ' md-filtre--actif' : ''}`}
          onClick={() => setFiltre(f.cle)}
        >
          {t(f.libelle)}
          <span className="md-filtre__compte">{compteurs[f.cle]}</span>
        </button>
      ))}
    </div>
  );

  const actions = (
    <div className="md-entete__actions">
      <button type="button" className="md-bouton md-bouton--secondaire" onClick={() => charger()} disabled={chargement}>
        <RefreshCw size={16} aria-hidden="true" className={chargement ? 'md-tourne' : undefined} />
        {t('Actualiser')}
      </button>
      <button type="button" className="md-bouton md-bouton--principal" onClick={() => setModalOuvert(true)}>
        <Plus size={16} aria-hidden="true" />
        {t('Signaler une panne')}
      </button>
    </div>
  );

  return (
    <div className={`md-page${integre ? ' md-page--integre' : ''}`}>
      {integre ? (
        <div className="md-barre">
          {filtres}
          {actions}
        </div>
      ) : (
        <>
          <header className="md-entete">
            <div>
              <span className="md-entete__surtitre">{t('Demandes')}</span>
              <h1>{t('Mes demandes')}</h1>
              <p>{t('Suivez vos signalements de panne jusqu\'à la réparation.')}</p>
            </div>
            {actions}
          </header>
          {filtres}
        </>
      )}


      {erreur && (
        <div className="md-erreur" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{erreur}</span>
        </div>
      )}

      {personnelId == null ? (
        <div className="md-vide">
          <Inbox size={36} aria-hidden="true" />
          <p>{t('Votre compte n\'est pas rattaché à une fiche du personnel : vos demandes ne peuvent pas être retrouvées.')}</p>
        </div>
      ) : chargement && demandes.length === 0 ? (
        <div className="md-liste">
          {[0, 1, 2].map((i) => <div key={i} className="md-carte md-carte--squelette" aria-hidden="true" />)}
        </div>
      ) : visibles.length === 0 ? (
        <div className="md-vide">
          <Inbox size={36} aria-hidden="true" />
          <p>
            {filtre === 'en-cours'
              ? t('Aucune demande en cours.')
              : filtre === 'terminees' ? t('Aucune demande terminée.') : t('Vous n\'avez encore fait aucune demande.')}
          </p>
          {filtre !== 'terminees' && (
            <button type="button" className="md-bouton md-bouton--principal" onClick={() => setModalOuvert(true)}>
              <Plus size={16} aria-hidden="true" />
              {t('Signaler une panne')}
            </button>
          )}
        </div>
      ) : (
        <div className="md-liste">
          {visibles.map((d) => (
            <CarteDemande
              key={d.reclamationId}
              demande={d}
              miseEnAvant={d.reclamationId === demandeCible}
              refCarte={d.reclamationId === demandeCible ? refCible : undefined}
              onOuvrir={onOuvrir}
            />
          ))}
        </div>
      )}

      <ReclamationCreeeModal reclamation={reclamationCreee} onClose={() => setReclamationCreee(null)} lienBon={false} />

      <ReclamationModal
        isOpen={modalOuvert}
        onClose={() => setModalOuvert(false)}
        onSave={enregistrer}
        reclamation={null}
        isEditing={false}
      />
    </div>
  );
}
