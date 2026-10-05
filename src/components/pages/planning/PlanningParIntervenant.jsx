import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import planningService from '../../../services/planningService';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import './PlanningParIntervenant.css';

const MODE_OPTIONS = [
  { value: 'INTERVENANT', label: 'Interventions' },
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

const formatDateKey = (date) => {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

const PlanningParIntervenant = ({ onSelectBonMaintenance, onDayClick }) => {
  const [intervenants, setIntervenants] = useState([]);
  const [selectedIntervenantId, setSelectedIntervenantId] = useState('');
  const [mode, setMode] = useState('BON_MAINTENANCE');
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [dateFilter, setDateFilter] = useState(formatDateKey(new Date()));

  // Charger la config et la liste des intervenants
  useEffect(() => {
    planningService.findConfig().then(setConfig).catch(() => setConfig(null));
    Promise.all([
      personnelService.getAll(0, 200).then(res => res.content || []),
      prestataireService.getAll(0, 200).then(res => res.content || [])
    ])
      .then(([personnels, prestataires]) => {
        const all = [
          ...personnels.map(p => ({ 
            id: `personnel-${p.id}`, 
            originalId: p.id, 
            nom: `${p.nom} ${p.prenom}`, 
            type: 'personnel' 
          })),
          ...prestataires.map(p => ({ 
            id: `prestataire-${p.id}`, 
            originalId: p.id, 
            nom: p.raisonSociale || `${p.nom} ${p.prenom}`, 
            type: 'prestataire' 
          }))
        ];
        setIntervenants(all);
      })
      .catch(console.error);
  }, []);

  // Synchroniser le champ date avec currentDate
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

  // Générer les jours du calendrier
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];

    if (view === 'month') {
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInPrevMonth = getDaysInMonth(year, month - 1);
      for (let i = 0; i < firstDay; i++) {
        days.push({ date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1), isCurrentMonth: false });
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

  // Charger les événements lorsque l'intervenant, le mode ou la plage change
  const load = useCallback(async () => {
    if (!selectedIntervenantId) {
      setEvenements([]);
      return;
    }
    if (calendarDays.length === 0) return;
    setLoading(true);
    setError(null);

    // Récupérer l'originalId depuis l'ID préfixé
    const selected = intervenants.find(i => i.id === selectedIntervenantId);
    if (!selected) {
      setEvenements([]);
      setLoading(false);
      return;
    }

    try {
      let data;
      if (mode === 'INTERVENANT') {
        data = await planningService.findByIntervenant(selected.originalId);
      } else {
        const start = new Date(calendarDays[0].date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(calendarDays[calendarDays.length - 1].date);
        end.setHours(23, 59, 59, 0);
        const all = await planningService.findEvenements(mode, start, end);
        data = all.filter(ev => 
          ev.intervenantId && String(ev.intervenantId) === String(selected.originalId)
        );
      }
      setEvenements(data ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger le planning de l'intervenant.");
      setEvenements([]);
    } finally {
      setLoading(false);
    }
  }, [mode, calendarDays, selectedIntervenantId, intervenants]);

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
    }
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const daysOfWeek = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

  const getHeaderText = () => {
    if (view === 'month') return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === 'week') {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${currentDate.getFullYear()}`;
    }
    return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  return (
    <div className="planning-bm-container">
      <div className="planning-bm-filters-bar">
        <div className="planning-bm-filter-group">
          <label>Intervenant :</label>
          <select
            value={selectedIntervenantId}
            onChange={(e) => setSelectedIntervenantId(e.target.value)}
            className="planning-bm-select"
          >
            <option value="">— Sélectionner un intervenant —</option>
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nom} {i.type === 'prestataire' ? '(prestataire)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="planning-bm-filter-group">
          <label>Vue :</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="planning-bm-select">
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="planning-bm-filter-group">
          <label>Date :</label>
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
              <button onClick={handlePrev} className="planning-bm-icon-btn"><ChevronLeft size={20} /></button>
              <button onClick={handleNext} className="planning-bm-icon-btn"><ChevronRight size={20} /></button>
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
              {daysOfWeek.map((day) => <div key={day} className="planning-bm-weekday">{day}</div>)}
            </div>
          )}

          <div className="planning-bm-days">
            {loading ? (
              <div className="planning-bm-loading">Chargement du planning...</div>
            ) : !selectedIntervenantId ? (
              <div className="planning-bm-loading">Veuillez sélectionner un intervenant.</div>
            ) : calendarDays.map((item, idx) => {
              const { date, isCurrentMonth } = item;
              const events = getEventsForDate(date);
              const isToday = formatDateKey(date) === formatDateKey(new Date());

              return (
                <div
                  key={idx}
                  className={`planning-bm-day-cell ${!isCurrentMonth && view === 'month' ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${config?.dayClick ? 'clickable' : ''}`}
                  onClick={() => handleDayCellClick(date)}
                >
                  <div className="planning-bm-day-header">
                    <span className="planning-bm-day-number">{date.getDate()}</span>
                    {view === 'day' && <span className="planning-bm-day-name">{daysOfWeek[date.getDay()]}</span>}
                  </div>

                  <div className="planning-bm-events-container">
                    {events.map((ev) => (
                      <div
                        key={`${ev.type}-${ev.id}`}
                        className={`planning-bm-event-pill ${ETAT_EVENT_CLASS[ev.etat] || 'event-etat-nouveau'}`}
                        title={`${ev.titre || ''} — ${ETAT_LABELS[ev.etat] || ''}`}
                        onClick={(e) => handleEventClick(e, ev)}
                      >
                        <div className="planning-bm-event-color-bar"></div>
                        <span className="planning-bm-event-title">{ev.titre || `#${ev.id}`}</span>
                      </div>
                    ))}
                    {events.length === 0 && view === 'day' && (
                      <div className="planning-bm-no-events">Aucun événement ce jour.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningParIntervenant;