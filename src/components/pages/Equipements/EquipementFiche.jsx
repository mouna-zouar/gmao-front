import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeft, Boxes, CalendarClock, ChevronRight, Coins, Download, FileText, History,
  Image as IconeImage, Info, Loader2, LogIn, Network, Paperclip, Printer, QrCode, ShieldCheck, Sparkles, Timer, Trash2, Upload, Wrench, X,
} from 'lucide-react';
import equipementService from '../../../services/equipementService';
import reclamationService from '../../../services/Reclamationservice';
import bonMaintenanceRapportService from '../../../services/bonMaintenanceRapportService';
import authService from '../../../services/Authservice';
import serviceService from '../../../services/Serviceservice';
import etatEquipementService from '../../../services/Etatequipementservice';
import { exporterHistoriquePDF } from '../Etatequipement/Etatequipement';
import { Badge, Onglets, Stat } from '../../commun';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import ReclamationCreeeModal from '../../ui/modals/ReclamationCreeeModal';
import BonMaintenanceDetails from '../bonmaintenance/Bonmaintenancedetails';
import { imprimerEtiquettes, qrSvg } from './qrEtiquettes';
import EquipementConnexion from './EquipementConnexion';
import EquipementLiaisonAgent from './EquipementLiaisonAgent';
import EquipementMaintenanceConditionnelle from './EquipementMaintenanceConditionnelle';
import {
  CATEGORIES_DOCUMENT, CRITICITES, ETATS_BON, ETATS_EQUIPEMENT, ETATS_RECLAMATION,
  dateCourte, duree, garantieEnClair, montant, taille,
} from './equipementLibelles';
import { t, tp, locale } from '../../../i18n';
import './Equipements.css';
import './EquipementFiche.css';

/*
 * Fiche d'un équipement : son état, ses indicateurs (disponibilité, MTBF, MTTR, coût des
 * réparations), sa garantie, l'historique de ses pannes, ses réclamations, sa maintenance
 * préventive et ses documents. C'est aussi la page qu'ouvre le QR code de son étiquette :
 * « Signaler une panne » y est donc l'action principale.
 */

function Pastille({ ton = 'neutre', children }) {
  return <span className={`eq-pastille eq-ton--${ton}`}>{children}</span>;
}

function Bloc({ titre, icone: Icone, action, children }) {
  return (
    <section className="eq-bloc">
      <header className="eq-bloc-entete">
        <h2>{Icone && <Icone size={18} />} {titre}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ---------- Étiquette QR ---------- */
function ModaleEtiquette({ identite, onClose }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { qrSvg(identite.id).then(setSvg); }, [identite.id]);
  useEffect(() => {
    const echap = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onClose]);

  return (
    <div className="eq-modale-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="eq-modale" role="dialog" aria-modal="true" aria-labelledby="eq-etiquette-titre">
        <header className="eq-modale-entete">
          <h2 id="eq-etiquette-titre"><QrCode size={20} /> {t('Étiquette QR')}</h2>
          <button type="button" className="eq-ico" onClick={onClose} aria-label={t('Fermer')}><X size={18} /></button>
        </header>
        <div className="eq-etiquette-apercu">
          {/* SVG produit par la bibliothèque qrcode à partir de l'adresse de la fiche */}
          <div className="eq-etiquette-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="eq-etiquette-texte">
            <strong>{identite.designation}</strong>
            {[identite.marque, identite.modele].filter(Boolean).length > 0 && <span>{[identite.marque, identite.modele].filter(Boolean).join(' ')}</span>}
            <span className="eq-mono">{identite.numPiece || identite.codeBarre || `#${identite.id}`}</span>
            <em>{t('Scannez pour signaler une panne')}</em>
          </div>
        </div>
        <p className="eq-modale-aide">
          {t('Collez l’étiquette sur l’appareil. Avec l’appareil photo d’un téléphone, le QR code ouvre cette fiche.')}
        </p>
        <p className="eq-modale-lien eq-mono">{equipementService.urlFiche(identite.id)}</p>
        <footer className="eq-modale-pied">
          <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => imprimerEtiquettes(Array(21).fill(identite))}>
            {t('Imprimer une planche (21)')}
          </button>
          <button type="button" className="eq-bouton" onClick={() => imprimerEtiquettes([identite])}>
            <Printer size={17} /> {t('Imprimer l’étiquette')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---------- Documents ---------- */
function Documents({ equipementId, documents, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState('MANUEL');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);
  const champFichier = useRef(null);

  const envoyer = async (e) => {
    e.preventDefault();
    if (!fichier) return;
    setEnvoi(true);
    setErreur('');
    try {
      await equipementService.ajouterDocument(equipementId, fichier, { titre: titre.trim(), categorie });
      setFichier(null);
      setTitre('');
      setOuvert(false);
      onChange();
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Le document n’a pas pu être envoyé.'));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (id) => {
    try {
      await equipementService.supprimerDocument(id);
      setASupprimer(null);
      onChange();
    } catch {
      setErreur(t('Le document n’a pas pu être supprimé.'));
    }
  };

  return (
    <Bloc
      titre={t('Documents')}
      icone={Paperclip}
      action={!ouvert && (
        <button type="button" className="eq-lien" onClick={() => setOuvert(true)}>
          <Upload size={15} /> {t('Ajouter')}
        </button>
      )}
    >
      {ouvert && (
        <form className="eq-doc-form" onSubmit={envoyer}>
          <button type="button" className={`eq-depot ${fichier ? 'a-fichier' : ''}`} onClick={() => champFichier.current?.click()}>
            <Upload size={18} />
            <span>{fichier ? fichier.name : t('Choisir un fichier (PDF, image, Word, Excel — 20 Mo max.)')}</span>
          </button>
          <input
            ref={champFichier}
            type="file"
            hidden
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => { const f = e.target.files?.[0] || null; setFichier(f); if (f && !titre) setTitre(f.name.replace(/\.[^.]+$/, '')); }}
          />
          <label>
            {t('Titre')}
            <input value={titre} onChange={(e) => setTitre(e.target.value)} />
          </label>
          <label>
            {t('Catégorie')}
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {Object.entries(CATEGORIES_DOCUMENT).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
          </label>
          <div className="eq-doc-form-actions">
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => { setOuvert(false); setFichier(null); setErreur(''); }}>{t('Annuler')}</button>
            <button type="submit" className="eq-bouton" disabled={!fichier || envoi}>
              {envoi && <Loader2 size={16} className="eq-tourne" />} {t('Enregistrer')}
            </button>
          </div>
        </form>
      )}
      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}

      {documents.length === 0 && !ouvert ? (
        <p className="eq-vide-texte">{t('Aucun document : ajoutez le manuel, les certificats d’étalonnage ou les rapports.')}</p>
      ) : (
        <ul className="eq-docs">
          {documents.map((d) => {
            const Icone = d.typeMime?.startsWith('image/') ? IconeImage : FileText;
            return (
              <li key={d.id}>
                <a className="eq-doc" href={equipementService.urlDocument(d.id)} target="_blank" rel="noopener noreferrer">
                  <span className="eq-doc-icone"><Icone size={17} /></span>
                  <span className="eq-doc-texte">
                    <strong>{d.titre}</strong>
                    <span>{[t(CATEGORIES_DOCUMENT[d.categorie] || 'Autre'), taille(d.taille), dateCourte(d.dateAjout), d.ajouteParNom].filter(Boolean).join(' – ')}</span>
                  </span>
                </a>
                {aSupprimer === d.id ? (
                  <span className="eq-doc-confirmer">
                    <button type="button" className="eq-lien eq-lien--alerte" onClick={() => supprimer(d.id)}>{t('Supprimer')}</button>
                    <button type="button" className="eq-lien" onClick={() => setASupprimer(null)}>{t('Annuler')}</button>
                  </span>
                ) : (
                  <button type="button" className="eq-ico" onClick={() => setASupprimer(d.id)} aria-label={t('Supprimer « {nom} »', { nom: d.titre })}>
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Bloc>
  );
}

/* ---------- Page ---------- */
// Tons des libellés de la fiche → couleurs des badges communs
const BADGE = { ok: 'vert', alerte: 'rouge', attention: 'ambre', info: 'bleu', action: 'teal', neutre: 'gris' };

function Ligne({ label, children, mono }) {
  return (
    <div className="eqf-ligne">
      <dt>{label}</dt>
      <dd className={mono ? 'eq-mono' : undefined}>{children ?? '—'}</dd>
    </div>
  );
}

export default function EquipementFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // « Retour » : page précédente de l'application ; ouverte directement (QR code scanné), on va à la liste.
  const retour = () => {
    // location.key vaut 'default' quand la fiche est la première page ouverte (lien, QR code)
    if (location.key !== 'default') navigate(-1);
    else navigate('/equipements');
  };
  const [fiche, setFiche] = useState(null);
  const [statut, setStatut] = useState('chargement'); // chargement | pret | introuvable | erreur
  const [etiquette, setEtiquette] = useState(false);
  const [signaler, setSignaler] = useState(false);
  const [bonOuvert, setBonOuvert] = useState(null);
  const [reclamationCreee, setReclamationCreee] = useState(null);
  const [nomService, setNomService] = useState(null);
  const [transitions, setTransitions] = useState(null);
  // Heure de référence pour l'âge de l'appareil et la garantie (fixée au chargement de la page)
  const [maintenant] = useState(() => Date.now());
  const connecte = !!(authService.getCurrentUser() && authService.getSessionId());
  const onglet = params.get('onglet') || 'infos';
  const changerOnglet = (cle) => setParams((p) => { const n = new URLSearchParams(p); n.set('onglet', cle); return n; }, { replace: true });

  const charger = useCallback(() => {
    equipementService.getFiche(id)
      .then((f) => { setFiche(f); setStatut('pret'); })
      .catch((err) => setStatut(err?.response?.status === 404 ? 'introuvable' : 'erreur'));
  }, [id]);

  useEffect(() => { charger(); }, [charger]);

  // Rapports d'intervention validés (IA) : leur résumé s'affiche sous chaque panne
  const [rapports, setRapports] = useState({});
  const idEquipementRapports = fiche?.identite?.id;
  useEffect(() => {
    if (idEquipementRapports == null || !connecte) return;
    let annule = false;
    bonMaintenanceRapportService.historiqueEquipement(idEquipementRapports)
      .then((liste) => { if (!annule) setRapports(Object.fromEntries(liste.map((r) => [r.bonMaintenanceId, r]))); })
      .catch(() => { if (!annule) setRapports({}); });
    return () => { annule = true; };
  }, [idEquipementRapports, connecte]);

  // Nom du service (la fiche ne donne que son numéro)
  const idService = fiche?.identite?.serviceId;
  useEffect(() => {
    if (idService == null || !connecte) return;
    serviceService.getAll(0, 500)
      .then((d) => {
        const s = (d?.content ?? d ?? []).find((x) => Number(x.id) === Number(idService));
        setNomService(s ? (s.description || s.code) : null);
      })
      .catch((e) => console.error('[GMAO équipements] Services :', e));
  }, [idService, connecte]);

  // Historique des changements d'état : chargé à l'ouverture de l'onglet
  useEffect(() => {
    if (onglet !== 'etats' || idEquipementRapports == null || transitions || !connecte) return;
    etatEquipementService.getHistorique(idEquipementRapports)
      .then((d) => setTransitions(d ?? []))
      .catch((e) => { console.error('[GMAO équipements] Historique d’état :', e); setTransitions([]); });
  }, [onglet, idEquipementRapports, transitions, connecte]);

  const fermerEtiquette = useCallback(() => setEtiquette(false), []);

  // Stable d'un rendu à l'autre : le formulaire de réclamation ne doit pas se réinitialiser pendant la saisie
  const idEquipement = fiche?.identite?.id;
  const nomEquipement = fiche?.identite?.designation;
  const valeursReclamation = useMemo(() => (idEquipement == null ? null : {
    lotArticleImmobilistationId: idEquipement,
    immobilisation: { id: idEquipement, designation: nomEquipement },
  }), [idEquipement, nomEquipement]);

  const enregistrerReclamation = async (payload) => {
    const creee = await reclamationService.create(payload);
    setSignaler(false);
    setReclamationCreee(creee || {});
    charger();
  };

  if (bonOuvert) {
    return <BonMaintenanceDetails bonMaintenance={bonOuvert} onBack={() => { setBonOuvert(null); charger(); }} />;
  }

  if (statut !== 'pret') {
    return (
      <main className="cl-page eq-theme eqf-page">
        <div className="eq-vide eq-vide--page">
          {statut === 'chargement' ? <Loader2 size={26} className="eq-tourne" /> : <AlertTriangle size={26} />}
          <p>
            {statut === 'chargement' ? t('Ouverture de la fiche…')
              : statut === 'introuvable' ? t('Cet équipement est introuvable. L’étiquette est peut-être ancienne.')
                : t('La fiche n’a pas pu être chargée. Vérifiez votre connexion puis réessayez.')}
          </p>
          {statut !== 'chargement' && (
            <Link to="/equipements" className="eq-bouton eq-bouton--clair">{t('Voir tous les équipements')}</Link>
          )}
        </div>
      </main>
    );
  }

  const { identite, etat, garantie, disponibilite: dispo, couts, pannes, reclamations, preventif, documents } = fiche;
  const etatDef = ETATS_EQUIPEMENT[etat?.etatActuel];
  const critDef = CRITICITES[etat?.criticite];
  const garantieTxt = garantieEnClair(garantie);
  const dispoConnue = dispo && ((dispo.dureeDisponibleHeures || 0) + (dispo.dureeIndisponibleHeures || 0)) > 0;
  const age = identite.dateExploitation
    ? Math.floor((maintenant - new Date(identite.dateExploitation).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const garantiePct = garantie?.debut && garantie?.fin
    ? Math.min(100, Math.max(0, ((maintenant - new Date(garantie.debut)) / (new Date(garantie.fin) - new Date(garantie.debut))) * 100))
    : null;
  const nf = (v) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v);
  const taux = dispoConnue ? dispo.tauxDisponibilitePct : null;
  const coutAlerte = couts?.pourcentagePrixAchat != null && couts.pourcentagePrixAchat >= 50;
  const preventifEnRetard = preventif.filter((p) => p.joursRestants != null && p.joursRestants < 0).length;
  const reclamationsOuvertes = reclamations.filter((r) => [0, 1, 5].includes(r.etat)).length;

  const onglets = [
    { cle: 'infos', label: t('Informations'), icone: Info },
    { cle: 'pannes', label: t('Pannes'), icone: Wrench, n: pannes.length },
    { cle: 'reclamations', label: t('Réclamations'), icone: AlertTriangle, n: reclamations.length, ton: reclamationsOuvertes ? 'rouge' : undefined },
    { cle: 'preventif', label: t('Préventif'), icone: CalendarClock, n: preventif.length, ton: preventifEnRetard ? 'rouge' : undefined },
    ...(connecte ? [
      { cle: 'etats', label: t('États'), icone: History },
      { cle: 'supervision', label: t('Réseau, agent et conditionnelle'), icone: Network },
    ] : []),
    { cle: 'documents', label: t('Documents'), icone: Paperclip, n: documents.length },
  ];
  const ongletActif = onglets.some((o) => o.cle === onglet) ? onglet : 'infos';

  const exporterEtats = () => exporterHistoriquePDF({
    lotArticleImmobilistationId: identite.id, cibleNom: identite.designation, etatActuel: etat?.etatActuel, depuisLe: etat?.depuisLe,
  }, transitions || []);

  return (
    <main className="cl-page eq-theme eqf-page">
      {/* ---- En-tête ---- */}
      <header className="eqf-entete">
        <div className="eqf-entete__gauche">
          <span className="cl-entete__icone"><Boxes size={24} strokeWidth={2} aria-hidden="true" /></span>
          <div className="eqf-entete__texte">
            <h1>{identite.designation}</h1>
            <p>
              {[identite.marque, identite.modele].filter(Boolean).join(' ') || t('Marque et modèle non renseignés')}
              <span className="eq-mono"> · {identite.numPiece || identite.codeBarre || `#${identite.id}`}</span>
            </p>
            <div className="eqf-badges">
              {etatDef && (
                <Badge ton={BADGE[etatDef.ton]}>
                  {t(etatDef.label)}{etat?.depuisLe ? ` · ${t('depuis le {date}', { date: dateCourte(etat.depuisLe) })}` : ''}
                </Badge>
              )}
              {critDef && <Badge ton={BADGE[critDef.ton]}>{t('Criticité : {c}', { c: t(critDef.label) })}</Badge>}
              <Badge ton={BADGE[garantieTxt.ton]}>{garantieTxt.texte}</Badge>
            </div>
          </div>
        </div>
        <div className="eqf-entete__actions">
          <button type="button" className="cl-action" onClick={retour}>
            <ArrowLeft size={18} className="rtl-miroir" /> <span>{t('Retour')}</span>
          </button>
          <button type="button" className="cl-action cl-action--teal" onClick={() => setEtiquette(true)}>
            <QrCode size={18} /> <span>{t('Étiquette QR')}</span>
          </button>
          {connecte ? (
            <button type="button" className="cl-action eqf-signaler" onClick={() => setSignaler(true)}>
              <AlertTriangle size={18} /> <span>{t('Signaler une panne')}</span>
            </button>
          ) : (
            <button type="button" className="cl-action eqf-signaler" onClick={() => navigate(`/login?retour=${encodeURIComponent(`/equipement/${id}`)}`)}>
              <LogIn size={18} /> <span>{t('Se connecter pour signaler une panne')}</span>
            </button>
          )}
        </div>
      </header>

      {!identite.complet && (
        <p className="eq-avertissement">{t('La liste des équipements est injoignable : marque, modèle, garantie et prix d’achat ne sont pas affichés.')}</p>
      )}

      {/* ---- Indicateurs ---- */}
      <section className="eqf-stats" aria-label={t('Indicateurs')}>
        <Stat icone={Activity} ton={taux == null ? 'neutre' : taux >= 95 ? 'vert' : taux >= 80 ? 'ambre' : 'rouge'}
          valeur={taux == null ? '—' : `${nf(taux)} %`} label={t('Disponibilité sur 12 mois')}
          sous={dispoConnue ? tp('panne', dispo.nbPannes) : t('Pas encore de données')} />
        <Stat icone={Timer} ton="bleu" valeur={duree(dispo?.mtbfHeures)} label={t('Temps moyen entre pannes')} sous="MTBF" />
        <Stat icone={Wrench} ton="violet" valeur={duree(dispo?.mttrHeures)} label={t('Temps moyen de réparation')} sous="MTTR" />
        <Stat icone={Coins} ton={coutAlerte ? 'rouge' : 'ambre'} valeur={montant(couts?.total)} label={t('Coût des réparations')}
          sous={couts?.pourcentagePrixAchat != null ? t('{n} % du prix d’achat', { n: nf(couts.pourcentagePrixAchat) }) : tp('bon de maintenance', pannes.length)} />
      </section>

      <Onglets onglets={onglets} actif={ongletActif} onChanger={changerOnglet} ariaLabel={t('Rubriques de la fiche')} />

      <div className="eqf-contenu" role="tabpanel">
        {ongletActif === 'infos' && (
          <div className="eqf-grille">
            <Bloc titre={t('Identité')} icone={ShieldCheck}>
              <dl className="eqf-lignes">
                <Ligne label={t('Désignation')}>{identite.designation}</Ligne>
                <Ligne label={t('Marque')}>{identite.marque || '—'}</Ligne>
                <Ligne label={t('Modèle')}>{identite.modele || '—'}</Ligne>
                <Ligne label={t('N° de pièce')} mono>{identite.numPiece || '—'}</Ligne>
                <Ligne label={t('Code-barre')} mono>{identite.codeBarre || '—'}</Ligne>
                <Ligne label={t('Service')}>{identite.serviceId != null ? (nomService || `#${identite.serviceId}`) : '—'}</Ligne>
                <Ligne label={t('Fournisseur')}>{identite.fournisseurNom || '—'}</Ligne>
              </dl>
            </Bloc>
            <Bloc titre={t('Achat et garantie')} icone={Coins}>
              <dl className="eqf-lignes">
                <Ligne label={t('Mise en service')}>{dateCourte(identite.dateExploitation)}{age != null ? ` (${tp('an', age)})` : ''}</Ligne>
                <Ligne label={t('Prix d’achat')}>{identite.prixAchat != null ? montant(identite.prixAchat) : '—'}</Ligne>
                <Ligne label={t('Début de garantie')}>{dateCourte(garantie?.debut)}</Ligne>
                <Ligne label={t('Fin de garantie')}>{dateCourte(garantie?.fin)}</Ligne>
                <Ligne label={t('Garantie')}><Badge ton={BADGE[garantieTxt.ton]}>{garantieTxt.texte}</Badge></Ligne>
              </dl>
              {garantiePct != null && (
                <div className="eq-garantie">
                  <div className={`eq-garantie-barre eq-ton--${garantieTxt.ton}`} aria-hidden="true">
                    <span style={{ width: `${garantiePct}%` }} />
                  </div>
                  <p>
                    {garantie.statut === 'EXPIREE'
                      ? t('Garantie expirée depuis {d}', { d: tp('jour', Math.abs(garantie.joursRestants)) })
                      : t('Encore {d} de garantie', { d: tp('jour', garantie.joursRestants) })}
                  </p>
                </div>
              )}
            </Bloc>
            <Bloc titre={t('État')} icone={Activity}>
              <dl className="eqf-lignes">
                <Ligne label={t('État actuel')}>{etatDef ? <Badge ton={BADGE[etatDef.ton]}>{t(etatDef.label)}</Badge> : '—'}</Ligne>
                <Ligne label={t('Depuis le')}>{dateCourte(etat?.depuisLe)}</Ligne>
                <Ligne label={t('Criticité')}>{critDef ? <Badge ton={BADGE[critDef.ton]}>{t(critDef.label)}</Badge> : '—'}</Ligne>
                <Ligne label={t('Bon de référence')} mono>{etat?.bonReferenceNum || '—'}</Ligne>
                <Ligne label={t('Réclamations ouvertes')}>{reclamationsOuvertes}</Ligne>
                <Ligne label={t('Préventif en retard')}>{preventifEnRetard}</Ligne>
              </dl>
            </Bloc>
          </div>
        )}

        {ongletActif === 'pannes' && (
          <Bloc titre={t('Historique des pannes')} icone={Wrench}>
            {pannes.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune panne enregistrée pour cet équipement.')}</p>
            ) : (
              <ol className="eq-historique">
                {pannes.map((p) => {
                  const e = ETATS_BON[p.etat] || { label: '—', ton: 'neutre' };
                  return (
                    <li key={p.id} className={`eq-ton--${e.ton}`}>
                      <button type="button" className="eq-panne" onClick={() => setBonOuvert({ id: p.id })}>
                        <span className="eq-panne-date">{dateCourte(p.dateCreation)}</span>
                        <span className="eq-panne-corps">
                          <span className="eq-panne-titre"><strong>{p.num || `#${p.id}`}</strong> {p.titre}</span>
                          <span className="eq-panne-meta">
                            <Badge ton={BADGE[e.ton]}>{t(e.label)}</Badge>
                            {p.dureeHeures != null && <span>{t('Résolu en {d}', { d: duree(p.dureeHeures) })}</span>}
                            {p.coutTotal ? <span>{montant(p.coutTotal)}</span> : null}
                          </span>
                          {rapports[p.id]?.contenu?.resume && (
                            <span className="eq-panne-rapport">
                              <Sparkles size={13} aria-hidden="true" /> {rapports[p.id].contenu.resume}
                            </span>
                          )}
                        </span>
                        <ChevronRight size={17} className="rtl-miroir eq-panne-fleche" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Bloc>
        )}

        {ongletActif === 'reclamations' && (
          <Bloc titre={t('Réclamations')} icone={AlertTriangle}>
            {reclamations.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune réclamation pour cet équipement.')}</p>
            ) : (
              <div className="eqf-table-cadre">
                <table className="cl-table eqf-table">
                  <thead><tr><th>{t('Numéro')}</th><th>{t('Description')}</th><th>{t('Date')}</th><th>{t('Signalée par')}</th><th>{t('État')}</th></tr></thead>
                  <tbody>
                    {reclamations.map((r) => {
                      const e = ETATS_RECLAMATION[r.etat] || { label: '—', ton: 'neutre' };
                      return (
                        <tr key={r.id}>
                          <td className="liste-num">{r.num || `#${r.id}`}</td>
                          <td>{r.description || '—'}</td>
                          <td>{dateCourte(r.date)}</td>
                          <td>{r.personnelCreationNom || '—'}</td>
                          <td><Badge ton={BADGE[e.ton]}>{t(e.label)}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>
        )}

        {ongletActif === 'preventif' && (
          <Bloc titre={t('Maintenance préventive')} icone={CalendarClock}>
            {preventif.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune maintenance préventive prévue pour ce type d’appareil.')}</p>
            ) : (
              <div className="eqf-table-cadre">
                <table className="cl-table eqf-table">
                  <thead><tr><th>{t('Maintenance')}</th><th>{t('Fréquence')}</th><th>{t('Prochaine échéance')}</th></tr></thead>
                  <tbody>
                    {preventif.map((p, i) => {
                      const retard = p.joursRestants != null && p.joursRestants < 0;
                      const proche = !retard && p.joursRestants != null && p.joursRestants <= 15;
                      return (
                        <tr key={`${p.libelle}-${i}`}>
                          <td><strong>{p.libelle}</strong></td>
                          <td>{p.intervalleJours ? t('Tous les {n} jours', { n: p.intervalleJours }) : '—'}</td>
                          <td><Badge ton={retard ? 'rouge' : proche ? 'ambre' : 'bleu'}>{p.prochaineEcheance ? dateCourte(p.prochaineEcheance) : '—'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>
        )}

        {ongletActif === 'etats' && (
          <Bloc titre={t('Historique d’état')} icone={History} action={(
            <button type="button" className="eq-lien" onClick={exporterEtats} disabled={!transitions}>
              <Download size={15} /> {t('Exporter en PDF')}
            </button>
          )}>
            {!transitions ? (
              <p className="eq-vide-texte"><Loader2 size={15} className="eq-tourne" /> {t("Chargement de l'historique...")}</p>
            ) : transitions.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune transition enregistrée.')}</p>
            ) : (
              <div className="eqf-table-cadre">
                <table className="cl-table eqf-table">
                  <thead><tr><th>{t('Date')}</th><th>{t('Ancien état')}</th><th>{t('Nouvel état')}</th><th>{t('Bon')}</th><th>{t('Motif')}</th></tr></thead>
                  <tbody>
                    {transitions.map((x) => {
                      const avant = ETATS_EQUIPEMENT[x.etatPrecedent];
                      const apres = ETATS_EQUIPEMENT[x.etatNouveau];
                      return (
                        <tr key={x.id}>
                          <td>{dateCourte(x.dateTransition)}</td>
                          <td>{avant ? <Badge ton={BADGE[avant.ton]}>{t(avant.label)}</Badge> : <span className="cl-tiret">{t('Première détection')}</span>}</td>
                          <td>{apres ? <Badge ton={BADGE[apres.ton]}>{t(apres.label)}</Badge> : (x.etatNouveau || '—')}</td>
                          <td className="liste-num">{x.bonMaintenanceNum || '—'}</td>
                          <td>{x.motif || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>
        )}

        {/* ---- Connexion réseau, agent et maintenance conditionnelle : réservés aux utilisateurs connectés ---- */}
        {ongletActif === 'supervision' && (
          <div className="eqf-groupe">
            <EquipementConnexion equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />
            <EquipementLiaisonAgent equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />
            <EquipementMaintenanceConditionnelle equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />
          </div>
        )}

        {ongletActif === 'documents' && <Documents equipementId={identite.id} documents={documents} onChange={charger} />}
      </div>

      {etiquette && <ModaleEtiquette identite={identite} onClose={fermerEtiquette} />}

      <ReclamationCreeeModal reclamation={reclamationCreee} onClose={() => setReclamationCreee(null)} />

      <ReclamationModal
        isOpen={signaler}
        onClose={() => setSignaler(false)}
        onSave={enregistrerReclamation}
        reclamation={null}
        isEditing={false}
        valeursInitiales={valeursReclamation}
      />
    </main>
  );
}
