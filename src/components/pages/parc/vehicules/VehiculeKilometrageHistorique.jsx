import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  History, ChevronLeft, ChevronRight, Gauge, Calendar, Activity,
  TrendingUp, Inbox,
} from 'lucide-react';
import vehiculeService from '../../../../services/vehiculeService';
import './VehiculeKilometrageHistorique.css';

const SOURCE_LABELS = {
  MISSION: 'Mission',
  BON_CARBURANT: 'Bon carburant',
  SAISIE_ADMINISTRATEUR: 'Saisie manuelle',
  MAINTENANCE: 'Maintenance',
  INCIDENT: 'Incident',
};

/** Classe CSS correspondant à une source (ex: BON_CARBURANT → bon-carburant). */
const sourceClass = (source) =>
  String(source ?? '').toLowerCase().replace(/_/g, '-');

const fmtKm = (v) => (v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} km`);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtDateShort = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * Historique complet des relevés kilométriques d'un véhicule
 * (vehicule_kilometrage_releve) : une ligne par mise à jour réelle du
 * compteur, quelle qu'en soit la source.
 */
export default function VehiculeKilometrageHistorique({ vehiculeId }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p) => {
    if (!vehiculeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await vehiculeService.getHistoriqueKilometrage(vehiculeId, p, 15);
      setRows(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? data.content?.length ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [vehiculeId]);

  useEffect(() => {
    setPage(0);
    load(0);
  }, [vehiculeId, load]);

  // ── Résumé mémoïsé (le plus ancien et le plus récent de la page) ────────
  const resume = useMemo(() => {
    if (!rows.length) return null;
    // La liste arrive du plus récent au plus ancien (ordre backend classique).
    const dernier = rows[0];
    const plusAncien = rows[rows.length - 1];
    const progression =
      dernier?.kilometrage != null && plusAncien?.kilometrage != null
        ? Number(dernier.kilometrage) - Number(plusAncien.kilometrage)
        : null;
    return { dernier, plusAncien, progression };
  }, [rows]);

  // ── Delta entre chaque ligne et la ligne suivante (plus ancienne) ───────
  const deltas = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < rows.length - 1; i += 1) {
      const current = Number(rows[i].kilometrage ?? 0);
      const next = Number(rows[i + 1].kilometrage ?? 0);
      map.set(rows[i].id, current - next);
    }
    return map;
  }, [rows]);

  if (!vehiculeId) return null;

  const goPrev = () => {
    if (page === 0 || loading) return;
    const p = page - 1;
    setPage(p);
    load(p);
  };

  const goNext = () => {
    if (page >= totalPages - 1 || loading) return;
    const p = page + 1;
    setPage(p);
    load(p);
  };

  return (
    <section className="vkh-panel">

      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="vkh-header">
        <div className="vkh-header-left">
          <div className="vkh-header-icon">
            <History size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h4>Historique du compteur</h4>
            <p className="vkh-header-sub">
              Relevés kilométriques et leurs sources
            </p>
          </div>
        </div>

        {totalElements > 0 && (
          <span className="vkh-badge-count">
            {totalElements} relevé{totalElements > 1 ? 's' : ''}
          </span>
        )}
      </header>

      {/* ═══════════════ RÉSUMÉ (page courante) ═══════════════ */}
      {resume && (
        <div className="vkh-kpi-grid">
          <div className="vkh-kpi kpi-current">
            <span className="vkh-kpi-icon">
              <Gauge size={18} strokeWidth={2.2} />
            </span>
            <div className="vkh-kpi-body">
              <span className="vkh-kpi-value">{fmtKm(resume.dernier.kilometrage)}</span>
              <span className="vkh-kpi-label">Dernier relevé</span>
            </div>
          </div>

          <div className="vkh-kpi kpi-date">
            <span className="vkh-kpi-icon">
              <Calendar size={18} strokeWidth={2.2} />
            </span>
            <div className="vkh-kpi-body">
              <span className="vkh-kpi-value vkh-kpi-value-sm">
                {fmtDateShort(resume.dernier.date)}
              </span>
              <span className="vkh-kpi-label">Date du relevé</span>
            </div>
          </div>

          {resume.progression != null && resume.progression > 0 && (
            <div className="vkh-kpi kpi-delta">
              <span className="vkh-kpi-icon">
                <TrendingUp size={18} strokeWidth={2.2} />
              </span>
              <div className="vkh-kpi-body">
                <span className="vkh-kpi-value">
                  +{Number(resume.progression).toLocaleString('fr-FR')} km
                </span>
                <span className="vkh-kpi-label">Progression sur la page</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="vkh-alert">
          <Activity size={16} strokeWidth={2.4} />
          <span>{error}</span>
        </div>
      )}

      {/* ═══════════════ TABLE ═══════════════ */}
      <div className="vkh-table-wrap">
        <table className="vkh-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Relevé</th>
              <th>Delta</th>
              <th>Source</th>
              <th>Référence</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="vkh-empty">Chargement…</td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="vkh-empty">
                  <Inbox size={22} strokeWidth={1.8} />
                  <span>Aucun relevé enregistré.</span>
                </td>
              </tr>
            )}

            {rows.map((r) => {
              const delta = deltas.get(r.id);
              return (
                <tr key={r.id}>
                  <td className="vkh-cell-date">{fmtDate(r.date)}</td>
                  <td className="vkh-km">
                    <Gauge size={13} strokeWidth={2.4} />
                    {fmtKm(r.kilometrage)}
                  </td>
                  <td>
                    {delta != null ? (
                      <span className={`vkh-delta ${delta > 0 ? 'is-up' : 'is-flat'}`}>
                        {delta > 0 ? '+' : ''}
                        {Number(delta).toLocaleString('fr-FR')} km
                      </span>
                    ) : (
                      <span className="vkh-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`vkh-source vkh-source-${sourceClass(r.source)}`}>
                      {SOURCE_LABELS[r.source] ?? r.source}
                    </span>
                  </td>
                  <td>
                    {r.sourceId != null ? (
                      <span className="vkh-ref">#{r.sourceId}</span>
                    ) : (
                      <span className="vkh-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══════════════ PAGINATION ═══════════════ */}
      {totalPages > 1 && (
        <div className="vkh-pagination">
          <button
            type="button"
            className="vkh-page-btn"
            disabled={page === 0 || loading}
            onClick={goPrev}
            aria-label="Page précédente"
          >
            <ChevronLeft size={14} strokeWidth={2.6} />
            Précédent
          </button>

          <span className="vkh-page-info">
            Page <strong>{page + 1}</strong> / {totalPages}
          </span>

          <button
            type="button"
            className="vkh-page-btn"
            disabled={page >= totalPages - 1 || loading}
            onClick={goNext}
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight size={14} strokeWidth={2.6} />
          </button>
        </div>
      )}
    </section>
  );
}