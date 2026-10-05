import React, { useState, useEffect, useMemo, useRef } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import personnelService from '../../../services/personnelService';
import emplacementService from '../../../services/emplacementService';
import projetService from '../../../services/projetService';
import vehiculeReservationService from '../../../services/vehiculeReservationService';
import vehiculeConducteurService from '../../../services/vehiculeConducteurService';
import authService from '../../../services/Authservice';
import {
  X, Car, User, Calendar, MapPin, Flag, Check, Loader2,
  AlertTriangle, Save, Search, Clock, Route, FileText,
  ChevronRight, ChevronDown, Sparkles, Shield, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import './Modal.css';
import './VehiculeReservationModal.css';

// Codes alignés sur le backend (voir commentaire sur le champ `etat`
// dans VehiculeReservation.java) :
// 0 = En attente, 1 = Acceptée, 2 = Refusée, 3 = Annulée, 4 = Terminée
const ETAT_OPTIONS = [
  { value: 0, label: 'En attente', color: 'amber' },
  { value: 1, label: 'Acceptée', color: 'green' },
  { value: 2, label: 'Refusée', color: 'red' },
  { value: 3, label: 'Annulée', color: 'red' },
  { value: 4, label: 'Terminée', color: 'slate' },
];

const emptyForm = {
  vehiculeId: '',
  personnelId: '',
  dateDebut: '',
  dateFin: '',
  conducteurId: '',
  sourceId: '',
  destinationId: '',
  motif: '',
  projetId: '',
  etat: 0,
  commentaire: '',
};

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'vehicule', label: 'Véhicule',      Icon: Car },
  { id: 'periode',  label: 'Période',       Icon: Calendar },
  { id: 'equipe',   label: 'Équipe',        Icon: User },
  { id: 'trajet',   label: 'Trajet',        Icon: Route },
  { id: 'projet',   label: 'Projet & statut', Icon: FileText },
];

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

function durationLabel(debut, fin) {
  if (!debut || !fin) return null;
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  if (isNaN(d1) || isNaN(d2) || d2 <= d1) return null;
  const diffMs = d2 - d1;
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)} h`;
  const days = hours / 24;
  return `${days.toFixed(1)} j`;
}

function emplacementLabel(e) {
  if (!e) return null;
  return e.nom || e.adresse || `Emplacement #${e.id}`;
}

function projetLabel(p) {
  if (!p) return null;
  if (p.code && p.nom) return `${p.code} — ${p.nom}`;
  return p.nom || p.code || `Projet #${p.id}`;
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
    <div className="vrm-searchable" ref={containerRef}>
      <div className={`vrm-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={15} strokeWidth={2.3} className="vrm-searchable-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="vrm-searchable-input"
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
            className="vrm-searchable-clear-inline"
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
          className={`vrm-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="vrm-searchable-menu">
          <div className="vrm-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`vrm-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="vrm-searchable-option-main">
                  <span className="vrm-searchable-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="vrm-searchable-empty">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`vrm-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="vrm-searchable-option-main">
                      <span className="vrm-searchable-option-label">{getLabel(o)}</span>
                      {hint && (
                        <span className="vrm-searchable-option-hint">{hint}</span>
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

const VehiculeReservationModal = ({ isOpen, onClose, onSave, reservation, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeSection, setActiveSection] = useState('vehicule');

  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);
  const [vehiculeSearch, setVehiculeSearch] = useState('');

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  const [emplacements, setEmplacements] = useState([]);
  const [loadingEmplacements, setLoadingEmplacements] = useState(false);

  const [projets, setProjets] = useState([]);
  const [loadingProjets, setLoadingProjets] = useState(false);

  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const [eligibilite, setEligibilite] = useState(null);
  const [checkingEligibilite, setCheckingEligibilite] = useState(false);

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

    const fetchEmplacements = async () => {
      setLoadingEmplacements(true);
      try {
        const page = await emplacementService.getAll(0, 300);
        setEmplacements(page.content ?? []);
      } catch (err) {
        console.error(err);
        setEmplacements([]);
      } finally {
        setLoadingEmplacements(false);
      }
    };

    const fetchProjets = async () => {
      setLoadingProjets(true);
      try {
        const page = await projetService.getAll(0, 300);
        setProjets(page.content ?? []);
      } catch (err) {
        console.error(err);
        setProjets([]);
      } finally {
        setLoadingProjets(false);
      }
    };

    fetchVehicules();
    fetchPersonnels();
    fetchEmplacements();
    fetchProjets();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setActiveSection('vehicule');
    setVehiculeSearch('');

    if (isEditing && reservation) {
      setFormData({
        vehiculeId: reservation.vehiculeId ?? '',
        personnelId: reservation.personnelId ?? '',
        dateDebut: toInputDateTime(reservation.dateDebut),
        dateFin: toInputDateTime(reservation.dateFin),
        conducteurId: reservation.conducteurId ?? '',
        sourceId: reservation.sourceId ?? '',
        destinationId: reservation.destinationId ?? '',
        motif: reservation.motif || '',
        projetId: reservation.projetId ?? '',
        etat: reservation.etat ?? 0,
        commentaire: reservation.commentaire || '',
      });
    } else {
      const now = new Date();
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const ctx = authService.getContexteMetier();
      setFormData({
        ...emptyForm,
        dateDebut: toInputDateTime(now.toISOString()),
        dateFin: toInputDateTime(inTwoHours.toISOString()),
        personnelId: ctx.userId ?? '',
      });
    }
  }, [isOpen, reservation, isEditing]);

  useEffect(() => {
    if (!isOpen) return;
    if (!formData.vehiculeId || !formData.dateDebut || !formData.dateFin) {
      setConflicts([]);
      return;
    }
    if (formData.dateFin <= formData.dateDebut) {
      setConflicts([]);
      return;
    }

    let cancelled = false;
    setCheckingConflicts(true);
    const timer = setTimeout(async () => {
      try {
        const result = await vehiculeReservationService.checkConflicts(
          formData.vehiculeId,
          formData.dateDebut,
          formData.dateFin,
          isEditing ? reservation?.id : undefined,
        );
        if (!cancelled) setConflicts(Array.isArray(result) ? result : []);
      } catch (err) {
        if (!cancelled) setConflicts([]);
        console.error(err);
      } finally {
        if (!cancelled) setCheckingConflicts(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, formData.vehiculeId, formData.dateDebut, formData.dateFin, isEditing, reservation?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  useEffect(() => {
    if (!isOpen || !formData.vehiculeId || !formData.conducteurId) {
      setEligibilite(null);
      return;
    }

    let cancelled = false;
    setCheckingEligibilite(true);

    vehiculeConducteurService
      .verifierEligibilite(formData.conducteurId, formData.vehiculeId)
      .then((res) => { if (!cancelled) setEligibilite(res); })
      .catch((err) => {
        console.error('Erreur contrôle éligibilité conducteur/véhicule :', err);
        if (!cancelled) setEligibilite(null);
      })
      .finally(() => { if (!cancelled) setCheckingEligibilite(false); });

    return () => { cancelled = true; };
  }, [isOpen, formData.vehiculeId, formData.conducteurId]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.vehiculeId) {
      setError('Le véhicule est obligatoire.');
      setActiveSection('vehicule');
      return;
    }
    if (!formData.dateDebut) {
      setError('La date de début est obligatoire.');
      setActiveSection('periode');
      return;
    }
    if (formData.dateFin && formData.dateFin < formData.dateDebut) {
      setError('La date de fin ne peut pas être antérieure à la date de début.');
      setActiveSection('periode');
      return;
    }
    if (!formData.personnelId) {
      setError('Le personnel demandeur est obligatoire.');
      setActiveSection('equipe');
      return;
    }
    if (eligibilite && !eligibilite.eligible) {
      setError(eligibilite.motif || "Ce conducteur n'est pas habilité pour ce véhicule (catégorie de permis incompatible).");
      setActiveSection('equipe');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(formData.personnelId));
      const personnelNomComplet = personnel ? `${personnel.nom} ${personnel.prenom}` : null;
      const payload = {
        vehiculeId: Number(formData.vehiculeId),
        personnelId: Number(formData.personnelId),
        personnelNom: personnelNomComplet,
        dateDebut: formData.dateDebut || null,
        dateFin: formData.dateFin || null,
        conducteurId: formData.conducteurId === '' ? null : Number(formData.conducteurId),
        sourceId: formData.sourceId === '' ? null : Number(formData.sourceId),
        destinationId: formData.destinationId === '' ? null : Number(formData.destinationId),
        motif: formData.motif.trim() || null,
        projetId: formData.projetId === '' ? null : Number(formData.projetId),
        etat: Number(formData.etat),
        personnelCreationId: Number(formData.personnelId),
        personnelCreationNom: personnelNomComplet,
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
  const personnelLabel = personnels.find((p) => String(p.id) === String(formData.personnelId));
  const conducteurLabel = personnels.find((p) => String(p.id) === String(formData.conducteurId));
  const sourceLabel = emplacements.find((e) => String(e.id) === String(formData.sourceId));
  const destinationLabel = emplacements.find((e) => String(e.id) === String(formData.destinationId));
  const projetLabel_ = projets.find((p) => String(p.id) === String(formData.projetId));
  const duree = durationLabel(formData.dateDebut, formData.dateFin);
  const etatMeta = ETAT_OPTIONS.find((o) => o.value === Number(formData.etat)) ?? ETAT_OPTIONS[0];

  const vehiculesFiltres = useMemo(() => {
    if (!vehiculeSearch.trim()) return vehicules.slice(0, 8);
    const q = vehiculeSearch.toLowerCase();
    return vehicules.filter((v) => {
      const txt = `${v.matricule || ''} ${v.marque || ''} ${v.modele || ''}`.toLowerCase();
      return txt.includes(q);
    }).slice(0, 8);
  }, [vehicules, vehiculeSearch]);

  const sectionCounts = {
    vehicule: formData.vehiculeId ? 1 : 0,
    periode: [formData.dateDebut, formData.dateFin].filter(Boolean).length,
    equipe: [formData.personnelId, formData.conducteurId].filter(Boolean).length,
    trajet: [formData.sourceId, formData.destinationId, formData.motif].filter(Boolean).length,
    projet: [formData.projetId, formData.commentaire].filter(Boolean).length,
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeSection) {
      case 'vehicule':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Choisir un véhicule</h3>
              <p>Sélectionne le véhicule à réserver</p>
            </div>

            <div className="vrm-search">
              <Search size={16} strokeWidth={2.3} className="vrm-search-icon" />
              <input
                type="text"
                placeholder="Rechercher par matricule, marque..."
                value={vehiculeSearch}
                onChange={(e) => setVehiculeSearch(e.target.value)}
              />
            </div>

            {loadingVehicules ? (
              <div className="vrm-vehicules-loading">
                <Loader2 size={20} className="vrm-spin" />
                <span>Chargement des véhicules...</span>
              </div>
            ) : vehiculesFiltres.length === 0 ? (
              <div className="vrm-vehicules-empty">
                <Car size={24} strokeWidth={1.6} />
                <span>Aucun véhicule trouvé</span>
              </div>
            ) : (
              <div className="vrm-vehicules-grid">
                {vehiculesFiltres.map((v) => {
                  const isSelected = String(formData.vehiculeId) === String(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`vrm-vehicule-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, vehiculeId: v.id }))}
                    >
                      <div className="vrm-vehicule-icon">
                        <Car size={18} strokeWidth={2.2} />
                      </div>
                      <div className="vrm-vehicule-text">
                        <span className="vrm-vehicule-matricule">
                          {v.matricule || `Véhicule #${v.id}`}
                        </span>
                        <span className="vrm-vehicule-marque">
                          {v.marque || '—'}{v.modele ? ` · ${v.modele}` : ''}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="vrm-vehicule-check">
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

      case 'periode':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Période de réservation</h3>
              <p>Date de départ et de retour</p>
            </div>

            <div className="vrm-timeline">
              <div className="vrm-timeline-item">
                <span className="vrm-timeline-dot start" />
                <div className="vrm-timeline-field">
                  <label>Début <span className="bmm-required">*</span></label>
                  <input
                    type="datetime-local"
                    name="dateDebut"
                    value={formData.dateDebut}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="vrm-timeline-line">
                {duree && <span className="vrm-timeline-badge">{duree}</span>}
              </div>

              <div className="vrm-timeline-item">
                <span className="vrm-timeline-dot end" />
                <div className="vrm-timeline-field">
                  <label>Fin</label>
                  <input
                    type="datetime-local"
                    name="dateFin"
                    value={formData.dateFin}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {checkingConflicts && (
              <div className="vrm-conflict-banner checking">
                <Loader2 size={15} strokeWidth={2.5} className="vrm-spin" />
                Vérification de la disponibilité du véhicule...
              </div>
            )}

            {!checkingConflicts && conflicts.length > 0 && (
              <div className="vrm-conflict-banner warning">
                <AlertTriangle size={16} strokeWidth={2.5} />
                <div>
                  <strong>
                    {conflicts.length === 1
                      ? 'Ce véhicule a déjà une réservation sur cette période :'
                      : `Ce véhicule a déjà ${conflicts.length} réservations sur cette période :`}
                  </strong>
                  <ul>
                    {conflicts.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        {formatDateFr(c.dateDebut)} → {formatDateFr(c.dateFin)}
                        {' '}({ETAT_OPTIONS.find((o) => o.value === c.etat)?.label ?? c.etat})
                        {c.personnelNom ? ` — ${c.personnelNom}` : ''}
                      </li>
                    ))}
                  </ul>
                  <span className="vrm-conflict-hint">
                    Vous pouvez tout de même essayer d'enregistrer, mais le serveur refusera
                    si le conflit persiste.
                  </span>
                </div>
              </div>
            )}
          </div>
        );

      case 'equipe':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Conducteur &amp; demandeur</h3>
              <p>Qui demande et qui conduit ?</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label>Personnel demandeur</label>
                <SearchableSelect
                  id="vrm-personnel"
                  name="personnelId"
                  value={formData.personnelId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un demandeur..."
                  emptyMessage="Aucun personnel ne correspond"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Conducteur</label>
                <SearchableSelect
                  id="vrm-conducteur"
                  name="conducteurId"
                  value={formData.conducteurId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingPersonnels}
                  placeholder="Rechercher un conducteur..."
                  emptyMessage="Aucun conducteur ne correspond"
                  allowEmpty
                  emptyOptionLabel="— Aucun conducteur —"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
              </div>
            </div>

            {formData.vehiculeId && formData.conducteurId && (
              <div className={`bmm-info vrm-eligibilite ${
                checkingEligibilite ? 'checking' : eligibilite?.eligible ? 'ok' : eligibilite ? 'ko' : ''
              }`}>
                {checkingEligibilite ? (
                  <>
                    <Loader2 size={16} strokeWidth={2.5} className="vrm-spin" />
                    <span>Vérification du permis du conducteur...</span>
                  </>
                ) : eligibilite?.eligible ? (
                  <>
                    <ShieldCheck size={16} strokeWidth={2.5} />
                    <span>{eligibilite.motif || 'Conducteur habilité pour ce véhicule.'}</span>
                  </>
                ) : eligibilite ? (
                  <>
                    <ShieldAlert size={16} strokeWidth={2.5} />
                    <span>
                      {eligibilite.motif || "Ce conducteur n'est pas habilité pour ce véhicule."}
                      {eligibilite.categoriesRequises?.length > 0 && (
                        <> Catégorie requise : {eligibilite.categoriesRequises.join(' ou ')}.</>
                      )}
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        );

      case 'trajet':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Trajet &amp; motif</h3>
              <p>D'où vient-on et où va-t-on ?</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label>Emplacement source</label>
                <select
                  name="sourceId"
                  value={formData.sourceId}
                  onChange={handleChange}
                  disabled={loadingEmplacements}
                >
                  <option value="">
                    {loadingEmplacements ? 'Chargement...' : '— Sélectionner —'}
                  </option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {emplacementLabel(e)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label>Emplacement destination</label>
                <select
                  name="destinationId"
                  value={formData.destinationId}
                  onChange={handleChange}
                  disabled={loadingEmplacements}
                >
                  <option value="">
                    {loadingEmplacements ? 'Chargement...' : '— Sélectionner —'}
                  </option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {emplacementLabel(e)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Motif</label>
                <input
                  type="text"
                  name="motif"
                  value={formData.motif}
                  onChange={handleChange}
                  placeholder="Ex : Transport de matériel médical"
                />
              </div>
            </div>
          </div>
        );

      case 'projet':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Projet &amp; statut</h3>
              <p>Rattachement et état de la réservation</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label>Projet</label>
                <select
                  name="projetId"
                  value={formData.projetId}
                  onChange={handleChange}
                  disabled={loadingProjets}
                >
                  <option value="">
                    {loadingProjets ? 'Chargement...' : '— Aucun projet —'}
                  </option>
                  {projets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {projetLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>État de la réservation</label>
                <div className="vrm-etat-chips">
                  {ETAT_OPTIONS.map((o) => {
                    const isActive = Number(formData.etat) === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        className={`vrm-etat-chip chip-${o.color} ${isActive ? 'active' : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, etat: o.value }))}
                      >
                        {isActive && <Check size={12} strokeWidth={3} />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Commentaire</label>
                <textarea
                  name="commentaire"
                  value={formData.commentaire}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Notes internes, contexte particulier..."
                />
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
      <div className="bmm-modal bmm-modal--xl" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Calendar size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Nouvelle réservation'}
              </span>
              <h2>Réserver un véhicule</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className={`bmm-etat-chip chip-${etatMeta.color}`}>
              <span className="bmm-chip-dot" />
              {etatMeta.label}
            </span>
            <button type="button" className="bmm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT : NAV + CONTENU + APERÇU */}
        <form className="bmm-layout bmm-layout--with-preview" onSubmit={handleSubmit}>

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

          {/* APERÇU */}
          <aside className="vrm-preview-wrap">
            <div className="vrm-preview">
              <div className="vrm-preview-head">
                <Sparkles size={16} strokeWidth={2.2} />
                <span>Aperçu</span>
              </div>

              <div className="vrm-preview-card">
                <div className="vrm-preview-label">Véhicule</div>
                <div className="vrm-preview-vehicule">
                  <div className="vrm-preview-vehicule-icon">
                    <Car size={18} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="vrm-preview-vehicule-matricule">
                      {vehiculeLabel?.matricule || 'Non sélectionné'}
                    </div>
                    {vehiculeLabel && (
                      <div className="vrm-preview-vehicule-marque">
                        {vehiculeLabel.marque}
                        {vehiculeLabel.modele ? ` · ${vehiculeLabel.modele}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="vrm-preview-card">
                <div className="vrm-preview-label">Période</div>
                <div className="vrm-preview-timeline">
                  <div className="vrm-preview-time">
                    <span className="vrm-preview-time-dot start" />
                    <div>
                      <div className="vrm-preview-time-label">Début</div>
                      <div className="vrm-preview-time-value">
                        {formatDateFr(formData.dateDebut)}
                      </div>
                    </div>
                  </div>

                  <div className="vrm-preview-bar">
                    <div className="vrm-preview-bar-fill" />
                    {duree && <span className="vrm-preview-duration">{duree}</span>}
                  </div>

                  <div className="vrm-preview-time">
                    <span className="vrm-preview-time-dot end" />
                    <div>
                      <div className="vrm-preview-time-label">Fin</div>
                      <div className="vrm-preview-time-value">
                        {formatDateFr(formData.dateFin)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(personnelLabel || conducteurLabel) && (
                <div className="vrm-preview-card">
                  <div className="vrm-preview-label">Personnes</div>
                  {personnelLabel && (
                    <div className="vrm-preview-person">
                      <User size={14} strokeWidth={2.3} />
                      <div>
                        <div className="vrm-preview-person-role">Demandeur</div>
                        <div className="vrm-preview-person-name">
                          {personnelLabel.nom} {personnelLabel.prenom}
                        </div>
                      </div>
                    </div>
                  )}
                  {conducteurLabel && (
                    <div className="vrm-preview-person">
                      <Shield size={14} strokeWidth={2.3} />
                      <div>
                        <div className="vrm-preview-person-role">Conducteur</div>
                        <div className="vrm-preview-person-name">
                          {conducteurLabel.nom} {conducteurLabel.prenom}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="vrm-preview-card">
                <div className="vrm-preview-label">Statut</div>
                <div className={`vrm-preview-etat chip-${etatMeta.color}`}>
                  <span className="bmm-chip-dot" />
                  {etatMeta.label}
                </div>
              </div>

              <div className="vrm-preview-summary">
                <div className="vrm-preview-summary-row">
                  <span>Motif</span>
                  <span>{formData.motif || '—'}</span>
                </div>
                <div className="vrm-preview-summary-row">
                  <span>Trajet</span>
                  <span>
                    {sourceLabel ? emplacementLabel(sourceLabel) : '—'}
                    <ChevronRight size={12} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} />
                    {destinationLabel ? emplacementLabel(destinationLabel) : '—'}
                  </span>
                </div>
                <div className="vrm-preview-summary-row">
                  <span>Projet</span>
                  <span>{projetLabel_ ? projetLabel(projetLabel_) : '—'}</span>
                </div>
              </div>
            </div>
          </aside>
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
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || checkingEligibilite || (eligibilite && !eligibilite.eligible)}
            >
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="vrm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Créer la réservation'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculeReservationModal;