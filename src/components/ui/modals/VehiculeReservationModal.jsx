import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Button from '../Button';
import { commePage, obtenirEmplacements, obtenirVehicules } from '../../../store/referentiels';
import personnelService from '../../../services/personnelService';
import projetService from '../../../services/projetService';
import vehiculeReservationService from '../../../services/vehiculeReservationService';
import vehiculeConducteurService from '../../../services/vehiculeConducteurService';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import vehiculeBonCarburantService from '../../../services/vehiculeBonCarburantService';
import { CARBURANT_TYPE_OPTIONS, carburantTypeLabel } from '../../../constants/carburantType';
import {
  X, Car, User, Calendar, MapPin, Flag, Check, Loader2,
  AlertTriangle, Save, Search, Clock, Route, FileText,
  ChevronRight, ChevronDown, Sparkles, Shield, ShieldCheck, ShieldAlert,
  Fuel, Plus, Trash2,
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
  { id: 'carburant', label: 'Carburant',     Icon: Fuel },
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
  return d.toLocaleString(locale(), {
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
  if (hours < 24) return t('{n} h', { n: hours.toFixed(1) });
  const days = hours / 24;
  return t('{n} j', { n: days.toFixed(1) });
}

function emplacementLabel(e) {
  if (!e) return null;
  return e.nom || e.adresse || t('Emplacement #{id}', { id: e.id });
}

function projetLabel(p) {
  if (!p) return null;
  if (p.code && p.nom) return `${p.code} — ${p.nom}`;
  return p.nom || p.code || t('Projet #{id}', { id: p.id });
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
          placeholder={loading ? t('Chargement...') : (selected ? '' : t(placeholder))}
          disabled={disabled || loading}
          autoComplete="off"
        />

        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="vrm-searchable-clear-inline"
            onClick={handleClear}
            aria-label={t('Effacer')}
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
                  <span className="vrm-searchable-option-label">{t(emptyOptionLabel)}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="vrm-searchable-empty">{t(emptyMessage)}</div>
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

  // Bons de carburant de la réservation : déjà enregistrés (modification) ou à créer avec la réservation
  const [bonsReservation, setBonsReservation] = useState([]);
  const [bonsAAjouter, setBonsAAjouter] = useState([]);
  // Saisie d'un plein directement dans l'onglet « Carburant » (pas de seconde fenêtre)
  const BON_VIDE = { date: '', montant: '', litres: '', kilometrage: '', typeCarburant: '', station: '' };
  const [formBon, setFormBon] = useState(BON_VIDE);
  const [saisieBonOuverte, setSaisieBonOuverte] = useState(false);
  const [erreurBon, setErreurBon] = useState(null);
  const [enregistrementBon, setEnregistrementBon] = useState(false);

  const maintenantLocal = () => {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  };

  const ouvrirSaisieBon = () => {
    setFormBon({ ...BON_VIDE, date: maintenantLocal() });
    setErreurBon(null);
    setSaisieBonOuverte(true);
  };

  const changerBon = (e) => {
    const { name, value } = e.target;
    setFormBon((f) => ({ ...f, [name]: value }));
    setErreurBon(null);
  };

  const ajouterBon = async () => {
    if (!formBon.date) { setErreurBon(t('La date du plein est obligatoire.')); return; }
    if (formBon.montant === '' || Number(formBon.montant) <= 0) { setErreurBon(t('Le montant est obligatoire.')); return; }
    const bon = {
      vehiculeId: Number(formData.vehiculeId),
      personnelId: formData.conducteurId ? Number(formData.conducteurId) : (formData.personnelId ? Number(formData.personnelId) : null),
      date: formBon.date,
      montant: Number(formBon.montant),
      litres: formBon.litres === '' ? null : Number(formBon.litres),
      kilometrage: formBon.kilometrage === '' ? null : Number(formBon.kilometrage),
      typeCarburant: formBon.typeCarburant === '' ? null : Number(formBon.typeCarburant),
      station: formBon.station.trim() || null,
    };
    setEnregistrementBon(true);
    try {
      if (isEditing && reservation?.id) {
        await vehiculeBonCarburantService.create({ ...bon, reservationId: reservation.id });
        await chargerBonsReservation();
      } else {
        // Réservation pas encore créée : le bon sera enregistré avec elle
        setBonsAAjouter((l) => [...l, bon]);
      }
      setSaisieBonOuverte(false);
      setFormBon(BON_VIDE);
    } catch (err) {
      console.error('Erreur ajout bon de carburant :', err);
      setErreurBon(err?.response?.data?.message || t("Le bon n'a pas pu être enregistré."));
    } finally {
      setEnregistrementBon(false);
    }
  };

  const chargerBonsReservation = useCallback(async () => {
    if (!reservation?.id) { setBonsReservation([]); return; }
    try {
      setBonsReservation(await vehiculeBonCarburantService.getByReservation(reservation.id));
    } catch (err) {
      console.error('Erreur chargement des bons de carburant :', err);
      setBonsReservation([]);
    }
  }, [reservation?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setBonsAAjouter([]);
    setSaisieBonOuverte(false);
    if (isEditing) chargerBonsReservation(); else setBonsReservation([]);
  }, [isOpen, isEditing, chargerBonsReservation]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchVehicules = async () => {
      setLoadingVehicules(true);
      try {
        const page = await obtenirVehicules().then(commePage);
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
        const page = await obtenirEmplacements().then(commePage);
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
      setCheckingEligibilite(false); // un contrôle interrompu ne doit pas bloquer le bouton
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
      setError(t('Le véhicule est obligatoire.'));
      setActiveSection('vehicule');
      return;
    }
    if (!formData.dateDebut) {
      setError(t('La date de début est obligatoire.'));
      setActiveSection('periode');
      return;
    }
    if (formData.dateFin && formData.dateFin < formData.dateDebut) {
      setError(t('La date de fin ne peut pas être antérieure à la date de début.'));
      setActiveSection('periode');
      return;
    }
    if (!formData.personnelId) {
      setError(t('Le personnel demandeur est obligatoire.'));
      setActiveSection('equipe');
      return;
    }
    if (eligibilite && !eligibilite.eligible) {
      setError(eligibilite.motif || t("Ce conducteur n'est pas habilité pour ce véhicule (catégorie de permis incompatible)."));
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
      const enregistree = await onSave(payload);

      // Bons de carburant ajoutés pendant la création : liés à la réservation maintenant qu'elle existe
      const reservationId = enregistree?.id ?? reservation?.id ?? null;
      if (bonsAAjouter.length > 0) {
        if (reservationId == null) {
          setError(t("La réservation est enregistrée, mais ses bons de carburant n'ont pas pu y être liés. Ajoutez-les depuis la réservation."));
          return;
        }
        const echecs = [];
        for (const bon of bonsAAjouter) {
          try {
            await vehiculeBonCarburantService.create({ ...bon, reservationId });
          } catch (err) {
            console.error('Erreur création bon de carburant :', err);
            echecs.push(bon);
          }
        }
        if (echecs.length > 0) {
          setBonsAAjouter(echecs);
          setError(t("La réservation est enregistrée, mais {n} bon(s) de carburant n'ont pas pu être créés.", { n: echecs.length }));
          return;
        }
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t("Échec de l'enregistrement."));
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
    carburant: bonsReservation.length + bonsAAjouter.length,
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeSection) {
      case 'vehicule':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Choisir un véhicule')}</h3>
              <p>{t('Sélectionne le véhicule à réserver')}</p>
            </div>

            <div className="vrm-search">
              <Search size={16} strokeWidth={2.3} className="vrm-search-icon" />
              <input
                type="text"
                placeholder={t('Rechercher par matricule, marque...')}
                value={vehiculeSearch}
                onChange={(e) => setVehiculeSearch(e.target.value)}
              />
            </div>

            {loadingVehicules ? (
              <div className="vrm-vehicules-loading">
                <Loader2 size={20} className="vrm-spin" />
                <span>{t('Chargement des véhicules...')}</span>
              </div>
            ) : vehiculesFiltres.length === 0 ? (
              <div className="vrm-vehicules-empty">
                <Car size={24} strokeWidth={1.6} />
                <span>{t('Aucun véhicule trouvé')}</span>
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
                          {v.matricule || t('Véhicule #{id}', { id: v.id })}
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
              <h3>{t('Période de réservation')}</h3>
              <p>{t('Date de départ et de retour')}</p>
            </div>

            <div className="vrm-timeline">
              <div className="vrm-timeline-item">
                <span className="vrm-timeline-dot start" />
                <div className="vrm-timeline-field">
                  <label>{t('Début')} <span className="bmm-required">*</span></label>
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
                  <label>{t('Fin')}</label>
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
                {t('Vérification de la disponibilité du véhicule...')}
              </div>
            )}

            {!checkingConflicts && conflicts.length > 0 && (
              <div className="vrm-conflict-banner warning">
                <AlertTriangle size={16} strokeWidth={2.5} />
                <div>
                  <strong>
                    {conflicts.length === 1
                      ? t('Ce véhicule a déjà une réservation sur cette période :')
                      : t('Ce véhicule a déjà {n} réservations sur cette période :', { n: conflicts.length })}
                  </strong>
                  <ul>
                    {conflicts.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        {formatDateFr(c.dateDebut)} → {formatDateFr(c.dateFin)}
                        {' '}({t(ETAT_OPTIONS.find((o) => o.value === c.etat)?.label) ?? c.etat})
                        {c.personnelNom ? ` — ${c.personnelNom}` : ''}
                      </li>
                    ))}
                  </ul>
                  <span className="vrm-conflict-hint">
                    {t("Vous pouvez tout de même essayer d'enregistrer, mais le serveur refusera si le conflit persiste.")}
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
              <h3>{t('Conducteur & demandeur')}</h3>
              <p>{t('Qui demande et qui conduit ?')}</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label>{t('Personnel demandeur')}</label>
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
                  getOptionHint={(p) => (p.matricule ? t('Matricule : {m}', { m: p.matricule }) : null)}
                />
              </div>

              <div className="bmm-field bmm-field--full">
                <label>{t('Conducteur')}</label>
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
                  getOptionHint={(p) => (p.matricule ? t('Matricule : {m}', { m: p.matricule }) : null)}
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
                    <span>{t('Vérification du permis du conducteur...')}</span>
                  </>
                ) : eligibilite?.eligible ? (
                  <>
                    <ShieldCheck size={16} strokeWidth={2.5} />
                    <span>{eligibilite.motif || t('Conducteur habilité pour ce véhicule.')}</span>
                  </>
                ) : eligibilite ? (
                  <>
                    <ShieldAlert size={16} strokeWidth={2.5} />
                    <span>
                      {eligibilite.motif || t("Ce conducteur n'est pas habilité pour ce véhicule.")}
                      {eligibilite.categoriesRequises?.length > 0 && (
                        <> {t('Catégorie requise : {c}.', { c: eligibilite.categoriesRequises.join(t(' ou ')) })}</>
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
              <h3>{t('Trajet & motif')}</h3>
              <p>{t("D'où vient-on et où va-t-on ?")}</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label>{t('Emplacement source')}</label>
                <select
                  name="sourceId"
                  value={formData.sourceId}
                  onChange={handleChange}
                  disabled={loadingEmplacements}
                >
                  <option value="">
                    {loadingEmplacements ? t('Chargement...') : t('— Sélectionner —')}
                  </option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {emplacementLabel(e)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label>{t('Emplacement destination')}</label>
                <select
                  name="destinationId"
                  value={formData.destinationId}
                  onChange={handleChange}
                  disabled={loadingEmplacements}
                >
                  <option value="">
                    {loadingEmplacements ? t('Chargement...') : t('— Sélectionner —')}
                  </option>
                  {emplacements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {emplacementLabel(e)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>{t('Motif')}</label>
                <input
                  type="text"
                  name="motif"
                  value={formData.motif}
                  onChange={handleChange}
                  placeholder={t('Ex : Transport de matériel médical')}
                />
              </div>
            </div>
          </div>
        );

      case 'projet':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Projet & statut')}</h3>
              <p>{t('Rattachement et état de la réservation')}</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label>{t('Projet')}</label>
                <select
                  name="projetId"
                  value={formData.projetId}
                  onChange={handleChange}
                  disabled={loadingProjets}
                >
                  <option value="">
                    {loadingProjets ? t('Chargement...') : t('— Aucun projet —')}
                  </option>
                  {projets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {projetLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>{t('État de la réservation')}</label>
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
                        {t(o.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bmm-field bmm-field--full">
                <label>{t('Commentaire')}</label>
                <textarea
                  name="commentaire"
                  value={formData.commentaire}
                  onChange={handleChange}
                  rows={3}
                  placeholder={t('Notes internes, contexte particulier...')}
                />
              </div>
            </div>
          </div>
        );

      case 'carburant': {
        const tousBons = [...bonsReservation.map((b) => ({ ...b, enAttente: false })), ...bonsAAjouter.map((b, i) => ({ ...b, enAttente: true, index: i }))];
        const totalMontant = tousBons.reduce((s, b) => s + (Number(b.montant) || 0), 0);
        const totalLitres = tousBons.reduce((s, b) => s + (Number(b.litres) || 0), 0);
        const formatDate = (v) => (v ? new Date(v).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Carburant')}</h3>
              <p>{t('Pleins faits pendant cette réservation')}</p>
            </div>

            {/* Résumé */}
            <div className="vmb-resume">
              <div className="vmb-stat">
                <span className="vmb-stat-label">{t('Pleins')}</span>
                <strong>{tousBons.length}</strong>
              </div>
              <div className="vmb-stat">
                <span className="vmb-stat-label">{t('Litres')}</span>
                <strong>{totalLitres ? totalLitres.toLocaleString(locale()) : '—'}</strong>
              </div>
              <div className="vmb-stat vmb-stat--montant">
                <span className="vmb-stat-label">{t('Total')}</span>
                <strong>{totalMontant.toFixed(2)} <small>{t('DT')}</small></strong>
              </div>
            </div>

            {/* Liste des pleins */}
            {tousBons.length === 0 && !saisieBonOuverte ? (
              <div className="vmb-vide">
                <span className="vmb-vide-icone"><Fuel size={22} /></span>
                <p>{t('Aucun plein pour cette réservation.')}</p>
              </div>
            ) : (
              <ul className="vmb-liste">
                {tousBons.map((b) => (
                  <li key={b.enAttente ? 'a-' + b.index : 'e-' + b.id} className={'vmb-ligne' + (b.enAttente ? ' vmb-ligne--attente' : '')}>
                    <span className="vmb-icone"><Fuel size={16} /></span>
                    <div className="vmb-texte">
                      <strong>{formatDate(b.date)}{b.station ? ' · ' + b.station : ''}</strong>
                      <span className="vmb-puces">
                        {b.litres != null && <span className="vmb-puce">{b.litres} {t('L')}</span>}
                        {b.kilometrage != null && <span className="vmb-puce">{Number(b.kilometrage).toLocaleString(locale())} {t('km')}</span>}
                        {b.typeCarburant != null && <span className="vmb-puce">{t(carburantTypeLabel(b.typeCarburant))}</span>}
                        {b.enAttente && <span className="vmb-puce vmb-puce--attente">{t('Enregistré avec la réservation')}</span>}
                      </span>
                    </div>
                    <span className="vmb-montant">{b.montant != null ? Number(b.montant).toFixed(2) + ' ' + t('DT') : '—'}</span>
                    {b.enAttente && (
                      <button
                        type="button"
                        className="vmb-retirer"
                        onClick={() => setBonsAAjouter((l) => l.filter((_, i) => i !== b.index))}
                        aria-label={t('Retirer ce plein')}
                        title={t('Retirer ce plein')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Saisie d'un plein, directement ici */}
            {saisieBonOuverte ? (
              <div className="vmb-saisie">
                <div className="vmb-saisie-entete">
                  <Fuel size={16} />
                  <strong>{t('Nouveau plein')}</strong>
                </div>
                <div className="vmb-saisie-grille">
                  <label className="vmb-champ vmb-champ--large">
                    <span>{t('Date')} <em>*</em></span>
                    <input type="datetime-local" name="date" value={formBon.date} onChange={changerBon} />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Montant (DT)')} <em>*</em></span>
                    <input type="number" name="montant" min="0" step="0.01" value={formBon.montant} onChange={changerBon} placeholder="0.00" />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Litres')}</span>
                    <input type="number" name="litres" min="0" step="0.01" value={formBon.litres} onChange={changerBon} placeholder="0" />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Kilométrage')}</span>
                    <input type="number" name="kilometrage" min="0" value={formBon.kilometrage} onChange={changerBon} placeholder={t('km')} />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Carburant')}</span>
                    <select name="typeCarburant" value={formBon.typeCarburant} onChange={changerBon}>
                      <option value="">—</option>
                      {CARBURANT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
                    </select>
                  </label>
                  <label className="vmb-champ vmb-champ--large">
                    <span>{t('Station')}</span>
                    <input type="text" name="station" value={formBon.station} onChange={changerBon} placeholder={t('Nom de la station')} />
                  </label>
                </div>
                {erreurBon && <p className="vmb-erreur"><AlertTriangle size={14} /> {erreurBon}</p>}
                <div className="vmb-saisie-actions">
                  <button type="button" className="vmb-btn vmb-btn--clair" onClick={() => setSaisieBonOuverte(false)} disabled={enregistrementBon}>
                    {t('Annuler')}
                  </button>
                  <button type="button" className="vmb-btn vmb-btn--plein" onClick={ajouterBon} disabled={enregistrementBon}>
                    {enregistrementBon ? <Loader2 size={15} className="vmb-tourne" /> : <Check size={15} />}
                    {isEditing ? t('Enregistrer le plein') : t('Ajouter le plein')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="vmb-ajouter"
                onClick={ouvrirSaisieBon}
                disabled={!formData.vehiculeId}
              >
                <Plus size={16} /> {t('Ajouter un plein')}
              </button>
            )}
            {!formData.vehiculeId && <p className="bmm-hint">{t('Choisissez d’abord le véhicule de la réservation (onglet Véhicule).')}</p>}
          </div>
        );
      }

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
                {isEditing ? t('Modification') : t('Nouvelle réservation')}
              </span>
              <h2>{t('Réserver un véhicule')}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className={`bmm-etat-chip chip-${etatMeta.color}`}>
              <span className="bmm-chip-dot" />
              {t(etatMeta.label)}
            </span>
            <button type="button" className="bmm-close-btn" onClick={onClose} aria-label={t('Fermer')}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT : NAV + CONTENU */}
        <form className="bmm-layout bmm-layout--with-preview vrm-layout--sans-apercu" onSubmit={handleSubmit}>

          {/* NAVIGATION LATÉRALE */}
          <aside className="bmm-nav">
            <div className="bmm-nav-title">{t('Sections')}</div>
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
                    <span className="bmm-nav-item-label">{t(s.label)}</span>
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
              {t('Annuler')}
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
                  {t('Enregistrement...')}
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? t('Mettre à jour') : t('Créer la réservation')}
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