import React, { useCallback, useEffect, useMemo, useState } from 'react';
import slaService from '../../../services/slaService';
import { prioriteLabel, prioriteRang } from '../../../constants/Priorite';
import './Sla.css';

/* ---------- Config ---------- */
const PRIORITE_HEX = { P1: '#ef4444', P2: '#f97316', P3: '#3b82f6', P4: '#64748b' };

const STATUT_LABELS = {
  RESPECTE: 'Respecté',
  DEPASSE: 'Dépassé',
  EN_COURS: 'En cours',
  NON_APPLICABLE: 'N/A',
};

const STATUT_CLASS = {
  RESPECTE: 'sla-statut--respecte',
  DEPASSE: 'sla-statut--depasse',
  EN_COURS: 'sla-statut--encours',
  NON_APPLICABLE: 'sla-statut--na',
};

const PERIODES = [
  { key: '7J',  label: '7 jours',  jours: 7 },
  { key: '30J', label: '30 jours', jours: 30 },
  { key: '3M',  label: '3 mois',   jours: 90 },
  { key: '12M', label: '12 mois',  jours: 365 },
];

const VUES = [
  { key: 'PERIODE',     label: 'Bons de la période' },
  { key: 'DEPASSEMENTS', label: 'Dépassements en cours' },
];

/* ---------- Pagination ---------- */
const TAILLES_PAGE = [7, 14, 21, 50];
const TAILLE_PAGE_DEFAUT = 7;

/* ---------- Utils ---------- */
function calculerBornes(periodeKey) {
  const fin = new Date();
  const debut = new Date(fin);
  const conf = PERIODES.find((p) => p.key === periodeKey) || PERIODES[2];
  debut.setDate(debut.getDate() - conf.jours);
  return { dateDebut: debut.toISOString(), dateFin: fin.toISOString() };
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuree(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return `${heures.toFixed(1)} h`;
  return `${(heures / 24).toFixed(1)} j`;
}

function formatTaux(taux) {
  if (taux === null || taux === undefined) return '—';
  return `${taux.toFixed(1)} %`;
}

/* ---------- Icônes ---------- */
const Svg = (props) => (
  <svg width={props.size || 15} height={props.size || 15} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const IconRefresh = () => (
  <Svg><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 4v5h-5M3 20v-5h5" /></Svg>
);

const IconSpinner = () => (
  <svg className="sla-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconSearch = () => (
  <Svg size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

const IconAlert = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

const IconTarget = () => (
  <Svg size={16}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>
);

const IconCheckShield = () => (
  <Svg size={16}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></Svg>
);

const IconAlertTriangle = () => (
  <Svg size={16}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>
);

const IconStopwatch = () => (
  <Svg size={16}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 3h6M12 3v2" /></Svg>
);

const IconChevron = ({ direction = 'right' }) => (
  <Svg size={14}>
    {direction === 'left'
      ? <path d="m15 18-6-6 6-6" />
      : <path d="m9 18 6-6-6-6" />}
  </Svg>
);

/* Icône du header */
const IconClipboardCheck = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

/* ---------- Pagination ---------- */
function construirePages(pageActuelle, totalPages) {
  const pages = [];
  const ajouter = (v) => { if (!pages.includes(v)) pages.push(v); };

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) ajouter(i);
    return pages;
  }

  ajouter(1);
  if (pageActuelle > 3) ajouter('…');
  for (let i = Math.max(2, pageActuelle - 1); i <= Math.min(totalPages - 1, pageActuelle + 1); i++) {
    ajouter(i);
  }
  if (pageActuelle < totalPages - 2) ajouter('…');
  ajouter(totalPages);
  return pages;
}

function Pagination({
  page, totalPages, totalItems, taillePage,
  onChangePage, onChangeTaille,
}) {
  if (totalPages <= 1 && totalItems <= TAILLES_PAGE[0]) return null;

  const pages = construirePages(page, totalPages);

  return (
    <div className="sla-pagination">
      <div className="sla-pagination__left">
        <span className="sla-pagination__info">
          Page <strong>{page}</strong> sur <strong>{totalPages}</strong>
          {' · '}<span className="sla-pagination__count">{totalItems} bon{totalItems > 1 ? 's' : ''}</span>
        </span>
      </div>

      <div className="sla-pagination__center">
        <button
          type="button"
          className="sla-pagination__btn sla-pagination__btn--nav"
          onClick={() => onChangePage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
        >
          <IconChevron direction="left" />
        </button>

        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`ellipsis-${idx}`} className="sla-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`sla-pagination__btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onChangePage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="sla-pagination__btn sla-pagination__btn--nav"
          onClick={() => onChangePage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
        >
          <IconChevron direction="right" />
        </button>
      </div>

      <div className="sla-pagination__right">
        <label className="sla-pagination__size">
          <span>Par page</span>
          <select
            value={taillePage}
            onChange={(e) => onChangeTaille(Number(e.target.value))}
            className="sla-pagination__select"
          >
            {TAILLES_PAGE.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/* ---------- Composant principal ---------- */
export default function Sla() {
  const [vue, setVue] = useState('PERIODE');
  const [periodeKey, setPeriodeKey] = useState('30J');
  const [bons, setBons] = useState([]);
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recherche, setRecherche] = useState('');

  /* ---------- Pagination ---------- */
  const [page, setPage] = useState(1);
  const [taillePage, setTaillePage] = useState(TAILLE_PAGE_DEFAUT);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (vue === 'DEPASSEMENTS') {
        const data = await slaService.getDepassements();
        setBons(data ?? []);
        setBilan(null);
      } else {
        const bornes = calculerBornes(periodeKey);
        const [listeBons, bilanData] = await Promise.all([
          slaService.getParPeriode(bornes),
          slaService.getBilan(bornes),
        ]);
        setBons(listeBons ?? []);
        setBilan(bilanData);
      }
    } catch (err) {
      console.error('Erreur chargement SLA :', err);
      setError('Impossible de charger les données SLA.');
    } finally {
      setLoading(false);
    }
  }, [vue, periodeKey]);

  useEffect(() => { charger(); }, [charger]);

  const bonsAffiches = useMemo(() => {
    return bons
      .filter((b) => !recherche.trim()
        || (b.titre || '').toLowerCase().includes(recherche.trim().toLowerCase())
        || (b.num || '').toLowerCase().includes(recherche.trim().toLowerCase()))
      .slice()
      .sort((a, b) => prioriteRang(a.priorite) - prioriteRang(b.priorite));
  }, [bons, recherche]);

  /* ---------- Pagination ---------- */
  const totalItems = bonsAffiches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / taillePage));
  const pageCourante = Math.min(page, totalPages);

  const bonsPaginees = useMemo(() => {
    const debut = (pageCourante - 1) * taillePage;
    return bonsAffiches.slice(debut, debut + taillePage);
  }, [bonsAffiches, pageCourante, taillePage]);

  // Reset page à 1 sur changement de filtre
  useEffect(() => { setPage(1); }, [recherche]);
  useEffect(() => { setPage(1); }, [vue]);
  useEffect(() => { setPage(1); }, [periodeKey]);
  useEffect(() => { setPage(1); }, [taillePage]);

  // Borne la page courante si le total baisse
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="sla-page">
      {/* ---------- Header ---------- */}
      <header className="sla-header">
        <div className="sla-header__icon-wrap">
          <IconClipboardCheck />
        </div>
        <div className="sla-header__text">
          <h1>SLA</h1>
          <p>
            Délais de réponse et de résolution contractuels par priorité, mesurés sur les
            dates réelles des bons — pas d'estimation.
          </p>
        </div>

        <div className="sla-header__actions">
          <div className="sla-vue-select">
            {VUES.map((v) => (
              <button
                key={v.key}
                className={`sla-vue-btn ${vue === v.key ? 'sla-vue-btn--active' : ''}`}
                onClick={() => setVue(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {vue === 'PERIODE' && (
            <div className="sla-periode-select">
              {PERIODES.map((p) => (
                <button
                  key={p.key}
                  className={`sla-periode-btn ${periodeKey === p.key ? 'sla-periode-btn--active' : ''}`}
                  onClick={() => setPeriodeKey(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <button className="sla-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? 'Chargement' : 'Rafraîchir'}</span>
          </button>
        </div>
      </header>

      {/* ---------- KPIs (vue période uniquement) ---------- */}
      {vue === 'PERIODE' && !loading && bilan && (
        <section className="sla-kpis">
          <div className={`sla-kpi ${(bilan.tauxRespectReponsePct ?? 100) >= 90 ? 'sla-kpi--bon' : (bilan.tauxRespectReponsePct ?? 100) >= 70 ? 'sla-kpi--moyen' : 'sla-kpi--critique'}`}>
            <div className="sla-kpi__icon"><IconTarget /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">Respect délai de réponse</span>
              <span className="sla-kpi__valeur">{formatTaux(bilan.tauxRespectReponsePct)}</span>
            </div>
          </div>

          <div className={`sla-kpi ${(bilan.tauxRespectResolutionPct ?? 100) >= 90 ? 'sla-kpi--bon' : (bilan.tauxRespectResolutionPct ?? 100) >= 70 ? 'sla-kpi--moyen' : 'sla-kpi--critique'}`}>
            <div className="sla-kpi__icon"><IconCheckShield /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">Respect délai de résolution</span>
              <span className="sla-kpi__valeur">{formatTaux(bilan.tauxRespectResolutionPct)}</span>
            </div>
          </div>

          <div className="sla-kpi sla-kpi--neutre">
            <div className="sla-kpi__icon"><IconStopwatch /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">Bons analysés</span>
              <span className="sla-kpi__valeur">{bilan.nbBonsAnalyses}</span>
            </div>
          </div>

          <div className={`sla-kpi ${bilan.nbReponseDepassee + bilan.nbResolutionDepassee > 0 ? 'sla-kpi--critique' : 'sla-kpi--bon'}`}>
            <div className="sla-kpi__icon"><IconAlertTriangle /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">Dépassements (réponse + résolution)</span>
              <span className="sla-kpi__valeur">{bilan.nbReponseDepassee + bilan.nbResolutionDepassee}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Répartition par priorité ---------- */}
      {vue === 'PERIODE' && !loading && bilan && bilan.parPriorite?.length > 0 && (
        <section className="sla-parpriorite">
          <div className="sla-parpriorite__title">Répartition par priorité</div>
          <div className="sla-parpriorite__list">
            {bilan.parPriorite.map((p) => (
              <div key={p.priorite} className="sla-parpriorite__item">
                <span className="sla-priorite-dot" style={{ backgroundColor: PRIORITE_HEX[p.priorite] }} />
                <span className="sla-parpriorite__label">{prioriteLabel(p.priorite)}</span>
                <span className="sla-parpriorite__nb">{p.nbBons} bon{p.nbBons > 1 ? 's' : ''}</span>
                <span className="sla-parpriorite__sep">·</span>
                <span className="sla-parpriorite__taux">Réponse {formatTaux(p.tauxRespectReponsePct)}</span>
                <span className="sla-parpriorite__sep">·</span>
                <span className="sla-parpriorite__taux">Résolution {formatTaux(p.tauxRespectResolutionPct)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Recherche ---------- */}
      <div className="sla-filtres">
        <div className="sla-recherche-wrap">
          <span className="sla-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder="Rechercher par titre ou numéro..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="sla-recherche"
          />
        </div>
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="sla-empty">Chargement...</p>
      ) : error ? (
        <p className="sla-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : bonsAffiches.length === 0 ? (
        <p className="sla-empty">
          <IconInbox />
          <span>
            {vue === 'DEPASSEMENTS'
              ? "Aucun dépassement en cours — tous les bons ouverts sont dans les délais."
              : 'Aucun bon ne correspond à cette recherche sur la période.'}
          </span>
        </p>
      ) : (
        <>
          <ul className="sla-list">
            {bonsPaginees.map((b) => (
              <li key={b.bonMaintenanceId} className="sla-card">
                <div className="sla-card__header">
                  <div className="sla-card__titre-wrap">
                    <span className="sla-priorite-dot" style={{ backgroundColor: PRIORITE_HEX[b.priorite] }} />
                    <span className="sla-card__titre">{b.titre || `Bon ${b.num || b.bonMaintenanceId}`}</span>
                    <span className="sla-card__num">{b.num}</span>
                  </div>
                  <span className="sla-card__priorite-label">{prioriteLabel(b.priorite)}</span>
                </div>

                <div className="sla-card__delais">
                  <div className="sla-delai">
                    <span className="sla-delai__label">Réponse</span>
                    <span className={`sla-statut ${STATUT_CLASS[b.statutReponse] || ''}`}>
                      {STATUT_LABELS[b.statutReponse] || b.statutReponse}
                    </span>
                    <span className="sla-delai__detail">
                      {b.delaiReponseReelHeures !== null && b.delaiReponseReelHeures !== undefined
                        ? `${formatDuree(b.delaiReponseReelHeures)} (cible ${formatDuree(b.delaiReponseCibleHeures)})`
                        : b.echeanceReponse ? `Échéance ${formatDateTime(b.echeanceReponse)}` : '—'}
                    </span>
                  </div>

                  <div className="sla-delai">
                    <span className="sla-delai__label">Résolution</span>
                    <span className={`sla-statut ${STATUT_CLASS[b.statutResolution] || ''}`}>
                      {STATUT_LABELS[b.statutResolution] || b.statutResolution}
                    </span>
                    <span className="sla-delai__detail">
                      {b.delaiResolutionReelHeures !== null && b.delaiResolutionReelHeures !== undefined
                        ? `${formatDuree(b.delaiResolutionReelHeures)} (cible ${formatDuree(b.delaiResolutionCibleHeures)})`
                        : b.echeanceResolution ? `Échéance ${formatDateTime(b.echeanceResolution)}` : '—'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={pageCourante}
            totalPages={totalPages}
            totalItems={totalItems}
            taillePage={taillePage}
            onChangePage={setPage}
            onChangeTaille={setTaillePage}
          />
        </>
      )}
    </div>
  );
}