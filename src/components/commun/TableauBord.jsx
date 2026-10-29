import { Link } from 'react-router-dom';
import { t, locale } from '../../i18n';
import './TableauBord.css';



const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

export const PLEIN = { bleu: '#3b82f6', ambre: '#f59e0b', orange: '#f97316', vert: '#10b981', teal: '#0794a4', rouge: '#dc2626', violet: '#8b5cf6', gris: '#94a3b8' };

export function EnteteTableau({ icone: Icone, titre, description, actions }) {
  return (
    <div className="tb-header">
      {Icone && <div className="tb-header-icone"><Icone size={24} strokeWidth={2} aria-hidden="true" /></div>}
      <div className="tb-header-texte">
        <h1>{titre}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="tb-header-actions">{actions}</div>}
    </div>
  );
}


export function Carte({ titre, pastille, pastilleTon, className = '', children }) {
  return (
    <section className={`tb-carte ${className}`}>
      <div className="tb-carte-tete">
        <h3>{titre}</h3>
        {pastille && <span className={`tb-pastille ${pastilleTon ? `tb-pastille--${pastilleTon}` : ''}`}>{pastille}</span>}
      </div>
      {children}
    </section>
  );
}

export function Vide({ children }) {
  return <div className="tb-vide">{children}</div>;
}

export function Badge({ ton = 'gris', children }) {
  return <span className={`tb-badge tb-badge--${ton}`}>{children}</span>;
}

/* Carte d'indicateur : icône colorée, grand chiffre, libellé ; cliquable vers la page du module. */
export function Stat({ lien, icone: Icone, ton = 'neutre', valeur, total, label, badge, sous, featured }) {
  const contenu = (
    <>
      <div className="tb-stat-haut">
        <div className="tb-stat-icone"><Icone size={22} strokeWidth={2} aria-hidden="true" /></div>
        {badge}
      </div>
      <div>
        <div className="tb-stat-valeur">{valeur}{total != null && <small> / {nb(total)}</small>}</div>
        <div className="tb-stat-label">{label}</div>
        {sous && <div className="tb-stat-sous">{sous}</div>}
      </div>
    </>
  );
  const cls = `tb-stat tb-ton--${ton} ${featured ? 'tb-stat--featured' : ''}`;
  return lien ? <Link to={lien} className={cls}>{contenu}</Link> : <div className={cls}>{contenu}</div>;
}

/* Barres horizontales (libellé · piste · valeur). */
export function Barres({ lignes, format = nb }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur || 0));
  return (
    <div className="tb-hbars">
      {lignes.map((l) => {
        const Balise = l.onOuvrir ? 'button' : 'div';
        return (
          <Balise key={l.cle} className="tb-hbar" {...(l.onOuvrir ? { type: 'button', onClick: l.onOuvrir, title: l.nom } : {})}>
            <span className="tb-hbar-label" dir="auto">{l.nom}</span>
            <span className="tb-hbar-piste"><span className={`tb-g--${l.ton || 'teal'}`} style={{ width: `${Math.max(2, ((l.valeur || 0) / max) * 100)}%` }} /></span>
            <span className="tb-hbar-valeur">{format(l.valeur)}{l.sous && <small>{l.sous}</small>}</span>
          </Balise>
        );
      })}
    </div>
  );
}

export function Repartition({ items, label }) {
  const total = items.reduce((s, x) => s + (x.valeur || 0), 0);
  return (
    <>
      <div className="tb-empile" role="img" aria-label={label}>
        {total > 0 && items.filter((x) => x.valeur > 0).map((x) => (
          <span key={x.cle} style={{ flexGrow: x.valeur, background: PLEIN[x.ton] }} title={`${t(x.label)} : ${nb(x.valeur)}`} />
        ))}
      </div>
      <Barres lignes={items.map((x) => ({
        cle: x.cle, nom: t(x.label), valeur: x.valeur || 0, ton: x.ton, onOuvrir: x.onOuvrir,
        sous: total ? `${nb(((x.valeur || 0) / total) * 100)} %` : null,
      }))} />
    </>
  );
}

/* Liste d'éléments à traiter (badge + texte), chaque ligne ouvre l'élément. */
export function Liste({ lignes }) {
  return (
    <ul className="tb-liste">
      {lignes.map((l) => (
        <li key={l.cle}>
          <button type="button" onClick={l.onOuvrir}>
            <Badge ton={l.ton}>{l.badge}</Badge>
            <span className="tb-liste-texte">
              <strong dir="auto">{l.titre}</strong>
              {l.sous && <small dir="auto">{l.sous}</small>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
