import React, { useState, useEffect, useMemo, useRef } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import personnelService from '../../../services/personnelService';
import authService from '../../../services/Authservice';
import {
  AlertTriangle, X, Car, User, Calendar, Gauge, Coins,
  Loader2, Save, Check, MapPin, Link2, Search,
  ShieldAlert, ShieldCheck, Shield, Zap,
  Ban, Package, ChevronRight, Sparkles,
  Activity, XCircle, Hourglass, AlertCircle,
  TrendingUp, Clock, FileText, Hammer,
  ChevronDown,
} from 'lucide-react';
import './Modal.css';
import './VehiculeIncidentModal.css';

// Codes alignés sur le backend (voir commentaires sur les champs
// `type`, `gravite` et `etat` dans VehiculeIncident.java).
const TYPE_OPTIONS = [
  { value: 1, label: 'Accident',    Icon: AlertTriangle, color: 'red' },
  { value: 2, label: 'Panne',       Icon: Zap,           color: 'amber' },
  { value: 3, label: 'Vol',         Icon: Ban,           color: 'purple' },
  { value: 4, label: 'Dégradation', Icon: Hammer,        color: 'blue' },
  { value: 5, label: 'Autre',       Icon: Package,       color: 'slate' },
];

const GRAVITE_OPTIONS = [
  { value: 1, label: 'Faible',  Icon: ShieldCheck, color: 'green' },
  { value: 2, label: 'Moyenne', Icon: Shield,      color: 'amber' },
  { value: 3, label: 'Grave',   Icon: ShieldAlert, color: 'red' },
];

const ETAT_OPTIONS = [
  { value: 0, label: 'Ouvert',   Icon: Hourglass, color: 'amber' },
  { value: 1, label: 'En cours', Icon: Activity,  color: 'blue' },
  { value: 2, label: 'Clôturé',  Icon: XCircle,   color: 'slate' },
];

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'vehicule',    label: 'Véhicule',     Icon: Car },
  { id: 'type',        label: 'Type',         Icon: AlertTriangle },
  { id: 'gravite',     label: 'Gravité',      Icon: Shield },
  { id: 'lieu',        label: 'Lieu & date',  Icon: MapPin },
  { id: 'conducteur',  label: 'Conducteur',   Icon: User },
  { id: 'description', label: 'Description',  Icon: FileText },
];

const emptyForm = {
  vehiculeId: '',
  type: 1,
  dateIncident: '',
  emplacementId: '',
  conducteurId: '',
  description: '',
  gravite: 1,
  etat: 0,
  kilometrage: '',
  cout: '',
  gmaoId: '',
  personnelCreationId: '',
  commentaire: '',
};

function toInputDateTime(iso) {
  if (!iso) return '';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMontant(v) {
  if (v == null || v === '') return '—';
  return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formatKm(v) {
  if (v == null || v === '') return '—';
  return `${Number(v).toLocaleString('fr-FR')} km`;
}

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
    <div className="vim-searchable" ref={containerRef}>
      <div className={`vim-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={15} strokeWidth={2.4} className="vim-searchable-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="vim-searchable-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={
            loading
              ? 'Chargement...'
              : (selected ? '' : placeholder)
          }
          disabled={disabled || loading}
          autoComplete="off"
        />

        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="vim-searchable-clear-inline"
            onClick={handleClear}
            aria-label="Effacer"
            tabIndex={-1}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}

        <ChevronDown
          size={15}
          strokeWidth={2.4}
          className={`vim-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="vim-searchable-menu">
          <div className="vim-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`vim-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ [getValue === ((o) => o.id) ? 'id' : 'id']: '' })}
              >
                <span className="vim-searchable-option-main">
                  <span className="vim-searchable-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && !allowEmpty ? (
              <div className="vim-searchable-empty">{emptyMessage}</div>
            ) : filtered.length === 0 && allowEmpty && term ? (
              <div className="vim-searchable-empty">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`vim-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="vim-searchable-option-main">
                      <span className="vim-searchable-option-label">{getLabel(o)}</span>
                      {hint && (
                        <span className="vim-searchable-option-hint">{hint}</span>
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

const VehiculeIncidentModal = ({ isOpen, onClose, onSave, incident, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('vehicule');

  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);
  const [vehiculeSearch, setVehiculeSearch] = useState('');

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchVehicules = async () => {
      setLoadingVehicules(true);
      try {
        const page = await vehiculeService.getAll(0, 300);
        setVehicules(page.content ?? []);
      } catch (err) {
        console.error(err);
        setVehicules([]);
      } finally {
        setLoadingVehicules(false);
      }
    };

    const fetchPersonnels = async () => {
      setLoadingPersonnels(true);
      try {
        const page = await personnelService.getAll(0, 300);
        setPersonnels(page.content ?? []);
      } catch (err) {
        console.error(err);
        setPersonnels([]);
      } finally {
        setLoadingPersonnels(false);
      }
    };

    fetchVehicules();
    fetchPersonnels();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveSection('vehicule');
    setVehiculeSearch('');
    setError(null);

    if (isEditing && incident) {
      setFormData({
        vehiculeId: incident.vehiculeId ?? '',
        type: incident.type ?? 1,
        dateIncident: toInputDateTime(incident.dateIncident),
        emplacementId: incident.emplacementId ?? '',
        conducteurId: incident.conducteurId ?? '',
        description: incident.description || '',
        gravite: incident.gravite ?? 1,
        etat: incident.etat ?? 0,
        kilometrage: incident.kilometrage ?? '',
        cout: incident.cout ?? '',
        gmaoId: incident.gmaoId ?? '',
        personnelCreationId: incident.personnelCreationId ?? '',
        commentaire: incident.commentaire || '',
      });
    } else {
      const ctx = authService.getContexteMetier();
      setFormData({
        ...emptyForm,
        dateIncident: toInputDateTime(new Date().toISOString()),
        personnelCreationId: ctx.userId ?? '',
      });
    }
  }, [isOpen, incident, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!formData.vehiculeId) {
      setError('Le véhicule est obligatoire.');
      setActiveSection('vehicule');
      return;
    }
    if (!formData.dateIncident) {
      setError("La date de l'incident est obligatoire.");
      setActiveSection('lieu');
      return;
    }
    if (!formData.personnelCreationId) {
      setError("Le champ « Déclaré par » est obligatoire.");
      setActiveSection('conducteur');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const declarant = personnels.find((p) => String(p.id) === String(formData.personnelCreationId));
      const declarantNomComplet = declarant ? `${declarant.nom} ${declarant.prenom}` : null;
      const payload = {
        vehiculeId: Number(formData.vehiculeId),
        type: Number(formData.type),
        dateIncident: formData.dateIncident || null,
        emplacementId: formData.emplacementId === '' ? null : Number(formData.emplacementId),
        conducteurId: formData.conducteurId === '' ? null : Number(formData.conducteurId),
        description: formData.description.trim() || null,
        gravite: Number(formData.gravite),
        etat: Number(formData.etat),
        kilometrage: formData.kilometrage === '' ? null : Number(formData.kilometrage),
        cout: formData.cout === '' ? null : Number(formData.cout),
        gmaoId: formData.gmaoId === '' ? null : Number(formData.gmaoId),
        personnelCreationId: Number(formData.personnelCreationId),
        personnelCreationNom: declarantNomComplet,
        commentaire: formData.commentaire.trim() || null,
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

  const vehiculeLabel = vehicules.find((v) => String(v.id) === String(formData.vehiculeId));
  const conducteurLabel = personnels.find((p) => String(p.id) === String(formData.conducteurId));
  const declarantLabel = personnels.find((p) => String(p.id) === String(formData.personnelCreationId));
  const typeMeta = TYPE_OPTIONS.find((o) => o.value === Number(formData.type)) ?? TYPE_OPTIONS[0];
  const graviteMeta = GRAVITE_OPTIONS.find((o) => o.value === Number(formData.gravite)) ?? GRAVITE_OPTIONS[0];
  const etatMeta = ETAT_OPTIONS.find((o) => o.value === Number(formData.etat)) ?? ETAT_OPTIONS[0];
  const TypeIcon = typeMeta.Icon;
  const EtatIcon = etatMeta.Icon;
  const GraviteIcon = graviteMeta.Icon;

  const vehiculesFiltres = useMemo(() => {
    if (!vehiculeSearch.trim()) return vehicules.slice(0, 6);
    const q = vehiculeSearch.toLowerCase();
    return vehicules.filter((v) => {
      const txt = `${v.matricule || ''} ${v.marque || ''} ${v.modele || ''}`.toLowerCase();
      return txt.includes(q);
    }).slice(0, 6);
  }, [vehicules, vehiculeSearch]);

  // ─── Badges compteurs par section ───
  const sectionCounts = {
    vehicule:    formData.vehiculeId ? 1 : 0,
    type:        1,
    gravite:     2,
    lieu:        [formData.dateIncident, formData.emplacementId, formData.kilometrage].filter(Boolean).length,
    conducteur:  [formData.conducteurId, formData.cout, formData.gmaoId, formData.personnelCreationId].filter(Boolean).length,
    description: [formData.description, formData.commentaire].filter(Boolean).length,
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeSection) {
      case 'vehicule':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Véhicule concerné</h3>
              <p>Sélectionne le véhicule impliqué dans l'incident</p>
            </div>

            <div className="vim-search">
              <Search size={16} strokeWidth={2.3} className="vim-search-icon" />
              <input
                type="text"
                placeholder="Rechercher par matricule, marque..."
                value={vehiculeSearch}
                onChange={(e) => setVehiculeSearch(e.target.value)}
              />
            </div>

            {loadingVehicules ? (
              <div className="vim-vehicules-loading">
                <Loader2 size={20} className="vim-spin" />
                <span>Chargement des véhicules...</span>
              </div>
            ) : vehiculesFiltres.length === 0 ? (
              <div className="vim-vehicules-empty">
                <Car size={24} strokeWidth={1.6} />
                <span>Aucun véhicule trouvé</span>
              </div>
            ) : (
              <div className="vim-vehicules-grid">
                {vehiculesFiltres.map((v) => {
                  const isSelected = String(formData.vehiculeId) === String(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`vim-vehicule-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, vehiculeId: v.id }))}
                    >
                      <div className="vim-vehicule-icon">
                        <Car size={18} strokeWidth={2.2} />
                      </div>
                      <div className="vim-vehicule-text">
                        <span className="vim-vehicule-matricule">
                          {v.matricule || `Véhicule #${v.id}`}
                        </span>
                        <span className="vim-vehicule-marque">
                          {v.marque || '—'}{v.modele ? ` · ${v.modele}` : ''}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="vim-vehicule-check">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'type':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Type d'incident</h3>
              <p>Nature de l'événement rencontré</p>
            </div>

            <div className="vim-type-grid">
              {TYPE_OPTIONS.map((o) => {
                const Icon = o.Icon;
                const isActive = Number(formData.type) === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`vim-type-card type-${o.color} ${isActive ? 'active' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, type: o.value }))}
                  >
                    <div className="vim-type-icon">
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span className="vim-type-label">{o.label}</span>
                    {isActive && <span className="vim-type-active-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'gravite':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Gravité &amp; état</h3>
              <p>Évaluation et suivi du traitement</p>
            </div>

            <div className="vim-field vim-field--full">
              <label>
                Gravité
                <span className={`vim-field-badge tag-${graviteMeta.color}`}>
                  {graviteMeta.label}
                </span>
              </label>
              <div className="vim-chips">
                {GRAVITE_OPTIONS.map((o) => {
                  const Icon = o.Icon;
                  const isActive = Number(formData.gravite) === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`vim-chip-btn chip-${o.color} ${isActive ? 'active' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, gravite: o.value }))}
                    >
                      <Icon size={13} strokeWidth={2.4} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="vim-field vim-field--full" style={{ marginTop: 20 }}>
              <label>
                Workflow de traitement
                <span className={`vim-field-badge tag-${etatMeta.color}`}>
                  {etatMeta.label}
                </span>
              </label>
              <div className="vim-workflow">
                {ETAT_OPTIONS.map((o, idx) => {
                  const Icon = o.Icon;
                  const isActive = Number(formData.etat) === o.value;
                  const isDone = Number(formData.etat) > o.value;
                  return (
                    <React.Fragment key={o.value}>
                      {idx > 0 && (
                        <span className={`vim-workflow-line ${isDone || isActive ? 'filled' : ''}`}>
                          <span className="vim-workflow-line-inner" />
                        </span>
                      )}
                      <button
                        type="button"
                        className={`vim-workflow-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} chip-${o.color}`}
                        onClick={() => setFormData((prev) => ({ ...prev, etat: o.value }))}
                      >
                        <span className="vim-workflow-bubble">
                          {isDone ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.4} />}
                        </span>
                        <span className="vim-workflow-label">{o.label}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'lieu':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Lieu, date &amp; kilométrage</h3>
              <p>Quand et où l'incident s'est-il produit ?</p>
            </div>

            <div className="vim-grid">
              <div className="vim-field vim-field--full">
                <label htmlFor="vim-date">
                  Date de l'incident <span className="vim-required">*</span>
                </label>
                <div className="vim-input-icon">
                  <Calendar size={15} strokeWidth={2.4} />
                  <input
                    id="vim-date"
                    type="datetime-local"
                    name="dateIncident"
                    value={formData.dateIncident}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="vim-field">
                <label htmlFor="vim-emplacement">Emplacement</label>
                <div className="vim-input-icon">
                  <MapPin size={15} strokeWidth={2.4} />
                  <input
                    id="vim-emplacement"
                    type="number"
                    name="emplacementId"
                    value={formData.emplacementId}
                    onChange={handleChange}
                    placeholder="ID emplacement"
                  />
                </div>
              </div>

              <div className="vim-field">
                <label htmlFor="vim-km">Kilométrage</label>
                <div className="vim-input-icon">
                  <Gauge size={15} strokeWidth={2.4} />
                  <input
                    id="vim-km"
                    type="number"
                    step="0.1"
                    min="0"
                    name="kilometrage"
                    value={formData.kilometrage}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'conducteur':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Conducteur, coût &amp; GMAO</h3>
              <p>Responsable et impact financier</p>
            </div>

            <div className="vim-grid">
              <div className="vim-field vim-field--full">
                <label htmlFor="vim-declarant">
                  Déclaré par <span className="vim-required">*</span>
                </label>
                <SearchableSelect
                  id="vim-declarant"
                  name="personnelCreationId"
                  value={formData.personnelCreationId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un déclarant..."
                  emptyMessage="Aucun personnel ne correspond"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
                {declarantLabel && (
                  <p className="vim-hint vim-hint--ok">
                    <Check size={12} strokeWidth={2.5} />
                    {declarantLabel.nom} {declarantLabel.prenom}
                  </p>
                )}
              </div>

              <div className="vim-field vim-field--full">
                <label htmlFor="vim-conducteur">Conducteur</label>
                <SearchableSelect
                  id="vim-conducteur"
                  name="conducteurId"
                  value={formData.conducteurId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un conducteur..."
                  emptyMessage="Aucun conducteur ne correspond"
                  allowEmpty
                  emptyOptionLabel="— Non affecté —"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
                {conducteurLabel && (
                  <p className="vim-hint vim-hint--ok">
                    <Check size={12} strokeWidth={2.5} />
                    {conducteurLabel.nom} {conducteurLabel.prenom}
                  </p>
                )}
              </div>

              <div className="vim-field">
                <label htmlFor="vim-cout">Coût estimé</label>
                <div className="vim-input-icon">
                  <Coins size={15} strokeWidth={2.4} />
                  <input
                    id="vim-cout"
                    type="number"
                    step="0.01"
                    min="0"
                    name="cout"
                    value={formData.cout}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="vim-field">
                <label htmlFor="vim-gmao">Opération GMAO</label>
                <div className="vim-input-icon">
                  <Link2 size={15} strokeWidth={2.4} />
                  <input
                    id="vim-gmao"
                    type="number"
                    name="gmaoId"
                    value={formData.gmaoId}
                    onChange={handleChange}
                    placeholder="ID GMAO"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'description':
        return (
          <div className="vim-content-pane">
            <div className="vim-pane-header">
              <h3>Description &amp; commentaires</h3>
              <p>Détaille précisément ce qui s'est passé</p>
            </div>

            <div className="vim-field vim-field--full">
              <label htmlFor="vim-description">Description</label>
              <textarea
                id="vim-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Décris ce qui s'est passé..."
              />
            </div>

            <div className="vim-field vim-field--full" style={{ marginTop: 16 }}>
              <label htmlFor="vim-commentaire">Commentaire interne</label>
              <textarea
                id="vim-commentaire"
                name="commentaire"
                value={formData.commentaire}
                onChange={handleChange}
                rows={3}
                placeholder="Notes internes, suivi..."
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vim-modal" onClick={(e) => e.stopPropagation()}>

        {/* ═══ HEADER GRADIENT TEAL ═══ */}
        <div className="vim-header">
          <div className="vim-header-left">
            <div className="vim-header-icon">
              <AlertTriangle size={22} strokeWidth={2.2} />
              <span className="vim-header-icon-pulse" />
            </div>
            <div className="vim-header-titles">
              <span className="vim-eyebrow">
                {isEditing ? 'Modification' : 'Nouvel incident'}
              </span>
              <h2>{vehiculeLabel?.matricule || 'Déclarer un incident'}</h2>
              <p className="vim-header-subtitle">
                {isEditing
                  ? 'Mets à jour les informations de cet incident'
                  : 'Remplis le formulaire pour enregistrer un nouvel incident'}
              </p>
            </div>
          </div>

          <div className="vim-header-right">
            <div className="vim-header-stats">
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">Type</span>
                <span className={`vim-header-stat-value tag-${typeMeta.color}`}>
                  <TypeIcon size={12} strokeWidth={2.5} />
                  {typeMeta.label}
                </span>
              </div>
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">Gravité</span>
                <span className={`vim-header-stat-value tag-${graviteMeta.color}`}>
                  <GraviteIcon size={12} strokeWidth={2.5} />
                  {graviteMeta.label}
                </span>
              </div>
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">État</span>
                <span className={`vim-header-stat-value tag-${etatMeta.color}`}>
                  <EtatIcon size={12} strokeWidth={2.5} />
                  {etatMeta.label}
                </span>
              </div>
            </div>
            <button type="button" className="vim-close" onClick={onClose}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ═══ LAYOUT : NAV + CONTENU + APERÇU ═══ */}
        <form className="vim-layout vim-layout--with-preview" onSubmit={handleSubmit}>

          {/* NAVIGATION LATÉRALE */}
          <aside className="vim-nav">
            <div className="vim-nav-title">Sections</div>
            <nav className="vim-nav-list">
              {NAV_SECTIONS.map((s) => {
                const isActive = activeSection === s.id;
                const count = sectionCounts[s.id];
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`vim-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setError(null);
                      setActiveSection(s.id);
                    }}
                  >
                    <span className="vim-nav-item-icon">
                      <Icon size={15} strokeWidth={2.3} />
                    </span>
                    <span className="vim-nav-item-label">{s.label}</span>
                    {count != null && count > 0 && (
                      <span className="vim-nav-item-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CONTENU */}
          <div className="vim-content">
            {renderContent()}

            {error && (
              <div className="vim-error-inline">
                <AlertCircle size={16} strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* APERÇU */}
          <aside className="vim-preview-wrap">
            <div className="vim-preview">
              <div className="vim-preview-head">
                <div className="vim-preview-head-icon">
                  <Sparkles size={14} strokeWidth={2.4} />
                </div>
                <div>
                  <span className="vim-preview-head-title">Aperçu live</span>
                  <span className="vim-preview-head-sub">Se met à jour en temps réel</span>
                </div>
              </div>

              <div className="vim-preview-card">
                <div className="vim-preview-label">Véhicule</div>
                <div className="vim-preview-vehicule">
                  <div className="vim-preview-vehicule-icon">
                    <Car size={18} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="vim-preview-vehicule-matricule">
                      {vehiculeLabel?.matricule || 'Non sélectionné'}
                    </div>
                    {vehiculeLabel && (
                      <div className="vim-preview-vehicule-marque">
                        {vehiculeLabel.marque}
                        {vehiculeLabel.modele ? ` · ${vehiculeLabel.modele}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="vim-preview-card">
                <div className="vim-preview-label">Classification</div>
                <div className="vim-preview-tags">
                  <span className={`vim-preview-tag tag-${typeMeta.color}`}>
                    <TypeIcon size={12} strokeWidth={2.5} />
                    {typeMeta.label}
                  </span>
                  <span className={`vim-preview-tag tag-${graviteMeta.color}`}>
                    <GraviteIcon size={12} strokeWidth={2.5} />
                    {graviteMeta.label}
                  </span>
                </div>
              </div>

              <div className="vim-preview-card">
                <div className="vim-preview-label">Progression du traitement</div>
                <div className="vim-preview-workflow">
                  {ETAT_OPTIONS.map((o, idx) => {
                    const Icon = o.Icon;
                    const isActive = Number(formData.etat) === o.value;
                    const isDone = Number(formData.etat) > o.value;
                    return (
                      <div
                        key={o.value}
                        className={`vim-preview-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                      >
                        <div className="vim-preview-step-line">
                          {idx > 0 && (
                            <span className={`vim-preview-step-connector ${isDone || isActive ? 'filled' : ''}`} />
                          )}
                          <div className="vim-preview-step-dot">
                            {isDone ? <Check size={11} strokeWidth={3} /> : <Icon size={11} strokeWidth={2.5} />}
                            {isActive && <span className="vim-preview-step-pulse" />}
                          </div>
                        </div>
                        <span className="vim-preview-step-label">{o.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="vim-preview-card">
                <div className="vim-preview-label">Date de l'incident</div>
                <div className="vim-preview-date">
                  <Clock size={14} strokeWidth={2.3} />
                  {formatDateFr(formData.dateIncident)}
                </div>
              </div>

              {conducteurLabel && (
                <div className="vim-preview-card">
                  <div className="vim-preview-label">Conducteur</div>
                  <div className="vim-preview-person">
                    <User size={14} strokeWidth={2.3} />
                    <div>
                      <div className="vim-preview-person-name">
                        {conducteurLabel.nom} {conducteurLabel.prenom}
                      </div>
                      {conducteurLabel.matricule && (
                        <div className="vim-preview-person-sub">{conducteurLabel.matricule}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="vim-preview-summary">
                <div className="vim-preview-summary-head">
                  <TrendingUp size={13} strokeWidth={2.5} />
                  <span>Impact financier</span>
                </div>
                <div className="vim-preview-summary-row">
                  <span>Kilométrage</span>
                  <span>{formatKm(formData.kilometrage)}</span>
                </div>
                <div className="vim-preview-summary-row">
                  <span>Coût estimé</span>
                  <span className="vim-preview-cost">{formatMontant(formData.cout)}</span>
                </div>
                <div className="vim-preview-summary-row">
                  <span>GMAO lié</span>
                  <span>{formData.gmaoId || '—'}</span>
                </div>
              </div>
            </div>
          </aside>
        </form>

        {/* FOOTER */}
        <div className="vim-footer">
          <div className="vim-footer-left">
            <span className="vim-footer-step">
              {NAV_SECTIONS.findIndex((s) => s.id === activeSection) + 1} / {NAV_SECTIONS.length}
            </span>
          </div>
          <div className="vim-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="vim-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : "Créer l'incident"}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculeIncidentModal;