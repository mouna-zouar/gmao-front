import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, BellRing, CalendarSync, Car, CircleDollarSign, FileWarning, Gauge, LayoutDashboard, LoaderCircle,
  MessageSquareWarning, OctagonAlert, RefreshCw, Route, Timer, Wrench,
} from 'lucide-react';
import tableauDeBordService from '../../../services/tableauDeBordService';
import { Bulle, useLargeur } from '../Supervision/Supervision';
import { ilYa } from '../../ui/Veille/Veille';
import { t, locale } from '../../../i18n';
import '../Supervision/Supervision.css';
import './TableauDeBord.css';

/*
 * Tableau de bord global de la GMAO : l'essentiel de chaque module sur une page, pour une période.
 * Même style que les autres tableaux de bord (bons, réclamations, parc) : en-tête en carte,
 * cartes d'indicateurs avec icône, cartes de graphiques avec pastille de sous-titre.
 * Chaque indicateur et chaque ligne mène à la page qui permet d'agir.
 */

/* Séries de l'activité : ordre fixe (validé daltonisme), la couleur suit la série. */
const SERIES = [
  { cle: 'reclamations', label: 'Réclamations reçues', couleur: '#0794a4' },
  { cle: 'bonsCrees', label: 'Bons créés', couleur: '#eb6834' },
  { cle: 'bonsClotures', label: 'Bons clôturés', couleur: '#6a5acd' },
];

/* Couleurs pleines des barres empilées (même famille que les dégradés tb-g--*). */
const PLEIN = { bleu: '#3b82f6', ambre: '#f59e0b', orange: '#f97316', vert: '#10b981', teal: '#0794a4', rouge: '#dc2626', violet: '#8b5cf6', gris: '#94a3b8' };

const ETATS_EQUIPEMENT = [
  { cle: 'EN_SERVICE', label: 'En service', ton: 'vert' },
  { cle: 'EN_REPARATION', label: 'En réparation', ton: 'teal' },
  { cle: 'EN_PANNE', label: 'En panne', ton: 'rouge' },
  { cle: 'HORS_SERVICE', label: 'Hors service', ton: 'gris' },
];
const ETATS_BON = [
  { cle: 1, label: 'Nouveau', ton: 'bleu' },
  { cle: 3, label: 'En cours', ton: 'vert' },
  { cle: 2, label: 'Suspendu', ton: 'ambre' },
];
const TYPES_BON = [
  { cle: 'CURATIF', label: 'Curatif', ton: 'orange' },
  { cle: 'PREVENTIF', label: 'Préventif', ton: 'teal' },
  { cle: 'INSTALLATION', label: 'Nouvelle installation', ton: 'violet' },
  { cle: 'AUTRE', label: 'Autre', ton: 'gris' },
];
const ANCIENNETE = [
  { label: 'Moins de 2 jours', ton: 'vert' },
  { label: '2 à 7 jours', ton: 'ambre' },
  { label: '1 à 4 semaines', ton: 'orange' },
  { label: 'Plus d’un mois', ton: 'rouge' },
];
const PRIORITES = { P1: 'Immédiate', P2: 'Urgente', P3: 'Normale', P4: 'Planifiable' };
const PRIORITE_TON = { P1: 'rouge', P2: 'orange', P3: 'bleu', P4: 'gris' };
const CRITICITES = { C1: 'Critique', C2: 'Important', C3: 'Normal', C4: 'Faible' };
const PARTIES = {
  activite: 'activité', reclamations: 'réclamations', bons: 'bons', sla: 'délais SLA', couts: 'coûts',
  equipements: 'équipements', disponibilite: 'disponibilité', alertes: 'alertes machines',
  conditionnelle: 'maintenance conditionnelle', renouvellement: 'plan de renouvellement', parc: 'parc véhicules',
};

const PERIODES = [
  { cle: 7, label: '7 j' },
  { cle: 30, label: '30 j' },
  { cle: 90, label: '90 j' },
  { cle: 365, label: '12 mois' },
];
const CLE_PERIODE = 'gmao.tableau-de-bord.periode';

/* ---------- Formats ---------- */

const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
const pct = (v) => (v == null ? '—' : `${nb(v, v >= 99.5 && v < 100 ? 1 : 0)} %`);
/* Isolé de gauche à droite : en arabe, « 12 k DT » ne doit pas devenir « k DT 12 ». */
const dt = (v, court = false) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (court && Math.abs(n) >= 1e6) return `⁦${(n / 1e6).toLocaleString(locale(), { maximumFractionDigits: 2 })} M DT⁩`;
  if (court && Math.abs(n) >= 1000) return `⁦${(n / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} k DT⁩`;
  return `⁦${n.toLocaleString(locale(), { maximumFractionDigits: 0 })} DT⁩`;
};
const heures = (h) => {
  if (h == null) return '—';
  if (h < 1) return t('{n} min', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t('{n} h', { n: nb(h, 1) });
  return t('{n} j', { n: nb(h / 24, 1) });
};
const dateCourte = (iso, pas) => {
  const d = new Date(`${iso}T00:00:00`);
  if (pas === 'MOIS') return d.toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
};
const moisCourt = (k) => new Date(`${k}-01T00:00:00`).toLocaleDateString(locale(), { month: 'short' }).replace('.', '');

/** Évolution par rapport à la période précédente : « +12 % » (ou null si rien à comparer). */
function evolution(actuel, precedent) {
  if (actuel == null || precedent == null || precedent === 0) return null;
  const v = ((actuel - precedent) / precedent) * 100;
  return `⁦${v > 0 ? '+' : ''}${nb(v)} %⁩`;
}

/* Taux (délais) : vert ≥ 90 %, ambre ≥ 75 %, rouge en dessous. */
const tonTaux = (v) => (v == null ? 'gris' : v >= 90 ? 'vert' : v >= 75 ? 'ambre' : 'rouge');

function lire(cle, defaut, options) {
  try {
    const v = Number(localStorage.getItem(cle));
    return options.some((o) => o.cle === v) ? v : defaut;
  } catch { return defaut; }
}
function ecrire(cle, v) {
  try { localStorage.setItem(cle, String(v)); } catch { /* stockage indisponible */ }
}

function graduations(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) || 10 * p;
  const l = [];
  for (let v = 0; v < max + pas && l.length < 8; v += pas) l.push(Math.round(v * 1e6) / 1e6);
  return l;
}

/* ---------- Briques ---------- */

export function Carte({ titre, pastille, pastilleTon, className = '', children }) {
  return (
    <section className={`tb-carte ${className}`}>
      <div className="tb-carte-tete">
        <h3>{titre}</h3>
        {pastille && <span className={`tb-pastille ${pastilleTon ? `tb-pastille--${pastilleTon}` : ''}`}>{pastille}</span>}
      </div>
      {children}
    </section>
  );
}

function Vide({ children }) {
  return <div className="tb-vide">{children}</div>;
}

export function Badge({ ton = 'gris', children }) {
  return <span className={`tb-badge tb-badge--${ton}`}>{children}</span>;
}

/* Carte d'indicateur : icône colorée, grand chiffre, libellé ; cliquable vers la page du module. */
export function Stat({ lien, icone: Icone, ton = 'neutre', valeur, total, label, badge, sous, featured }) {
  const contenu = (
    <>
      <div className="tb-stat-haut">
        <div className="tb-stat-icone"><Icone size={22} strokeWidth={2} aria-hidden="true" /></div>
        {badge}
      </div>
      <div>
        <div className="tb-stat-valeur">{valeur}{total != null && <small> / {nb(total)}</small>}</div>
        <div className="tb-stat-label">{label}</div>
        {sous && <div className="tb-stat-sous">{sous}</div>}
      </div>
    </>
  );
  const cls = `tb-stat tb-ton--${ton} ${featured ? 'tb-stat--featured' : ''}`;
  return lien ? <Link to={lien} className={cls}>{contenu}</Link> : <div className={cls}>{contenu}</div>;
}

/* Barres horizontales (libellé · piste · valeur). */
function Barres({ lignes, format = nb }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur || 0));
  return (
    <div className="tb-hbars">
      {lignes.map((l) => {
        const Balise = l.onOuvrir ? 'button' : 'div';
        return (
          <Balise key={l.cle} className="tb-hbar" {...(l.onOuvrir ? { type: 'button', onClick: l.onOuvrir, title: l.nom } : {})}>
            <span className="tb-hbar-label" dir="auto">{l.nom}</span>
            <span className="tb-hbar-piste"><span className={`tb-g--${l.ton || 'teal'}`} style={{ width: `${Math.max(2, ((l.valeur || 0) / max) * 100)}%` }} /></span>
            <span className="tb-hbar-valeur">{format(l.valeur)}{l.sous && <small>{l.sous}</small>}</span>
          </Balise>
        );
      })}
    </div>
  );
}

/* Répartition : barre empilée + barres par catégorie (valeur et part). */
function Repartition({ items, label }) {
  const total = items.reduce((s, x) => s + (x.valeur || 0), 0);
  return (
    <>
      <div className="tb-empile" role="img" aria-label={label}>
        {total > 0 && items.filter((x) => x.valeur > 0).map((x) => (
          <span key={x.cle} style={{ flexGrow: x.valeur, background: PLEIN[x.ton] }} title={`${t(x.label)} : ${nb(x.valeur)}`} />
        ))}
      </div>
      <Barres lignes={items.map((x) => ({
        cle: x.cle, nom: t(x.label), valeur: x.valeur || 0, ton: x.ton, onOuvrir: x.onOuvrir,
        sous: total ? `${nb(((x.valeur || 0) / total) * 100)} %` : null,
      }))} />
    </>
  );
}

/* Liste d'éléments à traiter (badge + texte), chaque ligne ouvre l'élément. */
function Liste({ lignes }) {
  return (
    <ul className="tb-liste">
      {lignes.map((l) => (
        <li key={l.cle}>
          <button type="button" onClick={l.onOuvrir}>
            <Badge ton={l.ton}>{l.badge}</Badge>
            <span className="tb-liste-texte">
              <strong dir="auto">{l.titre}</strong>
              {l.sous && <small dir="auto">{l.sous}</small>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Graphique : activité (3 courbes, un seul axe, info-bulle au survol) ---------- */

function GraphiqueActivite({ tranches, pas }) {
  const [ref, w] = useLargeur();
  const [survol, setSurvol] = useState(null);
  const h = 220;
  const m = { g: 34, d: 10, h: 10, b: 24 };
  const max = Math.max(1, ...tranches.flatMap((x) => SERIES.map((s) => x[s.cle] || 0)));
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
    lignes: SERIES.map((s) => ({ couleur: s.couleur, label: t(s.label), valeur: nb(tranches[survol][s.cle]) })),
  };

  return (
    <div className="sv-graph" ref={ref} dir="ltr">
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Activité de maintenance sur la période')}
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
          {SERIES.map((s) => {
            const d = tranches.map((tr, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(tr[s.cle] || 0).toFixed(1)}`).join('');
            return <path key={s.cle} d={d} fill="none" stroke={s.couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
          })}
          {survol != null && SERIES.map((s) => (
            <circle key={s.cle} cx={x(survol)} cy={y(tranches[survol][s.cle] || 0)} r="4" fill={s.couleur} stroke="#fff" strokeWidth="2" />
          ))}
        </svg>
      )}
      <Bulle bulle={bulle} />
      <ul className="tb-legende">
        {SERIES.map((s) => (
          <li key={s.cle}><i style={{ background: s.couleur }} />{t(s.label)}
            <b>{nb(tranches.reduce((a, x) => a + (x[s.cle] || 0), 0))}</b></li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Graphique : coûts par mois (colonnes, valeur au-dessus) ---------- */

function GraphiqueCouts({ parMois }) {
  const mois = Object.entries(parMois || {});
  const max = Math.max(1, ...mois.map(([, v]) => v || 0));
  return (
    <div className="tb-colonnes" role="img" aria-label={t('Coûts de maintenance des 12 derniers mois')}>
      {mois.map(([k, v]) => (
        <div key={k} className="tb-colonne">
          <div className="tb-colonne-valeur">{v > 0 ? dt(v, true) : ''}</div>
          <div className="tb-colonne-barre" style={{ height: `${Math.max(v > 0 ? 3 : 1, (v / max) * 100)}%` }}
            title={`${new Date(`${k}-01T00:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })} : ${dt(v)}`} />
          <div className="tb-colonne-label">{moisCourt(k)}</div>
        </div>
      ))}
    </div>
  );
}

/* Respect des délais par priorité. */
function SlaParPriorite({ lignes }) {
  return (
    <table className="tb-table">
      <thead>
        <tr><th>{t('Priorité')}</th><th>{t('Bons')}</th><th>{t('Réponse')}</th><th>{t('Résolution')}</th></tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.priorite}>
            <td><Badge ton={PRIORITE_TON[l.priorite]}>{l.priorite} · {t(PRIORITES[l.priorite] || l.libelle || '')}</Badge></td>
            <td className="tb-num">{nb(l.bons)}</td>
            {['reponsePct', 'resolutionPct'].map((k) => (
              <td key={k}>
                <span className="tb-jauge">
                  <span className="tb-hbar-piste"><span className={`tb-g--${tonTaux(l[k])}`} style={{ width: `${Math.max(0, Math.min(100, l[k] ?? 0))}%` }} /></span>
                  <b className={`tb-txt--${tonTaux(l[k])}`}>{l.bons ? pct(l[k]) : '—'}</b>
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Page ---------- */

export default function TableauDeBord() {
  const navigate = useNavigate();
  const [jours, setJours] = useState(() => lire(CLE_PERIODE, 30, PERIODES));
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [majLe, setMajLe] = useState(null);
  const enCours = useRef(false);

  const charger = useCallback(async (recalculer = false) => {
    if (enCours.current) return;
    enCours.current = true;
    setChargement(true);
    try {
      const d = await tableauDeBordService.tableau(jours, recalculer);
      setDonnees(d);
      setErreur(null);
      setMajLe(Date.now());
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le tableau de bord. Vérifie que le serveur est lancé.'));
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, [jours]);

  useEffect(() => { charger(); }, [charger]);
  // Rafraîchi toutes les 5 minutes tant que la page est visible
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) charger(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [charger]);

  const ouvrirEquipement = (id) => id && navigate(`/equipement/${id}`);
  const ouvrirBon = (id) => id && navigate(`/bons-maintenance?id=${id}`);

  const d = donnees || {};
  const rec = d.reclamations;
  const bons = d.bons;
  const sla = d.sla;
  const couts = d.couts;
  const eq = d.equipements;
  const dispo = d.disponibilite;
  const al = d.alertes;
  const mc = d.conditionnelle;
  const rv = d.renouvellement;
  const parc = d.parc;
  const pas = d.periode?.pas;
  const libellePeriode = t(PERIODES.find((p) => p.cle === jours)?.label || '');

  const arretes = eq ? (eq.parEtat?.EN_PANNE || 0) + (eq.parEtat?.EN_REPARATION || 0) : null;
  const recOuvertes = rec ? rec.ouvertes + rec.enCours + rec.enAttenteValidation : null;
  const evolRec = rec ? evolution(rec.recuesPeriode, rec.recuesPeriodePrecedente) : null;
  const evolCout = couts ? evolution(couts.total, couts.totalPrecedent) : null;
  const indisponibles = useMemo(() => (d.indisponibles || []).map((k) => t(PARTIES[k] || k)), [d.indisponibles]);
  const indispo = (cle) => <Vide>{t('Données « {n} » indisponibles pour le moment.', { n: t(PARTIES[cle]) })}</Vide>;

  return (
    <div className="tb-container">
      {/* En-tête */}
      <div className="tb-header">
        <div className="tb-header-icone"><LayoutDashboard size={24} strokeWidth={2} aria-hidden="true" /></div>
        <div className="tb-header-texte">
          <h1>{t('Tableau de bord de la GMAO')}</h1>
        </div>
        <div className="tb-header-actions">
          <div className="tb-periodes" role="group" aria-label={t('Période')}>
            {PERIODES.map((p) => (
              <button key={p.cle} type="button" aria-pressed={jours === p.cle}
                onClick={() => { setJours(p.cle); ecrire(CLE_PERIODE, p.cle); }}>{t(p.label)}</button>
            ))}
          </div>
          <button type="button" className="tb-btn" onClick={() => charger(true)} disabled={chargement}>
            {chargement ? <LoaderCircle size={14} className="tb-tourne" aria-hidden="true" /> : <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" />}
            {t('Rafraîchir')}
          </button>
        </div>
      </div>

      {majLe && (
        <p className="tb-maj">
          {t('Mis à jour à {h}', { h: new Date(majLe).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}
          {d.periode && <> · {t('période : {p}', { p: libellePeriode })}</>}
        </p>
      )}
      {erreur && <p className="tb-message tb-message--erreur">{erreur}</p>}
      {indisponibles.length > 0 && (
        <p className="tb-message tb-message--attention">{t('Certaines données n’ont pas pu être chargées : {l}.', { l: indisponibles.join(', ') })}</p>
      )}
      {!donnees && !erreur && <div className="tb-chargement">{t('Chargement…')}</div>}

      {donnees && (
        <>
          {/* ===== Indicateurs clés ===== */}
          <div className="tb-stats">
            <Stat featured lien="/bons-maintenance" icone={Wrench} ton="teal" valeur={nb(bons?.ouverts)} label={t('Bons ouverts')}
              badge={sla ? (sla.enRetard ? <Badge ton="rouge">{t('{n} en retard', { n: sla.enRetard })}</Badge> : <Badge ton="vert">{t('Aucun retard')}</Badge>) : null}
              sous={bons ? t('{a} créés · {b} clôturés', { a: nb(bons.creesPeriode), b: nb(bons.cloturesPeriode) }) : null} />
            <Stat lien="/reclamations" icone={MessageSquareWarning} ton={rec?.nonAffectees ? 'orange' : 'bleu'} valeur={nb(recOuvertes)} label={t('Réclamations ouvertes')}
              badge={rec?.nonAffectees ? <Badge ton="orange">{t('{n} sans technicien', { n: rec.nonAffectees })}</Badge> : null}
              sous={rec ? t('{n} reçues', { n: nb(rec.recuesPeriode) }) + (evolRec ? ` (${evolRec})` : '') : null} />
            <Stat lien="/equipements" icone={OctagonAlert} ton={!eq ? 'neutre' : eq.critiquesArretes ? 'rouge' : arretes ? 'orange' : 'vert'}
              valeur={nb(arretes)} total={eq?.total} label={t('Équipements à l’arrêt')}
              badge={eq?.critiquesArretes ? <Badge ton="rouge">{t('{n} critique(s)', { n: eq.critiquesArretes })}</Badge> : null} />
            <Stat lien="/disponibilite" icone={Activity} ton={dispo?.tauxMoyenPct == null ? 'neutre' : dispo.tauxMoyenPct >= 95 ? 'vert' : dispo.tauxMoyenPct >= 85 ? 'ambre' : 'rouge'}
              valeur={pct(dispo?.tauxMoyenPct)} label={t('Disponibilité moyenne')}
              sous={dispo ? t('MTTR {a} · MTBF {b}', { a: heures(dispo.mttrHeures), b: heures(dispo.mtbfHeures) }) : null} />
            <Stat lien="/sla" icone={Timer} ton={tonTaux(sla?.respectResolutionPct) === 'gris' ? 'neutre' : tonTaux(sla?.respectResolutionPct)}
              valeur={pct(sla?.respectResolutionPct)} label={t('Délais SLA respectés')}
              sous={sla ? t('réponse : {p}', { p: pct(sla.respectReponsePct) }) : null} />
            <Stat lien="/cout" icone={CircleDollarSign} ton="neutre" valeur={dt(couts?.total, true)} label={t('Coût de maintenance')}
              sous={couts ? (evolCout ? t('{e} vs période précédente', { e: evolCout }) : t('{n} bons', { n: nb(couts.bons) })) : null} />
          </div>

          {/* ===== Activité + bons ouverts ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--2-1">
            <Carte titre={t('Activité de maintenance')} pastille={pas === 'MOIS' ? t('par mois') : pas === 'SEMAINE' ? t('par semaine') : t('par jour')}>
              {d.activite ? (d.activite.some((x) => x.reclamations + x.bonsCrees + x.bonsClotures)
                ? <GraphiqueActivite tranches={d.activite} pas={pas} />
                : <Vide>{t('Aucune activité sur la période.')}</Vide>) : indispo('activite')}
            </Carte>
            <Carte titre={t('Bons ouverts')} pastille={bons ? t('{n} au total', { n: nb(bons.ouverts) }) : null}>
              {bons ? (
                <>
                  <div className="tb-sous-titre">{t('Par état')}</div>
                  <Repartition label={t('Bons ouverts par état')}
                    items={ETATS_BON.map((e) => ({ ...e, valeur: bons.parEtat?.[e.cle] || 0, onOuvrir: () => navigate('/bons-maintenance') }))} />
                  <div className="tb-sous-titre">{t('Ouverts depuis')}</div>
                  <Barres lignes={ANCIENNETE.map((a, i) => ({ cle: a.label, nom: t(a.label), valeur: bons.anciennete?.[i] || 0, ton: a.ton }))} />
                  {bons.arretsObligatoires > 0 && (
                    <p className="tb-note"><Badge ton="rouge">{t('{n} arrêt(s) obligatoire(s) en cours', { n: bons.arretsObligatoires })}</Badge></p>
                  )}
                </>
              ) : indispo('bons')}
            </Carte>
          </div>

          {/* ===== À traiter en priorité ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--1-1">
            <Carte className="tb-carte--liste" titre={t('Bons en retard (SLA)')}
              pastille={sla ? t('{n} en retard', { n: nb(sla.enRetard) }) : null} pastilleTon={sla?.enRetard ? 'rouge' : null}>
              {sla ? (sla.retards.length ? (
                <Liste lignes={sla.retards.map((b) => ({
                  cle: b.id, ton: PRIORITE_TON[b.priorite], badge: b.priorite || '—',
                  titre: `${b.num || `#${b.id}`} · ${b.titre || t('Sans titre')}`,
                  sous: b.echeance ? t('échéance dépassée {d}', { d: ilYa(b.echeance) }) : null,
                  onOuvrir: () => ouvrirBon(b.id),
                }))} />
              ) : <Vide>{t('Aucun bon en retard.')}</Vide>) : indispo('sla')}
            </Carte>
            <Carte className="tb-carte--liste" titre={t('Équipements à l’arrêt')}
              pastille={eq ? t('{n} à l’arrêt', { n: nb(arretes) }) : null} pastilleTon={eq?.critiquesArretes ? 'rouge' : null}>
              {eq ? (eq.arretes.length ? (
                <Liste lignes={eq.arretes.map((e) => {
                  const etat = ETATS_EQUIPEMENT.find((x) => x.cle === e.etat);
                  return {
                    cle: e.id, ton: etat?.ton, badge: t(etat?.label || e.etat),
                    titre: e.nom || `#${e.id}`,
                    sous: [
                      e.criticite ? `${e.criticite} · ${t(CRITICITES[e.criticite] || '')}` : t('Criticité non définie'),
                      e.depuis ? t('à l’arrêt {d}', { d: ilYa(e.depuis) }) : null,
                      e.bonNum ? t('bon {n}', { n: e.bonNum }) : null,
                    ].filter(Boolean).join(' · '),
                    onOuvrir: () => ouvrirEquipement(e.id),
                  };
                })} />
              ) : <Vide>{t('Tous les équipements fonctionnent.')}</Vide>) : indispo('equipements')}
            </Carte>
          </div>

          {/* ===== Délais, préventif, état des équipements ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--3">
            <Carte titre={t('Délais SLA par priorité')} pastille={sla ? t('{n} bons', { n: nb(sla.bonsAnalyses) }) : null}>
              {sla ? (sla.parPriorite.length ? <SlaParPriorite lignes={sla.parPriorite} /> : <Vide>{t('Aucun bon sur la période.')}</Vide>) : indispo('sla')}
            </Carte>
            <Carte titre={t('Préventif et curatif')} pastille={bons?.partPreventifPct != null ? t('{p} préventif', { p: pct(bons.partPreventifPct) }) : null}>
              {bons ? (bons.creesPeriode ? (
                <>
                  <Repartition label={t('Bons créés par type')} items={TYPES_BON.map((x) => ({ ...x, valeur: bons.parType?.[x.cle] || 0 }))} />
                  {bons.preventifsPeriode > 0 && (
                    <p className="tb-note">{t('{a} préventif(s) sur {b} déjà effectué(s).', { a: nb(bons.preventifsEffectues), b: nb(bons.preventifsPeriode) })}</p>
                  )}
                  <p className="tb-note">{t('Délai moyen de clôture : {d}', { d: heures(bons.delaiMoyenClotureHeures) })}</p>
                </>
              ) : <Vide>{t('Aucun bon créé sur la période.')}</Vide>) : indispo('bons')}
            </Carte>
            <Carte titre={t('État des équipements')} pastille={eq ? t('{n} équipements', { n: nb(eq.total) }) : null}>
              {eq ? (
                <>
                  <Repartition label={t('Équipements par état')}
                    items={ETATS_EQUIPEMENT.map((x) => ({ ...x, valeur: eq.parEtat?.[x.cle] || 0, onOuvrir: () => navigate('/equipements') }))} />
                  {dispo && <p className="tb-note">{t('Disponibilité des équipements critiques : {p}', { p: pct(dispo.tauxCritiquesPct) })}</p>}
                </>
              ) : indispo('equipements')}
            </Carte>
          </div>

          {/* ===== Coûts ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--2-1">
            <Carte titre={t('Coûts de maintenance par mois')} pastille={t('12 derniers mois')}>
              {couts ? (
                <>
                  <GraphiqueCouts parMois={couts.parMois} />
                  <ul className="tb-legende">
                    <li>{t('Sur la période')} <b>{dt(couts.total, true)}</b></li>
                    <li>{t('Main-d’œuvre')} <b>{dt(couts.mainOeuvre, true)}</b></li>
                    <li>{t('Pièces')} <b>{dt(couts.pieces, true)}</b></li>
                    <li>{t('Achats')} <b>{dt(couts.achats, true)}</b></li>
                  </ul>
                </>
              ) : indispo('couts')}
            </Carte>
            <Carte titre={t('Équipements les plus coûteux')} pastille={libellePeriode}>
              {couts ? (couts.topEquipements.length
                ? <Barres format={(v) => dt(v, true)}
                    lignes={couts.topEquipements.map((e, i) => ({
                      cle: e.id ?? i, nom: e.nom || `#${e.id}`, valeur: e.cout, ton: 'teal',
                      sous: t('{n} bons', { n: e.bons }), onOuvrir: () => ouvrirEquipement(e.id),
                    }))} />
                : <Vide>{t('Aucun coût sur la période.')}</Vide>) : indispo('couts')}
            </Carte>
          </div>

          {/* ===== Pannes ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--1-1">
            <Carte titre={t('Équipements avec le plus de pannes')} pastille={dispo ? t('{n} pannes', { n: nb(dispo.pannes) }) : null}>
              {dispo ? (dispo.plusDePannes.length
                ? <Barres lignes={dispo.plusDePannes.map((e) => ({
                    cle: e.id, nom: e.nom || `#${e.id}`, valeur: e.pannes, ton: 'orange',
                    sous: t('dispo {p}', { p: pct(e.tauxPct) }), onOuvrir: () => ouvrirEquipement(e.id),
                  }))} />
                : <Vide>{t('Aucune panne sur la période.')}</Vide>) : indispo('disponibilite')}
            </Carte>
            <Carte titre={t('Pannes les plus fréquentes')} pastille={rec ? t('{n} réclamation(s) codée(s)', { n: nb(rec.avecCodePanne) }) : null}>
              {rec ? (rec.codesPanne.length
                ? <Barres lignes={rec.codesPanne.map((c) => ({ cle: c.code, nom: `${c.code} · ${c.libelle}`, valeur: c.nombre, ton: 'violet' }))} />
                : <Vide>{t('Aucune réclamation avec un code panne sur la période.')}</Vide>) : indispo('reclamations')}
            </Carte>
          </div>

          {/* ===== Surveillance, anticipation, parc de véhicules ===== */}
          <h2 className="tb-section-titre">
            {t('Surveillance et parc de véhicules')}
            <small>{t('Alertes des machines, maintenance conditionnelle, renouvellement et véhicules')}</small>
          </h2>
          <div className="tb-stats">
            <Stat lien="/alertes-machines" icone={BellRing} ton={!al ? 'neutre' : al.critiquesOuvertes ? 'rouge' : al.ouvertes ? 'orange' : 'vert'}
              valeur={nb(al?.ouvertes)} label={t('Alertes machines ouvertes')}
              badge={al?.critiquesOuvertes ? <Badge ton="rouge">{t('{n} critique(s)', { n: al.critiquesOuvertes })}</Badge> : null}
              sous={al ? t('{n} reçues', { n: nb(al.recuesPeriode) }) : null} />
            <Stat lien="/parametres-systeme" icone={Gauge} ton={!mc || !mc.regles ? 'neutre' : mc.atteintes ? 'orange' : 'vert'}
              valeur={nb(mc?.atteintes)} total={mc?.regles} label={t('Règles conditionnelles atteintes')}
              sous={mc?.sansDonnees ? t('{n} sans données', { n: mc.sansDonnees }) : null} />
            <Stat lien="/renouvellement" icone={CalendarSync} ton={!rv ? 'neutre' : rv.remplacer ? 'ambre' : 'vert'}
              valeur={nb(rv?.remplacer)} total={rv?.parc} label={t('Équipements à remplacer')}
              badge={rv?.planifier ? <Badge ton="ambre">{t('{n} à planifier', { n: rv.planifier })}</Badge> : null}
              sous={rv ? t('{c} à prévoir', { c: dt(rv.cout_remplacer, true) }) : null} />
            <Stat lien="/parc-dashboard" icone={Car} ton={!parc ? 'neutre' : parc.critiquesIndisponibles ? 'rouge' : 'vert'}
              valeur={pct(parc?.tauxDisponibilite)} label={t('Véhicules disponibles')}
              badge={parc?.critiquesIndisponibles ? <Badge ton="rouge">{t('{n} critique(s) indisponible(s)', { n: parc.critiquesIndisponibles })}</Badge> : null}
              sous={parc ? t('{n} véhicules', { n: nb(parc.total) }) : null} />
            <Stat lien="/parc-dashboard" icone={FileWarning} ton={!parc ? 'neutre' : parc.documentsExpires ? 'rouge' : parc.documentsSous30Jours ? 'ambre' : 'vert'}
              valeur={nb(parc?.documentsExpires)} label={t('Documents véhicules expirés')}
              sous={parc ? t('{n} expirent sous 30 j', { n: nb(parc.documentsSous30Jours) }) : null} />
            <Stat lien="/vehicule-missions" icone={Route} ton="violet" valeur={nb(parc?.missionsEnCours)} label={t('Missions en cours')}
              sous={parc ? t('{a} incident(s) · {b} réservation(s)', { a: nb(parc.incidentsOuverts), b: nb(parc.reservationsEnAttente) }) : null} />
          </div>

          {/* ===== Bons les plus anciens + échéances des véhicules ===== */}
          <div className="tb-ligne-cartes tb-ligne-cartes--1-1">
            <Carte className="tb-carte--liste" titre={t('Bons ouverts depuis le plus longtemps')} pastille={bons ? t('{n} au total', { n: nb(bons.ouverts) }) : null}>
              {bons ? (bons.plusAnciens.length ? (
                <Liste lignes={bons.plusAnciens.map((b) => {
                  const e = ETATS_BON.find((x) => x.cle === b.etat);
                  return {
                    cle: b.id, ton: e?.ton, badge: t(e?.label || '—'),
                    titre: `${b.num || `#${b.id}`} · ${b.titre || t('Sans titre')}`,
                    sous: [b.equipement, t('ouvert {d}', { d: ilYa(b.dateCreation) })].filter(Boolean).join(' · '),
                    onOuvrir: () => ouvrirBon(b.id),
                  };
                })} />
              ) : <Vide>{t('Aucun bon ouvert.')}</Vide>) : indispo('bons')}
            </Carte>
            <Carte className="tb-carte--liste" titre={t('Échéances des véhicules')} pastille={t('Documents')}>
              {parc ? (parc.alertesDocuments.length ? (
                <Liste lignes={parc.alertesDocuments.map((a) => ({
                  cle: `${a.vehiculeId}-${a.document}`,
                  ton: a.joursRestants < 0 ? 'rouge' : a.joursRestants <= 7 ? 'orange' : 'ambre',
                  badge: a.joursRestants < 0 ? t('Expiré') : t('{n} j', { n: a.joursRestants }),
                  titre: `${a.matricule || `#${a.vehiculeId}`} · ${t(a.document)}`,
                  sous: a.echeance ? new Date(a.echeance).toLocaleDateString(locale()) : null,
                  onOuvrir: () => navigate('/vehicules'),
                }))} />
              ) : <Vide>{t('Aucune échéance proche.')}</Vide>) : indispo('parc')}
            </Carte>
          </div>
        </>
      )}
    </div>
  );
}
