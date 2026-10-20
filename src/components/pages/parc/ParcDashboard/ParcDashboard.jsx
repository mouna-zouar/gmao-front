import { useCallback, useEffect, useState } from 'react';
import parcDashboardService from '../../../../services/parcDashboardService';
import { t, tp, locale } from '../../../../i18n';
import './ParcDashboard.css';
import IndicateursParc from './IndicateursParc';
import { CalendarCheck, Car, CircleCheck, Fuel, Gauge, RefreshCw, Route, TriangleAlert } from 'lucide-react';

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
  return Number(n).toLocaleString(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPourcentage(n) {
  if (n == null) return '—';
  return t('{n} %', { n: Number(n).toLocaleString(locale(), { maximumFractionDigits: 1 }) });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ICONS = {
  total: <Car size={22} strokeWidth={2} aria-hidden="true" />,
  dispo: <CircleCheck size={22} strokeWidth={2} aria-hidden="true" />,
  alerte: <TriangleAlert size={22} strokeWidth={2} aria-hidden="true" />,
  incident: <TriangleAlert size={22} strokeWidth={2} aria-hidden="true" />,
  mission: <Route size={22} strokeWidth={2} aria-hidden="true" />,
  reservation: <CalendarCheck size={22} strokeWidth={2} aria-hidden="true" />,
  carburant: <Fuel size={22} strokeWidth={2} aria-hidden="true" />,
  km: <Gauge size={22} strokeWidth={2} aria-hidden="true" />,
  refresh: <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />,
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
      setError(t("Impossible de charger le tableau de bord du parc. Vérifie que le serveur est bien lancé."));
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
          <p>{t("Chargement du tableau de bord...")}</p>
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
          <h1>{t("Tableau de bord — Parc Auto")}</h1>
          <p>{t("Vue d'ensemble de la flotte : disponibilité, criticité, alertes documents, incidents")}</p>
        </div>
        <button className="parcdash-refresh-btn" onClick={load} disabled={loading}>
          {ICONS.refresh}
          {loading ? t("Actualisation...") : t("Actualiser")}
        </button>
      </div>

      {error && (
        <div className="parcdash-error-banner">{error}</div>
      )}

      {/* CARTES KPI — une carte à 0 n'est pas affichée */}
      <div className="parcdash-stats-grid">
        {Number(totalVehicules) ? (
          <div className="parcdash-stat-card parcdash-stat--featured">
            <div className="parcdash-stat-icon">{ICONS.total}</div>
            <div className="parcdash-stat-value">{fmtNombre(totalVehicules)}</div>
            <div className="parcdash-stat-label">{t("Total véhicules")}</div>
          </div>
        ) : null}

        {Number(data?.tauxDisponibilite) ? (
          <div className="parcdash-stat-card parcdash-stat--green">
            <div className="parcdash-stat-icon">{ICONS.dispo}</div>
            <div className="parcdash-stat-value">{fmtPourcentage(data?.tauxDisponibilite)}</div>
            <div className="parcdash-stat-label">{t("Taux de disponibilité")}</div>
          </div>
        ) : null}

        {Number(data?.vehiculesCritiquesIndisponibles) ? (
          <div className={`parcdash-stat-card ${data?.vehiculesCritiquesIndisponibles > 0 ? 'parcdash-stat--red' : 'parcdash-stat--neutral'}`}>
            <div className="parcdash-stat-icon">{ICONS.alerte}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.vehiculesCritiquesIndisponibles)}</div>
            <div className="parcdash-stat-label">{t("Véhicules C1 indisponibles")}</div>
          </div>
        ) : null}

        {Number(data?.documentsExpires) ? (
          <div className={`parcdash-stat-card ${data?.documentsExpires > 0 ? 'parcdash-stat--red' : 'parcdash-stat--neutral'}`}>
            <div className="parcdash-stat-icon">{ICONS.alerte}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.documentsExpires)}</div>
            <div className="parcdash-stat-label">{t("Documents expirés")}</div>
          </div>
        ) : null}

        {Number(data?.documentsExpirantSous30Jours) ? (
          <div className={`parcdash-stat-card ${data?.documentsExpirantSous30Jours > 0 ? 'parcdash-stat--amber' : 'parcdash-stat--neutral'}`}>
            <div className="parcdash-stat-icon">{ICONS.alerte}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.documentsExpirantSous30Jours)}</div>
            <div className="parcdash-stat-label">{t("Documents expirant sous 30j")}</div>
          </div>
        ) : null}

        {Number(data?.incidentsOuverts) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.incident}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.incidentsOuverts)}</div>
            <div className="parcdash-stat-label">{t("Incidents ouverts")}</div>
          </div>
        ) : null}

        {Number(data?.missionsEnCours) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.mission}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.missionsEnCours)}</div>
            <div className="parcdash-stat-label">{t("Missions en cours")}</div>
          </div>
        ) : null}

        {Number(data?.reservationsEnAttente) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.reservation}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.reservationsEnAttente)}</div>
            <div className="parcdash-stat-label">{t("Réservations en attente")}</div>
          </div>
        ) : null}

        {Number(data?.carburantMontantMoisCourant) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.carburant}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.carburantMontantMoisCourant, 2)} <span className="parcdash-stat-unit">{t("DT")}</span></div>
            <div className="parcdash-stat-label">{t("Carburant — mois courant")}</div>
          </div>
        ) : null}

        {Number(data?.kilometrageMoyen) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.km}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.kilometrageMoyen)} <span className="parcdash-stat-unit">{t("km")}</span></div>
            <div className="parcdash-stat-label">{t("Kilométrage moyen")}</div>
          </div>
        ) : null}

        {Number(data?.kilometrageTotalCumule) ? (
          <div className="parcdash-stat-card parcdash-stat--neutral">
            <div className="parcdash-stat-icon">{ICONS.km}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.kilometrageTotalCumule)} <span className="parcdash-stat-unit">{t("km")}</span></div>
            <div className="parcdash-stat-label">{t("Kilométrage cumulé")}</div>
          </div>
        ) : null}

        {Number(data?.coutIncidentsCumule) ? (
          <div className={`parcdash-stat-card ${data?.coutIncidentsCumule > 0 ? 'parcdash-stat--amber' : 'parcdash-stat--neutral'}`}>
            <div className="parcdash-stat-icon">{ICONS.incident}</div>
            <div className="parcdash-stat-value">{fmtNombre(data?.coutIncidentsCumule, 2)} <span className="parcdash-stat-unit">{t("DT")}</span></div>
            <div className="parcdash-stat-label">{t("Coût incidents cumulé")}</div>
          </div>
        ) : null}
      </div>

      {/* INDICATEURS DE PERFORMANCE (30 j vs 30 j précédents, coûts, classements) */}
      <IndicateursParc />

      {/* RÉPARTITIONS */}
      <div className="parcdash-panels-row">
        <div className="parcdash-panel">
          <h3>{t("Répartition par état")}</h3>
          <div className="parcdash-breakdown">
            {ETAT_ORDER.filter((etat) => (parEtat[etat] || 0) > 0).map((etat) => {
              const count = parEtat[etat] || 0;
              const pct = totalVehicules > 0 ? Math.round((count / totalVehicules) * 100) : 0;
              return (
                <div key={etat} className="parcdash-breakdown-row">
                  <span className={`parcdash-dot color-${ETAT_COLOR[etat]}`} />
                  <span className="parcdash-breakdown-label">{t(ETAT_LABELS[etat])}</span>
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
          <h3>{t("Répartition par criticité")}</h3>
          <div className="parcdash-breakdown">
            {CRITICITE_ORDER.filter((c) => (parCriticite[c] || 0) > 0).map((c) => {
              const count = parCriticite[c] || 0;
              const pct = totalVehicules > 0 ? Math.round((count / totalVehicules) * 100) : 0;
              return (
                <div key={c} className="parcdash-breakdown-row">
                  <span className={`parcdash-dot color-${CRITICITE_COLOR[c]}`} />
                  <span className="parcdash-breakdown-label">{c} · {t(CRITICITE_LABELS[c])}</span>
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
        <h3>{t("Alertes documents obligatoires (expirés ou sous 30 jours)")}</h3>
        {alertes.length === 0 ? (
          <p className="parcdash-empty">{t("Aucune alerte — tous les documents suivis sont à jour.")}</p>
        ) : (
          <div className="parcdash-table-wrap">
            <table className="parcdash-table">
              <thead>
                <tr>
                  <th>{t("Matricule")}</th>
                  <th>{t("Document")}</th>
                  <th>{t("Échéance")}</th>
                  <th>{t("Jours restants")}</th>
                </tr>
              </thead>
              <tbody>
                {alertes.map((a, i) => {
                  const expire = a.joursRestants < 0;
                  return (
                    <tr key={`${a.vehiculeId}-${a.document}-${i}`} className={expire ? 'parcdash-row-expire' : ''}>
                      <td style={{ fontWeight: 600 }}>{a.matricule || `#${a.vehiculeId}`}</td>
                      <td>{t(a.document)}</td>
                      <td>{fmtDate(a.dateEcheance)}</td>
                      <td>
                        <span className={`parcdash-jours-badge ${expire ? 'expire' : a.joursRestants <= 7 ? 'urgent' : 'normal'}`}>
                          {expire ? t('Expiré depuis {n} j', { n: Math.abs(a.joursRestants) }) : t('{n} j', { n: a.joursRestants })}
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