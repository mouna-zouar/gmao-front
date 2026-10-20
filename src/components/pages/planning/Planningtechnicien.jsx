import React, { useState, useEffect, useCallback, useMemo } from 'react';
import planningService from '../../../services/planningService';
import './PlanningTechnicien.css';
import { t, tp, locale } from '../../../i18n';
import { Search } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';

const ETAT_LABELS = { 0: 'Nouveau', 1: 'En cours', 2: 'Terminé', 10: 'Annulé' };
const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function todayInputValue() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normalise une chaîne pour la recherche (minuscules, sans accents). */
function normalize(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function PlanningTechnicien() {
  const [dateStr, setDateStr] = useState(todayInputValue());
  const [techniciens, setTechniciens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recherche & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const jour = new Date(dateStr + 'T00:00:00');
    planningService.findPlanningTousTechniciens(startOfDay(jour), endOfDay(jour))
      .then((data) => setTechniciens(data ?? []))
      .catch((err) => {
        console.error('Erreur chargement planning techniciens :', err);
        setError(t('Impossible de charger le planning des techniciens.'));
        setTechniciens([]);
      })
      .finally(() => setLoading(false));
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);

  // Reset page quand date ou recherche changent
  useEffect(() => { setPage(1); }, [dateStr, search, pageSize]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return techniciens;
    return techniciens.filter((tech) => {
      if (normalize(tech.personnelNom).includes(q)) return true;
      return (tech.creneaux ?? []).some((c) =>
        normalize(c.bonMaintenanceNum).includes(q) ||
        normalize(c.equipementNom).includes(q) ||
        normalize(ETAT_LABELS[c.etat] || '').includes(q) ||
        normalize(ETAT_LABELS[c.etat] ? t(ETAT_LABELS[c.etat]) : '').includes(q)
      );
    });
  }, [techniciens, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const handleClearSearch = () => setSearch('');

  const isFiltering = search.trim().length > 0;

  return (
    <div className="pt-container">
      <div className="pt-header">
        <div className="pt-header-title">
          <ICONES_MODULES.planningTechnicien size={24} strokeWidth={2} aria-hidden="true" />
          <div>
            <h2>{t('Planning technicien')}</h2>
            <p>{t('Interventions planifiées, par technicien')}</p>
          </div>
        </div>

        <input
          type="date"
          className="pt-date-input"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />
      </div>

      {/* Barre de recherche */}
      <div className="pt-toolbar">
        <div className="pt-search">
          <Search size={16} strokeWidth={2} className="pt-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="pt-search-input"
            placeholder={t('Rechercher un technicien, un BON, un équipement…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isFiltering && (
            <button
              type="button"
              className="pt-search-clear"
              onClick={handleClearSearch}
              aria-label={t('Effacer la recherche')}
              title={t('Effacer')}
            >
              ×
            </button>
          )}
        </div>

        <div className="pt-toolbar-meta">
          <span className="pt-result-count">
            {tp('technicien', filtered.length)}
          </span>
        </div>
      </div>

      <div className="pt-legend">
        <span className="pt-legend-item"><span className="pt-dot pt-dot--dispo" /> {t('Disponible')}</span>
        <span className="pt-legend-item"><span className="pt-dot pt-dot--occupe" /> {t('En intervention')}</span>
      </div>

      {loading ? (
        <p className="pt-empty">{t('Chargement...')}</p>
      ) : error ? (
        <p className="pt-empty pt-error">{error}</p>
      ) : techniciens.length === 0 ? (
        <p className="pt-empty">{t('Aucune intervention planifiée pour cette date.')}</p>
      ) : filtered.length === 0 ? (
        <div className="pt-empty pt-empty-filter">
          <p>{t('Aucun technicien ne correspond à')} « <strong>{search}</strong> ».</p>
          <button type="button" className="pt-btn pt-btn--ghost" onClick={handleClearSearch}>
            {t('Réinitialiser la recherche')}
          </button>
        </div>
      ) : (
        <>
          <div className="pt-grid">
            {paginated.map((tech) => (
              <div key={tech.personnelId} className="pt-card">
                <div className="pt-card-header">
                  <span className={`pt-status-dot ${tech.enIntervention ? 'pt-dot--occupe' : 'pt-dot--dispo'}`} />
                  <span className="pt-technicien-nom">{tech.personnelNom}</span>
                  <span className={`pt-status-label ${tech.enIntervention ? 'occupe' : 'dispo'}`}>
                    {tech.enIntervention ? t('En intervention') : t('Disponible')}
                  </span>
                </div>

                <div className="pt-timeline">
                  {(tech.creneaux ?? []).length === 0 ? (
                    <p className="pt-empty-creneaux">{t('Aucun créneau ce jour-là.')}</p>
                  ) : (
                    tech.creneaux.map((c, idx) => (
                      <div key={idx} className="pt-creneau">
                        <span className="pt-creneau-heure">{formatHeure(c.heureDebut)}</span>
                        <span className="pt-creneau-sep">┃</span>
                        <span className="pt-creneau-bon">{c.bonMaintenanceNum}</span>
                        <span className="pt-creneau-sep">┃</span>
                        <span className="pt-creneau-equipement">{c.equipementNom || '—'}</span>
                        {c.etat != null && (
                          <span className={`pt-creneau-etat pt-creneau-etat--${c.etat}`}>
                            {ETAT_LABELS[c.etat] ? t(ETAT_LABELS[c.etat]) : t('État {n}', { n: c.etat })}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="pt-pagination">
            <div className="pt-pagination-info">
              {t('Page')} <strong>{currentPage}</strong> {t('sur')} <strong>{totalPages}</strong>
            </div>

            <div className="pt-pagination-size">
              <label htmlFor="pt-page-size">{t('Afficher')}</label>
              <select
                id="pt-page-size"
                className="pt-page-size-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>{t('par page')}</span>
            </div>

            <div className="pt-pagination-controls">
              <button
                type="button"
                className="pt-btn pt-btn--page"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                aria-label={t('Page précédente')}
              >
                <span className="rtl-miroir">‹</span> {t('Précédent')}
              </button>
              <button
                type="button"
                className="pt-btn pt-btn--page"
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                aria-label={t('Page suivante')}
              >
                {t('Suivant')} <span className="rtl-miroir">›</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}