import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { t, locale } from '../../../i18n';

export default function EspaceTableau({
  colonnes, lignes, cleLigne = (l) => l.id, onOuvrir, triInitial, vide, recherchePlaceholder,
  ligneClasse, outils,
}) {
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState(triInitial || null);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let res = lignes;
    if (q) {
      res = res.filter((l) => colonnes.some((c) => c.valeur && String(c.valeur(l) ?? '').toLowerCase().includes(q)));
    }
    const col = tri && colonnes.find((c) => c.cle === tri.cle);
    if (col?.valeur) {
      const sens = tri.sens === 'desc' ? -1 : 1;
      res = [...res].sort((a, b) => {
        const va = col.valeur(a);
        const vb = col.valeur(b);
        if (va == null || va === '') return 1;
        if (vb == null || vb === '') return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sens;
        return String(va).localeCompare(String(vb), locale(), { numeric: true }) * sens;
      });
    }
    return res;
  }, [lignes, colonnes, recherche, tri]);

  const trier = (c) => {
    if (c.triable === false || !c.valeur) return;
    setTri((x) => (x?.cle === c.cle ? { cle: c.cle, sens: x.sens === 'asc' ? 'desc' : 'asc' } : { cle: c.cle, sens: 'asc' }));
  };

  return (
    <div className="ept">
      <div className="ept-barre">
        <label className="ept-recherche">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder={recherchePlaceholder || t('Rechercher…')} aria-label={recherchePlaceholder || t('Rechercher…')} />
        </label>
        {outils}
        <span className="ept-compte">{visibles.length} / {lignes.length}</span>
      </div>

      <div className="ept-scroll">
        <table className="ept-table">
          <thead>
            <tr>
              {colonnes.map((c) => {
                const triable = c.triable !== false && !!c.valeur;
                const actif = tri?.cle === c.cle;
                return (
                  <th key={c.cle} style={{ width: c.largeur, textAlign: c.align }}
                    aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {triable ? (
                      <button type="button" className={`ept-tri ${actif ? 'is-actif' : ''}`} onClick={() => trier(c)}>
                        {t(c.label)}
                        {actif ? (tri.sens === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} className="ept-tri-icone" />}
                      </button>
                    ) : t(c.label)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={colonnes.length} className="ept-vide">{recherche ? t('Aucun résultat pour « {q} »', { q: recherche }) : vide}</td></tr>
            ) : visibles.map((l) => (
              <tr key={cleLigne(l)} className={`${onOuvrir ? 'is-cliquable' : ''} ${ligneClasse?.(l) || ''}`}
                onClick={onOuvrir ? () => onOuvrir(l) : undefined}
                tabIndex={onOuvrir ? 0 : undefined}
                onKeyDown={onOuvrir ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOuvrir(l); } : undefined}>
                {colonnes.map((c) => (
                  <td key={c.cle} style={{ textAlign: c.align }} className={c.classe}>
                    {c.rendu ? c.rendu(l) : (c.valeur ? (c.valeur(l) ?? '—') : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
