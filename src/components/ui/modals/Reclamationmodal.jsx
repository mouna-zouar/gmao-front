import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle, FileText, MapPin, Tag, Users, X,
  Wrench, Save, Loader2, CheckCircle2,
  Search, ChevronDown, Check,
} from 'lucide-react';
import Button from '../Button';
import personnelService from '../../../services/personnelService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import serviceService from '../../../services/Serviceservice';
import cliniqueService from '../../../services/cliniqueService';
import prestataireDepotService from '../../../services/Prestatairedepotservice';
import authService from '../../../services/Authservice';
import './Modal.css';
import './ReclamationModal.css';

const ETAT_OPTIONS = [
  { value: 0, label: 'Ouverte' },
  { value: 1, label: 'En cours' },
  { value: 2, label: 'Clôturée' },
  { value: 3, label: 'En attente de validation' },
  { value: 4, label: 'Rejetée' },
];

const NIVEAU_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];

const TYPE_OPTIONS = [
  { value: 1, label: 'Curatif' },
  { value: 2, label: 'Correctif' },
  { value: 3, label: 'Préventif' },
  { value: 4, label: 'Installation' },
  { value: 5, label: 'Autre' },
];

const emptyForm = {
  num: '',
  n: '',
  description: '',
  etat: 0,
  criticite: '',
  urgence: '',
  type: '',
  personnelAffecteId: '',
  lotArticleImmobilistationId: '',
  serviceId: '',
  depotId: '',
  cliniqueId: '',
};

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'general',         label: 'Général',         Icon: FileText },
  { id: 'immobilisation',  label: 'Immobilisation',  Icon: Wrench, createOnly: true },
  { id: 'localisation',    label: 'Localisation',    Icon: MapPin },
  { id: 'classification',  label: 'Classification',  Icon: Tag },
  { id: 'affectation',     label: 'Affectation',     Icon: Users },
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

const ReclamationModal = ({ isOpen, onClose, onSave, reclamation, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [activeSection, setActiveSection] = useState('general');

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  const [immobilisations, setImmobilisations] = useState([]);
  const [loadingImmobilisations, setLoadingImmobilisations] = useState(false);

  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [cliniques, setCliniques] = useState([]);
  const [loadingCliniques, setLoadingCliniques] = useState(false);

  const [depots, setDepots] = useState([]);
  const [loadingDepots, setLoadingDepots] = useState(false);

  const [depotIdsDuService, setDepotIdsDuService] = useState(null);

  // ─── Reset sur open ───
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveSection('general');
  }, [isOpen]);

  // ─── Chargement des listes ───
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

    const fetchImmobilisations = async () => {
      setLoadingImmobilisations(true);
      try {
        const page = await lotArticleImmobilistationService.getAll(0, 200);
        setImmobilisations(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement immobilisations :', err);
        setImmobilisations([]);
      } finally {
        setLoadingImmobilisations(false);
      }
    };

    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const page = await serviceService.getAll(0, 200);
        setServices(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement services :', err);
        setServices([]);
      } finally {
        setLoadingServices(false);
      }
    };

    const fetchCliniques = async () => {
      setLoadingCliniques(true);
      try {
        const page = await cliniqueService.getAll(0, 200);
        setCliniques(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement cliniques :', err);
        setCliniques([]);
      } finally {
        setLoadingCliniques(false);
      }
    };

    const fetchDepots = async () => {
      setLoadingDepots(true);
      try {
        const page = await prestataireDepotService.getAll(0, 200);
        setDepots(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement dépôts :', err);
        setDepots([]);
      } finally {
        setLoadingDepots(false);
      }
    };

    fetchPersonnels();
    fetchImmobilisations();
    fetchServices();
    fetchCliniques();
    fetchDepots();
  }, [isOpen]);

  // ─── Dépôts filtrés par service ───
  useEffect(() => {
    if (!formData.serviceId) {
      setDepotIdsDuService(null);
      return;
    }
    let annule = false;
    prestataireDepotService.getDepotIdsByServiceId(formData.serviceId)
      .then((ids) => { if (!annule) setDepotIdsDuService(ids ?? []); })
      .catch((err) => {
        console.error('Erreur chargement dépôts du service :', err);
        if (!annule) setDepotIdsDuService([]);
      });
    return () => { annule = true; };
  }, [formData.serviceId]);

  const depotsDisponibles = useMemo(() => {
    if (depotIdsDuService === null) return depots;
    return depots.filter((d) => depotIdsDuService.includes(d.id));
  }, [depots, depotIdsDuService]);

  const servicesDisponibles = useMemo(() => {
    if (!formData.cliniqueId) return services;
    return services.filter((s) => String(s.cliniqueId) === String(formData.cliniqueId));
  }, [services, formData.cliniqueId]);

  useEffect(() => {
    if (!formData.serviceId) return;
    const toujoursValide = servicesDisponibles.some((s) => String(s.id) === String(formData.serviceId));
    if (!toujoursValide) {
      setFormData((prev) => ({ ...prev, serviceId: '', depotId: '' }));
    }
  }, [formData.cliniqueId, servicesDisponibles]);

  // ─── Pré-remplissage ───
  useEffect(() => {
    if (isOpen && reclamation && isEditing) {
      setFormData({
        num: reclamation.num || '',
        n: reclamation.n ?? '',
        description: reclamation.description || '',
        etat: reclamation.etat ?? 0,
        criticite: reclamation.criticite ?? '',
        urgence: reclamation.urgence ?? '',
        type: reclamation.type ?? '',
        personnelAffecteId: reclamation.personnelAffecteId ?? '',
        lotArticleImmobilistationId: reclamation.lotArticleImmobilistationId ?? '',
        serviceId: reclamation.serviceId ?? '',
        depotId: reclamation.depotId ?? '',
        cliniqueId: reclamation.cliniqueId ?? '',
      });
    } else if (isOpen) {
      const ctx = authService.getContexteMetier();
      setFormData({
        ...emptyForm,
        serviceId: ctx.serviceId ?? '',
        cliniqueId: ctx.cliniqueId ?? '',
      });
    }
    setError(null);
  }, [isOpen, reclamation, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.description.trim()) {
      setError('La description est obligatoire.');
      setActiveSection('general');
      return;
    }

    if (!isEditing && !formData.lotArticleImmobilistationId) {
      setError("L'immobilisation concernée est obligatoire à la création (elle sert à générer le bon de maintenance).");
      setActiveSection('immobilisation');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        num: formData.num.trim() || null,
        n: formData.n === '' ? null : Number(formData.n),
        description: formData.description.trim(),
        etat: Number(formData.etat),
        criticite: formData.criticite === '' ? null : Number(formData.criticite),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        type: formData.type === '' ? null : Number(formData.type),
        personnelAffecteId: formData.personnelAffecteId === '' ? null : Number(formData.personnelAffecteId),
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId === ''
          ? null
          : Number(formData.lotArticleImmobilistationId),
        serviceId: formData.serviceId === '' ? null : Number(formData.serviceId),
        serviceNom: formData.serviceId === ''
          ? null
          : services.find((s) => String(s.id) === String(formData.serviceId))?.description || null,
        depotId: formData.depotId === '' ? null : Number(formData.depotId),
        depotNom: formData.depotId === ''
          ? null
          : (() => {
              const d = depots.find((d) => String(d.id) === String(formData.depotId));
              return d ? (d.nom || d.codeDepots) : null;
            })(),
        cliniqueId: formData.cliniqueId === '' ? null : Number(formData.cliniqueId),
        cliniqueNom: formData.cliniqueId === ''
          ? null
          : cliniques.find((c) => String(c.id) === String(formData.cliniqueId))?.nom || null,
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

  const urgenceLabel = NIVEAU_OPTIONS.find((o) => o.value === Number(formData.urgence))?.label;

  const sectionCounts = {
    general: formData.description.trim() ? 1 : 0,
    immobilisation: formData.lotArticleImmobilistationId ? 1 : 0,
    localisation: [
      formData.cliniqueId,
      formData.serviceId,
      formData.depotId,
    ].filter(Boolean).length,
    classification: [
      formData.criticite,
      formData.urgence,
      formData.type,
    ].filter(Boolean).length,
    affectation: formData.personnelAffecteId ? 1 : 0,
  };

  const sectionsVisibles = NAV_SECTIONS.filter((s) => !s.createOnly || !isEditing);

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="rm-content-pane">
            <div className="rm-pane-header">
              <h3>Description du problème</h3>
              <p>Décris précisément le problème signalé</p>
            </div>

            <div className="rm-grid">
              <div className="rm-field rm-field--full">
                <label htmlFor="rcm-description">
                  Description <span className="rm-required">*</span>
                </label>
                <textarea
                  id="rcm-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Décrire le problème signalé..."
                  rows={5}
                  autoFocus
                  required
                />
              </div>

              <div className="rm-field">
                <label htmlFor="rcm-num">Numéro</label>
                <input
                  id="rcm-num"
                  type="text"
                  name="num"
                  value={formData.num}
                  onChange={handleChange}
                  placeholder="Ex : REC-2026-014"
                />
              </div>

              <div className="rm-field">
                <label htmlFor="rcm-n">N° interne</label>
                <input
                  id="rcm-n"
                  type="number"
                  name="n"
                  value={formData.n}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        );

      case 'immobilisation':
        return (
          <div className="rm-content-pane">
            <div className="rm-pane-header">
              <h3>Immobilisation concernée</h3>
              <p>Sélectionne l'équipement qui fait l'objet de la réclamation</p>
            </div>

            <div className="rm-grid">
              <div className="rm-field rm-field--full">
                <label htmlFor="rcm-immobilisation">
                  Immobilisation <span className="rm-required">*</span>
                </label>
                <SearchableSelect
                  id="rcm-immobilisation"
                  name="lotArticleImmobilistationId"
                  value={formData.lotArticleImmobilistationId}
                  onChange={handleChange}
                  options={immobilisations}
                  loading={loadingImmobilisations}
                  placeholder="Rechercher une immobilisation..."
                  emptyMessage="Aucune immobilisation ne correspond"
                  getValue={(i) => i.id}
                  getLabel={(i) =>
                    i.designation || i.libelle || i.code || `Immobilisation #${i.id}`
                  }
                  getOptionHint={(i) => (i.code ? `Code : ${i.code}` : null)}
                />
                <p className="rm-hint">
                  L'immobilisation est utilisée pour générer automatiquement le bon de maintenance associé.
                </p>
              </div>
            </div>
          </div>
        );

      case 'localisation':
        return (
          <div className="rm-content-pane">
            <div className="rm-pane-header">
              <h3>Localisation</h3>
              <p>Clinique, service et dépôt concernés</p>
            </div>

            <div className="rm-grid">
              <div className="rm-field">
                <label htmlFor="rcm-clinique">Clinique</label>
                <select
                  id="rcm-clinique"
                  name="cliniqueId"
                  value={formData.cliniqueId}
                  onChange={handleChange}
                  disabled={loadingCliniques}
                >
                  <option value="">— Sélectionner une clinique —</option>
                  {loadingCliniques ? (
                    <option disabled>Chargement...</option>
                  ) : (
                    cliniques.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom || `Clinique #${c.id}`}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="rm-field">
                <label htmlFor="rcm-service">Service</label>
                <SearchableSelect
                  id="rcm-service"
                  name="serviceId"
                  value={formData.serviceId}
                  onChange={handleChange}
                  options={servicesDisponibles}
                  loading={loadingServices}
                  placeholder="Rechercher un service..."
                  emptyMessage="Aucun service pour cette clinique"
                  allowEmpty
                  emptyOptionLabel="— Aucun service —"
                  getValue={(s) => s.id}
                  getLabel={(s) => s.description || s.code || `Service #${s.id}`}
                  getOptionHint={(s) => (s.code && s.description ? `Code : ${s.code}` : null)}
                />
              </div>

              <div className="rm-field rm-field--full">
                <label htmlFor="rcm-depot">Dépôt</label>
                <SearchableSelect
                  id="rcm-depot"
                  name="depotId"
                  value={formData.depotId}
                  onChange={handleChange}
                  options={depotsDisponibles}
                  loading={loadingDepots}
                  placeholder="Rechercher un dépôt..."
                  emptyMessage="Aucun dépôt associé à ce service"
                  allowEmpty
                  emptyOptionLabel="— Aucun dépôt —"
                  getValue={(d) => d.id}
                  getLabel={(d) => d.nom || d.codeDepots || `Dépôt #${d.id}`}
                  getOptionHint={(d) => (d.codeDepots ? `Code : ${d.codeDepots}` : null)}
                />
              </div>
            </div>
          </div>
        );

      case 'classification':
        return (
          <div className="rm-content-pane">
            <div className="rm-pane-header">
              <h3>Classification</h3>
              <p>Criticité, urgence, type et état de la réclamation</p>
            </div>

            <div className="rm-grid">
              <div className="rm-field">
                <label htmlFor="rcm-criticite">Criticité</label>
                <select id="rcm-criticite" name="criticite" value={formData.criticite} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="rm-field">
                <label htmlFor="rcm-urgence">Urgence</label>
                <select id="rcm-urgence" name="urgence" value={formData.urgence} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="rm-field">
                <label htmlFor="rcm-type">Type</label>
                <select id="rcm-type" name="type" value={formData.type} onChange={handleChange}>
                  <option value="">—</option>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {isEditing && (
                <div className="rm-field">
                  <label htmlFor="rcm-etat">État</label>
                  <select id="rcm-etat" name="etat" value={formData.etat} onChange={handleChange}>
                    {ETAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        );

      case 'affectation':
        return (
          <div className="rm-content-pane">
            <div className="rm-pane-header">
              <h3>Affectation</h3>
              <p>Personnel en charge du traitement</p>
            </div>

            <div className="rm-grid">
              <div className="rm-field rm-field--full">
                <label htmlFor="rcm-personnel">Personnel affecté</label>
                <SearchableSelect
                  id="rcm-personnel"
                  name="personnelAffecteId"
                  value={formData.personnelAffecteId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un personnel..."
                  emptyMessage="Aucun personnel ne correspond"
                  allowEmpty
                  emptyOptionLabel="— Non affecté —"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
                <p className="rm-hint">
                  Tu pourras affecter ou modifier le personnel à tout moment depuis la liste des réclamations.
                </p>
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
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="rm-header">
          <div className="rm-header-left">
            <div className="rm-header-icon-wrap">
              <AlertCircle size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="rm-eyebrow">
                {isEditing ? 'Modification' : 'Nouvelle entrée'}
              </span>
              <h2>{isEditing ? 'Modifier la réclamation' : 'Nouvelle réclamation'}</h2>
            </div>
          </div>
          <div className="rm-header-right">
            {urgenceLabel && (
              <span className={`rm-urgence-badge urgence-${formData.urgence}`}>
                {urgenceLabel}
              </span>
            )}
            <button type="button" className="rm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT SPLIT */}
        <form className="rm-layout" onSubmit={handleSubmit}>

          <aside className="rm-nav">
            <div className="rm-nav-title">Sections</div>
            <nav className="rm-nav-list">
              {sectionsVisibles.map((s) => {
                const isActive = activeSection === s.id;
                const count = sectionCounts[s.id];
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`rm-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveSection(s.id)}
                  >
                    <span className="rm-nav-item-icon">
                      <Icon size={15} strokeWidth={2.3} />
                    </span>
                    <span className="rm-nav-item-label">{s.label}</span>
                    {count != null && count > 0 && (
                      <span className="rm-nav-item-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="rm-content">
            {renderContent()}

            {error && (
              <div className="rm-error">
                <AlertCircle size={16} strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        {/* FOOTER */}
        <div className="rm-footer">
          <div className="rm-footer-left">
            <span className="rm-footer-step">
              {sectionsVisibles.findIndex((s) => s.id === activeSection) + 1} / {sectionsVisibles.length}
            </span>
          </div>
          <div className="rm-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="rm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Créer la réclamation'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReclamationModal;