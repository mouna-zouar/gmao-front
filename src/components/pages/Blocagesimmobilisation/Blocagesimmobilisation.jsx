import React, { useCallback, useEffect, useMemo, useState } from 'react';
import blocageImmobilisationService from '../../../services/Blocageimmobilisationservice';
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
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
  <svg className="blocages-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconBan = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </svg>
);

const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

const IconAlert = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconLayers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

const IconFlame = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 10 8 12 8 14a4 4 0 0 0 8 0c0-3-2-5-4-11Z" />
  </svg>
);

const IconPulse = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
);

const IconShieldCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
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
      setError('Impossible de charger les blocages.');
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
          : `Analyse terminée : ${nouveaux.length} nouveau${nouveaux.length > 1 ? 'x' : ''} blocage${nouveaux.length > 1 ? 's' : ''} détecté${nouveaux.length > 1 ? 's' : ''}.`
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
    <div className={`blocages-page ${isModal ? 'blocages-page--modal' : ''}`}>
      {/* ---------- Header (masqué en mode modale) ---------- */}
      {!isModal && (
        <header className="blocages-header">
          <div className="blocages-header__text">
            <span className="blocages-eyebrow">Maintenance · Surveillance</span>
            <h1>Blocages d'équipement</h1>
            <p>
              Équipements dont le dernier arrêt obligatoire est resté sans suite — pas de bon
              rouvert, pas de remise en service conforme — depuis au moins 15 jours.
            </p>
          </div>

          <button className="blocages-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? 'Analyse en cours' : "Lancer l'analyse"}</span>
          </button>
        </header>
      )}

      {/* ---------- Bouton analyse en mode modale ---------- */}
      {isModal && (
        <div className="blocages-modal-toolbar">
          <button className="blocages-analyser-btn" onClick={lancerAnalyse} disabled={analysing}>
            {analysing ? <IconSpinner /> : <IconSearch />}
            <span>{analysing ? 'Analyse en cours' : "Lancer l'analyse"}</span>
          </button>
        </div>
      )}

      {/* ---------- Stats ---------- */}
      {!error && (
        <section className="blocages-stats">
          <div className="blocages-stat blocages-stat--total">
            <div className="blocages-stat__head">
              <span className="blocages-stat__label">Total</span>
              <span className="blocages-stat__icon"><IconLayers /></span>
            </div>
            <span className="blocages-stat__value">{stats.total}</span>
          </div>

          <div className="blocages-stat blocages-stat--nouveau">
            <div className="blocages-stat__head">
              <span className="blocages-stat__label">Nouveaux</span>
              <span className="blocages-stat__icon"><IconFlame /></span>
            </div>
            <span className="blocages-stat__value">{stats.nouveaux}</span>
          </div>

          <div className="blocages-stat blocages-stat--actif">
            <div className="blocages-stat__head">
              <span className="blocages-stat__label">Actifs</span>
              <span className="blocages-stat__icon"><IconPulse /></span>
            </div>
            <span className="blocages-stat__value">{stats.actifs}</span>
          </div>

          <div className="blocages-stat blocages-stat--resolu">
            <div className="blocages-stat__head">
              <span className="blocages-stat__label">Résolus</span>
              <span className="blocages-stat__icon"><IconShieldCheck /></span>
            </div>
            <span className="blocages-stat__value">{stats.resolus}</span>
          </div>
        </section>
      )}

      {/* ---------- Message d'analyse ---------- */}
      {analyseMessage && (
        <div className="blocages-message">
          <IconInfo />
          <span>{analyseMessage}</span>
        </div>
      )}

      {/* ---------- Filtres ---------- */}
      <div className="blocages-filtres">
        {FILTRES.map(({ key, label }) => (
          <button
            key={key}
            className={`blocages-filtre-btn ${filtreStatut === key ? 'blocages-filtre-btn--active' : ''}`}
            onClick={() => setFiltreStatut(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="blocages-empty">Chargement...</p>
      ) : error ? (
        <p className="blocages-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : blocagesAffiches.length === 0 ? (
        <p className="blocages-empty">
          <IconInbox />
          <span>Aucun blocage pour ce filtre.</span>
        </p>
      ) : (
        <ul className="blocages-list">
          {blocagesAffiches.map((b) => {
            const statutKey = b.statut?.toLowerCase();
            return (
              <li key={b.id} className={`blocages-card blocages-card--${statutKey}`}>
                <div className="blocages-card__head">
                  <div className="blocages-card__head-left">
                    <h3 className="blocages-card__titre">{b.cibleNom}</h3>
                    <span className={`blocages-statut blocages-statut--${statutKey}`}>
                      <span className="blocages-statut__dot" />
                      {STATUT_LABELS[b.statut] || b.statut}
                    </span>
                  </div>
                  <span className="blocages-jours">
                    <IconClock />
                    {b.joursBlocage} j sans suite
                  </span>
                </div>

                <div className="blocages-card__meta">
                  <div className="blocages-card__meta-item">
                    <span className="blocages-card__meta-label">Arrêté depuis</span>
                    <span className="blocages-card__meta-value">{formatDate(b.dateArret)}</span>
                  </div>
                  <div className="blocages-card__meta-item">
                    <span className="blocages-card__meta-label">Bon d'arrêt</span>
                    <span className="blocages-card__meta-value">{b.bonMaintenanceArretNum}</span>
                  </div>
                  <div className="blocages-card__meta-item">
                    <span className="blocages-card__meta-label">Détecté le</span>
                    <span className="blocages-card__meta-value">{formatDate(b.dateDetection)}</span>
                  </div>
                </div>

                {b.statut === 'RESOLU' && b.personnelTraitantNom === 'Résolution automatique' && (
                  <p className="blocages-card__auto">
                    <IconCheck />
                    Résolu automatiquement — bon rouvert ou remise en service enregistrée.
                  </p>
                )}

                {(b.statut === 'NOUVELLE' || b.statut === 'VUE') && (
                  <div className="blocages-card__actions">
                    {b.statut === 'NOUVELLE' && (
                      <button
                        className="blocages-action-btn"
                        onClick={() => changerStatut(b.id, 'VUE')}
                      >
                        <IconEye />
                        Marquer comme vu
                      </button>
                    )}
                    <button
                      className="blocages-action-btn blocages-action-btn--ghost"
                      onClick={() => changerStatut(b.id, 'IGNOREE')}
                    >
                      <IconBan />
                      Ignorer
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