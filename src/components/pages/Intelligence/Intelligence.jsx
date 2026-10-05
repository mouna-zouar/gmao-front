import React, { useCallback, useEffect, useMemo, useState } from 'react';
import risqueService from '../../../services/Risqueservice';
import anomalieService from '../../../services/Anomalieservice';
import rcaCapaService from '../../../services/rcaCapaService';
import './Intelligence.css';

/* ---------- Config ---------- */
const TOP_RISQUE_LIMITE = 30;
// Parmi le top risque, combien d'équipements on croise avec le RCA (1 appel réseau
// par équipement croisé — on borne pour ne pas multiplier les appels sur un gros parc).
const NB_CROISEMENTS_RCA = 20;

const NIVEAU_LABELS = { CRITIQUE: 'Critique', ELEVE: 'Élevé', MODERE: 'Modéré', FAIBLE: 'Faible' };
const SEVERITE_LABELS = { MODEREE: 'Modérée', ELEVEE: 'Élevée', CRITIQUE: 'Critique' };
const TYPE_ANOMALIE_LABELS = { EQUIPEMENT: 'Équipement', SERVICE: 'Service' };

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const ACTIONS_CLOSES = new Set(['TERMINEE', 'VERIFIEE_EFFICACE', 'VERIFIEE_INEFFICACE']);

/* ---------- Icônes ---------- */
const Svg = (props) => (
  <svg width={props.size || 15} height={props.size || 15} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const IconRefresh = () => (
  <Svg><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 4v5h-5M3 20v-5h5" /></Svg>
);

const IconSpinner = () => (
  <svg className="intel-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconFlame = () => (
  <Svg size={16}><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2 0 2-1.5 3-2.5 2C15.5 7 13 5 12 2Z" /><path d="M8 14a4 4 0 1 0 8 0c0-2-1-3-2-5-1 2-2 2.5-3 1-1 2-3 2-3 4Z" /></Svg>
);

const IconAlertTriangle = () => (
  <Svg size={16}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Svg>
);

const IconClock = () => (
  <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Svg>
);

const IconShieldAlert = () => (
  <Svg size={16}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="M12 8v4M12 16h.01" /></Svg>
);

const IconInbox = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

/* ---------- Composant ---------- */
export default function Intelligence({ isModal = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [risques, setRisques] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [actionsEnRetard, setActionsEnRetard] = useState([]);
  const [pointsChauds, setPointsChauds] = useState([]);
  const [croisementEnCours, setCroisementEnCours] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPointsChauds([]);
    try {
      const [risquesData, anomaliesPage, retardData] = await Promise.all([
        risqueService.getRisques(TOP_RISQUE_LIMITE),
        anomalieService.getAll(0, 50),
        rcaCapaService.getActionsEnRetard(),
      ]);

      const risquesList = risquesData ?? [];
      setRisques(risquesList);
      setAnomalies((anomaliesPage?.content ?? []).filter((a) => a.statut === 'NOUVELLE'));
      setActionsEnRetard(retardData ?? []);
    } catch (err) {
      console.error('Erreur chargement dashboard Intelligence :', err);
      setError('Impossible de charger le dashboard Intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Croisement risque x RCA : parmi les équipements les plus à risque, lesquels ont
  // aussi une analyse RCA avec au moins une action encore ouverte ? C'est ça, la
  // vraie valeur ajoutée d'un dashboard "Intelligence" plutôt que 3 listes séparées.
  useEffect(() => {
    if (risques.length === 0) return;
    let annule = false;

    const candidats = risques
      .filter((r) => r.niveauRisque === 'CRITIQUE' || r.niveauRisque === 'ELEVE')
      .slice(0, NB_CROISEMENTS_RCA);

    if (candidats.length === 0) return;

    setCroisementEnCours(true);
    Promise.all(candidats.map((r) =>
      rcaCapaService.getParEquipement(r.lotArticleImmobilistationId)
        .then((analyses) => ({ risque: r, analyses: analyses ?? [] }))
        .catch(() => ({ risque: r, analyses: [] }))
    )).then((resultats) => {
      if (annule) return;
      const chauds = resultats
        .map(({ risque, analyses }) => {
          const actionsOuvertes = analyses.flatMap((a) => a.actions || []).filter((a) => !ACTIONS_CLOSES.has(a.statut));
          return { risque, nbAnalyses: analyses.length, nbActionsOuvertes: actionsOuvertes.length };
        })
        .filter((c) => c.nbActionsOuvertes > 0 || c.nbAnalyses > 0)
        .sort((a, b) => (b.risque.scoreRisque || 0) - (a.risque.scoreRisque || 0));
      setPointsChauds(chauds);
    }).finally(() => {
      if (!annule) setCroisementEnCours(false);
    });

    return () => { annule = true; };
  }, [risques]);

  const risquesCritiques = useMemo(
    () => risques.filter((r) => r.niveauRisque === 'CRITIQUE' || r.niveauRisque === 'ELEVE'),
    [risques]
  );

  return (
    <div className={`intel-page ${isModal ? 'intel-page--modal' : ''}`}>
      {/* ---------- Header ---------- */}
      <header className="intel-header">
        <div className="intel-header__text">
          <span className="intel-eyebrow">Roadmap métier · Étape ⑧ · Vue consolidée</span>
          <h1>Intelligence</h1>
          <p>
            Croise les signaux des modules Risques, Anomalies et RCA/CAPA plutôt que de les
            laisser dans 3 endroits séparés — pour repérer les équipements qui cumulent
            plusieurs signaux d'alerte en même temps.
          </p>
        </div>
        <button className="intel-refresh-btn" onClick={charger} disabled={loading}>
          {loading ? <IconSpinner /> : <IconRefresh />}
          <span>{loading ? 'Chargement' : 'Rafraîchir'}</span>
        </button>
      </header>

      {error && (
        <p className="intel-error"><IconAlertTriangle /> <span>{error}</span></p>
      )}

      {/* ---------- KPIs ---------- */}
      {!loading && (
        <section className="intel-kpis">
          <div className={`intel-kpi ${pointsChauds.length > 0 ? 'intel-kpi--critique' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconFlame /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">Points chauds (risque + RCA ouverte)</span>
              <span className="intel-kpi__valeur">{croisementEnCours ? '…' : pointsChauds.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${anomalies.length > 0 ? 'intel-kpi--eleve' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconAlertTriangle /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">Anomalies non traitées</span>
              <span className="intel-kpi__valeur">{anomalies.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${actionsEnRetard.length > 0 ? 'intel-kpi--critique' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconClock /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">Actions CAPA en retard</span>
              <span className="intel-kpi__valeur">{actionsEnRetard.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${risquesCritiques.length > 0 ? 'intel-kpi--eleve' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconShieldAlert /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">Équipements à risque élevé/critique</span>
              <span className="intel-kpi__valeur">{risquesCritiques.length}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Points chauds ---------- */}
      {!loading && (
        <section className="intel-panel intel-panel--chauds">
          <h2 className="intel-panel__title"><IconFlame /> Points chauds</h2>
          <p className="intel-panel__subtitle">
            Équipements à risque élevé/critique qui ont aussi une analyse RCA en cours —
            un problème récurrent qui n'est pas encore vraiment résolu.
          </p>

          {croisementEnCours ? (
            <p className="intel-empty">Croisement en cours...</p>
          ) : pointsChauds.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>Aucun croisement pour le moment — bon signe.</span></p>
          ) : (
            <ul className="intel-chauds-list">
              {pointsChauds.map((c) => (
                <li key={c.risque.lotArticleImmobilistationId} className="intel-chaud-card">
                  <span className={`intel-chaud-score intel-chaud-score--${(c.risque.niveauRisque || '').toLowerCase()}`}>
                    {c.risque.scoreRisque}
                  </span>
                  <div className="intel-chaud-body">
                    <span className="intel-chaud-titre">{c.risque.designation || `Équipement #${c.risque.lotArticleImmobilistationId}`}</span>
                    <span className="intel-chaud-meta">
                      Risque {NIVEAU_LABELS[c.risque.niveauRisque] || c.risque.niveauRisque}
                      {' · '}{c.nbAnalyses} analyse{c.nbAnalyses > 1 ? 's' : ''} RCA
                      {c.nbActionsOuvertes > 0 && ` · ${c.nbActionsOuvertes} action${c.nbActionsOuvertes > 1 ? 's' : ''} CAPA ouverte${c.nbActionsOuvertes > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="intel-grid">
        {/* ---------- Anomalies non traitées ---------- */}
        <section className="intel-panel">
          <h2 className="intel-panel__title"><IconAlertTriangle /> Anomalies non traitées</h2>
          {loading ? (
            <p className="intel-empty">Chargement...</p>
          ) : anomalies.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>Aucune anomalie non traitée.</span></p>
          ) : (
            <ul className="intel-list">
              {anomalies.slice(0, 8).map((a) => (
                <li key={a.id} className={`intel-list-item intel-list-item--${(a.severite || '').toLowerCase()}`}>
                  <div className="intel-list-item__top">
                    <span className="intel-list-item__titre">{a.cibleNom || `${TYPE_ANOMALIE_LABELS[a.type] || a.type} #${a.cibleId}`}</span>
                    <span className="intel-badge">{SEVERITE_LABELS[a.severite] || a.severite}</span>
                  </div>
                  <span className="intel-list-item__meta">
                    {a.nombreReclamations} réclamation{a.nombreReclamations > 1 ? 's' : ''} récentes (moyenne habituelle {a.moyenneHistorique?.toFixed(1)}) · {formatDate(a.dateDetection)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Actions CAPA en retard ---------- */}
        <section className="intel-panel">
          <h2 className="intel-panel__title"><IconClock /> Actions CAPA en retard</h2>
          {loading ? (
            <p className="intel-empty">Chargement...</p>
          ) : actionsEnRetard.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>Aucune action en retard.</span></p>
          ) : (
            <ul className="intel-list">
              {actionsEnRetard.slice(0, 8).map((a) => (
                <li key={a.id} className="intel-list-item intel-list-item--critique">
                  <div className="intel-list-item__top">
                    <span className="intel-list-item__titre">{a.description}</span>
                    <span className="intel-badge">{a.type === 'PREVENTIVE' ? 'Préventive' : 'Corrective'}</span>
                  </div>
                  <span className="intel-list-item__meta">
                    {a.responsable ? `${a.responsable} · ` : ''}Échéance dépassée : {formatDateTime(a.dateEcheance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Top équipements à risque ---------- */}
      <section className="intel-panel">
        <h2 className="intel-panel__title"><IconShieldAlert /> Équipements les plus à risque</h2>
        {loading ? (
          <p className="intel-empty">Chargement...</p>
        ) : risques.length === 0 ? (
          <p className="intel-empty"><IconInbox /><span>Aucune donnée de risque disponible.</span></p>
        ) : (
          <ul className="intel-list intel-list--risque">
            {risques.slice(0, 10).map((r) => (
              <li key={r.lotArticleImmobilistationId} className={`intel-list-item intel-list-item--${(r.niveauRisque || '').toLowerCase()}`}>
                <div className="intel-list-item__top">
                  <span className="intel-list-item__titre">{r.designation || `Équipement #${r.lotArticleImmobilistationId}`}</span>
                  <span className="intel-badge">{r.scoreRisque}/100</span>
                </div>
                <span className="intel-list-item__meta">
                  {r.nbPannes12Mois} panne{r.nbPannes12Mois > 1 ? 's' : ''} / 12 mois · tendance {(r.tendance || '').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}