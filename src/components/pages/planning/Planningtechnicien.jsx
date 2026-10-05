import React, { useState, useEffect, useCallback, useMemo } from 'react';
import planningService from '../../../services/planningService';
import './PlanningTechnicien.css';

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
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
        setError("Impossible de charger le planning des techniciens.");
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
    return techniciens.filter((t) => {
      if (normalize(t.personnelNom).includes(q)) return true;
      return (t.creneaux ?? []).some((c) =>
        normalize(c.bonMaintenanceNum).includes(q) ||
        normalize(c.equipementNom).includes(q) ||
        normalize(ETAT_LABELS[c.etat] || '').includes(q)
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
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <div>
            <h2>Planning technicien</h2>
            <p>Interventions planifiées, par technicien</p>
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
          <svg className="pt-search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            className="pt-search-input"
            placeholder="Rechercher un technicien, un BON, un équipement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isFiltering && (
            <button
              type="button"
              className="pt-search-clear"
              onClick={handleClearSearch}
              aria-label="Effacer la recherche"
              title="Effacer"
            >
              ×
            </button>
          )}
        </div>

        <div className="pt-toolbar-meta">
          <span className="pt-result-count">
            {filtered.length} technicien{filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="pt-legend">
        <span className="pt-legend-item"><span className="pt-dot pt-dot--dispo" /> Disponible</span>
        <span className="pt-legend-item"><span className="pt-dot pt-dot--occupe" /> En intervention</span>
      </div>

      {loading ? (
        <p className="pt-empty">Chargement...</p>
      ) : error ? (
        <p className="pt-empty pt-error">{error}</p>
      ) : techniciens.length === 0 ? (
        <p className="pt-empty">Aucune intervention planifiée pour cette date.</p>
      ) : filtered.length === 0 ? (
        <div className="pt-empty pt-empty-filter">
          <p>Aucun technicien ne correspond à « <strong>{search}</strong> ».</p>
          <button type="button" className="pt-btn pt-btn--ghost" onClick={handleClearSearch}>
            Réinitialiser la recherche
          </button>
        </div>
      ) : (
        <>
          <div className="pt-grid">
            {paginated.map((t) => (
              <div key={t.personnelId} className="pt-card">
                <div className="pt-card-header">
                  <span className={`pt-status-dot ${t.enIntervention ? 'pt-dot--occupe' : 'pt-dot--dispo'}`} />
                  <span className="pt-technicien-nom">{t.personnelNom}</span>
                  <span className={`pt-status-label ${t.enIntervention ? 'occupe' : 'dispo'}`}>
                    {t.enIntervention ? 'En intervention' : 'Disponible'}
                  </span>
                </div>

                <div className="pt-timeline">
                  {(t.creneaux ?? []).length === 0 ? (
                    <p className="pt-empty-creneaux">Aucun créneau ce jour-là.</p>
                  ) : (
                    t.creneaux.map((c, idx) => (
                      <div key={idx} className="pt-creneau">
                        <span className="pt-creneau-heure">{formatHeure(c.heureDebut)}</span>
                        <span className="pt-creneau-sep">┃</span>
                        <span className="pt-creneau-bon">{c.bonMaintenanceNum}</span>
                        <span className="pt-creneau-sep">┃</span>
                        <span className="pt-creneau-equipement">{c.equipementNom || '—'}</span>
                        {c.etat != null && (
                          <span className={`pt-creneau-etat pt-creneau-etat--${c.etat}`}>
                            {ETAT_LABELS[c.etat] || `État ${c.etat}`}
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
              Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
            </div>

            <div className="pt-pagination-size">
              <label htmlFor="pt-page-size">Afficher</label>
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
              <span>par page</span>
            </div>

            <div className="pt-pagination-controls">
              <button
                type="button"
                className="pt-btn pt-btn--page"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                aria-label="Page précédente"
              >
                ‹ Précédent
              </button>
              <button
                type="button"
                className="pt-btn pt-btn--page"
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                aria-label="Page suivante"
              >
                Suivant ›
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}