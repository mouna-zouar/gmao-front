// Carte « Langue de l'application » à placer dans les paramètres.
// Le changement est immédiat (pas de bouton Enregistrer) et mémorisé sur cet ordinateur.
import { Check, Languages } from 'lucide-react';
import { LANGUES, t, useLangue } from './index';
import './ReglageLangue.css';

// Aperçu montré sur chaque choix, dans sa propre langue (pour que chacun reconnaisse la sienne)
const APERCUS = {
  fr: { titre: 'Français', exemple: 'Bon de maintenance · Faire le diagnostic', sens: 'Lecture de gauche à droite' },
  ar: { titre: 'العربية', exemple: 'أمر الصيانة · إجراء التشخيص', sens: 'القراءة من اليمين إلى اليسار' },
  en: { titre: 'English', exemple: 'Work order · Do the diagnosis', sens: 'Reads left to right' },
};

/**
 * @param {() => boolean} [avantChangement] renvoie false pour annuler (ex. modifications non enregistrées)
 */
export default function ReglageLangue({ avantChangement }) {
  const { langue, setLangue } = useLangue();

  const choisir = (code) => {
    if (code === langue) return;
    if (avantChangement && avantChangement() === false) return;
    setLangue(code);
  };

  return (
    <section className="rl-carte" aria-labelledby="rl-titre">
      <header className="rl-entete">
        <span className="rl-icone"><Languages size={22} /></span>
        <div>
          <h2 id="rl-titre">{t("Langue de l'application")}</h2>
          <p>{t("Le changement s'applique tout de suite, sur cet ordinateur.")}</p>
        </div>
      </header>

      <div className="rl-choix" role="radiogroup" aria-label={t('Langue')}>
        {Object.values(LANGUES).map((l) => {
          const actif = langue === l.code;
          const ap = APERCUS[l.code];
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={actif}
              lang={l.code}
              dir={l.dir}
              className={`rl-option ${actif ? 'is-actif' : ''}`}
              onClick={() => choisir(l.code)}
            >
              <span className="rl-option-haut">
                <span className="rl-option-titre">{ap.titre}</span>
                <span className="rl-radio" aria-hidden="true">{actif && <Check size={14} strokeWidth={3} />}</span>
              </span>
              <span className="rl-option-exemple">{ap.exemple}</span>
              <span className="rl-option-sens">{ap.sens}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}