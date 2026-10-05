import React, { useState, useEffect } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import personnelService from '../../../services/personnelService';
import vehiculeConducteurService from '../../../services/vehiculeConducteurService';
import {
  UserCheck, X, Car, User, Calendar, Loader2,
  AlertTriangle, Save, Settings2, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import './Modal.css';
import './VehiculeConducteurModal.css';

// ─── Options mode d'affectation ───
const MODE_OPTIONS = [
  { value: 0, label: 'Principal' },
  { value: 1, label: 'Secondaire' },
  { value: 2, label: 'Temporaire' },
  { value: 3, label: 'Remplacement' },
];

const emptyForm = {
  vehiculeId: '',
  personnelId: '',
  dateAffectation: '',
  modeAffectation: 0,
};

// ─── Sections de navigation (remplace les steps) ───
const NAV_SECTIONS = [
  { id: 'affectation', label: 'Affectation', Icon: Car },
  { id: 'dateMode',    label: 'Date & mode', Icon: Calendar },
];

// ─── Utilitaires ───
function toDateTimeInput(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const VehiculeConducteurModal = ({ isOpen, onClose, onSave, vehiculeConducteur, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // ✅ REMPLACE currentStep par activeSection
  const [activeSection, setActiveSection] = useState('affectation');

  const [vehicules, setVehicules] = useState([]);
  const [loadingVehicules, setLoadingVehicules] = useState(false);

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  // ─── Éligibilité conducteur / véhicule (selon la catégorie de permis) ───
  const [eligibilite, setEligibilite] = useState(null);
  const [checkingEligibilite, setCheckingEligibilite] = useState(false);

  // ─── Chargement des listes ───
  useEffect(() => {
    if (!isOpen) return;

    const fetchVehicules = async () => {
      setLoadingVehicules(true);
      try {
        const page = await vehiculeService.getAll(0, 200);
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
        const page = await personnelService.getAll(0, 200);
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

  // ─── Pré-remplissage ───
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setActiveSection('affectation');

    if (isEditing && vehiculeConducteur) {
      setFormData({
        vehiculeId: vehiculeConducteur.vehiculeId ?? '',
        personnelId: vehiculeConducteur.personnelId ?? '',
        dateAffectation: toDateTimeInput(vehiculeConducteur.dateAffectation),
        modeAffectation: vehiculeConducteur.modeAffectation ?? 0,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [isOpen, vehiculeConducteur, isEditing]);

  // ─── Contrôle du permis : dès que véhicule + conducteur sont choisis, on
  // vérifie si le conducteur détient une catégorie de permis compatible ───
  useEffect(() => {
    if (!isOpen || !formData.vehiculeId || !formData.personnelId) {
      setEligibilite(null);
      return;
    }

    let cancelled = false;
    setCheckingEligibilite(true);

    vehiculeConducteurService
      .verifierEligibilite(formData.personnelId, formData.vehiculeId)
      .then((res) => { if (!cancelled) setEligibilite(res); })
      .catch((err) => {
        console.error('Erreur contrôle éligibilité conducteur/véhicule :', err);
        if (!cancelled) setEligibilite(null);
      })
      .finally(() => { if (!cancelled) setCheckingEligibilite(false); });

    return () => { cancelled = true; };
  }, [isOpen, formData.vehiculeId, formData.personnelId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  // ─── Soumission ───
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.vehiculeId) {
      setError('Le véhicule est obligatoire.');
      setActiveSection('affectation');
      return;
    }
    if (!formData.personnelId) {
      setError('Le conducteur est obligatoire.');
      setActiveSection('affectation');
      return;
    }
    if (!formData.dateAffectation) {
      setError("La date d'affectation est obligatoire.");
      setActiveSection('dateMode');
      return;
    }
    if (eligibilite && !eligibilite.eligible) {
      setError(eligibilite.motif || "Ce conducteur n'est pas habilité pour ce véhicule (catégorie de permis incompatible).");
      setActiveSection('affectation');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        vehiculeId: Number(formData.vehiculeId),
        personnelId: Number(formData.personnelId),
        dateAffectation: formData.dateAffectation
          ? `${formData.dateAffectation}:00`
          : null,
        modeAffectation: Number(formData.modeAffectation),
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
  const conducteurLabel = personnels.find((p) => String(p.id) === String(formData.personnelId));
  const modeLabel = MODE_OPTIONS.find((o) => o.value === Number(formData.modeAffectation))?.label ?? '';

  // ─── Badges compteurs par section ───
  const sectionCounts = {
    affectation: [formData.vehiculeId, formData.personnelId].filter(Boolean).length,
    dateMode: [formData.dateAffectation, formData.modeAffectation].filter((v) => v !== '' && v != null).length,
  };

  // ─── Contenu des sections ───
  const renderContent = () => {
    switch (activeSection) {
      case 'affectation':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Véhicule &amp; conducteur</h3>
              <p>Qui conduit quel véhicule ?</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vc-vehicule">
                  Véhicule <span className="bmm-required">*</span>
                </label>
                <select
                  id="vc-vehicule"
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
                    <Car size={12} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    {vehiculeLabel.matricule}
                    {vehiculeLabel.marque ? ` — ${vehiculeLabel.marque}` : ''}
                  </p>
                )}
                {!loadingVehicules && vehicules.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>Aucun véhicule trouvé.</p>
                )}
              </div>

              <div className="bmm-field">
                <label htmlFor="vc-personnel">
                  Conducteur <span className="bmm-required">*</span>
                </label>
                <select
                  id="vc-personnel"
                  name="personnelId"
                  value={formData.personnelId}
                  onChange={handleChange}
                  disabled={loadingPersonnels}
                >
                  <option value="">
                    {loadingPersonnels ? 'Chargement...' : 'Sélectionner un conducteur...'}
                  </option>
                  {personnels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} {p.prenom}{p.matricule ? ` (${p.matricule})` : ''}
                    </option>
                  ))}
                </select>
                {conducteurLabel && (
                  <p className="bmm-hint">
                    <User size={12} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    {conducteurLabel.nom} {conducteurLabel.prenom}
                  </p>
                )}
                {!loadingPersonnels && personnels.length === 0 && (
                  <p className="bmm-hint" style={{ color: '#b45309' }}>Aucun personnel trouvé.</p>
                )}
              </div>
            </div>

            {/* Contrôle permis / type de véhicule */}
            {formData.vehiculeId && formData.personnelId && (
              <div className={`vcdm-eligibilite ${
                checkingEligibilite ? 'checking' : eligibilite?.eligible ? 'ok' : eligibilite ? 'ko' : ''
              }`}>
                {checkingEligibilite ? (
                  <>
                    <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" />
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

      case 'dateMode':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Date &amp; mode d'affectation</h3>
              <p>Quand et comment cette affectation prend-elle effet ?</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label htmlFor="vc-date">
                  Date d'affectation <span className="bmm-required">*</span>
                </label>
                <input
                  id="vc-date"
                  type="datetime-local"
                  name="dateAffectation"
                  value={formData.dateAffectation}
                  onChange={handleChange}
                />
                <p className="bmm-hint">Date et heure de début de l'affectation.</p>
              </div>

              <div className="bmm-field">
                <label htmlFor="vc-mode">
                  Mode d'affectation <span className="bmm-required">*</span>
                </label>
                <select
                  id="vc-mode"
                  name="modeAffectation"
                  value={formData.modeAffectation}
                  onChange={handleChange}
                >
                  {MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="bmm-hint">Type d'affectation (principal, temporaire, remplacement...).</p>
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
                  {conducteurLabel ? `${conducteurLabel.nom} ${conducteurLabel.prenom}` : '—'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Date d'affectation</span>
                <span className="bmm-summary-value">{formData.dateAffectation || '—'}</span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Mode</span>
                <span className="bmm-summary-value">{modeLabel || '—'}</span>
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
              <UserCheck size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Création'}
              </span>
              <h2>{isEditing ? "Modifier l'affectation" : 'Affecter un conducteur'}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            {modeLabel && <span className="bmm-mode-badge">{modeLabel}</span>}
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
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || checkingEligibilite || (eligibilite && !eligibilite.eligible)}
            >
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Affecter'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VehiculeConducteurModal;