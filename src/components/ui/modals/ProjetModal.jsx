import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import prestataireService from '../../../services/prestataireService';
import emplacementService from '../../../services/emplacementService';
import {
  FolderKanban, X, Check, Building2, MapPin, Calendar,
  FileText, Loader2, Save, AlertTriangle, Activity,
  CheckCircle2, XCircle, Hourglass, AlignLeft, Hash,
  Sparkles, ChevronRight, TrendingUp, Clock,
} from 'lucide-react';
import './Modal.css';
import './ProjetModal.css';

const ETAT_OPTIONS = [
  { value: 0, label: 'Planifié', Icon: Hourglass,    color: 'amber' },
  { value: 1, label: 'En cours', Icon: Activity,     color: 'blue' },
  { value: 2, label: 'Terminé',  Icon: CheckCircle2, color: 'green' },
  { value: 3, label: 'Annulé',   Icon: XCircle,      color: 'slate' },
];

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'identification', label: 'Identification', Icon: FileText },
  { id: 'affectation',    label: 'Affectation',    Icon: Building2 },
  { id: 'periode',        label: 'Période & état', Icon: Calendar },
];

const emptyForm = {
  code: '',
  nom: '',
  description: '',
  prestataireId: '',
  emplacementId: '',
  dateDebut: '',
  dateFin: '',
  etat: 0,
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
  });
}

function durationLabel(debut, fin) {
  if (!debut || !fin) return null;
  const d1 = new Date(debut);
  const d2 = new Date(fin);
  if (isNaN(d1) || isNaN(d2) || d2 <= d1) return null;
  const diffMs = d2 - d1;
  const days = diffMs / (1000 * 60 * 60 * 24);
  if (days < 1) return `${(days * 24).toFixed(1)} h`;
  return `${days.toFixed(1)} j`;
}

const ProjetModal = ({ isOpen, onClose, onSave, projet, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('identification');

  const [prestataires, setPrestataires] = useState([]);
  const [loadingPrestataires, setLoadingPrestataires] = useState(false);

  const [emplacements, setEmplacements] = useState([]);
  const [loadingEmplacements, setLoadingEmplacements] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPrestataires = async () => {
      setLoadingPrestataires(true);
      try {
        const page = await prestataireService.getAll(0, 300);
        setPrestataires(page.content ?? []);
      } catch (err) {
        console.error(err);
        setPrestataires([]);
      } finally {
        setLoadingPrestataires(false);
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

    fetchPrestataires();
    fetchEmplacements();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveSection('identification');
    setError(null);

    if (isEditing && projet) {
      setFormData({
        code: projet.code || '',
        nom: projet.nom || '',
        description: projet.description || '',
        prestataireId: projet.prestataireId ?? '',
        emplacementId: projet.emplacementId ?? '',
        dateDebut: toInputDateTime(projet.dateDebut),
        dateFin: toInputDateTime(projet.dateFin),
        etat: projet.etat ?? 0,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [isOpen, projet, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!formData.nom.trim()) {
      setError('Le nom du projet est obligatoire.');
      setActiveSection('identification');
      return;
    }
    if (formData.dateFin && formData.dateDebut && formData.dateFin < formData.dateDebut) {
      setError('La date de fin ne peut pas être antérieure à la date de début.');
      setActiveSection('periode');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        code: formData.code.trim() || null,
        nom: formData.nom.trim(),
        description: formData.description.trim() || null,
        prestataireId: formData.prestataireId === '' ? null : Number(formData.prestataireId),
        emplacementId: formData.emplacementId === '' ? null : Number(formData.emplacementId),
        dateDebut: formData.dateDebut || null,
        dateFin: formData.dateFin || null,
        etat: Number(formData.etat),
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

  const prestataireLabel = prestataires.find((p) => String(p.id) === String(formData.prestataireId));
  const emplacementLabel = emplacements.find((e) => String(e.id) === String(formData.emplacementId));
  const etatMeta = ETAT_OPTIONS.find((o) => o.value === Number(formData.etat)) ?? ETAT_OPTIONS[0];
  const EtatIcon = etatMeta.Icon;
  const duree = durationLabel(formData.dateDebut, formData.dateFin);

  // ─── Badges compteurs par section ───
  const sectionCounts = useMemo(() => ({
    identification: [formData.code, formData.nom, formData.description].filter(Boolean).length,
    affectation:    [formData.prestataireId, formData.emplacementId].filter(Boolean).length,
    periode:        [formData.dateDebut, formData.dateFin].filter(Boolean).length,
  }), [formData]);

  if (!isOpen) return null;

  // ─── Contenu des sections ───
  const renderContent = () => {
    switch (activeSection) {
      case 'identification':
        return (
          <div className="prjm-content-pane">
            <div className="prjm-pane-header">
              <h3>Identification</h3>
              <p>Code, nom et description du projet</p>
            </div>

            <div className="prjm-grid">
              <div className="prjm-field">
                <label htmlFor="prjm-code">Code</label>
                <div className="prjm-input-icon">
                  <Hash size={15} strokeWidth={2.4} />
                  <input
                    id="prjm-code"
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="Ex : PRJ-2026-001"
                  />
                </div>
              </div>

              <div className="prjm-field">
                <label htmlFor="prjm-nom">
                  Nom <span className="prjm-required">*</span>
                </label>
                <div className="prjm-input-icon">
                  <FileText size={15} strokeWidth={2.4} />
                  <input
                    id="prjm-nom"
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    placeholder="Nom du projet"
                    autoFocus
                  />
                </div>
              </div>

              <div className="prjm-field prjm-field--full">
                <label htmlFor="prjm-description">Description</label>
                <textarea
                  id="prjm-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Décris le projet..."
                />
              </div>
            </div>
          </div>
        );

      case 'affectation':
        return (
          <div className="prjm-content-pane">
            <div className="prjm-pane-header">
              <h3>Affectation</h3>
              <p>Prestataire et emplacement liés au projet</p>
            </div>

            <div className="prjm-grid">
              <div className="prjm-field prjm-field--full">
                <label htmlFor="prjm-prestataire">Prestataire</label>
                <div className="prjm-input-icon">
                  <Building2 size={15} strokeWidth={2.4} />
                  <select
                    id="prjm-prestataire"
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
                        {p.raisonSociale || p.nom}
                      </option>
                    ))}
                  </select>
                </div>
                {prestataireLabel && (
                  <p className="prjm-hint prjm-hint--ok">
                    <Check size={12} strokeWidth={2.5} />
                    {prestataireLabel.raisonSociale || prestataireLabel.nom}
                  </p>
                )}
              </div>

              <div className="prjm-field prjm-field--full">
                <label htmlFor="prjm-emplacement">Emplacement</label>
                <div className="prjm-input-icon">
                  <MapPin size={15} strokeWidth={2.4} />
                  <select
                    id="prjm-emplacement"
                    name="emplacementId"
                    value={formData.emplacementId}
                    onChange={handleChange}
                    disabled={loadingEmplacements}
                  >
                    <option value="">
                      {loadingEmplacements ? 'Chargement...' : '— Aucun —'}
                    </option>
                    {emplacements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom || e.adresse}
                      </option>
                    ))}
                  </select>
                </div>
                {emplacementLabel && (
                  <p className="prjm-hint prjm-hint--ok">
                    <Check size={12} strokeWidth={2.5} />
                    {emplacementLabel.adresse || emplacementLabel.nom}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'periode':
        return (
          <div className="prjm-content-pane">
            <div className="prjm-pane-header">
              <h3>Période &amp; état</h3>
              <p>Dates de début, fin et statut du projet</p>
            </div>

            <div className="prjm-grid">
              <div className="prjm-field">
                <label htmlFor="prjm-debut">Date début</label>
                <div className="prjm-input-icon">
                  <Calendar size={15} strokeWidth={2.4} />
                  <input
                    id="prjm-debut"
                    type="datetime-local"
                    name="dateDebut"
                    value={formData.dateDebut}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="prjm-field">
                <label htmlFor="prjm-fin">Date fin</label>
                <div className="prjm-input-icon">
                  <Calendar size={15} strokeWidth={2.4} />
                  <input
                    id="prjm-fin"
                    type="datetime-local"
                    name="dateFin"
                    value={formData.dateFin}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="prjm-field prjm-field--full" style={{ marginTop: 6 }}>
                <label>État du projet</label>
                <div className="prjm-chips">
                  {ETAT_OPTIONS.map((o) => {
                    const Icon = o.Icon;
                    const isActive = Number(formData.etat) === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        className={`prjm-chip chip-${o.color} ${isActive ? 'active' : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, etat: o.value }))}
                      >
                        <Icon size={13} strokeWidth={2.4} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
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
      <div className="prjm-modal prjm-modal--xl" onClick={(e) => e.stopPropagation()}>

        {/* ═══ HEADER GRADIENT TEAL ═══ */}
        <div className="prjm-header">
          <div className="prjm-header-left">
            <div className="prjm-header-icon-wrap">
              <FolderKanban size={22} strokeWidth={2.2} />
            </div>
            <div>
              <span className="prjm-eyebrow">
                {isEditing ? 'Modification' : 'Nouveau projet'}
              </span>
              <h2>{formData.nom || (isEditing ? 'Modifier le projet' : 'Créer un projet')}</h2>
            </div>
          </div>
          <div className="prjm-header-right">
            <span className={`prjm-etat-chip chip-${etatMeta.color}`}>
              <span className="prjm-chip-dot" />
              {etatMeta.label}
            </span>
            <button type="button" className="prjm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ═══ LAYOUT : NAV + CONTENU + APERÇU ═══ */}
        <form className="prjm-layout prjm-layout--with-preview" onSubmit={handleSubmit}>

          {/* NAVIGATION LATÉRALE */}
          <aside className="prjm-nav">
            <div className="prjm-nav-title">Sections</div>
            <nav className="prjm-nav-list">
              {NAV_SECTIONS.map((s) => {
                const isActive = activeSection === s.id;
                const count = sectionCounts[s.id];
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`prjm-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setError(null);
                      setActiveSection(s.id);
                    }}
                  >
                    <span className="prjm-nav-item-icon">
                      <Icon size={15} strokeWidth={2.3} />
                    </span>
                    <span className="prjm-nav-item-label">{s.label}</span>
                    {count != null && count > 0 && (
                      <span className="prjm-nav-item-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CONTENU */}
          <div className="prjm-content">
            {renderContent()}

            {error && (
              <div className="prjm-error-inline">
                <AlertTriangle size={16} strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* APERÇU */}
          <aside className="prjm-preview-wrap">
            <div className="prjm-preview">
              <div className="prjm-preview-head">
                <div className="prjm-preview-head-icon">
                  <Sparkles size={14} strokeWidth={2.4} />
                </div>
                <div>
                  <span className="prjm-preview-head-title">Aperçu live</span>
                  <span className="prjm-preview-head-sub">Se met à jour en temps réel</span>
                </div>
              </div>

              {/* Carte projet */}
              <div className="prjm-preview-card">
                <div className="prjm-preview-label">Projet</div>
                <div className="prjm-preview-projet">
                  <div className="prjm-preview-projet-icon">
                    <FolderKanban size={18} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="prjm-preview-projet-nom">
                      {formData.nom || 'Non renseigné'}
                    </div>
                    {formData.code && (
                      <div className="prjm-preview-projet-code">{formData.code}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statut */}
              <div className="prjm-preview-card">
                <div className="prjm-preview-label">Statut</div>
                <div className={`prjm-preview-etat chip-${etatMeta.color}`}>
                  <EtatIcon size={12} strokeWidth={2.5} />
                  {etatMeta.label}
                </div>
              </div>

              {/* Période */}
              <div className="prjm-preview-card">
                <div className="prjm-preview-label">Période</div>
                <div className="prjm-preview-timeline">
                  <div className="prjm-preview-time">
                    <span className="prjm-preview-time-dot start" />
                    <div>
                      <div className="prjm-preview-time-label">Début</div>
                      <div className="prjm-preview-time-value">
                        {formatDateFr(formData.dateDebut)}
                      </div>
                    </div>
                  </div>

                  <div className="prjm-preview-bar">
                    {duree && <span className="prjm-preview-duration">{duree}</span>}
                  </div>

                  <div className="prjm-preview-time">
                    <span className="prjm-preview-time-dot end" />
                    <div>
                      <div className="prjm-preview-time-label">Fin</div>
                      <div className="prjm-preview-time-value">
                        {formatDateFr(formData.dateFin)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Affectation */}
              {(prestataireLabel || emplacementLabel) && (
                <div className="prjm-preview-card">
                  <div className="prjm-preview-label">Affectation</div>
                  {prestataireLabel && (
                    <div className="prjm-preview-person">
                      <Building2 size={14} strokeWidth={2.3} />
                      <div>
                        <div className="prjm-preview-person-role">Prestataire</div>
                        <div className="prjm-preview-person-name">
                          {prestataireLabel.raisonSociale || prestataireLabel.nom}
                        </div>
                      </div>
                    </div>
                  )}
                  {emplacementLabel && (
                    <div className="prjm-preview-person">
                      <MapPin size={14} strokeWidth={2.3} />
                      <div>
                        <div className="prjm-preview-person-role">Emplacement</div>
                        <div className="prjm-preview-person-name">
                          {emplacementLabel.nom || emplacementLabel.adresse}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Récapitulatif */}
              <div className="prjm-preview-summary">
                <div className="prjm-preview-summary-head">
                  <TrendingUp size={13} strokeWidth={2.5} />
                  <span>Récapitulatif</span>
                </div>
                <div className="prjm-preview-summary-row">
                  <span>Code</span>
                  <span>{formData.code || '—'}</span>
                </div>
                <div className="prjm-preview-summary-row">
                  <span>Durée</span>
                  <span>{duree || '—'}</span>
                </div>
                <div className="prjm-preview-summary-row">
                  <span>Description</span>
                  <span>{formData.description || '—'}</span>
                </div>
              </div>
            </div>
          </aside>
        </form>

        {/* ═══ FOOTER ═══ */}
        <div className="prjm-footer">
          <div className="prjm-footer-left">
            <span className="prjm-footer-step">
              {NAV_SECTIONS.findIndex((s) => s.id === activeSection) + 1} / {NAV_SECTIONS.length}
            </span>
          </div>
          <div className="prjm-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="prjm-spin" style={{ marginRight: 6 }} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  {isEditing ? 'Mettre à jour' : 'Créer le projet'}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProjetModal;