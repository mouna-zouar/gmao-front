import React, { useState, useEffect, useRef } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import prestataireService from '../../../services/prestataireService';
import { CRITICITE_OPTIONS, CRITICITE_DEFAUT, criticiteHex } from '../../../constants/Criticite';
import authService from '../../../services/Authservice';
import {
  Car,
  X,
  Hash,
  Wrench,
  Shield,
  Calendar,
  Gauge,
  Loader2,
  AlertTriangle,
  Save,
  Bell,
  Truck,
  FileText,
  Search,
  ChevronDown,
  Check,
} from 'lucide-react';
import './Modal.css';
import './VehiculeModal.css';

// ─── Options ───
const TYPE_OPTIONS = [
  { value: 0, label: 'Véhicule léger' },
  { value: 1, label: 'Camion' },
  { value: 2, label: 'Engin' },
  { value: 3, label: 'Tracteur' },
  { value: 4, label: 'Autre' },
];

const NATURE_OPTIONS = [
  { value: 0, label: 'Temps' },
  { value: 1, label: 'Cycles' },
  { value: 2, label: 'Distance' },
];

const NOTIF_OPTIONS = [
  { value: 0, label: 'Aucune' },
  { value: 1, label: 'Email' },
  { value: 2, label: 'SMS' },
  { value: 3, label: 'Email + SMS' },
];

const emptyForm = {
  matricule: '',
  marque: '',
  numChassis: '',
  prestataireId: '',
  type: 0,
  lotArticleImmobilistationId: '',
  nature: 0,
  kilometrage: '',
  criticite: CRITICITE_DEFAUT,

  validiteVidange: '',
  validiteAssurance: '',
  validiteVignette: '',
  validiteVisiteTech: '',

  dateDernierVidange: '',
  kmDernierVidange: '',
  kmProchainVidange: '',
  dateProchainVidange: '',

  dateDernierAssurance: '',
  dateProchainAssurance: '',

  dateDernierVisiteTech: '',
  dateProchainVisiteTech: '',

  dateDernierVignette: '',
  dateProchainVignette: '',

  notifNbrJr: '',
  notifNbrKm: '',
  dateProchEvt: '',
  nbrKmEvt: '',
  nbrJrEvt: '',
  notif: 0,
};

// ─── Sections de navigation (remplace les steps) ───
const NAV_SECTIONS = [
  { id: 'identification', label: 'Identification', Icon: Car },
  { id: 'affectation',    label: 'Affectation',    Icon: Wrench },
  { id: 'validites',      label: 'Validités',      Icon: Shield },
  { id: 'echeances',      label: 'Échéances',      Icon: Calendar },
  { id: 'notifications',  label: 'Notifications',  Icon: Bell },
];

// ─── Utilitaires ───
function toDateInput(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toDateTimeInput(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Le backend attend un LocalDateTime (ex: "2024-01-15T00:00:00").
// Les <input type="date"> ne renvoient que "2024-01-15", ce qui fait
// échouer la désérialisation Jackson côté Spring (400 Bad Request)
// lors de la création/modification. On complète donc l'heure ici.
function toApiDateTime(dateOnly) {
  if (!dateOnly) return null;
  const s = String(dateOnly);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00`;
  return s;
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
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
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

  // Fermer au clic extérieur
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

  // Fermer avec Échap
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
    // On pré-remplit la recherche avec le label sélectionné pour permettre l'édition
    setSearch(selectedLabel);
    // Sélectionner tout le texte pour faciliter la saisie
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

  // Filtre
  const term = search.trim().toLowerCase();
  const isSelectedLabel = selected && term === selectedLabel.toLowerCase();
  const filtered = (!term || isSelectedLabel)
    ? options
    : options.filter((o) => getLabel(o).toLowerCase().includes(term));

  // Valeur affichée dans l'input
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
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmm-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span>{getLabel(o)}</span>
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

const VehiculeModal = ({ isOpen, onClose, onSave, vehicule, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeSection, setActiveSection] = useState('identification');

  const [immobilisations, setImmobilisations] = useState([]);
  const [loadingImmobilisations, setLoadingImmobilisations] = useState(false);

  const [prestataires, setPrestataires] = useState([]);
  const [loadingPrestataires, setLoadingPrestataires] = useState(false);

  // ─── Chargement des listes ───
  useEffect(() => {
    if (!isOpen) return;

    const fetchImmobilisations = async () => {
      setLoadingImmobilisations(true);
      try {
        const page = await lotArticleImmobilistationService.getAll(0, 300);
        setImmobilisations(page.content ?? []);
      } catch (err) {
        console.error('Erreur immobilisations :', err);
        setImmobilisations([]);
      } finally {
        setLoadingImmobilisations(false);
      }
    };

    const fetchPrestataires = async () => {
      setLoadingPrestataires(true);
      try {
        const page = await prestataireService.getAll(0, 300);
        setPrestataires(page.content ?? []);
      } catch (err) {
        console.error('Erreur prestataires :', err);
        setPrestataires([]);
      } finally {
        setLoadingPrestataires(false);
      }
    };

    fetchImmobilisations();
    fetchPrestataires();
  }, [isOpen]);

  // ─── Pré-remplissage ───
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setActiveSection('identification');

    if (isEditing && vehicule) {
      setFormData({
        matricule: vehicule.matricule ?? '',
        marque: vehicule.marque ?? '',
        numChassis: vehicule.numChassis ?? '',
        prestataireId: vehicule.prestataireId ?? '',
        type: vehicule.type ?? 0,
        lotArticleImmobilistationId: vehicule.lotArticleImmobilistationId ?? '',
        nature: vehicule.nature ?? 0,
        kilometrage: vehicule.kilometrage ?? '',
        criticite: vehicule.criticite ?? CRITICITE_DEFAUT,

        validiteVidange: vehicule.validiteVidange ?? '',
        validiteAssurance: vehicule.validiteAssurance ?? '',
        validiteVignette: vehicule.validiteVignette ?? '',
        validiteVisiteTech: vehicule.validiteVisiteTech ?? '',

        dateDernierVidange: toDateInput(vehicule.dateDernierVidange),
        kmDernierVidange: vehicule.kmDernierVidange ?? '',
        kmProchainVidange: vehicule.kmProchainVidange ?? '',
        dateProchainVidange: toDateInput(vehicule.dateProchainVidange),

        dateDernierAssurance: toDateInput(vehicule.dateDernierAssurance),
        dateProchainAssurance: toDateInput(vehicule.dateProchainAssurance),

        dateDernierVisiteTech: toDateInput(vehicule.dateDernierVisiteTech),
        dateProchainVisiteTech: toDateInput(vehicule.dateProchainVisiteTech),

        dateDernierVignette: toDateInput(vehicule.dateDernierVignette),
        dateProchainVignette: toDateInput(vehicule.dateProchainVignette),

        notifNbrJr: vehicule.notifNbrJr ?? '',
        notifNbrKm: vehicule.notifNbrKm ?? '',
        dateProchEvt: toDateTimeInput(vehicule.dateProchEvt),
        nbrKmEvt: vehicule.nbrKmEvt ?? '',
        nbrJrEvt: vehicule.nbrJrEvt ?? '',
        notif: vehicule.notif ?? 0,
      });
    } else {
      const ctx = authService.getContexteMetier();
      setFormData({ ...emptyForm, prestataireId: ctx.prestataireId ?? '' });
    }
  }, [isOpen, vehicule, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  // ─── Soumission ───
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!String(formData.matricule).trim()) {
      setError('Le matricule est obligatoire.');
      setActiveSection('identification');
      return;
    }
    if (!formData.lotArticleImmobilistationId) {
      setError("L'immobilisation liée est obligatoire.");
      setActiveSection('identification');
      return;
    }
    if (
      formData.validiteVidange === '' ||
      formData.validiteAssurance === '' ||
      formData.validiteVignette === '' ||
      formData.validiteVisiteTech === ''
    ) {
      setError('Les 4 durées de validité sont obligatoires.');
      setActiveSection('validites');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        matricule: String(formData.matricule).trim(),
        marque: formData.marque?.trim() || null,
        numChassis: formData.numChassis?.trim() || null,
        prestataireId: toNumOrNull(formData.prestataireId),
        clientId: null,
        type: Number(formData.type),
        lotArticleImmobilistationId: Number(formData.lotArticleImmobilistationId),
        nature: Number(formData.nature),
        kilometrage: toNumOrNull(formData.kilometrage),
        criticite: formData.criticite || CRITICITE_DEFAUT,

        validiteVidange: toNumOrNull(formData.validiteVidange),
        validiteAssurance: toNumOrNull(formData.validiteAssurance),
        validiteVignette: toNumOrNull(formData.validiteVignette),
        validiteVisiteTech: toNumOrNull(formData.validiteVisiteTech),

        dateDernierVidange: toApiDateTime(formData.dateDernierVidange),
        kmDernierVidange: toNumOrNull(formData.kmDernierVidange),
        kmProchainVidange: toNumOrNull(formData.kmProchainVidange),
        dateProchainVidange: toApiDateTime(formData.dateProchainVidange),

        dateDernierAssurance: toApiDateTime(formData.dateDernierAssurance),
        dateProchainAssurance: toApiDateTime(formData.dateProchainAssurance),

        dateDernierVisiteTech: toApiDateTime(formData.dateDernierVisiteTech),
        dateProchainVisiteTech: toApiDateTime(formData.dateProchainVisiteTech),

        dateDernierVignette: toApiDateTime(formData.dateDernierVignette),
        dateProchainVignette: toApiDateTime(formData.dateProchainVignette),

        notifNbrJr: toNumOrNull(formData.notifNbrJr),
        notifNbrKm: toNumOrNull(formData.notifNbrKm),
        dateProchEvt: toApiDateTime(formData.dateProchEvt),
        nbrKmEvt: toNumOrNull(formData.nbrKmEvt),
        nbrJrEvt: toNumOrNull(formData.nbrJrEvt),
        notif: Number(formData.notif),
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

  const typeLabel = TYPE_OPTIONS.find((o) => o.value === Number(formData.type))?.label ?? '';

  // ─── Badges compteurs par section ───
  const sectionCounts = {
    identification: [
      formData.matricule,
      formData.marque,
      formData.lotArticleImmobilistationId,
    ].filter(Boolean).length,
    affectation: formData.prestataireId ? 1 : 0,
    validites: [
      formData.validiteVidange,
      formData.validiteAssurance,
      formData.validiteVignette,
      formData.validiteVisiteTech,
    ].filter((v) => v !== '').length,
    echeances: [
      formData.dateDernierVidange,
      formData.dateProchainVidange,
      formData.dateDernierAssurance,
      formData.dateProchainAssurance,
      formData.dateDernierVisiteTech,
      formData.dateProchainVisiteTech,
      formData.dateDernierVignette,
      formData.dateProchainVignette,
    ].filter(Boolean).length,
    notifications: [
      formData.notifNbrJr,
      formData.notifNbrKm,
      formData.dateProchEvt,
      formData.nbrKmEvt,
      formData.nbrJrEvt,
    ].filter((v) => v !== '' && v != null).length,
  };

  // ─── Contenu des sections ───
  const renderContent = () => {
    switch (activeSection) {
      case 'identification':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Identification du véhicule</h3>
              <p>Matricule, marque, châssis et immobilisation</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vh-matricule">
                  Matricule <span className="bmm-required">*</span>
                </label>
                <input
                  id="vh-matricule"
                  type="text"
                  name="matricule"
                  value={formData.matricule}
                  onChange={handleChange}
                  placeholder="Ex : 123 TU 4567"
                  autoFocus
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-marque">Marque</label>
                <input
                  id="vh-marque"
                  type="text"
                  name="marque"
                  value={formData.marque}
                  onChange={handleChange}
                  placeholder="Ex : Renault, Peugeot..."
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-chassis">N° châssis</label>
                <input
                  id="vh-chassis"
                  type="text"
                  name="numChassis"
                  value={formData.numChassis}
                  onChange={handleChange}
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-km">Kilométrage</label>
                <div className="bmm-km-card bmm-km-card--inline">
                  <input
                    id="vh-km"
                    type="number"
                    name="kilometrage"
                    value={formData.kilometrage}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                  <span className="bmm-km-unit">km</span>
                </div>
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-type">Type</label>
                <select id="vh-type" name="type" value={formData.type} onChange={handleChange}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-nature">Nature</label>
                <select id="vh-nature" name="nature" value={formData.nature} onChange={handleChange}>
                  {NATURE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-criticite">
                  Criticité
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8, height: 8, borderRadius: '50%',
                      marginLeft: 6,
                      backgroundColor: criticiteHex(formData.criticite),
                    }}
                  />
                </label>
                <select
                  id="vh-criticite"
                  name="criticite"
                  value={formData.criticite}
                  onChange={handleChange}
                >
                  {CRITICITE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label htmlFor="vh-lot">
                  Immobilisation liée <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="vh-lot"
                  name="lotArticleImmobilistationId"
                  value={formData.lotArticleImmobilistationId}
                  onChange={handleChange}
                  options={immobilisations}
                  loading={loadingImmobilisations}
                  placeholder="Rechercher une immobilisation..."
                  searchPlaceholder="Rechercher par désignation, code..."
                  emptyMessage="Aucune immobilisation ne correspond"
                  getValue={(i) => i.id}
                  getLabel={(i) =>
                    i.designation || i.libelle || i.code || `Immobilisation #${i.id}`
                  }
                />
                {!loadingImmobilisations && immobilisations.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>
                    Aucune immobilisation trouvée. Vérifie le service.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'affectation':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Affectation</h3>
              <p>Prestataire associé au véhicule</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label htmlFor="vh-prestataire">Prestataire</label>
                <select
                  id="vh-prestataire"
                  name="prestataireId"
                  value={formData.prestataireId}
                  onChange={handleChange}
                  disabled={loadingPrestataires}
                >
                  <option value="">
                    {loadingPrestataires ? 'Chargement...' : '— Aucun —'}
                  </option>
                  {prestataires.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom || p.raisonSociale || p.libelle || `Prestataire #${p.id}`}
                    </option>
                  ))}
                </select>
                {!loadingPrestataires && prestataires.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>
                    Aucun prestataire trouvé. Vérifie le service.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'validites':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Durées de validité</h3>
              <p>Nombre de jours avant échéance pour chaque type <span className="bmm-required">*</span></p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vh-val-vid">Validité vidange</label>
                  <input
                    id="vh-val-vid"
                    type="number"
                    name="validiteVidange"
                    value={formData.validiteVidange}
                    onChange={handleChange}
                    placeholder="0"
                  />
                  <span className="bmm-km-unit">jours</span>
                
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-val-ass">Validité assurance</label>
                  <input
                    id="vh-val-ass"
                    type="number"
                    name="validiteAssurance"
                    value={formData.validiteAssurance}
                    onChange={handleChange}
                    placeholder="0"
                  />
                  <span className="bmm-km-unit">jours</span>
                
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-val-vig">Validité vignette</label>
                  <input
                    id="vh-val-vig"
                    type="number"
                    name="validiteVignette"
                    value={formData.validiteVignette}
                    onChange={handleChange}
                    placeholder="0"
                  />
                  <span className="bmm-km-unit">jours</span>
                
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-val-vis">Validité visite technique</label>
                  <input
                    id="vh-val-vis"
                    type="number"
                    name="validiteVisiteTech"
                    value={formData.validiteVisiteTech}
                    onChange={handleChange}
                    placeholder="0"
                  />
                  <span className="bmm-km-unit">jours</span>
                
              </div>
            </div>
          </div>
        );

      case 'echeances':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Dates &amp; échéances</h3>
              <p>Dernière et prochaine date pour chaque événement</p>
            </div>

            <div className="bmm-subsection">
              <h4>Vidange</h4>
              <div className="bmm-grid">
                <div className="bmm-field">
                  <label>Dernière vidange</label>
                  <input type="date" name="dateDernierVidange" value={formData.dateDernierVidange} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Prochaine vidange</label>
                  <input type="date" name="dateProchainVidange" value={formData.dateProchainVidange} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Km dernière vidange</label>
                  <input type="number" name="kmDernierVidange" value={formData.kmDernierVidange} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Km prochaine vidange</label>
                  <input type="number" name="kmProchainVidange" value={formData.kmProchainVidange} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="bmm-subsection">
              <h4>Assurance</h4>
              <div className="bmm-grid">
                <div className="bmm-field">
                  <label>Dernière assurance</label>
                  <input type="date" name="dateDernierAssurance" value={formData.dateDernierAssurance} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Prochaine assurance</label>
                  <input type="date" name="dateProchainAssurance" value={formData.dateProchainAssurance} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="bmm-subsection">
              <h4>Visite technique</h4>
              <div className="bmm-grid">
                <div className="bmm-field">
                  <label>Dernière visite</label>
                  <input type="date" name="dateDernierVisiteTech" value={formData.dateDernierVisiteTech} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Prochaine visite</label>
                  <input type="date" name="dateProchainVisiteTech" value={formData.dateProchainVisiteTech} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="bmm-subsection">
              <h4>Vignette</h4>
              <div className="bmm-grid">
                <div className="bmm-field">
                  <label>Dernière vignette</label>
                  <input type="date" name="dateDernierVignette" value={formData.dateDernierVignette} onChange={handleChange} />
                </div>
                <div className="bmm-field">
                  <label>Prochaine vignette</label>
                  <input type="date" name="dateProchainVignette" value={formData.dateProchainVignette} onChange={handleChange} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Notifications &amp; alertes</h3>
              <p>Règles d'alerte pour anticiper les échéances</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vh-notif">Canal de notification</label>
                <select id="vh-notif" name="notif" value={formData.notif} onChange={handleChange}>
                  {NOTIF_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-notif-jr">Notification (jours avant)</label>
                <input id="vh-notif-jr" type="number" name="notifNbrJr" value={formData.notifNbrJr} onChange={handleChange} />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-notif-km">Notification (km avant)</label>
                <input id="vh-notif-km" type="number" name="notifNbrKm" value={formData.notifNbrKm} onChange={handleChange} />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-date-evt">Date prochain événement</label>
                <input id="vh-date-evt" type="datetime-local" name="dateProchEvt" value={formData.dateProchEvt} onChange={handleChange} />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-km-evt">Nombre de km (événement)</label>
                <input id="vh-km-evt" type="number" name="nbrKmEvt" value={formData.nbrKmEvt} onChange={handleChange} />
              </div>

              <div className="bmm-field">
                <label htmlFor="vh-jr-evt">Nombre de jours (événement)</label>
                <input id="vh-jr-evt" type="number" name="nbrJrEvt" value={formData.nbrJrEvt} onChange={handleChange} />
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
      <div className="bmm-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Car size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Création'}
              </span>
              <h2>{isEditing ? 'Modifier le véhicule' : 'Nouveau véhicule'}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className="bmm-type-badge">{typeLabel}</span>
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
                  {isEditing ? 'Mettre à jour' : 'Créer le véhicule'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculeModal;