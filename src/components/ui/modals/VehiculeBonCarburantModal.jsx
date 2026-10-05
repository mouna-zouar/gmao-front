import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import personnelService from '../../../services/personnelService';
import {
  Fuel, X, Car, User, Calendar, Gauge, Coins,
  Loader2, AlertTriangle, Save,
} from 'lucide-react';
import './Modal.css';
import './VehiculeBonCarburantModal.css';

const emptyForm = {
  vehiculeId: '',
  personnelId: '',
  date: '',
  montant: '',
  kilometrage: '',
};

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'identification', label: 'Identification', Icon: Car },
  { id: 'details',        label: 'Détails',        Icon: Fuel },
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

const VehiculeBonCarburantModal = ({ isOpen, onClose, onSave, bonCarburant, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ REMPLACE (pas de currentStep ici) par activeSection
  const [activeSection, setActiveSection] = useState('identification');

  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);

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
        console.error('Erreur chargement véhicules :', err);
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
        console.error('Erreur chargement personnel :', err);
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

    setError(null);
    setActiveSection('identification');

    if (isEditing && bonCarburant) {
      setFormData({
        vehiculeId: bonCarburant.vehiculeId ?? '',
        personnelId: bonCarburant.personnelId ?? '',
        date: toInputDateTime(bonCarburant.date),
        montant: bonCarburant.montant ?? '',
        kilometrage: bonCarburant.kilometrage ?? '',
      });
    } else {
      setFormData({
        ...emptyForm,
        date: toInputDateTime(new Date().toISOString()),
      });
    }
  }, [isOpen, bonCarburant, isEditing]);

  /**
   * Kilométrage actuel du véhicule sélectionné : plancher de saisie.
   * Le bon carburant est une source de kilométrage réel, le relevé ne peut
   * donc pas être inférieur au compteur du véhicule. Le contrôle définitif
   * est fait côté serveur (409), celui-ci n'est qu'un garde-fou de saisie.
   */
  const kmVehicule = useMemo(() => {
    const veh = vehicules.find((v) => String(v.id) === String(formData.vehiculeId));
    return veh?.kilometrage ?? null;
  }, [formData.vehiculeId, vehicules]);

  const kmInvalide =
    formData.kilometrage !== '' &&
    kmVehicule != null &&
    Number(formData.kilometrage) < kmVehicule;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.vehiculeId) {
      setError('Le véhicule est obligatoire.');
      setActiveSection('identification');
      return;
    }
    if (!formData.date) {
      setError('La date est obligatoire.');
      setActiveSection('details');
      return;
    }
    if (kmInvalide) {
      setError(
        `Le kilométrage saisi (${formData.kilometrage} km) est inférieur au ` +
        `compteur actuel du véhicule (${kmVehicule} km). Un compteur ne recule jamais.`
      );
      setActiveSection('details');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        vehiculeId: Number(formData.vehiculeId),
        personnelId: formData.personnelId === '' ? null : Number(formData.personnelId),
        date: formData.date || null,
        montant: formData.montant === '' ? null : Number(formData.montant),
        kilometrage: formData.kilometrage === '' ? null : Number(formData.kilometrage),
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

  const vehiculeLabel = vehicules.find((v) => String(v.id) === String(formData.vehiculeId));
  const personnelLabel = personnels.find((p) => String(p.id) === String(formData.personnelId));

  // ─── Badges compteurs par section ───
  const sectionCounts = {
    identification: [formData.vehiculeId, formData.personnelId].filter(Boolean).length,
    details: [
      formData.date,
      formData.montant,
      formData.kilometrage,
    ].filter((v) => v !== '' && v != null).length,
  };

  // ─── Contenu des sections ───
  const renderContent = () => {
    switch (activeSection) {
      case 'identification':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Identification</h3>
              <p>Véhicule concerné et conducteur</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label htmlFor="vbc-vehicule">
                  Véhicule <span className="bmm-required">*</span>
                </label>
                <select
                  id="vbc-vehicule"
                  name="vehiculeId"
                  value={formData.vehiculeId}
                  onChange={handleChange}
                  disabled={loadingVehicules}
                >
                  <option value="">
                    {loadingVehicules ? 'Chargement...' : 'Sélectionner un véhicule...'}
                  </option>
                  {vehicules.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.matricule || `Véhicule #${v.id}`}{v.marque ? ` — ${v.marque}` : ''}
                    </option>
                  ))}
                </select>
                {vehiculeLabel && (
                  <p className="bmm-hint">
                    {vehiculeLabel.matricule}
                    {vehiculeLabel.marque ? ` — ${vehiculeLabel.marque}` : ''}
                  </p>
                )}
                {!loadingVehicules && vehicules.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>Aucun véhicule trouvé.</p>
                )}
              </div>

              <div className="bmm-field bmm-field--full">
                <label htmlFor="vbc-personnel">Conducteur</label>
                <select
                  id="vbc-personnel"
                  name="personnelId"
                  value={formData.personnelId}
                  onChange={handleChange}
                  disabled={loadingPersonnels}
                >
                  <option value="">
                    {loadingPersonnels ? 'Chargement...' : '— Non affecté —'}
                  </option>
                  {personnels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} {p.prenom}{p.matricule ? ` (${p.matricule})` : ''}
                    </option>
                  ))}
                </select>
                {personnelLabel && (
                  <p className="bmm-hint">
                    {personnelLabel.nom} {personnelLabel.prenom}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Détails du bon</h3>
              <p>Date, montant et kilométrage au moment du plein</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label htmlFor="vbc-date">
                  Date <span className="bmm-required">*</span>
                </label>
                <input
                  id="vbc-date"
                  type="datetime-local"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vbc-montant">Montant</label>
                <div className="bmm-km-card bmm-km-card--inline">
                  <span className="bmm-km-label">
                    <Coins size={14} strokeWidth={2.5} />
                  </span>
                  <input
                    id="vbc-montant"
                    type="number"
                    step="0.01"
                    min="0"
                    name="montant"
                    value={formData.montant}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                  <span className="bmm-km-unit">DT</span>
                </div>
              </div>

              <div className="bmm-field">
                <label htmlFor="vbc-km">Kilométrage</label>
                <div className="bmm-km-card bmm-km-card--inline">
                  <span className="bmm-km-label">
                    <Gauge size={14} strokeWidth={2.5} />
                  </span>
                  <input
                    id="vbc-km"
                    type="number"
                    step="0.1"
                    min={kmVehicule ?? 0}
                    name="kilometrage"
                    value={formData.kilometrage}
                    onChange={handleChange}
                    placeholder={kmVehicule != null ? String(kmVehicule) : '0'}
                    className={kmInvalide ? 'bmm-input-invalid' : ''}
                  />
                  <span className="bmm-km-unit">km</span>
                </div>

                {kmVehicule != null && !kmInvalide && (
                  <small className="bmm-field-hint">
                    Compteur actuel du véhicule : {Number(kmVehicule).toLocaleString('fr-FR')} km.
                    Ce relevé mettra à jour le kilométrage du véhicule.
                  </small>
                )}

                {kmInvalide && (
                  <small className="bmm-field-error">
                    <AlertTriangle size={12} strokeWidth={2.5} />
                    Le relevé ne peut pas être inférieur au compteur du véhicule
                    ({Number(kmVehicule).toLocaleString('fr-FR')} km).
                  </small>
                )}
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="bmm-summary">
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Véhicule</span>
                <span className="bmm-summary-value">
                  {vehiculeLabel
                    ? `${vehiculeLabel.matricule || ''}${vehiculeLabel.marque ? ` — ${vehiculeLabel.marque}` : ''}`.trim()
                    : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Conducteur</span>
                <span className="bmm-summary-value">
                  {personnelLabel
                    ? `${personnelLabel.nom} ${personnelLabel.prenom}`
                    : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Date</span>
                <span className="bmm-summary-value">{formData.date || '—'}</span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Montant</span>
                <span className="bmm-summary-value">
                  {formData.montant !== '' ? `${formData.montant} DT` : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Kilométrage</span>
                <span className="bmm-summary-value">
                  {formData.kilometrage !== '' ? `${formData.kilometrage} km` : '—'}
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
              <Fuel size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Nouvelle entrée'}
              </span>
              <h2>{isEditing ? 'Modifier le bon carburant' : 'Nouveau bon carburant'}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            {vehiculeLabel && (
              <span className="bmm-mode-badge">
                {vehiculeLabel.matricule || `#${vehiculeLabel.id}`}
              </span>
            )}
            <button
              type="button"
              className="bmm-close-btn"
              onClick={onClose}
              aria-label="Fermer"
            >
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
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading || kmInvalide}>
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Créer le bon'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculeBonCarburantModal;