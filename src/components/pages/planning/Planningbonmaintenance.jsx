import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import planningService from '../../../services/planningService';
import Pagination from '../../commun/Pagination';
import './Planningbonmaintenance.css';
import { t, locale } from '../../../i18n';
import {
  CalendarDays, ChevronLeft, ChevronRight, ClipboardList, ListChecks, LoaderCircle, Maximize2, Search, Users, X, ZoomIn, ZoomOut,
} from 'lucide-react';

const MODES = [
  { value: 'BON_MAINTENANCE', label: 'Bons de maintenance', icone: ClipboardList },
  { value: 'INTERVENANT', label: 'Intervenants', icone: Users },
  { value: 'TACHE', label: 'Tâches', icone: ListChecks },
];

const ETATS = [
  { cle: 1, label: 'Nouveau', classe: 'nouveau' },
  { cle: 3, label: 'En cours', classe: 'encours' },
  { cle: 2, label: 'Suspendu', classe: 'suspendu' },
  { cle: 4, label: 'Effectué', classe: 'effectue' },
  { cle: 10, label: 'Annulé', classe: 'annule' },
];
const ETAT = Object.fromEntries(ETATS.map((e) => [e.cle, e]));

const DUREES = [
  { cle: 7, label: 'Semaine' },
  { cle: 14, label: '2 semaines' },
  { cle: 'mois', label: 'Mois' },
];

const JOUR = 24 * 3600 * 1000;
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8];
const debutJour = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const debutSemaine = (d) => { const x = debutJour(d); const j = (x.getDay() + 6) % 7; return ajouterJours(x, -j); };
const cleJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d, o) => d.toLocaleDateString(locale(), o);
const majuscule = (s) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);

function plage(ancre, duree) {
  if (duree === 'mois') {
    const debut = new Date(ancre.getFullYear(), ancre.getMonth(), 1);
    const fin = new Date(ancre.getFullYear(), ancre.getMonth() + 1, 1);
    return { debut, fin, nb: Math.round((fin - debut) / JOUR) };
  }
  const debut = debutSemaine(ancre);
  return { debut, fin: ajouterJours(debut, duree), nb: duree };
}

const PlanningBonMaintenance = ({ onSelectBonMaintenance }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('BON_MAINTENANCE');
  const [duree, setDuree] = useState(7);
  const [ancre, setAncre] = useState(() => new Date());
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [etatsMasques, setEtatsMasques] = useState(() => new Set());
  const [survol, setSurvol] = useState(null);
  const [zoom, setZoom] = useState(0);
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(10);
  const refGantt = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    const el = refGantt.current;
    if (!el) return undefined;
    setLargeur(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { debut, fin, nb } = useMemo(() => plage(ancre, duree), [ancre, duree]);
  const jours = useMemo(() => Array.from({ length: nb }, (_, i) => ajouterJours(debut, i)), [debut, nb]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const finIncluse = new Date(fin.getTime() - 1000);
      setEvenements((await planningService.findEvenements(mode, debut, finIncluse)) ?? []);
    } catch (e) {
      console.error(e);
      setErreur(t('Impossible de charger le planning. Vérifie que le serveur est bien lancé.'));
      setEvenements([]);
    } finally {
      setChargement(false);
    }
  }, [mode, debut, fin]);
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo(() => evenements
    .map((ev) => {
      const d = ev.dateDebut ? new Date(ev.dateDebut) : null;
      if (!d || Number.isNaN(d.getTime())) return null;
      let f = ev.dateFin ? new Date(ev.dateFin) : null;
      if (!f || Number.isNaN(f.getTime()) || f <= d) f = new Date(debutJour(d).getTime() + JOUR);
      return { ...ev, d, f };
    })
    .filter((ev) => ev && ev.f > debut && ev.d < fin)
    .sort((a, b) => a.d - b.d || (a.titre || '').localeCompare(b.titre || '')), [evenements, debut, fin]);

  const compte = useMemo(() => {
    const c = {};
    lignes.forEach((l) => { c[l.etat] = (c[l.etat] || 0) + 1; });
    return c;
  }, [lignes]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase(locale());
    return lignes.filter((l) => !etatsMasques.has(l.etat) && (!q || (l.titre || `#${l.id}`).toLocaleLowerCase(locale()).includes(q)));
  }, [lignes, etatsMasques, recherche]);

  useEffect(() => { setPage(0); }, [mode, debut, recherche, etatsMasques]);
  const nbPages = Math.max(1, Math.ceil(visibles.length / taille));
  const pageCourante = Math.min(page, nbPages - 1);
  const lignesPage = visibles.slice(pageCourante * taille, (pageCourante + 1) * taille);

  const basculerEtat = (cle) => setEtatsMasques((s) => {
    const n = new Set(s);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return n;
  });

  const deplacer = (sens) => setAncre((a) => {
    if (duree === 'mois') return new Date(a.getFullYear(), a.getMonth() + sens, 1);
    return ajouterJours(a, sens * duree);
  });

  const ouvrir = (ev) => {
    if (!ev.bonMaintenanceId) return;
    if (onSelectBonMaintenance) onSelectBonMaintenance(ev.bonMaintenanceId);
    else navigate(`/bons-maintenance?id=${ev.bonMaintenanceId}`);
  };

  const nomPx = largeur && largeur < 900 ? 200 : 320;
  const ajustePx = largeur ? Math.max(0, largeur - nomPx - 2) / nb : 0;
  const jourPx = ajustePx * ZOOMS[zoom];
  const pistePx = jourPx * nb;
  const zoomPct = Math.round(ZOOMS[zoom] * 100);

  const pos = (date) => Math.max(0, Math.min(100, ((date - debut) / (fin - debut)) * 100));
  const maintenant = new Date();
  const posAujourdhui = maintenant >= debut && maintenant < fin ? pos(maintenant) : null;
  const aujourdhuiCle = cleJour(maintenant);

  useEffect(() => {
    const el = refGantt.current;
    if (!el || !largeur) return;
    const cible = posAujourdhui != null ? (posAujourdhui / 100) * pistePx : 0;
    el.scrollLeft = Math.max(0, cible - (largeur - nomPx) / 2);
  }, [zoom, duree]); // eslint-disable-line react-hooks/exhaustive-deps

  const titrePeriode = duree === 'mois'
    ? majuscule(fmt(debut, { month: 'long', year: 'numeric' }))
    : `${fmt(debut, { day: 'numeric', month: 'short' })} – ${fmt(ajouterJours(fin, -1), { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const dateCourte = (d) => d.toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dureeTexte = (l) => {
    const j = Math.max(1, Math.round((l.f - l.d) / JOUR));
    return j > 1 ? t('{n} jours', { n: j }) : t('1 jour');
  };

  return (
    <div className="pg-page">
      <div className="pg-haut">
        <nav className="pg-onglets" role="tablist" aria-label={t('Vue par')}>
          {MODES.map((m) => {
            const I = m.icone;
            return (
              <button key={m.value} type="button" role="tab" aria-selected={mode === m.value}
                className={`pg-onglet ${mode === m.value ? 'is-actif' : ''}`} onClick={() => setMode(m.value)}>
                <I size={15} aria-hidden="true" /> {t(m.label)}
              </button>
            );
          })}
        </nav>
        <div className="pg-haut__droite">
          <div className="pg-zoom" role="group" aria-label={t('Zoom')}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0}
              aria-label={t('Zoom arrière')} title={t('Zoom arrière')}><ZoomOut size={15} aria-hidden="true" /></button>
            <button type="button" className="pg-zoom__val" onClick={() => setZoom(0)} disabled={zoom === 0}
              title={t('Ajuster à la largeur')}>{zoom === 0 ? <><Maximize2 size={12} aria-hidden="true" /> {t('Ajusté')}</> : `${zoomPct} %`}</button>
            <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1}
              aria-label={t('Zoom avant')} title={t('Zoom avant')}><ZoomIn size={15} aria-hidden="true" /></button>
          </div>
          <div className="pg-segment" role="group" aria-label={t('Durée affichée')}>
            {DUREES.map((d) => (
              <button key={d.cle} type="button" aria-pressed={duree === d.cle} onClick={() => setDuree(d.cle)}>{t(d.label)}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="pg-outils">
        <div className="pg-nav">
          <button type="button" className="pg-icone" onClick={() => deplacer(-1)} aria-label={t('Précédent')} title={t('Précédent')}>
            <ChevronLeft size={17} className="rtl-miroir" aria-hidden="true" />
          </button>
          <button type="button" className="pg-icone" onClick={() => deplacer(1)} aria-label={t('Suivant')} title={t('Suivant')}>
            <ChevronRight size={17} className="rtl-miroir" aria-hidden="true" />
          </button>
          <h2 className="pg-titre"><CalendarDays size={17} aria-hidden="true" /> {titrePeriode}</h2>
          <button type="button" className="pg-btn" onClick={() => setAncre(new Date())}>{t("Aujourd'hui")}</button>
          <input type="date" className="pg-date" value={cleJour(ancre)} aria-label={t('Aller à la date')}
            onChange={(e) => { const [a, m, j] = e.target.value.split('-').map(Number); if (a) setAncre(new Date(a, m - 1, j)); }} />
        </div>
        <div className="pg-filtres">
          {ETATS.map((e) => (
            <button key={e.cle} type="button" aria-pressed={!etatsMasques.has(e.cle)}
              className={`pg-puce pg-puce--${e.classe} ${etatsMasques.has(e.cle) ? 'is-off' : ''}`} onClick={() => basculerEtat(e.cle)}
              title={etatsMasques.has(e.cle) ? t('Afficher') : t('Masquer')}>
              <span className="pg-puce__point" aria-hidden="true" />{t(e.label)}<b>{compte[e.cle] || 0}</b>
            </button>
          ))}
          <label className="pg-recherche">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('Rechercher…')} aria-label={t('Rechercher')} />
            {recherche && <button type="button" onClick={() => setRecherche('')} aria-label={t('Effacer')}><X size={13} /></button>}
          </label>
        </div>
      </div>

      {erreur && <div className="pg-erreur">{erreur}</div>}

      <div className="pg-gantt" ref={refGantt}
        style={{ '--nb-jours': nb, '--pg-nom': `${nomPx}px`, '--pg-largeur': `${nomPx + pistePx}px` }}>
        <div className="pg-gantt__tete">
          <div className="pg-gantt__coin">{visibles.length > 1 ? t('{n} éléments', { n: visibles.length }) : t('{n} élément', { n: visibles.length })}</div>
          <div className="pg-gantt__jours">
            {jours.map((j) => {
              const we = j.getDay() === 0 || j.getDay() === 6;
              const auj = cleJour(j) === aujourdhuiCle;
              return (
                <div key={cleJour(j)} className={`pg-jour ${we ? 'is-we' : ''} ${auj ? 'is-auj' : ''}`}>
                  <small>{fmt(j, { weekday: duree === 'mois' ? 'narrow' : 'short' }).replace('.', '')}</small>
                  <b>{j.getDate()}</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pg-gantt__corps">
          {chargement ? (
            <div className="pg-vide"><LoaderCircle size={16} className="pg-tourne" /> {t('Chargement du planning...')}</div>
          ) : visibles.length === 0 ? (
            <div className="pg-vide">{lignes.length ? t('Aucun élément ne correspond aux filtres.') : t('Rien de planifié sur cette période.')}</div>
          ) : lignesPage.map((l) => {
            const e = ETAT[l.etat] || ETAT[1];
            const g = pos(l.d); const dr = pos(l.f);
            const coupeG = l.d < debut; const coupeD = l.f > fin;
            const w = Math.min(Math.max(dr - g, 100 / nb), 100 - g);
            const texte = l.titre || `#${l.id}`;
            const bulle = `${l.titre || `#${l.id}`}\n${t(e.label)} · ${dureeTexte(l)}\n${dateCourte(l.d)} → ${dateCourte(l.f)}`;
            return (
              <div key={`${l.type}-${l.id}`} className={`pg-ligne ${survol === l.id ? 'is-survol' : ''} ${l.bonMaintenanceId ? 'is-cliquable' : ''}`}
                onMouseEnter={() => setSurvol(l.id)} onMouseLeave={() => setSurvol(null)}
                onClick={() => ouvrir(l)} role={l.bonMaintenanceId ? 'button' : undefined} tabIndex={l.bonMaintenanceId ? 0 : undefined}
                onKeyDown={(ev) => ev.key === 'Enter' && ouvrir(l)}>
                <div className="pg-ligne__nom" title={l.titre}>
                  <span className={`pg-ligne__etat pg-ligne__etat--${e.classe}`} aria-hidden="true" />
                  <span className="pg-ligne__titre">{l.titre || `#${l.id}`}</span>
                  <small>{dureeTexte(l)}</small>
                </div>
                <div className="pg-ligne__piste">
                  {jours.map((j) => (j.getDay() === 0 || j.getDay() === 6) && (
                    <span key={cleJour(j)} className="pg-ligne__we" style={{ left: `${pos(j)}%`, width: `${100 / nb}%` }} aria-hidden="true" />
                  ))}
                  <span className={`pg-barre pg-barre--${e.classe} ${coupeG ? 'is-coupe-g' : ''} ${coupeD ? 'is-coupe-d' : ''}`}
                    style={{ left: `${g}%`, width: `${w}%` }} title={bulle}>
                    <span className="pg-barre__txt">{texte}</span>
                  </span>
                </div>
              </div>
            );
          })}
          {posAujourdhui != null && !chargement && visibles.length > 0 && (
            <div className="pg-auj" style={{ '--pos': posAujourdhui / 100 }} aria-hidden="true" />
          )}
        </div>
      </div>

      {!chargement && visibles.length > 0 && (
        <Pagination page={pageCourante} taille={taille} total={visibles.length}
          onPage={setPage} onTaille={(v) => { setTaille(v); setPage(0); }} />
      )}
    </div>
  );
};

export default PlanningBonMaintenance;
