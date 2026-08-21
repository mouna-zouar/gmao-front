import React, { useState, useEffect } from 'react';
import reclamationService from '../../../services/reclamationService';
import './ReclamationDashboard.css';

const ETAT_LABELS = { 0: 'Ouverte', 1: 'En cours', 2: 'Clôturée' };
const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const MOIS_LABELS = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

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

function StatCard({ label, value, icon, colorClass }) {
  return (
    <div className={`rdash-stat-card ${colorClass}`}>
      <div className="rdash-stat-icon">{icon}</div>
      <div>
        <div className="rdash-stat-value">{value}</div>
        <div className="rdash-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function ReclamationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return <div className="rdash-container"><p className="rdash-loading">Chargement du dashboard...</p></div>;
  }

  if (error || !data) {
    return <div className="rdash-container"><p className="rdash-error">{error || 'Aucune donnée disponible.'}</p></div>;
  }

  const moisEntries = Object.entries(data.parMois || {});
  const maxMois = Math.max(1, ...moisEntries.map(([, v]) => v));

  const criticiteEntries = [1, 2, 3].map((niveau) => [niveau, data.parCriticite?.[niveau] ?? 0]);
  const urgenceEntries = [1, 2, 3].map((niveau) => [niveau, data.parUrgence?.[niveau] ?? 0]);
  const maxNiveau = Math.max(1, ...criticiteEntries.map(([, v]) => v), ...urgenceEntries.map(([, v]) => v));

  return (
    <div className="rdash-container">
      <div className="rdash-header">
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <div>
          <h1>Dashboard Réclamations</h1>
          <p>Vue d'ensemble et indicateurs clés</p>
        </div>
      </div>

      {/* Cartes de stats */}
      <div className="rdash-stats-grid">
        <StatCard
          label="Total réclamations"
          value={data.totalReclamations}
          colorClass="rdash-stat--neutral"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        />
        <StatCard
          label="Ouvertes"
          value={data.ouvertes}
          colorClass="rdash-stat--ouverte"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
        />
        <StatCard
          label="En cours"
          value={data.enCours}
          colorClass="rdash-stat--encours"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Clôturées"
          value={data.cloturees}
          colorClass="rdash-stat--cloturee"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Non affectées"
          value={data.nonAffectees}
          colorClass="rdash-stat--alerte"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
        />
        <StatCard
          label="Délai moyen résolution"
          value={data.delaiMoyenResolutionJours != null ? `${data.delaiMoyenResolutionJours.toFixed(1)} j` : '—'}
          colorClass="rdash-stat--neutral"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="rdash-charts-row">
        {/* Répartition par mois */}
        <div className="rdash-chart-card">
          <h3>Réclamations par mois (12 derniers mois)</h3>
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

        {/* Par criticité / urgence */}
        <div className="rdash-chart-card">
          <h3>Par criticité</h3>
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

          <h3 style={{ marginTop: '18px' }}>Par urgence</h3>
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

      {/* Réclamations récentes */}
      <div className="rdash-recent-card">
        <h3>Réclamations récentes</h3>
        {(!data.reclamationsRecentes || data.reclamationsRecentes.length === 0) ? (
          <p className="rdash-empty">Aucune réclamation pour l'instant.</p>
        ) : (
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
                  <td style={{ fontWeight: 600 }}>{r.num || `#${r.id}`}</td>
                  <td className="rdash-desc-cell">{r.description}</td>
                  <td>{NIVEAU_LABELS[r.criticite] || '—'}</td>
                  <td>{NIVEAU_LABELS[r.urgence] || '—'}</td>
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
        )}
      </div>
    </div>
  );
}