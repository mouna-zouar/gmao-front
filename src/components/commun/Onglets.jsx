import { useRef } from 'react';
import { t } from '../../i18n';
import './Onglets.css';

/*
 * Barre d'onglets commune (fiche équipement, détail d'un bon…).
 *   <Onglets onglets={[{ cle, label, icone, n, ton }]} actif={cle} onChanger={setCle} />
 * n : compteur affiché en pastille (masqué si null) ; ton 'rouge' pour un compteur d'alerte.
 * Flèches gauche / droite pour passer d'un onglet à l'autre au clavier.
 */
export default function Onglets({ onglets, actif, onChanger, ariaLabel, className = '' }) {
  const barre = useRef(null);
  const clavier = (e, i) => {
    const pas = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const sens = document.dir === 'rtl' ? -pas : pas;
    const suivant = onglets[(i + sens + onglets.length) % onglets.length];
    onChanger(suivant.cle);
    barre.current?.querySelector(`[data-onglet="${suivant.cle}"]`)?.focus();
  };
  return (
    <div ref={barre} className={`co-onglets ${className}`.trim()} role="tablist" aria-label={ariaLabel || t('Onglets')}>
      {onglets.map((o, i) => {
        const Icone = o.icone;
        const estActif = o.cle === actif;
        return (
          <button key={o.cle} type="button" role="tab" data-onglet={o.cle} aria-selected={estActif} tabIndex={estActif ? 0 : -1}
            className={`co-onglet ${estActif ? 'est-actif' : ''}`} onClick={() => onChanger(o.cle)} onKeyDown={(e) => clavier(e, i)}>
            {Icone && <Icone size={16} aria-hidden="true" />}
            <span>{o.label}</span>
            {o.n != null && <b className={`co-onglet__n ${o.ton ? `co-onglet__n--${o.ton}` : ''}`}>{o.n}</b>}
          </button>
        );
      })}
    </div>
  );
}
