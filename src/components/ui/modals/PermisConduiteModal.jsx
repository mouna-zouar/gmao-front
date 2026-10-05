import React, { useState, useEffect, useRef } from 'react';
import Button from '../Button';
import personnelService from '../../../services/personnelService';
import permisConduiteService from '../../../services/permisConduiteService';
import {
  IdCard, X, User, Calendar, Loader2, AlertTriangle, Save, Tags, MapPin,
  Search, ChevronDown, Check,
} from 'lucide-react';
import './Modal.css';
import './BonMaintenanceModal.css';
import './PermisConduiteModal.css';

// ─── Référentiel de secours (au cas où l'appel /permis-conduite/categories échoue) ───
// Catégories du permis de conduire tunisien (ATTT / code de la route tunisien).
const FALLBACK_CATEGORIES = [
  { code: 'A1', libelleCourt: 'A1', libelle: 'Motocyclette légère', description: 'Cylindrée ≤ 125 cm³, puissance ≤ 11 kW.' },
  { code: 'A', libelleCourt: 'A', libelle: 'Motocyclette', description: 'Toutes cylindrées, avec ou sans side-car.' },
  { code: 'B', libelleCourt: 'B', libelle: 'Véhicule léger', description: 'PTAC ≤ 3,5 t, ≤ 8 places outre le conducteur.' },
  { code: 'B_E', libelleCourt: 'B+E', libelle: 'Véhicule léger + remorque', description: 'Catégorie B avec remorque > 750 kg.' },
  { code: 'C', libelleCourt: 'C', libelle: 'Poids lourd', description: 'PTAC > 3,5 t, transport de marchandises.' },
  { code: 'C_E', libelleCourt: 'C+E', libelle: 'Poids lourd + remorque', description: 'Catégorie C avec remorque > 750 kg (super-lourd).' },
  { code: 'D', libelleCourt: 'D', libelle: 'Transport en commun', description: 'Autobus, autocar : + de 8 places outre le conducteur.' },
  { code: 'D_E', libelleCourt: 'D+E', libelle: 'Transport en commun + remorque', description: 'Catégorie D avec remorque > 750 kg.' },
  { code: 'F', libelleCourt: 'F', libelle: 'Permis adapté', description: 'Personnes en situation de handicap, véhicule aménagé.' },
];

const emptyForm = {
  personnelId: '',
  numero: '',
  categories: [],
  dateDelivrance: '',
  dateExpiration: '',
  lieuDelivrance: '',
  observation: '',
};

const NAV_SECTIONS = [
  { id: 'conducteur', label: 'Conducteur', Icon: User },
  { id: 'categories', label: 'Catégories', Icon: Tags },
  { id: 'validite', label: 'Validité', Icon: Calendar },
];

// ─── Select avec recherche intégrée (combobox) ───
const SearchableSelect = ({
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
    <div className="bmm-searchable" ref={containerRef}>
      <div className={`bmm-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={15} strokeWidth={2.3} className="bmm-searchable-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="bmm-searchable-input"
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
            className="bmm-searchable-clear-inline"
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
          className={`bmm-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmm-searchable-menu">
          <div className="bmm-searchable-options">
            {filtered.length === 0 ? (
              <div className="bmm-searchable-empty">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmm-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="bmm-searchable-option-main">
                      <span className="bmm-searchable-option-label">{getLabel(o)}</span>
                      {hint && (
                        <span className="bmm-searchable-option-hint">{hint}</span>
                      )}
                    </span>
                    {isSelected && <Check size={14} strokeWidth={2.5} />}
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

const PermisConduiteModal = ({ isOpen, onClose, onSave, permis, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [activeSection, setActiveSection] = useState('conducteur');

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPersonnels = async () => {
      setLoadingPersonnels(true);
      try {
        const page = await personnelService.getAll(0, 200);
        setPersonnels(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement personnel :', err);
        setPersonnels([]);
      } finally {
        setLoadingPersonnels(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const data = await permisConduiteService.getCategories();
        if (Array.isArray(data) && data.length > 0) setCategories(data);
      } catch (err) {
        console.error('Erreur chargement catégories de permis, utilisation du référentiel local :', err);
        setCategories(FALLBACK_CATEGORIES);
      }
    };

    fetchPersonnels();
    fetchCategories();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setActiveSection('conducteur');

    if (isEditing && permis) {
      setFormData({
        personnelId: permis.personnelId ?? '',
        numero: permis.numero ?? '',
        categories: Array.isArray(permis.categories) ? permis.categories : [],
        dateDelivrance: permis.dateDelivrance ?? '',
        dateExpiration: permis.dateExpiration ?? '',
        lieuDelivrance: permis.lieuDelivrance ?? '',
        observation: permis.observation ?? '',
      });
    } else {
      setFormData(emptyForm);
    }
  }, [isOpen, permis, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const toggleCategorie = (code) => {
    setFormData((prev) => {
      const has = prev.categories.includes(code);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => c !== code)
          : [...prev.categories, code],
      };
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.personnelId) {
      setError('Le conducteur est obligatoire.');
      setActiveSection('conducteur');
      return;
    }
    if (!formData.numero.trim()) {
      setError('Le numéro du permis est obligatoire.');
      setActiveSection('conducteur');
      return;
    }
    if (formData.categories.length === 0) {
      setError('Sélectionnez au moins une catégorie de permis.');
      setActiveSection('categories');
      return;
    }
    if (!formData.dateDelivrance) {
      setError('La date de délivrance est obligatoire.');
      setActiveSection('validite');
      return;
    }
    if (formData.dateExpiration && formData.dateExpiration < formData.dateDelivrance) {
      setError("La date d'expiration ne peut pas être antérieure à la date de délivrance.");
      setActiveSection('validite');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        personnelId: Number(formData.personnelId),
        numero: formData.numero.trim(),
        categories: formData.categories,
        dateDelivrance: formData.dateDelivrance,
        dateExpiration: formData.dateExpiration || null,
        lieuDelivrance: formData.lieuDelivrance.trim() || null,
        observation: formData.observation.trim() || null,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Échec de l'enregistrement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const conducteurLabel = personnels.find((p) => String(p.id) === String(formData.personnelId));

  const sectionCounts = {
    conducteur: [formData.personnelId, formData.numero].filter(Boolean).length,
    categories: formData.categories.length,
    validite: [formData.dateDelivrance, formData.dateExpiration].filter(Boolean).length,
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'conducteur':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Conducteur &amp; numéro</h3>
              <p>À qui appartient ce permis, et quel est son numéro ?</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="pc-personnel">
                  Conducteur <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="pc-personnel"
                  name="personnelId"
                  value={formData.personnelId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un conducteur..."
                  emptyMessage="Aucun conducteur ne correspond"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
                {!loadingPersonnels && personnels.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>Aucun personnel trouvé.</p>
                )}
              </div>

              <div className="bmm-field">
                <label htmlFor="pc-numero">
                  Numéro du permis <span className="bmm-required">*</span>
                </label>
                <input
                  id="pc-numero"
                  type="text"
                  name="numero"
                  placeholder="Ex : 1234567"
                  value={formData.numero}
                  onChange={handleChange}
                />
                <p className="bmm-hint">Numéro imprimé sur le titre du permis.</p>
              </div>

              <div className="bmm-field">
                <label htmlFor="pc-lieu">Lieu de délivrance</label>
                <input
                  id="pc-lieu"
                  type="text"
                  name="lieuDelivrance"
                  placeholder="Ex : Sfax"
                  value={formData.lieuDelivrance}
                  onChange={handleChange}
                />
                <p className="bmm-hint">
                  <MapPin size={12} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  Bureau ATTT ou ville de délivrance (optionnel).
                </p>
              </div>
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Catégories de permis</h3>
              <p>Catégories tunisiennes détenues par ce conducteur (une ou plusieurs).</p>
            </div>

            {categories.length === 0 ? (
              <p className="pcm-category-empty">Aucune catégorie disponible.</p>
            ) : (
              <div className="pcm-categories-grid">
                {categories.map((c) => {
                  const checked = formData.categories.includes(c.code);
                  return (
                    <label
                      key={c.code}
                      className={`pcm-category-card ${checked ? 'checked' : ''}`}
                      title={c.description}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategorie(c.code)}
                      />
                      <span className="pcm-category-text">
                        <span className="pcm-category-code">{c.libelleCourt || c.code}</span>
                        <span className="pcm-category-libelle">{c.libelle}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'validite':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Validité</h3>
              <p>Dates de délivrance et d'expiration, remarques éventuelles.</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="pc-date-delivrance">
                  Date de délivrance <span className="bmm-required">*</span>
                </label>
                <input
                  id="pc-date-delivrance"
                  type="date"
                  name="dateDelivrance"
                  value={formData.dateDelivrance}
                  onChange={handleChange}
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="pc-date-expiration">Date d'expiration</label>
                <input
                  id="pc-date-expiration"
                  type="date"
                  name="dateExpiration"
                  value={formData.dateExpiration}
                  onChange={handleChange}
                />
                <p className="bmm-hint">Laisser vide si le permis n'a pas de date de péremption.</p>
              </div>

              <div className="bmm-field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="pc-observation">Observation</label>
                <textarea
                  id="pc-observation"
                  name="observation"
                  rows={3}
                  placeholder="Remarques éventuelles (restriction, mention spéciale...)"
                  value={formData.observation}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="bmm-summary">
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Conducteur</span>
                <span className="bmm-summary-value">
                  {conducteurLabel ? `${conducteurLabel.nom} ${conducteurLabel.prenom}` : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Numéro</span>
                <span className="bmm-summary-value">{formData.numero || '—'}</span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Catégories</span>
                <span className="bmm-summary-value">
                  {formData.categories.length > 0 ? formData.categories.join(', ') : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Validité</span>
                <span className="bmm-summary-value">
                  {formData.dateDelivrance || '—'} → {formData.dateExpiration || 'sans expiration'}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bmm-modal bmm-modal--sm" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <IdCard size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Création'}
              </span>
              <h2>{isEditing ? 'Modifier le permis' : 'Ajouter un permis de conduire'}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <button type="button" className="bmm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT SPLIT : NAV + CONTENU */}
        <form className="bmm-layout" onSubmit={handleSubmit}>

          {/* NAVIGATION LATÉRALE */}
          <aside className="bmm-nav">
            <div className="bmm-nav-title">Sections</div>
            <nav className="bmm-nav-list">
              {NAV_SECTIONS.map((s) => {
                const isActive = activeSection === s.id;
                const count = sectionCounts[s.id];
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`bmm-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setError(null);
                      setActiveSection(s.id);
                    }}
                  >
                    <span className="bmm-nav-item-icon">
                      <Icon size={15} strokeWidth={2.3} />
                    </span>
                    <span className="bmm-nav-item-label">{s.label}</span>
                    {count != null && count > 0 && (
                      <span className="bmm-nav-item-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CONTENU */}
          <div className="bmm-content">
            {renderContent()}

            {error && (
              <div className="bmm-error">
                <AlertTriangle size={16} strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        {/* FOOTER */}
        <div className="bmm-footer">
          <div className="bmm-footer-left">
            <span className="bmm-footer-step">
              {NAV_SECTIONS.findIndex((s) => s.id === activeSection) + 1} / {NAV_SECTIONS.length}
            </span>
          </div>
          <div className="bmm-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Ajouter'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PermisConduiteModal;