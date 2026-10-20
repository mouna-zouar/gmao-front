import React, { useState, useEffect, useCallback, useMemo } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import { t, tp, locale } from '../../../i18n';
import './BonMaintenanceDashboard.css';
import IndicateursBons from './IndicateursBons';
import { CircleCheck, CirclePause, Clock, Coins, FileText, GripVertical, RefreshCw, TriangleAlert } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const MOIS_LABELS = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const STATS_STORAGE_KEY = 'bon-maintenance-dashboard.cards.order.v1';
const CHARTS_STORAGE_KEY = 'bon-maintenance-dashboard.charts.order.v1';

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
  encours: <Clock size={22} strokeWidth={2} aria-hidden="true" />,
  suspendu: <CirclePause size={22} strokeWidth={2} aria-hidden="true" />,
  effectue: <CircleCheck size={22} strokeWidth={2} aria-hidden="true" />,
  alerte: <TriangleAlert size={22} strokeWidth={2} aria-hidden="true" />,
  cout: <Coins size={22} strokeWidth={2} aria-hidden="true" />,
  delai: <Clock size={22} strokeWidth={2} aria-hidden="true" />,
  grip: <GripVertical size={14} strokeWidth={2} aria-hidden="true" />,
};

/* ─── Définition des cartes de stats ─── */
const CARD_DEFS = [
  { id: 'total',    label: 'Total bons',                    field: 'totalBons',                  colorClass: 'bon-maintenance-dashboard-stat--neutral',  icon: ICONS.total,    featured: true },
  { id: 'encours',  label: 'En cours',                      field: 'parEtat.3',                  colorClass: 'bon-maintenance-dashboard-stat--encours',  icon: ICONS.encours },
  { id: 'suspendu', label: 'Suspendus',                     field: 'parEtat.2',                  colorClass: 'bon-maintenance-dashboard-stat--suspendu', icon: ICONS.suspendu },
  { id: 'effectue', label: 'Effectués',                     field: 'parEtat.4',                  colorClass: 'bon-maintenance-dashboard-stat--effectue', icon: ICONS.effectue },
  { id: 'alerte',   label: 'Arrêts obligatoires en cours',  field: 'arretsObligatoiresEnCours',  colorClass: 'bon-maintenance-dashboard-stat--alerte',   icon: ICONS.alerte },
  { id: 'cout',     label: 'Coût total cumulé',             field: 'coutTotalCumule',            colorClass: 'bon-maintenance-dashboard-stat--neutral',  icon: ICONS.cout,     unit: 'DT',   decimals: 0 },
  { id: 'delai',    label: 'Délai moyen résolution',        field: 'delaiMoyenResolutionJours',  colorClass: 'bon-maintenance-dashboard-stat--neutral',  icon: ICONS.delai,    unit: 'j',    decimals: 1 },
];

/* ─── Définition des cartes de graphiques ─── */
const CHART_DEFS = [
  { id: 'mois',  label: 'Bons créés par mois' },
  { id: 'etats', label: 'Par état / urgence' },
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

/* ─── Accès valeur imbriquée ─── */
function getFieldValue(data, field) {
  if (!data || !field) return undefined;
  return field.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

/* ─── Carte de stat draggable ─── */
function StatCard({ def, value, dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver }) {
  let displayValue = value ?? '—';

  if (value != null && def.unit) {
    const n = Number(value).toLocaleString(locale(), def.decimals != null
      ? { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals }
      : undefined);
    // Unités traduites : DT / د.ت / TND et j / يوم / d
    displayValue = def.unit === 'DT' ? t('{montant} DT', { montant: n }) : t('{n} j', { n });
  }

  return (
    <div
      className={`bon-maintenance-dashboard-stat-card ${def.colorClass} ${def.featured ? 'bon-maintenance-dashboard-stat-card--featured' : ''} ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="bon-maintenance-dashboard-stat-drag-handle" title={t("Glisser pour réorganiser")} aria-hidden="true">
        {ICONS.grip}
      </div>
      <div className="bon-maintenance-dashboard-stat-icon">{def.icon}</div>
      <div className="bon-maintenance-dashboard-stat-body">
        <div className="bon-maintenance-dashboard-stat-value">{displayValue}</div>
        <div className="bon-maintenance-dashboard-stat-label">{t(def.label)}</div>
      </div>
    </div>
  );
}

/* ─── Wrapper draggable pour les graphiques ─── */
function DraggableChart({ dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver, children }) {
  return (
    <div
      className={`bon-maintenance-dashboard-chart-drag-wrap ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="bon-maintenance-dashboard-chart-drag-handle" title={t("Glisser pour échanger")} aria-hidden="true">
        {ICONS.grip}
      </div>
      {children}
    </div>
  );
}

export default function BonMaintenanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [order, setOrder] = useState(() => loadOrder(STATS_STORAGE_KEY, CARD_DEFS.map((c) => c.id)));
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [chartOrder, setChartOrder] = useState(() => loadOrder(CHARTS_STORAGE_KEY, CHART_DEFS.map((c) => c.id)));
  const [draggedChartId, setDraggedChartId] = useState(null);
  const [dragOverChartId, setDragOverChartId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const dashboard = await bonMaintenanceService.getDashboard();
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
      <div className="bon-maintenance-dashboard-container">
        <div className="bon-maintenance-dashboard-loading">
          <p>{t("Chargement du dashboard...")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bon-maintenance-dashboard-container">
        <p className="bon-maintenance-dashboard-error">{error || t("Aucune donnée disponible.")}</p>
      </div>
    );
  }

  const moisEntries = Object.entries(data.parMois || {});
  const maxMois = Math.max(1, ...moisEntries.map(([, v]) => v));

  const etats = [1, 2, 3, 4, 10];
  const maxEtat = Math.max(1, ...etats.map((e) => data.parEtat?.[e] ?? 0));

  const urgenceEntries = [1, 2, 3].map((niveau) => [niveau, data.parUrgence?.[niveau] ?? 0]);
  const maxUrgence = Math.max(1, ...urgenceEntries.map(([, v]) => v));

  const renderChart = (id) => {
    if (id === 'mois') {
      return (
        <div className="bon-maintenance-dashboard-chart-card">
          <div className="bon-maintenance-dashboard-chart-head">
            <h3>{t("Bons créés par mois")}</h3>
            <span className="bon-maintenance-dashboard-chart-sub">{t("12 derniers mois")}</span>
          </div>
          <div className="bon-maintenance-dashboard-bar-chart">
            {moisEntries.map(([cle, valeur]) => (
              <div key={cle} className="bon-maintenance-dashboard-bar-col">
                <div className="bon-maintenance-dashboard-bar-value">{valeur > 0 ? valeur : ''}</div>
                <div
                  className="bon-maintenance-dashboard-bar"
                  style={{ height: `${Math.max(4, (valeur / maxMois) * 100)}%` }}
                  title={`${formatMoisLabel(cle)} : ${valeur}`}
                />
                <div className="bon-maintenance-dashboard-bar-label">{formatMoisLabel(cle)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (id === 'etats') {
      return (
        <div className="bon-maintenance-dashboard-chart-card">
          <div className="bon-maintenance-dashboard-chart-head">
            <h3>{t("Répartition")}</h3>
            <span className="bon-maintenance-dashboard-chart-sub">{t("État & urgence")}</span>
          </div>

          <div className="bon-maintenance-dashboard-niveau-section">
            <div className="bon-maintenance-dashboard-niveau-title">
              <span>{t("Par état")}</span>
            </div>
            <div className="bon-maintenance-dashboard-hbar-list">
              {etats.filter((etat) => (data.parEtat?.[etat] ?? 0) > 0).map((etat) => (
                <div key={etat} className="bon-maintenance-dashboard-hbar-row">
                  <span className="bon-maintenance-dashboard-hbar-label">{t(ETAT_LABELS[etat])}</span>
                  <div className="bon-maintenance-dashboard-hbar-track">
                    <div
                      className={`bon-maintenance-dashboard-hbar-fill bon-maintenance-dashboard-hbar-fill--etat${etat}`}
                      style={{ width: `${Math.max(2, ((data.parEtat?.[etat] ?? 0) / maxEtat) * 100)}%` }}
                    />
                  </div>
                  <span className="bon-maintenance-dashboard-hbar-value">{data.parEtat?.[etat] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bon-maintenance-dashboard-niveau-section">
            <div className="bon-maintenance-dashboard-niveau-title">
              <span>{t("Par urgence")}</span>
            </div>
            <div className="bon-maintenance-dashboard-hbar-list">
              {urgenceEntries.filter(([, valeur]) => valeur > 0).map(([niveau, valeur]) => (
                <div key={niveau} className="bon-maintenance-dashboard-hbar-row">
                  <span className="bon-maintenance-dashboard-hbar-label">{t(NIVEAU_LABELS[niveau])}</span>
                  <div className="bon-maintenance-dashboard-hbar-track">
                    <div
                      className={`bon-maintenance-dashboard-hbar-fill bon-maintenance-dashboard-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxUrgence) * 100)}%` }}
                    />
                  </div>
                  <span className="bon-maintenance-dashboard-hbar-value">{valeur}</span>
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
    <div className="bon-maintenance-dashboard-container">
      {/* Header */}
      <div className="bon-maintenance-dashboard-header">
        <div className="bon-maintenance-dashboard-header-icon-wrap">
          <ICONES_MODULES.tableauDeBord size={24} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="bon-maintenance-dashboard-header-text">
          <h1>{t("Tableau de Bord des Bons de Maintenance")}</h1>
          <p>{t("Vue d'ensemble et indicateurs clés — glisse les cartes pour les réorganiser")}</p>
        </div>
        <button
          type="button"
          className="bon-maintenance-dashboard-reset-order"
          onClick={resetOrder}
          title={t("Rétablir l'ordre par défaut")}
        >
          <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" />
          {t("Réinitialiser l'ordre")}
        </button>
      </div>

      {/* Cartes de stats */}
      <div className="bon-maintenance-dashboard-stats-grid">
        {order.map((id) => {
          const def = cardsById[id];
          if (!def) return null;
          const rawValue = getFieldValue(data, def.field);
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

      {/* Indicateurs de performance (30 j vs 30 j précédents, SLA, coûts, classements) */}
      <IndicateursBons />

      {/* Graphiques */}
      <div className="bon-maintenance-dashboard-charts-row">
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

      {/* Bons récents */}
      <div className="bon-maintenance-dashboard-recent-card">
        <div className="bon-maintenance-dashboard-chart-head">
          <h3>{t("Bons de maintenance récents")}</h3>
          {data.bonsRecents?.length > 0 && (
            <span className="bon-maintenance-dashboard-chart-sub">{t('{n} derniers', { n: data.bonsRecents.length })}</span>
          )}
        </div>

        {(!data.bonsRecents || data.bonsRecents.length === 0) ? (
          <p className="bon-maintenance-dashboard-empty">{t("Aucun bon de maintenance pour l'instant.")}</p>
        ) : (
          <div className="bon-maintenance-dashboard-table-wrap">
            <table className="bon-maintenance-dashboard-table">
              <thead>
                <tr>
                  <th>{t("Numéro")}</th>
                  <th>{t("Titre")}</th>
                  <th>{t("Prestataire")}</th>
                  <th>{t("Service")}</th>
                  <th>{t("Urgence")}</th>
                  <th>{t("Date")}</th>
                  <th>{t("État")}</th>
                </tr>
              </thead>
              <tbody>
                {data.bonsRecents.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.num || `#${b.id}`}</td>
                    <td className="bon-maintenance-dashboard-desc-cell">{b.titre}</td>
                    <td>{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td>
                    <td>{b.serviceNom || b.service?.description || '—'}</td>
                    <td>
                      <span className={`bon-maintenance-dashboard-niveau-badge bon-maintenance-dashboard-niveau-badge--${b.urgence}`}>
                        {NIVEAU_LABELS[b.urgence] ? t(NIVEAU_LABELS[b.urgence]) : '—'}
                      </span>
                    </td>
                    <td>{formatDate(b.dateCreation)}</td>
                    <td>
                      <span className={`bon-maintenance-dashboard-etat-badge bon-maintenance-dashboard-etat-badge--${b.etat}`}>
                        {ETAT_LABELS[b.etat] ? t(ETAT_LABELS[b.etat]) : t('État {n}', { n: b.etat })}
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