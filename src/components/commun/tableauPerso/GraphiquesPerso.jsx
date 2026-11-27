import { Fragment, useState } from 'react';
import { Bulle, useLargeur } from '../../pages/Supervision/Supervision';
import { Vide } from '../TableauBord';
import { nb } from './outilsPerso';
import { t, locale } from '../../../i18n';

/*
 * Graphiques partagés des tableaux de bord bons / réclamations (SVG et HTML/CSS, sans bibliothèque).
 * Règle : aucune ligne, barre ou légende à 0 ; « Aucune donnée sur la période. » si tout est vide.
 */

function graduations(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) || 10 * p;
  const l = [];
  for (let v = 0; v < max + pas && l.length < 8; v += pas) l.push(Math.round(v * 1e6) / 1e6);
  return l;
}

const dateCourte = (iso, pas) => {
  const d = new Date(`${iso}T00:00:00`);
  if (pas === 'MOIS') return d.toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
};

const VIDE = () => <Vide>{t('Aucune donnée sur la période.')}</Vide>;

/** Courbes par jour / semaine / mois, viseur et bulle au survol. series : [{ cle, label, couleur }]. */
export function CourbePerso({ tranches = [], pas, series }) {
  const [ref, w] = useLargeur();
  const [survol, setSurvol] = useState(null);
  const actives = series.filter((s) => tranches.some((x) => (x[s.cle] || 0) > 0));
  if (!tranches.length || !actives.length) return <VIDE />;
  const h = 220;
  const m = { g: 34, d: 10, h: 10, b: 24 };
  const max = Math.max(1, ...tranches.flatMap((x) => actives.map((s) => x[s.cle] || 0)));
  const yTicks = graduations(Math.max(4, max)).filter((v) => Number.isInteger(v));
  const yMax = yTicks[yTicks.length - 1] || 1;
  const iw = Math.max(0, w - m.g - m.d);
  const ih = h - m.h - m.b;
  const n = tranches.length;
  const x = (i) => m.g + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v) => m.h + ih - (v / yMax) * ih;
  const tous = Math.max(1, Math.ceil((n * 56) / Math.max(1, iw)));
  const bulle = survol == null ? null : {
    x: x(survol), y: 8, aGauche: x(survol) > w * 0.62,
    titre: pas === 'SEMAINE' ? t('Semaine du {d}', { d: dateCourte(tranches[survol].debut, pas) }) : dateCourte(tranches[survol].debut, pas),
    lignes: actives.map((s) => ({ couleur: s.couleur, label: t(s.label), valeur: nb(tranches[survol][s.cle]) })),
  };
  return (
    <div className="sv-graph" ref={ref} dir="ltr">
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Activité sur la période')}
          onMouseLeave={() => setSurvol(null)}
          onMouseMove={(e) => {
            const r = ref.current.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - m.g) / Math.max(1, iw)) * (n - 1));
            setSurvol(Math.max(0, Math.min(n - 1, i)));
          }}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={m.g} x2={w - m.d} y1={y(v)} y2={y(v)} className="sv-grille" />
              <text x={m.g - 6} y={y(v)} className="sv-axe" textAnchor="end" dominantBaseline="middle">{v}</text>
            </g>
          ))}
          {tranches.map((tr, i) => (i % tous === 0 ? (
            <text key={tr.debut} x={x(i)} y={h - 6} className="sv-axe" textAnchor="middle">{dateCourte(tr.debut, pas)}</text>
          ) : null))}
          <line x1={m.g} x2={w - m.d} y1={y(0)} y2={y(0)} className="sv-axe-ligne" />
          {survol != null && <line x1={x(survol)} x2={x(survol)} y1={m.h} y2={m.h + ih} className="sv-viseur" />}
          {actives.map((s) => {
            const d = tranches.map((tr, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(tr[s.cle] || 0).toFixed(1)}`).join('');
            return <path key={s.cle} d={d} fill="none" stroke={s.couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
          })}
          {survol != null && actives.map((s) => (
            <circle key={s.cle} cx={x(survol)} cy={y(tranches[survol][s.cle] || 0)} r="4" fill={s.couleur} stroke="#fff" strokeWidth="2" />
          ))}
        </svg>
      )}
      <Bulle bulle={bulle} />
      <ul className="tb-legende">
        {actives.map((s) => (
          <li key={s.cle}><i style={{ background: s.couleur }} />{t(s.label)}
            <b>{nb(tranches.reduce((a, v) => a + (v[s.cle] || 0), 0))}</b></li>
        ))}
      </ul>
    </div>
  );
}

function BulleColonne({ titre, lignes }) {
  const visibles = lignes.filter(([, v]) => v != null && v !== '' && v !== '0' && v !== 0);
  return (
    <div className="tb-svc-bulle" role="tooltip">
      <strong dir="auto">{titre}</strong>
      <dl>{visibles.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
    </div>
  );
}

/**
 * Histogramme vertical simple. lignes : [{ cle, nom, valeur, bulle?: [[libellé, valeur]], onOuvrir? }].
 * Les deux dernières colonnes ouvrent leur bulle vers la gauche.
 */
export function ColonnesVerticales({ lignes, format = nb, ton = 'teal' }) {
  const visibles = lignes.filter((l) => Number(l.valeur) > 0);
  if (!visibles.length) return <VIDE />;
  const max = Math.max(...visibles.map((l) => Number(l.valeur)));
  return (
    <ul className="tb-vcols tbp-vcols">
      {visibles.map((l, i) => (
        <li key={l.cle} className={`tb-vcol ${i >= visibles.length - 2 ? 'is-gauche' : ''} ${l.onOuvrir ? 'is-cliquable' : ''}`} tabIndex={0}
          onClick={l.onOuvrir} onKeyDown={(e) => e.key === 'Enter' && l.onOuvrir?.()}>
          <b className="tb-vcol-valeur">{format(l.valeur)}</b>
          <span className="tb-vcol-piste">
            <span className={`tb-vcol-barre tb-gv--${l.ton || ton}`} style={{ height: `${Math.max(3, (Number(l.valeur) / max) * 100)}%` }} />
          </span>
          <span className="tb-vcol-nom" dir="auto" title={l.nom}>{l.nom}</span>
          <BulleColonne titre={l.nom} lignes={l.bulle || [[t('Total'), format(l.valeur)]]} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Colonnes groupées : deux séries côte à côte par élément (ex. créés / clôturés par technicien).
 * series : [{ cle, label, couleur }] ; lignes : [{ cle, nom, [serie.cle]: valeur, bulle? }].
 */
export function ColonnesGroupees({ lignes, series, format = nb }) {
  const visibles = lignes.filter((l) => series.some((s) => Number(l[s.cle]) > 0));
  const actives = series.filter((s) => visibles.some((l) => Number(l[s.cle]) > 0));
  if (!visibles.length) return <VIDE />;
  const max = Math.max(...visibles.flatMap((l) => actives.map((s) => Number(l[s.cle]) || 0)));
  return (
    <>
      <ul className="tb-vcols tbp-vcols tbp-groupes">
        {visibles.map((l, i) => (
          <li key={l.cle} className={`tb-vcol tbp-groupe ${i >= visibles.length - 2 ? 'is-gauche' : ''}`} tabIndex={0}>
            <span className="tbp-groupe-barres">
              {actives.map((s) => (
                <span key={s.cle} className="tbp-groupe-col">
                  <b>{Number(l[s.cle]) > 0 ? format(l[s.cle]) : ''}</b>
                  <span className="tbp-groupe-piste">
                    {Number(l[s.cle]) > 0 && <span style={{ height: `${Math.max(3, (Number(l[s.cle]) / max) * 100)}%`, background: s.couleur }} />}
                  </span>
                </span>
              ))}
            </span>
            <span className="tb-vcol-nom" dir="auto" title={l.nom}>{l.nom}</span>
            <BulleColonne titre={l.nom} lignes={[...actives.map((s) => [t(s.label), Number(l[s.cle]) > 0 ? format(l[s.cle]) : null]), ...(l.bulle || [])]} />
          </li>
        ))}
      </ul>
      <ul className="tb-legende">
        {actives.map((s) => (
          <li key={s.cle}><i style={{ background: s.couleur }} />{t(s.label)}
            <b>{format(visibles.reduce((a, l) => a + (Number(l[s.cle]) || 0), 0))}</b></li>
        ))}
      </ul>
    </>
  );
}

/** Colonnes par mois (12 derniers mois). parMois : { 'AAAA-MM': valeur }. */
export function ColonnesMois({ parMois, format = nb, couleur }) {
  const mois = Object.entries(parMois || {});
  if (!mois.some(([, v]) => Number(v) > 0)) return <VIDE />;
  const max = Math.max(1, ...mois.map(([, v]) => Number(v) || 0));
  return (
    <div className="tb-colonnes" role="img" aria-label={t('Valeurs des 12 derniers mois')}>
      {mois.map(([k, v]) => (
        <div key={k} className="tb-colonne">
          <div className="tb-colonne-valeur">{v > 0 ? format(v) : ''}</div>
          <div className="tb-colonne-barre" style={{ height: `${Math.max(v > 0 ? 3 : 1, (v / max) * 100)}%`, ...(couleur ? { background: couleur } : {}) }}
            title={`${new Date(`${k}-01T00:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })} : ${format(v)}`} />
          <div className="tb-colonne-label">{new Date(`${k}-01T00:00:00`).toLocaleDateString(locale(), { month: 'short' }).replace('.', '')}</div>
        </div>
      ))}
    </div>
  );
}
