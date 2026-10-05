import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Gauge, AlertTriangle, Clock, CheckCircle2, RefreshCw, ExternalLink, Wrench,
  ShieldCheck, Activity, History,
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

/** Convertit un statut "EN_RETARD" en classe CSS "en-retard". */
const statutClass = (statut) => String(statut ?? '').toLowerCase().replace(/_/g, '-');

export default function VehiculeMaintenancePanel({ vehicule, onOpenBon, onBonCree }) {
  const [statuts, setStatuts] = useState([]);
  const [declenchements, setDeclenchements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bonModalOpen, setBonModalOpen] = useState(false);
  const [flash, setFlash] = useState(null);

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
      setError(
        err?.response?.data?.message || 'Impossible de charger les maintenances.'
      );
    } finally {
      setLoading(false);
    }
  }, [vehicule?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setFlash(null); }, [vehicule?.id]);

  const enRetard = statuts.filter((s) => s.statut === 'EN_RETARD');
  const aVenir = statuts.filter(
    (s) => s.statut === 'A_VENIR' || s.statut === 'ATTEINT'
  );

  // ── KPI mémoïsés ────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = statuts.length;
    const ok = statuts.filter((s) => s.statut === 'OK').length;
    const soon = statuts.filter(
      (s) => s.statut === 'A_VENIR' || s.statut === 'ATTEINT'
    ).length;
    const late = statuts.filter((s) => s.statut === 'EN_RETARD').length;
    return { total, ok, soon, late };
  }, [statuts]);

  if (!vehicule) return null;

  return (
    <section className="vmp-panel">

      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="vmp-header">
        <div className="vmp-header-left">
          <div className="vmp-header-icon">
            <Wrench size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3>Maintenance préventive</h3>
            <p className="vmp-km">
              <Gauge size={14} />
              Compteur actuel :&nbsp;
              <strong>{fmtKm(vehicule.kilometrage)}</strong>
            </p>
          </div>
        </div>

        <div className="vmp-header-actions">
          <button
            type="button"
            className="vmp-creer-bon"
            onClick={() => setBonModalOpen(true)}
            title="Demander une maintenance, même si aucun seuil n'est atteint"
          >
            <Wrench size={16} strokeWidth={2.5} />
            Créer un bon de maintenance
          </button>
          <button
            type="button"
            className="vmp-refresh"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'vmp-spin' : ''} />
            Actualiser
          </button>
        </div>
      </header>

      {/* ═══════════════ KPI ═══════════════ */}
      {statuts.length > 0 && (
        <div className="vmp-kpi-grid">
          <div className="vmp-kpi kpi-ok">
            <span className="vmp-kpi-icon"><ShieldCheck size={18} strokeWidth={2.2} /></span>
            <div className="vmp-kpi-body">
              <span className="vmp-kpi-value">{kpi.ok}</span>
              <span className="vmp-kpi-label">À jour</span>
            </div>
          </div>

          <div className="vmp-kpi kpi-soon">
            <span className="vmp-kpi-icon"><Clock size={18} strokeWidth={2.2} /></span>
            <div className="vmp-kpi-body">
              <span className="vmp-kpi-value">{kpi.soon}</span>
              <span className="vmp-kpi-label">À venir</span>
            </div>
          </div>

          <div className="vmp-kpi kpi-late">
            <span className="vmp-kpi-icon"><AlertTriangle size={18} strokeWidth={2.2} /></span>
            <div className="vmp-kpi-body">
              <span className="vmp-kpi-value">{kpi.late}</span>
              <span className="vmp-kpi-label">En retard</span>
            </div>
          </div>

          <div className="vmp-kpi kpi-total">
            <span className="vmp-kpi-icon"><Activity size={18} strokeWidth={2.2} /></span>
            <div className="vmp-kpi-body">
              <span className="vmp-kpi-value">{kpi.total}</span>
              <span className="vmp-kpi-label">Opérations</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ALERTES ═══════════════ */}
      {flash && (
        <div className="vmp-alert success">
          <CheckCircle2 size={18} />
          <span>
            Bon {flash.bon?.num ?? `#${flash.bon?.id}`} créé.{' '}
            <button
              type="button"
              className="vmp-link"
              onClick={() => onOpenBon?.(flash.bon?.id)}
            >
              Ouvrir le bon <ExternalLink size={13} />
            </button>
          </span>
        </div>
      )}

      {error && <div className="vmp-alert error">{error}</div>}

      {enRetard.length > 0 && (
        <div className="vmp-alert danger">
          <AlertTriangle size={18} />
          <span>
            {enRetard.length} maintenance{enRetard.length > 1 ? 's' : ''} en retard :{' '}
            {enRetard.map((s) => s.typeLibelle).join(', ')}
          </span>
        </div>
      )}

      {aVenir.length > 0 && enRetard.length === 0 && (
        <div className="vmp-alert warning">
          <Clock size={18} />
          <span>
            {aVenir.length} maintenance{aVenir.length > 1 ? 's' : ''} à prévoir
            prochainement.
          </span>
        </div>
      )}

      {/* ═══════════════ SECTION : SITUATION ═══════════════ */}
      <div className="vmp-section">
        <div className="vmp-section-head">
          <Activity size={14} strokeWidth={2.4} />
          <span>Situation par opération</span>
          <span className="vmp-section-count">{statuts.length}</span>
        </div>

        <div className="vmp-table-wrap">
          <table className="vmp-table">
            <thead>
              <tr>
                <th>Opération</th>
                <th>Intervalle</th>
                <th>Dernière</th>
                <th>Prochain seuil</th>
                <th>Restant</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {statuts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="vmp-empty">
                    Aucun type de maintenance configuré pour ce véhicule.
                  </td>
                </tr>
              )}

              {statuts.map((s) => {
                const Icon = ICONS[s.statut] ?? CheckCircle2;
                const total = s.intervalleKm || 0;
                const restant = s.kmRestants ?? 0;
                const parcouru = total - restant;
                const pct = total > 0
                  ? Math.max(0, Math.min(100, (parcouru / total) * 100))
                  : 0;
                const isLate = restant < 0;
                const isSoon = !isLate && pct >= 80;
                const cls = isLate ? 'is-late' : isSoon ? 'is-soon' : 'is-ok';

                return (
                  <tr key={s.typeId}>
                    <td className="vmp-cell-op">{s.typeLibelle}</td>
                    <td className="vmp-cell-num">{fmtKm(s.intervalleKm)}</td>
                    <td className="vmp-cell-num">{fmtKm(s.dernierKmMaintenance)}</td>
                    <td className="vmp-cell-num">{fmtKm(s.prochainSeuilKm)}</td>
                    <td>
                      <div className="vmp-restant">
                        <span className={`vmp-restant-text ${isLate ? 'is-late' : ''}`}>
                          {isLate
                            ? `${fmtKm(Math.abs(restant))} de retard`
                            : fmtKm(restant)}
                        </span>
                        {total > 0 && (
                          <div className="vmp-restant-bar" aria-hidden="true">
                            <div
                              className={`vmp-restant-fill ${cls}`}
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`vmp-badge vmp-badge-${statutClass(s.statut)}`}>
                        <Icon size={13} strokeWidth={2.4} />
                        {STATUT_LABELS[s.statut]}
                      </span>
                    </td>
                    <td>
                      {s.bonMaintenanceId && (
                        <button
                          type="button"
                          className="vmp-link"
                          onClick={() => onOpenBon?.(s.bonMaintenanceId)}
                        >
                          Voir le bon <ExternalLink size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════ SECTION : HISTORIQUE ═══════════════ */}
      <div className="vmp-section">
        <div className="vmp-section-head">
          <History size={14} strokeWidth={2.4} />
          <span>Maintenances déclenchées</span>
          <span className="vmp-section-count">{declenchements.length}</span>
        </div>

        <div className="vmp-table-wrap">
          <table className="vmp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opération</th>
                <th>Seuil</th>
                <th>Km déclenchement</th>
                <th>Km réel</th>
                <th>Bon</th>
                <th>Origine</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {declenchements.length === 0 && (
                <tr>
                  <td colSpan={8} className="vmp-empty">
                    Aucune maintenance déclenchée pour ce véhicule.
                  </td>
                </tr>
              )}

              {declenchements.map((d) => (
                <tr key={d.id}>
                  <td className="vmp-cell-num">
                    {d.dateDeclenchement
                      ? new Date(d.dateDeclenchement).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="vmp-cell-op">
                    {d.typeLibelle}
                    {d.echeancesCumulees > 1 && (
                      <span
                        className="vmp-tag"
                        title="Échéances cumulées suite à un grand écart de kilométrage"
                      >
                        ×{d.echeancesCumulees}
                      </span>
                    )}
                  </td>
                  <td className="vmp-cell-num">{fmtKm(d.seuilKm)}</td>
                  <td className="vmp-cell-num">{fmtKm(d.kilometrageDeclenchement)}</td>
                  <td className="vmp-cell-num">{fmtKm(d.kilometrageReel)}</td>
                  <td>
                    {d.bonMaintenanceId ? (
                      <button
                        type="button"
                        className="vmp-link"
                        onClick={() => onOpenBon?.(d.bonMaintenanceId)}
                      >
                        #{d.bonMaintenanceId}
                      </button>
                    ) : (
                      <span className="vmp-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`vmp-origine ${
                        d.origine === ORIGINE_MANUELLE ? 'manuelle' : 'auto'
                      }`}
                      title={
                        d.origine === ORIGINE_MANUELLE
                          ? `Demande manuelle${d.demandeurNom ? ` — ${d.demandeurNom}` : ''}${d.motif ? ` : ${d.motif}` : ''}`
                          : 'Seuil kilométrique atteint'
                      }
                    >
                      {ORIGINE_LABELS[d.origine ?? 0]}
                    </span>
                  </td>
                  <td>
                    <span className="vmp-etat">
                      {DECLENCHEMENT_ETATS[d.etat] ?? d.etat}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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