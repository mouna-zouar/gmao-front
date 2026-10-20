import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Navigation, Car, MapPin, Route, Gauge, Calendar, Shield,
  ShieldCheck, ShieldAlert, User, Clock, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Activity, RefreshCw, ChevronDown,
  Wrench, Play, Flag, TrendingUp, Timer, Zap, Target, Circle,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeService from '../../../../services/vehiculeService';
import vehiculeMissionService from '../../../../services/vehiculeMissionService';
import vehiculeConducteurService from '../../../../services/vehiculeConducteurService';
import personnelService from '../../../../services/personnelService';
import emplacementService from '../../../../services/emplacementService';
import { t, tp, locale } from '../../../../i18n';
import './VehiculeTracage.css';

const ETAT_LABELS = { 0: 'Planifiée', 1: 'En cours', 2: 'Terminée', 3: 'Annulée' };
const ETAT_META = {
  0: { class: 'planned', Icon: Clock },
  1: { class: 'running', Icon: Activity },
  2: { class: 'done', Icon: CheckCircle2 },
  3: { class: 'cancelled', Icon: XCircle },
};
const NATURE_LABELS = { 0: 'Temps', 1: 'Cycles', 2: 'Distance' };
const TYPE_LABELS = { 0: 'Véhicule léger', 1: 'Camion', 2: 'Engin', 3: 'Tracteur', 4: 'Autre' };

// ─── Utilitaires ───
function destinationLabel(mission, emplacementsMap = {}) {
  const emp = emplacementsMap[mission?.destinationId];
  return emp?.nom || mission?.destination || '';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.round((d - new Date()) / (1000 * 60 * 60 * 24));
}

function alertLevel(iso) {
  const days = daysUntil(iso);
  if (days === null) return 'neutral';
  if (days < 0) return 'danger';
  if (days <= 30) return 'warning';
  return 'ok';
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return t('{h} h {m} min', { h, m: String(m).padStart(2, '0') });
  return t('{n} min', { n: m });
}

function formatElapsed(fromIso) {
  if (!fromIso) return '—';
  const start = new Date(fromIso).getTime();
  if (isNaN(start)) return '—';
  return formatDuration(Date.now() - start);
}

function addMinutes(iso, min) {
  if (!iso || min == null) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + min * 60000).toISOString();
}

export default function VehiculeTracage({
  isModal = false,
  initialVehiculeId = null,
}) {
  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(true);
  const [selectedVehiculeId, setSelectedVehiculeId] = useState('');

  const [missions, setMissions] = useState([]);
  const [loadingMissions, setLoadingMissions] = useState(false);

  const [personnelsMap, setPersonnelsMap] = useState({});
  const [emplacementsMap, setEmplacementsMap] = useState({});
  const [conducteurActuel, setConducteurActuel] = useState(null);

  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Suivi live ───
  const [liveProgress, setLiveProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  // ─── Chargement véhicules + personnel ───
  useEffect(() => {
    const load = async () => {
      setLoadingVehicules(true);
      setError(null);
      try {
        const [vehPage, persPage, empPage] = await Promise.all([
          vehiculeService.getAll(0, 500),
          personnelService.getAll(0, 500),
          emplacementService.getAll(0, 500).catch(() => ({ content: [] })),
        ]);
        setVehicules(vehPage.content ?? []);

        const pm = {};
        (persPage.content ?? []).forEach((p) => { pm[p.id] = p; });
        setPersonnelsMap(pm);

        const em = {};
        (empPage.content ?? empPage ?? []).forEach((e) => { em[e.id] = e; });
        setEmplacementsMap(em);
      } catch (err) {
        console.error(err);
        setError(t("Impossible de charger les véhicules."));
      } finally {
        setLoadingVehicules(false);
      }
    };
    load();
  }, [refreshKey]);

  // ─── Sélection auto ───
  useEffect(() => {
    if (selectedVehiculeId) return;
    if (initialVehiculeId != null) {
      setSelectedVehiculeId(String(initialVehiculeId));
      return;
    }
    if (vehicules.length > 0) {
      setSelectedVehiculeId(String(vehicules[0].id));
    }
  }, [vehicules, selectedVehiculeId, initialVehiculeId]);

  // ─── Chargement missions + conducteur ───
  useEffect(() => {
    if (!selectedVehiculeId) return;

    const load = async () => {
      setLoadingMissions(true);
      try {
        const [missionsPage, conducteur] = await Promise.all([
          vehiculeMissionService.getByVehicule(Number(selectedVehiculeId), 0, 50).catch(() => ({ content: [] })),
          vehiculeConducteurService.getConducteurActuel(Number(selectedVehiculeId)).catch(() => null),
        ]);
        setMissions(missionsPage?.content ?? []);
        setConducteurActuel(conducteur ?? null);
      } catch (err) {
        console.error(err);
        setMissions([]);
        setConducteurActuel(null);
      } finally {
        setLoadingMissions(false);
      }
    };
    load();
  }, [selectedVehiculeId, refreshKey]);

  const vehicule = useMemo(
    () => vehicules.find((v) => String(v.id) === String(selectedVehiculeId)),
    [vehicules, selectedVehiculeId]
  );

  const missionEnCours = useMemo(
    () => missions.find((m) => m.etat === 1),
    [missions]
  );

  const derniereMission = useMemo(() => {
    return missions
      .slice()
      .sort((a, b) => new Date(b.dateDepart || 0) - new Date(a.dateDepart || 0))[0];
  }, [missions]);

  // ─── Progression live ───
  useEffect(() => {
    if (!missionEnCours) {
      setLiveProgress(0);
      return;
    }
    const update = () => {
      const start = missionEnCours.dateDepart ? new Date(missionEnCours.dateDepart).getTime() : null;
      const end = missionEnCours.dateRetour
        ? new Date(missionEnCours.dateRetour).getTime()
        : missionEnCours.dateDepart
          ? new Date(missionEnCours.dateDepart).getTime() + 2 * 60 * 60 * 1000
          : null;
      if (!start || !end) { setLiveProgress(0.4); return; }
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;
      setLiveProgress(Math.min(1, Math.max(0, elapsed / total)));
    };
    update();
    intervalRef.current = setInterval(() => {
      update();
      setTick((n) => n + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [missionEnCours]);

  const stats = useMemo(() => {
    const terminees = missions.filter((m) => m.etat === 2);
    const kmTotal = terminees.reduce((sum, m) => {
      const dep = Number(m.kilometrageDepart ?? 0);
      const ret = Number(m.kilometrageRetour ?? 0);
      return sum + Math.max(0, ret - dep);
    }, 0);
    return {
      total: missions.length,
      terminees: terminees.length,
      enCours: missions.filter((m) => m.etat === 1).length,
      kmTotal,
    };
  }, [missions]);

  const conducteurLabel = conducteurActuel
    ? (personnelsMap[conducteurActuel.personnelId || conducteurActuel.id] || conducteurActuel)
    : null;

  // ─── Actions ───
  const handleDemarrer = async () => {
    if (!derniereMission || derniereMission.etat !== 0) return;
    try {
      await vehiculeMissionService.demarrer(derniereMission.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      alert(t("Échec du démarrage."));
    }
  };

  const handleTerminer = async () => {
    if (!missionEnCours) return;
    const kmStr = window.prompt(t('Kilométrage à la fin :'), '');
    try {
      await vehiculeMissionService.terminer(
        missionEnCours.id,
        kmStr && kmStr !== '' ? Number(kmStr) : null,
        null
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      alert(t("Échec de la clôture."));
    }
  };

  if (loadingVehicules) {
    return (
      <div className={`vtr-container ${isModal ? 'vtr-container--modal' : ''}`}>
        <div className="vtr-loading-full">
          <Loader2 size={32} strokeWidth={2} className="vtr-spin" />
          <span>{t("Chargement...")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`vtr-container ${isModal ? 'vtr-container--modal' : ''}`}>

      {/* HEADER */}
      {!isModal ? (
        <div className="vtr-header">
          <div className="vtr-header-left">
            <div className="vtr-header-icon">
              <ICONES_MODULES.tracage size={24} strokeWidth={2} />
            </div>
            <div>
              <h2>{t("Traçage véhicule")}</h2>
              <p>{t("Suivi en temps réel, historique et état")}</p>
            </div>
          </div>

          <div className="vtr-header-right">
            <div className="vtr-select-wrap">
              <Car size={16} strokeWidth={2.5} className="vtr-select-icon" />
              <select value={selectedVehiculeId} onChange={(e) => setSelectedVehiculeId(e.target.value)}>
                <option value="">{t("Sélectionner un véhicule...")}</option>
                {vehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.matricule || t('Véhicule #{id}', { id: v.id })}{v.marque ? ` — ${v.marque}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={2.5} className="vtr-select-chevron" />
            </div>

            <button className="vtr-refresh-btn" onClick={() => setRefreshKey((k) => k + 1)} title={t("Rafraîchir")}>
              <RefreshCw size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : (
        <div className="vtr-modal-toolbar">
          <div className="vtr-select-wrap">
            <Car size={16} strokeWidth={2.5} className="vtr-select-icon" />
            <select value={selectedVehiculeId} onChange={(e) => setSelectedVehiculeId(e.target.value)}>
              <option value="">{t("Sélectionner un véhicule...")}</option>
              {vehicules.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.matricule || t('Véhicule #{id}', { id: v.id })}{v.marque ? ` — ${v.marque}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2.5} className="vtr-select-chevron" />
          </div>

          <button className="vtr-refresh-btn" onClick={() => setRefreshKey((k) => k + 1)} title={t("Rafraîchir")}>
            <RefreshCw size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {error && (
        <div className="vtr-error">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {!vehicule ? (
        <div className="vtr-empty">
          <Car size={48} strokeWidth={1.4} />
          <h3>{t("Aucun véhicule sélectionné")}</h3>
          <p>{t("Choisis un véhicule en haut pour afficher son traçage.")}</p>
        </div>
      ) : (
        <>
          {/* BANDEAU MISSION EN COURS — Version innovante */}
          {missionEnCours && (
            <LiveMissionBanner
              mission={missionEnCours}
              vehicule={vehicule}
              conducteur={conducteurLabel}
              progress={liveProgress}
              onTerminer={handleTerminer}
              emplacementsMap={emplacementsMap}
            />
          )}

          {/* BANDEAU MISSION PRÊTE */}
          {!missionEnCours && derniereMission && derniereMission.etat === 0 && (
            <div className="vtr-ready-banner">
              <div className="vtr-ready-left">
                <div className="vtr-ready-icon">
                  <Clock size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <span className="vtr-ready-label">{t("Mission planifiée prête à démarrer")}</span>
                  <span className="vtr-ready-num">
                    {derniereMission.num || `#${derniereMission.id}`} — {destinationLabel(derniereMission, emplacementsMap) || t("Sans destination")}
                  </span>
                </div>
              </div>
              <button className="vtr-btn-start" onClick={handleDemarrer}>
                <Play size={14} strokeWidth={2.5} />
                {t("Démarrer la mission")}
              </button>
            </div>
          )}

          {/* CARTE VÉHICULE */}
          <div className="vtr-vehicle-card">
            <div className="vtr-vehicle-main">
              <div className="vtr-vehicle-icon-wrap">
                <Car size={26} strokeWidth={2} />
              </div>
              <div className="vtr-vehicle-info">
                <h3>{vehicule.matricule || t('Véhicule #{id}', { id: vehicule.id })}</h3>
                <p>
                  {vehicule.marque && <span>{vehicule.marque}</span>}
                  {vehicule.numChassis && <span> · {vehicule.numChassis}</span>}
                </p>
                <div className="vtr-vehicle-tags">
                  <span className="vtr-tag">{TYPE_LABELS[vehicule.type] ? t(TYPE_LABELS[vehicule.type]) : t('Type {n}', { n: vehicule.type })}</span>
                  <span className="vtr-tag vtr-tag--ghost">{NATURE_LABELS[vehicule.nature] ? t(NATURE_LABELS[vehicule.nature]) : t('Nature {n}', { n: vehicule.nature })}</span>
                </div>
              </div>
            </div>

            <div className="vtr-vehicle-stats">
              <div className="vtr-mini-stat">
                <Gauge size={16} strokeWidth={2.2} />
                <div>
                  <span className="vtr-mini-stat-value">
                    {vehicule.kilometrage != null ? Number(vehicule.kilometrage).toLocaleString(locale()) : '—'}
                  </span>
                  <span className="vtr-mini-stat-label">{t("km compteur")}</span>
                </div>
              </div>

              <div className="vtr-mini-stat">
                <Route size={16} strokeWidth={2.2} />
                <div>
                  <span className="vtr-mini-stat-value">{stats.total}</span>
                  <span className="vtr-mini-stat-label">{t("missions")}</span>
                </div>
              </div>

              <div className="vtr-mini-stat">
                <TrendingUp size={16} strokeWidth={2.2} />
                <div>
                  <span className="vtr-mini-stat-value">{stats.kmTotal.toLocaleString(locale())}</span>
                  <span className="vtr-mini-stat-label">{t("km cumulés")}</span>
                </div>
              </div>

              <div className="vtr-mini-stat">
                <Activity size={16} strokeWidth={2.2} />
                <div>
                  <span className={`vtr-mini-stat-value ${missionEnCours ? 'is-running' : ''}`}>
                    {missionEnCours ? t("En cours") : t("Disponible")}
                  </span>
                  <span className="vtr-mini-stat-label">{t("état")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SUIVI / HISTORIQUE */}
          <div className="vtr-main">
            <div className="vtr-side-card vtr-side-card--full">
              {missionEnCours ? (
                <LiveTrackingPanel
                  mission={missionEnCours}
                  vehicule={vehicule}
                  conducteur={conducteurLabel}
                  progress={liveProgress}
                  tick={tick}
                  onTerminer={handleTerminer}
                  emplacementsMap={emplacementsMap}
                />
              ) : (
                <>
                  <div className="vtr-card-header">
                    <div className="vtr-card-title">
                      <Clock size={16} strokeWidth={2.5} />
                      <span>{t("Historique missions")}</span>
                    </div>
                    <span className="vtr-card-badge">{missions.length}</span>
                  </div>

                  {loadingMissions ? (
                    <div className="vtr-loading">
                      <Loader2 size={22} strokeWidth={2} className="vtr-spin" />
                      <span>{t("Chargement...")}</span>
                    </div>
                  ) : missions.length === 0 ? (
                    <div className="vtr-empty-mini">
                      <Route size={28} strokeWidth={1.5} />
                      <p>{t("Aucune mission enregistrée")}</p>
                    </div>
                  ) : (
                    <div className="vtr-timeline">
                      {missions.map((m) => {
                        const meta = ETAT_META[m.etat] ?? ETAT_META[0];
                        const EtatIcon = meta.Icon;
                        return (
                          <div key={m.id} className={`vtr-timeline-item etat-${meta.class}`}>
                            <div className="vtr-timeline-dot">
                              <EtatIcon size={12} strokeWidth={2.5} />
                            </div>
                            <div className="vtr-timeline-content">
                              <div className="vtr-timeline-head">
                                <span className="vtr-timeline-num">{m.num || `#${m.id}`}</span>
                                <span className={`vtr-pill ${meta.class}`}>{ETAT_LABELS[m.etat] ? t(ETAT_LABELS[m.etat]) : m.etat}</span>
                              </div>
                              <div className="vtr-timeline-body">
                                <span className="vtr-timeline-date">
                                  <Calendar size={12} strokeWidth={2.5} />
                                  {formatDateTime(m.dateDepart)}
                                </span>
                                {destinationLabel(m, emplacementsMap) && (
                                  <span className="vtr-timeline-dest">
                                    <MapPin size={12} strokeWidth={2.5} />
                                    {destinationLabel(m, emplacementsMap)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ÉCHÉANCES */}
          <div className="vtr-echeances">
            <EcheanceCard title={t("Assurance")} Icon={Shield} dateDerniere={vehicule.dateDernierAssurance} dateProchaine={vehicule.dateProchainAssurance} />
            <EcheanceCard title={t("Vignette")} Icon={Shield} dateDerniere={vehicule.dateDernierVignette} dateProchaine={vehicule.dateProchainVignette} />
            <EcheanceCard title={t("Visite technique")} Icon={Shield} dateDerniere={vehicule.dateDernierVisiteTech} dateProchaine={vehicule.dateProchainVisiteTech} />
            <EcheanceCard
              title={t("Vidange")}
              Icon={Wrench}
              dateDerniere={vehicule.dateDernierVidange}
              dateProchaine={vehicule.dateProchainVidange}
              extra={vehicule.kmProchainVidange != null ? t('Prochaine à {n} km', { n: Number(vehicule.kmProchainVidange).toLocaleString(locale()) }) : null}
            />
          </div>

          {/* CONDUCTEUR */}
          {conducteurLabel && (
            <div className="vtr-driver-card">
              <div className="vtr-driver-avatar">
                <User size={20} strokeWidth={2.2} />
              </div>
              <div className="vtr-driver-info">
                <span className="vtr-driver-label">{t("Conducteur actuel")}</span>
                <span className="vtr-driver-name">
                  {conducteurLabel.nom} {conducteurLabel.prenom}
                  {conducteurLabel.matricule && ` (${conducteurLabel.matricule})`}
                </span>
              </div>
              {conducteurActuel?.dateDebut && (
                <div className="vtr-driver-since">
                  <Clock size={14} strokeWidth={2.2} />
                  {t('Depuis le {date}', { date: formatDate(conducteurActuel.dateDebut) })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BANDEAU MISSION EN COURS — Innovant
// ═══════════════════════════════════════════════════════════════
function LiveMissionBanner({ mission, vehicule, conducteur, progress, onTerminer, emplacementsMap = {} }) {
  const pct = Math.min(100, Math.round(progress * 100));
  const missionRef = mission.num || `#${mission.id}`;

  return (
    <div className="vtr-live-banner">
      {/* Décorations */}
      <div className="vtr-live-banner__orb vtr-live-banner__orb--1" />
      <div className="vtr-live-banner__orb vtr-live-banner__orb--2" />
      <div className="vtr-live-banner__grid" />

      {/* Header */}
      <div className="vtr-live-banner__header">
        <div className="vtr-live-banner__header-left">
          <span className="vtr-live-banner__pulse">
            <span className="vtr-live-banner__pulse-core" />
            <span className="vtr-live-banner__pulse-ring" />
          </span>
          <div>
            <span className="vtr-live-banner__label">{t("EN DIRECT")}</span>
            <span className="vtr-live-banner__mission">{missionRef}</span>
          </div>
        </div>

        <div className="vtr-live-banner__header-right">
          <div className="vtr-live-banner__eta">
            <span className="vtr-live-banner__eta-label">{t("Progression")}</span>
            <span className="vtr-live-banner__eta-value">{pct}%</span>
          </div>
          <button className="vtr-live-banner__stop" onClick={onTerminer}>
            <CheckCircle2 size={15} strokeWidth={2.5} />
            {t("Terminer")}
          </button>
        </div>
      </div>

      {/* Route visuelle avec stepper */}
      <div className="vtr-live-banner__route">
        {/* Départ */}
        <div className="vtr-live-banner__endpoint vtr-live-banner__endpoint--start">
          <span className="vtr-live-banner__endpoint-icon">
            <Flag size={14} strokeWidth={2.5} />
          </span>
          <span className="vtr-live-banner__endpoint-label">{t("Départ")}</span>
          <span className="vtr-live-banner__endpoint-time">
            {formatTime(mission.dateDepart)}
          </span>
        </div>

        {/* Barre de progression */}
        <div className="vtr-live-banner__progress">
          <div className="vtr-live-banner__progress-track">
            <div
              className="vtr-live-banner__progress-fill"
              style={{ width: `${pct}%` }}
            />
            {/* Traînée lumineuse */}
            <div
              className="vtr-live-banner__progress-trail"
              style={{ width: `${pct}%` }}
            />
            {/* Voiture */}
            <div
              className="vtr-live-banner__car"
              style={{ left: `${pct}%` }}
            >
              <span className="vtr-live-banner__car-body">
                <Car size={16} strokeWidth={2.5} />
              </span>
              <span className="vtr-live-banner__car-ring" />
            </div>
          </div>
          <div className="vtr-live-banner__progress-dots">
            {[0, 25, 50, 75, 100].map((v) => (
              <span
                key={v}
                className={`vtr-live-banner__progress-dot ${pct >= v ? 'is-done' : ''}`}
                style={{ left: `${v}%` }}
              />
            ))}
          </div>
        </div>

        {/* Arrivée */}
        <div className="vtr-live-banner__endpoint vtr-live-banner__endpoint--end">
          <span className="vtr-live-banner__endpoint-icon">
            <MapPin size={14} strokeWidth={2.5} />
          </span>
          <span className="vtr-live-banner__endpoint-label">
            {destinationLabel(mission, emplacementsMap) || t("Arrivée")}
          </span>
          <span className="vtr-live-banner__endpoint-time">
            {mission.dateRetour ? formatTime(mission.dateRetour) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANNEAU SUIVI LIVE — Innovant avec métriques circulaires
// ═══════════════════════════════════════════════════════════════
function LiveTrackingPanel({ mission, vehicule, conducteur, progress, tick, onTerminer, emplacementsMap = {} }) {
  const pct = Math.min(100, Math.round(progress * 100));
  const etaMin = useMemo(() => {
    const startedAt = mission.dateDepart ? new Date(mission.dateDepart).getTime() : null;
    if (!startedAt || progress <= 0) return null;
    const elapsedMin = (Date.now() - startedAt) / 60000;
    const totalMin = elapsedMin / progress;
    return Math.max(0, Math.round(totalMin - elapsedMin));
  }, [mission.dateDepart, progress, tick]);

  const elapsedMin = useMemo(() => {
    const startedAt = mission.dateDepart ? new Date(mission.dateDepart).getTime() : null;
    if (!startedAt) return null;
    return Math.round((Date.now() - startedAt) / 60000);
  }, [mission.dateDepart, tick]);

  const etaDate = useMemo(() => {
    if (etaMin == null) return null;
    return new Date(Date.now() + etaMin * 60000).toISOString();
  }, [etaMin, tick]);

  // Timeline de la mission
  const timeline = useMemo(() => {
    const steps = [];
    const departAt = mission.dateDepart;
    const now = Date.now();

    if (departAt) {
      steps.push({
        label: t("Mission démarrée"),
        time: formatTime(departAt),
        done: true,
        current: false,
        icon: Play,
      });
    }

    // Point intermédiaire fictif : 50%
    if (progress >= 0.5 && departAt) {
      steps.push({
        label: t("Mi-parcours"),
        time: formatTime(new Date(new Date(departAt).getTime() + (Date.now() - new Date(departAt).getTime()) / 2).toISOString()),
        done: true,
        current: false,
        icon: Target,
      });
    }

    steps.push({
      label: t("En route..."),
      time: t('il y a {duree}', { duree: formatDuration(now - new Date(departAt || now).getTime()) }),
      done: false,
      current: true,
      icon: Car,
    });

    if (etaDate) {
      steps.push({
        label: t('Arrivée estimée'),
        time: formatTime(etaDate),
        done: false,
        current: false,
        icon: Flag,
      });
    }

    return steps;
  }, [mission, progress, etaDate, tick]);

  return (
    <div className="vtr-live-panel">

      {/* ─── Header ─── */}
      <div className="vtr-live-panel__header">
        <div className="vtr-live-panel__title">
          <span className="vtr-live-panel__dot" />
          <span>{t("Suivi en temps réel")}</span>
        </div>
        <span className="vtr-live-panel__ref">
          {mission.num || `#${mission.id}`}
        </span>
      </div>

      {/* ─── Métriques circulaires ─── */}
      <div className="vtr-live-panel__metrics">
        <CircularMetric
          value={pct}
          max={100}
          suffix="%"
          label={t("Progression")}
          color="#1b648f"
        />
        <CircularMetric
          value={elapsedMin ?? 0}
          max={Math.max(elapsedMin ?? 0, etaMin ?? 0, 60)}
          displayValue={elapsedMin != null ? formatDuration(elapsedMin * 60000) : '—'}
          label={t("Temps écoulé")}
          color="#0ea5e9"
        />
        <CircularMetric
          value={etaMin ?? 0}
          max={Math.max(elapsedMin ?? 0, etaMin ?? 0, 60)}
          displayValue={etaMin != null ? formatDuration(etaMin * 60000) : '—'}
          label={t("Temps restant")}
          color="#f59e0b"
        />
      </div>

      {/* ─── Timeline mission ─── */}
      <div className="vtr-live-panel__section">
        <div className="vtr-live-panel__section-title">
          <Activity size={14} strokeWidth={2.5} />
          <span>{t("Chronologie de la mission")}</span>
        </div>

        <div className="vtr-live-timeline">
          {timeline.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div
                key={i}
                className={`vtr-live-timeline__item ${step.done ? 'is-done' : ''} ${step.current ? 'is-current' : ''}`}
              >
                <div className="vtr-live-timeline__marker">
                  <StepIcon size={11} strokeWidth={2.8} />
                </div>
                <div className="vtr-live-timeline__content">
                  <span className="vtr-live-timeline__label">{t(step.label)}</span>
                  <span className="vtr-live-timeline__time">{step.time}</span>
                </div>
                {step.current && <span className="vtr-live-timeline__live">{t("LIVE")}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Briefing ─── */}
      <div className="vtr-live-panel__section">
        <div className="vtr-live-panel__section-title">
          <Zap size={14} strokeWidth={2.5} />
          <span>{t("Briefing")}</span>
        </div>

        <div className="vtr-live-panel__briefing">
          <div className="vtr-live-panel__briefing-item">
            <div className="vtr-live-panel__briefing-icon vtr-live-panel__briefing-icon--green">
              <Car size={13} strokeWidth={2.5} />
            </div>
            <div className="vtr-live-panel__briefing-text">
              <span className="vtr-live-panel__briefing-label">{t("Véhicule")}</span>
              <span className="vtr-live-panel__briefing-value">
                {vehicule.matricule || `#${vehicule.id}`}
              </span>
            </div>
          </div>

          {conducteur && (
            <div className="vtr-live-panel__briefing-item">
              <div className="vtr-live-panel__briefing-icon vtr-live-panel__briefing-icon--blue">
                <User size={13} strokeWidth={2.5} />
              </div>
              <div className="vtr-live-panel__briefing-text">
                <span className="vtr-live-panel__briefing-label">{t("Conducteur")}</span>
                <span className="vtr-live-panel__briefing-value">
                  {conducteur.nom} {conducteur.prenom}
                </span>
              </div>
            </div>
          )}

          {destinationLabel(mission, emplacementsMap) && (
            <div className="vtr-live-panel__briefing-item">
              <div className="vtr-live-panel__briefing-icon vtr-live-panel__briefing-icon--orange">
                <MapPin size={13} strokeWidth={2.5} />
              </div>
              <div className="vtr-live-panel__briefing-text">
                <span className="vtr-live-panel__briefing-label">{t("Destination")}</span>
                <span className="vtr-live-panel__briefing-value">
                  {destinationLabel(mission, emplacementsMap)}
                </span>
              </div>
            </div>
          )}

          <div className="vtr-live-panel__briefing-item">
            <div className="vtr-live-panel__briefing-icon vtr-live-panel__briefing-icon--purple">
              <Clock size={13} strokeWidth={2.5} />
            </div>
            <div className="vtr-live-panel__briefing-text">
              <span className="vtr-live-panel__briefing-label">{t("Départ")}</span>
              <span className="vtr-live-panel__briefing-value">
                {formatDateTime(mission.dateDepart)}
              </span>
            </div>
          </div>

          {mission.localisation && (
            <div className="vtr-live-panel__briefing-item">
              <div className="vtr-live-panel__briefing-icon vtr-live-panel__briefing-icon--teal">
                <Navigation size={13} strokeWidth={2.5} />
              </div>
              <div className="vtr-live-panel__briefing-text">
                <span className="vtr-live-panel__briefing-label">{t("Localisation")}</span>
                <span className="vtr-live-panel__briefing-value">
                  {mission.localisation}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Action ─── */}
      <button className="vtr-live-panel__action" onClick={onTerminer}>
        <CheckCircle2 size={16} strokeWidth={2.5} />
        {t("Terminer la mission")}
      </button>
    </div>
  );
}

// ─── Métrique circulaire SVG ───
function CircularMetric({ value, max, suffix = '', displayValue, label, color }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const displayed = displayValue != null ? displayValue : `${value}${suffix}`;

  return (
    <div className="vtr-circular-metric">
      <div className="vtr-circular-metric__ring">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="6"
          />
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 40 40)"
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 4px ${color}55)`,
            }}
          />
        </svg>
        <span className="vtr-circular-metric__value">{displayed}</span>
      </div>
      <span className="vtr-circular-metric__label">{label}</span>
    </div>
  );
}

// ─── Carte d'échéance ───
function EcheanceCard({ title, Icon, dateDerniere, dateProchaine, extra }) {
  const level = alertLevel(dateProchaine);
  const days = daysUntil(dateProchaine);

  return (
    <div className={`vtr-echeance-card level-${level}`}>
      <div className="vtr-echeance-head">
        <div className="vtr-echeance-icon">
          {level === 'ok' ? <ShieldCheck size={18} strokeWidth={2.2} /> :
           level === 'warning' || level === 'danger' ? <ShieldAlert size={18} strokeWidth={2.2} /> :
           <Icon size={18} strokeWidth={2.2} />}
        </div>
        <span className="vtr-echeance-title">{title}</span>
      </div>

      <div className="vtr-echeance-body">
        <div className="vtr-echeance-row">
          <span className="vtr-echeance-label">{t("Dernière")}</span>
          <span className="vtr-echeance-value">{formatDate(dateDerniere)}</span>
        </div>
        <div className="vtr-echeance-row">
          <span className="vtr-echeance-label">{t("Prochaine")}</span>
          <span className="vtr-echeance-value">{formatDate(dateProchaine)}</span>
        </div>
      </div>

      {days !== null && (
        <div className={`vtr-echeance-badge level-${level}`}>
          {days < 0
            ? t('Expiré depuis {n} j', { n: Math.abs(days) })
            : days === 0
            ? t("Aujourd'hui")
            : tp('dans jours', days)}
        </div>
      )}

      {extra && <div className="vtr-echeance-extra">{extra}</div>}
    </div>
  );
}