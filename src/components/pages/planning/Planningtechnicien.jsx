import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequete } from '../../../store/hooks';
import './Planningtechnicien.css';
import { t, locale } from '../../../i18n';
import { ChevronLeft, ChevronRight, Clock, Hash, LoaderCircle, Monitor, Search, X } from 'lucide-react';
import Pagination from '../../commun/Pagination';

const ETATS = {
  0: { label: 'Nouveau', classe: 'nouveau' },
  1: { label: 'En cours', classe: 'encours' },
  2: { label: 'Terminé', classe: 'termine' },
  10: { label: 'Annulé', classe: 'annule' },
};
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const AUCUN = [];

const pad = (n) => String(n).padStart(2, '0');
const versInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const depuisInput = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
const debutJour = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const finJour = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const date = (iso) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; };
const heure = (d) => (d ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '—');
const normaliser = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const initiales = (nom) => String(nom || '?').trim().split(/\s+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

function duree(d, f) {
  if (!d || !f || f <= d) return null;
  const min = Math.round((f - d) / 60000);
  if (min < 60) return t('{n} min', { n: min });
  const h = Math.floor(min / 60); const r = min % 60;
  return r ? t('{h} h {m}', { h, m: pad(r) }) : t('{h} h', { h });
}

function Frise({ creneaux, plage, jour }) {
  const [hMin, hMax] = plage;
  const debut = new Date(jour); debut.setHours(hMin, 0, 0, 0);
  const total = (hMax - hMin) * 3600000;
  const pct = (d) => Math.max(0, Math.min(100, ((d - debut) / total) * 100));
  const maintenant = new Date();
  const posMaintenant = versInput(maintenant) === versInput(jour) ? pct(maintenant) : null;
  const heures = [];
  for (let h = hMin; h <= hMax; h += (hMax - hMin > 12 ? 4 : 2)) heures.push(h);
  return (
    <div className="ptn-frise" aria-hidden="true">
      <div className="ptn-frise__piste">
        {creneaux.map((c, i) => {
          if (!c.d) return null;
          const f = c.f && c.f > c.d ? c.f : new Date(c.d.getTime() + 30 * 60000);
          const g = pct(c.d);
          return <span key={i} className={`ptn-frise__bloc ptn-etat--${c.e.classe}`} style={{ left: `${g}%`, width: `${Math.max(1.2, pct(f) - g)}%` }} />;
        })}
        {posMaintenant != null && posMaintenant > 0 && posMaintenant < 100 && <span className="ptn-frise__now" style={{ left: `${posMaintenant}%` }} />}
      </div>
      <div className="ptn-frise__axe">
        {heures.map((h) => <span key={h} style={{ left: `${((h - hMin) / (hMax - hMin)) * 100}%` }}>{pad(h)}h</span>)}
      </div>
    </div>
  );
}

export default function PlanningTechnicien() {
  const navigate = useNavigate();
  const [jour, setJour] = useState(() => debutJour(new Date()));
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = useMemo(() => ({ debut: debutJour(jour).toISOString(), fin: finJour(jour).toISOString() }), [jour]);
  const requete = useRequete('planningTechniciens', params);
  const techniciens = requete.donnees ?? AUCUN;
  const chargement = requete.statut === 'vide' || requete.statut === 'chargement';
  const erreur = requete.statut === 'erreur' ? t('Impossible de charger le planning des techniciens.') : null;
  useEffect(() => { setPage(1); }, [jour, recherche, filtreStatut, pageSize]);

  const donnees = useMemo(() => techniciens.map((tech) => ({
    ...tech,
    lignes: (tech.creneaux ?? []).map((c) => ({
      ...c, d: date(c.heureDebut), f: date(c.heureFin), e: ETATS[c.etat] || { label: t('État {n}', { n: c.etat }), classe: 'autre' },
    })).sort((a, b) => (a.d?.getTime() ?? 0) - (b.d?.getTime() ?? 0)),
  })), [techniciens]);

  const resume = useMemo(() => ({
    occupes: donnees.filter((x) => x.enIntervention).length,
    dispos: donnees.filter((x) => !x.enIntervention).length,
    interventions: donnees.reduce((s, x) => s + x.lignes.length, 0),
  }), [donnees]);

  const plage = useMemo(() => {
    let a = 7; let b = 19;
    donnees.forEach((x) => x.lignes.forEach((c) => {
      if (c.d && versInput(c.d) === versInput(jour)) a = Math.min(a, c.d.getHours());
      if (c.f && versInput(c.f) === versInput(jour)) b = Math.max(b, c.f.getHours() + (c.f.getMinutes() ? 1 : 0));
    }));
    return [a, Math.min(24, b)];
  }, [donnees, jour]);

  const filtres = useMemo(() => {
    const q = normaliser(recherche.trim());
    return donnees.filter((tech) => {
      if (filtreStatut === 'occupe' && !tech.enIntervention) return false;
      if (filtreStatut === 'dispo' && tech.enIntervention) return false;
      if (!q) return true;
      if (normaliser(tech.personnelNom).includes(q)) return true;
      return tech.lignes.some((c) => normaliser(c.bonMaintenanceNum).includes(q) || normaliser(c.equipementNom).includes(q) || normaliser(t(c.e.label)).includes(q));
    });
  }, [donnees, recherche, filtreStatut]);

  const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);

  const changerJour = (n) => setJour((j) => { const x = new Date(j); x.setDate(x.getDate() + n); return x; });
  const estAujourdhui = versInput(jour) === versInput(new Date());
  const ouvrirBon = (id) => id && navigate(`/bons-maintenance?id=${id}`);
  const titreJour = jour.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="ptn-page">
      <div className="ptn-haut">
        <div className="ptn-nav">
          <button type="button" className="ptn-icone" onClick={() => changerJour(-1)} aria-label={t('Jour précédent')} title={t('Jour précédent')}>
            <ChevronLeft size={17} className="rtl-miroir" aria-hidden="true" />
          </button>
          <button type="button" className="ptn-icone" onClick={() => changerJour(1)} aria-label={t('Jour suivant')} title={t('Jour suivant')}>
            <ChevronRight size={17} className="rtl-miroir" aria-hidden="true" />
          </button>
          <h2 className="ptn-titre">{titreJour.charAt(0).toLocaleUpperCase(locale()) + titreJour.slice(1)}</h2>
          {!estAujourdhui && <button type="button" className="ptn-btn" onClick={() => setJour(debutJour(new Date()))}>{t("Aujourd'hui")}</button>}
          <input type="date" className="ptn-date" value={versInput(jour)} aria-label={t('Choisir la date')}
            onChange={(e) => e.target.value && setJour(depuisInput(e.target.value))} />
        </div>
        <label className="ptn-recherche">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher un technicien, un BON, un équipement…')} aria-label={t('Rechercher')} />
          {recherche && <button type="button" onClick={() => setRecherche('')} aria-label={t('Effacer la recherche')}><X size={14} /></button>}
        </label>
      </div>

      <div className="ptn-kpis" role="group" aria-label={t('Filtrer par statut')}>
        <button type="button" className={`ptn-kpi ${filtreStatut === 'tous' ? 'is-actif' : ''}`} onClick={() => setFiltreStatut('tous')}>
          <span>{t('Techniciens')}</span><b>{donnees.length}</b>
        </button>
        <button type="button" className={`ptn-kpi ptn-kpi--occupe ${filtreStatut === 'occupe' ? 'is-actif' : ''}`} onClick={() => setFiltreStatut('occupe')}>
          <span><i className="ptn-point" />{t('En intervention')}</span><b>{resume.occupes}</b>
        </button>
        <button type="button" className={`ptn-kpi ptn-kpi--dispo ${filtreStatut === 'dispo' ? 'is-actif' : ''}`} onClick={() => setFiltreStatut('dispo')}>
          <span><i className="ptn-point" />{t('Disponibles')}</span><b>{resume.dispos}</b>
        </button>
        <div className="ptn-kpi ptn-kpi--info">
          <span>{t('Interventions du jour')}</span><b>{resume.interventions}</b>
        </div>
      </div>

      {chargement ? (
        <div className="ptn-vide"><LoaderCircle size={16} className="ptn-tourne" /> {t('Chargement...')}</div>
      ) : erreur ? (
        <div className="ptn-vide ptn-erreur">{erreur}</div>
      ) : techniciens.length === 0 ? (
        <div className="ptn-vide">{t('Aucune intervention planifiée pour cette date.')}</div>
      ) : filtres.length === 0 ? (
        <div className="ptn-vide">
          {t('Aucun technicien ne correspond aux filtres.')}
          <button type="button" className="ptn-btn" onClick={() => { setRecherche(''); setFiltreStatut('tous'); }}>{t('Réinitialiser')}</button>
        </div>
      ) : (
        <>
          <div className="ptn-grille">
            {visibles.map((tech) => (
              <article key={tech.personnelId} className={`ptn-carte ${tech.enIntervention ? 'is-occupe' : 'is-dispo'}`}>
                <header className="ptn-carte__tete">
                  <span className="ptn-avatar" aria-hidden="true">{initiales(tech.personnelNom)}</span>
                  <div className="ptn-carte__qui">
                    <strong>{tech.personnelNom}</strong>
                    <small>{tech.lignes.length > 1 ? t('{n} interventions', { n: tech.lignes.length }) : tech.lignes.length === 1 ? t('1 intervention') : t('Aucune intervention')}</small>
                  </div>
                  <span className="ptn-statut">{tech.enIntervention ? t('En intervention') : t('Disponible')}</span>
                </header>

                {tech.lignes.length > 0 && <Frise creneaux={tech.lignes} plage={plage} jour={jour} />}

                {tech.lignes.length === 0 ? (
                  <p className="ptn-aucun">{t('Aucun créneau ce jour-là.')}</p>
                ) : (
                  <ul className="ptn-liste">
                    {tech.lignes.map((c, i) => (
                      <li key={`${c.bonMaintenanceId}-${i}`}>
                        <button type="button" className={`ptn-creneau ptn-etat--${c.e.classe}`} onClick={() => ouvrirBon(c.bonMaintenanceId)}
                          disabled={!c.bonMaintenanceId} title={c.bonMaintenanceId ? t('Ouvrir le bon') : undefined}>
                          <span className="ptn-creneau__heure">
                            <b>{heure(c.d)}</b>
                            <small>{c.f ? heure(c.f) : '…'}</small>
                          </span>
                          <span className="ptn-creneau__corps">
                            <span className={`ptn-creneau__immo ${c.equipementNom ? '' : 'is-vide'}`}>
                              <Monitor size={14} aria-hidden="true" />
                              <span>{c.equipementNom || t('Équipement non renseigné')}</span>
                            </span>
                            <span className="ptn-creneau__meta">
                              {c.bonMaintenanceNum && <span className="ptn-bon"><Hash size={11} aria-hidden="true" />{c.bonMaintenanceNum}</span>}
                              {duree(c.d, c.f) && <span className="ptn-duree"><Clock size={11} aria-hidden="true" />{duree(c.d, c.f)}</span>}
                            </span>
                          </span>
                          <span className="ptn-etat">{t(c.e.label)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          <Pagination base={1} page={pageCourante} taille={pageSize} total={filtres.length} onPage={setPage}
            onTaille={(n) => { setPageSize(n); setPage(1); }} tailles={PAGE_SIZE_OPTIONS} />
        </>
      )}
    </div>
  );
}
