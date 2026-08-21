import React, { useState, useEffect } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import './BonMaintenanceDashboard.css';

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
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
    <div className={`bmdash-stat-card ${colorClass}`}>
      <div className="bmdash-stat-icon">{icon}</div>
      <div>
        <div className="bmdash-stat-value">{value}</div>
        <div className="bmdash-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function BonMaintenanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return <div className="bmdash-container"><p className="bmdash-loading">Chargement du dashboard...</p></div>;
  }

  if (error || !data) {
    return <div className="bmdash-container"><p className="bmdash-error">{error || 'Aucune donnée disponible.'}</p></div>;
  }

  const moisEntries = Object.entries(data.parMois || {});
  const maxMois = Math.max(1, ...moisEntries.map(([, v]) => v));

  const etats = [1, 2, 3, 4, 10];
  const maxEtat = Math.max(1, ...etats.map((e) => data.parEtat?.[e] ?? 0));

  const urgenceEntries = [1, 2, 3].map((niveau) => [niveau, data.parUrgence?.[niveau] ?? 0]);
  const maxUrgence = Math.max(1, ...urgenceEntries.map(([, v]) => v));

  return (
    <div className="bmdash-container">
      <div className="bmdash-header">
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
        <div>
          <h1>Dashboard Bons de maintenance</h1>
          <p>Vue d'ensemble et indicateurs clés</p>
        </div>
      </div>

      {/* Cartes de stats */}
      <div className="bmdash-stats-grid">
        <StatCard
          label="Total bons"
          value={data.totalBons}
          colorClass="bmdash-stat--neutral"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        />
        <StatCard
          label="En cours"
          value={data.parEtat?.[3] ?? 0}
          colorClass="bmdash-stat--encours"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Suspendus"
          value={data.parEtat?.[2] ?? 0}
          colorClass="bmdash-stat--suspendu"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Effectués"
          value={data.parEtat?.[4] ?? 0}
          colorClass="bmdash-stat--effectue"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Arrêts obligatoires en cours"
          value={data.arretsObligatoiresEnCours}
          colorClass="bmdash-stat--alerte"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
        />
        <StatCard
          label="Coût total cumulé"
          value={data.coutTotalCumule != null ? `${data.coutTotalCumule.toFixed(0)} DT` : '—'}
          colorClass="bmdash-stat--neutral"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Délai moyen résolution"
          value={data.delaiMoyenResolutionJours != null ? `${data.delaiMoyenResolutionJours.toFixed(1)} j` : '—'}
          colorClass="bmdash-stat--neutral"
          icon={<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="bmdash-charts-row">
        {/* Répartition par mois */}
        <div className="bmdash-chart-card">
          <h3>Bons créés par mois (12 derniers mois)</h3>
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

        {/* Par état / urgence */}
        <div className="bmdash-chart-card">
          <h3>Par état</h3>
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

          <h3 style={{ marginTop: '18px' }}>Par urgence</h3>
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

      {/* Bons récents */}
      <div className="bmdash-recent-card">
        <h3>Bons de maintenance récents</h3>
        {(!data.bonsRecents || data.bonsRecents.length === 0) ? (
          <p className="bmdash-empty">Aucun bon de maintenance pour l'instant.</p>
        ) : (
          <table className="bmdash-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Titre</th>
                <th>Prestataire</th>
                <th>Urgence</th>
                <th>Date</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {data.bonsRecents.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.num || `#${b.id}`}</td>
                  <td className="bmdash-desc-cell">{b.titre}</td>
                  <td>{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td>
                  <td>{NIVEAU_LABELS[b.urgence] || '—'}</td>
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
        )}
      </div>
    </div>
  );
}