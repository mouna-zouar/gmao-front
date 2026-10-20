import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Route, BookmarkCheck } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import parcPlanningService from '../../../../services/parcPlanningService';
import './ParcPlanning.css';
import { t, locale } from '../../../../i18n';

// Mêmes libellés que VehiculeMissions.jsx / VehiculeReservations.jsx —
// gardés en phase avec ces deux pages plutôt que réutilisés directement,
// pour ne pas créer de dépendance entre pages qui restent indépendantes.
const MISSION_ETAT_LABELS = { 0: 'Planifiée', 1: 'En cours', 2: 'Terminée', 3: 'Annulée' };
const MISSION_ETAT_COLOR = { 0: 'blue', 1: 'teal', 2: 'slate', 3: 'red' };

const RESERVATION_ETAT_LABELS = { 0: 'En attente', 1: 'Acceptée', 2: 'Refusée', 3: 'Annulée', 4: 'Terminée' };
const RESERVATION_ETAT_COLOR = { 0: 'amber', 1: 'blue', 2: 'red', 3: 'red', 4: 'slate' };

// Jours (lundi → dimanche) dans la langue courante : Lun / الاثنين / Mon.
// 2000-01-03 est un lundi. L'app est remontée à chaque changement de langue.
const nomsJours = () => Array.from({ length: 7 }, (_, i) => {
  const s = new Intl.DateTimeFormat(locale(), { weekday: 'short' })
    .format(new Date(2000, 0, 3 + i))
    .replace('.', '');
  return s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
});

function lundiDeLaSemaine(date) {
  const d = new Date(date);
  const jour = d.getDay(); // 0 = dimanche
  const diff = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function ajouterJours(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function memeJour(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Un événement (mission ou réservation) "touche" un jour si son intervalle
// [dateDebut, dateFin) chevauche [jour 00:00, jour+1 00:00).
function toucheJour(dateDebutIso, dateFinIso, jour) {
  if (!dateDebutIso) return false;
  const debut = new Date(dateDebutIso);
  const fin = dateFinIso ? new Date(dateFinIso) : debut;
  const jourDebut = new Date(jour);
  const jourFin = ajouterJours(jourDebut, 1);
  return debut < jourFin && fin > jourDebut;
}

function formatHeure(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function formatDateCourte(d) {
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });
}

export default function ParcPlanning() {
  const [weekStart, setWeekStart] = useState(() => lundiDeLaSemaine(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [afficherMissions, setAfficherMissions] = useState(true);
  const [afficherReservations, setAfficherReservations] = useState(true);

  const JOURS = useMemo(nomsJours, []);
  const jours = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ajouterJours(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await parcPlanningService.getPlanning(weekStart, ajouterJours(weekStart, 7));
      setData(result);
    } catch (err) {
      console.error('Erreur chargement planning parc :', err);
      setError(t('Impossible de charger le planning. Vérifie que le serveur est bien lancé.'));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const vehicules = data?.vehicules || [];
  const missions = afficherMissions ? (data?.missions || []) : [];
  const reservations = afficherReservations ? (data?.reservations || []) : [];

  const aujourdhui = new Date();

  return (
    <div className="parcplan-container">
      {/* HEADER */}
      <div className="parcplan-header">
        <div className="parcplan-header-icon-wrap"><ICONES_MODULES.planningParc size={24} /></div>
        <div className="parcplan-header-text">
          <h1>{t('Planning — Missions & Réservations')}</h1>
          <p>{t('Vue hebdomadaire par véhicule')}</p>
        </div>
        <div className="parcplan-nav">
          <button className="parcplan-nav-btn" onClick={() => setWeekStart((w) => ajouterJours(w, -7))} title={t('Semaine précédente')} aria-label={t('Semaine précédente')}>
            <ChevronLeft size={18} className="rtl-miroir" />
          </button>
          <button className="parcplan-nav-today" onClick={() => setWeekStart(lundiDeLaSemaine(new Date()))}>
            {t("Aujourd'hui")}
          </button>
          <button className="parcplan-nav-btn" onClick={() => setWeekStart((w) => ajouterJours(w, 7))} title={t('Semaine suivante')} aria-label={t('Semaine suivante')}>
            <ChevronRight size={18} className="rtl-miroir" />
          </button>
        </div>
      </div>

      <div className="parcplan-toolbar">
        <span className="parcplan-week-label">
          {formatDateCourte(jours[0])} — {formatDateCourte(jours[6])} {jours[6].getFullYear()}
        </span>
        <div className="parcplan-toggles">
          <label className="parcplan-toggle">
            <input type="checkbox" checked={afficherMissions} onChange={(e) => setAfficherMissions(e.target.checked)} />
            <span className="parcplan-dot color-blue" /> {t('Missions')}
          </label>
          <label className="parcplan-toggle">
            <input type="checkbox" checked={afficherReservations} onChange={(e) => setAfficherReservations(e.target.checked)} />
            <span className="parcplan-dot color-amber" /> {t('Réservations')}
          </label>
        </div>
      </div>

      {/* LÉGENDE DES COULEURS — conditionnelle selon les toggles */}
      {(afficherMissions || afficherReservations) && (
        <div className="parcplan-legend">
          {afficherMissions && (
            <div className="parcplan-legend-group">
              <span className="parcplan-legend-group-title">
                <Route size={13} strokeWidth={2.5} />
                {t('Missions')}
              </span>
              <div className="parcplan-legend-items">
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-blue" />
                  {t('Planifiée')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-teal" />
                  {t('En cours')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-slate" />
                  {t('Terminée')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-red" />
                  {t('Annulée')}
                </span>
              </div>
            </div>
          )}

          {afficherReservations && (
            <div className="parcplan-legend-group">
              <span className="parcplan-legend-group-title">
                <BookmarkCheck size={13} strokeWidth={2.5} />
                {t('Réservations')}
              </span>
              <div className="parcplan-legend-items">
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-amber" />
                  {t('En attente')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-blue" />
                  {t('Acceptée')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-red" />
                  {t('Refusée / Annulée')}
                </span>
                <span className="parcplan-legend-item">
                  <span className="parcplan-legend-swatch color-slate" />
                  {t('Terminée')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="parcplan-error-banner">{error}</div>}

      {loading && !data ? (
        <div className="parcplan-loading">
          <Loader2 size={28} className="parcplan-spin" />
          <p>{t('Chargement du planning...')}</p>
        </div>
      ) : (
        <div className="parcplan-grid-wrap">
          <table className="parcplan-grid">
            <thead>
              <tr>
                <th className="parcplan-col-vehicule">{t('Véhicule')}</th>
                {jours.map((jour) => (
                  <th key={jour.toISOString()} className={memeJour(jour, aujourdhui) ? 'parcplan-col-today' : ''}>
                    <span className="parcplan-jour-nom">{JOURS[(jour.getDay() + 6) % 7]}</span>
                    <span className="parcplan-jour-date">{formatDateCourte(jour)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicules.length === 0 ? (
                <tr><td colSpan={8} className="parcplan-empty">{t('Aucun véhicule dans le parc.')}</td></tr>
              ) : (
                vehicules.map((v) => (
                  <tr key={v.id}>
                    <td className="parcplan-col-vehicule">
                      <span className="parcplan-matricule">{v.matricule || `#${v.id}`}</span>
                      {v.marque && <span className="parcplan-marque">{v.marque}</span>}
                    </td>
                    {jours.map((jour) => {
                      const missionsJour = missions.filter((m) => m.vehiculeId === v.id && toucheJour(m.dateDebut, m.dateFin, jour));
                      const reservationsJour = reservations.filter((r) => r.vehiculeId === v.id && toucheJour(r.dateDebut, r.dateFin, jour));
                      const vide = missionsJour.length === 0 && reservationsJour.length === 0;
                      return (
                        <td key={jour.toISOString()} className={`parcplan-cell ${memeJour(jour, aujourdhui) ? 'parcplan-col-today' : ''}`}>
                          {vide ? (
                            <span className="parcplan-cell-empty">—</span>
                          ) : (
                            <div className="parcplan-cell-events">
                              {missionsJour.map((m) => (
                                <div
                                  key={`m-${m.id}`}
                                  className={`parcplan-event color-${MISSION_ETAT_COLOR[m.etat] ?? 'slate'}`}
                                  title={`${t('Mission {num}', { num: m.num || '' })} — ${MISSION_ETAT_LABELS[m.etat] ? t(MISSION_ETAT_LABELS[m.etat]) : m.etat}\n${formatHeure(m.dateDebut)} → ${formatHeure(m.dateFin)}${m.motif ? `\n${m.motif}` : ''}`}
                                >
                                  {m.num || t('Mission')} · {formatHeure(m.dateDebut)}
                                </div>
                              ))}
                              {reservationsJour.map((r) => (
                                <div
                                  key={`r-${r.id}`}
                                  className={`parcplan-event color-${RESERVATION_ETAT_COLOR[r.etat] ?? 'slate'}`}
                                  title={`${t('Réservation')} — ${RESERVATION_ETAT_LABELS[r.etat] ? t(RESERVATION_ETAT_LABELS[r.etat]) : r.etat}\n${formatHeure(r.dateDebut)} → ${formatHeure(r.dateFin)}\n${r.personnelNom || ''}${r.motif ? `\n${r.motif}` : ''}`}
                                >
                                  {r.personnelNom || t('Réservation')} · {formatHeure(r.dateDebut)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}