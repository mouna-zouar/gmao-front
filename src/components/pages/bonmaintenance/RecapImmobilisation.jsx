import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, CalendarClock, CircleDollarSign, ExternalLink, FileText, History, Info, Loader2,
  MessageSquareWarning, Package, ShieldCheck, Wrench, X,
} from 'lucide-react';
import equipementService from '../../../services/equipementService';
import etatEquipementService from '../../../services/Etatequipementservice';
import Pagination from '../../commun/Pagination';
import { CATEGORIES_DOCUMENT } from '../Equipements/equipementLibelles';
import { t, locale } from '../../../i18n';
import './RecapImmobilisation.css';

/*
 * Récapitulatif complet de l'immobilisation (équipement) d'un bon, ouvert depuis le détail du bon, sans le quitter :
 * identité et achat (prix, fournisseur, mise en service), garantie, disponibilité, coûts détaillés,
 * maintenance préventive, tous les bons de maintenance, l'historique des états, les réclamations et les documents.
 * Données : GET /equipements/{id}/fiche et GET /etat-equipement/{id}/historique.
 */

const ETATS = {
  EN_SERVICE: { label: 'En service', ton: 'ok' },
  EN_PANNE: { label: 'En panne', ton: 'alerte' },
  EN_REPARATION: { label: 'En réparation', ton: 'attention' },
  HORS_SERVICE: { label: 'Hors service', ton: 'neutre' },
};
const CRITICITES = { C1: 'Critique', C2: 'Important', C3: 'Normal', C4: 'Faible' };
const ETATS_BON = { 1: ['Nouveau', 'neutre'], 2: ['Suspendu', 'attention'], 3: ['En cours', 'attention'], 4: ['Effectué', 'ok'], 10: ['Annulé', 'neutre'] };
const TYPES_BON = { 1: 'Curatif', 2: 'Correctif', 3: 'Préventif', 4: 'Nouvelle installation', 5: 'Autre' };
const ETATS_RECLAMATION = { 0: ['Ouverte', 'attention'], 1: ['En cours', 'attention'], 2: ['Clôturée', 'ok'], 3: ['En attente', 'attention'], 4: ['Rejetée', 'neutre'] };
const PREVENTIF = {
  EN_RETARD: ['En retard', 'alerte'], ATTEINT: ['Échéance atteinte', 'alerte'], A_VENIR: ['Bientôt', 'attention'],
  EN_COURS: ['Bon en cours', 'attention'], OK: ['À jour', 'ok'],
};
const ONGLETS = [
  { cle: 'resume', label: 'Résumé', icone: Info },
  { cle: 'couts', label: 'Coûts', icone: CircleDollarSign },
  { cle: 'bons', label: 'Bons de maintenance', icone: Wrench },
  { cle: 'historique', label: 'Historique', icone: History },
  { cle: 'reclamations', label: 'Réclamations', icone: MessageSquareWarning },
  { cle: 'documents', label: 'Documents', icone: FileText },
];
const TAILLE = 10;

const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
const dt = (v, d = 0) => (v == null ? '—' : `⁦${Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d })} DT⁩`);
const date = (v) => (v ? new Date(v).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const dateHeure = (v) => (v ? new Date(v).toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const heures = (h) => {
  if (h == null) return '—';
  if (h < 48) return t('{n} h', { n: nb(h, 1) });
  return t('{n} j', { n: nb(h / 24, 1) });
};
const age = (iso) => {
  if (!iso) return null;
  const ans = (Date.now() - new Date(iso).getTime()) / (365.25 * 86400000);
  return ans >= 0 ? ans : null;
};
const taille = (o) => (o == null ? '' : o < 1024 * 1024 ? `${nb(o / 1024)} Ko` : `${nb(o / 1024 / 1024, 1)} Mo`);
const libelleEtat = (e) => (ETATS[e] ? t(ETATS[e].label) : (e || '—'));

/* Petite étiquette neutre ; seul le point indique un état (vert / orange / rouge) */
function Etat({ ton = 'neutre', children }) {
  return <span className={`rim-etat rim-point--${ton}`}>{children}</span>;
}

function Tuile({ icone: Icone, valeur, label, sous, ton }) {
  return (
    <div className="rim-tuile">
      <div className="rim-tuile__haut"><Icone size={15} aria-hidden="true" /> {label}</div>
      <div className={`rim-tuile__valeur ${ton ? `rim-point--${ton}` : ''}`}>{valeur}</div>
      {sous && <div className="rim-tuile__sous">{sous}</div>}
    </div>
  );
}

function Champs({ lignes }) {
  return (
    <dl className="rim-champs">
      {lignes.filter(Boolean).map(([label, valeur]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd dir="auto" title={typeof valeur === 'string' ? valeur : undefined}>{valeur ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Vide({ children }) {
  return <p className="rim-vide">{children}</p>;
}

export default function RecapImmobilisation({ lotArticleImmobilistationId, bonCourantId, onFermer }) {
  const navigate = useNavigate();
  const [fiche, setFiche] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState('resume');
  const [pages, setPages] = useState({ bons: 0, historique: 0, reclamations: 0 });

  useEffect(() => {
    let annule = false;
    setFiche(null);
    setHistorique(null);
    setErreur(null);
    equipementService.getFiche(lotArticleImmobilistationId)
      .then((f) => { if (!annule) setFiche(f); })
      .catch(() => { if (!annule) setErreur(t('Impossible de charger le récapitulatif de l’équipement.')); });
    etatEquipementService.getHistorique(lotArticleImmobilistationId)
      .then((h) => { if (!annule) setHistorique(Array.isArray(h) ? h : (h?.content ?? [])); })
      .catch(() => { if (!annule) setHistorique([]); });
    const echap = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', echap);
    return () => { annule = true; window.removeEventListener('keydown', echap); };
  }, [lotArticleImmobilistationId, onFermer]);

  const id = fiche?.identite || {};
  const etat = fiche?.etat || {};
  const etatDef = ETATS[etat.etatActuel];
  const dispo = fiche?.disponibilite;
  const couts = fiche?.couts;
  const garantie = fiche?.garantie;
  const pannes = useMemo(() => fiche?.pannes || [], [fiche]);
  const reclamations = fiche?.reclamations || [];
  const preventif = fiche?.preventif || [];
  const documents = fiche?.documents || [];
  const transitions = useMemo(
    () => [...(historique || [])].sort((a, b) => new Date(b.dateTransition) - new Date(a.dateTransition)),
    [historique],
  );
  const ageAns = age(id.dateExploitation);
  const curatifs12 = pannes.filter((p) => (p.type === 1 || p.type === 2) && p.dateCreation
    && Date.now() - new Date(p.dateCreation).getTime() < 365 * 86400000).length;
  const bonsAvecCout = pannes.filter((p) => p.coutTotal != null && p.coutTotal > 0);
  const coutMoyen = bonsAvecCout.length ? bonsAvecCout.reduce((s, p) => s + p.coutTotal, 0) / bonsAvecCout.length : null;
  const plusChers = [...bonsAvecCout].sort((a, b) => b.coutTotal - a.coutTotal).slice(0, 5);
  const coutsParAn = useMemo(() => {
    const m = new Map();
    pannes.forEach((p) => {
      if (!p.dateCreation || !p.coutTotal) return;
      const an = new Date(p.dateCreation).getFullYear();
      m.set(an, (m.get(an) || 0) + p.coutTotal);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [pannes]);
  const maxAn = Math.max(1, ...coutsParAn.map(([, v]) => v));

  const ouvrirFiche = () => { onFermer(); navigate(`/equipement/${lotArticleImmobilistationId}`); };
  const ouvrirBon = (bonId) => { if (bonId === bonCourantId) return; onFermer(); navigate(`/bons-maintenance?id=${bonId}`); };
  const page = (cle) => pages[cle];
  const changerPage = (cle) => (p) => setPages((x) => ({ ...x, [cle]: p }));
  const tranche = (liste, cle) => liste.slice(page(cle) * TAILLE, page(cle) * TAILLE + TAILLE);

  const compte = { bons: pannes.length, historique: transitions.length, reclamations: reclamations.length, documents: documents.length };
  const repartition = couts && couts.total > 0
    ? [
      { cle: 'mo', label: t('Main-d’œuvre'), valeur: couts.mainOeuvre || 0 },
      { cle: 'pieces', label: t('Pièces du dépôt'), valeur: couts.piecesDepot || 0 },
      { cle: 'achats', label: t('Achats'), valeur: couts.achats || 0 },
    ]
    : [];

  return (
    <div className="rim-voile" onClick={onFermer}>
      <div className="rim-fenetre" role="dialog" aria-modal="true" aria-label={t('Récapitulatif de l’équipement')} onClick={(e) => e.stopPropagation()}>
        <header className="rim-tete">
          <span className="rim-tete__icone"><Package size={20} aria-hidden="true" /></span>
          <div className="rim-tete__texte">
            <span className="rim-surtitre">{t('Récapitulatif de l’équipement')}</span>
            <h2 dir="auto">{id.designation || t('Équipement #{id}', { id: lotArticleImmobilistationId })}</h2>
            <p dir="auto">
              {[id.marque, id.modele, id.numPiece ? t('N° {n}', { n: id.numPiece }) : null, id.codeBarre].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          {fiche && (
            <div className="rim-tete__etats">
              {etatDef && <Etat ton={etatDef.ton}>{t(etatDef.label)}</Etat>}
              {etat.criticite && <Etat ton={etat.criticite === 'C1' ? 'alerte' : etat.criticite === 'C2' ? 'attention' : 'neutre'}>{etat.criticite} · {t(CRITICITES[etat.criticite] || '')}</Etat>}
              {garantie?.statut === 'VALIDE' && <Etat ton="ok">{t('Sous garantie')}</Etat>}
              {garantie?.statut === 'EXPIREE' && <Etat>{t('Garantie expirée')}</Etat>}
            </div>
          )}
          <button type="button" className="rim-fermer" onClick={onFermer} aria-label={t('Fermer')} title={t('Fermer')}><X size={18} /></button>
        </header>

        {fiche && (
          <nav className="rim-onglets" role="tablist" aria-label={t('Rubriques du récapitulatif')}>
            {ONGLETS.map((o) => {
              const Icone = o.icone;
              return (
                <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
                  className={`rim-onglet ${onglet === o.cle ? 'is-actif' : ''}`} onClick={() => setOnglet(o.cle)}>
                  <Icone size={15} aria-hidden="true" /> {t(o.label)}
                  {compte[o.cle] != null && <span className="rim-onglet__nb">{o.cle === 'historique' && historique == null ? '…' : compte[o.cle]}</span>}
                </button>
              );
            })}
          </nav>
        )}

        <div className="rim-corps">
          {erreur && <p className="rim-erreur"><AlertTriangle size={16} /> {erreur}</p>}
          {!fiche && !erreur && <div className="rim-chargement"><Loader2 size={20} className="rim-tourne" /> {t('Chargement…')}</div>}

          {/* ===== Résumé ===== */}
          {fiche && onglet === 'resume' && (
            <>
              {!id.complet && (
                <p className="rim-note"><Info size={14} /> {t('Les informations d’achat n’ont pas pu être lues dans MEDSYS : seules les données de la GMAO sont affichées.')}</p>
              )}
              <div className="rim-tuiles">
                <Tuile icone={Activity} label={t('Disponibilité (12 mois)')}
                  ton={dispo?.tauxDisponibilitePct == null ? null : dispo.tauxDisponibilitePct >= 95 ? 'ok' : dispo.tauxDisponibilitePct >= 85 ? 'attention' : 'alerte'}
                  valeur={dispo?.tauxDisponibilitePct == null ? '—' : `${nb(dispo.tauxDisponibilitePct, 1)} %`}
                  sous={dispo ? t('MTTR {a} · MTBF {b}', { a: heures(dispo.mttrHeures), b: heures(dispo.mtbfHeures) }) : null} />
                <Tuile icone={Wrench} label={t('Pannes sur 12 mois')} ton={curatifs12 >= 4 ? 'alerte' : curatifs12 >= 2 ? 'attention' : null}
                  valeur={nb(curatifs12)} sous={t('{n} bons au total', { n: pannes.length })} />
                <Tuile icone={CircleDollarSign} label={t('Coût de maintenance')} valeur={dt(couts?.total)}
                  sous={couts?.pourcentagePrixAchat != null ? t('{p} % du prix d’achat', { p: nb(couts.pourcentagePrixAchat, 1) }) : null} />
                <Tuile icone={CalendarClock} label={t('Âge')} valeur={ageAns == null ? '—' : t('{n} ans', { n: nb(ageAns, 1) })}
                  sous={id.dateExploitation ? t('en service depuis le {d}', { d: date(id.dateExploitation) }) : t('date de mise en service inconnue')} />
              </div>

              <div className="rim-deux">
                <section className="rim-carte">
                  <h3>{t('Identité et achat')}</h3>
                  <Champs lignes={[
                    [t('Désignation'), id.designation],
                    [t('Marque'), id.marque],
                    [t('Modèle'), id.modele],
                    [t('N° de série'), id.numPiece],
                    [t('N° d’inventaire'), id.num != null ? String(id.num) : null],
                    [t('Code-barre'), id.codeBarre],
                    [t('Fournisseur'), id.fournisseurNom],
                    [t('Prix d’achat'), id.prixAchat != null ? dt(id.prixAchat, 3) : null],
                    [t('Mise en service'), id.dateExploitation ? date(id.dateExploitation) : null],
                  ]} />
                </section>
                <div className="rim-pile">
                  <section className="rim-carte">
                    <h3>{t('Garantie')}</h3>
                    {!garantie || garantie.statut === 'INCONNUE' ? <Vide>{t('Garantie non renseignée.')}</Vide> : (
                      <>
                        <Champs lignes={[
                          [t('Début'), date(garantie.debut)],
                          [t('Fin'), date(garantie.fin)],
                          [t('Statut'), <Etat key="s" ton={garantie.statut === 'VALIDE' ? (garantie.joursRestants != null && garantie.joursRestants <= 60 ? 'attention' : 'ok') : 'neutre'}>
                            {garantie.statut === 'VALIDE' ? t('Valide') : t('Expirée')}
                          </Etat>],
                          [garantie.statut === 'VALIDE' ? t('Reste') : t('Expirée depuis'),
                            garantie.joursRestants == null ? '—' : t('{n} jours', { n: nb(Math.abs(garantie.joursRestants)) })],
                        ]} />
                        {garantie.statut === 'VALIDE' && <p className="rim-astuce">{t('Pendant la garantie, faites intervenir le fournisseur avant toute réparation payante.')}</p>}
                      </>
                    )}
                  </section>
                  <section className="rim-carte">
                    <h3>{t('Disponibilité (12 mois)')}</h3>
                    {!dispo ? <Vide>{t('Pas encore de données de disponibilité.')}</Vide> : (
                      <Champs lignes={[
                        [t('Taux de disponibilité'), dispo.tauxDisponibilitePct == null ? '—' : `${nb(dispo.tauxDisponibilitePct, 1)} %`],
                        [t('Nombre de pannes'), nb(dispo.nbPannes)],
                        [t('Temps moyen de réparation (MTTR)'), heures(dispo.mttrHeures)],
                        [t('Temps moyen entre pannes (MTBF)'), heures(dispo.mtbfHeures)],
                      ]} />
                    )}
                  </section>
                </div>
              </div>

              <section className="rim-carte">
                <h3><ShieldCheck size={15} aria-hidden="true" /> {t('Maintenance préventive')}</h3>
                {preventif.length === 0 ? <Vide>{t('Aucun plan préventif sur cet équipement.')}</Vide> : (
                  <ul className="rim-liste">
                    {preventif.map((p, i) => {
                      const s = PREVENTIF[p.statut] || [p.statut || '—', 'neutre'];
                      return (
                        <li key={i} className="rim-ligne">
                          <span className="rim-ligne__texte">
                            <strong dir="auto">{p.libelle}</strong>
                            <small>
                              {p.intervalleJours ? t('tous les {n} jours', { n: p.intervalleJours }) : ''}
                              {p.derniereDate ? ` · ${t('dernière le {d}', { d: date(p.derniereDate) })}` : ''}
                              {p.prochaineEcheance ? ` · ${t('prochaine le {d}', { d: date(p.prochaineEcheance) })}` : ''}
                            </small>
                          </span>
                          <Etat ton={s[1]}>{t(s[0])}</Etat>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {id.ficheTechnique && (
                <section className="rim-carte">
                  <h3>{t('Fiche technique')}</h3>
                  <p className="rim-texte" dir="auto">{id.ficheTechnique}</p>
                </section>
              )}
            </>
          )}

          {/* ===== Coûts ===== */}
          {fiche && onglet === 'couts' && (
            <>
              <div className="rim-tuiles">
                <Tuile icone={CircleDollarSign} label={t('Coût total de maintenance')} valeur={dt(couts?.total)} />
                <Tuile icone={Package} label={t('Prix d’achat')} valeur={id.prixAchat != null ? dt(id.prixAchat) : '—'}
                  sous={couts?.pourcentagePrixAchat != null ? t('maintenance = {p} % du prix', { p: nb(couts.pourcentagePrixAchat, 1) }) : null}
                  ton={couts?.pourcentagePrixAchat >= 60 ? 'alerte' : couts?.pourcentagePrixAchat >= 35 ? 'attention' : null} />
                <Tuile icone={Wrench} label={t('Coût moyen par bon')} valeur={coutMoyen == null ? '—' : dt(coutMoyen)}
                  sous={t('{n} bons avec un coût', { n: bonsAvecCout.length })} />
                <Tuile icone={CalendarClock} label={t('Coût par an de service')}
                  valeur={ageAns && couts?.total ? dt(couts.total / Math.max(ageAns, 1)) : '—'} />
              </div>

              <section className="rim-carte">
                <h3>{t('Répartition du coût')}</h3>
                {repartition.length === 0 ? <Vide>{t('Aucun coût enregistré pour cet équipement.')}</Vide> : (
                  <>
                    <div className="rim-barre" aria-hidden="true">
                      {repartition.map((r) => r.valeur > 0 && (
                        <span key={r.cle} className={`is-${r.cle}`} style={{ width: `${(r.valeur / couts.total) * 100}%` }} />
                      ))}
                    </div>
                    <ul className="rim-liste">
                      {repartition.map((r) => (
                        <li key={r.cle} className="rim-ligne">
                          <span className={`rim-puce is-${r.cle}`} aria-hidden="true" />
                          <span className="rim-ligne__texte"><strong>{r.label}</strong></span>
                          <span className="rim-montant">{dt(r.valeur)}</span>
                          <span className="rim-pct">{nb((r.valeur / couts.total) * 100)} %</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <div className="rim-deux">
                <section className="rim-carte">
                  <h3>{t('Coût par année')}</h3>
                  {coutsParAn.length === 0 ? <Vide>{t('Aucun coût enregistré pour cet équipement.')}</Vide> : (
                    <ul className="rim-annees">
                      {coutsParAn.map(([an, v]) => (
                        <li key={an}>
                          <span className="rim-annees__an">{an}</span>
                          <span className="rim-annees__piste"><span style={{ width: `${(v / maxAn) * 100}%` }} /></span>
                          <span className="rim-montant">{dt(v)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rim-carte">
                  <h3>{t('Bons les plus coûteux')}</h3>
                  {plusChers.length === 0 ? <Vide>{t('Aucun coût enregistré pour cet équipement.')}</Vide> : (
                    <ul className="rim-liste">
                      {plusChers.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="rim-ligne rim-ligne--bouton" onClick={() => ouvrirBon(p.id)} disabled={p.id === bonCourantId}>
                            <span className="rim-ligne__texte">
                              <strong dir="auto">{p.num || `#${p.id}`} · {p.titre || t('Sans titre')}</strong>
                              <small>{date(p.dateCreation)} · {t(TYPES_BON[p.type] || 'Autre')}</small>
                            </span>
                            <span className="rim-montant">{dt(p.coutTotal)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}

          {/* ===== Bons de maintenance ===== */}
          {fiche && onglet === 'bons' && (
            <section className="rim-carte">
              <h3>{t('Tous les bons de maintenance')}</h3>
              {pannes.length === 0 ? <Vide>{t('Aucun bon sur cet équipement.')}</Vide> : (
                <>
                  <div className="rim-tableau-cadre">
                    <table className="rim-tableau">
                      <thead>
                        <tr>
                          <th>{t('N°')}</th><th>{t('Titre')}</th><th>{t('Type')}</th><th>{t('Créé le')}</th>
                          <th>{t('Clôturé le')}</th><th>{t('Durée')}</th><th className="rim-droite">{t('Coût')}</th><th>{t('État')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tranche(pannes, 'bons').map((p) => {
                          const e = ETATS_BON[p.etat] || [`État ${p.etat}`, 'neutre'];
                          const courant = p.id === bonCourantId;
                          return (
                            <tr key={p.id} className={courant ? 'is-courant' : ''} onClick={() => ouvrirBon(p.id)}
                              title={courant ? t('Ce bon') : t('Ouvrir le bon')}>
                              <td className="rim-fort">{p.num || `#${p.id}`}</td>
                              <td dir="auto">{p.titre || '—'}</td>
                              <td>{t(TYPES_BON[p.type] || 'Autre')}</td>
                              <td>{date(p.dateCreation)}</td>
                              <td>{date(p.dateCloture)}</td>
                              <td>{heures(p.dureeHeures)}</td>
                              <td className="rim-droite">{p.coutTotal ? dt(p.coutTotal) : '—'}</td>
                              <td>{courant ? <Etat ton="ok">{t('Ce bon')}</Etat> : <Etat ton={e[1]}>{t(e[0])}</Etat>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page('bons')} taille={TAILLE} total={pannes.length} onPage={changerPage('bons')} masquerSiUnePage />
                </>
              )}
            </section>
          )}

          {/* ===== Historique des états ===== */}
          {fiche && onglet === 'historique' && (
            <section className="rim-carte">
              <h3>{t('Historique des états de l’équipement')}</h3>
              {historique == null ? <div className="rim-chargement"><Loader2 size={18} className="rim-tourne" /> {t('Chargement…')}</div>
                : transitions.length === 0 ? <Vide>{t('Aucun changement d’état enregistré.')}</Vide> : (
                  <>
                    <ol className="rim-chrono">
                      {tranche(transitions, 'historique').map((h, i) => (
                        <li key={h.id ?? i}>
                          <span className={`rim-chrono__point rim-point--${ETATS[h.etatNouveau]?.ton || 'neutre'}`} aria-hidden="true" />
                          <div className="rim-chrono__texte">
                            <strong>
                              {h.etatPrecedent ? <>{libelleEtat(h.etatPrecedent)} <ArrowRight size={13} className="rtl-miroir" aria-hidden="true" /> </> : <>{t('Première détection :')} </>}
                              {libelleEtat(h.etatNouveau)}
                            </strong>
                            <small>
                              {dateHeure(h.dateTransition)}
                              {h.motif ? ` · ${h.motif}` : ''}
                            </small>
                          </div>
                          {h.bonMaintenanceId && (
                            <button type="button" className="rim-lien" onClick={() => ouvrirBon(h.bonMaintenanceId)} disabled={h.bonMaintenanceId === bonCourantId}>
                              {h.bonMaintenanceNum || `#${h.bonMaintenanceId}`}
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                    <Pagination page={page('historique')} taille={TAILLE} total={transitions.length} onPage={changerPage('historique')} masquerSiUnePage />
                  </>
                )}
            </section>
          )}

          {/* ===== Réclamations ===== */}
          {fiche && onglet === 'reclamations' && (
            <section className="rim-carte">
              <h3>{t('Toutes les réclamations')}</h3>
              {reclamations.length === 0 ? <Vide>{t('Aucune réclamation sur cet équipement.')}</Vide> : (
                <>
                  <ul className="rim-liste">
                    {tranche(reclamations, 'reclamations').map((r) => {
                      const e = ETATS_RECLAMATION[r.etat] || ['—', 'neutre'];
                      return (
                        <li key={r.id} className="rim-ligne">
                          <span className="rim-ligne__texte">
                            <strong dir="auto">{r.num || `#${r.id}`} · {r.description || '—'}</strong>
                            <small>{date(r.date)}{r.personnelCreationNom ? ` · ${r.personnelCreationNom}` : ''}</small>
                          </span>
                          <Etat ton={e[1]}>{t(e[0])}</Etat>
                        </li>
                      );
                    })}
                  </ul>
                  <Pagination page={page('reclamations')} taille={TAILLE} total={reclamations.length} onPage={changerPage('reclamations')} masquerSiUnePage />
                </>
              )}
            </section>
          )}

          {/* ===== Documents ===== */}
          {fiche && onglet === 'documents' && (
            <section className="rim-carte">
              <h3>{t('Documents de l’équipement')}</h3>
              {documents.length === 0 ? <Vide>{t('Aucun document (notice, certificat, facture…) dans la fiche.')}</Vide> : (
                <ul className="rim-liste">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <a className="rim-ligne rim-ligne--bouton" href={equipementService.urlDocument(d.id)} target="_blank" rel="noreferrer">
                        <FileText size={16} className="rim-gris" aria-hidden="true" />
                        <span className="rim-ligne__texte">
                          <strong dir="auto">{d.titre || d.nomFichier}</strong>
                          <small>
                            {t(CATEGORIES_DOCUMENT[d.categorie] || d.categorie || 'Autre')}
                            {d.dateAjout ? ` · ${date(d.dateAjout)}` : ''}
                            {d.ajouteParNom ? ` · ${d.ajouteParNom}` : ''}
                            {d.taille ? ` · ${taille(d.taille)}` : ''}
                          </small>
                        </span>
                        <ExternalLink size={15} className="rim-gris" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <footer className="rim-pied">
          <button type="button" className="rim-btn" onClick={onFermer}>{t('Fermer')}</button>
          <button type="button" className="rim-btn rim-btn--principal" onClick={ouvrirFiche}>
            <ExternalLink size={15} /> {t('Ouvrir la fiche complète')}
          </button>
        </footer>
      </div>
    </div>
  );
}
