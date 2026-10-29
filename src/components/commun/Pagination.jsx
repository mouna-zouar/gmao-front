import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { t, locale } from '../../i18n';
import './Pagination.css';

/*
 * Barre de pagination unique de la GMAO (même style partout).
 *
 *   <Pagination page={page} taille={25} total={lignes.length} onPage={setPage} onTaille={setTaille} />
 *
 * page      : numéro de la page courante. Par défaut les pages commencent à 0 ; base={1} si l'écran compte à partir de 1.
 * taille    : nombre de lignes par page. onTaille (facultatif) affiche le choix « Par page » (tailles = [10, 25, 50, 100]).
 * total     : nombre total de lignes. Pour une pagination côté serveur sans total connu, passer nbPages.
 * compact   : précédent / « 2 / 5 » / suivant, pour un petit espace (colonne de kanban, carte).
 * masquerSiUnePage : ne rien afficher quand tout tient sur une page.
 * desactive : boutons inactifs (chargement en cours).
 */
function numerosPages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((i) => set.add(i));
  if (page >= total - 3) [total - 4, total - 3, total - 2].forEach((i) => set.add(i));
  const tries = [...set].filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
  const res = [];
  tries.forEach((i, k) => {
    if (k > 0 && i - tries[k - 1] > 1) res.push(`…${i}`);
    res.push(i);
  });
  return res;
}

const nombre = (n) => Number(n).toLocaleString(locale());

export default function Pagination({
  page, taille, total, onPage, onTaille, tailles = [10, 25, 50, 100],
  base = 0, nbPages: nbPagesConnu, compact = false, masquerSiUnePage = false, desactive = false, className = '',
}) {
  const p = Math.max(0, (Number(page) || base) - base); // page courante, à partir de 0
  const nbPages = Math.max(1, nbPagesConnu ?? Math.ceil((total || 0) / (taille || 1)));
  if (total === 0 && nbPagesConnu == null) return null;
  if (masquerSiUnePage && nbPages <= 1) return null;

  const aller = (n) => {
    const cible = Math.max(0, Math.min(nbPages - 1, n));
    if (cible !== p) onPage(cible + base);
  };
  const auDebut = p === 0 || desactive;
  const aLaFin = p >= nbPages - 1 || desactive;

  if (compact) {
    return (
      <nav className={`cp-pagination cp-pagination--compact ${className}`.trim()} aria-label={t('Pagination')}>
        <button type="button" className="cp-pagination__btn" onClick={() => aller(p - 1)} disabled={auDebut} aria-label={t('Page précédente')}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <span className="cp-pagination__info">{nombre(p + 1)} / {nombre(nbPages)}</span>
        <button type="button" className="cp-pagination__btn" onClick={() => aller(p + 1)} disabled={aLaFin} aria-label={t('Page suivante')}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </nav>
    );
  }

  const info = total != null && taille
    ? t('{debut}–{fin} sur {total}', {
      debut: nombre(Math.min(total, p * taille + 1)),
      fin: nombre(Math.min(total, (p + 1) * taille)),
      total: nombre(total),
    })
    : t('Page {n} sur {total}', { n: nombre(p + 1), total: nombre(nbPages) });

  return (
    <nav className={`cp-pagination ${className}`.trim()} aria-label={t('Pagination')}>
      <span className="cp-pagination__info">{info}</span>
      <div className="cp-pagination__pages">
        <button type="button" className="cp-pagination__btn" onClick={() => aller(0)} disabled={auDebut} aria-label={t('Première page')}><ChevronsLeft size={15} aria-hidden="true" /></button>
        <button type="button" className="cp-pagination__btn" onClick={() => aller(p - 1)} disabled={auDebut} aria-label={t('Page précédente')}><ChevronLeft size={15} aria-hidden="true" /></button>
        {numerosPages(p, nbPages).map((n) => (typeof n === 'string'
          ? <span key={n} className="cp-pagination__ellipse" aria-hidden="true">…</span>
          : (
            <button
              key={n}
              type="button"
              className={`cp-pagination__btn cp-pagination__num ${n === p ? 'is-actif' : ''}`}
              onClick={() => aller(n)}
              disabled={desactive && n !== p}
              aria-current={n === p ? 'page' : undefined}
              aria-label={t('Page {n}', { n: n + 1 })}
            >
              {nombre(n + 1)}
            </button>
          )))}
        <button type="button" className="cp-pagination__btn" onClick={() => aller(p + 1)} disabled={aLaFin} aria-label={t('Page suivante')}><ChevronRight size={15} aria-hidden="true" /></button>
        <button type="button" className="cp-pagination__btn" onClick={() => aller(nbPages - 1)} disabled={aLaFin} aria-label={t('Dernière page')}><ChevronsRight size={15} aria-hidden="true" /></button>
      </div>
      {onTaille ? (
        <label className="cp-pagination__taille">
          {t('Par page')}
          <select value={taille} onChange={(e) => onTaille(Number(e.target.value))}>
            {[...new Set([...tailles, taille])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      ) : <span className="cp-pagination__vide" aria-hidden="true" />}
    </nav>
  );
}
