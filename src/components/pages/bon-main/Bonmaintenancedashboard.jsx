import React, { useState, useEffect, useCallback, useMemo } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import './BonMaintenanceDashboard.css';

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const MOIS_LABELS = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const STATS_STORAGE_KEY = 'bmdash.cards.order.v1';
const CHARTS_STORAGE_KEY = 'bmdash.charts.order.v1';

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
  encours: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  suspendu: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  effectue: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  alerte: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
  cout: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  delai: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  grip: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>,
};

/* ─── Définition des cartes de stats (ordre par défaut) ─── */
const CARD_DEFS = [
  { id: 'total',    label: 'Total bons',                    field: 'totalBons',                  colorClass: 'bmdash-stat--neutral',  icon: ICONS.total,    featured: true },
  { id: 'encours',  label: 'En cours',                      field: 'parEtat.3',                  colorClass: 'bmdash-stat--encours',  icon: ICONS.encours },
  { id: 'suspendu', label: 'Suspendus',                     field: 'parEtat.2',                  colorClass: 'bmdash-stat--suspendu', icon: ICONS.suspendu },
  { id: 'effectue', label: 'Effectués',                     field: 'parEtat.4',                  colorClass: 'bmdash-stat--effectue', icon: ICONS.effectue },
  { id: 'alerte',   label: 'Arrêts obligatoires en cours',  field: 'arretsObligatoiresEnCours',  colorClass: 'bmdash-stat--alerte',   icon: ICONS.alerte },
  { id: 'cout',     label: 'Coût total cumulé',             field: 'coutTotalCumule',            colorClass: 'bmdash-stat--neutral',  icon: ICONS.cout,     unit: 'DT',   decimals: 0 },
  { id: 'delai',    label: 'Délai moyen résolution',        field: 'delaiMoyenResolutionJours',  colorClass: 'bmdash-stat--neutral',  icon: ICONS.delai,    unit: 'j',    decimals: 1 },
];

/* ─── Définition des cartes de graphiques (ordre par défaut) ─── */
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

/* ─── Accès valeur imbriquée (ex: "parEtat.3") ─── */
function getFieldValue(data, field) {
  if (!data || !field) return undefined;
  return field.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
}

/* ─── Carte de stat draggable ─── */
function StatCard({ def, value, dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver }) {
  let displayValue = value ?? '—';

  if (value != null && def.unit) {
    const num = Number(value);
    displayValue = def.decimals != null
      ? `${num.toFixed(def.decimals)} ${def.unit}`
      : `${num} ${def.unit}`;
  }

  return (
    <div
      className={`bmdash-stat-card ${def.colorClass} ${def.featured ? 'bmdash-stat-card--featured' : ''} ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="bmdash-stat-drag-handle" title="Glisser pour réorganiser" aria-hidden="true">
        {ICONS.grip}
      </div>
      <div className="bmdash-stat-icon">{def.icon}</div>
      <div className="bmdash-stat-body">
        <div className="bmdash-stat-value">{displayValue}</div>
        <div className="bmdash-stat-label">{def.label}</div>
      </div>
    </div>
  );
}

/* ─── Wrapper draggable pour les graphiques ─── */
function DraggableChart({ dragging, dragOver, onDragStart, onDragEnter, onDragEnd, onDragOver, children }) {
  return (
    <div
      className={`bmdash-chart-drag-wrap ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="bmdash-chart-drag-handle" title="Glisser pour échanger" aria-hidden="true">
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
      <div className="bmdash-container">
        <div className="bmdash-loading">
          <p>Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bmdash-container">
        <p className="bmdash-error">{error || 'Aucune donnée disponible.'}</p>
      </div>
    );
  }

  const moisEntries = Object.entries(data.parMois || {});
  const maxMois = Math.max(1, ...moisEntries.map(([, v]) => v));

  const etats = [1, 2, 3, 4, 10];
  const maxEtat = Math.max(1, ...etats.map((e) => data.parEtat?.[e] ?? 0));

  const urgenceEntries = [1, 2, 3].map((niveau) => [niveau, data.parUrgence?.[niveau] ?? 0]);
  const maxUrgence = Math.max(1, ...urgenceEntries.map(([, v]) => v));

  /* ─── Rendu de chaque graphique ─── */
  const renderChart = (id) => {
    if (id === 'mois') {
      return (
        <div className="bmdash-chart-card">
          <div className="bmdash-chart-head">
            <h3>Bons créés par mois</h3>
            <span className="bmdash-chart-sub">12 derniers mois</span>
          </div>
          <div className="bmdash-bar-chart">
            {moisEntries.map(([cle, valeur]) => (
              <div key={cle} className="bmdash-bar-col">
                <div className="bmdash-bar-value">{valeur > 0 ? valeur : ''}</div>
                <div
                  className="bmdash-bar"
                  style={{ height: `${Math.max(4, (valeur / maxMois) * 100)}%` }}
                  title={`${formatMoisLabel(cle)} : ${valeur}`}
                />
                <div className="bmdash-bar-label">{formatMoisLabel(cle)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (id === 'etats') {
      return (
        <div className="bmdash-chart-card">
          <div className="bmdash-chart-head">
            <h3>Répartition</h3>
            <span className="bmdash-chart-sub">État & urgence</span>
          </div>

          <div className="bmdash-niveau-section">
            <div className="bmdash-niveau-title">
              <span>Par état</span>
            </div>
            <div className="bmdash-hbar-list">
              {etats.map((etat) => (
                <div key={etat} className="bmdash-hbar-row">
                  <span className="bmdash-hbar-label">{ETAT_LABELS[etat]}</span>
                  <div className="bmdash-hbar-track">
                    <div
                      className={`bmdash-hbar-fill bmdash-hbar-fill--etat${etat}`}
                      style={{ width: `${Math.max(2, ((data.parEtat?.[etat] ?? 0) / maxEtat) * 100)}%` }}
                    />
                  </div>
                  <span className="bmdash-hbar-value">{data.parEtat?.[etat] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bmdash-niveau-section">
            <div className="bmdash-niveau-title">
              <span>Par urgence</span>
            </div>
            <div className="bmdash-hbar-list">
              {urgenceEntries.map(([niveau, valeur]) => (
                <div key={niveau} className="bmdash-hbar-row">
                  <span className="bmdash-hbar-label">{NIVEAU_LABELS[niveau]}</span>
                  <div className="bmdash-hbar-track">
                    <div
                      className={`bmdash-hbar-fill bmdash-hbar-fill--niveau${niveau}`}
                      style={{ width: `${Math.max(2, (valeur / maxUrgence) * 100)}%` }}
                    />
                  </div>
                  <span className="bmdash-hbar-value">{valeur}</span>
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
    <div className="bmdash-container">
      {/* Header */}
      <div className="bmdash-header">
        <div className="bmdash-header-icon-wrap">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="bmdash-header-text">
          <h1>Tableau de Bord des Bons de Maintenance</h1>
          <p>Vue d'ensemble et indicateurs clés — glisse les cartes pour les réorganiser</p>
        </div>
        <button
          type="button"
          className="bmdash-reset-order"
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
      <div className="bmdash-stats-grid">
        {order.map((id) => {
          const def = cardsById[id];
          if (!def) return null;
          const rawValue = getFieldValue(data, def.field);
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

      {/* Graphiques (drag & drop) */}
      <div className="bmdash-charts-row">
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
      <div className="bmdash-recent-card">
        <div className="bmdash-chart-head">
          <h3>Bons de maintenance récents</h3>
          {data.bonsRecents?.length > 0 && (
            <span className="bmdash-chart-sub">{data.bonsRecents.length} derniers</span>
          )}
        </div>

        {(!data.bonsRecents || data.bonsRecents.length === 0) ? (
          <p className="bmdash-empty">Aucun bon de maintenance pour l'instant.</p>
        ) : (
          <div className="bmdash-table-wrap">
            <table className="bmdash-table">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Titre</th>
                  <th>Prestataire</th>
                  <th>Service</th>
                  <th>Urgence</th>
                  <th>Date</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {data.bonsRecents.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.num || `#${b.id}`}</td>
                    <td className="bmdash-desc-cell">{b.titre}</td>
                    <td>{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td>
                    <td>{b.serviceNom || b.service?.description || '—'}</td>
                    <td>
                      <span className={`bmdash-niveau-badge bmdash-niveau-badge--${b.urgence}`}>
                        {NIVEAU_LABELS[b.urgence] || '—'}
                      </span>
                    </td>
                    <td>{formatDate(b.dateCreation)}</td>
                    <td>
                      <span className={`bmdash-etat-badge bmdash-etat-badge--${b.etat}`}>
                        {ETAT_LABELS[b.etat] || `État ${b.etat}`}
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