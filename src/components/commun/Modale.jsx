import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../../i18n';
import './commun.css';


export default function Modale({
  ouvert, onFermer, titre, surtitre, sousTitre, icone: Icone, taille = 'lg',
  sections, sectionActive, onSection, pied, infoPied, fermerSurFond = true, className = '', children,
}) {
  const fenetre = useRef(null);
  // onFermer est souvent une fonction recréée à chaque rendu : on la garde dans une référence
  // pour que l'effet ci-dessous ne se relance pas (il redonnerait le focus au premier champ pendant la saisie).
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  useEffect(() => {
    if (!ouvert) return undefined;
    const precedent = document.activeElement;
    const touche = (e) => { if (e.key === 'Escape') fermerRef.current?.(); };
    document.addEventListener('keydown', touche);
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus sur le premier champ (ou la fenêtre) pour le clavier et les lecteurs d'écran
    setTimeout(() => {
      const cible = fenetre.current?.querySelector('[data-autofocus]')
        || fenetre.current?.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
      (cible || fenetre.current)?.focus?.();
    }, 30);
    return () => {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = debordement;
      precedent?.focus?.();
    };
  }, [ouvert]);

  if (!ouvert) return null;

  const avecSections = Array.isArray(sections) && sections.length > 1;

  return createPortal(
    <div className="cm-voile" onMouseDown={(e) => { if (fermerSurFond && e.target === e.currentTarget) onFermer?.(); }}>
      <div ref={fenetre} className={`cm-modale cm-modale--${taille} ${className}`} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1}>
        <header className="cm-modale__tete">
          {Icone && <span className="cm-modale__icone"><Icone size={22} strokeWidth={2} aria-hidden="true" /></span>}
          <div className="cm-modale__titres">
            {surtitre && <span className="cm-modale__surtitre">{surtitre}</span>}
            <h2>{titre}</h2>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
          <button type="button" className="cm-modale__fermer" onClick={onFermer} aria-label={t('Fermer')} title={t('Fermer')}>
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className={`cm-modale__milieu ${avecSections ? 'avec-sections' : ''}`}>
          {avecSections && (
            <nav className="cm-modale__nav" aria-label={t('Sections')}>
              <span className="cm-modale__nav-titre">{t('Sections')}</span>
              {sections.map((s) => {
                const SIcone = s.icone;
                return (
                  <button key={s.cle} type="button" aria-current={sectionActive === s.cle ? 'step' : undefined}
                    className={`cm-modale__nav-item ${sectionActive === s.cle ? 'is-actif' : ''} ${s.erreur ? 'a-erreur' : ''}`}
                    onClick={() => onSection?.(s.cle)}>
                    {SIcone && <SIcone size={16} aria-hidden="true" />}
                    <span>{s.label}</span>
                    {s.erreur ? <span className="cm-modale__nav-badge cm-modale__nav-badge--erreur">!</span>
                      : s.badge != null && s.badge !== 0 ? <span className="cm-modale__nav-badge">{s.badge}</span> : null}
                  </button>
                );
              })}
            </nav>
          )}
          <div className="cm-modale__corps">{children}</div>
        </div>

        {(pied || infoPied) && (
          <footer className="cm-modale__pied">
            {infoPied && <span className="cm-modale__info">{infoPied}</span>}
            <div className="cm-modale__boutons">{pied}</div>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
