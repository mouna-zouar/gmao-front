// Animations de fin d'étape (intervenant terminé, remise en service, bon clôturé)
// Usage : const [celebrer, celebrationElement] = useCelebration();
//         celebrer('intervenant-termine', 'Ahmed Ben Ali');
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, locale } from '../../../i18n';
import './BmdCelebration.css';

const CONFIG = {
  'intervenant-termine': { tone: 'teal', titre: 'Intervention terminée' },
  'remise-autorisee': { tone: 'green', titre: 'Équipement remis en service' },
  'remise-refusee': { tone: 'red', titre: 'Remise en service refusée' },
  'bon-cloture': { tone: 'ink', titre: 'Bon de maintenance clôturé' },
};

const ANGLES_ETINCELLES = [0, 45, 90, 135, 180, 225, 270, 315];

const Etincelles = () => (
  <g className="bmdc-sparks">
    {ANGLES_ETINCELLES.map((a) => (
      <g key={a} transform={`rotate(${a} 100 70)`}>
        <line x1="100" y1="12" x2="100" y2="4" />
      </g>
    ))}
  </g>
);

const Ondes = () => (
  <g className="bmdc-ripples">
    <circle cx="100" cy="70" r="46" />
    <circle cx="100" cy="70" r="46" />
  </g>
);

// Tracé ECG qui traverse le cercle puis laisse place à la coche
const VisuelIntervenant = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <Ondes />
    <path
      className="bmdc-ecg"
      pathLength="1"
      d="M8 70 H58 L66 70 L74 46 L84 98 L94 30 L104 86 L112 70 H192"
    />
    <circle className="bmdc-ring" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-check" pathLength="1" d="M80 71 L95 86 L122 56" />
    <Etincelles />
  </svg>
);

// Symbole « power » qui se dessine puis s'allume
const VisuelRemiseAutorisee = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <Ondes />
    <circle className="bmdc-ring bmdc-ring--glow" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-power-arc" pathLength="1" d="M84 52 A26 26 0 1 0 116 52" />
    <path className="bmdc-power-bar" pathLength="1" d="M100 38 V68" />
    <Etincelles />
  </svg>
);

const VisuelRemiseRefusee = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <circle className="bmdc-ring" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-cross" pathLength="1" d="M85 55 L115 85" />
    <path className="bmdc-cross bmdc-cross--2" pathLength="1" d="M115 55 L85 85" />
  </svg>
);

// Tampon qui « tombe » sur la carte
const VisuelBonCloture = ({ sousTitre }) => (
  <div className="bmdc-stamp-zone">
    <div className="bmdc-dust" />
    <div className="bmdc-stamp">
      <span className="bmdc-stamp-texte">{t('CLÔTURÉ')}</span>
      <span className="bmdc-stamp-date">
        {sousTitre ? `${sousTitre} · ` : ''}
        {new Date().toLocaleDateString(locale())}
      </span>
    </div>
  </div>
);

export function BmdCelebration({ type, sousTitre, duree = 2900, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fermer = () => onDoneRef.current?.();
    const timer = setTimeout(fermer, duree);
    const onKey = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [duree]);

  const cfg = CONFIG[type];
  if (!cfg) return null;

  let visuel = null;
  if (type === 'intervenant-termine') visuel = <VisuelIntervenant />;
  else if (type === 'remise-autorisee') visuel = <VisuelRemiseAutorisee />;
  else if (type === 'remise-refusee') visuel = <VisuelRemiseRefusee />;
  else if (type === 'bon-cloture') visuel = <VisuelBonCloture sousTitre={sousTitre} />;

  const contenu = (
    <div
      className={`bmdc-overlay bmdc--${cfg.tone}`}
      onClick={() => onDoneRef.current?.()}
      role="status"
      aria-live="polite"
    >
      <div className={`bmdc-card bmdc-card--${type}`}>
        <div className="bmdc-visual">{visuel}</div>
        <p className="bmdc-titre">{t(cfg.titre)}</p>
        {sousTitre && type !== 'bon-cloture' && <p className="bmdc-sous">{sousTitre}</p>}
        <div className="bmdc-progress">
          <span style={{ animationDuration: `${duree}ms` }} />
        </div>
      </div>
    </div>
  );

  // Portail : évite que l'overlay soit coupé par un parent animé (transform)
  return createPortal(contenu, document.body);
}

// File d'attente : si deux événements arrivent ensemble (intervenant terminé puis bon clôturé),
// les animations s'enchaînent au lieu de se superposer.
export function useCelebration() {
  const [file, setFile] = useState([]);

  const celebrer = useCallback((type, sousTitre) => {
    setFile((f) => [...f, { type, sousTitre, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const suivant = useCallback(() => setFile((f) => f.slice(1)), []);

  const courant = file[0];
  const element = courant ? (
    <BmdCelebration
      key={courant.id}
      type={courant.type}
      sousTitre={courant.sousTitre}
      onDone={suivant}
    />
  ) : null;

  return [celebrer, element];
}