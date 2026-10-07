import React, { useCallback, useEffect, useMemo, useState } from 'react';
import risqueService from '../../../services/Risqueservice';
import './Risque.css';

/* ---------- Config ---------- */
const NIVEAU_LABELS = {
  CRITIQUE: 'Critique',
  ELEVE: 'Élevé',
  MODERE: 'Modéré',
  FAIBLE: 'Faible',
};

const NIVEAU_CLASS = {
  CRITIQUE: 'critique',
  ELEVE: 'eleve',
  MODERE: 'modere',
  FAIBLE: 'faible',
};

const LIMITES = [
  { key: 20, label: 'Top 20' },
  { key: 50, label: 'Top 50' },
  { key: 100, label: 'Top 100' },
];

/* ---------- Pagination ---------- */
const TAILLES_PAGE = [10, 20, 50, 100];
const TAILLE_PAGE_DEFAUT = 10;

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return 'Aucune intervention';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAge(annees) {
  if (annees === null || annees === undefined) return 'Âge inconnu';
  return `${annees.toFixed(1)} an${annees >= 2 ? 's' : ''}`;
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
  <svg className="risque-spinner" width="15" height="15" viewBox="0 0 24 24"
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

const IconShieldAlert = () => (
  <Svg size={16}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="M12 8v4M12 16h.01" /></Svg>
);

const IconTrendUp = () => (
  <Svg size={13}><path d="M22 7 13.5 15.5 8.5 10.5 2 17" /><path d="M16 7h6v6" /></Svg>
);

const IconTrendDown = () => (
  <Svg size={13}><path d="M22 17 13.5 8.5 8.5 13.5 2 7" /><path d="M16 17h6v-6" /></Svg>
);

const IconTrendFlat = () => (
  <Svg size={13}><path d="M2 12h20" /></Svg>
);

const IconChevron = ({ direction = 'right' }) => (
  <Svg size={14}>
    {direction === 'left'
      ? <path d="m15 18-6-6 6-6" />
      : <path d="m9 18 6-6-6-6" />}
  </Svg>
);

const TENDANCE_ICON = { HAUSSE: IconTrendUp, BAISSE: IconTrendDown, STABLE: IconTrendFlat };
const TENDANCE_LABEL = { HAUSSE: 'En hausse', BAISSE: 'En baisse', STABLE: 'Stable' };
const TENDANCE_CLASS = { HAUSSE: 'hausse', BAISSE: 'baisse', STABLE: 'stable' };

/* ---------- Pagination : construction des pages ---------- */
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
    <div className="risque-pagination">
      <div className="risque-pagination__left">
        <span className="risque-pagination__info">
          Page <strong>{page}</strong> sur <strong>{totalPages}</strong>
          {' · '}<span className="risque-pagination__count">{totalItems} équipement{totalItems > 1 ? 's' : ''}</span>
        </span>
      </div>

      <div className="risque-pagination__center">
        <button
          type="button"
          className="risque-pagination__btn risque-pagination__btn--nav"
          onClick={() => onChangePage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
        >
          <IconChevron direction="left" />
        </button>

        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`ellipsis-${idx}`} className="risque-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`risque-pagination__btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onChangePage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="risque-pagination__btn risque-pagination__btn--nav"
          onClick={() => onChangePage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
        >
          <IconChevron direction="right" />
        </button>
      </div>

      <div className="risque-pagination__right">
        <label className="risque-pagination__size">
          <span>Par page</span>
          <select
            value={taillePage}
            onChange={(e) => onChangeTaille(Number(e.target.value))}
            className="risque-pagination__select"
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

/* ---------- Composant ---------- */
export default function Risque() {
  const [limite, setLimite] = useState(50);
  const [equipements, setEquipements] = useState([]);
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
      const data = await risqueService.getRisques(limite);
      setEquipements(data ?? []);
    } catch (err) {
      console.error('Erreur chargement risques :', err);
      setError('Impossible de charger le score de risque du parc.');
    } finally {
      setLoading(false);
    }
  }, [limite]);

  useEffect(() => { charger(); }, [charger]);

  const equipementsAffiches = useMemo(() => {
    if (!recherche.trim()) return equipements;
    const q = recherche.trim().toLowerCase();
    return equipements.filter((e) =>
      (e.designation || '').toLowerCase().includes(q)
      || (e.marque || '').toLowerCase().includes(q)
      || (e.modele || '').toLowerCase().includes(q)
    );
  }, [equipements, recherche]);

  /* ---------- Pagination ---------- */
  const totalItems = equipementsAffiches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / taillePage));
  const pageCourante = Math.min(page, totalPages);

  const equipementsPaginees = useMemo(() => {
    const debut = (pageCourante - 1) * taillePage;
    return equipementsAffiches.slice(debut, debut + taillePage);
  }, [equipementsAffiches, pageCourante, taillePage]);

  // Reset page à 1 quand les filtres changent
  useEffect(() => { setPage(1); }, [recherche]);
  useEffect(() => { setPage(1); }, [limite]);
  useEffect(() => { setPage(1); }, [taillePage]);

  // Borne la page courante si le total baisse
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const kpis = useMemo(() => {
    const nbCritiques = equipements.filter((e) => e.niveauRisque === 'CRITIQUE').length;
    const nbEleves = equipements.filter((e) => e.niveauRisque === 'ELEVE').length;
    const scoreMoyen = equipements.length
      ? equipements.reduce((s, e) => s + (e.scoreRisque || 0), 0) / equipements.length
      : null;
    return { nbCritiques, nbEleves, scoreMoyen, total: equipements.length };
  }, [equipements]);

  return (
    <div className="risque-page">
      {/* ---------- Header ---------- */}
      <header className="risque-header">
        <div className="risque-header__text">
          <h1>Risques</h1>
          <p>
            Score prédictif de panne (0-100), calculé à partir de la fréquence des pannes
            récentes, de leur tendance, de l'âge de l'équipement et de l'expiration de sa
            garantie — sans modèle externe, entièrement explicable.
          </p>
        </div>

        <div className="risque-header__actions">
          <div className="risque-limite-select">
            {LIMITES.map((l) => (
              <button
                key={l.key}
                className={`risque-limite-btn ${limite === l.key ? 'risque-limite-btn--active' : ''}`}
                onClick={() => setLimite(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button className="risque-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? 'Chargement' : 'Rafraîchir'}</span>
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      {!loading && equipements.length > 0 && (
        <section className="risque-kpis">
          <div className="risque-kpi risque-kpi--neutre">
            <div className="risque-kpi__icon"><IconShieldAlert /></div>
            <div className="risque-kpi__body">
              <span className="risque-kpi__label">Équipements analysés</span>
              <span className="risque-kpi__valeur">{kpis.total}</span>
            </div>
          </div>

          <div className={`risque-kpi ${kpis.nbCritiques > 0 ? 'risque-kpi--critique' : 'risque-kpi--bon'}`}>
            <div className="risque-kpi__icon"><IconAlert /></div>
            <div className="risque-kpi__body">
              <span className="risque-kpi__label">Niveau critique</span>
              <span className="risque-kpi__valeur">{kpis.nbCritiques}</span>
            </div>
          </div>

          <div className={`risque-kpi ${kpis.nbEleves > 0 ? 'risque-kpi--eleve' : 'risque-kpi--bon'}`}>
            <div className="risque-kpi__icon"><IconTrendUp /></div>
            <div className="risque-kpi__body">
              <span className="risque-kpi__label">Niveau élevé</span>
              <span className="risque-kpi__valeur">{kpis.nbEleves}</span>
            </div>
          </div>

          <div className="risque-kpi risque-kpi--neutre">
            <div className="risque-kpi__icon"><IconShieldAlert /></div>
            <div className="risque-kpi__body">
              <span className="risque-kpi__label">Score moyen</span>
              <span className="risque-kpi__valeur">
                {kpis.scoreMoyen !== null ? kpis.scoreMoyen.toFixed(0) : '—'} / 100
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Recherche ---------- */}
      <div className="risque-filtres">
        <div className="risque-recherche-wrap">
          <span className="risque-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder="Rechercher par désignation, marque ou modèle..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="risque-recherche"
          />
        </div>

        {!loading && equipementsAffiches.length > 0 && (
          <span className="risque-filtres__count">
            {equipementsAffiches.length} équipement{equipementsAffiches.length > 1 ? 's' : ''}
            {recherche && ' filtré' + (equipementsAffiches.length > 1 ? 's' : '')}
          </span>
        )}
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="risque-empty">Chargement...</p>
      ) : error ? (
        <p className="risque-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : equipementsAffiches.length === 0 ? (
        <p className="risque-empty">
          <IconInbox />
          <span>
            {equipements.length === 0
              ? 'Aucune donnée de risque disponible pour le moment.'
              : 'Aucun équipement ne correspond à cette recherche.'}
          </span>
        </p>
      ) : (
        <>
          <ul className="risque-list">
            {equipementsPaginees.map((e) => {
              const niveauClass = NIVEAU_CLASS[e.niveauRisque] || 'inconnu';
              const TendanceIcon = TENDANCE_ICON[e.tendance] || IconTrendFlat;
              return (
                <li key={e.lotArticleImmobilistationId} className={`risque-card risque-card--${niveauClass}`}>
                  <div className="risque-card__score">
                    <span className={`risque-score-cercle risque-score-cercle--${niveauClass}`}>
                      {e.scoreRisque}
                    </span>
                    <span className={`risque-niveau-label risque-niveau-label--${niveauClass}`}>
                      {NIVEAU_LABELS[e.niveauRisque] || e.niveauRisque}
                    </span>
                  </div>

                  <div className="risque-card__body">
                    <div className="risque-card__titre-wrap">
                      <span className="risque-card__titre">
                        {e.designation || `Équipement #${e.lotArticleImmobilistationId}`}
                      </span>
                      {(e.marque || e.modele) && (
                        <span className="risque-card__marque">
                          {[e.marque, e.modele].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>

                    <div className="risque-card__meta">
                      <span className="risque-meta-item">
                        <strong>{e.nbPannes12Mois}</strong> panne{e.nbPannes12Mois > 1 ? 's' : ''} / 12 mois
                      </span>
                      <span className={`risque-meta-item risque-tendance risque-tendance--${TENDANCE_CLASS[e.tendance] || 'stable'}`}>
                        <TendanceIcon /> {TENDANCE_LABEL[e.tendance] || e.tendance}
                      </span>
                      <span className="risque-meta-item">{formatAge(e.ageAnnees)}</span>
                      {e.garantieExpiree === true && (
                        <span className="risque-meta-item risque-garantie-expiree">Garantie expirée</span>
                      )}
                      {e.garantieExpiree === false && (
                        <span className="risque-meta-item risque-garantie-active">Sous garantie</span>
                      )}
                      <span className="risque-meta-item risque-meta-item--muted">
                        Dernière intervention : {formatDate(e.derniereIntervention)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
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