import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, ChevronDown, LayoutGrid } from 'lucide-react';
import { t } from '../../../i18n';

export function MenuAchatsBons({ actif, allume, elements }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  useEffect(() => {
    if (!ouvert) return undefined;
    const fermerDehors = (e) => { if (zone.current && !zone.current.contains(e.target)) setOuvert(false); };
    const fermerEchap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', fermerDehors);
    document.addEventListener('keydown', fermerEchap);
    return () => { document.removeEventListener('mousedown', fermerDehors); document.removeEventListener('keydown', fermerEchap); };
  }, [ouvert]);
  useEffect(() => { if (!actif) setOuvert(false); }, [actif]);
  return (
    <div className="bons-achats" ref={zone}>
      <button type="button" className={`bons-action-btn achats ${!actif ? 'disabled' : ''} ${allume ? 'allume' : ''} ${ouvert ? 'is-ouvert' : ''}`}
        disabled={!actif} aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
        <ShoppingCart size={18} />
        <span>{t('Achats')}</span>
        {allume && <span className="bons-achats__point" aria-hidden="true" />}
        <ChevronDown size={15} className="bons-outils__chevron" aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="bons-outils__menu bons-achats__menu" role="menu">
          {elements.map((el) => {
            const Icone = el.icone;
            return (
              <button key={el.cle} type="button" role="menuitem" disabled={!el.actif}
                className={`bons-outils__item ${el.allume ? 'is-allume' : ''}`}
                onClick={() => { setOuvert(false); el.onClick(); }}>
                <span className="bons-outils__icone"><Icone size={17} aria-hidden="true" /></span>
                <span className="bons-outils__textes"><strong>{el.label}</strong></span>
                {el.allume && <span className="bons-achats__point" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MenuOutilsBons({ elements, nbAlertesMachines }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  useEffect(() => {
    if (!ouvert) return undefined;
    const fermerDehors = (e) => { if (zone.current && !zone.current.contains(e.target)) setOuvert(false); };
    const fermerEchap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', fermerDehors);
    document.addEventListener('keydown', fermerEchap);
    return () => { document.removeEventListener('mousedown', fermerDehors); document.removeEventListener('keydown', fermerEchap); };
  }, [ouvert]);
  const badge = (n) => (n > 99 ? '99+' : n);
  return (
    <div className="bons-outils" ref={zone}>
      <button type="button" className={`bons-outils__bouton ${ouvert ? 'is-ouvert' : ''}`} aria-haspopup="menu" aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}>
        <LayoutGrid size={17} aria-hidden="true" />
        <span>{t('Outils')}</span>
        {nbAlertesMachines > 0 && <span className="bons-toggle-badge" aria-label={t('{n} éléments à traiter', { n: nbAlertesMachines })}>{badge(nbAlertesMachines)}</span>}
        <ChevronDown size={15} className="bons-outils__chevron" aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="bons-outils__menu" role="menu">
          {elements.map((el) => {
            const Icone = el.icone;
            return (
              <button key={el.cle} type="button" role="menuitem" className="bons-outils__item"
                onClick={() => { setOuvert(false); el.onClick(); }}>
                <span className="bons-outils__icone"><Icone size={17} aria-hidden="true" /></span>
                <span className="bons-outils__textes">
                  <strong>{el.label}</strong>
                  {el.aide && <small>{el.aide}</small>}
                </span>
                {el.badge > 0 && <span className="bons-toggle-badge">{badge(el.badge)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
