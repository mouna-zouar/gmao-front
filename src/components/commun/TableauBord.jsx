import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, locale } from '../../i18n';
import './TableauBord.css';



const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

export const PLEIN = { bleu: '#287da8', ambre: '#e8962e', orange: '#b8701a', vert: '#1f9d74', teal: '#0794a4', rouge: '#d9434b', violet: '#2e3f5a', gris: '#94a3b8', neutre: '#94a3b8' };

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

const HAUTEURS = [38, 62, 45, 80, 55, 70, 34, 90, 60, 48, 74, 52];
const LARGEURS_BARRES = [86, 64, 48, 30, 18];

function Ligne({ className = '' }) {
  return <span className={`tb-sq ${className}`} />;
}

/**
 * Squelette d'un tableau de bord pendant le premier chargement :
 * même grille que les cartes réelles, avec un bandeau d'avancement.
 */
export function ChargementTableau({ stats = 6, texte }) {
  const [lent, setLent] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLent(true), 3500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="tb-squelette" role="status" aria-live="polite" aria-busy="true">
      <div className="tb-sq-bandeau">
        <span className="tb-sq-roue" aria-hidden="true" />
        <div className="tb-sq-bandeau-texte">
          <strong>{texte || t('Calcul des indicateurs…')}</strong>
          <small>{lent ? t('Première ouverture : le serveur prépare les chiffres, les suivantes seront immédiates.') : t('Réclamations, bons, SLA, coûts et équipements')}</small>
        </div>
        <span className="tb-sq-progression" aria-hidden="true"><i /></span>
      </div>

      <div className="tb-stats tb-sq-stats" aria-hidden="true">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="tb-sq-stat" style={{ animationDelay: `${i * 60}ms` }}>
            <div><Ligne className="tb-sq--court" /><Ligne className="tb-sq--valeur" /><Ligne className="tb-sq--moyen" /></div>
            <Ligne className="tb-sq--icone" />
          </div>
        ))}
      </div>

      <div className="tb-sq-grille" aria-hidden="true">
        <div className="tb-sq-carte tb-sq-l--deux-tiers">
          <div className="tb-sq-tete"><Ligne className="tb-sq--titre" /><Ligne className="tb-sq--pastille" /></div>
          <div className="tb-sq-colonnes">
            {HAUTEURS.map((h, i) => <span key={i} className="tb-sq" style={{ height: `${h}%` }} />)}
          </div>
        </div>
        <div className="tb-sq-carte tb-sq-l--tiers">
          <div className="tb-sq-tete"><Ligne className="tb-sq--titre" /><Ligne className="tb-sq--pastille" /></div>
          <Ligne className="tb-sq--empile" />
          <div className="tb-sq-barres">
            {LARGEURS_BARRES.map((l, i) => (
              <div key={i}><Ligne className="tb-sq--libelle" /><span className="tb-sq" style={{ width: `${l}%` }} /></div>
            ))}
          </div>
        </div>
        {[0, 1].map((k) => (
          <div key={k} className="tb-sq-carte tb-sq-l--moitie">
            <div className="tb-sq-tete"><Ligne className="tb-sq--titre" /><Ligne className="tb-sq--pastille" /></div>
            <div className="tb-sq-liste">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}><Ligne className="tb-sq--badge" /><div><Ligne className="tb-sq--long" /><Ligne className="tb-sq--court" /></div></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Vide({ children }) {
  return <div className="tb-vide">{children}</div>;
}

export function Badge({ ton = 'gris', children }) {
  return <span className={`tb-badge tb-badge--${ton}`}>{children}</span>;
}

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

export function Barres({ lignes, format = nb }) {
  const visibles = lignes.filter((l) => Number(l.valeur) > 0);
  if (!visibles.length) return <Vide>{t('Aucune donnée sur la période.')}</Vide>;
  const max = Math.max(1, ...visibles.map((l) => l.valeur || 0));
  return (
    <div className="tb-hbars">
      {visibles.map((l) => {
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
