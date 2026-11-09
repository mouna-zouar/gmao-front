import { cloneElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronDown, ChevronRight, Search, ShieldOff, Waypoints, X, Zap } from 'lucide-react';
import { NAV_SECTIONS } from '../../../constants/navigation';
import { ICONES_MODULES as M } from '../../../constants/modules';
import { t } from '../../../i18n';
import './AccesGmao.css';

/*
 * Accès à toute la GMAO depuis le tableau de bord.
 * Les modules viennent du menu (NAV_SECTIONS « gmao ») : une page ajoutée au menu apparaît ici.
 * On ajoute les pages d'analyse qui n'ont pas de place dans le menu.
 * Chaque page peut porter un compteur en direct (fourni par le tableau de bord).
 */

const icone = (I) => <I aria-hidden="true" />;

const ANALYSES = {
  id: 'analyses',
  label: 'Analyses',
  path: '/intelligence',
  icon: icone(M.analyse),
  children: [
    { label: 'Intelligence', path: '/intelligence', icon: icone(M.intelligence), motsCles: 'ia recommandations' },
    { label: 'Coût', path: '/cout', icon: icone(M.cout), motsCles: 'dépenses budget' },
    { label: 'SLA', path: '/sla', icon: icone(M.sla), motsCles: 'délais retard' },
    { label: 'Disponibilité', path: '/disponibilite', icon: icone(M.disponibilite), motsCles: 'mtbf mttr' },
    { label: 'Risque', path: '/risque', icon: icone(M.risque), motsCles: 'criticité' },
    { label: 'Anomalies', path: '/anomalies', icon: icone(Zap), motsCles: 'pic réclamations détection' },
    { label: 'Blocages', path: '/blocages-immobilisation', icon: icone(ShieldOff), motsCles: 'immobilisation arrêt' },
    { label: 'Alertes machines', path: '/alertes-machines', icon: icone(BellRing), motsCles: 'capteurs sondes' },
    { label: 'Workflow', path: '/workflow', icon: icone(Waypoints), motsCles: 'circuit étapes' },
  ],
};

const EXCLUS = new Set(['dashboard']);

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function modulesGmao() {
  const gmao = NAV_SECTIONS.find((s) => s.id === 'gmao')?.items || [];
  return [...gmao.filter((m) => !EXCLUS.has(m.id)), ANALYSES].map((m) => ({
    ...m,
    pages: m.children?.length ? m.children : [],
  }));
}

const CLE_OUVERT = 'gmao.tableau-de-bord.acces';
function lireOuvert() {
  try { return localStorage.getItem(CLE_OUVERT) !== '0'; } catch { return true; }
}

/**
 * compteurs : { '/chemin': { valeur, ton } } — ton : 'rouge' | 'orange' | 'ambre' | 'teal' | 'gris'
 */
export default function AccesGmao({ compteurs = {} }) {
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(lireOuvert);
  useEffect(() => { try { localStorage.setItem(CLE_OUVERT, ouvert ? '1' : '0'); } catch { /* stockage indisponible */ } }, [ouvert]);
  const modules = useMemo(modulesGmao, []);

  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const trouve = (texte) => mots.every((x) => sansAccents(texte).includes(x));
  const visibles = !mots.length ? modules : modules
    .map((m) => ({
      ...m,
      seul: !m.children?.length && trouve(`${t(m.label)} ${m.label} ${m.motsCles || ''}`),
      pages: m.pages.filter((p) => trouve(`${t(p.label)} ${p.label} ${t(m.label)} ${m.label} ${p.motsCles || ''}`)),
    }))
    .filter((m) => m.pages.length || m.seul);
  const nbPages = visibles.reduce((n, m) => n + (m.pages.length || 1), 0);
  const montrer = ouvert || mots.length > 0;

  const compteur = (chemin) => {
    const c = compteurs[chemin.split('?')[0]];
    if (!c || c.valeur == null || c.valeur === 0) return null;
    return <span className={`ag-compteur ag-compteur--${c.ton || 'teal'}`}>{c.valeur}</span>;
  };

  return (
    <section className="ag" aria-labelledby="ag-titre">
      <div className="ag-tete">
        <button type="button" className="ag-replier" onClick={() => setOuvert((o) => !o)} aria-expanded={montrer} aria-controls="ag-corps">
          <ChevronDown size={16} className={montrer ? '' : 'est-ferme'} aria-hidden="true" />
          <h2 id="ag-titre">{t('Accès à la GMAO')}</h2>
        </button>
        <label className="ag-recherche">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Aller à une page…')} aria-label={t('Rechercher une page')} />
          {recherche && (
            <button type="button" onClick={() => setRecherche('')} aria-label={t('Effacer')}><X size={13} /></button>
          )}
        </label>
        {mots.length > 0 && <span className="ag-nb">{t('{n} page(s)', { n: nbPages })}</span>}
      </div>

      {!montrer ? null : visibles.length === 0 ? (
        <p className="ag-vide">{t('Aucune page ne correspond.')}</p>
      ) : (
        <div className="ag-grille" id="ag-corps">
          {visibles.map((m) => (
            <div key={m.id} className={`ag-module ag-module--${m.id}`}>
              <Link to={m.path} className="ag-module-tete">
                <span className="ag-module-icone">{cloneElement(m.icon, { width: 18, height: 18, className: undefined })}</span>
                <span className="ag-module-nom">{t(m.label)}</span>
                {!m.pages.length && compteur(m.path)}
                <ChevronRight size={15} className="ag-fleche rtl-miroir" aria-hidden="true" />
              </Link>
              {m.pages.length > 0 && <ul className="ag-pages">
                {m.pages.map((p) => (
                  <li key={p.path + p.label}>
                    <Link to={p.path} className="ag-page">
                      <span className="ag-page-icone">{cloneElement(p.icon, { width: 15, height: 15 })}</span>
                      <span className="ag-page-nom">{t(p.label)}</span>
                      {compteur(p.path)}
                    </Link>
                  </li>
                ))}
              </ul>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
