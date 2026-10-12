import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  History, ChevronLeft, ChevronRight, Gauge, Calendar, Activity,
  TrendingUp, Inbox, FileText, Link2, ArrowUpRight, ArrowRight,
  RefreshCw, Milestone,
} from 'lucide-react';
import vehiculeService from '../../../../services/vehiculeService';
import { t, tp, locale } from '../../../../i18n';
import './VehiculeKilometrageHistorique.css';

const SOURCE_LABELS = {
  MISSION: 'Mission',
  BON_CARBURANT: 'Bon carburant',
  SAISIE_ADMINISTRATEUR: 'Saisie manuelle',
  MAINTENANCE: 'Maintenance',
  INCIDENT: 'Incident',
};

const SOURCE_ICONS = {
  MISSION: Milestone,
  BON_CARBURANT: FileText,
  SAISIE_ADMINISTRATEUR: Activity,
  MAINTENANCE: RefreshCw,
  INCIDENT: Activity,
};

const sourceClass = (source) =>
  String(source ?? '').toLowerCase().replace(/_/g, '-');

const fmtKm = (v) => (v == null ? '—' : t('{n} km', { n: Number(v).toLocaleString(locale()) }));
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '—';

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
      setError(err?.response?.data?.message || t("Impossible de charger l'historique."));
    } finally {
      setLoading(false);
    }
  }, [vehiculeId]);

  useEffect(() => {
    setPage(0);
    load(0);
  }, [vehiculeId, load]);

  const resume = useMemo(() => {
    if (!rows.length) return null;
    const dernier = rows[0];
    const plusAncien = rows[rows.length - 1];
    const progression =
      dernier?.kilometrage != null && plusAncien?.kilometrage != null
        ? Number(dernier.kilometrage) - Number(plusAncien.kilometrage)
        : null;
    return { dernier, plusAncien, progression };
  }, [rows]);

  const deltas = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < rows.length - 1; i += 1) {
      const current = Number(rows[i].kilometrage ?? 0);
      const next = Number(rows[i + 1].kilometrage ?? 0);
      map.set(rows[i].id, current - next);
    }
    return map;
  }, [rows]);

  const sourcesSummary = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.source ?? 'AUTRE';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
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
      {resume && (
        <div className="vkh-kpis">
          <div className="vkh-kpi kpi-current">
            <Gauge size={16} />
            <span className="vkh-kpi-value">{fmtKm(resume.dernier.kilometrage)}</span>
            <span className="vkh-kpi-label">{t("Dernier relevé")}</span>
          </div>

          <div className="vkh-kpi kpi-date">
            <Calendar size={16} />
            <span className="vkh-kpi-value vkh-kpi-value-sm">
              {resume.dernier.date
                ? new Date(resume.dernier.date).toLocaleDateString(locale(), {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })
                : '—'}
            </span>
            <span className="vkh-kpi-label">{t("Date du relevé")}</span>
          </div>

          {resume.progression != null && resume.progression > 0 && (
            <div className="vkh-kpi kpi-delta">
              <TrendingUp size={16} />
              <span className="vkh-kpi-value">
                +{fmtKm(resume.progression)}
              </span>
              <span className="vkh-kpi-label">{t("Progression page")}</span>
            </div>
          )}

          {sourcesSummary.length > 0 && (
            <div className="vkh-kpi kpi-sources">
              <Activity size={16} />
              <span className="vkh-kpi-value">{sourcesSummary.length}</span>
              <span className="vkh-kpi-label">
                {tp('source (libellé)', sourcesSummary.length)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ERREUR ═══════════════ */}
      {error && (
        <div className="vkh-alert error">
          <Activity size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ═══════════════ LISTE — cartes empilées ═══════════════ */}
      <div className="vkh-section">
        <div className="vkh-section-head">
          <Activity size={14} />
          <span>{t("Relevés kilométriques")}</span>
          <span className="vkh-count">{totalElements}</span>
        </div>

        {rows.length === 0 && !loading && (
          <div className="vkh-empty">
            <Inbox size={24} />
            <p>{t("Aucun relevé enregistré pour ce véhicule.")}</p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="vkh-historique">
            {rows.map((r, idx) => {
              const delta = deltas.get(r.id);
              const SourceIcon = SOURCE_ICONS[r.source] ?? Gauge;
              const d = r.date ? new Date(r.date) : null;

              return (
                <article key={r.id} className="vkh-hist-card">
                  {/* Bloc date */}
                  <div className="vkh-hist-date">
                    <span className="vkh-hist-day">
                      {d ? d.toLocaleDateString(locale(), { day: '2-digit' }) : '—'}
                    </span>
                    <span className="vkh-hist-month">
                      {d ? d.toLocaleDateString(locale(), { month: 'short' }) : ''}
                    </span>
                    <span className="vkh-hist-year">
                      {d ? d.getFullYear() : ''}
                    </span>
                  </div>

                  {/* Contenu */}
                  <div className="vkh-hist-body">
                    <div className="vkh-hist-head">
                      <h4 className="vkh-hist-title">
                        {fmtKm(r.kilometrage)}
                        {idx === 0 && (
                          <span className="vkh-tag" title={t("Relevé le plus récent")}>
                            {t("Récent")}
                          </span>
                        )}
                      </h4>
                      <div className="vkh-hist-tags">
                        <span className={`vkh-source vkh-source-${sourceClass(r.source)}`}>
                          <SourceIcon size={11} strokeWidth={2.6} />
                          {SOURCE_LABELS[r.source] ? t(SOURCE_LABELS[r.source]) : r.source}
                        </span>
                      </div>
                    </div>

                    <div className="vkh-hist-km">
                      <div className="vkh-hist-km-item">
                        <span className="vkh-hist-km-label">{t("Relevé")}</span>
                        <span className="vkh-hist-km-value">
                          {fmtKm(r.kilometrage)}
                        </span>
                      </div>

                      {delta != null && (
                        <div className="vkh-hist-km-item">
                          <span className="vkh-hist-km-label">{t("Variation")}</span>
                          <span className={`vkh-delta ${delta > 0 ? 'is-up' : 'is-flat'}`}>
                            {delta > 0 ? '+' : ''}
                            {fmtKm(delta)}
                          </span>
                        </div>
                      )}

                      {r.sourceId != null && (
                        <div className="vkh-hist-km-item">
                          <span className="vkh-hist-km-label">{t("Référence")}</span>
                          <span className="vkh-ref">#{r.sourceId}</span>
                        </div>
                      )}
                    </div>

                    <div className="vkh-hist-time">
                      <Calendar size={11} />
                      {fmtDate(r.date)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════ PAGINATION BAS ═══════════════ */}
      {totalPages > 1 && (
        <div className="vkh-pagination">
          <button
            type="button"
            className="vkh-btn vkh-btn-ghost"
            disabled={page === 0 || loading}
            onClick={goPrev}
          >
            <ChevronLeft size={15} className="rtl-miroir" /> {t("Précédent")}
          </button>

          <span className="vkh-page-info">
            {t("Page")} <strong>{page + 1}</strong> / {totalPages}
          </span>

          <button
            type="button"
            className="vkh-btn vkh-btn-ghost"
            disabled={page >= totalPages - 1 || loading}
            onClick={goNext}
          >
            {t("Suivant")} <ChevronRight size={15} className="rtl-miroir" />
          </button>
        </div>
      )}
    </section>
  );
}