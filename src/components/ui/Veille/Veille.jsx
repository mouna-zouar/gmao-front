import { Inbox, Info, X } from 'lucide-react';
import { t, locale } from '../../../i18n';
import './Veille.css';
import Pagination from '../../commun/Pagination';

export function VeillePage({ isModal, icone: Icone, titre, description, actions, children, className = '' }) {
  return (
    <div className={`vl-page ${isModal ? 'vl-page--fenetre' : ''} ${className}`}>
      {!isModal && (
        <header className="vl-entete">
          <div className="vl-entete__texte">
            {Icone && <span className="vl-entete__icone"><Icone size={22} aria-hidden="true" /></span>}
            <div>
              <h1>{titre}</h1>
              {description && <p>{description}</p>}
            </div>
          </div>
          {actions && <div className="vl-entete__actions">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

export function VeilleKpis({ items, label }) {
  return (
    <section className="vl-kpis" aria-label={label}>
      {items.map((k) => {
        const contenu = (
          <>
            <span className="vl-kpi__label">
              <span className="vl-kpi__point" aria-hidden="true" />
              {k.label}
            </span>
            <span className="vl-kpi__valeur">{k.valeur}</span>
            {k.aide && <span className="vl-kpi__aide">{k.aide}</span>}
          </>
        );
        return k.onClick ? (
          <button
            key={k.cle}
            type="button"
            className={`vl-kpi ${k.actif ? 'is-actif' : ''}`}
            data-ton={k.ton || 'neutre'}
            onClick={k.onClick}
            aria-pressed={!!k.actif}
          >
            {contenu}
          </button>
        ) : (
          <div key={k.cle} className="vl-kpi" data-ton={k.ton || 'neutre'}>{contenu}</div>
        );
      })}
    </section>
  );
}

/** Choix exclusif (filtre de statut), avec compteur. */
export function VeilleSegments({ options, valeur, onChange, label }) {
  return (
    <div className="vl-segments" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          className={`vl-segment ${valeur === o.cle ? 'is-actif' : ''}`}
          aria-pressed={valeur === o.cle}
          onClick={() => onChange(o.cle)}
        >
          {o.label}
          {o.n != null && <span className="vl-segment__n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pastille({ ton = 'neutre', children, point = true, title }) {
  return (
    <span className="vl-pastille" data-ton={ton} title={title}>
      {point && <span className="vl-pastille__point" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Petite barre de progression (0–100). */
export function Jauge({ valeur, ton = 'marque', label }) {
  const v = Math.max(0, Math.min(100, Number(valeur) || 0));
  return (
    <span className="vl-jauge" data-ton={ton} role="img" aria-label={label}>
      <span className="vl-jauge__rempli" style={{ width: `${v}%` }} />
    </span>
  );
}

export function VeilleVide({ icone: Icone = Inbox, children }) {
  return (
    <div className="vl-vide">
      <Icone size={30} strokeWidth={1.5} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function VeilleMessage({ ton = 'info', children, onFermer }) {
  return (
    <div className="vl-message" data-ton={ton} role="status">
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
      {onFermer && (
        <button type="button" className="vl-message__fermer" onClick={onFermer} aria-label={t('Fermer')}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Panneau({ icone: Icone, titre, n, aide, ton, actions, children, id, className = '' }) {
  return (
    <section className={`vl-panneau ${className}`} data-ton={ton} id={id}>
      <header className="vl-panneau__tete">
        <div className="vl-panneau__titre">
          {Icone && <span className="vl-panneau__icone"><Icone size={16} aria-hidden="true" /></span>}
          <h2>{titre}</h2>
          {n != null && <span className="vl-panneau__n">{n}</span>}
        </div>
        {actions}
      </header>
      {aide && <p className="vl-panneau__aide">{aide}</p>}
      <div className="vl-panneau__corps">{children}</div>
    </section>
  );
}

/** Numéros à afficher : 1 … 4 5 [6] 7 8 … 40 */

/** Barre de pagination sous une liste (page commence à 0) : composant commun Pagination. */
export function VeillePagination(props) {
  return <Pagination {...props} />;
}

export function dateCourte(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`;
}

export function ilYa(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const secondes = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const abs = Math.abs(secondes);
  if (abs < 3600) return rtf.format(Math.round(secondes / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(secondes / 3600), 'hour');
  if (abs < 86400 * 45) return rtf.format(Math.round(secondes / 86400), 'day');
  return rtf.format(Math.round(secondes / (86400 * 30)), 'month');
}
