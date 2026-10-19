import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, FileSpreadsheet, Info, Loader2, Minus } from 'lucide-react';
import { exporterIndicateursExcel } from './exportExcel';
import { t } from '../../../i18n';
import { formater, libelleMois, nf } from './format';
import './Indicateurs.css';

/*
 * Briques des indicateurs de tableau de bord :
 *   <SectionIndicateurs titre sousTitre>…</SectionIndicateurs>
 *   <TuileKpi libelle valeur format precedent sens aide lien ton />
 *   <Classement titre lignes format lien />
 *   <CourbeTendance titre mois series format />
 */

/* ─── Section ─── */
export function SectionIndicateurs({ titre, sousTitre, chargement, erreur, exportExcel, children }) {
  const [exportEnCours, setExportEnCours] = useState(false);
  const exporter = async () => {
    setExportEnCours(true);
    try { await exporterIndicateursExcel(exportExcel); } finally { setExportEnCours(false); }
  };
  return (
    <section className="ind-section" aria-busy={chargement || undefined}>
      <header className="ind-section__entete">
        <div>
          <h2 className="ind-section__titre">{titre}</h2>
          {sousTitre && <p className="ind-section__sous-titre">{sousTitre}</p>}
        </div>
        {exportExcel && (
          <button type="button" className="ind-export" onClick={exporter} disabled={chargement || exportEnCours}>
            {exportEnCours ? <Loader2 size={16} className="ind-tourne" aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
            {t('Exporter en Excel')}
          </button>
        )}
      </header>
      {erreur && <p className="ind-section__erreur" role="alert">{erreur}</p>}
      {children}
    </section>
  );
}

/* ─── Tuile d'indicateur avec comparaison ─── */
/**
 * sens : 'baisse' (une baisse est une bonne nouvelle : délais, coûts, incidents),
 *        'hausse' (une hausse est bonne : clôtures, taux de respect), 'neutre'.
 */
export function TuileKpi({ libelle, valeur, format = 'nombre', precedent, sens = 'neutre', aide, detail, lien, ton, chargement }) {
  const navigate = useNavigate();
  // Une valeur nulle ou à zéro n'est pas affichée (la tuile disparaît)
  if (!chargement && (valeur == null || Number(valeur) === 0)) return null;
  let comparaison = null;
  if (!chargement && valeur != null && precedent != null) {
    const ecart = valeur - precedent;
    const pct = precedent !== 0 ? (ecart / Math.abs(precedent)) * 100 : null;
    const stable = Math.abs(ecart) < 1e-9 || (pct != null && Math.abs(pct) < 1);
    const hausse = ecart > 0;
    const bon = stable || sens === 'neutre' ? 'neutre' : (hausse === (sens === 'hausse') ? 'bon' : 'mauvais');
    const Icone = stable ? Minus : hausse ? ArrowUpRight : ArrowDownRight;
    const texteEcart = format === 'pct'
      ? t('{n} pts', { n: nf(Math.abs(ecart), 1) })
      : pct != null ? t('{n} %', { n: nf(Math.abs(pct)) }) : formater(Math.abs(ecart), format);
    comparaison = (
      <span className={`ind-kpi__comp ind-kpi__comp--${bon}`}>
        <Icone size={13} aria-hidden="true" />
        <span>{stable ? t('Stable') : `${hausse ? '+' : '−'}${texteEcart}`}</span>
        <span className="ind-kpi__comp-ref">{t('vs {v}', { v: formater(precedent, format) })}</span>
      </span>
    );
  }
  const contenu = (
    <>
      <span className="ind-kpi__libelle">
        {libelle}
        {aide && <span className="ind-kpi__aide" title={aide} aria-label={aide}><Info size={12} aria-hidden="true" /></span>}
      </span>
      <span className="ind-kpi__valeur">{chargement ? '…' : formater(valeur, format)}</span>
      {detail && !chargement && <span className="ind-kpi__detail">{detail}</span>}
      {comparaison}
      {lien && <ChevronRight size={15} className="ind-kpi__fleche rtl-miroir" aria-hidden="true" />}
    </>
  );
  const classe = `ind-kpi ${ton ? `ind-kpi--${ton}` : ''} ${lien ? 'ind-kpi--lien' : ''}`;
  return lien
    ? <button type="button" className={classe} onClick={() => navigate(lien)}>{contenu}</button>
    : <div className={classe}>{contenu}</div>;
}

export function GrilleKpi({ children }) {
  return <div className="ind-grille">{children}</div>;
}

/* ─── Classement (top N) ─── */
export function Classement({ titre, sousTitre, lignes: toutes, format = 'nombre', vide, lienDe }) {
  const navigate = useNavigate();
  // Les lignes à zéro ne sont pas affichées ; sans aucune ligne, la carte disparaît
  const lignes = toutes.filter((l) => Number(l.valeur) > 0);
  if (lignes.length === 0) return null;
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="ind-carte">
      <div className="ind-carte__entete">
        <h3>{titre}</h3>
        {sousTitre && <span className="ind-carte__sous">{sousTitre}</span>}
      </div>
      {lignes.length === 0 ? (
        <p className="ind-carte__vide">{vide || t('Pas encore de données.')}</p>
      ) : (
        <ol className="ind-classement">
          {lignes.map((l, i) => {
            const lien = lienDe?.(l);
            const Balise = lien ? 'button' : 'div';
            return (
              <li key={l.cle}>
                <Balise
                  type={lien ? 'button' : undefined}
                  className={`ind-classement__ligne ${lien ? 'is-lien' : ''}`}
                  onClick={lien ? () => navigate(lien) : undefined}
                  title={`${l.libelle} : ${formater(l.valeur, format)}`}
                >
                  <span className="ind-classement__rang">{i + 1}</span>
                  <span className="ind-classement__nom">{l.libelle}</span>
                  <span className="ind-classement__barre" aria-hidden="true">
                    <span style={{ width: `${Math.max(3, (l.valeur / max) * 100)}%` }} />
                  </span>
                  <span className="ind-classement__val">{formater(l.valeur, format)}</span>
                </Balise>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ─── Courbe de tendance sur 12 mois (1 ou 2 séries, même unité, un seul axe) ─── */
const COULEURS = ['#0794a4', '#6e56cf']; // validées daltonisme (ΔE ≥ 14)

export function CourbeTendance({ titre, sousTitre, mois, series, format = 'nombre', large = true }) {
  const id = useId();
  const [survol, setSurvol] = useState(null);
  // Le dessin suit la largeur réelle de la carte : le texte garde sa taille quelle que soit la largeur
  const boite = useRef(null);
  const [L, setL] = useState(640);
  useEffect(() => {
    const el = boite.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(([e]) => setL(Math.max(260, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const H = 220;
  const m = { g: 36, d: 12, h: 14, b: 28 };
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
  const pas = (L - m.g - m.d) / Math.max(1, mois.length - 1);
  const x = (i) => m.g + i * pas;
  const y = (v) => m.h + (H - m.h - m.b) * (1 - v / max);
  const graduations = [0, max / 2, max];
  const vide = series.every((s) => s.valeurs.every((v) => !v));
  if (vide) return null; // aucune valeur sur 12 mois : la courbe n'est pas affichée

  return (
    <div className={`ind-carte ${large ? 'ind-carte--large' : ''}`}>
      <div className="ind-carte__entete">
        <h3>{titre}</h3>
        {sousTitre && <span className="ind-carte__sous">{sousTitre}</span>}
      </div>
      {series.length > 1 && (
        <ul className="ind-legende">
          {series.map((s, i) => (
            <li key={s.nom}><span className="ind-legende__trait" style={{ background: COULEURS[i] }} />{s.nom}</li>
          ))}
        </ul>
      )}
      {vide ? (
        <p className="ind-carte__vide">{t('Pas encore de données sur les 12 derniers mois.')}</p>
      ) : (
        <div className="ind-courbe" ref={boite}>
          <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-labelledby={`${id}-desc`} onMouseLeave={() => setSurvol(null)}>
            <desc id={`${id}-desc`}>{titre}</desc>
            {graduations.map((g) => (
              <g key={g}>
                <line x1={m.g} x2={L - m.d} y1={y(g)} y2={y(g)} className="ind-courbe__grille" />
                <text x={m.g - 6} y={y(g) + 4} className="ind-courbe__axe" textAnchor="end">{formater(Math.round(g), format === 'dt' ? 'nombre' : format)}</text>
              </g>
            ))}
            {mois.map((cle, i) => ((L > 420 || i % 2 === mois.length % 2) ? (
              <text key={cle} x={x(i)} y={H - 8} className="ind-courbe__axe" textAnchor="middle">{libelleMois(cle)}</text>
            ) : null))}
            {series.map((s, si) => (
              <g key={s.nom}>
                <polyline
                  fill="none"
                  stroke={COULEURS[si]}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.valeurs.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                />
                {s.valeurs.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={survol === i ? 5 : 3.5} fill={COULEURS[si]} stroke="#fff" strokeWidth="2" />
                ))}
              </g>
            ))}
            {survol != null && <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={H - m.b} className="ind-courbe__repere" />}
            {mois.map((cle, i) => (
              <rect
                key={cle}
                x={x(i) - pas / 2}
                y={0}
                width={pas}
                height={H}
                fill="transparent"
                onMouseEnter={() => setSurvol(i)}
                onFocus={() => setSurvol(i)}
                tabIndex={0}
                aria-label={`${libelleMois(cle)} : ${series.map((s) => `${s.nom} ${formater(s.valeurs[i], format)}`).join(', ')}`}
              />
            ))}
          </svg>
          {survol != null && (
            <div
              className="ind-courbe__bulle"
              style={{ left: `${(x(survol) / L) * 100}%` }}
              role="status"
            >
              <strong>{libelleMois(mois[survol])} {mois[survol].slice(0, 4)}</strong>
              {series.map((s, si) => (
                <span key={s.nom}><i style={{ background: COULEURS[si] }} />{s.nom} : <b>{formater(s.valeurs[survol], format)}</b></span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Lien « voir la liste » en bas d'une carte ─── */
export function LienListe({ vers, children }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="ind-lien" onClick={() => navigate(vers)}>
      {children} <ArrowRight size={14} className="rtl-miroir" aria-hidden="true" />
    </button>
  );
}
