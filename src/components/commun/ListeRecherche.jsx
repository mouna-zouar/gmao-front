import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import './ListeRecherche.css';

/*
 * Liste déroulante avec recherche intégrée (combobox).
 * Même contrat qu'un <select> : onChange({ target: { name, value } }).
 *   options, getValue(o), getLabel(o), getOptionHint(o), allowEmpty + emptyOptionLabel, loading, disabled
 * Utilisée par les formulaires dynamiques (type « recherche ») et la fenêtre « Affecter ».
 */
const ListeRecherche = ({
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

  return (
    <div className="rm-select" ref={containerRef}>
      <div className={`rm-select-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={15} strokeWidth={2.3} className="rm-select-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="rm-select-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={loading ? 'Chargement...' : (selected ? '' : placeholder)}
          disabled={disabled || loading}
          autoComplete="off"
        />

        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="rm-select-clear"
            onClick={handleClear}
            aria-label="Effacer"
            tabIndex={-1}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}

        <ChevronDown
          size={15}
          strokeWidth={2.3}
          className={`rm-select-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="rm-select-menu">
          <div className="rm-select-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`rm-select-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="rm-select-option-main">
                  <span className="rm-select-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="rm-select-empty">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`rm-select-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="rm-select-option-main">
                      <span className="rm-select-option-label">{getLabel(o)}</span>
                      {hint && (
                        <span className="rm-select-option-hint">{hint}</span>
                      )}
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

export default ListeRecherche;
