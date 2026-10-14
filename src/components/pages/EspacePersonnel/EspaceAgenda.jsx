import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Wrench } from 'lucide-react';
import { t, tp, locale } from '../../../i18n';
import { cleJour, debutJour, estUrgent, joursCouverts, versDate } from './espacePlanning';

/*
 * Colonne de droite de l'espace personnel :
 *  - un mini calendrier du mois avec les travaux à faire (tâches et bons) ;
 *  - « À surveiller » : ce qui est en retard ou dont l'échéance est très proche.
 */

const TONS = { retard: 'alerte', aujourdhui: 'attention', proche: 'attention', 'plus-tard': 'action' };

function BadgeEcheance({ statut }) {
  if (!statut) return null;
  return <span className={`ep-echeance ep-echeance--${statut.niveau}`}>{statut.texte}</span>;
}

function LigneTravail({ travail, onOuvrir, compacte = false }) {
  const Icone = travail.type === 'tache' ? ClipboardList : Wrench;
  return (
    <li>
      <button
        type="button"
        className={`ep-travail ep-ton--${TONS[travail.statut?.niveau] || 'neutre'} ${compacte ? 'ep-travail--compacte' : ''}`}
        onClick={() => onOuvrir(travail)}
      >
        <span className="ep-travail-icone" aria-hidden="true"><Icone size={14} /></span>
        <span className="ep-travail-texte">
          <span className="ep-travail-titre">{travail.titre}</span>
          {travail.sousTitre && <span className="ep-travail-sous">{travail.sousTitre}</span>}
        </span>
        <BadgeEcheance statut={travail.statut} />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini calendrier                                                    */
/* ------------------------------------------------------------------ */

export function MiniCalendrier({ travaux, onOuvrir }) {
  const aujourdhui = debutJour(new Date());
  const [mois, setMois] = useState(() => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
  const [jourChoisi, setJourChoisi] = useState(aujourdhui);

  // Travaux par jour (un travail sur plusieurs jours apparaît sur chacun)
  const parJour = useMemo(() => {
    const map = new Map();
    travaux.forEach((tr) => joursCouverts(tr).forEach((cle) => {
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle).push(tr);
    }));
    return map;
  }, [travaux]);

  // Grille : semaines commençant le lundi, 6 lignes maximum
  const cases = useMemo(() => {
    const premier = new Date(mois);
    const decalage = (premier.getDay() + 6) % 7;
    const debut = new Date(premier);
    debut.setDate(premier.getDate() - decalage);
    const nbJoursMois = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
    const nbCases = Math.ceil((decalage + nbJoursMois) / 7) * 7;
    return Array.from({ length: nbCases }, (_, i) => {
      const d = new Date(debut);
      d.setDate(debut.getDate() + i);
      return d;
    });
  }, [mois]);

  const nomsJours = useMemo(() => {
    const lundi = new Date(2024, 0, 1); // un lundi
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      return {
        court: d.toLocaleDateString(locale(), { weekday: 'narrow' }),
        long: d.toLocaleDateString(locale(), { weekday: 'long' }),
      };
    });
  }, []);

  const changerMois = (delta) => setMois((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const allerAujourdhui = () => {
    setMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
    setJourChoisi(aujourdhui);
  };

  const travauxDuJour = parJour.get(cleJour(jourChoisi)) || [];
  const titreMois = mois.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const titreJour = jourChoisi.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="ep-carte ep-calendrier" aria-label={t('Calendrier de mes travaux')}>
      <header className="ep-carte-entete">
        <h2><CalendarDays size={17} /> <span className="ep-majuscule">{titreMois}</span></h2>
        <div className="ep-cal-nav">
          <button type="button" onClick={() => changerMois(-1)} aria-label={t('Mois précédent')} title={t('Mois précédent')}>
            <ChevronLeft size={16} className="rtl-miroir" />
          </button>
          <button type="button" className="ep-cal-auj" onClick={allerAujourdhui}>{t("Aujourd'hui")}</button>
          <button type="button" onClick={() => changerMois(1)} aria-label={t('Mois suivant')} title={t('Mois suivant')}>
            <ChevronRight size={16} className="rtl-miroir" />
          </button>
        </div>
      </header>

      <div className="ep-cal-grille">
        {nomsJours.map((j) => (
          <span key={j.long} className="ep-cal-jsem" title={j.long} aria-hidden="true">{j.court}</span>
        ))}
        {cases.map((d) => {
          const cle = cleJour(d);
          const liste = parJour.get(cle) || [];
          const horsMois = d.getMonth() !== mois.getMonth();
          const estAuj = cle === cleJour(aujourdhui);
          const estChoisi = cle === cleJour(jourChoisi);
          const retard = liste.some((tr) => tr.statut?.niveau === 'retard');
          const urgent = liste.some((tr) => estUrgent(tr.statut));
          const classes = [
            'ep-cal-jour',
            horsMois && 'is-hors-mois',
            estAuj && 'is-aujourdhui',
            estChoisi && 'is-choisi',
            liste.length > 0 && 'a-travaux',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={cle}
              type="button"
              className={classes}
              aria-pressed={estChoisi}
              aria-label={`${d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}${liste.length ? ` · ${tp('travail', liste.length)}` : ''}`}
              onClick={() => setJourChoisi(debutJour(d))}
            >
              <span className="ep-cal-num">{d.getDate()}</span>
              {liste.length > 0 && (
                <span className={`ep-cal-points ${retard ? 'is-retard' : urgent ? 'is-proche' : ''}`} aria-hidden="true">
                  {liste.slice(0, 3).map((tr) => <i key={tr.cle} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="ep-cal-jour-detail">
        <h3 className="ep-majuscule">{titreJour}</h3>
        {travauxDuJour.length === 0 ? (
          <p className="ep-cal-vide">{t('Aucun travail prévu ce jour-là.')}</p>
        ) : (
          <ul className="ep-travaux">
            {travauxDuJour.map((tr) => <LigneTravail key={tr.cle} travail={tr} onOuvrir={onOuvrir} compacte />)}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  En retard / échéance très proche                                   */
/* ------------------------------------------------------------------ */

export function ASurveiller({ travaux, onOuvrir }) {
  const urgents = travaux.filter((tr) => estUrgent(tr.statut));
  const nbRetard = urgents.filter((tr) => tr.statut.niveau === 'retard').length;
  const nbProches = urgents.length - nbRetard;
  const sansDate = travaux.filter((tr) => !versDate(tr.echeance)).length;

  return (
    <section className="ep-carte ep-surveiller" aria-label={t('À surveiller')}>
      <header className="ep-carte-entete">
        <h2><AlertTriangle size={17} /> {t('À surveiller')}</h2>
      </header>
      <div className="ep-surveiller-compteurs">
        <span className={`ep-compteur ${nbRetard ? 'ep-compteur--retard' : ''}`}>
          <strong>{nbRetard}</strong> {t('en retard')}
        </span>
        <span className={`ep-compteur ${nbProches ? 'ep-compteur--proche' : ''}`}>
          <strong>{nbProches}</strong> {t('échéance proche')}
        </span>
      </div>

      {urgents.length === 0 ? (
        <p className="ep-cal-vide">{t('Rien en retard, et aucune échéance dans les 2 prochains jours.')}</p>
      ) : (
        <ul className="ep-travaux">
          {urgents.map((tr) => <LigneTravail key={tr.cle} travail={tr} onOuvrir={onOuvrir} />)}
        </ul>
      )}

      {sansDate > 0 && (
        <p className="ep-surveiller-note">{tp('travail sans date', sansDate)}</p>
      )}
    </section>
  );
}
