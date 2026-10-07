import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Gauge, AlertTriangle, Clock, CheckCircle2, RefreshCw, ExternalLink, Wrench,
  ShieldCheck, Activity, History, Calendar, TrendingUp, FileText, CircleDot,
  Package, ChevronDown, ChevronUp, User,
} from 'lucide-react';
import vehiculeMaintenanceService, {
  STATUT_LABELS,
  DECLENCHEMENT_ETATS,
  ORIGINE_LABELS,
  ORIGINE_MANUELLE,
} from '../../../../services/vehiculeMaintenanceService';
import VehiculeMaintenanceBonModal from '../../../ui/modals/Vehiculemaintenancebonmodal';
import './VehiculeMaintenancePanel.css';

const fmtKm = (v) => (v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} km`);

const ICONS = {
  OK: CheckCircle2,
  A_VENIR: Clock,
  ATTEINT: AlertTriangle,
  EN_RETARD: AlertTriangle,
  EN_COURS: RefreshCw,
};

const statutClass = (statut) => String(statut ?? '').toLowerCase().replace(/_/g, '-');

const ringColor = (statut) => {
  switch (statut) {
    case 'OK':        return '#10b981';
    case 'A_VENIR':   return '#3b82f6';
    case 'ATTEINT':   return '#f59e0b';
    case 'EN_RETARD': return '#d97706';
    case 'EN_COURS':  return '#6366f1';
    default:          return '#0d9488';
  }
};

/** Anneau SVG de progression (allégé) */
const ProgressRing = ({ percent, color, size = 72, thickness = 5, children }) => {
  const safePct = Math.max(0, Math.min(100, percent));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safePct / 100) * circumference;

  return (
    <div className="vmp-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--vmp-ring-track)" strokeWidth={thickness}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="vmp-ring-inner">{children}</div>
    </div>
  );
};

export default function VehiculeMaintenancePanel({ vehicule, onOpenBon, onBonCree }) {
  const [statuts, setStatuts] = useState([]);
  const [declenchements, setDeclenchements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bonModalOpen, setBonModalOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [histOpen, setHistOpen] = useState(true); // ← état du bloc historique

  const load = useCallback(async () => {
    if (!vehicule?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([
        vehiculeMaintenanceService.getStatuts(vehicule.id),
        vehiculeMaintenanceService.getDeclenchements(vehicule.id),
      ]);
      setStatuts(s);
      setDeclenchements(d);
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de charger les maintenances.');
    } finally {
      setLoading(false);
    }
  }, [vehicule?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setFlash(null);
    setHistOpen(true); // réinitialise l'ouverture au changement de véhicule
  }, [vehicule?.id]);

  const enRetard = statuts.filter((s) => s.statut === 'EN_RETARD');
  const aVenir = statuts.filter((s) => s.statut === 'A_VENIR' || s.statut === 'ATTEINT');

  const kpi = useMemo(() => {
    const total = statuts.length;
    const ok = statuts.filter((s) => s.statut === 'OK').length;
    const soon = statuts.filter((s) => s.statut === 'A_VENIR' || s.statut === 'ATTEINT').length;
    const late = statuts.filter((s) => s.statut === 'EN_RETARD').length;
    return { total, ok, soon, late };
  }, [statuts]);

  if (!vehicule) return null;

  return (
    <section className="vmp-panel">

      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="vmp-header">
        <div className="vmp-header-left">
          <Wrench size={20} />
          <div>
            <h3>Maintenance préventive</h3>
            <span className="vmp-header-meta">
              <Gauge size={13} /> {fmtKm(vehicule.kilometrage)}
              <span className="vmp-sep">•</span>
              <Package size={13} /> {kpi.total} opération{kpi.total > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="vmp-header-actions">
          <button className="vmp-btn vmp-btn-primary" onClick={() => setBonModalOpen(true)}>
            <Wrench size={15} /> Créer un bon
          </button>
          <button className="vmp-btn vmp-btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'vmp-spin' : ''} /> Actualiser
          </button>
        </div>
      </header>

      {/* ═══════════════ KPI ═══════════════ */}
      {statuts.length > 0 && (
        <div className="vmp-kpis">
          <div className="vmp-kpi kpi-ok">
            <ShieldCheck size={16} />
            <span className="vmp-kpi-value">{kpi.ok}</span>
            <span className="vmp-kpi-label">À jour</span>
          </div>
          <div className="vmp-kpi kpi-soon">
            <Clock size={16} />
            <span className="vmp-kpi-value">{kpi.soon}</span>
            <span className="vmp-kpi-label">À venir</span>
          </div>
          <div className="vmp-kpi kpi-late">
            <AlertTriangle size={16} />
            <span className="vmp-kpi-value">{kpi.late}</span>
            <span className="vmp-kpi-label">En retard</span>
          </div>
          <div className="vmp-kpi kpi-total">
            <Activity size={16} />
            <span className="vmp-kpi-value">{kpi.total}</span>
            <span className="vmp-kpi-label">Total</span>
          </div>
        </div>
      )}

      {/* ═══════════════ ALERTES ═══════════════ */}
      {flash && (
        <div className="vmp-alert success">
          <CheckCircle2 size={16} />
          <span>
            Bon {flash.bon?.num ?? `#${flash.bon?.id}`} créé.{' '}
            <button className="vmp-link" onClick={() => onOpenBon?.(flash.bon?.id)}>
              Ouvrir <ExternalLink size={12} />
            </button>
          </span>
        </div>
      )}

      {error && <div className="vmp-alert error">{error}</div>}

      {enRetard.length > 0 && (
        <div className="vmp-alert danger">
          <AlertTriangle size={16} />
          <span>
            {enRetard.length} en retard : {enRetard.map((s) => s.typeLibelle).join(', ')}
          </span>
        </div>
      )}

      {aVenir.length > 0 && enRetard.length === 0 && (
        <div className="vmp-alert warning">
          <Clock size={16} />
          <span>{aVenir.length} à prévoir prochainement.</span>
        </div>
      )}

      {/* ═══════════════ SECTION : SITUATION PAR OPÉRATION ═══════════════ */}
      <div className="vmp-section">
        <div className="vmp-section-head">
          <Activity size={14} />
          <span>Situation par opération</span>
          <span className="vmp-count">{statuts.length}</span>
        </div>

        {statuts.length === 0 && !loading && (
          <div className="vmp-empty">
            <Wrench size={24} />
            <p>Aucun type de maintenance configuré.</p>
          </div>
        )}

        {statuts.length > 0 && (
          <div className="vmp-ops-grid">
            {statuts.map((s) => {
              const Icon = ICONS[s.statut] ?? CheckCircle2;
              const total = s.intervalleKm || 0;
              const restant = s.kmRestants ?? 0;
              const parcouru = total - restant;
              const pct = total > 0
                ? Math.max(0, Math.min(100, (parcouru / total) * 100))
                : 0;
              const isLate = restant < 0;
              const color = ringColor(s.statut);

              return (
                <article key={s.typeId} className={`vmp-op vmp-op-${statutClass(s.statut)}`}>
                  <div className="vmp-op-top">
                    <div className="vmp-op-info">
                      <h4>{s.typeLibelle}</h4>
                      <span className={`vmp-badge vmp-badge-${statutClass(s.statut)}`}>
                        <Icon size={11} />
                        {STATUT_LABELS[s.statut]}
                      </span>
                    </div>

                    <ProgressRing percent={pct} color={color}>
                      <div className="vmp-ring-value">
                        {isLate ? `+${Math.abs(Math.round(pct))}%` : `${Math.round(pct)}%`}
                      </div>
                      <div className="vmp-ring-sub">parcouru</div>
                    </ProgressRing>
                  </div>

                  <div className="vmp-op-details">
                    <span><CircleDot size={11} /> {fmtKm(s.intervalleKm)}</span>
                    <span><CheckCircle2 size={11} /> {fmtKm(s.dernierKmMaintenance)}</span>
                    <span><TrendingUp size={11} /> {fmtKm(s.prochainSeuilKm)}</span>
                  </div>

                  <div className="vmp-op-foot">
                    <span className={isLate ? 'is-late' : ''}>
                      {isLate
                        ? `${fmtKm(Math.abs(restant))} de retard`
                        : `${fmtKm(restant)} restant`}
                    </span>
                    {s.bonMaintenanceId && (
                      <button className="vmp-link" onClick={() => onOpenBon?.(s.bonMaintenanceId)}>
                        Bon <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION : HISTORIQUE — BLOC REPLIABLE ═══════════════ */}
      <div className="vmp-section">
        {/* En-tête cliquable qui ouvre/ferme tout le bloc */}
        <button
          type="button"
          className="vmp-section-head vmp-section-head--clickable"
          onClick={() => setHistOpen((v) => !v)}
          aria-expanded={histOpen}
        >
          <History size={14} />
          <span>Maintenances déclenchées</span>
          <span className="vmp-count">{declenchements.length}</span>
          <span className="vmp-section-chevron" aria-hidden="true">
            {histOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Contenu repliable */}
        {histOpen && (
          <div className="vmp-hist-reveal">
            {declenchements.length === 0 && (
              <div className="vmp-empty">
                <History size={24} />
                <p>Aucune maintenance déclenchée.</p>
              </div>
            )}

            {declenchements.length > 0 && (
              <div className="vmp-historique">
                {declenchements.map((d) => {
                  const isManuelle = d.origine === ORIGINE_MANUELLE;

                  return (
                    <article key={d.id} className="vmp-hist-card">
                      {/* Bloc date */}
                      <div className="vmp-hist-date">
                        <span className="vmp-hist-day">
                          {d.dateDeclenchement
                            ? new Date(d.dateDeclenchement).toLocaleDateString('fr-FR', { day: '2-digit' })
                            : '—'}
                        </span>
                        <span className="vmp-hist-month">
                          {d.dateDeclenchement
                            ? new Date(d.dateDeclenchement).toLocaleDateString('fr-FR', { month: 'short' })
                            : ''}
                        </span>
                        <span className="vmp-hist-year">
                          {d.dateDeclenchement
                            ? new Date(d.dateDeclenchement).getFullYear()
                            : ''}
                        </span>
                      </div>

                      {/* Contenu */}
                      <div className="vmp-hist-body">
                        <div className="vmp-hist-head">
                          <h4 className="vmp-hist-title">
                            {d.typeLibelle}
                            {d.echeancesCumulees > 1 && (
                              <span className="vmp-tag" title="Échéances cumulées">
                                ×{d.echeancesCumulees}
                              </span>
                            )}
                          </h4>
                          <div className="vmp-hist-tags">
                            <span className={`vmp-origine ${isManuelle ? 'manuelle' : 'auto'}`}>
                              {ORIGINE_LABELS[d.origine ?? 0]}
                            </span>
                            <span className="vmp-etat">
                              {DECLENCHEMENT_ETATS[d.etat] ?? d.etat}
                            </span>
                          </div>
                        </div>

                        <div className="vmp-hist-km">
                          <div className="vmp-hist-km-item">
                            <span className="vmp-hist-km-label">Seuil</span>
                            <span className="vmp-hist-km-value">{fmtKm(d.seuilKm)}</span>
                          </div>
                          <div className="vmp-hist-km-item">
                            <span className="vmp-hist-km-label">Déclenché à</span>
                            <span className="vmp-hist-km-value">
                              {fmtKm(d.kilometrageDeclenchement)}
                            </span>
                          </div>
                          <div className="vmp-hist-km-item">
                            <span className="vmp-hist-km-label">Km réel</span>
                            <span className="vmp-hist-km-value">{fmtKm(d.kilometrageReel)}</span>
                          </div>
                        </div>

                        {isManuelle && (d.demandeurNom || d.motif) && (
                          <div className="vmp-hist-motif">
                            {d.demandeurNom && (
                              <span><User size={11} /> {d.demandeurNom}</span>
                            )}
                            {d.motif && (
                              <span><FileText size={11} /> {d.motif}</span>
                            )}
                          </div>
                        )}

                        {d.bonMaintenanceId && (
                          <button
                            className="vmp-link vmp-hist-link"
                            onClick={() => onOpenBon?.(d.bonMaintenanceId)}
                          >
                            <FileText size={12} />
                            Bon #{d.bonMaintenanceId}
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <VehiculeMaintenanceBonModal
        isOpen={bonModalOpen}
        onClose={() => setBonModalOpen(false)}
        vehicule={vehicule}
        onCreated={(resultat) => {
          setFlash(resultat);
          load();
          onBonCree?.(resultat);
        }}
      />
    </section>
  );
}