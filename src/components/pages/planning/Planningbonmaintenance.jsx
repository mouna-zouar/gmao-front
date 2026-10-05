import React, { useState, useEffect, useMemo, useCallback } from 'react';
import planningService from '../../../services/planningService';
import './PlanningBonMaintenance.css';

const MODE_OPTIONS = [
  { value: 'BON_MAINTENANCE', label: 'Bons de maintenance' },
  { value: 'INTERVENANT', label: 'Intervenants' },
  { value: 'TACHE', label: 'Tâches' },
];

const ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const ETAT_EVENT_CLASS = {
  1: 'event-etat-nouveau',
  2: 'event-etat-suspendu',
  3: 'event-etat-encours',
  4: 'event-etat-effectue',
  10: 'event-etat-annule',
};

const MAX_VISIBLE_EVENTS = {
  month: 3,
  week: 8,
  day: Infinity,
};

const formatDateKey = (date) => {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateLong = (date) =>
  date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

const PlanningBonMaintenance = ({ onSelectBonMaintenance, onDayClick }) => {
  const [mode, setMode] = useState('BON_MAINTENANCE');
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [dateFilter, setDateFilter] = useState(formatDateKey(new Date()));
  const [popover, setPopover] = useState(null);

  useEffect(() => {
    planningService.findConfig().then(setConfig).catch((err) => {
      console.warn('Config planning indisponible :', err);
      setConfig(null);
    });
  }, []);

  useEffect(() => {
    if (dateFilter) {
      const parts = dateFilter.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        const newDate = new Date(year, month - 1, day);
        if (!isNaN(newDate.getTime())) setCurrentDate(newDate);
      }
    }
  }, [dateFilter]);

  useEffect(() => { setPopover(null); }, [view, mode, currentDate]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];

    if (view === 'month') {
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInPrevMonth = getDaysInMonth(year, month - 1);

      for (let i = 0; i < firstDay; i++) {
        const d = new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1);
        days.push({ date: d, isCurrentMonth: false });
      }
      for (let i = 1; i <= daysInMonth; i++) {
        days.push({ date: new Date(year, month, i), isCurrentMonth: true });
      }
      const totalCells = 42;
      const remaining = totalCells - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    } else if (view === 'week') {
      const start = getStartOfWeek(currentDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push({ date: d, isCurrentMonth: d.getMonth() === month });
      }
    } else if (view === 'day') {
      days.push({ date: new Date(currentDate), isCurrentMonth: true });
    }

    return days;
  }, [currentDate, view]);

  const load = useCallback(async () => {
    if (calendarDays.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const start = new Date(calendarDays[0].date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(calendarDays[calendarDays.length - 1].date);
      end.setHours(23, 59, 59, 0);

      const data = await planningService.findEvenements(mode, start, end);
      setEvenements(data ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger le planning. Vérifie que le serveur est bien lancé.");
      setEvenements([]);
    } finally {
      setLoading(false);
    }
  }, [mode, calendarDays]);

  useEffect(() => { load(); }, [load]);

  const getEventsForDate = (date) => {
    const dateKey = formatDateKey(date);
    if (!dateKey) return [];
    return evenements.filter((ev) => {
      const debut = ev.dateDebut ? new Date(ev.dateDebut) : null;
      const fin = ev.dateFin ? new Date(ev.dateFin) : debut;
      if (!debut) return false;
      const debutKey = formatDateKey(debut);
      const finKey = formatDateKey(fin || debut);
      return dateKey >= debutKey && dateKey <= finKey;
    });
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    setDateFilter(formatDateKey(newDate));
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    setDateFilter(formatDateKey(newDate));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setDateFilter(formatDateKey(now));
  };

  const handleDayCellClick = (date) => {
    if (config?.dayClick && onDayClick) onDayClick(date);
  };

  const handleEventClick = (e, ev) => {
    e.stopPropagation();
    if (onSelectBonMaintenance && ev.bonMaintenanceId) {
      onSelectBonMaintenance(ev.bonMaintenanceId);
      setPopover(null);
    }
  };

  const handleMoreClick = (e, date, events) => {
    e.stopPropagation();
    setPopover({ date, events });
  };

  const closePopover = () => setPopover(null);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const daysOfWeek = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const daysOfWeekShort = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const getHeaderText = () => {
    if (view === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (view === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${currentDate.getFullYear()}`;
    }
    return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const maxVisible = MAX_VISIBLE_EVENTS[view] ?? 3;

  return (
    <div className="planning-bm-container">
      <div className="planning-bm-filters-bar">
        <div className="planning-bm-filter-group">
          <label>Vue par</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="planning-bm-select">
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="planning-bm-filter-group">
          <label>Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="planning-bm-date-input"
          />
        </div>

        <button type="button" className="planning-bm-today-btn" onClick={handleToday}>
          Aujourd'hui
        </button>
      </div>

      {error && <div className="planning-bm-error-banner">{error}</div>}

      <div className="planning-bm-calendar-card">
        <div className="planning-bm-calendar-header">
          <div className="planning-bm-header-left">
            <div className="planning-bm-nav-buttons">
              <button onClick={handlePrev} className="planning-bm-icon-btn" aria-label="Précédent">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={handleNext} className="planning-bm-icon-btn" aria-label="Suivant">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="planning-bm-header-center">
            <h2>{getHeaderText()}</h2>
          </div>

          <div className="planning-bm-header-right">
            <div className="planning-bm-view-tabs">
              <button className={`planning-bm-tab ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mois</button>
              <button className={`planning-bm-tab ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Semaine</button>
              <button className={`planning-bm-tab ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Jour</button>
            </div>
          </div>
        </div>

        <div className={`planning-bm-grid view-${view}`}>
          {view !== 'day' && (
            <div className="planning-bm-weekdays">
              {(view === 'week' ? daysOfWeek : daysOfWeekShort).map((day, i) => (
                <div key={`${day}-${i}`} className="planning-bm-weekday">{day}</div>
              ))}
            </div>
          )}

          <div className="planning-bm-days">
            {loading ? (
              <div className="planning-bm-loading">Chargement du planning...</div>
            ) : calendarDays.map((item, idx) => {
              const { date, isCurrentMonth } = item;
              const allEvents = getEventsForDate(date);
              const visibleEvents = allEvents.length > maxVisible
                ? allEvents.slice(0, maxVisible)
                : allEvents;
              const hiddenCount = allEvents.length - visibleEvents.length;
              const isToday = formatDateKey(date) === formatDateKey(new Date());
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <div
                  key={idx}
                  className={[
                    'planning-bm-day-cell',
                    !isCurrentMonth && view === 'month' ? 'other-month' : '',
                    isToday ? 'is-today' : '',
                    isWeekend && view !== 'day' ? 'is-weekend' : '',
                    allEvents.length === 0 ? 'is-empty' : '',
                    config?.dayClick ? 'clickable' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleDayCellClick(date)}
                >
                  <div className="planning-bm-day-header">
                    <div className="planning-bm-day-title">
                      <span className="planning-bm-day-number">{date.getDate()}</span>
                      {view === 'day' && (
                        <span className="planning-bm-day-name">
                          {daysOfWeek[date.getDay()]}
                        </span>
                      )}
                    </div>
                    {allEvents.length > 0 && view !== 'day' && (
                      <span className="planning-bm-day-count">
                        {allEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="planning-bm-events-container">
                    <div className="planning-bm-events-list">
                      {visibleEvents.map((ev) => (
                        <div
                          key={`${ev.type}-${ev.id}`}
                          className={`planning-bm-event-pill ${ETAT_EVENT_CLASS[ev.etat] || 'event-etat-nouveau'}`}
                          title={`${ev.titre || ''} — ${ETAT_LABELS[ev.etat] || ''}`}
                          onClick={(e) => handleEventClick(e, ev)}
                        >
                          <span className="planning-bm-event-dot" />
                          <span className="planning-bm-event-title">{ev.titre || `#${ev.id}`}</span>
                        </div>
                      ))}
                    </div>

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="planning-bm-more-events"
                        onClick={(e) => handleMoreClick(e, date, allEvents)}
                      >
                        +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
                      </button>
                    )}

                    {allEvents.length === 0 && view === 'day' && (
                      <div className="planning-bm-no-events">Aucun événement ce jour.</div>
                    )}
                  </div>

                  {isToday && <span className="planning-bm-today-badge">Aujourd'hui</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {popover && (
        <div className="planning-bm-popover-backdrop" onClick={closePopover}>
          <div className="planning-bm-popover" onClick={(e) => e.stopPropagation()}>
            <div className="planning-bm-popover-header">
              <div>
                <div className="planning-bm-popover-date">{formatDateLong(popover.date)}</div>
                <div className="planning-bm-popover-count">
                  {popover.events.length} événement{popover.events.length > 1 ? 's' : ''}
                </div>
              </div>
              <button
                type="button"
                className="planning-bm-popover-close"
                onClick={closePopover}
                aria-label="Fermer"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="planning-bm-popover-body">
              {popover.events.map((ev) => (
                <div
                  key={`pop-${ev.type}-${ev.id}`}
                  className={`planning-bm-event-pill ${ETAT_EVENT_CLASS[ev.etat] || 'event-etat-nouveau'}`}
                  onClick={(e) => handleEventClick(e, ev)}
                >
                  <span className="planning-bm-event-dot" />
                  <span className="planning-bm-event-title">{ev.titre || `#${ev.id}`}</span>
                  <span className="planning-bm-event-etat">
                    {ETAT_LABELS[ev.etat] || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningBonMaintenance;