import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, CalendarClock, CircleDollarSign, ExternalLink, FileText, History, Loader2, MessageSquareWarning,
  ShieldCheck, Wrench, X,
} from 'lucide-react';
import equipementService from '../../../services/equipementService';
import { t, locale } from '../../../i18n';
import './RecapImmobilisation.css';

/*
 * Récapitulatif de l'immobilisation (équipement) d'un bon, ouvert depuis le détail du bon :
 * état, garantie, disponibilité, coûts, préventif, derniers bons et réclamations — sans quitter le bon.
 * Données : la fiche de l'équipement (GET /equipements/{id}/fiche).
 */

const ETATS = {
  EN_SERVICE: { label: 'En service', ton: 'vert' },
  EN_PANNE: { label: 'En panne', ton: 'rouge' },
  EN_REPARATION: { label: 'En réparation', ton: 'bleu' },
  HORS_SERVICE: { label: 'Hors service', ton: 'gris' },
};
const CRITICITES = { C1: 'Critique', C2: 'Important', C3: 'Normal', C4: 'Faible' };
const ETATS_BON = { 1: ['Nouveau', 'bleu'], 2: ['Suspendu', 'ambre'], 3: ['En cours', 'vert'], 4: ['Effectué', 'teal'], 10: ['Annulé', 'gris'] };
const TYPES_BON = { 1: 'Curatif', 2: 'Correctif', 3: 'Préventif', 4: 'Nouvelle installation', 5: 'Autre' };
const ETATS_RECLAMATION = { 0: ['Ouverte', 'bleu'], 1: ['En cours', 'vert'], 2: ['Clôturée', 'teal'], 3: ['En attente', 'ambre'], 4: ['Rejetée', 'gris'] };
const PREVENTIF = {
  EN_RETARD: ['En retard', 'rouge'], ATTEINT: ['Échéance atteinte', 'orange'], A_VENIR: ['Bientôt', 'ambre'],
  EN_COURS: ['Bon en cours', 'bleu'], OK: ['À jour', 'vert'],
};

const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
const dt = (v) => (v == null ? '—' : `⁦${Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 })} DT⁩`);
const date = (v) => (v ? new Date(v).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
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

function Badge({ ton = 'gris', children }) {
  return <span className={`rim-badge rim-badge--${ton}`}>{children}</span>;
}

function Tuile({ icone: Icone, ton = 'neutre', valeur, label, sous }) {
  return (
    <div className={`rim-tuile rim-ton--${ton}`}>
      <span className="rim-tuile__icone"><Icone size={18} aria-hidden="true" /></span>
      <div>
        <div className="rim-tuile__valeur">{valeur}</div>
        <div className="rim-tuile__label">{label}</div>
        {sous && <div className="rim-tuile__sous">{sous}</div>}
      </div>
    </div>
  );
}

export default function RecapImmobilisation({ lotArticleImmobilistationId, bonCourantId, onFermer }) {
  const navigate = useNavigate();
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    setFiche(null);
    setErreur(null);
    equipementService.getFiche(lotArticleImmobilistationId)
      .then((f) => { if (!annule) setFiche(f); })
      .catch(() => { if (!annule) setErreur(t('Impossible de charger le récapitulatif de l’équipement.')); });
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
  const pannes = fiche?.pannes || [];
  const reclamations = fiche?.reclamations || [];
  const preventif = fiche?.preventif || [];
  const ageAns = age(id.dateExploitation);
  const curatifs12 = pannes.filter((p) => (p.type === 1 || p.type === 2) && p.dateCreation
    && Date.now() - new Date(p.dateCreation).getTime() < 365 * 86400000).length;

  const ouvrirFiche = () => { onFermer(); navigate(`/equipement/${lotArticleImmobilistationId}`); };
  const ouvrirBon = (bonId) => { if (bonId === bonCourantId) return; onFermer(); navigate(`/bons-maintenance?id=${bonId}`); };

  return (
    <div className="rim-voile" onClick={onFermer}>
      <div className="rim-fenetre" role="dialog" aria-modal="true" aria-label={t('Récapitulatif de l’équipement')} onClick={(e) => e.stopPropagation()}>
        <header className="rim-tete">
          <div className="rim-tete__texte">
            <span className="rim-surtitre">{t('Récapitulatif de l’équipement')}</span>
            <h2 dir="auto">{id.designation || t('Équipement #{id}', { id: lotArticleImmobilistationId })}</h2>
            <p dir="auto">
              {[id.marque, id.modele, id.numPiece ? t('N° {n}', { n: id.numPiece }) : null, id.codeBarre].filter(Boolean).join(' · ') || '—'}
            </p>
            {fiche && (
              <div className="rim-tete__badges">
                {etatDef && <Badge ton={etatDef.ton}>{t(etatDef.label)}{etat.depuisLe ? ` · ${t('depuis le {d}', { d: date(etat.depuisLe) })}` : ''}</Badge>}
                {etat.criticite && <Badge ton={etat.criticite === 'C1' ? 'rouge' : etat.criticite === 'C2' ? 'orange' : 'gris'}>{etat.criticite} · {t(CRITICITES[etat.criticite] || '')}</Badge>}
                {garantie?.statut === 'VALIDE' && <Badge ton="vert">{t('Sous garantie jusqu’au {d}', { d: date(garantie.fin) })}</Badge>}
                {garantie?.statut === 'EXPIREE' && <Badge ton="gris">{t('Garantie expirée le {d}', { d: date(garantie.fin) })}</Badge>}
              </div>
            )}
          </div>
          <button type="button" className="rim-fermer" onClick={onFermer} aria-label={t('Fermer')} title={t('Fermer')}><X size={18} /></button>
        </header>

        <div className="rim-corps">
          {erreur && <p className="rim-erreur">{erreur}</p>}
          {!fiche && !erreur && <div className="rim-chargement"><Loader2 size={20} className="rim-tourne" /> {t('Chargement…')}</div>}

          {fiche && (
            <>
              <div className="rim-tuiles">
                <Tuile icone={Activity} ton={dispo?.tauxDisponibilitePct == null ? 'neutre' : dispo.tauxDisponibilitePct >= 95 ? 'vert' : dispo.tauxDisponibilitePct >= 85 ? 'ambre' : 'rouge'}
                  valeur={dispo?.tauxDisponibilitePct == null ? '—' : `${nb(dispo.tauxDisponibilitePct, 1)} %`} label={t('Disponibilité (12 mois)')}
                  sous={dispo ? t('MTTR {a} · MTBF {b}', { a: heures(dispo.mttrHeures), b: heures(dispo.mtbfHeures) }) : null} />
                <Tuile icone={Wrench} ton={curatifs12 >= 4 ? 'rouge' : curatifs12 >= 2 ? 'ambre' : 'vert'}
                  valeur={nb(curatifs12)} label={t('Pannes sur 12 mois')} sous={t('{n} bons au total', { n: pannes.length })} />
                <Tuile icone={CircleDollarSign} ton="teal" valeur={dt(couts?.total)} label={t('Coût de maintenance')}
                  sous={couts?.pourcentagePrixAchat != null ? t('{p} % du prix d’achat', { p: nb(couts.pourcentagePrixAchat) }) : null} />
                <Tuile icone={CalendarClock} ton="neutre" valeur={ageAns == null ? '—' : t('{n} ans', { n: nb(ageAns, 1) })} label={t('Âge')}
                  sous={id.dateExploitation ? t('en service depuis le {d}', { d: date(id.dateExploitation) }) : t('date de mise en service inconnue')} />
              </div>

              {preventif.length > 0 && (
                <section className="rim-section">
                  <h3><ShieldCheck size={15} aria-hidden="true" /> {t('Maintenance préventive')}</h3>
                  <ul className="rim-liste">
                    {preventif.map((p, i) => {
                      const s = PREVENTIF[p.statut] || [p.statut || '—', 'gris'];
                      return (
                        <li key={i}>
                          <span className="rim-liste__texte">
                            <strong dir="auto">{p.libelle}</strong>
                            <small>
                              {p.intervalleJours ? t('tous les {n} jours', { n: p.intervalleJours }) : ''}
                              {p.derniereDate ? ` · ${t('dernière le {d}', { d: date(p.derniereDate) })}` : ''}
                              {p.prochaineEcheance ? ` · ${t('prochaine le {d}', { d: date(p.prochaineEcheance) })}` : ''}
                            </small>
                          </span>
                          <Badge ton={s[1]}>{t(s[0])}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="rim-section">
                <h3><History size={15} aria-hidden="true" /> {t('Derniers bons de maintenance')}</h3>
                {pannes.length === 0 ? <p className="rim-vide">{t('Aucun bon sur cet équipement.')}</p> : (
                  <ul className="rim-liste">
                    {pannes.slice(0, 8).map((p) => {
                      const e = ETATS_BON[p.etat] || [`État ${p.etat}`, 'gris'];
                      const courant = p.id === bonCourantId;
                      return (
                        <li key={p.id}>
                          <button type="button" className={`rim-ligne ${courant ? 'is-courant' : ''}`} onClick={() => ouvrirBon(p.id)} disabled={courant}>
                            <span className="rim-liste__texte">
                              <strong dir="auto">{p.num || `#${p.id}`} · {p.titre || t('Sans titre')}</strong>
                              <small>
                                {date(p.dateCreation)} · {t(TYPES_BON[p.type] || 'Autre')}
                                {p.dureeHeures != null ? ` · ${heures(p.dureeHeures)}` : ''}
                                {p.coutTotal ? ` · ${dt(p.coutTotal)}` : ''}
                              </small>
                            </span>
                            {courant ? <Badge ton="teal">{t('Ce bon')}</Badge> : <Badge ton={e[1]}>{t(e[0])}</Badge>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rim-section">
                <h3><MessageSquareWarning size={15} aria-hidden="true" /> {t('Dernières réclamations')}</h3>
                {reclamations.length === 0 ? <p className="rim-vide">{t('Aucune réclamation sur cet équipement.')}</p> : (
                  <ul className="rim-liste">
                    {reclamations.slice(0, 5).map((r) => {
                      const e = ETATS_RECLAMATION[r.etat] || ['—', 'gris'];
                      return (
                        <li key={r.id}>
                          <span className="rim-liste__texte">
                            <strong dir="auto">{r.num || `#${r.id}`} · {r.description || '—'}</strong>
                            <small>{date(r.date)}{r.personnelCreationNom ? ` · ${r.personnelCreationNom}` : ''}</small>
                          </span>
                          <Badge ton={e[1]}>{t(e[0])}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {(fiche.documents || []).length > 0 && (
                <p className="rim-note"><FileText size={14} aria-hidden="true" /> {t('{n} document(s) dans la fiche (notices, certificats…)', { n: fiche.documents.length })}</p>
              )}
            </>
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
