import React, { useCallback, useEffect, useMemo, useState } from 'react';
import anomalieService from '../../../services/Anomalieservice';
import { t, tp, locale } from '../../../i18n';
import { Ban, Cpu, Eye, Inbox, Info, Layers, LoaderCircle, TriangleAlert, Users, Zap } from 'lucide-react';
import './Anomalies.css';

/* ---------- Config ---------- */
const SEVERITE_LABELS = {
  MODEREE: 'Modérée',
  ELEVEE: 'Élevée',
  CRITIQUE: 'Critique',
};

const SEVERITE_CLASS = {
  MODEREE: 'anomalies-badge--moderee',
  ELEVEE: 'anomalies-badge--elevee',
  CRITIQUE: 'anomalies-badge--critique',
};

const STATUT_LABELS = {
  NOUVELLE: 'Nouvelle',
  VUE: 'Vue',
  IGNOREE: 'Ignorée',
};

const TYPE_LABELS = {
  EQUIPEMENT: 'Équipement',
  SERVICE: 'Service',
};

const FILTRES = [
  { key: 'TOUTES', label: 'Toutes' },
  { key: 'NOUVELLE', label: STATUT_LABELS.NOUVELLE },
  { key: 'VUE', label: STATUT_LABELS.VUE },
  { key: 'IGNOREE', label: STATUT_LABELS.IGNOREE },
];

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Icônes ---------- */
const IconSearch = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const IconSpinner = () => (
  <LoaderCircle size={15} strokeWidth={2.5} className="anomalies-spinner" aria-hidden="true" />
);

const IconInfo = () => (
  <Info size={16} strokeWidth={2} aria-hidden="true" />
);

const IconInbox = () => (
  <Inbox size={36} strokeWidth={1.5} aria-hidden="true" />
);

const IconAlert = () => (
  <TriangleAlert size={36} strokeWidth={1.5} aria-hidden="true" />
);

const IconEye = () => (
  <Eye size={14} strokeWidth={2} aria-hidden="true" />
);

const IconBan = () => (
  <Ban size={14} strokeWidth={2} aria-hidden="true" />
);

const IconLayers = () => (
  <Layers size={15} strokeWidth={2} aria-hidden="true" />
);

const IconShieldAlert = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const IconZap = () => (
  <Zap size={15} strokeWidth={2} aria-hidden="true" />
);

const IconCpu = () => (
  <Cpu size={12} strokeWidth={2} aria-hidden="true" />
);

const IconUsers = () => (
  <Users size={12} strokeWidth={2} aria-hidden="true" />
);

/* ---------- Composant ---------- */
export default function Anomalies({ isModal = false }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseMessage, setAnalyseMessage] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('TOUTES');

  const chargerAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await anomalieService.getAll(0, 50);
      setAnomalies(page.content ?? []);
    } catch (err) {
      console.error('Erreur chargement anomalies :', err);
      setError(t("Impossible de charger les anomalies."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { chargerAnomalies(); }, [chargerAnomalies]);

  const lancerAnalyse = async () => {
    setAnalysing(true);
    setAnalyseMessage(null);
    try {
      const nouvelles = await anomalieService.analyserMaintenant();
      setAnalyseMessage(
        nouvelles.length === 0
          ? "Analyse terminée : aucune nouvelle anomalie détectée."
          : t('Analyse terminée : {resultat}.', { resultat: tp('nouvelle anomalie', nouvelles.length) })
      );
      await chargerAnomalies();
    } catch (err) {
      console.error('Erreur analyse anomalies :', err);
      setAnalyseMessage("Échec de l'analyse. Réessaie plus tard.");
    } finally {
      setAnalysing(false);
    }
  };

  const changerStatut = async (id, statut) => {
    try {
      const updated = await anomalieService.changerStatut(id, statut);
      setAnomalies((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      console.error('Erreur changement statut anomalie :', err);
    }
  };

  const stats = useMemo(() => {
    const moderees = anomalies.filter((a) => a.severite === 'MODEREE').length;
    const elevees = anomalies.filter((a) => a.severite === 'ELEVEE').length;
    const critiques = anomalies.filter((a) => a.severite === 'CRITIQUE').length;
    return { total: anomalies.length, moderees, elevees, critiques };
  }, [anomalies]);

  const anomaliesAffichees = filtreStatut === 'TOUTES'
    ? anomalies
    : anomalies.filter((a) => a.statut === filtreStatut);

  return (
    <div className={`anomalies-page ${isModal ? 'anomalies-page--modal' : ''}`}>
      {/* ---------- Header (masqué en mode modale) ---------- */}
      {!isModal && (
        <header className="anomalies-header">
          <div className="anomalies-header__text">
            <span className="anomalies-eyebrow">{t("Détection · Surveillance")}</span>
            <h1>{t("Détection d'anomalies")}</h1>
            <p>
              {t("Pics anormaux de réclamations par équipement ou par service, détectés automatiquement chaque jour à 6h.")}
            </p>
          </div>

          <button className="anomalies-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? t("Analyse en cours") : t("Lancer l'analyse")}</span>
          </button>
        </header>
      )}

      {/* ---------- Bouton analyse en mode modale ---------- */}
      {isModal && (
        <div className="anomalies-modal-toolbar">
          <button className="anomalies-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? t("Analyse en cours") : t("Lancer l'analyse")}</span>
          </button>
        </div>
      )}

      {/* ---------- Stats ---------- */}
      {!error && (
        <section className="anomalies-stats">
          <div className="anomalies-stat anomalies-stat--total">
            <div className="anomalies-stat__head">
              <span className="anomalies-stat__label">{t("Total")}</span>
              <span className="anomalies-stat__icon"><IconLayers /></span>
            </div>
            <span className="anomalies-stat__value">{stats.total}</span>
          </div>

          <div className="anomalies-stat anomalies-stat--moderee">
            <div className="anomalies-stat__head">
              <span className="anomalies-stat__label">{t("Modérées")}</span>
              <span className="anomalies-stat__icon"><IconShieldAlert /></span>
            </div>
            <span className="anomalies-stat__value">{stats.moderees}</span>
          </div>

          <div className="anomalies-stat anomalies-stat--elevee">
            <div className="anomalies-stat__head">
              <span className="anomalies-stat__label">{t("Élevées")}</span>
              <span className="anomalies-stat__icon"><IconZap /></span>
            </div>
            <span className="anomalies-stat__value">{stats.elevees}</span>
          </div>

          <div className="anomalies-stat anomalies-stat--critique">
            <div className="anomalies-stat__head">
              <span className="anomalies-stat__label">{t("Critiques")}</span>
              <span className="anomalies-stat__icon"><IconAlert /></span>
            </div>
            <span className="anomalies-stat__value">{stats.critiques}</span>
          </div>
        </section>
      )}

      {/* ---------- Message d'analyse ---------- */}
      {analyseMessage && (
        <div className="anomalies-message">
          <IconInfo />
          <span>{analyseMessage}</span>
        </div>
      )}

      {/* ---------- Filtres ---------- */}
      <div className="anomalies-filtres">
        {FILTRES.map(({ key, label }) => (
          <button
            key={key}
            className={`anomalies-filtre-btn ${filtreStatut === key ? 'anomalies-filtre-btn--active' : ''}`}
            onClick={() => setFiltreStatut(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="anomalies-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="anomalies-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : anomaliesAffichees.length === 0 ? (
        <p className="anomalies-empty">
          <IconInbox />
          <span>
            {filtreStatut !== 'TOUTES'
              ? t('Aucune anomalie au statut « {statut} » pour le moment.', { statut: t(STATUT_LABELS[filtreStatut]) })
              : t('Aucune anomalie détectée pour le moment.')}
          </span>
        </p>
      ) : (
        <ul className="anomalies-list">
          {anomaliesAffichees.map((a) => {
            const statutKey = a.statut?.toLowerCase();
            const severiteKey = a.severite?.toLowerCase();
            const TypeIcon = a.type === 'EQUIPEMENT' ? IconCpu : IconUsers;
            return (
              <li
                key={a.id}
                className={`anomalies-card anomalies-card--${severiteKey}`}
              >
                <div className="anomalies-card__head">
                  <div className="anomalies-card__head-left">
                    <span className={`anomalies-badge ${SEVERITE_CLASS[a.severite] || ''}`}>
                      <span className="anomalies-badge__dot" />
                      {t(SEVERITE_LABELS[a.severite] || a.severite)}
                    </span>
                    <span className="anomalies-type">
                      <TypeIcon />
                      {t(TYPE_LABELS[a.type] || a.type)}
                    </span>
                  </div>
                  <div className="anomalies-card__head-right">
                    <span className={`anomalies-statut anomalies-statut--${statutKey}`}>
                      <span className="anomalies-statut__dot" />
                      {t(STATUT_LABELS[a.statut] || a.statut)}
                    </span>
                  </div>
                </div>

                <h3 className="anomalies-card__titre">{a.cibleNom}</h3>

                <div className="anomalies-card__count">
                  <span className="anomalies-card__count-value">{a.nombreReclamations}</span>
                  <span className="anomalies-card__count-label">
                    {t("réclamations sur les 7 derniers jours")}
                  </span>
                </div>

                <div className="anomalies-card__meta">
                  <div className="anomalies-card__meta-item">
                    <span className="anomalies-card__meta-label">{t("Moyenne habituelle")}</span>
                    <span className="anomalies-card__meta-value">
                      {a.moyenneHistorique ?? 0} <span className="anomalies-card__meta-value--muted">{t("/ semaine")}</span>
                    </span>
                  </div>
                  <div className="anomalies-card__meta-item">
                    <span className="anomalies-card__meta-label">{t("Période analysée")}</span>
                    <span className="anomalies-card__meta-value">
                      {formatDate(a.periodeDebut)} <span className="anomalies-card__meta-value--muted rtl-miroir">→</span> {formatDate(a.periodeFin)}
                    </span>
                  </div>
                  <div className="anomalies-card__meta-item">
                    <span className="anomalies-card__meta-label">{t("Détectée le")}</span>
                    <span className="anomalies-card__meta-value">{formatDateTime(a.dateDetection)}</span>
                  </div>
                </div>

                {a.statut === 'NOUVELLE' && (
                  <div className="anomalies-card__actions">
                    <button
                      className="anomalies-action-btn"
                      onClick={() => changerStatut(a.id, 'VUE')}
                    >
                      <IconEye />
                      {t("Marquer comme vue")}
                    </button>
                    <button
                      className="anomalies-action-btn anomalies-action-btn--ghost"
                      onClick={() => changerStatut(a.id, 'IGNOREE')}
                    >
                      <IconBan />
                      {t("Ignorer")}
                    </button>
                  </div>
                )}
                {a.statut === 'VUE' && (
                  <div className="anomalies-card__actions">
                    <button
                      className="anomalies-action-btn anomalies-action-btn--ghost"
                      onClick={() => changerStatut(a.id, 'IGNOREE')}
                    >
                      <IconBan />
                      {t("Ignorer")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}