import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import personnelService from '../../../services/personnelService';
import vehiculeMissionService from '../../../services/vehiculeMissionService';
import vehiculeConducteurService from '../../../services/vehiculeConducteurService';
import emplacementService from '../../../services/emplacementService';
import vehiculeBonCarburantService from '../../../services/vehiculeBonCarburantService';
import { CARBURANT_TYPE_OPTIONS, carburantTypeLabel } from '../../../constants/carburantType';
import { etatVehiculeLabel, isVehiculeDisponiblePourMission } from '../../../constants/Vehiculeetat';
import { t, locale } from '../../../i18n';
import vehiculeAmendeService from '../../../services/vehiculeAmendeService';
import authService from '../../../services/Authservice';
import { TYPES_INFRACTION, STATUTS as STATUTS_AMENDE, ltr } from '../../../constants/Amendelibelles';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Route,
  X,
  Car,
  Map as MapIcon,
  Gauge,
  FileText,
  Search,
  MapPin,
  ArrowRight,
  Hash,
  AlertTriangle,
  CheckCircle2,
  Save,
  Loader2,
  ClipboardList,
  User,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Check,
  Fuel,
  Plus,
  Trash2,
  Receipt,
} from 'lucide-react';
import './Modal.css';
import './VehiculeMissionModal.css';

// ─── Fix icônes Leaflet ───
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [36.8065, 10.1815];

const NOMINATIM_HEADERS = {
  'Accept-Language': 'fr',
  'User-Agent': 'MonAppVehicules/1.0',
};

const emptyForm = {
  num: '',
  vehiculeId: '',
  conducteurId: '',
  dateDepart: '',
  dateRetour: '',
  sourceId: '',
  destinationId: '',
  localisation: '',
  latitude: null,
  longitude: null,
  distanceEstimee: '',
  objet: '',
  kilometrageDepart: '',
  kilometrageRetour: '',
  etat: 0,
  observations: '',
};

const ETAT_OPTIONS = [
  { value: 0, label: 'Planifiée' },
  { value: 1, label: 'En cours' },
  { value: 2, label: 'Terminée' },
  { value: 3, label: 'Annulée' },
];

// ─── Sections de navigation (remplace les steps) ───
const NAV_SECTIONS = [
  { id: 'general', label: 'Général', Icon: ClipboardList },
  { id: 'vehicule', label: 'Véhicule', Icon: Car },
  { id: 'trajet', label: 'Trajet', Icon: MapIcon },
  { id: 'kilometrage', label: 'Kilométrage', Icon: Gauge },
  { id: 'carburant', label: 'Carburant', Icon: Fuel },
  { id: 'amendes', label: 'Amendes', Icon: Receipt },
  { id: 'notes', label: 'Notes', Icon: FileText },
];

// ─── Leaflet ───
function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

// ─── Utils ───
function toDateTimeInput(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toNumOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
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
  isOptionDisabled = () => false,
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
    if (isOptionDisabled(opt)) return;
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
          placeholder={loading ? t('Chargement...') : (selected ? '' : t(placeholder))}
          disabled={disabled || loading}
          autoComplete="off"
        />

        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="bmm-searchable-clear-inline"
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
          className={`bmm-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmm-searchable-menu">
          <div className="bmm-searchable-options">
            {filtered.length === 0 ? (
              <div className="bmm-searchable-empty">{t(emptyMessage)}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const optDisabled = isOptionDisabled(o);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmm-searchable-option ${isSelected ? 'is-selected' : ''} ${optDisabled ? 'is-disabled' : ''}`}
                    onClick={() => handleSelect(o)}
                    disabled={optDisabled}
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

const VehiculeMissionModal = ({ isOpen, onClose, onSave, vehiculeMission, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [formData, setFormData] = useState(emptyForm);
  const [loadingNumero, setLoadingNumero] = useState(false);

  const [activeSection, setActiveSection] = useState('general');

  // Bons de carburant de la mission : déjà enregistrés (modification) ou à créer avec la mission
  const [bonsMission, setBonsMission] = useState([]);
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
      personnelId: formData.conducteurId ? Number(formData.conducteurId) : null,
      date: formBon.date,
      montant: Number(formBon.montant),
      litres: formBon.litres === '' ? null : Number(formBon.litres),
      kilometrage: formBon.kilometrage === '' ? null : Number(formBon.kilometrage),
      typeCarburant: formBon.typeCarburant === '' ? null : Number(formBon.typeCarburant),
      station: formBon.station.trim() || null,
    };
    setEnregistrementBon(true);
    try {
      if (isEditing && vehiculeMission?.id) {
        await vehiculeBonCarburantService.create({ ...bon, missionId: vehiculeMission.id });
        await chargerBonsMission();
      } else {
        // Mission pas encore créée : le bon sera enregistré avec elle
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

  const chargerBonsMission = useCallback(async () => {
    if (!vehiculeMission?.id) { setBonsMission([]); return; }
    try {
      setBonsMission(await vehiculeBonCarburantService.getByMission(vehiculeMission.id));
    } catch (err) {
      console.error('Erreur chargement des bons de carburant :', err);
      setBonsMission([]);
    }
  }, [vehiculeMission?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setBonsAAjouter([]);
    setSaisieBonOuverte(false);
    if (isEditing) chargerBonsMission(); else setBonsMission([]);
  }, [isOpen, isEditing, chargerBonsMission]);

  // Amendes reçues pendant la mission : déjà enregistrées (modification) ou à créer avec la mission
  const [amendesMission, setAmendesMission] = useState([]);
  const [amendesAAjouter, setAmendesAAjouter] = useState([]);
  const AMENDE_VIDE = { dateInfraction: '', type: '', montant: '', lieu: '', referencePv: '', dateLimitePaiement: '' };
  const [formAmende, setFormAmende] = useState(AMENDE_VIDE);
  const [saisieAmendeOuverte, setSaisieAmendeOuverte] = useState(false);
  const [erreurAmende, setErreurAmende] = useState(null);
  const [enregistrementAmende, setEnregistrementAmende] = useState(false);

  const ouvrirSaisieAmende = () => {
    setFormAmende({ ...AMENDE_VIDE, dateInfraction: maintenantLocal() });
    setErreurAmende(null);
    setSaisieAmendeOuverte(true);
  };

  const changerAmende = (e) => {
    const { name, value } = e.target;
    setFormAmende((f) => ({ ...f, [name]: value }));
    setErreurAmende(null);
  };

  const chargerAmendesMission = useCallback(async () => {
    if (!vehiculeMission?.id) { setAmendesMission([]); return; }
    try {
      setAmendesMission(await vehiculeAmendeService.getByMission(vehiculeMission.id));
    } catch (err) {
      console.error('Erreur chargement des amendes :', err);
      setAmendesMission([]);
    }
  }, [vehiculeMission?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setAmendesAAjouter([]);
    setSaisieAmendeOuverte(false);
    if (isEditing) chargerAmendesMission(); else setAmendesMission([]);
  }, [isOpen, isEditing, chargerAmendesMission]);

  const ajouterAmende = async () => {
    if (!formAmende.dateInfraction) { setErreurAmende(t("La date de l'infraction est obligatoire.")); return; }
    if (new Date(formAmende.dateInfraction) > new Date()) { setErreurAmende(t("La date de l'infraction ne peut pas être dans le futur.")); return; }
    if (!formAmende.type) { setErreurAmende(t("Le type d'infraction est obligatoire.")); return; }
    if (formAmende.montant === '' || Number(formAmende.montant) < 0) { setErreurAmende(t('Le montant est obligatoire.')); return; }
    if (formAmende.dateLimitePaiement && formAmende.dateLimitePaiement < formAmende.dateInfraction.slice(0, 10)) {
      setErreurAmende(t("La date limite de paiement est antérieure à l'infraction.")); return;
    }
    const amende = {
      vehiculeId: Number(formData.vehiculeId),
      conducteurId: formData.conducteurId ? Number(formData.conducteurId) : null,
      origineConducteur: formData.conducteurId ? 1 : null,
      dateInfraction: formAmende.dateInfraction,
      type: Number(formAmende.type),
      montant: Number(formAmende.montant),
      lieu: formAmende.lieu.trim() || null,
      referencePv: formAmende.referencePv.trim() || null,
      dateLimitePaiement: formAmende.dateLimitePaiement || null,
      statut: 0,
    };
    setEnregistrementAmende(true);
    try {
      if (isEditing && vehiculeMission?.id) {
        const ctx = authService.getContexteMetier?.() ?? {};
        await vehiculeAmendeService.create({ ...amende, missionId: vehiculeMission.id, personnelCreationId: ctx.userId ?? null });
        await chargerAmendesMission();
      } else {
        // Mission pas encore créée : l'amende sera enregistrée avec elle
        setAmendesAAjouter((l) => [...l, amende]);
      }
      setSaisieAmendeOuverte(false);
      setFormAmende(AMENDE_VIDE);
    } catch (err) {
      console.error('Erreur ajout amende :', err);
      setErreurAmende(err?.response?.data?.message || t("L'amende n'a pas pu être enregistrée."));
    } finally {
      setEnregistrementAmende(false);
    }
  };

  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  const [emplacements, setEmplacements] = useState([]);
  const [loadingEmplacements, setLoadingEmplacements] = useState(false);

  const [searching, setSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  const [eligibilite, setEligibilite] = useState(null);
  const [checkingEligibilite, setCheckingEligibilite] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchVehicules = async () => {
      setLoadingVehicules(true);
      try {
        const response = await vehiculeService.getAll(0, 200);
        const data = response?.content ?? response?.data ?? [];
        setVehicules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erreur chargement véhicules :', err);
        setVehicules([]);
      } finally {
        setLoadingVehicules(false);
      }
    };

    const fetchPersonnels = async () => {
      setLoadingPersonnels(true);
      try {
        const response = await personnelService.getAll(0, 200);
        const data = response?.content ?? response?.data ?? [];
        setPersonnels(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erreur chargement personnel :', err);
        setPersonnels([]);
      } finally {
        setLoadingPersonnels(false);
      }
    };

    const fetchEmplacements = async () => {
      setLoadingEmplacements(true);
      try {
        const response = await emplacementService.getAll(0, 200);
        const data = response?.content ?? response?.data ?? response ?? [];
        setEmplacements(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erreur chargement emplacements :', err);
        setEmplacements([]);
      } finally {
        setLoadingEmplacements(false);
      }
    };

    fetchVehicules();
    fetchPersonnels();
    fetchEmplacements();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setInfo(null);
    setActiveSection('general');

    if (isEditing && vehiculeMission) {
      setFormData({
        num: vehiculeMission.num ?? '',
        vehiculeId: vehiculeMission.vehiculeId ?? '',
        conducteurId: vehiculeMission.conducteurId ?? vehiculeMission.personnelId ?? '',
        dateDepart: toDateTimeInput(vehiculeMission.dateDepart ?? vehiculeMission.dateDebut),
        dateRetour: toDateTimeInput(vehiculeMission.dateRetour ?? vehiculeMission.dateFin),
        sourceId: vehiculeMission.sourceId ?? '',
        destinationId: vehiculeMission.destinationId ?? '',
        localisation: vehiculeMission.localisation ?? '',
        latitude: vehiculeMission.latitude ?? null,
        longitude: vehiculeMission.longitude ?? null,
        distanceEstimee: vehiculeMission.distanceEstimee ?? '',
        objet: vehiculeMission.objet ?? vehiculeMission.description ?? '',
        kilometrageDepart: vehiculeMission.kilometrageDepart ?? vehiculeMission.kilometrage ?? '',
        kilometrageRetour: vehiculeMission.kilometrageRetour ?? '',
        etat: vehiculeMission.etat ?? 0,
        observations: vehiculeMission.observations ?? vehiculeMission.commentaire ?? '',
      });

      if (vehiculeMission.latitude != null && vehiculeMission.longitude != null) {
        setMapCenter([Number(vehiculeMission.latitude), Number(vehiculeMission.longitude)]);
      } else {
        setMapCenter(DEFAULT_CENTER);
      }
      return;
    }

    setFormData({ ...emptyForm });
    setMapCenter(DEFAULT_CENTER);

    setLoadingNumero(true);
    vehiculeMissionService
      .getProchainNumero()
      .then((num) => {
        if (num) {
          setFormData((prev) => ({ ...prev, num: String(num) }));
        }
      })
      .catch((err) => {
        console.warn('Prochain numéro indisponible :', err);
      })
      .finally(() => {
        setLoadingNumero(false);
      });
  }, [isOpen, vehiculeMission, isEditing]);

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

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: NOMINATIM_HEADERS }
      );
      if (!response.ok) throw new Error(`Nominatim ${response.status}`);
      const data = await response.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      console.warn('Reverse geocoding échoué :', err);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  const handleMapClick = useCallback(
    async (lat, lng) => {
      const address = await reverseGeocode(lat, lng);
      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        localisation: address,
      }));
      setMapCenter([lat, lng]);
      setError(null);
      setInfo(null);
    },
    [reverseGeocode]
  );

  const handleSearchAddress = async () => {
    const query = formData.localisation?.trim();
    if (!query) {
      setError(t('Saisis une adresse à rechercher.'));
      return;
    }

    setSearching(true);
    setError(null);
    setInfo(null);

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}` +
        `&format=json&limit=1&addressdetails=1&countrycodes=tn`;

      const response = await fetch(url, { headers: NOMINATIM_HEADERS });
      if (!response.ok) throw new Error(`Nominatim ${response.status}`);

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          localisation: data[0].display_name,
        }));
        setMapCenter([lat, lng]);
        setInfo(t('Adresse trouvée.'));
      } else {
        setError(t('Aucune adresse trouvée pour « {q} ».', { q: query }));
      }
    } catch (err) {
      console.error(err);
      setError(t('Recherche impossible. Clique sur la carte pour choisir un point.'));
    } finally {
      setSearching(false);
    }
  };

  const handleUseGeolocation = () => {
    if (!navigator.geolocation) {
      setError(t('Géolocalisation non supportée.'));
      return;
    }

    setInfo(t('Récupération de ta position...'));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        setFormData((prev) => ({
          ...prev,
          latitude,
          longitude,
          localisation: address,
        }));
        setMapCenter([latitude, longitude]);
        setInfo(t('Position récupérée.'));
        setError(null);
      },
      (err) => {
        console.error(err);
        setError(t('Position indisponible.'));
        setInfo(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.vehiculeId) {
      setError(t('Le véhicule est obligatoire.'));
      setActiveSection('vehicule');
      return;
    }

    if (!formData.conducteurId) {
      setError(t('Le conducteur est obligatoire.'));
      setActiveSection('vehicule');
      return;
    }

    if (!formData.dateDepart) {
      setError(t('La date de début est obligatoire.'));
      setActiveSection('trajet');
      return;
    }

    if (!formData.sourceId) {
      setError(t("L'emplacement de départ est obligatoire."));
      setActiveSection('trajet');
      return;
    }

    if (!formData.destinationId) {
      setError(t("L'emplacement de destination est obligatoire."));
      setActiveSection('trajet');
      return;
    }

    if (formData.dateRetour && formData.dateDepart > formData.dateRetour) {
      setError(t('La date de fin doit être supérieure à la date de début.'));
      setActiveSection('trajet');
      return;
    }

    if (eligibilite && !eligibilite.eligible) {
      setError(eligibilite.motif || t("Ce conducteur n'est pas habilité pour ce véhicule (catégorie de permis incompatible)."));
      setActiveSection('vehicule');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...(isEditing && vehiculeMission?.id ? { id: vehiculeMission.id } : {}),
        n: vehiculeMission?.n ?? null,
        num: formData.num?.trim() || null,
        description: formData.objet?.trim() || null,
        vehiculeId: Number(formData.vehiculeId),
        conducteurId: toNumOrNull(formData.conducteurId),
        etat: Number(formData.etat ?? 0),
        sourceId: Number(formData.sourceId),
        destinationId: Number(formData.destinationId),
        dateDebut: formData.dateDepart || null,
        dateFin: formData.dateRetour || null,
        dateDebutReel: vehiculeMission?.dateDebutReel ?? null,
        dateFinReel: vehiculeMission?.dateFinReel ?? null,
        motif: vehiculeMission?.motif ?? null,
        dateCreation: vehiculeMission?.dateCreation ?? new Date().toISOString(),
        personnelCreationId: vehiculeMission?.personnelCreationId ?? toNumOrNull(formData.conducteurId),
        personnelCreationNom: vehiculeMission?.personnelCreationNom ?? null,
        commentaire: formData.observations?.trim() || null,
        objectif: vehiculeMission?.objectif ?? null,
        kilometrage: vehiculeMission?.kilometrage ?? null,
        kilometrageDepart: vehiculeMission?.kilometrageDepart ?? null,
        kilometrageRetour: vehiculeMission?.kilometrageRetour ?? null,
        kilometrageParcouru: vehiculeMission?.kilometrageParcouru ?? null,
        projetId: vehiculeMission?.projetId ?? null,
        personnelId: toNumOrNull(formData.conducteurId),
        motifExecution: vehiculeMission?.motifExecution ?? null,
      };

      const enregistree = await onSave(payload);

      // Bons de carburant ajoutés pendant la création : liés à la mission maintenant qu'elle existe
      const missionId = enregistree?.id ?? vehiculeMission?.id ?? null;
      if (bonsAAjouter.length > 0) {
        if (missionId == null) {
          setError(t("La mission est enregistrée, mais ses bons de carburant n'ont pas pu y être liés. Ajoutez-les depuis la mission."));
          return;
        }
        const echecs = [];
        for (const bon of bonsAAjouter) {
          try {
            await vehiculeBonCarburantService.create({ ...bon, missionId });
          } catch (err) {
            console.error('Erreur création bon de carburant :', err);
            echecs.push(bon);
          }
        }
        if (echecs.length > 0) {
          setBonsAAjouter(echecs);
          setError(t("La mission est enregistrée, mais {n} bon(s) de carburant n'ont pas pu être créés.", { n: echecs.length }));
          return;
        }
      }
      // Amendes ajoutées pendant la création : liées à la mission maintenant qu'elle existe
      if (amendesAAjouter.length > 0) {
        if (missionId == null) {
          setError(t("La mission est enregistrée, mais ses amendes n'ont pas pu y être liées. Ajoutez-les depuis la mission."));
          return;
        }
        const ctxA = authService.getContexteMetier?.() ?? {};
        const echecsA = [];
        for (const amende of amendesAAjouter) {
          try {
            await vehiculeAmendeService.create({ ...amende, missionId, personnelCreationId: ctxA.userId ?? null });
          } catch (err) {
            console.error('Erreur création amende :', err);
            echecsA.push(amende);
          }
        }
        if (echecsA.length > 0) {
          setAmendesAAjouter(echecsA);
          setError(t("La mission est enregistrée, mais {n} amende(s) n'ont pas pu être créées.", { n: echecsA.length }));
          return;
        }
      }
      onClose();
    } catch (err) {
      console.error('Erreur enregistrement mission :', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          t("Échec de l'enregistrement.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const etatLabel = t(ETAT_OPTIONS.find((o) => o.value === Number(formData.etat))?.label ?? '');
  const hasMarker = formData.latitude != null && formData.longitude != null;
  const markerPos = hasMarker ? [Number(formData.latitude), Number(formData.longitude)] : null;

  const vehiculeLabel = vehicules.find((v) => String(v.id) === String(formData.vehiculeId));
  const conducteurLabel = personnels.find((p) => String(p.id) === String(formData.conducteurId));
  const sourceLabel = emplacements.find((e) => String(e.id) === String(formData.sourceId));
  const destinationLabel = emplacements.find((e) => String(e.id) === String(formData.destinationId));

  const sectionCounts = {
    general: formData.num || formData.objet ? 1 : 0,
    vehicule: [formData.vehiculeId, formData.conducteurId].filter(Boolean).length,
    trajet: [formData.dateDepart, formData.sourceId, formData.destinationId].filter(Boolean).length,
    kilometrage: [formData.kilometrageDepart, formData.kilometrageRetour].filter(Boolean).length,
    carburant: bonsMission.length + bonsAAjouter.length,
    amendes: amendesMission.length + amendesAAjouter.length,
    notes: formData.observations?.trim() ? 1 : 0,
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Informations générales')}</h3>
              <p>{t('Identification et statut de la mission')}</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vm-num">{t('Numéro de mission')}</label>
                <input
                  id="vm-num"
                  type="text"
                  name="num"
                  value={formData.num}
                  onChange={handleChange}
                  placeholder={loadingNumero ? t('Génération...') : 'MIS-2026-001'}
                />
                <p className="bmm-hint">{t('Généré automatiquement si laissé vide.')}</p>
              </div>

              <div className="bmm-field">
                <label htmlFor="vm-etat">{t('État')}</label>
                <select
                  id="vm-etat"
                  name="etat"
                  value={formData.etat}
                  onChange={handleChange}
                >
                  {ETAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field bmm-field--full">
                <label htmlFor="vm-objet">{t('Objet de la mission')}</label>
                <input
                  id="vm-objet"
                  type="text"
                  name="objet"
                  value={formData.objet}
                  onChange={handleChange}
                  placeholder={t('Ex : Transport de matériel médical')}
                  autoFocus
                />
              </div>
            </div>
          </div>
        );

      case 'vehicule':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Véhicule & conducteur')}</h3>
              <p>{t('Qui part et avec quel véhicule ?')}</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vm-vehicule">
                  {t('Véhicule')} <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="vm-vehicule"
                  name="vehiculeId"
                  value={formData.vehiculeId}
                  onChange={handleChange}
                  options={vehicules}
                  loading={loadingVehicules}
                  placeholder="Rechercher un véhicule..."
                  emptyMessage="Aucun véhicule ne correspond"
                  getValue={(v) => v.id}
                  getLabel={(v) => {
                    const dispo = isVehiculeDisponiblePourMission(v.etat);
                    const suffix = !dispo ? ` (${t(etatVehiculeLabel(v.etat))})` : '';
                    const base = v.matricule || v.marque || t('Véhicule #{id}', { id: v.id });
                    return `${base}${v.marque && v.matricule ? ` — ${v.marque}` : ''}${suffix}`;
                  }}
                  getOptionHint={(v) => {
                    const parts = [];
                    if (v.marque && v.matricule) parts.push(v.marque);
                    if (!isVehiculeDisponiblePourMission(v.etat)) {
                      parts.push(t(etatVehiculeLabel(v.etat)));
                    }
                    return parts.join(' • ') || null;
                  }}
                  isOptionDisabled={(v) => {
                    const dispo = isVehiculeDisponiblePourMission(v.etat);
                    const estCeluiActuellementAffecte =
                      String(v.id) === String(formData.vehiculeId);
                    return !dispo && !estCeluiActuellementAffecte;
                  }}
                />
                {vehiculeLabel && !isVehiculeDisponiblePourMission(vehiculeLabel.etat) && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>
                    {t("Ce véhicule n'est pas disponible ({etat}) — l'enregistrement sera refusé tant qu'il n'est pas remis en état Disponible ou Réservé.", { etat: t(etatVehiculeLabel(vehiculeLabel.etat)) })}
                  </p>
                )}
                {!loadingVehicules && vehicules.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#dc2626' }}>
                    {t('Aucun véhicule trouvé.')}
                  </p>
                )}
              </div>

              <div className="bmm-field">
                <label htmlFor="vm-conducteur">
                  {t('Conducteur')} <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="vm-conducteur"
                  name="conducteurId"
                  value={formData.conducteurId}
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
                  getOptionHint={(p) => p.matricule ? t('Matricule : {m}', { m: p.matricule }) : null}
                />
                {conducteurLabel && (
                  <p className="bmm-hint">
                    {conducteurLabel.nom} {conducteurLabel.prenom}
                  </p>
                )}
              </div>
            </div>

            {formData.vehiculeId && formData.conducteurId && (
              <div className={`bmm-info vmm-eligibilite ${
                checkingEligibilite ? 'checking' : eligibilite?.eligible ? 'ok' : eligibilite ? 'ko' : ''
              }`}>
                {checkingEligibilite ? (
                  <>
                    <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" />
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
              <h3>{t('Période & trajet')}</h3>
              <p>{t('Quand et où va cette mission ?')}</p>
            </div>

            <div className="bmm-timeline">
              <div className="bmm-timeline-item">
                <span className="bmm-timeline-dot start" />
                <div className="bmm-field">
                  <label htmlFor="vm-depart">
                    {t('Départ')} <span className="bmm-required">*</span>
                  </label>
                  <input
                    id="vm-depart"
                    type="datetime-local"
                    name="dateDepart"
                    value={formData.dateDepart}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="bmm-timeline-line" />

              <div className="bmm-timeline-item">
                <span className="bmm-timeline-dot end" />
                <div className="bmm-field">
                  <label htmlFor="vm-retour">{t('Retour')}</label>
                  <input
                    id="vm-retour"
                    type="datetime-local"
                    name="dateRetour"
                    value={formData.dateRetour}
                    onChange={handleChange}
                    min={formData.dateDepart || undefined}
                  />
                </div>
              </div>
            </div>

            <div className="bmm-grid" style={{ marginTop: 18 }}>
              <div className="bmm-field">
                <label htmlFor="vm-source">
                  {t('Emplacement de départ')} <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="vm-source"
                  name="sourceId"
                  value={formData.sourceId}
                  onChange={handleChange}
                  options={emplacements}
                  loading={loadingEmplacements}
                  placeholder="Rechercher un emplacement..."
                  emptyMessage="Aucun emplacement ne correspond"
                  getValue={(e) => e.id}
                  getLabel={(e) => e.nom || t('Emplacement #{id}', { id: e.id })}
                  getOptionHint={(e) => e.adresse || null}
                />
                {!loadingEmplacements && emplacements.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#dc2626' }}>
                    {t('Aucun emplacement trouvé.')}
                  </p>
                )}
              </div>

              <div className="bmm-field">
                <label htmlFor="vm-destination">
                  {t('Emplacement de destination')} <span className="bmm-required">*</span>
                </label>
                <SearchableSelect
                  id="vm-destination"
                  name="destinationId"
                  value={formData.destinationId}
                  onChange={handleChange}
                  options={emplacements}
                  loading={loadingEmplacements}
                  placeholder="Rechercher un emplacement..."
                  emptyMessage="Aucun emplacement ne correspond"
                  getValue={(e) => e.id}
                  getLabel={(e) => e.nom || t('Emplacement #{id}', { id: e.id })}
                  getOptionHint={(e) => e.adresse || null}
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vm-distance">{t('Distance estimée')}</label>
                <div className="bmm-km-card bmm-km-card--inline">
                  <input
                    id="vm-distance"
                    type="number"
                    name="distanceEstimee"
                    value={formData.distanceEstimee}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                  <span className="bmm-km-unit">{t('km')}</span>
                </div>
              </div>
            </div>

            <div className="bmm-field" style={{ marginTop: 16 }}>
              <label htmlFor="vm-localisation">{t('Point GPS (optionnel)')}</label>
              <div className="bmm-localisation-wrap">
                <input
                  id="vm-localisation"
                  type="text"
                  name="localisation"
                  value={formData.localisation}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchAddress();
                    }
                  }}
                  placeholder={t('Rechercher une adresse...')}
                />
                <button
                  type="button"
                  className="bmm-geo-btn"
                  title={t('Rechercher')}
                  onClick={handleSearchAddress}
                  disabled={searching}
                >
                  {searching ? (
                    <Loader2 size={18} strokeWidth={2.2} className="bmm-spin" />
                  ) : (
                    <Search size={18} strokeWidth={2.2} />
                  )}
                </button>
                <button
                  type="button"
                  className="bmm-geo-btn"
                  title={t('Ma position')}
                  onClick={handleUseGeolocation}
                >
                  <MapPin size={18} strokeWidth={2.2} />
                </button>
              </div>

              <div className="bmm-map">
                <MapContainer
                  center={mapCenter}
                  zoom={hasMarker ? 15 : 11}
                  style={{ width: '100%', height: '240px', borderRadius: '12px' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickHandler onClick={handleMapClick} />
                  <MapRecenter center={mapCenter} />
                  {markerPos && (
                    <Marker position={markerPos}>
                      <Popup>{formData.localisation || t('Position sélectionnée')}</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              {hasMarker && (
                <p className="bmm-hint">
                  Coordonnées : {Number(formData.latitude).toFixed(5)},{' '}
                  {Number(formData.longitude).toFixed(5)}
                  {' — '}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${formData.latitude}&mlon=${formData.longitude}#map=16/${formData.latitude}/${formData.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Ouvrir dans OpenStreetMap')}
                  </a>
                </p>
              )}

              {info && (
                <div className="bmm-info">
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>{info}</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'kilometrage':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Kilométrage')}</h3>
              <p>{t('Relevé compteur au départ et au retour')}</p>
            </div>

            <div className="bmm-km-grid">
              <div className="bmm-km-card">
                <span className="bmm-km-label">{t('Départ')}</span>
                <input
                  type="number"
                  name="kilometrageDepart"
                  value={formData.kilometrageDepart}
                  readOnly
                  disabled
                  title={t('Repris automatiquement du dernier kilométrage validé du véhicule')}
                  placeholder="—"
                />
                <span className="bmm-km-unit">{t('km')}</span>
              </div>

              <div className="bmm-km-arrow">
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>

              <div className="bmm-km-card">
                <span className="bmm-km-label">{t('Retour')}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="kilometrageRetour"
                  value={formData.kilometrageRetour}
                  onChange={handleChange}
                  placeholder="0"
                />
                <span className="bmm-km-unit">{t('km')}</span>
              </div>
            </div>

            <div className="bmm-info" style={{ marginTop: 12 }}>
              <Gauge size={16} strokeWidth={2.5} />
              <span>
                {t('Le kilométrage de départ est repris automatiquement du compteur du véhicule au démarrage de la mission. Le kilométrage de retour se saisit à la clôture.')}
              </span>
            </div>

            {formData.kilometrageDepart !== '' && formData.kilometrageRetour !== '' && (
              <div className="bmm-info" style={{ marginTop: 16 }}>
                <CheckCircle2 size={16} strokeWidth={2.5} />
                <span>
                  {t('Distance parcourue :')}{' '}
                  {Math.max(
                    0,
                    Number(formData.kilometrageRetour) - Number(formData.kilometrageDepart)
                  )}{' '}
                  {t('km')}
                </span>
              </div>
            )}
          </div>
        );

      case 'carburant': {
        const tousBons = [...bonsMission.map((b) => ({ ...b, enAttente: false })), ...bonsAAjouter.map((b, i) => ({ ...b, enAttente: true, index: i }))];
        const totalMontant = tousBons.reduce((s, b) => s + (Number(b.montant) || 0), 0);
        const totalLitres = tousBons.reduce((s, b) => s + (Number(b.litres) || 0), 0);
        const formatDate = (v) => (v ? new Date(v).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Carburant')}</h3>
              <p>{t('Pleins faits pendant cette mission')}</p>
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
                <p>{t('Aucun plein pour cette mission.')}</p>
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
                        {b.enAttente && <span className="vmb-puce vmb-puce--attente">{t('Enregistré avec la mission')}</span>}
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
            {!formData.vehiculeId && <p className="bmm-hint">{t('Choisissez d’abord le véhicule de la mission (onglet Véhicule).')}</p>}
          </div>
        );
      }

      case 'amendes': {
        const toutes = [...amendesMission.map((a) => ({ ...a, enAttente: false })), ...amendesAAjouter.map((a, i) => ({ ...a, enAttente: true, index: i }))];
        const totalAmendes = toutes.reduce((s, a) => s + (Number(a.montant) || 0), 0);
        const aPayer = toutes.filter((a) => a.statut === 0 || a.statut === 1).length;
        const formatDateA = (v) => (v ? new Date(v).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Amendes')}</h3>
              <p>{t('Contraventions reçues pendant cette mission')}</p>
            </div>

            <div className="vmb-resume">
              <div className="vmb-stat">
                <span className="vmb-stat-label">{t('Amendes')}</span>
                <strong>{toutes.length}</strong>
              </div>
              <div className="vmb-stat">
                <span className="vmb-stat-label">{t('À régler')}</span>
                <strong>{aPayer}</strong>
              </div>
              <div className="vmb-stat vmb-stat--montant">
                <span className="vmb-stat-label">{t('Total')}</span>
                <strong>{totalAmendes.toFixed(2)} <small>{t('DT')}</small></strong>
              </div>
            </div>

            {toutes.length === 0 && !saisieAmendeOuverte ? (
              <div className="vmb-vide">
                <span className="vmb-vide-icone"><Receipt size={22} /></span>
                <p>{t('Aucune amende pour cette mission.')}</p>
              </div>
            ) : (
              <ul className="vmb-liste">
                {toutes.map((a) => (
                  <li key={a.enAttente ? 'a-' + a.index : 'e-' + a.id} className={'vmb-ligne' + (a.enAttente ? ' vmb-ligne--attente' : '')}>
                    <span className="vmb-icone"><Receipt size={16} /></span>
                    <div className="vmb-texte">
                      <strong>{a.num ? ltr(a.num) + ' · ' : ''}{formatDateA(a.dateInfraction)}{a.lieu ? ' · ' + a.lieu : ''}</strong>
                      <span className="vmb-puces">
                        {a.type != null && <span className="vmb-puce">{t(TYPES_INFRACTION[a.type] ?? '—')}</span>}
                        {a.referencePv && <span className="vmb-puce">{t('PV')} {ltr(a.referencePv)}</span>}
                        {!a.enAttente && a.statut != null && <span className="vmb-puce">{t(STATUTS_AMENDE[a.statut] ?? '—')}</span>}
                        {a.enRetard && <span className="vmb-puce vmb-puce--attente">{t('En retard')}</span>}
                        {a.enAttente && <span className="vmb-puce vmb-puce--attente">{t('Enregistrée avec la mission')}</span>}
                      </span>
                    </div>
                    <span className="vmb-montant">{a.montant != null ? Number(a.montant).toFixed(2) + ' ' + t('DT') : '—'}</span>
                    {a.enAttente && (
                      <button
                        type="button"
                        className="vmb-retirer"
                        onClick={() => setAmendesAAjouter((l) => l.filter((_, i) => i !== a.index))}
                        aria-label={t('Retirer cette amende')}
                        title={t('Retirer cette amende')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {saisieAmendeOuverte ? (
              <div className="vmb-saisie">
                <div className="vmb-saisie-entete">
                  <Receipt size={16} />
                  <strong>{t('Nouvelle amende')}</strong>
                </div>
                <div className="vmb-saisie-grille">
                  <label className="vmb-champ vmb-champ--large">
                    <span>{t("Date de l'infraction")} <em>*</em></span>
                    <input type="datetime-local" name="dateInfraction" value={formAmende.dateInfraction} onChange={changerAmende} max={maintenantLocal()} />
                  </label>
                  <label className="vmb-champ">
                    <span>{t("Type d'infraction")} <em>*</em></span>
                    <select name="type" value={formAmende.type} onChange={changerAmende}>
                      <option value="">—</option>
                      {Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                    </select>
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Montant (DT)')} <em>*</em></span>
                    <input type="number" name="montant" min="0" step="0.001" value={formAmende.montant} onChange={changerAmende} placeholder="0.000" />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Lieu')}</span>
                    <input type="text" name="lieu" value={formAmende.lieu} onChange={changerAmende} />
                  </label>
                  <label className="vmb-champ">
                    <span>{t('Référence PV')}</span>
                    <input type="text" name="referencePv" value={formAmende.referencePv} onChange={changerAmende} />
                  </label>
                  <label className="vmb-champ vmb-champ--large">
                    <span>{t('Date limite de paiement')}</span>
                    <input type="date" name="dateLimitePaiement" value={formAmende.dateLimitePaiement} onChange={changerAmende} />
                  </label>
                </div>
                {erreurAmende && <p className="vmb-erreur"><AlertTriangle size={14} /> {erreurAmende}</p>}
                <div className="vmb-saisie-actions">
                  <button type="button" className="vmb-btn vmb-btn--clair" onClick={() => setSaisieAmendeOuverte(false)} disabled={enregistrementAmende}>
                    {t('Annuler')}
                  </button>
                  <button type="button" className="vmb-btn vmb-btn--plein" onClick={ajouterAmende} disabled={enregistrementAmende}>
                    {enregistrementAmende ? <Loader2 size={15} className="vmb-tourne" /> : <Check size={15} />}
                    {isEditing ? t("Enregistrer l'amende") : t("Ajouter l'amende")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="vmb-ajouter" onClick={ouvrirSaisieAmende} disabled={!formData.vehiculeId}>
                <Plus size={16} /> {t('Ajouter une amende')}
              </button>
            )}
            {!formData.vehiculeId && <p className="bmm-hint">{t('Choisissez d’abord le véhicule de la mission (onglet Véhicule).')}</p>}
            {formData.vehiculeId && !formData.conducteurId && <p className="bmm-hint">{t('Sans conducteur sur la mission, le responsable sera retrouvé d’après la date de l’infraction.')}</p>}
          </div>
        );
      }

      case 'notes':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>{t('Notes & récapitulatif')}</h3>
              <p>{t('Vérifie les informations avant de valider')}</p>
            </div>

            <div className="bmm-field">
              <label htmlFor="vm-obs">{t('Observations')}</label>
              <textarea
                id="vm-obs"
                name="observations"
                value={formData.observations}
                onChange={handleChange}
                placeholder={t('Remarques éventuelles...')}
                rows={4}
              />
            </div>

            <div className="bmm-summary">
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Numéro')}</span>
                <span className="bmm-summary-value">{formData.num || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('État')}</span>
                <span className={`bmm-etat-badge etat-${formData.etat}`}>
                  {etatLabel}
                </span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Véhicule')}</span>
                <span className="bmm-summary-value">
                  {vehiculeLabel
                    ? `${vehiculeLabel.matricule || ''}${
                        vehiculeLabel.marque ? ` — ${vehiculeLabel.marque}` : ''
                      }`.trim()
                    : '—'}
                </span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Conducteur')}</span>
                <span className="bmm-summary-value">
                  {conducteurLabel
                    ? `${conducteurLabel.nom || ''} ${conducteurLabel.prenom || ''}`.trim()
                    : '—'}
                </span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Départ')}</span>
                <span className="bmm-summary-value">{formData.dateDepart || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Retour')}</span>
                <span className="bmm-summary-value">{formData.dateRetour || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Emplacement de départ')}</span>
                <span className="bmm-summary-value">{sourceLabel?.nom || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Emplacement de destination')}</span>
                <span className="bmm-summary-value">{destinationLabel?.nom || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Point GPS')}</span>
                <span className="bmm-summary-value">{formData.localisation || '—'}</span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Distance estimée')}</span>
                <span className="bmm-summary-value">
                  {formData.distanceEstimee ? `${formData.distanceEstimee} ${t('km')}` : '—'}
                </span>
              </div>

              <div className="bmm-summary-row">
                <span className="bmm-summary-label">{t('Kilométrage')}</span>
                <span className="bmm-summary-value">
                  {formData.kilometrageDepart || '—'} →{' '}
                  {formData.kilometrageRetour || '—'} {t('km')}
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
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="bmm-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Route size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? t('Modification') : t('Création')}
              </span>
              <h2>
                {isEditing ? t('Modifier la mission') : t('Nouvelle mission véhicule')}
              </h2>
            </div>
          </div>

          <div className="bmm-header-right">
            <span className={`bmm-etat-badge etat-${formData.etat}`}>
              {etatLabel}
            </span>
            <button
              type="button"
              className="bmm-close-btn"
              onClick={onClose}
              aria-label={t('Fermer')}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT SPLIT : NAV + CONTENU */}
        <form className="bmm-layout" onSubmit={handleSubmit}>

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
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  {t('Enregistrement...')}
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? t('Mettre à jour') : t('Créer la mission')}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>

    </>
  );
};

export default VehiculeMissionModal;