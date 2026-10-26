import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, CalendarSync, ChevronDown, Info, LoaderCircle, Play, Plus, RefreshCw, Save, Search, Trash2, X,
} from 'lucide-react';
import renouvellementService from '../../../services/renouvellementService';
import { t, locale } from '../../../i18n';
import {
  VeillePage, VeilleKpis, VeilleSegments, VeilleMessage, VeillePagination, Pastille,
} from '../../ui/Veille/Veille';
import './Renouvellement.css';

/*
 * « Plan de renouvellement » (équivalent de Maximo Asset Investment Planning) :
 *  - Classement : score de renouvellement sur 100 (âge, coût de maintenance / prix, pannes, criticité, avis de l'IA),
 *    recommandation, année conseillée et coût de remplacement, ajustables à la main ;
 *  - Scénarios : budgets annuels comparés sur plusieurs années (ce qui est remplacé, ce qui reste à risque) ;
 *  - Réglages : durée de vie par famille d'équipements.
 */

/* Parts du score : ordre et couleurs fixes (palette catégorielle validée). */
const PARTS = [
  { cle: 'age', label: 'Âge', couleur: '#0794a4' },
  { cle: 'cout', label: 'Coût', couleur: '#eb6834' },
  { cle: 'fiabilite', label: 'Pannes', couleur: '#6a5acd' },
  { cle: 'criticite', label: 'Criticité', couleur: '#eda100' },
  { cle: 'ia', label: 'Avis IA', couleur: '#e87ba4' },
];
const COULEURS_SCENARIOS = ['#0794a4', '#eb6834', '#6a5acd', '#eda100'];

export const RECOS = {
  REMPLACER: { label: 'À remplacer', ton: 'danger' },
  PLANIFIER: { label: 'À planifier', ton: 'orange' },
  SURVEILLER: { label: 'À surveiller', ton: 'attention' },
  CONSERVER: { label: 'À conserver', ton: 'succes' },
  EXCLU: { label: 'Exclu du plan', ton: 'neutre' },
};
const CRITICITES = { C1: 'Critique', C2: 'Important', C3: 'Normal', C4: 'Faible' };
const CLE_SCENARIOS = 'gmao.renouvellement.scenarios';
const CLE_ONGLET = 'gmao.renouvellement.onglet';

const lireLocal = (cle, defaut) => { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; } };
const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

const dt = (v, court = false) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  // Isolé de gauche à droite : en arabe, « 693 k DT » ne doit pas s'afficher « k DT 693 »
  if (court && Math.abs(n) >= 1000) return `\u2066${(n / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} k DT\u2069`;
  return `\u2066${n.toLocaleString(locale(), { maximumFractionDigits: 0 })} DT\u2069`;
};
const nb = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

function useLargeur() {
  const ref = useRef(null);
  const [l, setL] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    setL(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setL(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, l];
}

/* ---------- Barre du score, en 5 parts ---------- */
function BarreScore({ score }) {
  return (
    <div className="rv-score" title={PARTS.map((p) => `${t(p.label)} : ${nb(score[p.cle], 1)}`).join(' · ')}>
      <span className="rv-score__piste" role="img" aria-label={t('Score {s} sur 100', { s: nb(score.total, 0) })}>
        {PARTS.map((p) => score[p.cle] > 0 && (
          <span key={p.cle} style={{ width: `${score[p.cle]}%`, background: p.couleur }} />
        ))}
      </span>
      <strong>{nb(score.total, 0)}</strong>
    </div>
  );
}

/* ---------- Graphiques des scénarios (SVG, info-bulle au survol) ---------- */
function Bulle({ b }) {
  if (!b) return null;
  return (
    <div className="rv-bulle" style={{ left: b.x, top: b.y, transform: b.gauche ? 'translate(calc(-100% - 10px), 0)' : 'translate(10px, 0)' }}>
      <div className="rv-bulle__titre">{b.titre}</div>
      {b.lignes.map((l) => (
        <div key={l.label} className="rv-bulle__ligne">
          <span className="rv-bulle__marque" style={{ background: l.couleur }} />
          <span>{l.label}</span><b>{l.valeur}</b>
        </div>
      ))}
    </div>
  );
}

function graduations(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut);
  const l = [];
  for (let v = 0; v <= max + pas / 2; v += pas) l.push(v);
  if (l[l.length - 1] < max) l.push(l[l.length - 1] + pas);
  return l;
}

function GraphiqueDepenses({ resultats }) {
  const [ref, w] = useLargeur();
  const [bulle, setBulle] = useState(null);
  const annees = resultats[0]?.annees.map((a) => a.annee) || [];
  const h = 230; const m = { g: 58, d: 8, h: 10, b: 26 };
  const max = Math.max(1, ...resultats.flatMap((r) => r.annees.map((a) => Math.max(a.depense, a.budget))));
  const ticks = graduations(max);
  const yMax = ticks[ticks.length - 1];
  const iw = Math.max(0, w - m.g - m.d); const ih = h - m.h - m.b;
  const bande = iw / Math.max(1, annees.length);
  const lb = Math.max(4, Math.min(28, (bande * 0.72) / resultats.length - 2));
  const y = (v) => m.h + ih - (v / yMax) * ih;
  return (
    <div className="rv-graph" ref={ref} dir="ltr" onMouseLeave={() => setBulle(null)}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Dépenses de remplacement par année et par scénario')}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="rv-grille" />
              <text x={m.g - 6} y={y(v)} className="rv-axe" textAnchor="end" dominantBaseline="middle">{dt(v, true)}</text>
            </g>
          ))}
          {annees.map((an, i) => {
            const x0 = m.g + i * bande + (bande - resultats.length * (lb + 2)) / 2;
            return (
              <g key={an}>
                {resultats.map((r, k) => {
                  const a = r.annees[i];
                  return (
                    <g key={k}>
                      <rect x={x0 + k * (lb + 2)} y={y(a.depense)} width={lb} height={Math.max(a.depense > 0 ? 1 : 0, y(0) - y(a.depense))}
                        rx={Math.min(3, lb / 2)} fill={COULEURS_SCENARIOS[k]} />
                      <line x1={x0 + k * (lb + 2) - 1} x2={x0 + k * (lb + 2) + lb + 1} y1={y(a.budget)} y2={y(a.budget)} className="rv-budget" />
                    </g>
                  );
                })}
                <text x={m.g + i * bande + bande / 2} y={h - 7} className="rv-axe" textAnchor="middle">{an}</text>
                <rect x={m.g + i * bande} y={m.h} width={bande} height={ih} fill="transparent"
                  onMouseMove={(e) => {
                    const box = ref.current.getBoundingClientRect();
                    const px = e.clientX - box.left;
                    setBulle({
                      x: px, y: Math.max(0, e.clientY - box.top - 40), gauche: px > w * 0.6, titre: String(an),
                      lignes: resultats.map((r, k) => ({ couleur: COULEURS_SCENARIOS[k], label: r.scenario.nom,
                        valeur: `${dt(r.annees[i].depense, true)} / ${dt(r.annees[i].budget, true)}` })),
                    });
                  }} />
              </g>
            );
          })}
          <line x1={m.g} x2={w - m.d} y1={y(0)} y2={y(0)} className="rv-axe-ligne" />
        </svg>
      )}
      <Bulle b={bulle} />
    </div>
  );
}

function GraphiqueRisque({ resultats }) {
  const [ref, w] = useLargeur();
  const [bulle, setBulle] = useState(null);
  const annees = resultats[0]?.annees.map((a) => a.annee) || [];
  const h = 230; const m = { g: 40, d: 12, h: 12, b: 26 };
  const max = Math.max(1, ...resultats.flatMap((r) => r.annees.map((a) => a.aRemplacerRestants)));
  const ticks = graduations(max).filter((v) => Number.isInteger(v));
  const yMax = ticks[ticks.length - 1] || 1;
  const iw = Math.max(0, w - m.g - m.d); const ih = h - m.h - m.b;
  const x = (i) => m.g + (annees.length <= 1 ? iw / 2 : (i / (annees.length - 1)) * iw);
  const y = (v) => m.h + ih - (v / yMax) * ih;
  return (
    <div className="rv-graph" ref={ref} dir="ltr" onMouseLeave={() => setBulle(null)}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Équipements à remplacer encore en service, par scénario')}
          onMouseMove={(e) => {
            const box = ref.current.getBoundingClientRect();
            const px = e.clientX - box.left;
            const i = Math.max(0, Math.min(annees.length - 1, Math.round(((px - m.g) / Math.max(1, iw)) * (annees.length - 1))));
            setBulle({
              i, x: px, y: 10, gauche: px > w * 0.6, titre: t('Fin {a}', { a: annees[i] }),
              lignes: resultats.map((r, k) => ({ couleur: COULEURS_SCENARIOS[k], label: r.scenario.nom, valeur: nb(r.annees[i].aRemplacerRestants) })),
            });
          }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="rv-grille" />
              <text x={m.g - 6} y={y(v)} className="rv-axe" textAnchor="end" dominantBaseline="middle">{v}</text>
            </g>
          ))}
          {annees.map((an, i) => <text key={an} x={x(i)} y={h - 7} className="rv-axe" textAnchor="middle">{an}</text>)}
          {resultats.map((r, k) => (
            <g key={k}>
              <path d={r.annees.map((a, i) => `${i ? 'L' : 'M'}${x(i)},${y(a.aRemplacerRestants)}`).join('')}
                fill="none" stroke={COULEURS_SCENARIOS[k]} strokeWidth="2" strokeLinejoin="round" />
              {r.annees.map((a, i) => <circle key={i} cx={x(i)} cy={y(a.aRemplacerRestants)} r={bulle?.i === i ? 4.5 : 3}
                fill={COULEURS_SCENARIOS[k]} stroke="#fff" strokeWidth="1.5" />)}
            </g>
          ))}
          {bulle && <line x1={x(bulle.i)} x2={x(bulle.i)} y1={m.h} y2={m.h + ih} className="rv-viseur" />}
        </svg>
      )}
      <Bulle b={bulle} />
    </div>
  );
}

/* ---------- Page ---------- */
export default function Renouvellement() {
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState(() => lireLocal(CLE_ONGLET, 'classement'));

  const charger = useCallback(async (recalculer = false) => {
    setChargement(true);
    try {
      setDonnees(await renouvellementService.tableau(recalculer));
      setErreur(null);
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le plan de renouvellement.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const choisirOnglet = (o) => { setOnglet(o); ecrireLocal(CLE_ONGLET, o); };
  const majLigne = (ligne) => setDonnees((d) => ({ ...d, lignes: d.lignes.map((l) => (l.id === ligne.id ? ligne : l)) }));

  const ind = donnees?.indicateurs || {};
  const actions = (
    <button type="button" className="vl-btn" onClick={() => charger(true)} disabled={chargement}
      title={t('Relit les coûts, les pannes et les rapports (sinon gardés 10 minutes)')}>
      {chargement ? <LoaderCircle size={15} className="vl-tourne" /> : <RefreshCw size={15} />} {t('Recalculer')}
    </button>
  );

  return (
    <VeillePage icone={CalendarSync} titre={t('Plan de renouvellement')}
      description={t('Quels équipements remplacer, quand, et avec quel budget : âge, coût de maintenance, pannes, criticité et avis de l’IA.')}
      actions={actions} className="rv-page">
      {erreur && <VeilleMessage ton="danger">{erreur}</VeilleMessage>}
      {!donnees && !erreur && <p className="rv-chargement"><LoaderCircle size={20} className="vl-tourne" /> {t('Analyse du parc…')}</p>}
      {donnees && (
        <>
          <VeilleKpis label={t('Résumé du plan')} items={[
            { cle: 'r', label: t('À remplacer'), valeur: nb(ind.remplacer), ton: ind.remplacer ? 'danger' : 'succes',
              aide: t('{c} de remplacement', { c: dt(ind.cout_remplacer, true) }) },
            { cle: 'p', label: t('À planifier'), valeur: nb(ind.planifier), ton: ind.planifier ? 'orange' : 'neutre',
              aide: t('{c} de remplacement', { c: dt(ind.cout_planifier, true) }) },
            { cle: 'm', label: t('Maintenance sur 12 mois'), valeur: dt(ind.maintenance12Mois_remplacer, true), ton: 'neutre',
              aide: t('dépensée sur les équipements à remplacer') },
            { cle: 'ia', label: t('Avis de l’IA'), valeur: nb(ind.avisIa), ton: ind.avisIa ? 'info' : 'neutre',
              aide: t('rapports qui conseillent un remplacement') },
            { cle: 'd', label: t('Données manquantes'), valeur: nb(ind.sansPrix), ton: ind.sansPrix ? 'attention' : 'succes',
              aide: t('sans prix d’achat · {n} sans date de mise en service', { n: nb(ind.sansDate) }) },
          ]} />

          <div className="rv-onglets">
            <VeilleSegments label={t('Vue')} valeur={onglet} onChange={choisirOnglet} options={[
              { cle: 'classement', label: t('Classement') },
              { cle: 'scenarios', label: t('Scénarios de budget') },
              { cle: 'reglages', label: t('Durées de vie') },
            ]} />
          </div>

          {onglet === 'classement' && <Classement donnees={donnees} onMaj={majLigne} onOuvrir={(id) => navigate(`/equipement/${id}`)} />}
          {onglet === 'scenarios' && <Scenarios donnees={donnees} onOuvrir={(id) => navigate(`/equipement/${id}`)} />}
          {onglet === 'reglages' && <Reglages donnees={donnees} onEnregistre={() => charger(false)} />}
        </>
      )}
    </VeillePage>
  );
}

/* ---------- Classement ---------- */
function Classement({ donnees, onMaj, onOuvrir }) {
  const [filtre, setFiltre] = useState('TOUS');
  const [famille, setFamille] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(25);
  const [ouvert, setOuvert] = useState(null);

  const familles = useMemo(() => {
    const m = new Map();
    donnees.lignes.forEach((l) => { if (l.familleId) m.set(l.familleId, l.familleNom || `#${l.familleId}`); });
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [donnees.lignes]);

  const compte = (r) => donnees.lignes.filter((l) => l.score.recommandation === r).length;
  const lignes = useMemo(() => {
    const mots = recherche.trim().toLowerCase();
    return donnees.lignes.filter((l) => (filtre === 'TOUS' ? l.score.recommandation !== 'EXCLU' : l.score.recommandation === filtre)
      && (!famille || String(l.familleId) === famille)
      && (!mots || `${l.nom} ${l.marque || ''} ${l.modele || ''} ${l.familleNom || ''}`.toLowerCase().includes(mots)));
  }, [donnees.lignes, filtre, famille, recherche]);
  useEffect(() => { setPage(0); }, [filtre, famille, recherche]);
  const visibles = lignes.slice(page * taille, page * taille + taille);

  return (
    <section className="rv-carte">
      <div className="rv-barre">
        <VeilleSegments label={t('Recommandation')} valeur={filtre} onChange={setFiltre} options={[
          { cle: 'TOUS', label: t('Tous') },
          ...Object.entries(RECOS).map(([cle, r]) => ({ cle, label: t(r.label), n: compte(cle) })),
        ]} />
        <div className="rv-filtres">
          <label className="vl-select">
            <span className="vl-sr">{t('Famille')}</span>
            <select value={famille} onChange={(e) => setFamille(e.target.value)}>
              <option value="">{t('Toutes les familles')}</option>
              {familles.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
            </select>
          </label>
          <label className="rv-recherche">
            <Search size={15} aria-hidden="true" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('Rechercher un équipement…')} />
          </label>
        </div>
      </div>

      <div className="rv-legende" aria-label={t('Parts du score')}>
        <span>{t('Score sur 100 :')}</span>
        {PARTS.map((p) => (
          <span key={p.cle}><i style={{ background: p.couleur }} />{t(p.label)} <small>/{donnees.parametres.poids[p.cle]}</small></span>
        ))}
        <span className="rv-legende__aide" title={t('≥ 70 : à remplacer · ≥ 50 : à planifier · ≥ 30 : à surveiller')}>
          <Info size={13} /> {t('≥ 70 à remplacer · ≥ 50 à planifier · ≥ 30 à surveiller')}
        </span>
      </div>

      {lignes.length === 0 ? <p className="rv-vide">{t('Aucun équipement ne correspond.')}</p> : (
        <div className="rv-defile">
          <table className="rv-table">
            <thead>
              <tr>
                <th>{t('Équipement')}</th>
                <th>{t('Âge')}</th>
                <th>{t('Maintenance / prix')}</th>
                <th>{t('Pannes 12 m')}</th>
                <th>{t('Score')}</th>
                <th>{t('Recommandation')}</th>
                <th>{t('Année')}</th>
                <th className="rv-num">{t('Coût neuf')}</th>
                <th aria-label={t('Détail')} />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <LigneEquipement key={l.id} l={l} ouvert={ouvert === l.id} onBasculer={() => setOuvert(ouvert === l.id ? null : l.id)}
                  onMaj={onMaj} onOuvrir={onOuvrir} anneeCourante={donnees.anneeCourante} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VeillePagination page={page} taille={taille} total={lignes.length} onPage={setPage} onTaille={(v) => { setTaille(v); setPage(0); }} />
    </section>
  );
}

function LigneEquipement({ l, ouvert, onBasculer, onMaj, onOuvrir, anneeCourante }) {
  const reco = RECOS[l.score.recommandation] || RECOS.CONSERVER;
  const pctVie = l.ageAnnees != null ? Math.min(130, (l.ageAnnees / l.dureeVie) * 100) : null;
  return (
    <>
      <tr className={ouvert ? 'is-ouvert' : ''}>
        <td className="rv-eq">
          <button type="button" className="rv-lien" onClick={() => onOuvrir(l.id)}>{l.nom}</button>
          <small>{[l.familleNom, l.marque, l.criticite ? `${l.criticite} ${t(CRITICITES[l.criticite] || '')}` : null].filter(Boolean).join(' · ')}</small>
        </td>
        <td>
          {l.ageAnnees != null ? (
            <div className="rv-vie" title={t('{a} ans sur {d} ans de durée de vie', { a: nb(l.ageAnnees, 1), d: l.dureeVie })}>
              <span>{t('{a} / {d} ans', { a: nb(l.ageAnnees, 0), d: l.dureeVie })}</span>
              <span className="rv-vie__piste"><span style={{ width: `${Math.min(100, pctVie)}%` }} data-depasse={pctVie >= 100 ? '1' : undefined} /></span>
            </div>
          ) : <span className="rv-manque">{t('date inconnue')}</span>}
        </td>
        <td>
          <span className="rv-num-bloc">{dt(l.coutCumule, true)}</span>
          <small>{l.ratioCoutPct != null ? t('{p} % du prix', { p: nb(l.ratioCoutPct, 0) }) : t('prix inconnu')}</small>
        </td>
        <td className="rv-num">{l.pannes12Mois}</td>
        <td>
          <div className="rv-score-cellule">
            <BarreScore score={l.score} />
            {l.ia && <span className="rv-ia" title={l.ia.phrase}><Bot size={13} aria-hidden="true" /> {t('IA')}</span>}
          </div>
        </td>
        <td><Pastille ton={reco.ton}>{t(reco.label)}</Pastille></td>
        <td className="rv-num">{l.anneeConseillee ?? '—'}{l.anneeForcee ? ' *' : ''}</td>
        <td className="rv-num">{l.coutRemplacement != null ? dt(l.coutRemplacement, true) : <span className="rv-manque">{t('à saisir')}</span>}{l.coutSaisi ? ' *' : ''}</td>
        <td>
          <button type="button" className="rv-ico" onClick={onBasculer} aria-expanded={ouvert} aria-label={t('Détail et ajustement')} title={t('Détail et ajustement')}>
            <ChevronDown size={16} className={ouvert ? 'rv-tourne' : ''} />
          </button>
        </td>
      </tr>
      {ouvert && (
        <tr className="rv-detail-ligne">
          <td colSpan={9}><Detail l={l} onMaj={onMaj} anneeCourante={anneeCourante} /></td>
        </tr>
      )}
    </>
  );
}

function Detail({ l, onMaj, anneeCourante }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    coutRemplacement: l.coutSaisi ? l.coutRemplacement : '', anneeForcee: l.anneeForcee ?? '',
    exclu: l.exclu, commentaire: l.commentaire || '',
  });
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const s = l.score;
  const explications = [
    { p: PARTS[0], txt: l.ageAnnees != null ? t('{a} ans pour une durée de vie de {d} ans{f}', { a: nb(l.ageAnnees, 1), d: l.dureeVie, f: l.dureeVieFamille ? ` (${t('réglée pour la famille')})` : ` (${t('valeur par défaut')})` }) : t('date de mise en service inconnue dans Cubix') },
    { p: PARTS[1], txt: l.ratioCoutPct != null ? t('{c} de maintenance depuis l’achat, soit {p} % du prix d’achat ({a}) ; {m} sur 12 mois', { c: dt(l.coutCumule), p: nb(l.ratioCoutPct, 0), a: dt(l.prixAchat), m: dt(l.cout12Mois) }) : t('prix d’achat inconnu dans Cubix ; {c} de maintenance depuis l’achat', { c: dt(l.coutCumule) }) },
    { p: PARTS[2], txt: t('{n} panne(s) (bons curatifs et correctifs) sur 12 mois', { n: l.pannes12Mois }) },
    { p: PARTS[3], txt: l.criticite ? `${l.criticite} — ${t(CRITICITES[l.criticite] || '')}` : t('criticité non renseignée (comptée « normale »)') },
    { p: PARTS[4], txt: l.ia ? l.ia.phrase : t('aucun rapport validé ne conseille de remplacer cet équipement') },
  ];
  const enregistrer = async (vider = false) => {
    setEnvoi(true);
    setMsg(null);
    const nombre = (v) => (v === '' || v == null ? null : Number(v));
    try {
      const ligne = await renouvellementService.ajuster(l.id, vider ? {} : {
        coutRemplacement: nombre(f.coutRemplacement), anneeForcee: nombre(f.anneeForcee), exclu: f.exclu, commentaire: f.commentaire,
      });
      onMaj(ligne);
      if (vider) setF({ coutRemplacement: '', anneeForcee: '', exclu: false, commentaire: '' });
      setMsg({ ok: true, texte: t('Enregistré.') });
    } catch (e) {
      setMsg({ ok: false, texte: e?.response?.data?.message || t('Enregistrement impossible.') });
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="rv-detail">
      <div className="rv-detail__score">
        <h3>{t('Pourquoi ce score ({s}/100)', { s: nb(s.total, 0) })}</h3>
        <ul>
          {explications.map(({ p, txt }) => (
            <li key={p.cle}>
              <span className="rv-part" style={{ '--c': p.couleur }}><i />{t(p.label)}</span>
              <b>{nb(s[p.cle], 1)}<small>/{({ age: 30, cout: 25, fiabilite: 20, criticite: 15, ia: 10 })[p.cle]}</small></b>
              <span dir="auto">{txt}</span>
            </li>
          ))}
        </ul>
        {l.ia?.bonId && (
          <button type="button" className="rv-lien" onClick={() => navigate(`/bons-maintenance?id=${l.ia.bonId}`)}>
            <Bot size={14} /> {t('Voir le rapport du bon n° {n}', { n: l.ia.bonNum || l.ia.bonId })}
          </button>
        )}
      </div>
      <div className="rv-detail__ajuster">
        <h3>{t('Ajuster pour ce plan')}</h3>
        <label>{t('Coût de remplacement (devis)')}
          <span className="rv-unite"><input type="number" min="0" step="any" value={f.coutRemplacement}
            onChange={(e) => setF({ ...f, coutRemplacement: e.target.value })}
            placeholder={l.coutRemplacement != null && !l.coutSaisi ? nb(l.coutRemplacement) : ''} /><span>DT</span></span>
          <small>{t('Vide : prix d’achat indexé sur la hausse des prix depuis l’achat.')}</small>
        </label>
        <label>{t('Année de remplacement imposée')}
          <input type="number" min={anneeCourante} max={anneeCourante + 30} value={f.anneeForcee}
            onChange={(e) => setF({ ...f, anneeForcee: e.target.value })} placeholder={t('calculée')} />
        </label>
        <label className="rv-case">
          <input type="checkbox" checked={f.exclu} onChange={(e) => setF({ ...f, exclu: e.target.checked })} />
          {t('Exclure du plan (déjà remplacé, en location, réformé…)')}
        </label>
        <label>{t('Commentaire')}
          <textarea rows={2} value={f.commentaire} maxLength={500} onChange={(e) => setF({ ...f, commentaire: e.target.value })} />
        </label>
        {msg && <p className={msg.ok ? 'rv-ok' : 'rv-erreur'} role="status">{msg.texte}</p>}
        <div className="rv-detail__actions">
          <button type="button" className="vl-btn vl-btn--petit" onClick={() => enregistrer(true)} disabled={envoi}>
            <X size={14} /> {t('Revenir au calcul')}
          </button>
          <button type="button" className="vl-btn vl-btn--petit vl-btn--primaire" onClick={() => enregistrer(false)} disabled={envoi}>
            {envoi ? <LoaderCircle size={14} className="vl-tourne" /> : <Save size={14} />} {t('Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Scénarios ---------- */
function Scenarios({ donnees, onOuvrir }) {
  const budget = donnees.parametres.budgetAnnuel || 100000;
  const inflation = donnees.parametres.inflation ?? 3;
  const [scenarios, setScenarios] = useState(() => lireLocal(CLE_SCENARIOS, [
    { nom: t('Budget actuel'), budgetAnnuel: budget, horizon: 5, inflationPct: inflation, seuil: 50 },
    { nom: t('Budget renforcé'), budgetAnnuel: Math.round(budget * 1.5), horizon: 5, inflationPct: inflation, seuil: 50 },
  ]));
  const [resultats, setResultats] = useState(null);
  const [calcul, setCalcul] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [annee, setAnnee] = useState(null);
  const noms = useMemo(() => new Map(donnees.lignes.map((l) => [l.id, l])), [donnees.lignes]);

  const maj = (i, champ, v) => setScenarios((l) => l.map((s, k) => (k === i ? { ...s, [champ]: v } : s)));
  const calculer = async () => {
    setCalcul(true);
    setErreur(null);
    ecrireLocal(CLE_SCENARIOS, scenarios);
    try {
      setResultats(await renouvellementService.scenarios(scenarios.map((s) => ({
        nom: s.nom, budgetAnnuel: Number(s.budgetAnnuel) || 0, horizon: Number(s.horizon), inflationPct: Number(s.inflationPct), seuil: Number(s.seuil),
      }))));
      setAnnee(null);
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Calcul impossible.'));
    } finally {
      setCalcul(false);
    }
  };
  useEffect(() => { calculer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="rv-scenarios">
      <div className="rv-carte">
        <div className="rv-scen-grille">
          {scenarios.map((s, i) => (
            <div key={i} className="rv-scen" style={{ '--c': COULEURS_SCENARIOS[i] }}>
              <div className="rv-scen__tete">
                <i aria-hidden="true" />
                <input className="rv-scen__nom" value={s.nom} onChange={(e) => maj(i, 'nom', e.target.value)} aria-label={t('Nom du scénario')} />
                {scenarios.length > 1 && (
                  <button type="button" className="rv-ico" onClick={() => setScenarios((l) => l.filter((_, k) => k !== i))}
                    aria-label={t('Retirer ce scénario')} title={t('Retirer ce scénario')}><Trash2 size={14} /></button>
                )}
              </div>
              <label>{t('Budget par an')}
                <span className="rv-unite"><input type="number" min="0" step="1000" value={s.budgetAnnuel} onChange={(e) => maj(i, 'budgetAnnuel', e.target.value)} /><span>DT</span></span>
              </label>
              <div className="rv-scen__ligne">
                <label>{t('Sur')}
                  <select value={s.horizon} onChange={(e) => maj(i, 'horizon', e.target.value)}>
                    {[3, 5, 7, 10].map((h) => <option key={h} value={h}>{t('{n} ans', { n: h })}</option>)}
                  </select>
                </label>
                <label>{t('Hausse des prix')}
                  <span className="rv-unite"><input type="number" min="0" max="30" step="0.5" value={s.inflationPct} onChange={(e) => maj(i, 'inflationPct', e.target.value)} /><span>%</span></span>
                </label>
              </div>
              <label>{t('Équipements concernés')}
                <select value={s.seuil} onChange={(e) => maj(i, 'seuil', e.target.value)}>
                  <option value={70}>{t('À remplacer seulement (score ≥ 70)')}</option>
                  <option value={50}>{t('À remplacer et à planifier (≥ 50)')}</option>
                  <option value={30}>{t('Jusqu’à « à surveiller » (≥ 30)')}</option>
                </select>
              </label>
            </div>
          ))}
          {scenarios.length < 4 && (
            <button type="button" className="rv-scen rv-scen--ajout" onClick={() => setScenarios((l) => [...l, { ...l[l.length - 1], nom: t('Scénario {n}', { n: l.length + 1 }) }])}>
              <Plus size={18} /> {t('Ajouter un scénario')}
            </button>
          )}
        </div>
        <div className="rv-scen-actions">
          <p>{t('Chaque année, les équipements dont l’année est imposée passent d’abord, puis les autres par score, tant que le budget de l’année le permet. Le reliquat n’est pas reporté.')}</p>
          <button type="button" className="vl-btn vl-btn--primaire" onClick={calculer} disabled={calcul}>
            {calcul ? <LoaderCircle size={15} className="vl-tourne" /> : <Play size={15} />} {t('Calculer')}
          </button>
        </div>
      </div>
      {erreur && <VeilleMessage ton="danger">{erreur}</VeilleMessage>}

      {resultats && (
        <>
          <div className="rv-carte">
            <table className="rv-table rv-table--resume">
              <thead>
                <tr>
                  <th>{t('Scénario')}</th>
                  <th className="rv-num">{t('Remplacés')}</th>
                  <th className="rv-num">{t('Dépense totale')}</th>
                  <th className="rv-num">{t('Maintenance évitée')}</th>
                  <th className="rv-num">{t('À remplacer en fin de période')}</th>
                  <th className="rv-num">{t('Coût à saisir')}</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((r, k) => (
                  <tr key={k}>
                    <td><span className="rv-part" style={{ '--c': COULEURS_SCENARIOS[k] }}><i />{r.scenario.nom}</span>
                      <small>{t('{b} par an sur {h} ans', { b: dt(r.scenario.budgetAnnuel, true), h: r.scenario.horizon })}</small></td>
                    <td className="rv-num">{nb(r.remplaces)}</td>
                    <td className="rv-num">{dt(r.depenseTotale, true)}</td>
                    <td className="rv-num">{dt(r.maintenanceEvitee, true)}</td>
                    <td className="rv-num"><Pastille ton={r.aRemplacerFinHorizon ? 'danger' : 'succes'}>{nb(r.aRemplacerFinHorizon)}</Pastille></td>
                    <td className="rv-num">{r.sansCout ? <span className="rv-manque">{nb(r.sansCout)}</span> : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rv-graphiques">
            <div className="rv-carte">
              <h3 className="rv-titre">{t('Dépenses par année')}<small>{t('trait gris : budget de l’année')}</small></h3>
              <GraphiqueDepenses resultats={resultats} />
              <Legende resultats={resultats} />
            </div>
            <div className="rv-carte">
              <h3 className="rv-titre">{t('Équipements « à remplacer » encore en service')}<small>{t('en fin d’année')}</small></h3>
              <GraphiqueRisque resultats={resultats} />
              <Legende resultats={resultats} />
            </div>
          </div>

          <div className="rv-carte">
            <h3 className="rv-titre">{t('Équipements remplacés, année par année')}</h3>
            <div className="rv-annees">
              {resultats[0].annees.map((a, i) => (
                <button key={a.annee} type="button" className={`rv-annee ${annee === i ? 'is-actif' : ''}`} onClick={() => setAnnee(annee === i ? null : i)}>
                  {a.annee}
                </button>
              ))}
            </div>
            {annee == null ? <p className="rv-vide">{t('Choisissez une année pour voir la liste des équipements de chaque scénario.')}</p> : (
              <div className="rv-annee-detail">
                {resultats.map((r, k) => {
                  const a = r.annees[annee];
                  return (
                    <div key={k} className="rv-annee-col">
                      <h4><span className="rv-part" style={{ '--c': COULEURS_SCENARIOS[k] }}><i />{r.scenario.nom}</span>
                        <small>{dt(a.depense, true)} / {dt(a.budget, true)}</small></h4>
                      {a.choix.length === 0 ? <p className="rv-vide">{t('Aucun remplacement cette année.')}</p> : (
                        <ul>
                          {a.choix.map((c) => {
                            const l = noms.get(c.id);
                            return (
                              <li key={c.id}>
                                <button type="button" className="rv-lien" onClick={() => onOuvrir(c.id)}>{l?.nom || `#${c.id}`}</button>
                                <span>{dt(c.cout, true)} · {t('score {s}', { s: nb(c.score, 0) })}{c.force ? ` · ${t('année imposée')}` : ''}{c.horsBudget ? ` · ${t('hors budget')}` : ''}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {a.candidatsNonFinances > 0 && (
                        <p className="rv-reporte">{t('{n} équipement(s) non financé(s) cette année ({c})', { n: a.candidatsNonFinances, c: dt(a.coutNonFinance, true) })}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Legende({ resultats }) {
  return (
    <ul className="rv-legende-g">
      {resultats.map((r, k) => <li key={k}><i style={{ background: COULEURS_SCENARIOS[k] }} />{r.scenario.nom}</li>)}
    </ul>
  );
}

/* ---------- Durées de vie par famille ---------- */
function Reglages({ donnees, onEnregistre }) {
  const [lignes, setLignes] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    renouvellementService.dureesVie()
      .then((l) => setLignes(l.map((x) => ({ ...x, saisie: x.dureeAnnees ?? '' }))))
      .catch(() => setLignes([]));
  }, []);
  const enregistrer = async () => {
    setEnvoi(true);
    setMsg(null);
    try {
      const l = await renouvellementService.enregistrerDureesVie(lignes.map((x) => ({
        familleId: x.id, familleNom: x.nom, dureeAnnees: x.saisie === '' ? null : Number(x.saisie),
      })));
      setLignes(l.map((x) => ({ ...x, saisie: x.dureeAnnees ?? '' })));
      setMsg({ ok: true, texte: t('Durées de vie enregistrées : le classement est recalculé.') });
      onEnregistre();
    } catch (e) {
      setMsg({ ok: false, texte: e?.response?.data?.message || t('Enregistrement impossible.') });
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <section className="rv-carte">
      <h3 className="rv-titre">{t('Durée de vie par famille d’équipements')}</h3>
      <p className="rv-aide">{t('Âge à partir duquel un équipement est considéré en fin de vie. Vide : {n} ans (réglable dans Paramètres système → Plan de renouvellement, avec le budget annuel et la hausse des prix).', { n: donnees.parametres.dureeVieDefaut })}</p>
      {lignes === null ? <p className="rv-vide"><LoaderCircle size={15} className="vl-tourne" /> {t('Chargement…')}</p> : lignes.length === 0 ? (
        <p className="rv-vide">{t('Aucune famille dans le parc lu depuis Cubix.')}</p>
      ) : (
        <>
          <table className="rv-table rv-table--familles">
            <thead><tr><th>{t('Famille')}</th><th className="rv-num">{t('Équipements')}</th><th>{t('Durée de vie')}</th></tr></thead>
            <tbody>
              {lignes.map((x, i) => (
                <tr key={x.id}>
                  <td>{x.nom || `#${x.id}`}</td>
                  <td className="rv-num">{nb(x.nombre)}</td>
                  <td>
                    <span className="rv-unite rv-unite--court">
                      <input type="number" min="1" max="50" value={x.saisie} placeholder={String(donnees.parametres.dureeVieDefaut)}
                        onChange={(e) => setLignes((l) => l.map((y, k) => (k === i ? { ...y, saisie: e.target.value } : y)))}
                        aria-label={t('Durée de vie de {f}', { f: x.nom })} />
                      <span>{t('ans')}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {msg && <p className={msg.ok ? 'rv-ok' : 'rv-erreur'} role="status">{msg.texte}</p>}
          <div className="rv-detail__actions">
            <button type="button" className="vl-btn vl-btn--primaire" onClick={enregistrer} disabled={envoi}>
              {envoi ? <LoaderCircle size={15} className="vl-tourne" /> : <Save size={15} />} {t('Enregistrer')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
