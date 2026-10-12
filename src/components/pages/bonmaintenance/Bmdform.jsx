// Briques de formulaire guidées : chaque champ a un libellé clair, une aide en une phrase,
// et les choix fermés deviennent de gros boutons au lieu de listes déroulantes.
import { Check, Loader2, X } from 'lucide-react';
import { t } from '../../../i18n';
import './BmdForm.css';

// Formulaire découpé en étapes numérotées (c'est une vraie séquence : on remplit dans l'ordre)
export function BmfFormulaire({ titre, intro, onSubmit, children }) {
  return (
    <form className="bmf-form" onSubmit={onSubmit}>
      {(titre || intro) && (
        <header className="bmf-form-entete">
          {titre && <h3>{t(titre)}</h3>}
          {intro && <p>{t(intro)}</p>}
        </header>
      )}
      <div className="bmf-etapes">{children}</div>
    </form>
  );
}

export function BmfEtape({ numero, titre, aide, children }) {
  return (
    <fieldset className="bmf-etape">
      <legend className="bmf-etape-titre">
        <span className="bmf-etape-num" aria-hidden="true">{numero}</span>
        <span>
          {t(titre)}
          {aide && <small>{t(aide)}</small>}
        </span>
      </legend>
      <div className="bmf-etape-champs">{children}</div>
    </fieldset>
  );
}

// Un champ : libellé au-dessus, aide en dessous, jamais de placeholder seul
export function BmfChamp({ label, aide, requis = false, large = false, alerte, info, children, htmlFor }) {
  return (
    <div className={`bmf-champ ${large ? 'is-large' : ''}`}>
      <label className="bmf-label" htmlFor={htmlFor}>
        {t(label)}
        {requis ? <span className="bmf-requis">{t('obligatoire')}</span> : <span className="bmf-optionnel">{t('facultatif')}</span>}
      </label>
      {children}
      {info && <p className="bmf-info">{t(info)}</p>}
      {alerte && <p className="bmf-alerte" role="alert">{t(alerte)}</p>}
      {aide && !alerte && <p className="bmf-aide">{t(aide)}</p>}
    </div>
  );
}

// Choix fermé en pastilles (remplace les <select> Oui/Non, Gravité, État…)
// options : [{ value, label, ton?, icon? }]
export function BmfChoix({ value, onChange, options, nom, effacable = true, grand = false }) {
  return (
    <div className={`bmf-choix ${grand ? 'is-grand' : ''}`} role="radiogroup" aria-label={t(nom)}>
      {options.map((o) => {
        const actif = String(value) === String(o.value);
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={actif}
            className={`bmf-choix-btn bmf-ton--${o.ton || 'brand'} ${actif ? 'is-actif' : ''}`}
            onClick={() => onChange(actif && effacable ? '' : String(o.value))}
          >
            {Icon ? <Icon size={grand ? 20 : 16} /> : actif && <Check size={15} strokeWidth={3} />}
            <span>{t(o.label)}</span>
            {o.aide && grand && <small>{t(o.aide)}</small>}
          </button>
        );
      })}
    </div>
  );
}

// Champ numérique avec son unité affichée (h, DT, …)
export function BmfNombre({ id, value, onChange, unite, step = 'any', min, placeholder, onBlur }) {
  return (
    <div className="bmf-nombre">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value}
        placeholder={t(placeholder)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {unite && <span className="bmf-unite">{t(unite)}</span>}
    </div>
  );
}

export function BmfTexte({ id, value, onChange, placeholder, multiligne = false, rows = 3, autoFocus = false, requis = false }) {
  return multiligne ? (
    <textarea
      id={id}
      className="bmf-input"
      rows={rows}
      required={requis}
      value={value}
      placeholder={t(placeholder)}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      id={id}
      type="text"
      className="bmf-input"
      value={value}
      placeholder={t(placeholder)}
      autoFocus={autoFocus}
      required={requis}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function BmfDate({ id, value, onChange }) {
  return (
    <input
      id={id}
      type="datetime-local"
      className="bmf-input bmf-input--date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Indication de stock disponible sous un champ article
export function BmfStock({ verification, quantite, demande }) {
  if (verification) {
    return <span className="bmf-stock"><Loader2 size={14} className="bmf-tourne" /> {t('Vérification du stock…')}</span>;
  }
  if (quantite == null) return <span className="bmf-stock">{t('Stock inconnu')}</span>;
  const manque = demande !== '' && demande != null && Number(demande) > Number(quantite);
  const vide = Number(quantite) <= 0;
  return (
    <span className={`bmf-stock ${manque || vide ? 'is-manque' : 'is-ok'}`}>
      {vide ? t('Rupture de stock') : t('{n} en stock', { n: quantite })}
      {manque && !vide ? t(' : il en manque {n}', { n: Number(demande) - Number(quantite) }) : ''}
    </span>
  );
}

// Barre d'actions collée en bas du formulaire
export function BmfActions({ enregistrement, label, labelEnCours = 'Enregistrement…', onAnnuler }) {
  return (
    <div className="bmf-actions">
      {onAnnuler && (
        <button type="button" className="bmf-btn bmf-btn--annuler" onClick={onAnnuler}>
          <X size={16} /> {t('Annuler')}
        </button>
      )}
      <button type="submit" className="bmf-btn bmf-btn--valider" disabled={enregistrement}>
        {enregistrement ? <Loader2 size={17} className="bmf-tourne" /> : <Check size={17} strokeWidth={2.6} />}
        {enregistrement ? t(labelEnCours) : t(label)}
      </button>
    </div>
  );
}