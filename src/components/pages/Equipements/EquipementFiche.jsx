import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, FileText, Image as IconeImage,
  Loader2, LogIn, Paperclip, Printer, QrCode, ShieldCheck, Sparkles, Trash2, Upload, Wrench, X,
} from 'lucide-react';
import equipementService from '../../../services/equipementService';
import reclamationService from '../../../services/Reclamationservice';
import bonMaintenanceRapportService from '../../../services/bonMaintenanceRapportService';
import authService from '../../../services/Authservice';
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
export default function EquipementFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // « Retour » : page précédente de l'application (fenêtre Équipements des bons de maintenance,
  // bon, réclamation…) ; ouverte directement (QR code scanné), on va à la liste des équipements.
  const retour = () => {
    // location.key vaut 'default' quand la fiche est la première page ouverte (lien, QR code)
    if (location.key !== 'default') navigate(-1);
    else navigate('/bons-maintenance?vue=equipements&onglet=liste');
  };
  const [fiche, setFiche] = useState(null);
  const [statut, setStatut] = useState('chargement'); // chargement | pret | introuvable | erreur
  const [etiquette, setEtiquette] = useState(false);
  const [signaler, setSignaler] = useState(false);
  const [bonOuvert, setBonOuvert] = useState(null);
  const [message, setMessage] = useState('');
  const [reclamationCreee, setReclamationCreee] = useState(null);
  // Heure de référence pour l'âge de l'appareil et la garantie (fixée au chargement de la page)
  const [maintenant] = useState(() => Date.now());
  const connecte = !!(authService.getCurrentUser() && authService.getSessionId());

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
      <main className="eq-page">
        <div className="eq-vide eq-vide--page">
          {statut === 'chargement' ? <Loader2 size={26} className="eq-tourne" /> : <AlertTriangle size={26} />}
          <p>
            {statut === 'chargement' ? t('Ouverture de la fiche…')
              : statut === 'introuvable' ? t('Cet équipement est introuvable. L’étiquette est peut-être ancienne.')
                : t('La fiche n’a pas pu être chargée. Vérifiez votre connexion puis réessayez.')}
          </p>
          {statut !== 'chargement' && (
            <Link to="/bons-maintenance?vue=equipements&onglet=liste" className="eq-bouton eq-bouton--clair">{t('Voir tous les équipements')}</Link>
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

  // Part de la garantie déjà écoulée (barre de progression)
  const garantiePct = garantie?.debut && garantie?.fin
    ? Math.min(100, Math.max(0, ((maintenant - new Date(garantie.debut)) / (new Date(garantie.fin) - new Date(garantie.debut))) * 100))
    : null;

  const releves = [
    {
      cle: 'dispo',
      label: t('Disponibilité sur 12 mois'),
      valeur: dispoConnue ? `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(dispo.tauxDisponibilitePct)} %` : '—',
      note: dispoConnue ? tp('panne', dispo.nbPannes) : t('Pas encore de données'),
    },
    { cle: 'mtbf', label: t('Temps moyen entre pannes'), valeur: duree(dispo?.mtbfHeures), note: 'MTBF' },
    { cle: 'mttr', label: t('Temps moyen de réparation'), valeur: duree(dispo?.mttrHeures), note: 'MTTR' },
    {
      cle: 'cout',
      label: t('Coût des réparations'),
      valeur: montant(couts?.total),
      note: couts?.pourcentagePrixAchat != null ? t('{n} % du prix d’achat', { n: new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(couts.pourcentagePrixAchat) }) : tp('bon de maintenance', pannes.length),
      alerte: couts?.pourcentagePrixAchat != null && couts.pourcentagePrixAchat >= 50,
    },
  ];

  return (
    <main className="eq-page eq-fiche">
      {/* ---- En-tête : quel appareil, dans quel état, et l'action principale ---- */}
      <header className="eq-fiche-entete">
        <button type="button" className="eq-retour" onClick={retour}>
          <ArrowLeft size={16} className="rtl-miroir" /> {t('Retour')}
        </button>
        <div className="eq-fiche-titre">
          <div>
            <h1>{identite.designation}</h1>
            <p>
              {[identite.marque, identite.modele].filter(Boolean).join(' ') || t('Marque et modèle non renseignés')}
              {(identite.numPiece || identite.codeBarre) && <span className="eq-mono"> {identite.numPiece || identite.codeBarre}</span>}
            </p>
            <div className="eq-fiche-pastilles">
              {etatDef && (
                <Pastille ton={etatDef.ton}>
                  {t(etatDef.label)}{etat?.depuisLe ? ` ${t('depuis le {date}', { date: dateCourte(etat.depuisLe) })}` : ''}
                </Pastille>
              )}
              {critDef && <Pastille ton={critDef.ton}>{t('Criticité : {c}', { c: t(critDef.label) })}</Pastille>}
              <Pastille ton={garantieTxt.ton}>{garantieTxt.texte}</Pastille>
            </div>
          </div>
          <div className="eq-fiche-actions">
            {connecte ? (
              <button type="button" className="eq-bouton eq-bouton--signal" onClick={() => setSignaler(true)}>
                <AlertTriangle size={18} /> {t('Signaler une panne')}
              </button>
            ) : (
              <button type="button" className="eq-bouton eq-bouton--signal" onClick={() => navigate(`/login?retour=${encodeURIComponent(`/equipement/${id}`)}`)}>
                <LogIn size={18} /> {t('Se connecter pour signaler une panne')}
              </button>
            )}
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => setEtiquette(true)}>
              <QrCode size={18} /> {t('Étiquette QR')}
            </button>
          </div>
        </div>
        {!identite.complet && (
          <p className="eq-avertissement">{t('La liste des équipements est injoignable : marque, modèle, garantie et prix d’achat ne sont pas affichés.')}</p>
        )}
      </header>

      {message && (
        <p className="eq-succes" role="status"><CheckCircle2 size={17} /> {message}</p>
      )}

      {/* ---- Relevé des indicateurs ---- */}
      <section className="eq-releve" aria-label={t('Indicateurs')}>
        {releves.map((r) => (
          <div key={r.cle} className={`eq-releve-item ${r.alerte ? 'is-alerte' : ''}`}>
            <span className="eq-releve-label">{r.label}</span>
            <strong>{r.valeur}</strong>
            <span className="eq-releve-note">{r.note}</span>
          </div>
        ))}
      </section>

      <div className="eq-fiche-grille">
        <div className="eq-fiche-principal">
          {/* ---- Historique des pannes ---- */}
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
                            <Pastille ton={e.ton}>{t(e.label)}</Pastille>
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

          {/* ---- Réclamations ---- */}
          <Bloc titre={t('Réclamations')} icone={AlertTriangle}>
            {reclamations.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune réclamation pour cet équipement.')}</p>
            ) : (
              <ul className="eq-reclamations">
                {reclamations.map((r) => {
                  const e = ETATS_RECLAMATION[r.etat] || { label: '—', ton: 'neutre' };
                  return (
                    <li key={r.id}>
                      <span className="eq-reclamation-texte">
                        <strong>{r.num || `#${r.id}`}</strong>
                        <span>{r.description || '—'}</span>
                        <em>{[dateCourte(r.date), r.personnelCreationNom].filter(Boolean).join(' – ')}</em>
                      </span>
                      <Pastille ton={e.ton}>{t(e.label)}</Pastille>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloc>
        </div>

        <aside className="eq-fiche-cote">
          {/* ---- Identité et garantie ---- */}
          <Bloc titre={t('Identité et garantie')} icone={ShieldCheck}>
            <dl className="eq-identite">
              <div><dt>{t('Fournisseur')}</dt><dd>{identite.fournisseurNom || '—'}</dd></div>
              <div><dt>{t('Mise en service')}</dt><dd>{dateCourte(identite.dateExploitation)}{age != null ? ` (${tp('an', age)})` : ''}</dd></div>
              <div><dt>{t('Prix d’achat')}</dt><dd>{identite.prixAchat != null ? montant(identite.prixAchat) : '—'}</dd></div>
              {identite.codeBarre && <div><dt>{t('Code-barre')}</dt><dd className="eq-mono">{identite.codeBarre}</dd></div>}
            </dl>
            {garantiePct != null && (
              <div className="eq-garantie">
                <div className="eq-garantie-dates">
                  <span>{dateCourte(garantie.debut)}</span>
                  <span>{dateCourte(garantie.fin)}</span>
                </div>
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

          {/* ---- Maintenance préventive ---- */}
          <Bloc titre={t('Maintenance préventive')} icone={CalendarClock}>
            {preventif.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune maintenance préventive prévue pour ce type d’appareil.')}</p>
            ) : (
              <ul className="eq-preventif">
                {preventif.map((p, i) => {
                  const retard = p.joursRestants != null && p.joursRestants < 0;
                  const proche = !retard && p.joursRestants != null && p.joursRestants <= 15;
                  return (
                    <li key={`${p.libelle}-${i}`}>
                      <span>
                        <strong>{p.libelle}</strong>
                        <em>{p.intervalleJours ? t('Tous les {n} jours', { n: p.intervalleJours }) : ''}</em>
                      </span>
                      <Pastille ton={retard ? 'alerte' : proche ? 'attention' : 'info'}>
                        {p.prochaineEcheance ? dateCourte(p.prochaineEcheance) : '—'}
                      </Pastille>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloc>

          {/* ---- Connexion réseau (adresse IP) : réservée aux utilisateurs connectés ---- */}
          {connecte && <EquipementConnexion equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />}
          {connecte && <EquipementLiaisonAgent equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />}
          {connecte && <EquipementMaintenanceConditionnelle equipementId={identite.id} Bloc={Bloc} Pastille={Pastille} />}

          <Documents equipementId={identite.id} documents={documents} onChange={charger} />
        </aside>
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