// Éléments partagés entre BonMaintenanceDetails.jsx et BmdSousOnglets.jsx
// (déplacés ici pour éviter les imports circulaires)
import { useEffect, useRef, useState } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { t, locale } from '../../../i18n';

export const INTERVENANT_ETAT_LABELS = {
  0: 'Nouveau',
  1: 'En cours',
  2: 'Terminé',
  10: 'Annulé',
};

// Valeurs réelles de BonMaintenanceTache.etat
export const TACHE_ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

export const GRAVITE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
export const TYPE_CONTROLE_OPTIONS = ['Fonctionnel', 'Sécurité électrique', 'Calibration', 'Étalonnage', 'Autre'];
export const ETAT_IMMOBILISATION_OPTIONS = [
  { value: 1, label: 'Fonctionnel avec problème' },
  { value: 2, label: 'En panne' },
  { value: 3, label: 'À changer' },
  { value: 4, label: 'Hors service' },
];

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMontant(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  return t('{montant} DT', { montant: Number(valeur).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

export function warnIfQuantiteInvalide(articles, articleId, qte, libelleQuantite = 'quantité') {
  if (!articleId) return;
  const article = articles.find((a) => String(a.id) === String(articleId));
  const nomArticle = article?.designation || t('cet article');
  const libelle = t(libelleQuantite);

  if (qte === '' || qte == null) {
    alert(
      t('Attention : aucune {libelle} saisie pour « {article} ».', { libelle, article: nomArticle }) + '\n'
      + t('Vous pouvez continuer, mais pensez à renseigner la quantité si nécessaire.')
    );
    return;
  }

  const qteNum = Number(qte);
  if (isNaN(qteNum) || qteNum <= 0) {
    alert(
      t('Attention : la {libelle} saisie ({qte}) pour « {article} » semble invalide (elle doit être un nombre positif).', { libelle, qte, article: nomArticle }) + '\n'
      + t("Vous pouvez continuer si c'est volontaire.")
    );
  }
}

// Coût total d'un intervenant : valeur du backend si présente, sinon heures × coût unitaire + forfait
export function coutIntervenant(i) {
  if (i.coutTotal != null) return Number(i.coutTotal);
  if (i.coutUnitaire == null && i.nbrHeure == null && i.forfait == null) return null;
  return (Number(i.coutUnitaire) || 0) * (Number(i.nbrHeure) || 0) + (Number(i.forfait) || 0);
}

export function nomIntervenantAffiche(i) {
  if (!i) return null;
  return i.personnel
    ? `${i.personnel.nom} ${i.personnel.prenom}`
    : (i.sousTraitant?.raisonSociale || i.intervenantNom || t('Intervenant #{id}', { id: i.id }));
}

// Le backend journalise « Changement d'état : 0 -> 1 » : on affiche les libellés plutôt que les codes
export function libelleActionHistoriqueIntervenant(action) {
  const m = /^Changement d'état : (\d+|null) -> (\d+|null)$/.exec(action || '');
  if (!m) return t(action);
  const lbl = (v) => (v === 'null' ? '—' : t(INTERVENANT_ETAT_LABELS[v] ?? v));
  return t("Changement d'état : {de} → {a}", { de: lbl(m[1]), a: lbl(m[2]) });
}

// ============================================================
// SEARCHABLE SELECT (combobox avec recherche)
// ============================================================
export const SearchableSelect = ({
  id,
  name,
  value,
  onChange,
  options,
  getValue = (o) => o.id,
  getLabel = (o) => o.label ?? o.nom ?? String(o),
  getOptionHint = () => null,
  placeholder = 'Sélectionner...',
  emptyMessage = 'Aucun résultat',
  allowEmpty = false,
  emptyOptionLabel = '— Aucun —',
  disabled = false,
  loading = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(getValue(o)) === String(value));
  const selectedLabel = selected ? getLabel(selected) : '';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearch(selectedLabel);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (opt) => {
    onChange({ target: { name, value: String(getValue(opt)) } });
    setIsOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
    setSearch('');
    inputRef.current?.focus();
  };

  const term = search.trim().toLowerCase();
  const isSelectedLabel = selected && term === selectedLabel.toLowerCase();
  const filtered = (!term || isSelectedLabel)
    ? options
    : options.filter((o) => getLabel(o).toLowerCase().includes(term));

  const displayValue = isOpen ? search : selectedLabel;
  const rootClass = compact ? 'bmd-searchable bmd-searchable--compact' : 'bmd-searchable';

  return (
    <div className={rootClass} ref={containerRef}>
      <div className={`bmd-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={compact ? 13 : 15} strokeWidth={2.3} className="bmd-searchable-icon" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="bmd-searchable-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={loading ? t('Chargement...') : (selected ? '' : t(placeholder))}
          disabled={disabled || loading}
          autoComplete="off"
        />
        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="bmd-searchable-clear-inline"
            onClick={handleClear}
            aria-label={t('Effacer')}
            tabIndex={-1}
          >
            <X size={compact ? 11 : 13} strokeWidth={2.5} />
          </button>
        )}
        <ChevronDown
          size={compact ? 13 : 15}
          strokeWidth={2.3}
          className={`bmd-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmd-searchable-menu">
          <div className="bmd-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`bmd-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="bmd-searchable-option-main">
                  <span className="bmd-searchable-option-label">{t(emptyOptionLabel)}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="bmd-searchable-empty">{t(emptyMessage)}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmd-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="bmd-searchable-option-main">
                      <span className="bmd-searchable-option-label">{t(getLabel(o))}</span>
                      {hint && <span className="bmd-searchable-option-hint">{hint}</span>}
                    </span>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};