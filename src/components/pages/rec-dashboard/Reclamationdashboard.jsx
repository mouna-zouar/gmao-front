import React, { useState, useEffect, useCallback, useMemo } from 'react';
import reclamationService from '../../../services/reclamationService';
import './ReclamationDashboard.css';

const ETAT_LABELS = { 0: 'Ouverte', 1: 'En cours', 2: 'Clôturée', 3: 'En attente de validation', 4: 'Rejetée' };
const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const MOIS_LABELS = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const STATS_STORAGE_KEY = 'rdash.cards.order.v1';
const CHARTS_STORAGE_KEY = 'rdash.charts.order.v1';

function formatMoisLabel(cle) {
  const [, mm] = cle.split('-');
  return MOIS_LABELS[mm] || cle;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ─── Icônes SVG réutilisables ─── */
const ICONS = {
  total: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  ouverte: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>,
  encours: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  cloturee: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  attente: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  rejetee: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>,
  alerte: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
  delai: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  grip: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>,
};

/* ─── Définition des cartes de stats (ordre par défaut) ─── */
const CARD_DEFS = [
  { id: 'total',    label: 'Total réclamations',         field: 'totalReclamations',          colorClass: 'rdash-stat--neutral',  icon: ICONS.total, featured: true },
  { id: 'ouverte',  label: 'Ouvertes',                    field: 'ouvertes',                   colorClass: 'rdash-stat--ouverte',  icon: ICONS.ouverte },
  { id: 'encours',  label: 'En cours',                    field: 'enCours',                    colorClass: 'rdash-stat--encours',  icon: ICONS.encours },
  { id: 'cloturee', label: 'Clôturées',                   field: 'cloturees',                  colorClass: 'rdash-stat--cloturee', icon: ICONS.cloturee },
  { id: 'attente',  label: 'En attente de validation',    field: 'enAttenteValidation',        colorClass: 'rdash-stat--attente',  icon: ICONS.attente },
  { id: 'rejetee',  label: 'Rejetées',                    field: 'rejetees',                   colorClass: 'rdash-stat--rejetee',  icon: ICONS.rejetee },
  { id: 'alerte',   label: 'Non affectées',               field: 'nonAffectees',               colorClass: 'rdash-stat--alerte',   icon: ICONS.alerte },
  { id: 'delai',    label: 'Délai moyen résolution',      field: 'delaiMoyenResolutionJours',  colorClass: 'rdash-stat--neutral',  icon: ICONS.delai },
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
    ? `${Number(value).toFixed(1)} j`
    : (value ?? '—');

  return (
    <div
      className={`rdash-stat-card ${def.colorClass} ${def.featured ? 'rdash-stat-card--featured' : ''} ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="rdash-stat-drag-handle" title="Glisser pour réorganiser" aria-hidden="true">
        {ICONS.grip}
      </div>
      <div className="rdash-stat-icon">{def.icon}</div>
      <div className="rdash-stat-body">
        <div className="rdash-stat-value">{displayValue}</div>
        <div className="rdash-stat-label">{def.label}</div>
      </div>
    </div>
  );
}

/* ─── Wrapper draggable pour les graphiques ─── */
function DraggableChart({ dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver, children }) {
  return (
    <div
      className={`rdash-chart-drag-wrap ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="rdash-chart-drag-handle" title="Glisser pour échanger" aria-hidden="true">
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
        setError('Impossible de charger le dashboard. Vérifie que le serveur est bien lancé.');
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
      <div className="rdash-container">
        <div className="rdash-loading">
          <div className="rdash-spinner" />
          <p>Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="rdash-container"><p className="rdash-error">{error || 'Aucune donnée disponible.'}</p></div>;
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
        <div className="rdash-chart-card">
          <div className="rdash-chart-head">
            <h3>Réclamations par mois</h3>
            <span className="rdash-chart-sub">12 derniers mois</span>
          </div>
          <div className="rdash-bar-chart">
            {moisEntries.map(([cle, valeur]) => (
              <div key={cle} className="rdash-bar-col">
                <div className="rdash-bar-value">{valeur > 0 ? valeur : ''}</div>
                <div
                  className="rdash-bar"
                  style={{ height: `${Math.max(4, (valeur / maxMois) * 100)}%` }}
                  title={`${formatMoisLabel(cle)} : ${valeur}`}
                />
                <div className="rdash-bar-label">{formatMoisLabel(cle)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (id === 'niveau') {
      return (
        <div className="rdash-chart-card">
          <div className="rdash-chart-head">
            <h3>Répartition par niveau</h3>
            <span className="rdash-chart-sub">Criticité & urgence</span>
          </div>

          <div className="rdash-niveau-section">
            <div className="rdash-niveau-title">
              <span>Criticité</span>
              <span className="rdash-niveau-total">{totalCriticite}</span>
            </div>
            <div className="rdash-hbar-list">
              {criticiteEntries.map(([niveau, valeur]) => (
                <div key={niveau} className="rdash-hbar-row">
                  <span className="rdash-hbar-label">{NIVEAU_LABELS[niveau]}</span>
                  <div className="rdash-hbar-track">
                    <div
                      className={`rdash-hbar-fill rdash-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxNiveau) * 100)}%` }}
                    />
                  </div>
                  <span className="rdash-hbar-value">{valeur}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rdash-niveau-section">
            <div className="rdash-niveau-title">
              <span>Urgence</span>
              <span className="rdash-niveau-total">{totalUrgence}</span>
            </div>
            <div className="rdash-hbar-list">
              {urgenceEntries.map(([niveau, valeur]) => (
                <div key={niveau} className="rdash-hbar-row">
                  <span className="rdash-hbar-label">{NIVEAU_LABELS[niveau]}</span>
                  <div className="rdash-hbar-track">
                    <div
                      className={`rdash-hbar-fill rdash-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxNiveau) * 100)}%` }}
                    />
                  </div>
                  <span className="rdash-hbar-value">{valeur}</span>
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
    <div className="rdash-container">
      {/* Header */}
      <div className="rdash-header">
        <div className="rdash-header-icon-wrap">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div className="rdash-header-text">
          <h1>Tableau de Bord des Réclamations</h1>
          <p>Vue d'ensemble et indicateurs clés — glisse les cartes pour les réorganiser</p>
        </div>
        <button
          type="button"
          className="rdash-reset-order"
          onClick={resetOrder}
          title="Rétablir l'ordre par défaut"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Réinitialiser l'ordre
        </button>
      </div>

      {/* Cartes de stats (drag & drop) */}
      <div className="rdash-stats-grid">
        {order.map((id) => {
          const def = cardsById[id];
          if (!def) return null;
          const rawValue = data[def.field];
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

      {/* Graphiques (drag & drop) — la grille s'adapte à l'ordre */}
      <div className={`rdash-charts-row ${chartOrder[0] === 'niveau' ? 'is-swapped' : ''}`}>
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
      <div className="rdash-recent-card">
        <div className="rdash-chart-head">
          <h3>Réclamations récentes</h3>
          {data.reclamationsRecentes?.length > 0 && (
            <span className="rdash-chart-sub">{data.reclamationsRecentes.length} dernières</span>
          )}
        </div>

        {(!data.reclamationsRecentes || data.reclamationsRecentes.length === 0) ? (
          <p className="rdash-empty">Aucune réclamation pour l'instant.</p>
        ) : (
          <div className="rdash-table-wrap">
            <table className="rdash-table">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Description</th>
                  <th>Criticité</th>
                  <th>Urgence</th>
                  <th>Date</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {data.reclamationsRecentes.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.num || `#${r.id}`}</td>
                    <td className="rdash-desc-cell">{r.description}</td>
                    <td>
                      <span className={`rdash-niveau-badge rdash-niveau-badge--${r.criticite}`}>
                        {NIVEAU_LABELS[r.criticite] || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`rdash-niveau-badge rdash-niveau-badge--${r.urgence}`}>
                        {NIVEAU_LABELS[r.urgence] || '—'}
                      </span>
                    </td>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <span className={`rdash-etat-badge rdash-etat-badge--${r.etat}`}>
                        {ETAT_LABELS[r.etat] || `État ${r.etat}`}
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