import React, { useState, useEffect, useCallback, useMemo } from 'react';
import reclamationService from '../../../services/reclamationService';
import { t, tp, locale } from '../../../i18n';
import './ReclamationDashboard.css';
import IndicateursReclamations from './IndicateursReclamations';
import { CircleAlert, CircleCheck, Clock, FileText, GripVertical, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';

const ETAT_LABELS = { 0: 'Ouverte', 1: 'En cours', 2: 'Clôturée'};
const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const MOIS_LABELS = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const STATS_STORAGE_KEY = 'reclamation-dashboard.cards.order.v1';
const CHARTS_STORAGE_KEY = 'reclamation-dashboard.charts.order.v1';

// Mois court : libellés maison en français, noms du calendrier local sinon (جانفي / Jan…)
function formatMoisLabel(cle) {
  const [aaaa, mm] = cle.split('-');
  if (locale() === 'fr-FR') return MOIS_LABELS[mm] || cle;
  const d = new Date(Number(aaaa), Number(mm) - 1, 1);
  if (isNaN(d.getTime())) return cle;
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(d).replace('.', '');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ─── Icônes SVG réutilisables ─── */
const ICONS = {
  total: <FileText size={22} strokeWidth={2} aria-hidden="true" />,
  ouverte: <CircleAlert size={22} strokeWidth={2} aria-hidden="true" />,
  encours: <Clock size={22} strokeWidth={2} aria-hidden="true" />,
  cloturee: <CircleCheck size={22} strokeWidth={2} aria-hidden="true" />,
  attente: <Clock size={22} strokeWidth={2} aria-hidden="true" />,
  rejetee: <X size={22} strokeWidth={2} aria-hidden="true" />,
  alerte: <TriangleAlert size={22} strokeWidth={2} aria-hidden="true" />,
  delai: <Clock size={22} strokeWidth={2} aria-hidden="true" />,
  grip: <GripVertical size={14} strokeWidth={2} aria-hidden="true" />,
};

/* ─── Définition des cartes de stats (ordre par défaut) ─── */
const CARD_DEFS = [
  { id: 'total',    label: 'Total réclamations',         field: 'totalReclamations',          colorClass: 'reclamation-dashboard-stat--neutral',  icon: ICONS.total, featured: true },
  { id: 'ouverte',  label: 'Ouvertes',                    field: 'ouvertes',                   colorClass: 'reclamation-dashboard-stat--ouverte',  icon: ICONS.ouverte },
  { id: 'encours',  label: 'En cours',                    field: 'enCours',                    colorClass: 'reclamation-dashboard-stat--encours',  icon: ICONS.encours },
  { id: 'cloturee', label: 'Clôturées',                   field: 'cloturees',                  colorClass: 'reclamation-dashboard-stat--cloturee', icon: ICONS.cloturee },
  { id: 'alerte',   label: 'Non affectées',               field: 'nonAffectees',               colorClass: 'reclamation-dashboard-stat--alerte',   icon: ICONS.alerte },
  { id: 'delai',    label: 'Délai moyen résolution',      field: 'delaiMoyenResolutionJours',  colorClass: 'reclamation-dashboard-stat--neutral',  icon: ICONS.delai },
];

/* ─── Définition des cartes de graphiques (ordre par défaut) ─── */
const CHART_DEFS = [
  { id: 'mois',   label: 'Réclamations par mois' },
  { id: 'niveau', label: 'Répartition par niveau' },
];

/* ─── Helpers localStorage ─── */
function loadOrder(storageKey, defaults) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const known = new Set(defaults);
    const filtered = parsed.filter((id) => known.has(id));
    defaults.forEach((id) => { if (!filtered.includes(id)) filtered.push(id); });
    return filtered;
  } catch {
    return defaults;
  }
}

function saveOrder(storageKey, order) {
  try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch { /* ignore */ }
}

/* ─── Carte de stat draggable ─── */
function StatCard({ def, value, dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver }) {
  const displayValue = def.id === 'delai' && value != null
    ? t('{n} j', { n: Number(value).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
    : (value ?? '—');

  return (
    <div
      className={`reclamation-dashboard-stat-card ${def.colorClass} ${def.featured ? 'reclamation-dashboard-stat-card--featured' : ''} ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="reclamation-dashboard-stat-drag-handle" title={t("Glisser pour réorganiser")} aria-hidden="true">
        {ICONS.grip}
      </div>
      <div className="reclamation-dashboard-stat-icon">{def.icon}</div>
      <div className="reclamation-dashboard-stat-body">
        <div className="reclamation-dashboard-stat-value">{displayValue}</div>
        <div className="reclamation-dashboard-stat-label">{t(def.label)}</div>
      </div>
    </div>
  );
}

/* ─── Wrapper draggable pour les graphiques ─── */
function DraggableChart({ dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver, children }) {
  return (
    <div
      className={`reclamation-dashboard-chart-drag-wrap ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="reclamation-dashboard-chart-drag-handle" title={t("Glisser pour échanger")} aria-hidden="true">
        {ICONS.grip}
      </div>
      {children}
    </div>
  );
}

export default function ReclamationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ordre des cartes de stats
  const [order, setOrder] = useState(() => loadOrder(STATS_STORAGE_KEY, CARD_DEFS.map((c) => c.id)));
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Ordre des cartes de graphiques
  const [chartOrder, setChartOrder] = useState(() => loadOrder(CHARTS_STORAGE_KEY, CHART_DEFS.map((c) => c.id)));
  const [draggedChartId, setDraggedChartId] = useState(null);
  const [dragOverChartId, setDragOverChartId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const dashboard = await reclamationService.getDashboard();
        setData(dashboard);
      } catch (err) {
        console.error(err);
        setError(t("Impossible de charger le dashboard. Vérifie que le serveur est bien lancé."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => { saveOrder(STATS_STORAGE_KEY, order); }, [order]);
  useEffect(() => { saveOrder(CHARTS_STORAGE_KEY, chartOrder); }, [chartOrder]);

  /* ─── Drag & drop : cartes de stats ─── */
  const handleDragStart = (id) => (e) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', `stat:${id}`); } catch { /* ignore */ }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDragEnter = (id) => () => {
    if (id !== draggedId) setDragOverId(id);
  };

  const handleDragEnd = () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      setOrder((prev) => {
        const next = [...prev];
        const from = next.indexOf(draggedId);
        const to = next.indexOf(dragOverId);
        if (from === -1 || to === -1) return prev;
        next.splice(from, 1);
        next.splice(to, 0, draggedId);
        return next;
      });
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  /* ─── Drag & drop : cartes de graphiques ─── */
  const handleChartDragStart = (id) => (e) => {
    setDraggedChartId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', `chart:${id}`); } catch { /* ignore */ }
  };

  const handleChartDragEnter = (id) => () => {
    if (id !== draggedChartId) setDragOverChartId(id);
  };

  const handleChartDragEnd = () => {
    if (draggedChartId && dragOverChartId && draggedChartId !== dragOverChartId) {
      setChartOrder((prev) => {
        const next = [...prev];
        const from = next.indexOf(draggedChartId);
        const to = next.indexOf(dragOverChartId);
        if (from === -1 || to === -1) return prev;
        next.splice(from, 1);
        next.splice(to, 0, draggedChartId);
        return next;
      });
    }
    setDraggedChartId(null);
    setDragOverChartId(null);
  };

  const resetOrder = useCallback(() => {
    setOrder(CARD_DEFS.map((c) => c.id));
    setChartOrder(CHART_DEFS.map((c) => c.id));
  }, []);

  const cardsById = useMemo(() => {
    const map = {};
    CARD_DEFS.forEach((c) => { map[c.id] = c; });
    return map;
  }, []);

  if (loading) {
    return (
      <div className="reclamation-dashboard-container">
        <div className="reclamation-dashboard-loading">
          <div className="reclamation-dashboard-spinner" />
          <p>{t("Chargement du dashboard...")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="reclamation-dashboard-container"><p className="reclamation-dashboard-error">{error || t("Aucune donnée disponible.")}</p></div>;
  }

  const moisEntries = Object.entries(data.parMois || {});
  const maxMois = Math.max(1, ...moisEntries.map(([, v]) => v));

  const criticiteEntries = [1, 2, 3].map((niveau) => [niveau, data.parCriticite?.[niveau] ?? 0]);
  const urgenceEntries = [1, 2, 3].map((niveau) => [niveau, data.parUrgence?.[niveau] ?? 0]);
  const maxNiveau = Math.max(1, ...criticiteEntries.map(([, v]) => v), ...urgenceEntries.map(([, v]) => v));

  const totalCriticite = criticiteEntries.reduce((s, [, v]) => s + v, 0);
  const totalUrgence = urgenceEntries.reduce((s, [, v]) => s + v, 0);

  /* ─── Rendu de chaque graphique ─── */
  const renderChart = (id) => {
    if (id === 'mois') {
      return (
        <div className="reclamation-dashboard-chart-card">
          <div className="reclamation-dashboard-chart-head">
            <h3>{t("Réclamations par mois")}</h3>
            <span className="reclamation-dashboard-chart-sub">{t("12 derniers mois")}</span>
          </div>
          <div className="reclamation-dashboard-bar-chart">
            {moisEntries.map(([cle, valeur]) => (
              <div key={cle} className="reclamation-dashboard-bar-col">
                <div className="reclamation-dashboard-bar-value">{valeur > 0 ? valeur : ''}</div>
                <div
                  className="reclamation-dashboard-bar"
                  style={{ height: `${Math.max(4, (valeur / maxMois) * 100)}%` }}
                  title={`${formatMoisLabel(cle)} : ${valeur}`}
                />
                <div className="reclamation-dashboard-bar-label">{formatMoisLabel(cle)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (id === 'niveau') {
      return (
        <div className="reclamation-dashboard-chart-card">
          <div className="reclamation-dashboard-chart-head">
            <h3>{t("Répartition par niveau")}</h3>
            <span className="reclamation-dashboard-chart-sub">{t("Criticité & urgence")}</span>
          </div>

          <div className="reclamation-dashboard-niveau-section">
            <div className="reclamation-dashboard-niveau-title">
              <span>{t("Criticité")}</span>
              <span className="reclamation-dashboard-niveau-total">{totalCriticite}</span>
            </div>
            <div className="reclamation-dashboard-hbar-list">
              {criticiteEntries.filter(([, valeur]) => valeur > 0).map(([niveau, valeur]) => (
                <div key={niveau} className="reclamation-dashboard-hbar-row">
                  <span className="reclamation-dashboard-hbar-label">{t(NIVEAU_LABELS[niveau])}</span>
                  <div className="reclamation-dashboard-hbar-track">
                    <div
                      className={`reclamation-dashboard-hbar-fill reclamation-dashboard-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxNiveau) * 100)}%` }}
                    />
                  </div>
                  <span className="reclamation-dashboard-hbar-value">{valeur}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reclamation-dashboard-niveau-section">
            <div className="reclamation-dashboard-niveau-title">
              <span>{t("Urgence")}</span>
              <span className="reclamation-dashboard-niveau-total">{totalUrgence}</span>
            </div>
            <div className="reclamation-dashboard-hbar-list">
              {urgenceEntries.filter(([, valeur]) => valeur > 0).map(([niveau, valeur]) => (
                <div key={niveau} className="reclamation-dashboard-hbar-row">
                  <span className="reclamation-dashboard-hbar-label">{t(NIVEAU_LABELS[niveau])}</span>
                  <div className="reclamation-dashboard-hbar-track">
                    <div
                      className={`reclamation-dashboard-hbar-fill reclamation-dashboard-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxNiveau) * 100)}%` }}
                    />
                  </div>
                  <span className="reclamation-dashboard-hbar-value">{valeur}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="reclamation-dashboard-container">
      {/* Header */}
      <div className="reclamation-dashboard-header">
        <div className="reclamation-dashboard-header-icon-wrap">
          <ICONES_MODULES.tableauDeBord size={22} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="reclamation-dashboard-header-text">
          <h1>{t("Tableau de Bord des Réclamations")}</h1>
          <p>{t("Vue d'ensemble et indicateurs clés — glisse les cartes pour les réorganiser")}</p>
        </div>
        <button
          type="button"
          className="reclamation-dashboard-reset-order"
          onClick={resetOrder}
          title={t("Rétablir l'ordre par défaut")}
        >
          <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" />
          {t("Réinitialiser l'ordre")}
        </button>
      </div>

      {/* Cartes de stats (drag & drop) */}
      <div className="reclamation-dashboard-stats-grid">
        {order.map((id) => {
          const def = cardsById[id];
          if (!def) return null;
          const rawValue = data[def.field];
          if (rawValue == null || Number(rawValue) === 0) return null; // valeur à 0 : carte masquée
          return (
            <StatCard
              key={id}
              def={def}
              value={rawValue}
              dragging={draggedId === id}
              dragOver={dragOverId === id}
              onDragStart={handleDragStart(id)}
              onDragEnter={handleDragEnter(id)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </div>

      {/* Indicateurs de performance (30 j vs 30 j précédents, délais, conversion, classements) */}
      <IndicateursReclamations />

      {/* Graphiques (drag & drop) — la grille s'adapte à l'ordre */}
      <div className={`reclamation-dashboard-charts-row ${chartOrder[0] === 'niveau' ? 'is-swapped' : ''}`}>
        {chartOrder.map((id) => (
          <DraggableChart
            key={id}
            dragging={draggedChartId === id}
            dragOver={dragOverChartId === id}
            onDragStart={handleChartDragStart(id)}
            onDragEnter={handleChartDragEnter(id)}
            onDragOver={handleDragOver}
            onDragEnd={handleChartDragEnd}
          >
            {renderChart(id)}
          </DraggableChart>
        ))}
      </div>

      {/* Réclamations récentes */}
      <div className="reclamation-dashboard-recent-card">
        <div className="reclamation-dashboard-chart-head">
          <h3>{t("Réclamations récentes")}</h3>
          {data.reclamationsRecentes?.length > 0 && (
            <span className="reclamation-dashboard-chart-sub">{t('{n} dernières', { n: data.reclamationsRecentes.length })}</span>
          )}
        </div>

        {(!data.reclamationsRecentes || data.reclamationsRecentes.length === 0) ? (
          <p className="reclamation-dashboard-empty">{t("Aucune réclamation pour l'instant.")}</p>
        ) : (
          <div className="reclamation-dashboard-table-wrap">
            <table className="reclamation-dashboard-table">
              <thead>
                <tr>
                  <th>{t("Numéro")}</th>
                  <th>{t("Description")}</th>
                  <th>{t("Criticité")}</th>
                  <th>{t("Urgence")}</th>
                  <th>{t("Date")}</th>
                  <th>{t("État")}</th>
                </tr>
              </thead>
              <tbody>
                {data.reclamationsRecentes.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.num || `#${r.id}`}</td>
                    <td className="reclamation-dashboard-desc-cell">{r.description}</td>
                    <td>
                      <span className={`reclamation-dashboard-niveau-badge reclamation-dashboard-niveau-badge--${r.criticite}`}>
                        {NIVEAU_LABELS[r.criticite] ? t(NIVEAU_LABELS[r.criticite]) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`reclamation-dashboard-niveau-badge reclamation-dashboard-niveau-badge--${r.urgence}`}>
                        {NIVEAU_LABELS[r.urgence] ? t(NIVEAU_LABELS[r.urgence]) : '—'}
                      </span>
                    </td>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <span className={`reclamation-dashboard-etat-badge reclamation-dashboard-etat-badge--${r.etat}`}>
                        {ETAT_LABELS[r.etat] ? t(ETAT_LABELS[r.etat]) : t('État {n}', { n: r.etat })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}