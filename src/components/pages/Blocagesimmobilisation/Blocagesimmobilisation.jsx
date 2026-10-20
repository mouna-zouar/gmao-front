import React, { useCallback, useEffect, useMemo, useState } from 'react';
import blocageImmobilisationService from '../../../services/Blocageimmobilisationservice';
import { t, tp, locale } from '../../../i18n';
import { Activity, Ban, Check, Clock, Eye, Flame, Inbox, Info, Layers, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import './BlocagesImmobilisation.css';

/* ---------- Config ---------- */
const STATUT_LABELS = {
  NOUVELLE: 'Nouveau',
  VUE: 'Vu',
  RESOLU: 'Résolu',
  IGNOREE: 'Ignoré',
};

const FILTRES = [
  { key: 'ACTIFS', label: 'Actifs' },
  { key: 'TOUS', label: 'Tous' },
  { key: 'NOUVELLE', label: STATUT_LABELS.NOUVELLE },
  { key: 'VUE', label: STATUT_LABELS.VUE },
  { key: 'RESOLU', label: STATUT_LABELS.RESOLU },
  { key: 'IGNOREE', label: STATUT_LABELS.IGNOREE },
];

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
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
  <LoaderCircle size={15} strokeWidth={2.5} className="blocages-immob-spinner" aria-hidden="true" />
);

const IconClock = () => (
  <Clock size={12} strokeWidth={2} aria-hidden="true" />
);

const IconCheck = () => (
  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
);

const IconEye = () => (
  <Eye size={14} strokeWidth={2} aria-hidden="true" />
);

const IconBan = () => (
  <Ban size={14} strokeWidth={2} aria-hidden="true" />
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

const IconLayers = () => (
  <Layers size={15} strokeWidth={2} aria-hidden="true" />
);

const IconFlame = () => (
  <Flame size={15} strokeWidth={2} aria-hidden="true" />
);

const IconPulse = () => (
  <Activity size={15} strokeWidth={2} aria-hidden="true" />
);

const IconShieldCheck = () => (
  <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
);

/* ---------- Composant ---------- */
export default function BlocagesImmobilisation({ isModal = false }) {
  const [blocages, setBlocages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseMessage, setAnalyseMessage] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('ACTIFS');

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await blocageImmobilisationService.getAll(0, 50);
      setBlocages(page.content ?? []);
    } catch (err) {
      console.error('Erreur chargement blocages :', err);
      setError(t("Impossible de charger les blocages."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const lancerAnalyse = async () => {
    setAnalysing(true);
    setAnalyseMessage(null);
    try {
      const nouveaux = await blocageImmobilisationService.analyserMaintenant();
      setAnalyseMessage(
        nouveaux.length === 0
          ? "Analyse terminée : aucun nouveau blocage détecté."
          : t('Analyse terminée : {resultat}.', { resultat: tp('nouveau blocage', nouveaux.length) })
      );
      await charger();
    } catch (err) {
      console.error('Erreur analyse blocages :', err);
      setAnalyseMessage("Échec de l'analyse. Réessaie plus tard.");
    } finally {
      setAnalysing(false);
    }
  };

  const changerStatut = async (id, statut) => {
    try {
      const updated = await blocageImmobilisationService.changerStatut(id, statut);
      setBlocages((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      console.error('Erreur changement statut blocage :', err);
    }
  };

  const stats = useMemo(() => {
    const actifs = blocages.filter((b) => b.statut === 'NOUVELLE' || b.statut === 'VUE').length;
    const nouveaux = blocages.filter((b) => b.statut === 'NOUVELLE').length;
    const resolus = blocages.filter((b) => b.statut === 'RESOLU').length;
    return { total: blocages.length, actifs, nouveaux, resolus };
  }, [blocages]);

  const blocagesAffiches = blocages.filter((b) => {
    if (filtreStatut === 'TOUS') return true;
    if (filtreStatut === 'ACTIFS') return b.statut === 'NOUVELLE' || b.statut === 'VUE';
    return b.statut === filtreStatut;
  });

  return (
    <div className={`blocages-immob-page ${isModal ? 'blocages-immob-page--modal' : ''}`}>
      {/* ---------- Header (masqué en mode modale) ---------- */}
      {!isModal && (
        <header className="blocages-immob-header">
          <div className="blocages-immob-header__text">
            <span className="blocages-immob-eyebrow">{t("Maintenance · Surveillance")}</span>
            <h1>{t("Blocages d'équipement")}</h1>
            <p>
              {t("Équipements dont le dernier arrêt obligatoire est resté sans suite — pas de bon rouvert, pas de remise en service conforme — depuis au moins 15 jours.")}
            </p>
          </div>

          <button className="blocages-immob-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? t("Analyse en cours") : t("Lancer l'analyse")}</span>
          </button>
        </header>
      )}

      {/* ---------- Bouton analyse en mode modale ---------- */}
      {isModal && (
        <div className="blocages-immob-modal-toolbar">
          <button className="blocages-immob-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? t("Analyse en cours") : t("Lancer l'analyse")}</span>
          </button>
        </div>
      )}

      {/* ---------- Stats ---------- */}
      {!error && (
        <section className="blocages-immob-stats">
          <div className="blocages-immob-stat blocages-immob-stat--total">
            <div className="blocages-immob-stat__head">
              <span className="blocages-immob-stat__label">{t("Total")}</span>
              <span className="blocages-immob-stat__icon"><IconLayers /></span>
            </div>
            <span className="blocages-immob-stat__value">{stats.total}</span>
          </div>

          <div className="blocages-immob-stat blocages-immob-stat--nouveau">
            <div className="blocages-immob-stat__head">
              <span className="blocages-immob-stat__label">{t("Nouveaux")}</span>
              <span className="blocages-immob-stat__icon"><IconFlame /></span>
            </div>
            <span className="blocages-immob-stat__value">{stats.nouveaux}</span>
          </div>

          <div className="blocages-immob-stat blocages-immob-stat--actif">
            <div className="blocages-immob-stat__head">
              <span className="blocages-immob-stat__label">{t("Actifs")}</span>
              <span className="blocages-immob-stat__icon"><IconPulse /></span>
            </div>
            <span className="blocages-immob-stat__value">{stats.actifs}</span>
          </div>

          <div className="blocages-immob-stat blocages-immob-stat--resolu">
            <div className="blocages-immob-stat__head">
              <span className="blocages-immob-stat__label">{t("Résolus")}</span>
              <span className="blocages-immob-stat__icon"><IconShieldCheck /></span>
            </div>
            <span className="blocages-immob-stat__value">{stats.resolus}</span>
          </div>
        </section>
      )}

      {/* ---------- Message d'analyse ---------- */}
      {analyseMessage && (
        <div className="blocages-immob-message">
          <IconInfo />
          <span>{analyseMessage}</span>
        </div>
      )}

      {/* ---------- Filtres ---------- */}
      <div className="blocages-immob-filtres">
        {FILTRES.map(({ key, label }) => (
          <button
            key={key}
            className={`blocages-immob-filtre-btn ${filtreStatut === key ? 'blocages-immob-filtre-btn--active' : ''}`}
            onClick={() => setFiltreStatut(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="blocages-immob-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="blocages-immob-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : blocagesAffiches.length === 0 ? (
        <p className="blocages-immob-empty">
          <IconInbox />
          <span>{t("Aucun blocage pour ce filtre.")}</span>
        </p>
      ) : (
        <ul className="blocages-immob-list">
          {blocagesAffiches.map((b) => {
            const statutKey = b.statut?.toLowerCase();
            return (
              <li key={b.id} className={`blocages-immob-card blocages-immob-card--${statutKey}`}>
                <div className="blocages-immob-card__head">
                  <div className="blocages-immob-card__head-left">
                    <h3 className="blocages-immob-card__titre">{b.cibleNom}</h3>
                    <span className={`blocages-immob-statut blocages-immob-statut--${statutKey}`}>
                      <span className="blocages-immob-statut__dot" />
                      {t(STATUT_LABELS[b.statut] || b.statut)}
                    </span>
                  </div>
                  <span className="blocages-immob-jours">
                    <IconClock />
                    {tp('jours sans suite', b.joursBlocage ?? 0)}
                  </span>
                </div>

                <div className="blocages-immob-card__meta">
                  <div className="blocages-immob-card__meta-item">
                    <span className="blocages-immob-card__meta-label">{t("Arrêté depuis")}</span>
                    <span className="blocages-immob-card__meta-value">{formatDate(b.dateArret)}</span>
                  </div>
                  <div className="blocages-immob-card__meta-item">
                    <span className="blocages-immob-card__meta-label">{t("Bon d'arrêt")}</span>
                    <span className="blocages-immob-card__meta-value">{b.bonMaintenanceArretNum}</span>
                  </div>
                  <div className="blocages-immob-card__meta-item">
                    <span className="blocages-immob-card__meta-label">{t("Détecté le")}</span>
                    <span className="blocages-immob-card__meta-value">{formatDate(b.dateDetection)}</span>
                  </div>
                </div>

                {b.statut === 'RESOLU' && b.personnelTraitantNom === 'Résolution automatique' && (
                  <p className="blocages-immob-card__auto">
                    <IconCheck />
                    {t("Résolu automatiquement — bon rouvert ou remise en service enregistrée.")}
                  </p>
                )}

                {(b.statut === 'NOUVELLE' || b.statut === 'VUE') && (
                  <div className="blocages-immob-card__actions">
                    {b.statut === 'NOUVELLE' && (
                      <button
                        className="blocages-immob-action-btn"
                        onClick={() => changerStatut(b.id, 'VUE')}
                      >
                        <IconEye />
                        {t("Marquer comme vu")}
                      </button>
                    )}
                    <button
                      className="blocages-immob-action-btn blocages-immob-action-btn--ghost"
                      onClick={() => changerStatut(b.id, 'IGNOREE')}
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