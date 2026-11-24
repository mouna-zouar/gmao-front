import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, CalendarClock, CalendarSync, ChevronDown, Clock, FileWarning, Info, LoaderCircle, Minus, Play, Plus, RotateCcw, RefreshCw, Save, Search,
  Trash2, TriangleAlert, Wallet, Wrench, X,
} from 'lucide-react';
import renouvellementService from '../../../services/renouvellementService';
import { t, locale } from '../../../i18n';
import {
  VeilleSegments, VeilleMessage, VeillePagination, Pastille,
} from '../../ui/Veille/Veille';
import { Info as InfoIcone } from 'lucide-react';
import { Vide } from '../Supervision/Supervision';
import Pagination from '../../commun/Pagination';
import '../../commun/TableauBord.css';
import '../Supervision/Supervision.css';
import '../TableauDeBord/TableauDeBord.css';
import './Renouvellement.css';

function Panneau({ titre, aide, meta, className = '', corpsClass = '', children }) {
  return (
    <section className={`tb-carte rv-panneau ${className}`}>
      <div className="tb-carte-tete">
        <h3>
          {titre}
          {aide && (
            <span className="sv-aide" tabIndex={0} aria-label={aide}>
              <InfoIcone size={13} aria-hidden="true" />
              <span className="sv-aide__bulle" role="tooltip">{aide}</span>
            </span>
          )}
        </h3>
        {meta && <span className="tb-pastille">{meta}</span>}
      </div>
      <div className={`rv-panneau__corps ${corpsClass}`}>{children}</div>
    </section>
  );
}

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
const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch {} };

const dt = (v, court = false) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (court && Math.abs(n) >= 1e6) return `\u2066${(n / 1e6).toLocaleString(locale(), { maximumFractionDigits: 2 })} M DT\u2069`;
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

const STATUTS = [
  { cle: 'REMPLACER', couleur: '#dc2626' },
  { cle: 'PLANIFIER', couleur: '#f97316' },
  { cle: 'SURVEILLER', couleur: '#ca8a04' },
  { cle: 'CONSERVER', couleur: '#10b981' },
];
const couleurStatut = (r) => STATUTS.find((s) => s.cle === r)?.couleur || '#94a3b8';

const TRANCHES_AGE = [
  { cle: 'jeune', label: '< 50 %', min: 0, max: 50 },
  { cle: 'mi', label: '50 – 75 %', min: 50, max: 75 },
  { cle: 'fin', label: '75 – 100 %', min: 75, max: 100 },
  { cle: 'depasse', label: '> 100 %', min: 100, max: Infinity },
];
const ORDRE_BARRE = ['REMPLACER', 'PLANIFIER', 'SURVEILLER', 'CONSERVER'];

const moyenne = (vals) => (vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null);

function BarresAge({ lignes }) {
  const [ref, w] = useLargeur();
  const actifs = lignes.filter((l) => !l.exclu && l.score.recommandation !== 'EXCLU');
  const places = actifs.filter((x) => x.ageAnnees != null && x.dureeVie > 0);
  const rangs = TRANCHES_AGE.map((tr, idx) => {
    const l = places.filter((x) => (x.ageAnnees / x.dureeVie) * 100 >= tr.min && (x.ageAnnees / x.dureeVie) * 100 < tr.max);
    const parReco = Object.fromEntries(ORDRE_BARRE.map((r) => [r, l.filter((x) => x.score.recommandation === r).length]));
    return {
      ...tr, idx, total: l.length, parReco,
      maint: moyenne(l.map((x) => x.ratioCoutPct).filter((v) => v != null)),
      age: moyenne(l.map((x) => x.ageAnnees)),
      cout: l.reduce((a, x) => a + (x.coutRemplacement || 0), 0),
    };
  });
  const sansDate = actifs.length - places.length;
  const ageParc = moyenne(places.map((x) => x.ageAnnees));
  const depasses = rangs.find((r) => r.cle === 'depasse')?.total || 0;
  const maintParc = moyenne(places.map((x) => x.ratioCoutPct).filter((v) => v != null));
  const jeune = rangs[0].maint; const vieux = rangs[rangs.length - 1].maint;
  const facteur = jeune > 0 && vieux != null ? vieux / jeune : null;

  const H = 270; const m = { h: 26, b: 70, g: 40, d: 46 };
  const L = Math.max(0, w - m.g - m.d); const hz = H - m.h - m.b;
  const maxN = Math.max(1, ...rangs.map((r) => r.total));
  const pasN = maxN <= 4 ? 1 : Math.ceil(maxN / 4 / 5) * 5 || 1;
  const hautN = Math.ceil(maxN / pasN) * pasN;
  const hautP = Math.ceil(Math.max(25, ...rangs.map((r) => r.maint || 0)) / 25) * 25;
  const pas = L / rangs.length; const lb = Math.min(64, pas * 0.5);
  const xC = (i) => m.g + pas * i + pas / 2;
  const yN = (v) => m.h + hz - (v / hautN) * hz;
  const yP = (v) => m.h + hz - (v / hautP) * hz;
  const base = m.h + hz;
  const pts = rangs.map((r, i) => (r.maint != null ? [xC(i), yP(r.maint), r] : null)).filter(Boolean);
  const aire = pts.length > 1 ? `M${pts[0][0]},${base} ${pts.map(([x, y]) => `L${x},${y}`).join(' ')} L${pts[pts.length - 1][0]},${base} Z` : null;

  return (
    <div className="rv-combo" ref={ref}>
      <ul className="rv-combo__resume">
        <li><span>{t('Âge moyen')}</span><b>{ageParc != null ? t('{n} ans', { n: nb(ageParc, 1) }) : '—'}</b></li>
        <li className={depasses ? 'is-danger' : ''}><span>{t('Hors durée de vie')}</span>
          <b>{nb(depasses)}<small> {places.length ? `(${nb((depasses / places.length) * 100, 0)} %)` : ''}</small></b></li>
        <li><span>{t('Maintenance moy.')}</span><b>{maintParc != null ? `${nb(maintParc, 0)} %` : '—'}<small> {t('du prix')}</small></b></li>
        {facteur != null && facteur > 1 && (
          <li className="is-attention"><span>{t('Fin de vie / jeunes')}</span><b>{t('× {f}', { f: nb(facteur, 1) })}<small> {t('maint.')}</small></b></li>
        )}
      </ul>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={t('Nombre d’équipements et coût de maintenance moyen par part de durée de vie consommée')}>
          <defs>
            <linearGradient id="rvComboAire" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--g-brand-750, #05606b)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--g-brand-750, #05606b)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((k) => {
            const y = base - (k / 4) * hz;
            return (
              <g key={k}>
                <line x1={m.g} x2={m.g + L} y1={y} y2={y} className={k === 0 ? 'rv-combo__base' : 'rv-combo__grille'} />
                <text x={m.g - 8} y={y} className="rv-combo__axe" textAnchor="end" dominantBaseline="central">{nb((hautN / 4) * k)}</text>
                <text x={m.g + L + 8} y={y} className="rv-combo__axe rv-combo__axe--p" dominantBaseline="central">{nb((hautP / 4) * k)} %</text>
              </g>
            );
          })}
          {rangs.map((r, i) => {
            const y = yN(r.total);
            const detail = ORDRE_BARRE.filter((reco) => r.parReco[reco] > 0)
              .map((reco) => `• ${t(RECOS[reco].label)} : ${nb(r.parReco[reco])}`).join('\n');
            const bulle = [
              `${t('Durée de vie consommée')} ${r.label}`,
              t('{n} équipements', { n: nb(r.total) }),
              r.age != null ? t('Âge moyen : {n} ans', { n: nb(r.age, 1) }) : null,
              r.maint != null ? t('Maintenance moyenne : {p} % du prix d’achat', { p: nb(r.maint, 0) }) : null,
              r.cout > 0 ? t('Coût de remplacement : {c}', { c: dt(r.cout, true) }) : null,
              detail,
            ].filter(Boolean).join('\n');
            let x0 = xC(i) - lb / 2;
            return (
              <g key={r.cle} className={`rv-combo__col rv-combo__col--${i} ${r.cle === 'depasse' ? 'is-depasse' : ''}`}>
                <title>{bulle}</title>
                <rect x={xC(i) - pas / 2} y={m.h} width={pas} height={hz + m.b} className="rv-combo__zone" />
                <rect x={xC(i) - lb / 2} y={y} width={lb} height={Math.max(0, base - y)} rx="6" className="rv-combo__barre" />
                {r.total > 0 && ORDRE_BARRE.map((reco) => {
                  const lw = (r.parReco[reco] / r.total) * lb; if (!lw) return null;
                  const el = <rect key={reco} x={x0} y={base + 5} width={Math.max(0, lw - 1)} height="5" rx="1.5" style={{ fill: couleurStatut(reco) }} />;
                  x0 += lw; return el;
                })}
                <text x={xC(i)} y={base + 27} textAnchor="middle" className="rv-combo__label">{r.label}</text>
                <text x={xC(i)} y={base + 44} textAnchor="middle" className="rv-combo__n">{t('{n} équip.', { n: nb(r.total) })}</text>
                <text x={xC(i)} y={base + 59} textAnchor="middle" className="rv-combo__age">{r.age != null ? t('{n} ans en moy.', { n: nb(r.age, 1) }) : ''}</text>
              </g>
            );
          })}
          {aire && <path d={aire} fill="url(#rvComboAire)" pointerEvents="none" />}
          {pts.length > 1 && <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} className="rv-combo__ligne" />}
          {pts.map(([x, y, r]) => (
            <g key={r.cle} className={`rv-combo__pt ${r.maint >= 75 ? 'is-haut' : ''}`} pointerEvents="none">
              <circle cx={x} cy={y} r="5" />
              <text x={x} y={y - 11} textAnchor="middle">{nb(r.maint, 0)} %</text>
            </g>
          ))}
        </svg>
      )}
      <ul className="sv-legende">
        <li><span className="rv-combo__leg-barre" />{t('Équipements (axe de gauche)')}</li>
        <li><span className="rv-combo__leg-ligne" />{t('Maintenance moyenne, % du prix d’achat (axe de droite)')}</li>
        {ORDRE_BARRE.map((reco) => (
          <li key={reco}><span className="rv-point" style={{ background: couleurStatut(reco) }} />{t(RECOS[reco].label)}</li>
        ))}
        {sansDate > 0 && <li className="rv-legende__note">{t('{n} sans date ou sans durée de vie, non placés', { n: sansDate })}</li>}
      </ul>
    </div>
  );
}

function Familles({ lignes }) {
  const familles = useMemo(() => {
    const m = new Map();
    lignes.forEach((l) => {
      if (l.exclu) return;
      const cle = l.familleNom || t('Sans famille');
      const f = m.get(cle) || { nom: cle, remplacer: 0, planifier: 0, cout: 0, total: 0 };
      f.total++;
      if (l.score.recommandation === 'REMPLACER') { f.remplacer++; f.cout += l.coutRemplacement || 0; }
      if (l.score.recommandation === 'PLANIFIER') { f.planifier++; f.cout += l.coutRemplacement || 0; }
      m.set(cle, f);
    });
    return [...m.values()].filter((f) => f.remplacer + f.planifier > 0)
      .sort((a, b) => (b.remplacer * 2 + b.planifier) - (a.remplacer * 2 + a.planifier)).slice(0, 7);
  }, [lignes]);
  if (familles.length === 0) return <Vide>{t('Aucune famille avec des équipements à remplacer ou à planifier.')}</Vide>;
  const max = Math.max(...familles.map((f) => f.remplacer + f.planifier));
  return (
    <>
      <ol className="sv-classement rv-familles">
        {familles.map((f) => (
          <li key={f.nom}>
            <div className="rv-familles__ligne">
              <span className="sv-classement__nom">{f.nom}</span>
              <span className="sv-classement__n">{nb(f.remplacer + f.planifier)}<small> / {nb(f.total)}</small></span>
              <span className="rv-familles__piste" aria-hidden="true">
                <span style={{ width: `${(f.remplacer / max) * 100}%`, background: '#dc2626' }} />
                <span style={{ width: `${(f.planifier / max) * 100}%`, background: '#f97316' }} />
              </span>
              <small className="rv-familles__cout">{dt(f.cout, true)}</small>
            </div>
          </li>
        ))}
      </ol>
      <ul className="sv-legende">
        <li><span className="rv-point" style={{ background: '#dc2626' }} />{t('À remplacer')}</li>
        <li><span className="rv-point" style={{ background: '#f97316' }} />{t('À planifier')}</li>
      </ul>
    </>
  );
}

export default function Renouvellement() {
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState(() => lireLocal(CLE_ONGLET, 'tableau'));
  const [focus] = useState(null);
  const [filtreDemande, setFiltreDemande] = useState(null);
  const refClassement = useRef(null);

  const charger = useCallback(async (recalculer = false) => {
    setChargement(true);
    try {
      const d = await renouvellementService.tableau(recalculer);
      setDonnees(d);
      setErreur(null);
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le plan de renouvellement.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const choisirVue = (v) => { setVue(v); ecrireLocal(CLE_ONGLET, v); };
  const majLigne = (ligne) => setDonnees((d) => ({ ...d, lignes: d.lignes.map((l) => (l.id === ligne.id ? ligne : l)) }));
  const allerAuClassement = () => setTimeout(() => refClassement.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  const ind = donnees?.indicateurs || {};
  const VUES = [
    { cle: 'tableau', label: t('Tableau de bord'), icone: CalendarSync },
    { cle: 'scenarios', label: t('Comparer des budgets'), icone: Wallet },
    { cle: 'reglages', label: t('Durées de vie'), icone: CalendarClock },
  ];
  const filtrerClassement = (r) => { if (vue !== 'tableau') choisirVue('tableau'); setFiltreDemande({ r, t: Date.now() }); allerAuClassement(); };

  return (
    <div className="tb-container rv-page rv-v2">
      <div className="rv2-haut">
        <nav className="rv2-onglets" role="tablist" aria-label={t('Plan de renouvellement')}>
          {VUES.map((o) => {
            const I = o.icone;
            return (
              <button key={o.cle} type="button" role="tab" aria-selected={vue === o.cle}
                className={`rv2-onglet ${vue === o.cle ? 'is-actif' : ''}`} onClick={() => choisirVue(o.cle)}>
                <I size={15} aria-hidden="true" /> {o.label}
              </button>
            );
          })}
        </nav>
        <div className="rv2-haut__droite">
          {donnees && (
            <span className="rv2-maj">
              {t('Calculé à {h} · {n} équipements analysés', {
                h: new Date(donnees.calculeLe).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }), n: nb(ind.parc),
              })}
            </span>
          )}
          <button type="button" className="rv2-btn" onClick={() => charger(true)} disabled={chargement}
            title={t('Relit les coûts, les pannes et les rapports (sinon gardés 10 minutes)')}>
            {chargement ? <LoaderCircle size={14} className="tb-tourne" /> : <RefreshCw size={14} strokeWidth={2.4} />} {t('Recalculer')}
          </button>
        </div>
      </div>
      {erreur && <p className="tb-message tb-message--erreur">{erreur}</p>}
      {!donnees && !erreur && <div className="tb-chargement">{t('Analyse du parc…')}</div>}

      {donnees && vue === 'tableau' && (
        <div className="sv-grille-panneaux">
          <div className="rv2-kpis sv-l12">
            <button type="button" className={`rv2-kpi ${ind.remplacer ? 'is-alerte' : ''}`} onClick={() => filtrerClassement('REMPLACER')}
              title={t('Score ≥ 70 · voir dans le classement')}>
              <span className="rv2-kpi__label"><TriangleAlert size={14} aria-hidden="true" /> {t('À remplacer')}</span>
              <b>{nb(ind.remplacer)}</b>
              <small>{dt(ind.cout_remplacer, true)}</small>
            </button>
            <button type="button" className={`rv2-kpi ${ind.planifier ? 'is-attention' : ''}`} onClick={() => filtrerClassement('PLANIFIER')}
              title={t('Score ≥ 50 · voir dans le classement')}>
              <span className="rv2-kpi__label"><CalendarClock size={14} aria-hidden="true" /> {t('À planifier')}</span>
              <b>{nb(ind.planifier)}</b>
              <small>{dt(ind.cout_planifier, true)}</small>
            </button>
            <div className="rv2-kpi">
              <span className="rv2-kpi__label"><Wallet size={14} aria-hidden="true" /> {t('Budget nécessaire')}</span>
              <b>{dt((ind.cout_remplacer || 0) + (ind.cout_planifier || 0), true)}</b>
              <small>{t('pour remplacer et planifier')}</small>
            </div>
            <div className="rv2-kpi">
              <span className="rv2-kpi__label"><Wrench size={14} aria-hidden="true" /> {t('Maintenance sur 12 mois')}</span>
              <b>{dt(ind.maintenance12Mois_remplacer, true)}</b>
              <small>{t('sur les équipements à remplacer')}</small>
            </div>
            <div className={`rv2-kpi ${ind.avisIa ? 'is-info' : ''}`}>
              <span className="rv2-kpi__label"><Bot size={14} aria-hidden="true" /> {t('Avis de l’IA')}</span>
              <b>{nb(ind.avisIa)}</b>
              <small>{t('rapports qui conseillent un remplacement')}</small>
            </div>
            <div className={`rv2-kpi ${ind.sansPrix ? 'is-attention' : ''}`}>
              <span className="rv2-kpi__label"><FileWarning size={14} aria-hidden="true" /> {t('Données manquantes')}</span>
              <b>{nb(ind.sansPrix)}</b>
              <small>{t('sans prix · {n} sans date', { n: nb(ind.sansDate) })}</small>
            </div>
          </div>

          <Panneau className="sv-l8" titre={t('Âge et coût de maintenance')}
            aide={t('Colonnes : nombre d’équipements par part de leur durée de vie déjà consommée. Courbe : leur coût de maintenance cumulé moyen, en % du prix d’achat. Survolez une colonne pour le détail par recommandation.')}
            meta={t('{n} équipements', { n: nb(ind.parc) })}>
            <BarresAge lignes={donnees.lignes} />
          </Panneau>

          <Panneau className="sv-l4" titre={t('Familles à renouveler')} aide={t('Familles qui comptent le plus d’équipements à remplacer ou à planifier, et le coût de leur remplacement.')}>
            <Familles lignes={donnees.lignes} />
          </Panneau>

          <div className="sv-l12" ref={refClassement}>
            <Panneau titre={t('Classement des équipements')} meta={t('du score le plus élevé au plus faible')} corpsClass="sv-sans-marge">
              <Classement donnees={donnees} onMaj={majLigne} onOuvrir={(id) => navigate(`/equipement/${id}`)}
                focus={focus} filtreDemande={filtreDemande} />
            </Panneau>
          </div>
        </div>
      )}
      {donnees && vue === 'scenarios' && <Scenarios donnees={donnees} onOuvrir={(id) => navigate(`/equipement/${id}`)} />}
      {donnees && vue === 'reglages' && <Reglages donnees={donnees} onEnregistre={() => charger(false)} />}
    </div>
  );
}

function Classement({ donnees, onMaj, onOuvrir, focus, filtreDemande }) {
  const [filtre, setFiltre] = useState('TOUS');
  const [famille, setFamille] = useState('');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(10);
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

  useEffect(() => {
    if (!filtreDemande) return;
    setFamille(''); setRecherche(''); setFiltre(filtreDemande.r);
  }, [filtreDemande]);
  useEffect(() => {
    if (!focus) return;
    setFiltre('TOUS'); setFamille(''); setRecherche('');
    const tous = donnees.lignes.filter((l) => l.score.recommandation !== 'EXCLU');
    const idx = tous.findIndex((l) => l.id === focus.id);
    setTimeout(() => { setPage(idx >= 0 ? Math.floor(idx / taille) : 0); setOuvert(focus.id); }, 0);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rv-classement">
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
      <div className="rv-pagination">
        <VeillePagination page={page} taille={taille} total={lignes.length} onPage={setPage} onTaille={(v) => { setTaille(v); setPage(0); }} />
      </div>
    </div>
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

const FILTRES_DUREE = [
  { cle: 'toutes', label: 'Toutes' },
  { cle: 'perso', label: 'Personnalisées' },
  { cle: 'defaut', label: 'Par défaut' },
  { cle: 'fin', label: 'En fin de vie' },
];
function Reglages({ donnees, onEnregistre }) {
  const [lignes, setLignes] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(10);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('toutes');
  const defaut = Number(donnees.parametres.dureeVieDefaut) || 10;
  const versLignes = (l) => l.map((x) => ({ ...x, saisie: x.dureeAnnees ?? '', origine: x.dureeAnnees ?? '' }));
  useEffect(() => {
    renouvellementService.dureesVie().then((l) => setLignes(versLignes(l))).catch(() => setLignes([]));
  }, []);

  const agesParFamille = useMemo(() => {
    const m = new Map();
    (donnees.lignes || []).forEach((l) => {
      if (l.familleId == null || l.ageAnnees == null) return;
      const k = String(l.familleId);
      const a = m.get(k) || [];
      a.push(Number(l.ageAnnees));
      m.set(k, a);
    });
    return m;
  }, [donnees.lignes]);

  const enrichies = useMemo(() => (lignes || []).map((x) => {
    const duree = x.saisie === '' ? defaut : Number(x.saisie);
    const ages = agesParFamille.get(String(x.id)) || [];
    const ageMoyen = ages.length ? ages.reduce((s, v) => s + v, 0) / ages.length : null;
    return {
      ...x, duree, ageMoyen,
      finDeVie: ages.filter((a) => a >= duree).length,
      modifiee: String(x.saisie) !== String(x.origine),
      perso: x.saisie !== '',
    };
  }), [lignes, agesParFamille, defaut]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return enrichies.filter((x) => (!q || String(x.nom || '').toLowerCase().includes(q))
      && (filtre === 'toutes' || (filtre === 'perso' && x.perso) || (filtre === 'defaut' && !x.perso) || (filtre === 'fin' && x.finDeVie > 0)));
  }, [enrichies, recherche, filtre]);
  useEffect(() => { setPage(0); }, [recherche, filtre]);

  const nbModifs = enrichies.filter((x) => x.modifiee).length;
  const compte = {
    toutes: enrichies.length,
    perso: enrichies.filter((x) => x.perso).length,
    defaut: enrichies.filter((x) => !x.perso).length,
    fin: enrichies.filter((x) => x.finDeVie > 0).length,
  };
  const changer = (id, v) => setLignes((l) => l.map((y) => (y.id === id ? { ...y, saisie: v } : y)));
  const pas = (x, d) => changer(x.id, String(Math.min(50, Math.max(1, (x.saisie === '' ? defaut : Number(x.saisie)) + d))));

  const enregistrer = async () => {
    setEnvoi(true);
    setMsg(null);
    try {
      const l = await renouvellementService.enregistrerDureesVie(lignes.map((x) => ({
        familleId: x.id, familleNom: x.nom, dureeAnnees: x.saisie === '' ? null : Number(x.saisie),
      })));
      setLignes(versLignes(l));
      setMsg({ ok: true, texte: t('Durées de vie enregistrées : le classement est recalculé.') });
      onEnregistre();
    } catch (e) {
      setMsg({ ok: false, texte: e?.response?.data?.message || t('Enregistrement impossible.') });
    } finally {
      setEnvoi(false);
    }
  };
  const annuler = () => setLignes((l) => l.map((x) => ({ ...x, saisie: x.origine })));

  const pageSure = Math.min(page, Math.max(0, Math.ceil(visibles.length / taille) - 1));
  return (
    <section className="rv-carte rvd">
      <header className="rvd-tete">
        <h3 className="rv-titre">{t('Durée de vie par famille d’équipements')}</h3>
        <span className="rvd-defaut" title={t('Réglable dans Paramètres système → Plan de renouvellement')}>
          <Clock size={13} aria-hidden="true" /> {t('Par défaut : {n} ans', { n: defaut })}
        </span>
      </header>

      {lignes === null ? <p className="rv-vide"><LoaderCircle size={15} className="vl-tourne" /> {t('Chargement…')}</p> : lignes.length === 0 ? (
        <p className="rv-vide">{t('Aucune famille dans le parc lu depuis Cubix.')}</p>
      ) : (
        <>
          <div className="rvd-barre">
            <label className="rvd-recherche">
              <Search size={15} aria-hidden="true" />
              <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille')} />
            </label>
            <div className="rvd-filtres" role="group" aria-label={t('Filtrer')}>
              {FILTRES_DUREE.map((f) => (
                <button key={f.cle} type="button" aria-pressed={filtre === f.cle} className={filtre === f.cle ? 'is-actif' : ''}
                  onClick={() => setFiltre(f.cle)}>
                  {t(f.label)} <b>{compte[f.cle]}</b>
                </button>
              ))}
            </div>
          </div>

          {visibles.length === 0 ? <p className="rv-vide">{t('Aucune famille ne correspond.')}</p> : (
            <ul className="rvd-liste">
              {visibles.slice(pageSure * taille, (pageSure + 1) * taille).map((x) => {
                const pct = x.ageMoyen == null ? null : Math.min(100, (x.ageMoyen / x.duree) * 100);
                const ton = pct == null ? '' : pct >= 100 ? 'is-depasse' : pct >= 80 ? 'is-proche' : 'is-ok';
                return (
                  <li key={x.id} className={`rvd-ligne ${x.modifiee ? 'is-modifiee' : ''}`}>
                    <div className="rvd-famille">
                      <strong title={x.nom}>{x.nom || `#${x.id}`}</strong>
                      <span>{t('{n} équipements', { n: nb(x.nombre) })}</span>
                    </div>
                    <div className={`rvd-age ${ton}`}>
                      {pct == null ? <span className="rvd-age__vide">—</span> : (
                        <>
                          <span className="rvd-age__piste" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                          <span className="rvd-age__txt">
                            {t('Âge moyen {a} ans', { a: nb(x.ageMoyen, 1) })}
                            {x.finDeVie > 0 && <b>{t('{n} en fin de vie', { n: x.finDeVie })}</b>}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="rvd-duree">
                      <button type="button" className="rvd-pas" onClick={() => pas(x, -1)} aria-label={t('Moins')}><Minus size={14} /></button>
                      <span className="rv-unite rvd-champ">
                        <input type="number" min="1" max="50" value={x.saisie} placeholder={String(defaut)}
                          onChange={(e) => changer(x.id, e.target.value)} aria-label={t('Durée de vie de {f}', { f: x.nom })} />
                        <span>{t('ans')}</span>
                      </span>
                      <button type="button" className="rvd-pas" onClick={() => pas(x, 1)} aria-label={t('Plus')}><Plus size={14} /></button>
                      {x.perso ? (
                        <button type="button" className="rvd-reset" onClick={() => changer(x.id, '')} title={t('Revenir à la durée par défaut')}
                          aria-label={t('Revenir à la durée par défaut')}><RotateCcw size={14} /></button>
                      ) : <span className="rvd-etiquette">{t('Défaut')}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={pageSure} taille={taille} total={visibles.length}
            onPage={setPage} onTaille={(v) => { setTaille(v); setPage(0); }} />
          {msg && <p className={msg.ok ? 'rv-ok' : 'rv-erreur'} role="status">{msg.texte}</p>}
          <div className={`rvd-pied ${nbModifs > 0 ? 'is-actif' : ''}`}>
            <span>{nbModifs > 0 ? t('{n} modification(s) non enregistrée(s)', { n: nbModifs }) : t('Aucune modification')}</span>
            {nbModifs > 0 && <button type="button" className="vl-btn" onClick={annuler} disabled={envoi}>{t('Annuler')}</button>}
            <button type="button" className="vl-btn vl-btn--primaire" onClick={enregistrer} disabled={envoi || nbModifs === 0}>
              {envoi ? <LoaderCircle size={15} className="vl-tourne" /> : <Save size={15} />} {t('Enregistrer')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
