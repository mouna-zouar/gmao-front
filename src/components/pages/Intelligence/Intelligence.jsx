import React, { useCallback, useEffect, useMemo, useState } from 'react';
import risqueService from '../../../services/Risqueservice';
import anomalieService from '../../../services/Anomalieservice';
import rcaCapaService from '../../../services/rcaCapaService';
import { t, tp, locale } from '../../../i18n';
import { Clock, Flame, Inbox, LoaderCircle, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import './Intelligence.css';

/* ---------- Config ---------- */
const TOP_RISQUE_LIMITE = 30;
// Parmi le top risque, combien d'équipements on croise avec le RCA (1 appel réseau
// par équipement croisé — on borne pour ne pas multiplier les appels sur un gros parc).
const NB_CROISEMENTS_RCA = 20;

const NIVEAU_LABELS = { CRITIQUE: 'Critique', ELEVE: 'Élevé', MODERE: 'Modéré', FAIBLE: 'Faible' };
const SEVERITE_LABELS = { MODEREE: 'Modérée', ELEVEE: 'Élevée', CRITIQUE: 'Critique' };
const TYPE_ANOMALIE_LABELS = { EQUIPEMENT: 'Équipement', SERVICE: 'Service' };
const TENDANCE_LABELS = { HAUSSE: 'En hausse', BAISSE: 'En baisse', STABLE: 'Stable' };

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

const ACTIONS_CLOSES = new Set(['TERMINEE', 'VERIFIEE_EFFICACE', 'VERIFIEE_INEFFICACE']);

/* ---------- Icônes ---------- */
const IconRefresh = () => (
  <RefreshCw size={15} aria-hidden="true" />
);

const IconSpinner = () => (
  <LoaderCircle size={15} strokeWidth={2.5} className="intel-spinner" aria-hidden="true" />
);

const IconFlame = () => (
  <Flame size={16} aria-hidden="true" />
);

const IconAlertTriangle = () => (
  <TriangleAlert size={16} aria-hidden="true" />
);

const IconClock = () => (
  <Clock size={16} aria-hidden="true" />
);

const IconShieldAlert = () => (
  <ShieldAlert size={16} aria-hidden="true" />
);

const IconInbox = () => (
  <Inbox size={32} strokeWidth={1.5} aria-hidden="true" />
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
      setError(t("Impossible de charger le dashboard Intelligence."));
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
      <header className="intel-header">
        <div className="intel-header__text">
          <h1>{t("Intelligence")}</h1>
          <p>
            {t("Croise les signaux des modules Risques, Anomalies et RCA/CAPA plutôt que de les laisser dans 3 endroits séparés — pour repérer les équipements qui cumulent plusieurs signaux d'alerte en même temps.")}
          </p>
        </div>
        <button className="intel-refresh-btn" onClick={charger} disabled={loading}>
          {loading ? <IconSpinner /> : <IconRefresh />}
          <span>{loading ? t("Chargement") : t("Rafraîchir")}</span>
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
              <span className="intel-kpi__label">{t("Points chauds (risque + RCA ouverte)")}</span>
              <span className="intel-kpi__valeur">{croisementEnCours ? '…' : pointsChauds.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${anomalies.length > 0 ? 'intel-kpi--eleve' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconAlertTriangle /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">{t("Anomalies non traitées")}</span>
              <span className="intel-kpi__valeur">{anomalies.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${actionsEnRetard.length > 0 ? 'intel-kpi--critique' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconClock /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">{t("Actions CAPA en retard")}</span>
              <span className="intel-kpi__valeur">{actionsEnRetard.length}</span>
            </div>
          </div>

          <div className={`intel-kpi ${risquesCritiques.length > 0 ? 'intel-kpi--eleve' : 'intel-kpi--bon'}`}>
            <div className="intel-kpi__icon"><IconShieldAlert /></div>
            <div className="intel-kpi__body">
              <span className="intel-kpi__label">{t("Équipements à risque élevé/critique")}</span>
              <span className="intel-kpi__valeur">{risquesCritiques.length}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Points chauds ---------- */}
      {!loading && (
        <section className="intel-panel intel-panel--chauds">
          <h2 className="intel-panel__title"><IconFlame /> {t("Points chauds")}</h2>
          <p className="intel-panel__subtitle">
            {t("Équipements à risque élevé/critique qui ont aussi une analyse RCA en cours — un problème récurrent qui n'est pas encore vraiment résolu.")}
          </p>

          {croisementEnCours ? (
            <p className="intel-empty">{t("Croisement en cours...")}</p>
          ) : pointsChauds.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>{t("Aucun croisement pour le moment — bon signe.")}</span></p>
          ) : (
            <ul className="intel-chauds-list">
              {pointsChauds.map((c) => (
                <li key={c.risque.lotArticleImmobilistationId} className="intel-chaud-card">
                  <span className={`intel-chaud-score intel-chaud-score--${(c.risque.niveauRisque || '').toLowerCase()}`}>
                    {c.risque.scoreRisque}
                  </span>
                  <div className="intel-chaud-body">
                    <span className="intel-chaud-titre">{c.risque.designation || t('Équipement #{id}', { id: c.risque.lotArticleImmobilistationId })}</span>
                    <span className="intel-chaud-meta">
                      {t('Risque {niveau}', { niveau: t(NIVEAU_LABELS[c.risque.niveauRisque] || c.risque.niveauRisque).toLowerCase() })}
                      {' · '}{tp('analyse RCA', c.nbAnalyses)}
                      {c.nbActionsOuvertes > 0 && ` · ${tp('action CAPA ouverte', c.nbActionsOuvertes)}`}
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
          <h2 className="intel-panel__title"><IconAlertTriangle /> {t("Anomalies non traitées")}</h2>
          {loading ? (
            <p className="intel-empty">{t("Chargement...")}</p>
          ) : anomalies.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>{t("Aucune anomalie non traitée.")}</span></p>
          ) : (
            <ul className="intel-list">
              {anomalies.slice(0, 8).map((a) => (
                <li key={a.id} className={`intel-list-item intel-list-item--${(a.severite || '').toLowerCase()}`}>
                  <div className="intel-list-item__top">
                    <span className="intel-list-item__titre">{a.cibleNom || `${t(TYPE_ANOMALIE_LABELS[a.type] || a.type)} #${a.cibleId}`}</span>
                    <span className="intel-badge">{t(SEVERITE_LABELS[a.severite] || a.severite)}</span>
                  </div>
                  <span className="intel-list-item__meta">
                    {tp('réclamation récente', a.nombreReclamations ?? 0)} {t('(moyenne habituelle {m})', { m: a.moyenneHistorique?.toFixed(1) ?? '—' })} · {formatDate(a.dateDetection)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Actions CAPA en retard ---------- */}
        <section className="intel-panel">
          <h2 className="intel-panel__title"><IconClock /> {t("Actions CAPA en retard")}</h2>
          {loading ? (
            <p className="intel-empty">{t("Chargement...")}</p>
          ) : actionsEnRetard.length === 0 ? (
            <p className="intel-empty"><IconInbox /><span>{t("Aucune action en retard.")}</span></p>
          ) : (
            <ul className="intel-list">
              {actionsEnRetard.slice(0, 8).map((a) => (
                <li key={a.id} className="intel-list-item intel-list-item--critique">
                  <div className="intel-list-item__top">
                    <span className="intel-list-item__titre">{t(a.description)}</span>
                    <span className="intel-badge">{a.type === 'PREVENTIVE' ? t("Préventive") : t("Corrective")}</span>
                  </div>
                  <span className="intel-list-item__meta">
                    {a.responsable ? `${a.responsable} · ` : ''}{t('Échéance dépassée : {date}', { date: formatDateTime(a.dateEcheance) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Top équipements à risque ---------- */}
      <section className="intel-panel">
        <h2 className="intel-panel__title"><IconShieldAlert /> {t("Équipements les plus à risque")}</h2>
        {loading ? (
          <p className="intel-empty">{t("Chargement...")}</p>
        ) : risques.length === 0 ? (
          <p className="intel-empty"><IconInbox /><span>{t("Aucune donnée de risque disponible.")}</span></p>
        ) : (
          <ul className="intel-list intel-list--risque">
            {risques.slice(0, 10).map((r) => (
              <li key={r.lotArticleImmobilistationId} className={`intel-list-item intel-list-item--${(r.niveauRisque || '').toLowerCase()}`}>
                <div className="intel-list-item__top">
                  <span className="intel-list-item__titre">{r.designation || t('Équipement #{id}', { id: r.lotArticleImmobilistationId })}</span>
                  <span className="intel-badge">{r.scoreRisque}/100</span>
                </div>
                <span className="intel-list-item__meta">
                  {tp('panne sur 12 mois', r.nbPannes12Mois ?? 0)} · {t('tendance {t}', { t: t(TENDANCE_LABELS[r.tendance] || r.tendance || '—').toLowerCase() })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}