import { useCallback, useEffect, useState } from 'react';
import parcDashboardService from '../../../../services/parcDashboardService';
import './ParcDashboard.css';

const ETAT_LABELS = {
  0: 'Disponible',
  1: 'Réservé',
  2: 'En mission',
  3: 'En maintenance',
  4: 'Immobilisé',
  5: 'Hors service',
  6: 'Vendu',
};

const ETAT_COLOR = {
  0: 'green',
  1: 'blue',
  2: 'blue',
  3: 'amber',
  4: 'red',
  5: 'slate',
  6: 'slate',
};

const CRITICITE_LABELS = { C1: 'Critique', C2: 'Important', C3: 'Normal', C4: 'Faible' };
const CRITICITE_COLOR = { C1: 'red', C2: 'amber', C3: 'blue', C4: 'slate' };
const CRITICITE_ORDER = ['C1', 'C2', 'C3', 'C4'];
const ETAT_ORDER = [0, 1, 2, 3, 4, 5, 6];

function fmtNombre(n, decimals = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPourcentage(n) {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ICONS = {
  total: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>,
  dispo: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  alerte: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>,
  incident: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 16.11A2 2 0 0 0 5.16 21h13.68a2 2 0 0 0 3.36-1.75l-8.37-15a2 2 0 0 0-3.49-.75z" /><path d="M12 9v4M12 17h.01" /></svg>,
  mission: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>,
  reservation: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>,
  carburant: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2.69l.95.95a7.5 7.5 0 0 1 2.12 5.32c0 2.21-.9 4.2-2.34 5.64-1.44 1.44-3.43 2.34-5.64 2.34s-4.2-.9-5.64-2.34C3.9 13.16 3 11.17 3 8.96c0-1.99.78-3.89 2.17-5.28L12 2.69z" /><path d="M12 22a9 9 0 0 1-9-9" /></svg>,
  km: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 12l4-2" /></svg>,
  refresh: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0114.6-4.7L21 8M20.5 15a9 9 0 01-14.6 4.7L3 16" /></svg>,
};

export default function ParcDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await parcDashboardService.getDashboard();
      setData(result);
    } catch (err) {
      console.error('Erreur chargement dashboard parc :', err);
      setError("Impossible de charger le tableau de bord du parc. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="parcdash-container">
        <div className="parcdash-loading">
          <div className="parcdash-spinner" />
          <p>Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const parEtat = data?.parEtat || {};
  const parCriticite = data?.parCriticite || {};
  const alertes = data?.alertesDocuments || [];
  const totalVehicules = data?.totalVehicules || 0;

  return (
    <div className="parcdash-container">
      {/* HEADER */}
      <div className="parcdash-header">
        <div className="parcdash-header-icon-wrap">{ICONS.total}</div>
        <div className="parcdash-header-text">
          <h1>Tableau de bord — Parc Auto</h1>
          <p>Vue d'ensemble de la flotte : disponibilité, criticité, alertes documents, incidents</p>
        </div>
        <button className="parcdash-refresh-btn" onClick={load} disabled={loading}>
          {ICONS.refresh}
          {loading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {error && (
        <div className="parcdash-error-banner">{error}</div>
      )}

      {/* CARTES KPI */}
      <div className="parcdash-stats-grid">
        <div className="parcdash-stat-card parcdash-stat--featured">
          <div className="parcdash-stat-icon">{ICONS.total}</div>
          <div className="parcdash-stat-value">{fmtNombre(totalVehicules)}</div>
          <div className="parcdash-stat-label">Total véhicules</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--green">
          <div className="parcdash-stat-icon">{ICONS.dispo}</div>
          <div className="parcdash-stat-value">{fmtPourcentage(data?.tauxDisponibilite)}</div>
          <div className="parcdash-stat-label">Taux de disponibilité</div>
        </div>

        <div className={`parcdash-stat-card ${data?.vehiculesCritiquesIndisponibles > 0 ? 'parcdash-stat--red' : 'parcdash-stat--neutral'}`}>
          <div className="parcdash-stat-icon">{ICONS.alerte}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.vehiculesCritiquesIndisponibles)}</div>
          <div className="parcdash-stat-label">Véhicules C1 indisponibles</div>
        </div>

        <div className={`parcdash-stat-card ${data?.documentsExpires > 0 ? 'parcdash-stat--red' : 'parcdash-stat--neutral'}`}>
          <div className="parcdash-stat-icon">{ICONS.alerte}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.documentsExpires)}</div>
          <div className="parcdash-stat-label">Documents expirés</div>
        </div>

        <div className={`parcdash-stat-card ${data?.documentsExpirantSous30Jours > 0 ? 'parcdash-stat--amber' : 'parcdash-stat--neutral'}`}>
          <div className="parcdash-stat-icon">{ICONS.alerte}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.documentsExpirantSous30Jours)}</div>
          <div className="parcdash-stat-label">Documents expirant sous 30j</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.incident}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.incidentsOuverts)}</div>
          <div className="parcdash-stat-label">Incidents ouverts</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.mission}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.missionsEnCours)}</div>
          <div className="parcdash-stat-label">Missions en cours</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.reservation}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.reservationsEnAttente)}</div>
          <div className="parcdash-stat-label">Réservations en attente</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.carburant}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.carburantMontantMoisCourant, 2)} <span className="parcdash-stat-unit">DT</span></div>
          <div className="parcdash-stat-label">Carburant — mois courant</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.km}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.kilometrageMoyen)} <span className="parcdash-stat-unit">km</span></div>
          <div className="parcdash-stat-label">Kilométrage moyen</div>
        </div>

        <div className="parcdash-stat-card parcdash-stat--neutral">
          <div className="parcdash-stat-icon">{ICONS.km}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.kilometrageTotalCumule)} <span className="parcdash-stat-unit">km</span></div>
          <div className="parcdash-stat-label">Kilométrage cumulé</div>
        </div>

        <div className={`parcdash-stat-card ${data?.coutIncidentsCumule > 0 ? 'parcdash-stat--amber' : 'parcdash-stat--neutral'}`}>
          <div className="parcdash-stat-icon">{ICONS.incident}</div>
          <div className="parcdash-stat-value">{fmtNombre(data?.coutIncidentsCumule, 2)} <span className="parcdash-stat-unit">DT</span></div>
          <div className="parcdash-stat-label">Coût incidents cumulé</div>
        </div>
      </div>

      {/* RÉPARTITIONS */}
      <div className="parcdash-panels-row">
        <div className="parcdash-panel">
          <h3>Répartition par état</h3>
          <div className="parcdash-breakdown">
            {ETAT_ORDER.map((etat) => {
              const count = parEtat[etat] || 0;
              const pct = totalVehicules > 0 ? Math.round((count / totalVehicules) * 100) : 0;
              return (
                <div key={etat} className="parcdash-breakdown-row">
                  <span className={`parcdash-dot color-${ETAT_COLOR[etat]}`} />
                  <span className="parcdash-breakdown-label">{ETAT_LABELS[etat]}</span>
                  <span className="parcdash-breakdown-count">{count}</span>
                  <div className="parcdash-breakdown-bar-bg">
                    <div className={`parcdash-breakdown-bar-fill color-${ETAT_COLOR[etat]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="parcdash-panel">
          <h3>Répartition par criticité</h3>
          <div className="parcdash-breakdown">
            {CRITICITE_ORDER.map((c) => {
              const count = parCriticite[c] || 0;
              const pct = totalVehicules > 0 ? Math.round((count / totalVehicules) * 100) : 0;
              return (
                <div key={c} className="parcdash-breakdown-row">
                  <span className={`parcdash-dot color-${CRITICITE_COLOR[c]}`} />
                  <span className="parcdash-breakdown-label">{c} · {CRITICITE_LABELS[c]}</span>
                  <span className="parcdash-breakdown-count">{count}</span>
                  <div className="parcdash-breakdown-bar-bg">
                    <div className={`parcdash-breakdown-bar-fill color-${CRITICITE_COLOR[c]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ALERTES DOCUMENTS */}
      <div className="parcdash-panel parcdash-panel--full">
        <h3>Alertes documents obligatoires (expirés ou sous 30 jours)</h3>
        {alertes.length === 0 ? (
          <p className="parcdash-empty">Aucune alerte — tous les documents suivis sont à jour.</p>
        ) : (
          <div className="parcdash-table-wrap">
            <table className="parcdash-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Document</th>
                  <th>Échéance</th>
                  <th>Jours restants</th>
                </tr>
              </thead>
              <tbody>
                {alertes.map((a, i) => {
                  const expire = a.joursRestants < 0;
                  return (
                    <tr key={`${a.vehiculeId}-${a.document}-${i}`} className={expire ? 'parcdash-row-expire' : ''}>
                      <td style={{ fontWeight: 600 }}>{a.matricule || `#${a.vehiculeId}`}</td>
                      <td>{a.document}</td>
                      <td>{fmtDate(a.dateEcheance)}</td>
                      <td>
                        <span className={`parcdash-jours-badge ${expire ? 'expire' : a.joursRestants <= 7 ? 'urgent' : 'normal'}`}>
                          {expire ? `Expiré depuis ${Math.abs(a.joursRestants)} j` : `${a.joursRestants} j`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
