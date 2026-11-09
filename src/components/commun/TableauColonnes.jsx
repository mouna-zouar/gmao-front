
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown, Copy, CopyCheck, EyeOff, Filter, FilterX, ListFilter, X } from 'lucide-react';
import { t, locale } from '../../i18n';

const MAX_CHOIX = 8;

export const texteCellule = (c, l) => {
  const v = c.texte ? c.texte(l) : (c.valeur ? c.valeur(l) : l?.[c.cle]);
  return v == null ? '' : String(v);
};

export function choixColonnes(colonnes, lignes) {
  const res = {};
  colonnes.forEach((c) => {
    if (c.filtrable === false || c.filtre === 'texte') return;
    const vals = new Set();
    for (const l of lignes) {
      const v = texteCellule(c, l).trim();
      if (v) vals.add(v);
      if (vals.size > MAX_CHOIX) return;
    }
    if (c.filtre === 'liste' ? vals.size >= 2 : (vals.size >= 2 && vals.size < lignes.length)) {
      res[c.cle] = [...vals].sort((a, b) => a.localeCompare(b, locale(), { sensitivity: 'base', numeric: true }));
    }
  });
  return res;
}

const nombre = (s) => {
  const n = Number(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/* Un filtre de colonne correspond-il à cette ligne ? */
function correspond(c, l, filtre, estListe) {
  const brut = texteCellule(c, l);
  if (estListe) return brut.trim() === filtre;
  const f = filtre.trim();
  const op = f.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (op) {
    const cible = nombre(op[2]);
    const v = typeof c.valeur?.(l) === 'number' ? c.valeur(l) : nombre(brut);
    if (cible != null && v != null) {
      return { '>': v > cible, '<': v < cible, '>=': v >= cible, '<=': v <= cible, '=': v === cible }[op[1]];
    }
    if (op[1] === '=') return brut.trim().toLowerCase() === op[2].trim().toLowerCase();
  }
  const texte = brut.toLowerCase();
  return f.toLowerCase().split(/\s+/).filter(Boolean).every((m) => texte.includes(m));
}

export function filtrerParColonnes(lignes, colonnes, filtres, choix) {
  const actifs = colonnes.filter((c) => (filtres[c.cle] || '').trim());
  if (!actifs.length) return lignes;
  return lignes.filter((l) => actifs.every((c) => correspond(c, l, filtres[c.cle], Boolean(choix[c.cle]))));
}

/* Copie : API presse-papiers si disponible (https / localhost), sinon zone de texte cachée */
export async function copierTexte(texte) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch { /* repli ci-dessous */ }
  const zone = document.createElement('textarea');
  zone.value = texte;
  zone.setAttribute('readonly', '');
  zone.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(zone);
  zone.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  zone.remove();
  return ok;
}

/* Champ de recherche placé dans l'en-tête de la colonne, sous son nom */
export function ChampFiltre({ colonne: c, valeur = '', choix, onChanger, focus = false, onFermer }) {
  const champ = useRef(null);
  useEffect(() => { if (focus) champ.current?.focus(); }, [focus]);
  if (c.filtrable === false) return null;
  const label = `${t('Filtrer')} : ${t(c.label)}`;
  const arreter = (e) => e.stopPropagation();
  const touche = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { onChanger(c.cle, ''); onFermer?.(); }
  };
  /* Quitter un champ vide le referme */
  const quitter = (e) => { if (!e.target.value && !e.currentTarget.contains(e.relatedTarget)) onFermer?.(); };
  return (
    <div className={`cl-filtre-th ${valeur ? 'a-filtre' : ''}`} onClick={arreter} onKeyDown={touche} onBlur={quitter}>
      {choix ? (
        <select ref={champ} value={valeur} onChange={(e) => onChanger(c.cle, e.target.value)} aria-label={label}>
          <option value="">{t('Tous')}</option>
          {choix.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span className="cl-filtre-champ">
          <input ref={champ} type="text" value={valeur} onChange={(e) => onChanger(c.cle, e.target.value)}
            placeholder={t('Filtrer…')} aria-label={label} title={t('Texte, ou >, <, = suivi d’un nombre')} />
          {valeur && (
            <button type="button" onClick={() => onChanger(c.cle, '')} aria-label={t('Effacer le filtre')}>
              <X size={12} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/* Ligne de filtres sous l'en-tête (ancienne présentation, gardée pour compatibilité) */
export function LigneFiltres({ colonnes, filtres, choix, onChanger, debut = 0 }) {
  return (
    <tr className="cl-ligne-filtres">
      {Array.from({ length: debut }, (_, i) => <th key={`d${i}`} aria-hidden="true" />)}
      {colonnes.map((c) => {
        const v = filtres[c.cle] || '';
        if (c.filtrable === false) return <th key={c.cle} aria-hidden="true" />;
        const label = `${t('Filtrer')} : ${t(c.label)}`;
        return (
          <th key={c.cle} className={v ? 'a-filtre' : ''}>
            {choix[c.cle] ? (
              <select value={v} onChange={(e) => onChanger(c.cle, e.target.value)} aria-label={label}>
                <option value="">{t('Tous')}</option>
                {choix[c.cle].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <span className="cl-filtre-champ">
                <input type="text" value={v} onChange={(e) => onChanger(c.cle, e.target.value)}
                  placeholder={t('Filtrer…')} aria-label={label}
                  title={t('Texte, ou >, <, = suivi d’un nombre')} />
                {v && (
                  <button type="button" onClick={() => onChanger(c.cle, '')} aria-label={t('Effacer le filtre')}>
                    <X size={12} />
                  </button>
                )}
              </span>
            )}
          </th>
        );
      })}
    </tr>
  );
}

/* Bouton + menu d'une colonne (le menu s'ouvre au-dessus du tableau, hors du cadre défilant) */
export function BoutonMenuColonne({ colonne, triActif, filtreActif, onTrier, onCopier, onMasquer, onEffacer }) {
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState(null);
  const bouton = useRef(null);
  const menu = useRef(null);

  useLayoutEffect(() => {
    if (!ouvert || !bouton.current) return;
    const r = bouton.current.getBoundingClientRect();
    const larg = 252;
    const gauche = Math.min(Math.max(8, r.right - larg), window.innerWidth - larg - 8);
    setPos({ top: r.bottom + 6, left: gauche });
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = () => setOuvert(false);
    const dehors = (e) => {
      if (!menu.current?.contains(e.target) && !bouton.current?.contains(e.target)) fermer();
    };
    const touche = (e) => { if (e.key === 'Escape') { fermer(); bouton.current?.focus(); } };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', touche);
    window.addEventListener('scroll', fermer, true);
    window.addEventListener('resize', fermer);
    return () => {
      document.removeEventListener('mousedown', dehors);
      document.removeEventListener('keydown', touche);
      window.removeEventListener('scroll', fermer, true);
      window.removeEventListener('resize', fermer);
    };
  }, [ouvert]);

  useEffect(() => { if (ouvert && pos) menu.current?.querySelector('button')?.focus(); }, [ouvert, pos]);

  const action = (fn) => () => { setOuvert(false); fn(); };
  const triable = colonne.triable !== false;
  const elements = [
    triable && { icone: ArrowUp, label: 'Tri croissant', fn: () => onTrier('asc'), actif: triActif === 'asc' },
    triable && { icone: ArrowDown, label: 'Tri décroissant', fn: () => onTrier('desc'), actif: triActif === 'desc' },
    triable && { separateur: true },
    { icone: Copy, label: 'Copier la colonne', fn: () => onCopier(false) },
    { icone: CopyCheck, label: 'Copier les valeurs distinctes', fn: () => onCopier(true) },
    { separateur: true },
    filtreActif && { icone: FilterX, label: 'Effacer le filtre', fn: onEffacer },
    { icone: EyeOff, label: 'Masquer la colonne', fn: onMasquer },
  ].filter(Boolean);

  return (
    <>
      <button ref={bouton} type="button" className={`cl-col-menu ${ouvert ? 'est-ouvert' : ''} ${filtreActif ? 'a-filtre' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOuvert((o) => !o); }}
        aria-haspopup="menu" aria-expanded={ouvert} aria-label={`${t('Options de la colonne')} ${t(colonne.label)}`}>
        {filtreActif ? <ListFilter size={13} /> : <ChevronDown size={13} />}
      </button>
      {ouvert && pos && createPortal(
        <div ref={menu} className="cl-menu-colonne" role="menu" style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}>
          <p className="cl-menu-colonne__titre">{t(colonne.label)}</p>
          {elements.map((el, i) => {
            if (el.separateur) return <hr key={`s${i}`} />;
            const I = el.icone;
            return (
              <button key={el.label} type="button" role="menuitem" className={el.actif ? 'est-actif' : ''} onClick={action(el.fn)}>
                <I size={15} /> <span>{t(el.label)}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

/* Hook commun : état des filtres de colonnes, affichage de la ligne, copie avec annonce */
export function useFiltresColonnes(cleStockage) {
  const cle = cleStockage ? `gmao.liste.${cleStockage}.tousLesFiltres` : null;
  const [filtres, setFiltres] = useState({});
  /* Par défaut les champs sont cachés : un clic sur le nom d'une colonne ouvre son champ */
  const [voir, setVoir] = useState(() => {
    try { return cle ? localStorage.getItem(cle) === '1' : false; } catch { return false; }
  });
  const [ouvertes, setOuvertes] = useState(() => new Set());
  const [dernier, setDernier] = useState(null);
  useEffect(() => { if (cle) { try { localStorage.setItem(cle, voir ? '1' : '0'); } catch { /* stockage indisponible */ } } }, [cle, voir]);
  const [annonce, setAnnonce] = useState('');
  useEffect(() => { if (!annonce) return undefined; const id = setTimeout(() => setAnnonce(''), 2400); return () => clearTimeout(id); }, [annonce]);

  const changer = (k, v) => setFiltres((f) => ({ ...f, [k]: v }));
  const copier = async (colonne, lignes, distinctes) => {
    let vals = lignes.map((l) => texteCellule(colonne, l).trim()).filter(Boolean);
    if (distinctes) vals = [...new Set(vals)];
    if (!vals.length) { setAnnonce(t('Rien à copier dans cette colonne.')); return; }
    const ok = await copierTexte(vals.join('\n'));
    setAnnonce(ok ? `${vals.length} ${t('valeur(s) copiée(s)')} — ${t(colonne.label)}` : t('Copie impossible dans ce navigateur.'));
  };
  const actif = (k) => Boolean((filtres[k] || '').trim());
  const ouvrir = (k) => { setOuvertes((o) => new Set(o).add(k)); setDernier(k); };
  const fermer = (k) => { setOuvertes((o) => { const n = new Set(o); n.delete(k); return n; }); setDernier((d) => (d === k ? null : d)); };
  const basculer = (k) => { if (ouvertes.has(k) && !actif(k)) fermer(k); else ouvrir(k); };
  return {
    filtres, changer, vider: () => { setFiltres({}); setOuvertes(new Set()); }, voir, setVoir, copier, annonce,
    nb: Object.values(filtres).filter((v) => (v || '').trim()).length,
    actif, basculer, fermer,
    visible: (k) => voir || ouvertes.has(k) || actif(k),
    focus: (k) => dernier === k,
  };
}

/* Bouton « Colonnes » (affiche / cache la ligne de filtres) */
export function BoutonFiltresColonnes({ voir, onBasculer, nb }) {
  return (
    <button type="button" className={`cl-btn-filtres ${voir ? 'est-actif' : ''}`} onClick={onBasculer}
      aria-pressed={voir} title={t('Afficher la recherche de toutes les colonnes')}>
      <Filter size={14} /> {t('Colonnes')}
      {nb > 0 && <span className="cl-btn-filtres__nb">{nb}</span>}
    </button>
  );
}

/* Flèche de tri : le tri se fait ici (le clic sur le nom ouvre la recherche) */
export function BoutonTri({ label, onTrier, children }) {
  return (
    <button type="button" className="cl-tri-btn" onClick={(e) => { e.stopPropagation(); onTrier(); }}
      title={t('Trier par {colonne}', { colonne: t(label) })} aria-label={t('Trier par {colonne}', { colonne: t(label) })}>
      {children}
    </button>
  );
}

/* Message bref après une copie */
export function AnnonceCopie({ texte }) {
  return <div className="cl-annonce" role="status" aria-live="polite">{texte && <span>{texte}</span>}</div>;
}
