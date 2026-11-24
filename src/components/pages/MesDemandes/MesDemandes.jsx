import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, UserCheck, Wrench, CheckCircle2, PauseCircle, XCircle, Ban,
  Plus, RefreshCw, AlertCircle, Inbox, ExternalLink,
} from 'lucide-react';
import suiviDemandeService from '../../../services/suiviDemandeService';
import reclamationService from '../../../services/Reclamationservice';
import authService from '../../../services/Authservice';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import ReclamationCreeeModal from '../../ui/modals/ReclamationCreeeModal';
import { Modale } from '../../commun';
import EspaceTableau from '../EspacePersonnel/EspaceTableau';
import { t, locale } from '../../../i18n';
import './MesDemandes.css';



const ETAPES = {
  ENVOYEE: { libelle: 'Envoyée', ton: 'bleu', Icone: Send, phrase: 'Votre demande est arrivée au service maintenance.' },
  PRISE_EN_CHARGE: { libelle: 'Prise en charge', ton: 'indigo', Icone: UserCheck, phrase: 'Le service maintenance a pris votre demande en main.' },
  EN_REPARATION: { libelle: 'En réparation', ton: 'ambre', Icone: Wrench, phrase: 'Un technicien intervient sur l\'équipement.' },
  EN_PAUSE: { libelle: 'En attente', ton: 'orange', Icone: PauseCircle, phrase: 'La réparation est en pause.' },
  REPAREE: { libelle: 'Réparée', ton: 'vert', Icone: CheckCircle2, phrase: 'La réparation est terminée.' },
  REFUSEE: { libelle: 'Refusée', ton: 'rouge', Icone: XCircle, phrase: 'Votre demande a été refusée.' },
  ANNULEE: { libelle: 'Annulée', ton: 'gris', Icone: Ban, phrase: 'La demande a été annulée par le service maintenance.' },
  ANNULEE_DEMANDEUR: { libelle: 'Annulée par vous', ton: 'gris', Icone: Ban, phrase: 'Vous avez annulé cette demande.' },
};

const TERMINEES = new Set(['REPAREE', 'REFUSEE', 'ANNULEE', 'ANNULEE_DEMANDEUR']);
const peutAnnuler = (d) => (d.etape === 'ENVOYEE' || d.etape === 'PRISE_EN_CHARGE') && !d.bonId;

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

function personnelConnecte() {
  const u = authService.getCurrentUser();
  return u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
}

const RANG_ETAPE = { EN_PAUSE: 0, EN_REPARATION: 1, PRISE_EN_CHARGE: 2, ENVOYEE: 3, REPAREE: 4, REFUSEE: 5, ANNULEE: 6, ANNULEE_DEMANDEUR: 7 };

function TableauDemandes({ demandes, cible, onOuvrir, onAnnuler }) {
  const sansClic = (fn) => (e) => { e.stopPropagation(); fn(); };
  const colonnes = [
    {
      cle: 'num', label: 'N°', largeur: 120, valeur: (d) => d.reclamationNum || '',
      rendu: (d) => <strong className="ept-ref">{d.reclamationNum || t('Sans numéro')}</strong>,
    },
    {
      cle: 'date', label: 'Date', largeur: 150, valeur: (d) => (d.dateDemande ? new Date(d.dateDemande).getTime() : null),
      rendu: (d) => <span className="ept-date">{formaterDate(d.dateDemande)}</span>,
    },
    {
      cle: 'description', label: 'Description', valeur: (d) => d.description || '',
      rendu: (d) => {
        const motif = d.etape === 'REFUSEE' || d.etape === 'ANNULEE_DEMANDEUR' ? d.motifRejet : d.etape === 'EN_PAUSE' ? d.bonMotif : null;
        return (
          <span className="ept-texte">
            {d.description || t('Sans description')}
            {motif && <small className="ept-sous">{motif}</small>}
          </span>
        );
      },
    },
    { cle: 'equipement', label: 'Équipement', valeur: (d) => d.equipementDesignation || '' },
    { cle: 'service', label: 'Service', valeur: (d) => d.serviceNom || '' },
    {
      cle: 'etape', label: 'Étape', largeur: 160, valeur: (d) => RANG_ETAPE[d.etape] ?? 9,
      rendu: (d) => {
        const info = ETAPES[d.etape] ?? ETAPES.ENVOYEE;
        const { Icone } = info;
        return <span className={`md-badge md-badge--${info.ton}`}><Icone size={13} aria-hidden="true" />{t(info.libelle)}</span>;
      },
    },
    {
      cle: 'bon', label: 'Bon', largeur: 110, valeur: (d) => d.bonNum || '',
      rendu: (d) => (d.bonNum ? <span className="ept-ref-doux">{d.bonNum}</span> : '—'),
    },
    {
      cle: 'actions', label: '', triable: false, largeur: 190, align: 'right',
      rendu: (d) => (
        <span className="ept-actions">
          {onAnnuler && peutAnnuler(d) && (
            <button type="button" className="md-bouton md-bouton--danger md-bouton--petit" onClick={sansClic(() => onAnnuler(d))}
              title={t('Annuler cette demande (tant que la réparation n’a pas commencé)')}>
              <Ban size={13} aria-hidden="true" /> {t('Annuler')}
            </button>
          )}
          {onOuvrir && (
            <button type="button" className="md-bouton md-bouton--principal md-bouton--petit" onClick={sansClic(() => onOuvrir(d.reclamationId))}>
              <ExternalLink size={13} aria-hidden="true" /> {t('Ouvrir')}
            </button>
          )}
        </span>
      ),
    },
  ];
  return (
    <EspaceTableau
      colonnes={colonnes}
      lignes={demandes}
      cleLigne={(d) => d.reclamationId}
      onOuvrir={onOuvrir ? (d) => onOuvrir(d.reclamationId) : undefined}
      triInitial={{ cle: 'date', sens: 'desc' }}
      recherchePlaceholder={t('Rechercher une demande (n°, description, équipement)…')}
      vide={t('Aucune demande.')}
      ligneClasse={(d) => [d.reclamationId === cible ? 'is-cible' : '', TERMINEES.has(d.etape) ? 'is-termine' : ''].join(' ')}
    />
  );
}

export default function MesDemandes({ integre = false, onCharge, onOuvrir, demandeSignalement = 0 } = {}) {
  const [searchParams] = useSearchParams();
  const demandeCible = Number(searchParams.get('demande')) || null;

  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('en-cours');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [reclamationCreee, setReclamationCreee] = useState(null);
  const [annulation, setAnnulation] = useState(null);
  const refCible = useRef(null);
  const personnelId = personnelConnecte();
  useEffect(() => { if (demandeSignalement > 0) setModalOuvert(true); }, [demandeSignalement]);

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

  useEffect(() => {
    const auRetour = () => { if (document.visibilityState === 'visible') charger({ silencieux: true }); };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [charger]);

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

  const confirmerAnnulation = async () => {
    const motif = annulation?.motif?.trim();
    if (!motif) {
      setAnnulation((a) => ({ ...a, erreur: t('Indiquez pourquoi vous annulez cette demande.') }));
      return;
    }
    setAnnulation((a) => ({ ...a, envoi: true, erreur: null }));
    try {
      const u = authService.getCurrentUser() || {};
      await reclamationService.annulerParDemandeur(annulation.demande.reclamationId, {
        motif, auteurId: personnelId, auteurNom: u.userNom || u.nomPrenom || u.login || null,
      });
      setAnnulation(null);
      await charger({ silencieux: true });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error;
      setAnnulation((a) => ({ ...a, envoi: false, erreur: msg || t('La demande n’a pas pu être annulée.') }));
    }
  };

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
        <TableauDemandes
          demandes={visibles}
          cible={demandeCible}
          onOuvrir={onOuvrir}
          onAnnuler={(demande) => setAnnulation({ demande, motif: '', envoi: false, erreur: null })}
        />
      )}

      <Modale
        ouvert={annulation != null}
        onFermer={() => { if (!annulation?.envoi) setAnnulation(null); }}
        icone={Ban}
        titre={t('Annuler ma demande')}
        sousTitre={annulation?.demande ? `${annulation.demande.reclamationNum || ''} · ${annulation.demande.description || ''}` : undefined}
        taille="sm"
        pied={(
          <>
            <button type="button" className="md-bouton md-bouton--secondaire" onClick={() => setAnnulation(null)} disabled={annulation?.envoi}>
              {t('Garder ma demande')}
            </button>
            <button type="button" className="md-bouton md-bouton--danger" onClick={confirmerAnnulation} disabled={annulation?.envoi}>
              <Ban size={16} aria-hidden="true" />
              {annulation?.envoi ? t('Annulation…') : t('Annuler la demande')}
            </button>
          </>
        )}
      >
        <div className="md-annulation">
          <p>{t('Le service maintenance ne traitera plus cette demande. Si la panne revient, il faudra en signaler une nouvelle.')}</p>
          <label htmlFor="md-motif-annulation">{t('Pourquoi annulez-vous ? (obligatoire)')}</label>
          <textarea
            id="md-motif-annulation"
            rows={3}
            value={annulation?.motif || ''}
            onChange={(e) => setAnnulation((a) => ({ ...a, motif: e.target.value, erreur: null }))}
            placeholder={t('Ex. : le problème a disparu, demande faite en double…')}
            disabled={annulation?.envoi}
          />
          {annulation?.erreur && <p className="md-annulation__erreur" role="alert"><AlertCircle size={15} aria-hidden="true" /> {annulation.erreur}</p>}
        </div>
      </Modale>

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
