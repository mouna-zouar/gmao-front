import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, BellRing, Cable, Info, LoaderCircle, MonitorDot, Network, RefreshCw, ServerCog, TriangleAlert, Wifi, WifiOff,
} from 'lucide-react';
import supervisionService from '../../../services/supervisionService';
import { libelleType } from '../Equipements/EquipementLiaisonAgent';
import { t, locale } from '../../../i18n';
import { VeillePage, VeilleSegments, VeilleMessage, Pastille, ilYa } from '../../ui/Veille/Veille';
import './Supervision.css';

/*
 * « Supervision » : tableau de bord du parc connecté, façon Grafana (thème clair de la GMAO).
 * Une période (1 h → 30 j), un rafraîchissement automatique, et des panneaux :
 * indicateurs, alertes reçues, courbes des sondes, disponibilité réseau, classement, état des connexions.
 * Les graphiques sont dessinés en SVG ; chaque graphique a une info-bulle au survol.
 */

/* Couleurs des séries : ordre fixe, la couleur suit la sonde (jamais son rang). Validé daltonisme. */
const PALETTE = ['#0794a4', '#eb6834', '#6a5acd', '#eda100', '#e87ba4', '#2a78d6'];
/* Niveaux d'alerte (couleurs d'état réservées, toujours avec un libellé). */
const NIVEAUX = [
  { cle: 'critique', label: 'Critique', couleur: '#dc2626', ton: 'danger' },
  { cle: 'alerte', label: 'Alerte', couleur: '#f97316', ton: 'orange' },
  { cle: 'info', label: 'Information', couleur: '#2563eb', ton: 'info' },
];
const NIVEAU_TON = { CRITIQUE: 'danger', ALERTE: 'orange', INFO: 'info' };
const NIVEAU_LABEL = { CRITIQUE: 'Critique', ALERTE: 'Alerte', INFO: 'Information' };
const ETAT_LIAISON = {
  OK: { ton: 'succes', label: 'Lit correctement' },
  ALERTE: { ton: 'orange', label: 'Hors limites / défaut' },
  ERREUR: { ton: 'danger', label: 'Erreur' },
  ABSENT: { ton: 'danger', label: 'Introuvable' },
  ATTENTE: { ton: 'info', label: 'En attente' },
};

const PERIODES = [
  { cle: 1, label: '1 h' },
  { cle: 6, label: '6 h' },
  { cle: 24, label: '24 h' },
  { cle: 168, label: '7 j' },
  { cle: 720, label: '30 j' },
];
const RAFRAICHISSEMENTS = [
  { cle: 0, label: 'Arrêt' },
  { cle: 30, label: '30 s' },
  { cle: 60, label: '1 min' },
  { cle: 300, label: '5 min' },
];

const CLE_PERIODE = 'gmao.supervision.periode';
const CLE_AUTO = 'gmao.supervision.auto';
const lire = (cle, defaut, valides) => {
  try {
    const v = Number(localStorage.getItem(cle));
    return valides.some((o) => o.cle === v) && localStorage.getItem(cle) !== null ? v : defaut;
  } catch { return defaut; }
};
const ecrire = (cle, v) => { try { localStorage.setItem(cle, String(v)); } catch { /* stockage indisponible */ } };

/* ---------- Outils temps / nombres ---------- */

const ms = (iso) => (iso ? new Date(iso).getTime() : NaN);
const MIN = 60e3;
const H = 60 * MIN;
const J = 24 * H;

function heure(v) {
  return new Date(v).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}
function jour(v) {
  return new Date(v).toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
}
function dateHeureCourte(v) {
  return `${jour(v)} · ${heure(v)}`;
}
function duree(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return t('{n} min', { n: m });
  if (m < 1440) return m % 60 ? t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 }) : t('{n} h', { n: m / 60 });
  return t('{j} j {h} h', { j: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
}
function nombre(v, dec = 0) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString(locale(), { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

/** Graduations de l'axe du temps, calées sur l'heure locale. */
function graduationsTemps(debut, fin, largeur = 9999) {
  const span = fin - debut;
  let pas;
  if (span <= 1.5 * H) pas = 10 * MIN;
  else if (span <= 7 * H) pas = H;
  else if (span <= 25 * H) pas = 3 * H;
  else if (span <= 8 * J) pas = J;
  else pas = 5 * J;
  const d = new Date(debut);
  d.setSeconds(0, 0);
  if (pas < H) {
    const k = pas / MIN;
    d.setMinutes(Math.ceil(d.getMinutes() / k) * k);
  } else if (pas < J) {
    const k = pas / H;
    d.setMinutes(0);
    if (d.getTime() < debut) d.setHours(d.getHours() + 1);
    while (d.getHours() % k !== 0) d.setHours(d.getHours() + 1);
  } else {
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < debut) d.setDate(d.getDate() + 1);
  }
  const ticks = [];
  for (let v = d.getTime(); v <= fin && ticks.length < 40; v += pas) ticks.push(v);
  // Écran étroit : une graduation sur k, pour garder ~60 px entre deux libellés
  const k = Math.max(1, Math.ceil((ticks.length * 60) / Math.max(1, largeur)));
  return { ticks: ticks.filter((_, i) => i % k === 0), format: pas < J ? heure : jour };
}

/** Graduations « rondes » de l'axe des valeurs. */
function graduationsValeurs(min, max, n = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { min -= 1; max += 1; }
  const brut = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) || 10 * p;
  const a = Math.floor(min / pas) * pas;
  const b = Math.ceil(max / pas) * pas;
  const l = [];
  for (let v = a; v <= b + pas / 2; v += pas) l.push(Math.round(v * 1e6) / 1e6);
  return l;
}

/** Largeur réelle d'un conteneur (les graphiques se redessinent quand elle change). */
function useLargeur() {
  const ref = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setLargeur(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largeur];
}

/* ---------- Briques ---------- */

function Panneau({ titre, aide, meta, children, className = '', corpsClass = '' }) {
  return (
    <section className={`sv-panneau ${className}`}>
      <header className="sv-panneau__tete">
        <h2>{titre}</h2>
        {aide && (
          <span className="sv-aide" tabIndex={0} aria-label={aide}>
            <Info size={13} aria-hidden="true" />
            <span className="sv-aide__bulle" role="tooltip">{aide}</span>
          </span>
        )}
        {meta && <span className="sv-panneau__meta">{meta}</span>}
      </header>
      <div className={`sv-panneau__corps ${corpsClass}`}>{children}</div>
    </section>
  );
}

function Vide({ children }) {
  return <div className="sv-vide">{children}</div>;
}

function Bulle({ bulle }) {
  if (!bulle) return null;
  return (
    <div className="sv-bulle" style={{ left: bulle.x, top: bulle.y, transform: bulle.aGauche ? 'translate(calc(-100% - 12px), 0)' : 'translate(12px, 0)' }} role="status">
      {bulle.titre && <div className="sv-bulle__titre">{bulle.titre}</div>}
      {bulle.lignes.map((l, i) => (
        <div className="sv-bulle__ligne" key={i}>
          {l.couleur && <span className="sv-bulle__marque" style={{ background: l.couleur }} aria-hidden="true" />}
          <span className="sv-bulle__label">{l.label}</span>
          <span className="sv-bulle__valeur">{l.valeur}</span>
        </div>
      ))}
    </div>
  );
}

/* Petite courbe dans un indicateur. */
function Etincelle({ valeurs, couleur }) {
  const [ref, w] = useLargeur();
  const h = 34;
  const max = Math.max(1, ...valeurs);
  const pts = valeurs.map((v, i) => [valeurs.length > 1 ? (i / (valeurs.length - 1)) * w : w / 2, h - 2 - (v / max) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <div className="sv-etincelle" ref={ref} aria-hidden="true">
      {w > 0 && valeurs.length > 0 && (
        <svg width={w} height={h}>
          <path d={`${d}L${w},${h}L0,${h}Z`} fill={couleur} opacity="0.10" />
          <path d={d} fill="none" stroke={couleur} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function Indicateur({ icone: Icone, label, valeur, total, ton, etat, sous, etincelle }) {
  return (
    <div className="sv-stat" data-ton={ton}>
      <div className="sv-stat__tete">
        <Icone size={15} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="sv-stat__valeur">
        {valeur}
        {total != null && <small> / {total}</small>}
      </div>
      <div className="sv-stat__pied">
        {etat && <Pastille ton={ton}>{etat}</Pastille>}
        {sous && <span className="sv-stat__sous">{sous}</span>}
      </div>
      {etincelle}
    </div>
  );
}

/* ---------- Alertes reçues (barres empilées par niveau) ---------- */

function GraphiqueAlertes({ tranches, debut, fin, pasMinutes }) {
  const [ref, w] = useLargeur();
  const [bulle, setBulle] = useState(null);
  const h = 220;
  const m = { g: 34, d: 8, h: 10, b: 24 };
  const total = tranches.reduce((s, x) => s + x.critique + x.alerte + x.info, 0);
  const max = Math.max(1, ...tranches.map((x) => x.critique + x.alerte + x.info));
  const yTicks = graduationsValeurs(0, max, 4).filter((v) => Number.isInteger(v));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const iw = Math.max(0, w - m.g - m.d);
  const ih = h - m.h - m.b;
  const x = (v) => m.g + ((v - debut) / (fin - debut)) * iw;
  const y = (v) => m.h + ih - (v / yMax) * ih;
  const largeurBarre = Math.max(2, (iw / Math.max(1, tranches.length)) - 2);
  const { ticks, format } = graduationsTemps(debut, fin, iw);

  return (
    <div className="sv-graph" ref={ref} dir="ltr">
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Alertes reçues par tranche de temps : {n} au total', { n: total })} onMouseLeave={() => setBulle(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="sv-grille" />
              <text x={m.g - 6} y={y(v)} className="sv-axe" textAnchor="end" dominantBaseline="middle">{v}</text>
            </g>
          ))}
          {ticks.map((v) => (
            <text key={v} x={x(v)} y={h - 6} className="sv-axe" textAnchor="middle">{format(v)}</text>
          ))}
          {tranches.map((tr) => {
            const t0 = ms(tr.t);
            const bx = x(t0) + 1;
            let cumul = 0;
            const somme = tr.critique + tr.alerte + tr.info;
            const actif = bulle?.cle === tr.t;
            return (
              <g key={tr.t}>
                {NIVEAUX.map((n, i) => {
                  const v = tr[n.cle];
                  if (!v) return null;
                  const y1 = y(cumul + v);
                  const y0 = y(cumul);
                  cumul += v;
                  const haut = NIVEAUX.slice(i + 1).every((s) => !tr[s.cle]);
                  const hauteur = Math.max(1, y0 - y1 - (cumul === v ? 0 : 2));
                  return (
                    <rect key={n.cle} x={bx} y={y1} width={largeurBarre} height={hauteur}
                      rx={haut ? Math.min(3, largeurBarre / 2) : 0} fill={n.couleur} opacity={bulle && !actif ? 0.45 : 1} />
                  );
                })}
                <rect x={bx - 1} y={m.h} width={largeurBarre + 2} height={ih} fill="transparent"
                  onMouseMove={(e) => {
                    const r = ref.current.getBoundingClientRect();
                    const px = e.clientX - r.left;
                    setBulle({
                      cle: tr.t, x: px, y: Math.max(0, e.clientY - r.top - 30), aGauche: px > w * 0.65,
                      titre: `${dateHeureCourte(t0)} → ${heure(t0 + pasMinutes * MIN)}`,
                      lignes: [
                        ...NIVEAUX.map((n) => ({ couleur: n.couleur, label: t(n.label), valeur: nombre(tr[n.cle]) })),
                        { label: t('Total'), valeur: nombre(somme) },
                      ],
                    });
                  }} />
              </g>
            );
          })}
          <line x1={m.g} x2={w - m.d} y1={y(0)} y2={y(0)} className="sv-axe-ligne" />
        </svg>
      )}
      <Bulle bulle={bulle} />
      <ul className="sv-legende">
        {NIVEAUX.map((n) => (
          <li key={n.cle}><span className="sv-legende__marque" style={{ background: n.couleur }} />{t(n.label)}
            <b>{nombre(tranches.reduce((s, x) => s + x[n.cle], 0))}</b></li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Courbes des sondes (un panneau par unité : un seul axe) ---------- */

function GraphiqueCourbes({ series, debut, fin, couleurs }) {
  const [ref, w] = useLargeur();
  const [survol, setSurvol] = useState(null);
  const h = 230;
  const m = { g: 44, d: 10, h: 10, b: 24 };
  const toutes = series.flatMap((s) => s.points.map((p) => p[1]));
  const seuils = series.length === 1 ? [series[0].min, series[0].max].filter((v) => v != null) : [];
  const yTicks = graduationsValeurs(Math.min(...toutes, ...seuils), Math.max(...toutes, ...seuils), 4);
  const y0 = yTicks[0];
  const y1 = yTicks[yTicks.length - 1];
  const iw = Math.max(0, w - m.g - m.d);
  const ih = h - m.h - m.b;
  const x = (v) => m.g + ((v - debut) / (fin - debut)) * iw;
  const y = (v) => m.h + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const { ticks, format } = graduationsTemps(debut, fin, iw);
  const unite = series[0]?.unite || '';
  const dec = Math.abs(y1 - y0) < 10 ? 2 : 1;

  const chemins = series.map((s) => {
    let d = '';
    let precedent = null;
    const ecart = (fin - debut) / 40; // trou dans les données → la courbe s'interrompt
    s.points.forEach(([iso, v]) => {
      const tt = ms(iso);
      d += `${precedent == null || tt - precedent > Math.max(ecart, 3 * MIN) ? 'M' : 'L'}${x(tt).toFixed(1)},${y(v).toFixed(1)}`;
      precedent = tt;
    });
    return d;
  });

  const surMouvement = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < m.g || px > w - m.d) { setSurvol(null); return; }
    const tt = debut + ((px - m.g) / iw) * (fin - debut);
    const lignes = [];
    let tRef = null;
    series.forEach((s, i) => {
      let meilleur = null;
      s.points.forEach((p) => {
        const d = Math.abs(ms(p[0]) - tt);
        if (meilleur == null || d < meilleur.d) meilleur = { d, p };
      });
      if (meilleur && meilleur.d < (fin - debut) / 20) {
        tRef = tRef ?? ms(meilleur.p[0]);
        lignes.push({ i, couleur: couleurs[s.liaisonId], label: s.libelle || s.equipementNom, valeur: `${nombre(meilleur.p[1], dec)} ${s.unite}`.trim(), t: ms(meilleur.p[0]), v: meilleur.p[1] });
      }
    });
    if (!lignes.length) { setSurvol(null); return; }
    setSurvol({ px: x(tRef), lignes, bulle: { x: px, y: 8, aGauche: px > w * 0.6, titre: dateHeureCourte(tRef), lignes } });
  };

  return (
    <div className="sv-graph" ref={ref} dir="ltr">
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Courbes des sondes ({u})', { u: unite || t('sans unité') })}
          onMouseMove={surMouvement} onMouseLeave={() => setSurvol(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="sv-grille" />
              <text x={m.g - 6} y={y(v)} className="sv-axe" textAnchor="end" dominantBaseline="middle">{nombre(v, 2)}</text>
            </g>
          ))}
          {ticks.map((v) => (
            <text key={v} x={x(v)} y={h - 6} className="sv-axe" textAnchor="middle">{format(v)}</text>
          ))}
          {seuils.map((v, i) => (
            <g key={`s${i}`}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="sv-seuil" />
              <text x={w - m.d - 4} y={y(v) - 4} className="sv-seuil__txt" textAnchor="end">
                {i === 0 && series[0].min != null ? t('Min {v}', { v: nombre(v, 2) }) : t('Max {v}', { v: nombre(v, 2) })}
              </text>
            </g>
          ))}
          {series.map((s, i) => (
            <path key={s.liaisonId} d={chemins[i]} fill="none" stroke={couleurs[s.liaisonId]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s) => s.points.length === 1 && (
            <circle key={`p${s.liaisonId}`} cx={x(ms(s.points[0][0]))} cy={y(s.points[0][1])} r="4" fill={couleurs[s.liaisonId]} />
          ))}
          {survol && (
            <g pointerEvents="none">
              <line x1={survol.px} x2={survol.px} y1={m.h} y2={m.h + ih} className="sv-viseur" />
              {survol.lignes.map((l) => (
                <circle key={l.i} cx={x(l.t)} cy={y(l.v)} r="4.5" fill={l.couleur} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      )}
      <Bulle bulle={survol?.bulle} />
      <table className="sv-legende-table">
        <thead>
          <tr><th>{t('Sonde')}</th><th>{t('Dernière')}</th><th>{t('Moyenne')}</th><th>{t('Max')}</th></tr>
        </thead>
        <tbody>
          {series.map((s) => {
            const v = s.points.map((p) => p[1]);
            return (
              <tr key={s.liaisonId}>
                <td>
                  <span className="sv-legende__marque" style={{ background: couleurs[s.liaisonId] }} />
                  <span className="sv-legende__nom">{s.libelle || libelleType(s.type)}</span>
                  <span className="sv-legende__eq">{s.equipementNom}</span>
                </td>
                <td>{nombre(v[v.length - 1], dec)} {s.unite}</td>
                <td>{nombre(v.reduce((a, b) => a + b, 0) / v.length, dec)}</td>
                <td>{nombre(Math.max(...v), dec)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Disponibilité réseau (frise d'état) ---------- */

function FriseDisponibilite({ lignes, debut, fin, onOuvrir }) {
  const [ref, w] = useLargeur();
  const [bulle, setBulle] = useState(null);
  const nomL = Math.min(190, Math.max(110, w * 0.26));
  const tauxL = 64;
  const iw = Math.max(0, w - nomL - tauxL - 12);
  const x = (v) => ((v - debut) / (fin - debut)) * iw;
  const { ticks, format } = graduationsTemps(debut, fin, iw);

  const montrer = (e, titre, lignesBulle) => {
    const r = ref.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    setBulle({ x: px, y: e.clientY - r.top + 10, aGauche: px > w * 0.6, titre, lignes: lignesBulle });
  };

  return (
    <div className="sv-frise" ref={ref} onMouseLeave={() => setBulle(null)}>
      {lignes.map((l) => (
        <div className="sv-frise__ligne" key={l.equipementId}>
          <button type="button" className="sv-frise__nom" style={{ width: nomL }} onClick={() => onOuvrir(l.equipementId)} title={l.nom}>
            {l.horsLigneMaintenant
              ? <WifiOff size={13} className="sv-ko" aria-label={t('Hors ligne')} />
              : <Wifi size={13} className="sv-ok" aria-label={t('En ligne')} />}
            <span>{l.nom}</span>
          </button>
          <div className="sv-frise__barre" style={{ width: iw }} dir="ltr"
            onMouseMove={(e) => {
              if (e.target.dataset.coupure) return;
              montrer(e, l.nom, [
                { couleur: '#10b981', label: t('En ligne'), valeur: `${nombre(l.tauxPct, 1)} %` },
                { label: t('Hors ligne'), valeur: l.minutesHorsLigne ? duree(l.minutesHorsLigne) : t('aucune coupure') },
                ...(l.adresseIp ? [{ label: t('Adresse IP'), valeur: l.adresseIp }] : []),
              ]);
            }}>
            {l.coupures.map((c, i) => {
              const a = ms(c.debut);
              const b = ms(c.fin);
              return (
                <span key={i} className="sv-frise__coupure" data-coupure="1"
                  style={{ left: x(a), width: Math.max(2, x(b) - x(a)) }}
                  onMouseMove={(e) => montrer(e, `${l.nom} — ${t('Hors ligne')}`, [
                    { couleur: '#dc2626', label: t('Début'), valeur: dateHeureCourte(a) },
                    { label: t('Fin'), valeur: b >= fin - MIN ? t('en cours') : dateHeureCourte(b) },
                    { label: t('Durée'), valeur: duree((b - a) / MIN) },
                  ])} />
              );
            })}
          </div>
          <span className="sv-frise__taux" data-ton={l.tauxPct >= 99.5 ? 'succes' : l.tauxPct >= 95 ? 'attention' : 'danger'}>
            {nombre(l.tauxPct, 1)} %
          </span>
        </div>
      ))}
      <div className="sv-frise__axe" style={{ marginInlineStart: nomL, width: iw }} dir="ltr">
        {ticks.map((v) => <span key={v} style={{ left: x(v) }}>{format(v)}</span>)}
      </div>
      <ul className="sv-legende">
        <li><span className="sv-legende__marque" style={{ background: '#10b981' }} /><Wifi size={12} aria-hidden="true" />{t('En ligne')}</li>
        <li><span className="sv-legende__marque" style={{ background: '#dc2626' }} /><WifiOff size={12} aria-hidden="true" />{t('Hors ligne')}</li>
      </ul>
      <Bulle bulle={bulle} />
    </div>
  );
}

/* ---------- Classement (barres horizontales) ---------- */

function Classement({ lignes, onOuvrir }) {
  const max = Math.max(1, ...lignes.map((l) => l.nombre));
  return (
    <ol className="sv-classement">
      {lignes.map((l) => (
        <li key={l.equipementId}>
          <button type="button" onClick={() => onOuvrir(l.equipementId)} title={l.nom}>
            <span className="sv-classement__nom">{l.nom}</span>
            <span className="sv-classement__n">
              {nombre(l.nombre)}
              {l.critiques > 0 && <small> · {t('{n} critique(s)', { n: l.critiques })}</small>}
            </span>
            <span className="sv-classement__piste" aria-hidden="true">
              <span style={{ width: `${(l.nombre / max) * 100}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Page ---------- */

export default function Supervision() {
  const navigate = useNavigate();
  const [heures, setHeures] = useState(() => lire(CLE_PERIODE, 24, PERIODES));
  const [auto, setAuto] = useState(() => lire(CLE_AUTO, 60, RAFRAICHISSEMENTS));
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [majLe, setMajLe] = useState(null);
  const enCours = useRef(false);

  const charger = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    setChargement(true);
    try {
      const d = await supervisionService.tableau(heures);
      setDonnees(d);
      setErreur(null);
      setMajLe(Date.now());
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger la supervision.'));
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, [heures]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => { if (!document.hidden) charger(); }, auto * 1000);
    return () => clearInterval(id);
  }, [auto, charger]);

  const ouvrir = useCallback((id) => id && navigate(`/equipement/${id}`), [navigate]);

  const debut = ms(donnees?.periode?.debut);
  const fin = ms(donnees?.periode?.fin);
  const ind = donnees?.indicateurs || {};

  /* Une couleur par sonde, dans l'ordre de leur identifiant : elle ne change pas avec la période. */
  const couleurs = useMemo(() => {
    const ids = [...new Set((donnees?.liaisons || []).map((l) => l.id))].sort((a, b) => a - b);
    const c = {};
    ids.forEach((id, i) => { c[id] = PALETTE[i % PALETTE.length]; });
    return c;
  }, [donnees?.liaisons]);

  /* Un panneau par unité (°C, bar, %…), au plus 6 sondes par panneau. */
  const groupes = useMemo(() => {
    const g = new Map();
    (donnees?.mesures || []).forEach((s) => {
      const u = s.unite || '';
      if (!g.has(u)) g.set(u, []);
      g.get(u).push(s);
    });
    return [...g.entries()].flatMap(([u, l]) => {
      const morceaux = [];
      for (let i = 0; i < l.length; i += 6) morceaux.push({ unite: u, series: l.slice(i, i + 6), cle: `${u}-${i}` });
      return morceaux;
    });
  }, [donnees?.mesures]);

  const etats = useMemo(() => {
    const l = [];
    (donnees?.connexions || []).forEach((c) => l.push({
      cle: `ip-${c.id}`, equipementId: c.lotArticleImmobilistationId, nom: c.equipementNom || `#${c.lotArticleImmobilistationId}`,
      type: t('Réseau IP'), icone: Network, adresse: `${c.adresseIp}${c.port ? `:${c.port}` : ''}`,
      etat: c.horsLigneDepuis ? { ton: 'danger', label: t('Hors ligne') } : c.dernierResultat === 'EN_LIGNE' ? { ton: 'succes', label: t('En ligne') } : { ton: 'neutre', label: t('Non vérifié') },
      valeur: c.dernierTempsMs != null && !c.horsLigneDepuis ? `${c.dernierTempsMs} ms` : c.horsLigneDepuis ? t('depuis {d}', { d: ilYa(c.horsLigneDepuis) }) : '—',
      date: c.derniereVerification, rang: c.horsLigneDepuis ? 0 : 2,
    }));
    (donnees?.liaisons || []).filter((x) => x.actif !== false).forEach((x) => {
      const e = ETAT_LIAISON[x.dernierEtat] || ETAT_LIAISON.ATTENTE;
      l.push({
        cle: `li-${x.id}`, equipementId: x.lotArticleImmobilistationId, nom: x.equipementNom || `#${x.lotArticleImmobilistationId}`,
        type: libelleType(x.type), icone: Cable, adresse: t('agent {a}', { a: x.agentNom }),
        etat: { ton: e.ton, label: t(e.label) },
        valeur: x.derniereValeur != null ? `${nombre(x.derniereValeur, 2)} ${x.unite || ''}`.trim() : (x.dernierMessage || '—'),
        date: x.derniereLecture, rang: e.ton === 'danger' ? 0 : e.ton === 'orange' ? 1 : 2,
      });
    });
    return l.sort((a, b) => a.rang - b.rang || a.nom.localeCompare(b.nom));
  }, [donnees?.connexions, donnees?.liaisons]);

  const tranches = donnees?.alertesParTranche || [];
  const pret = donnees && Number.isFinite(debut) && Number.isFinite(fin);
  const agentsArretes = (ind.agents || 0) - (ind.agentsEnLigne || 0);

  const barre = (
    <div className="sv-outils">
      <VeilleSegments label={t('Période')} valeur={heures}
        options={PERIODES.map((p) => ({ cle: p.cle, label: t(p.label) }))}
        onChange={(v) => { setHeures(v); ecrire(CLE_PERIODE, v); }} />
      <label className="sv-auto">
        <RefreshCw size={14} aria-hidden="true" />
        <span className="vl-sr">{t('Rafraîchissement automatique')}</span>
        <select value={auto} onChange={(e) => { const v = Number(e.target.value); setAuto(v); ecrire(CLE_AUTO, v); }}>
          {RAFRAICHISSEMENTS.map((r) => <option key={r.cle} value={r.cle}>{t(r.label)}</option>)}
        </select>
      </label>
      <button type="button" className="vl-btn" onClick={charger} disabled={chargement}>
        {chargement ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
        {t('Rafraîchir')}
      </button>
    </div>
  );

  return (
    <VeillePage
      className="sv-page"
      icone={MonitorDot}
      titre={t('Supervision')}
      description={t('État du parc connecté en temps réel : réseau, sondes des agents et alertes des machines.')}
      actions={barre}
    >
      {majLe && (
        <p className="sv-maj">
          <span className={`sv-maj__point ${auto ? 'is-live' : ''}`} aria-hidden="true" />
          {t('Mis à jour à {h}', { h: new Date(majLe).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
          {pret && <> · {dateHeureCourte(debut)} → {dateHeureCourte(fin)}</>}
        </p>
      )}
      {erreur && <VeilleMessage ton="danger">{erreur}</VeilleMessage>}
      {!donnees && !erreur && (
        <div className="sv-chargement"><LoaderCircle size={22} className="vl-tourne" aria-hidden="true" />{t('Chargement…')}</div>
      )}

      {pret && (
        <div className="sv-grille-panneaux">
          {/* Ligne 1 : indicateurs */}
          <div className="sv-stats sv-l12">
            <Indicateur icone={MonitorDot} label={t('Équipements connectés')} valeur={nombre(ind.equipementsConnectes)} ton="marque"
              sous={t('{ip} en IP · {l} liaison(s) agent', { ip: ind.avecIp, l: ind.liaisons })} />
            <Indicateur icone={Wifi} label={t('En ligne')} valeur={nombre(ind.enLigne)} total={ind.avecIp}
              ton={ind.avecIp && ind.enLigne === ind.avecIp ? 'succes' : 'attention'}
              etat={ind.avecIp && ind.enLigne === ind.avecIp ? t('Tout répond') : t('Partiel')} />
            <Indicateur icone={WifiOff} label={t('Hors ligne')} valeur={nombre(ind.horsLigne)}
              ton={ind.horsLigne ? 'danger' : 'succes'} etat={ind.horsLigne ? t('À vérifier') : t('Aucune coupure')} />
            <Indicateur icone={BellRing} label={t('Alertes ouvertes')} valeur={nombre(ind.alertesOuvertes)}
              ton={ind.critiquesOuvertes ? 'danger' : ind.alertesOuvertes ? 'orange' : 'succes'}
              etat={ind.critiquesOuvertes ? t('{n} critique(s)', { n: ind.critiquesOuvertes }) : ind.alertesOuvertes ? t('À traiter') : t('Rien à traiter')}
              etincelle={<Etincelle valeurs={tranches.map((x) => x.critique + x.alerte + x.info)} couleur="#f97316" />} />
            <Indicateur icone={ServerCog} label={t('Agents en ligne')} valeur={nombre(ind.agentsEnLigne)} total={ind.agents}
              ton={!ind.agents ? 'neutre' : agentsArretes ? 'danger' : 'succes'}
              etat={!ind.agents ? t('Aucun agent') : agentsArretes ? t('{n} arrêté(s)', { n: agentsArretes }) : t('Tous actifs')} />
            <Indicateur icone={Cable} label={t('Liaisons en défaut')} valeur={nombre(ind.liaisonsProbleme)} total={ind.liaisons}
              ton={!ind.liaisons ? 'neutre' : ind.liaisonsProbleme ? 'orange' : 'succes'}
              etat={!ind.liaisons ? t('Aucune liaison') : ind.liaisonsProbleme ? t('À vérifier') : t('Toutes lisent')} />
          </div>

          {/* Ligne 2 */}
          <Panneau className="sv-l8" titre={t('Alertes reçues')}
            aide={t('Alertes des machines (SNMP, Syslog, agents, surveillance réseau) reçues sur la période, par niveau.')}
            meta={t('par tranche de {d}', { d: duree(donnees.periode.pasAlertesMinutes) })}>
            {tranches.some((x) => x.critique + x.alerte + x.info)
              ? <GraphiqueAlertes tranches={tranches} debut={debut} fin={fin} pasMinutes={donnees.periode.pasAlertesMinutes} />
              : <Vide>{t('Aucune alerte reçue sur la période.')}</Vide>}
          </Panneau>
          <Panneau className="sv-l4" titre={t('Agents de terrain')} aide={t('Programmes installés sur les PC d’atelier : ils testent les équipements et envoient un signal chaque minute.')}>
            {donnees.agents.length ? (
              <ul className="sv-agents">
                {donnees.agents.map((a) => {
                  const enLigne = a.etat === 'EN_LIGNE';
                  return (
                    <li key={a.id}>
                      <ServerCog size={16} className={enLigne ? 'sv-ok' : 'sv-ko'} aria-hidden="true" />
                      <div>
                        <strong>{a.nom}</strong>
                        <span>{[a.hote, a.adresse].filter(Boolean).join(' · ')}</span>
                        <span>{t('{n} équipement(s) testé(s)', { n: a.equipementsSurveilles ?? 0 })} · {t('signal {d}', { d: ilYa(a.derniereActivite) || '—' })}</span>
                      </div>
                      <Pastille ton={enLigne ? 'succes' : 'danger'}>{enLigne ? t('En ligne') : t('Arrêté')}</Pastille>
                    </li>
                  );
                })}
              </ul>
            ) : <Vide>{t('Aucun agent n’a encore envoyé de signal.')}</Vide>}
          </Panneau>

          {/* Ligne 3 : sondes */}
          {groupes.length ? groupes.map((g) => (
            <Panneau key={g.cle} className={groupes.length === 1 ? 'sv-l12' : 'sv-l6'}
              titre={g.unite ? t('Sondes — {u}', { u: g.unite }) : t('Sondes')}
              aide={t('Valeurs lues par les agents (RS485, Zigbee), moyenne par tranche de {d}. Les lignes pointillées sont les limites de la sonde.', { d: duree(donnees.periode.pasMesuresMinutes) })}
              meta={t('{n} sonde(s)', { n: g.series.length })}>
              <GraphiqueCourbes series={g.series} debut={debut} fin={fin} couleurs={couleurs} />
            </Panneau>
          )) : (
            <Panneau className="sv-l12" titre={t('Sondes')} aide={t('Valeurs lues par les agents (RS485, Zigbee).')}>
              <Vide>
                <Activity size={18} aria-hidden="true" />
                {t('Aucune mesure sur la période. Ajoutez une liaison « RS485 » ou « Zigbee » depuis la fiche d’un équipement pour suivre une valeur.')}
              </Vide>
            </Panneau>
          )}

          {/* Ligne 4 */}
          <Panneau className="sv-l8" titre={t('Disponibilité réseau')}
            aide={t('Coupures constatées par la surveillance réseau et les agents, pour les équipements avec une adresse IP. Les moins disponibles en premier.')}
            meta={t('{n} équipement(s)', { n: donnees.disponibilite.length })} corpsClass="sv-defile">
            {donnees.disponibilite.length
              ? <FriseDisponibilite lignes={donnees.disponibilite} debut={debut} fin={fin} onOuvrir={ouvrir} />
              : <Vide>{t('Aucun équipement avec une adresse IP. Renseignez-la dans la fiche de l’équipement (onglet Connexion).')}</Vide>}
          </Panneau>
          <Panneau className="sv-l4" titre={t('Équipements les plus en alerte')} aide={t('Nombre d’alertes reçues sur la période, répétitions comprises.')}>
            {donnees.classement.length
              ? <Classement lignes={donnees.classement} onOuvrir={ouvrir} />
              : <Vide>{t('Aucune alerte liée à un équipement.')}</Vide>}
          </Panneau>

          {/* Ligne 5 */}
          <Panneau className="sv-l8" titre={t('État des connexions')} meta={t('{n} connexion(s)', { n: etats.length })} corpsClass="sv-defile sv-sans-marge">
            {etats.length ? (
              <table className="sv-table">
                <thead>
                  <tr><th>{t('Équipement')}</th><th>{t('Liaison')}</th><th>{t('État')}</th><th>{t('Valeur')}</th><th>{t('Dernière lecture')}</th></tr>
                </thead>
                <tbody>
                  {etats.map((e) => {
                    const Ic = e.icone;
                    return (
                      <tr key={e.cle} onClick={() => ouvrir(e.equipementId)} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && ouvrir(e.equipementId)}>
                        <td className="sv-table__nom">{e.nom}</td>
                        <td><span className="sv-table__type"><Ic size={13} aria-hidden="true" />{e.type}</span><small>{e.adresse}</small></td>
                        <td><Pastille ton={e.etat.ton}>{e.etat.label}</Pastille></td>
                        <td className="sv-num">{e.valeur}</td>
                        <td className="sv-discret">{e.date ? ilYa(e.date) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <Vide>{t('Aucune connexion configurée.')}</Vide>}
          </Panneau>
          <Panneau className="sv-l4" titre={t('Dernières alertes')} corpsClass="sv-defile sv-sans-marge">
            {donnees.dernieresAlertes.length ? (
              <ul className="sv-alertes">
                {donnees.dernieresAlertes.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => ouvrir(a.lotArticleImmobilistationId)} disabled={!a.lotArticleImmobilistationId}>
                      <span className="sv-alertes__tete">
                        <Pastille ton={NIVEAU_TON[a.niveau] || 'neutre'}>{t(NIVEAU_LABEL[a.niveau] || a.niveau)}</Pastille>
                        <span className="sv-discret">{ilYa(a.derniereReception || a.dateReception)}</span>
                      </span>
                      <span className="sv-alertes__eq">
                        {a.source === 'AGENT'
                          ? t('Agent « {nom} »', { nom: (a.adresseSource || '').replace(/^agent:/, '') })
                          : a.equipementNom || a.adresseSource || t('Adresse inconnue')}
                      </span>
                      <span className="sv-alertes__msg">{(a.message || '').replace(/^\[[^\]]+\]\s*/, '')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Vide><TriangleAlert size={16} aria-hidden="true" />{t('Aucune alerte.')}</Vide>}
          </Panneau>
        </div>
      )}
    </VeillePage>
  );
}
