import { useEffect, useRef, useState } from 'react';
import { t, locale } from '../../../../i18n';
import { POSTES, PERIODES, montantPoste, formatDT, bornesPeriode } from '../../../../constants/Coutlibelles';

/*
 * Graphiques du coût par véhicule. Chaque couleur suit son poste (voir constants/Coutlibelles.js) ;
 * les montants sont toujours écrits (légende, info-bulle, tableau) : la couleur seule ne
 * porte jamais l'information.
 */

const pourcent = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

/* ─────────── Répartition d'un total en une barre (parts d'un tout) ─────────── */

export function BarreRepartition({ postes, titre }) {
  const total = postes?.total || 0;
  const [survol, setSurvol] = useState(null);
  const parts = POSTES.map((p) => ({ ...p, montant: montantPoste(postes, p.cle) })).filter((p) => p.montant > 0);

  return (
    <figure className="vco-repartition">
      {titre && <figcaption className="vco-graph-titre">{titre}</figcaption>}
      {total > 0 ? (
        <div className="vco-barre" role="img" aria-label={parts.map((p) => `${t(p.libelle)} ${pourcent(p.montant, total)} %`).join(', ')}>
          {parts.map((p) => (
            <span
              key={p.cle}
              className={`vco-barre-segment ${survol && survol !== p.cle ? 'is-attenue' : ''}`}
              style={{ flexGrow: p.montant, background: p.couleur }}
              onMouseEnter={() => setSurvol(p.cle)}
              onMouseLeave={() => setSurvol(null)}
            >
              {survol === p.cle && (
                <span className="vco-bulle" role="tooltip">
                  <strong>{t(p.libelle)}</strong> {formatDT(p.montant)} · {pourcent(p.montant, total)} %
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <div className="vco-barre vco-barre--vide" />
      )}
      <ul className="vco-legende">
        {POSTES.map((p) => {
          const m = montantPoste(postes, p.cle);
          return (
            <li key={p.cle} className={m > 0 ? '' : 'is-nul'} onMouseEnter={() => setSurvol(m > 0 ? p.cle : null)} onMouseLeave={() => setSurvol(null)}>
              <span className="vco-pastille" style={{ background: p.couleur }} aria-hidden="true" />
              <span className="vco-legende-nom">{t(p.libelle)}</span>
              <span className="vco-legende-val">{formatDT(m, 0)}</span>
              <span className="vco-legende-pct">{pourcent(m, total)} %</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ─────────── Mini-barre d'une ligne du tableau (longueur ∝ coût total) ─────────── */

export function MiniBarre({ postes, max }) {
  const total = postes?.total || 0;
  if (!total || !max) return <span className="vco-mini vco-mini--vide" aria-hidden="true" />;
  return (
    <span className="vco-mini" aria-hidden="true" style={{ width: `${Math.max(4, (total / max) * 100)}%` }}>
      {POSTES.map((p) => {
        const m = montantPoste(postes, p.cle);
        return m > 0 ? <span key={p.cle} style={{ flexGrow: m, background: p.couleur }} title={`${t(p.libelle)} : ${formatDT(m)}`} /> : null;
      })}
    </span>
  );
}

/* ─────────── Coût par mois : colonnes empilées par poste ─────────── */

const MOIS_COURTS = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale(), { month: 'short' });
const MOIS_LONGS = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

/** Graduations « rondes » de 0 au maximum (1, 2 ou 5 × 10^n). */
function graduations(max, voulues = 4) {
  if (max <= 0) return [0];
  const brut = max / voulues;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * puissance).find((p) => p >= brut);
  const liste = [];
  for (let v = 0; v <= max + pas * 0.001; v += pas) liste.push(v);
  if (liste.at(-1) < max) liste.push(liste.at(-1) + pas);
  return liste;
}

export function GraphiqueMensuel({ parMois }) {
  const boite = useRef(null);
  const [largeur, setLargeur] = useState(640);
  const [survol, setSurvol] = useState(null);

  useEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setLargeur(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mois = parMois || [];
  const max = Math.max(0, ...mois.map((m) => m.postes?.total || 0));
  const ticks = graduations(max);
  const haut = ticks.at(-1) || 1;

  const H = 220, gauche = 56, droite = 8, hautMarge = 12, basMarge = 28;
  const zoneL = largeur - gauche - droite, zoneH = H - hautMarge - basMarge;
  const pasX = mois.length ? zoneL / mois.length : zoneL;
  const largeurBarre = Math.min(36, Math.max(6, pasX * 0.6));
  const y = (v) => hautMarge + zoneH - (v / haut) * zoneH;
  // Une étiquette de mois sur deux quand la place manque
  const saut = pasX < 34 ? 2 : 1;
  const courant = survol != null ? mois[survol] : null;

  return (
    <figure className="vco-mensuel" ref={boite}>
      <figcaption className="vco-graph-titre">{t('Coût par mois')}</figcaption>
      <div className="vco-mensuel-zone" dir="ltr">
        <svg width={largeur} height={H} role="img" aria-label={t('Coût par mois')} onMouseLeave={() => setSurvol(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={gauche} x2={largeur - droite} y1={y(v)} y2={y(v)} className={v === 0 ? 'vco-axe' : 'vco-grille'} />
              <text x={gauche - 8} y={y(v) + 4} textAnchor="end" className="vco-graduation">
                {Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}
          {mois.map((m, i) => {
            const cx = gauche + pasX * i + pasX / 2;
            let cumul = 0;
            const segments = POSTES.map((p) => ({ ...p, v: montantPoste(m.postes, p.cle) })).filter((s) => s.v > 0);
            return (
              <g key={m.mois}>
                {survol === i && <rect x={gauche + pasX * i} y={hautMarge} width={pasX} height={zoneH} className="vco-colonne-survol" />}
                {segments.map((s, k) => {
                  const y0 = y(cumul), y1 = y(cumul + s.v);
                  cumul += s.v;
                  const hauteur = Math.max(0, y0 - y1 - (k < segments.length - 1 ? 2 : 0)); // 2 px entre segments
                  const dernier = k === segments.length - 1;
                  // Haut de la colonne arrondi (4 px, moins si le segment est plus fin)
                  const r = Math.min(4, (y0 - y1) / 2, largeurBarre / 2);
                  const xg = cx - largeurBarre / 2, xd = cx + largeurBarre / 2;
                  return dernier ? (
                    <path key={s.cle} fill={s.couleur}
                      d={`M${xg},${y0} V${y1 + r} Q${xg},${y1} ${xg + r},${y1} H${xd - r} Q${xd},${y1} ${xd},${y1 + r} V${y0} Z`} />
                  ) : (
                    <rect key={s.cle} x={cx - largeurBarre / 2} y={y0 - hauteur} width={largeurBarre} height={hauteur} fill={s.couleur} />
                  );
                })}
                {i % saut === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="vco-graduation">{MOIS_COURTS(m.mois)}</text>
                )}
                {/* Zone de survol plus large que la barre */}
                <rect x={gauche + pasX * i} y={hautMarge} width={pasX} height={zoneH + basMarge} fill="transparent"
                  onMouseEnter={() => setSurvol(i)} />
              </g>
            );
          })}
        </svg>
        {courant && (
          <div className="vco-bulle vco-bulle--mensuel" role="tooltip"
            style={{ left: Math.min(largeur - 200, Math.max(0, gauche + pasX * survol + pasX / 2 - 100)) }}>
            <strong>{MOIS_LONGS(courant.mois)}</strong>
            {POSTES.map((p) => {
              const v = montantPoste(courant.postes, p.cle);
              return v > 0 ? (
                <span key={p.cle} className="vco-bulle-ligne">
                  <span className="vco-pastille" style={{ background: p.couleur }} aria-hidden="true" />
                  {t(p.libelle)} <b>{formatDT(v)}</b>
                </span>
              ) : null;
            })}
            <span className="vco-bulle-total">{t('Total')} <b>{formatDT(courant.postes?.total)}</b></span>
          </div>
        )}
      </div>
      <p className="vco-unite">{t('Montants en dinars (DT)')}</p>
    </figure>
  );
}

/* ─────────── Choix de la période (boutons + dates personnalisées) ───────────
   valeur = { cle: 'annee' | '12mois' | 'precedente' | 'perso', perso: { debut, fin } } */

export function ChoixPeriode({ valeur, onChange }) {
  const { cle, perso } = valeur;
  const bornes = bornesPeriode(cle, perso);
  const persoValide = cle !== 'perso' || (perso?.debut && perso?.fin && perso.debut <= perso.fin);
  const choisir = (nouvelle) => {
    if (nouvelle === cle) return;
    // « Personnalisée » part des dates affichées
    onChange({ cle: nouvelle, perso: nouvelle === 'perso' ? bornes : perso });
  };
  return (
    <div className="vco-choix-periode">
      <div className="vco-periode" role="group" aria-label={t('Période')}>
        {PERIODES.map((p) => (
          <button key={p.cle} type="button" className={`vco-periode-btn ${cle === p.cle ? 'is-actif' : ''}`}
            aria-pressed={cle === p.cle} onClick={() => choisir(p.cle)}>{t(p.libelle)}</button>
        ))}
      </div>
      {cle === 'perso' && (
        <div className="vco-perso">
          <label htmlFor="vco-debut">{t('Du')}</label>
          <input id="vco-debut" type="date" value={perso.debut} max={perso.fin || undefined}
            onChange={(e) => onChange({ cle, perso: { ...perso, debut: e.target.value } })} />
          <label htmlFor="vco-fin">{t('Au')}</label>
          <input id="vco-fin" type="date" value={perso.fin} min={perso.debut || undefined}
            onChange={(e) => onChange({ cle, perso: { ...perso, fin: e.target.value } })} />
          {!persoValide && <span className="vco-perso-erreur" role="alert">{t('Choisissez une date de début avant la date de fin.')}</span>}
        </div>
      )}
    </div>
  );
}