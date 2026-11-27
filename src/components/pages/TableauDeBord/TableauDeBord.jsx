import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Activity, CircleDollarSign, LayoutDashboard, LoaderCircle,
  MessageSquareWarning, OctagonAlert, RefreshCw, Settings2, Timer, Wrench,
} from 'lucide-react';
import { selectUtilisateur } from '../../../store/authSlice';
import { PROFIL_GENERAL, useDisposition } from './dispositionTableau';
import { ZonePerso } from '../../commun/tableauPerso/BlocsPerso';
import { Badge, Barres, Carte, Liste, Repartition, Stat, Vide } from '../../commun/TableauBord';
import { Bulle, useLargeur } from '../Supervision/Supervision';
import { ilYa } from '../../ui/Veille/Veille';
import PerformanceEmployes from '../PerformanceEmployes/PerformanceEmployes';
import AccesGmao from './AccesGmao';
import { t, locale } from '../../../i18n';
import '../Supervision/Supervision.css';
import './TableauDeBord.css';
import FiltreLieu, { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { lireRequete } from '../../../store/referentiels';

const SERIES = [
  { cle: 'reclamations', label: 'Réclamations reçues', couleur: '#0794a4' },
  { cle: 'bonsCrees', label: 'Bons créés', couleur: '#287da8' },
  { cle: 'bonsClotures', label: 'Bons clôturés', couleur: '#2e3f5a' },
];


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
  performance: 'indicateurs de performance',
};

const MASQUEES = new Set(['parc', 'conditionnelle']);

const PERIODES = [
  { cle: 7, label: '7 j' },
  { cle: 30, label: '30 j' },
  { cle: 90, label: '90 j' },
  { cle: 365, label: '12 mois' },
];
const CLE_PERIODE = 'gmao.tableau-de-bord.periode';

const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
const pct = (v) => (v == null ? '—' : `${nb(v, v >= 99.5 && v < 100 ? 1 : 0)} %`);
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

function evolution(actuel, precedent) {
  if (actuel == null || precedent == null || precedent === 0) return null;
  const v = ((actuel - precedent) / precedent) * 100;
  return `⁦${v > 0 ? '+' : ''}${nb(v)} %⁩`;
}

const tonTaux = (v) => (v == null ? 'gris' : v >= 90 ? 'vert' : v >= 75 ? 'ambre' : 'rouge');

function lire(cle, defaut, options) {
  try {
    const v = Number(localStorage.getItem(cle));
    return options.some((o) => o.cle === v) ? v : defaut;
  } catch { return defaut; }
}
function ecrire(cle, v) {
  try { localStorage.setItem(cle, String(v)); } catch {}
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
        {SERIES.map((s) => ({ ...s, total: tranches.reduce((a, x) => a + (x[s.cle] || 0), 0) })).filter((s) => s.total > 0).map((s) => (
          <li key={s.cle}><i style={{ background: s.couleur }} />{t(s.label)}
            <b>{nb(s.total)}</b></li>
        ))}
      </ul>
    </div>
  );
}

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

const tonPreventif = (v) => (v == null ? 'gris' : v >= 60 ? 'vert' : v >= 40 ? 'ambre' : 'rouge');
const tonDispo = (v) => (v == null ? 'gris' : v >= 95 ? 'vert' : v >= 85 ? 'ambre' : 'rouge');

const GRAPHIQUES_SERVICES = [
  { cle: 'nbBons', titre: 'Bons par service', format: (v) => nb(v), ton: () => 'teal' },
  { cle: 'disponibilitePct', titre: 'Disponibilité', format: (v) => pct(v), ton: tonDispo, max: 100 },
  { cle: 'partPreventifPct', titre: 'Part de préventif', format: (v) => pct(v), ton: tonPreventif, max: 100 },
  { cle: 'delaiInterventionHeures', titre: 'Délai d’intervention', format: (v) => heures(v), ton: () => 'bleu' },
];

function BulleService({ l }) {
  const lignes = [
    ['Bons', nb(l.nbBons)], ['Préventif / curatif', pct(l.partPreventifPct)], ['Délai d’intervention', heures(l.delaiInterventionHeures)],
    ['MTBF', heures(l.mtbfHeures)], ['MTTR', heures(l.mttrHeures)], ['Disponibilité', pct(l.disponibilitePct)],
  ];
  return (
    <div className="tb-svc-bulle" role="tooltip">
      <strong dir="auto">{t(l.libelle)}</strong>
      <dl>{lignes.map(([k, v]) => <Fragment key={k}><dt>{t(k)}</dt><dd>{v}</dd></Fragment>)}</dl>
    </div>
  );
}

function GraphiquesServices({ services }) {
  return (
    <div className="tb-svc-grille">
      {GRAPHIQUES_SERVICES.map((g) => {
        const lignes = services.filter((l) => Number(l[g.cle]) > 0);
        if (!lignes.length) return null;
        const max = g.max || Math.max(...lignes.map((l) => Number(l[g.cle])));
        return (
          <figure key={g.cle} className="tb-svc">
            <figcaption>{t(g.titre)}</figcaption>
            <ul className="tb-vcols">
              {lignes.map((l) => (
                <li key={l.cle} className="tb-vcol" tabIndex={0}>
                  <b className="tb-vcol-valeur">{g.format(l[g.cle])}</b>
                  <span className="tb-vcol-piste">
                    <span className={`tb-vcol-barre tb-gv--${g.ton(l[g.cle])}`} style={{ height: `${Math.max(3, Math.min(100, (Number(l[g.cle]) / max) * 100))}%` }} />
                  </span>
                  <span className="tb-vcol-nom" dir="auto" title={t(l.libelle)}>{t(l.libelle)}</span>
                  <BulleService l={l} />
                </li>
              ))}
            </ul>
          </figure>
        );
      })}
    </div>
  );
}

function IndicateursPerformance({ rapport }) {
  const services = (rapport.lignes || []).filter((l) => l.nbBons > 0 || l.nbEquipements > 0).slice(0, 5);
  return (
    <>
      {services.length > 0 && <GraphiquesServices services={services} />}
    </>
  );
}

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

export default function TableauDeBord() {
  const navigate = useNavigate();
  const utilisateur = useSelector(selectUtilisateur);
  const [disposition, actions] = useDisposition(utilisateur?.personnelId ?? utilisateur?.userId ?? utilisateur?.username);
  const [edition, setEdition] = useState(false);

  const [jours, setJours] = useState(() => lire(CLE_PERIODE, 30, PERIODES));
  const [lieuId, setLieuId] = useState('');
  const carteLieux = useCarteLieux();
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
      const d = await lireRequete('tableauDeBord', { jours, lieuId: lieuId || null }, { forcer: recalculer });
      setDonnees(d);
      setErreur(null);
      setMajLe(Date.now());
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le tableau de bord. Vérifie que le serveur est lancé.'));
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, [jours, lieuId]);

  useEffect(() => { charger(); }, [charger]);
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
  const perf = d.performance;
  const al = d.alertes;
  const rv = d.renouvellement;
  const pas = d.periode?.pas;
  const libellePeriode = t(PERIODES.find((p) => p.cle === jours)?.label || '');

  const arretes = eq ? (eq.parEtat?.EN_PANNE || 0) + (eq.parEtat?.EN_REPARATION || 0) : null;
  const recOuvertes = rec ? rec.ouvertes + (rec.enFile ?? 0) + rec.enCours + rec.enAttenteValidation : null;
  const evolRec = rec ? evolution(rec.recuesPeriode, rec.recuesPeriodePrecedente) : null;
  const evolCout = couts ? evolution(couts.total, couts.totalPrecedent) : null;
  const indisponibles = useMemo(() => (d.indisponibles || []).filter((k) => !MASQUEES.has(k)).map((k) => t(PARTIES[k] || k)), [d.indisponibles]);
  const compteurs = {
    '/reclamations': rec && { valeur: recOuvertes, ton: rec.nonAffectees ? 'orange' : 'teal' },
    '/bons-maintenance': bons && { valeur: bons.ouverts, ton: sla?.enRetard ? 'rouge' : 'teal' },
    '/sla': sla && { valeur: sla.enRetard, ton: 'rouge' },
    '/equipements': eq && { valeur: arretes, ton: eq.critiquesArretes ? 'rouge' : 'orange' },
    '/alertes-machines': al && { valeur: al.ouvertes, ton: al.critiquesOuvertes ? 'rouge' : 'orange' },
    '/supervision': al && { valeur: al.ouvertes, ton: al.critiquesOuvertes ? 'rouge' : 'orange' },
    '/renouvellement': rv && { valeur: rv.remplacer, ton: 'ambre' },
  };
  const indispo = (cle) => <Vide>{t('Données « {n} » indisponibles pour le moment.', { n: t(PARTIES[cle]) })}</Vide>;

  const statsRendus = {
    bons: (
      <Stat featured lien="/bons-maintenance?vue=a-traiter" icone={Wrench} ton="teal" valeur={nb(bons?.ouverts)} label={t('Bons ouverts')}
        badge={sla ? (sla.enRetard ? <Badge ton="rouge">{t('{n} en retard', { n: sla.enRetard })}</Badge> : <Badge ton="vert">{t('Aucun retard')}</Badge>) : null}
        sous={bons ? t('{a} créés · {b} clôturés', { a: nb(bons.creesPeriode), b: nb(bons.cloturesPeriode) }) : null} />
    ),
    reclamations: (
      <Stat lien="/reclamations?vue=a-traiter" icone={MessageSquareWarning} ton={rec?.nonAffectees ? 'orange' : 'bleu'} valeur={nb(recOuvertes)} label={t('Réclamations ouvertes')}
        badge={rec?.nonAffectees ? <Badge ton="orange">{t('{n} non affectée(s)', { n: rec.nonAffectees })}</Badge> : null}
        sous={rec ? t('{n} reçues', { n: nb(rec.recuesPeriode) }) + (evolRec ? ` (${evolRec})` : '') : null} />
    ),
    arrets: (
      <Stat lien="/equipements" icone={OctagonAlert} ton={!eq ? 'neutre' : eq.critiquesArretes ? 'rouge' : arretes ? 'orange' : 'vert'}
        valeur={nb(arretes)} total={eq?.total} label={t('Équipements à l’arrêt')}
        badge={eq?.critiquesArretes ? <Badge ton="rouge">{t('{n} critique(s)', { n: eq.critiquesArretes })}</Badge> : null} />
    ),
    disponibilite: (
      <Stat lien="/disponibilite" icone={Activity} ton={dispo?.tauxMoyenPct == null ? 'neutre' : dispo.tauxMoyenPct >= 95 ? 'vert' : dispo.tauxMoyenPct >= 85 ? 'ambre' : 'rouge'}
        valeur={pct(dispo?.tauxMoyenPct)} label={t('Disponibilité moyenne')}
        sous={dispo ? t('MTTR {a} · MTBF {b}', { a: heures(dispo.mttrHeures), b: heures(dispo.mtbfHeures) }) : null} />
    ),
    sla: (
      <Stat lien="/sla" icone={Timer} ton={tonTaux(sla?.respectResolutionPct) === 'gris' ? 'neutre' : tonTaux(sla?.respectResolutionPct)}
        valeur={pct(sla?.respectResolutionPct)} label={t('Délais SLA respectés')}
        sous={sla ? t('réponse : {p}', { p: pct(sla.respectReponsePct) }) : null} />
    ),
    cout: (
      <Stat lien="/cout" icone={CircleDollarSign} ton="neutre" valeur={dt(couts?.total, true)} label={t('Coût de maintenance')}
        sous={couts ? (evolCout ? t('{e} vs période précédente', { e: evolCout }) : t('{n} bons', { n: nb(couts.bons) })) : null} />
    ),
  };

  const cartesRendues = {
    indicateurs: perf?.global ? (
      <Carte titre={t('Indicateurs de performance')} pastille={libellePeriode}>
        <IndicateursPerformance rapport={perf} />
        <p className="tb-note"><Link to="/indicateurs">{t('Voir le détail par service, famille ou équipement')}</Link></p>
      </Carte>
    ) : null,
    activite: (
      <Carte titre={t('Activité de maintenance')} pastille={pas === 'MOIS' ? t('par mois') : pas === 'SEMAINE' ? t('par semaine') : t('par jour')}>
        {d.activite ? (d.activite.some((x) => x.reclamations + x.bonsCrees + x.bonsClotures)
          ? <GraphiqueActivite tranches={d.activite} pas={pas} />
          : <Vide>{t('Aucune activité sur la période.')}</Vide>) : indispo('activite')}
      </Carte>
    ),
    bonsOuverts: (
      <Carte titre={t('Bons ouverts')} pastille={bons ? t('{n} au total', { n: nb(bons.ouverts) }) : null}>
        {bons ? (
          <>
            <div className="tb-sous-titre">{t('Par état')}</div>
            <Repartition label={t('Bons ouverts par état')}
              items={ETATS_BON.map((e) => ({ ...e, valeur: bons.parEtat?.[e.cle] || 0, onOuvrir: () => navigate(`/bons-maintenance?etat=${e.cle}`) }))} />
            <div className="tb-sous-titre">{t('Ouverts depuis')}</div>
            <Barres lignes={ANCIENNETE.map((a, i) => ({ cle: a.label, nom: t(a.label), valeur: bons.anciennete?.[i] || 0, ton: a.ton }))} />
            {bons.arretsObligatoires > 0 && (
              <p className="tb-note"><Badge ton="rouge">{t('{n} arrêt(s) obligatoire(s) en cours', { n: bons.arretsObligatoires })}</Badge></p>
            )}
          </>
        ) : indispo('bons')}
      </Carte>
    ),
    retards: (
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
    ),
    arrets: (
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
    ),
    slaPriorite: (
      <Carte titre={t('Délais SLA par priorité')} pastille={sla ? t('{n} bons', { n: nb(sla.bonsAnalyses) }) : null}>
        {sla ? (sla.parPriorite.length ? <SlaParPriorite lignes={sla.parPriorite} /> : <Vide>{t('Aucun bon sur la période.')}</Vide>) : indispo('sla')}
      </Carte>
    ),
    preventif: (
      <Carte titre={t('Préventif et curatif')} pastille={bons?.partPreventifPct != null ? t('{p} préventif', { p: pct(bons.partPreventifPct) }) : null}>
        {bons ? (bons.creesPeriode ? (
          <>
            <Repartition label={t('Bons créés par type')} items={TYPES_BON.map((x) => ({ ...x, valeur: bons.parType?.[x.cle] || 0 }))} />
            {bons.preventifsPeriode > 0 && (
              <p className="tb-note">{t('{a} préventif(s) sur {b} déjà effectué(s).', { a: nb(bons.preventifsEffectues), b: nb(bons.preventifsPeriode) })}</p>
            )}
            {Number(bons.delaiMoyenClotureHeures) > 0 && (
              <p className="tb-note">{t('Délai moyen de clôture : {d}', { d: heures(bons.delaiMoyenClotureHeures) })}</p>
            )}
          </>
        ) : <Vide>{t('Aucun bon créé sur la période.')}</Vide>) : indispo('bons')}
      </Carte>
    ),
    etatEquipements: (
      <Carte titre={t('État des équipements')} pastille={eq ? t('{n} équipements', { n: nb(eq.total) }) : null}>
        {eq ? (
          <>
            <Repartition label={t('Équipements par état')}
              items={ETATS_EQUIPEMENT.map((x) => ({ ...x, valeur: eq.parEtat?.[x.cle] || 0, onOuvrir: () => navigate('/equipements') }))} />
            {Number(dispo?.tauxCritiquesPct) > 0 && <p className="tb-note">{t('Disponibilité des équipements critiques : {p}', { p: pct(dispo.tauxCritiquesPct) })}</p>}
          </>
        ) : indispo('equipements')}
      </Carte>
    ),
    couts: (
      <Carte titre={t('Coûts de maintenance par mois')} pastille={t('12 derniers mois')}>
        {couts ? (
          <>
            <GraphiqueCouts parMois={couts.parMois} />
            <ul className="tb-legende">
              {[
                ['total', 'Sur la période'], ['mainOeuvre', 'Main-d’œuvre'], ['pieces', 'Pièces'], ['achats', 'Achats'],
              ].filter(([cle]) => Number(couts[cle]) > 0).map(([cle, label]) => (
                <li key={cle}>{t(label)} <b>{dt(couts[cle], true)}</b></li>
              ))}
            </ul>
          </>
        ) : indispo('couts')}
      </Carte>
    ),
    plusCouteux: (
      <Carte titre={t('Équipements les plus coûteux')} pastille={libellePeriode}>
        {couts ? (couts.topEquipements.length
          ? <Barres format={(v) => dt(v, true)}
              lignes={couts.topEquipements.map((e, i) => ({
                cle: e.id ?? i, nom: e.nom || `#${e.id}`, valeur: e.cout, ton: 'teal',
                sous: t('{n} bons', { n: e.bons }), onOuvrir: () => ouvrirEquipement(e.id),
              }))} />
          : <Vide>{t('Aucun coût sur la période.')}</Vide>) : indispo('couts')}
      </Carte>
    ),
    plusAnciens: (
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
    ),
    performance: <PerformanceEmployes jours={jours} onOuvrirChrono={() => navigate('/bons-maintenance?chrono=1')} />,
  };

  return (
    <div className={`tb-container ${edition ? 'tb-container--edition' : ''}`}>
      <div className="tb-header">
        <div className="tb-header-icone"><LayoutDashboard size={24} strokeWidth={2} aria-hidden="true" /></div>
        <div className="tb-header-texte">
          <h1>{t('Tableau de bord de la Gestion de Maintenance Assistée par Ordinateur')}</h1>
        </div>
        <div className="tb-header-actions">
          <FiltreLieu carte={carteLieux} valeur={lieuId} onChange={setLieuId} className="fl-select" />
          <div className="tb-periodes" role="group" aria-label={t('Période')}>
            {PERIODES.map((p) => (
              <button key={p.cle} type="button" aria-pressed={jours === p.cle}
                onClick={() => { setJours(p.cle); ecrire(CLE_PERIODE, p.cle); }}>{t(p.label)}</button>
            ))}
          </div>
          <button type="button" className={`tb-btn ${edition ? 'is-actif' : ''}`} onClick={() => setEdition((e) => !e)} aria-pressed={edition}>
            <Settings2 size={14} strokeWidth={2.4} aria-hidden="true" /> {t('Personnaliser')}
          </button>
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
      <AccesGmao compteurs={compteurs} />


      {!donnees && !erreur && <div className="tb-chargement">{t('Chargement…')}</div>}

      {donnees && (
        <ZonePerso profil={PROFIL_GENERAL} disposition={disposition} actions={actions} edition={edition} onTerminer={() => setEdition(false)}
          donnees={d} statsRendus={statsRendus} cartesRendues={cartesRendues} />
      )}
    </div>
  );
}
