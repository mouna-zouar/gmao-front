import { useEffect, useRef } from 'react';
import { CheckSquare, Trash2, X } from 'lucide-react';
import { t } from '../../../i18n';
import './SelectionMultiple.css';

/** Case à cocher accessible, avec état « partiel » (une partie de la page cochée). */
export function CaseSelection({ coche, partiel = false, disabled = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = partiel; }, [partiel]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="case-selection"
      checked={coche}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
    />
  );
}

/*
 * Barre affichée dès qu'au moins une ligne est cochée :
 * nombre sélectionné, « Tout sélectionner (N) », « Désélectionner », « Supprimer la sélection ».
 */
export default function SelectionMultiple({ nombre, total, libelle, onToutSelectionner, onVider, onSupprimer, suppressionEnCours }) {
  if (!nombre) return null;
  return (
    <div className="selection-barre" role="region" aria-label={t('Sélection')}>
      <span className="selection-barre__compte">
        <CheckSquare size={17} aria-hidden="true" />
        {libelle(nombre)}
      </span>
      {nombre < total && (
        <button type="button" className="selection-barre__lien" onClick={onToutSelectionner}>
          {t('Tout sélectionner ({n})', { n: total })}
        </button>
      )}
      <button type="button" className="selection-barre__lien" onClick={onVider}>
        <X size={14} aria-hidden="true" />
        {t('Désélectionner')}
      </button>
      <span className="selection-barre__espace" />
      <button type="button" className="selection-barre__supprimer" onClick={onSupprimer} disabled={suppressionEnCours}>
        <Trash2 size={16} aria-hidden="true" />
        {suppressionEnCours ? t('Suppression...') : t('Supprimer la sélection')}
      </button>
    </div>
  );
}