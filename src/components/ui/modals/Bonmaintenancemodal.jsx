import React, { useState, useEffect, useRef } from 'react';
import Button from '../Button';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import lotArticleService from '../../../services/lotArticleService';
import articleService from '../../../services/articleService';
import pieceLigneService from '../../../services/pieceLigneService';
import diagnosticAssistantService from '../../../services/Diagnosticassistantservice';
import repartitionInterventionsService from '../../../services/repartitionInterventionsService';
import authService from '../../../services/Authservice';
import {
  Wrench, X, Plus, Trash2, Info, AlertTriangle, Save, Loader2,
  Sparkles, Check, UserPlus, AlertCircle,
  ClipboardList, Users, MessageSquare, FileText, Brain, Package,
  ArrowUp, CheckCircle2, Search, ChevronDown,
} from 'lucide-react';
import './Modal.css';
import './BonMaintenanceModal.css';

const NIVEAU_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];

const emptyForm = {
  num: '', n: '', titre: '', description: '', type: '', urgence: '',
  prestataireId: '', lotArticleImmobilistationId: '', personnelDemandantId: '',
  date: '', dateFinIntervention: '', effet: '', cause: '', remede: '',
  commentaire: '', arretOblig: false,
};

const emptyTache = {
  designation: '', ordre: '', dateDebut: '', dateFin: '',
  prestataireArticlesId: '', qte: '', sousTraitantId: '',
};

const emptyIntervenant = {
  personnelId: '', sousTraitantId: '',
  dateDebutIntervention: '', dateFinIntervention: '',
  nbrHeure: '', coutUnitaire: '', commentaire: '',
};

function toInputDateTime(iso) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

// ─── Sections de navigation ───
const NAV_SECTIONS = [
  { id: 'general',       label: 'Général',       Icon: FileText },
  { id: 'affectation',   label: 'Affectation',   Icon: Users },
  { id: 'diagnostic',    label: 'Diagnostic',    Icon: Brain },
  { id: 'taches',        label: 'Tâches',        Icon: ClipboardList },
  { id: 'intervenants',  label: 'Intervenants',  Icon: Users },
  { id: 'commentaires',  label: 'Commentaires',  Icon: MessageSquare },
  { id: 'details',       label: 'Détails',       Icon: Info },
];

// ─── Select avec recherche intégrée (combobox) ───
// `compact` = true → style compact pour les formulaires inline (tâches, intervenants)
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
  compact = false,
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

  const rootClass = compact ? 'bmm-searchable bmm-searchable--compact' : 'bmm-searchable';

  return (
    <div className={rootClass} ref={containerRef}>
      <div className={`bmm-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={compact ? 13 : 15} strokeWidth={2.3} className="bmm-searchable-icon" />

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
            <X size={compact ? 11 : 13} strokeWidth={2.5} />
          </button>
        )}

        <ChevronDown
          size={compact ? 13 : 15}
          strokeWidth={2.3}
          className={`bmm-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmm-searchable-menu">
          <div className="bmm-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`bmm-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="bmm-searchable-option-main">
                  <span className="bmm-searchable-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
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

const BonMaintenanceModal = ({ isOpen, onClose, onSave, bonMaintenance, isEditing, initialValues = null, titleOverride = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [activeSection, setActiveSection] = useState('general');

  const [personnels, setPersonnels] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [taches, setTaches] = useState([]);
  const [tacheForm, setTacheForm] = useState(emptyTache);
  const [tacheDisponible, setTacheDisponible] = useState(null);
  const [checkingTacheDisponible, setCheckingTacheDisponible] = useState(false);

  const [immoQteDisponible, setImmoQteDisponible] = useState(null);
  const [checkingImmoQte, setCheckingImmoQte] = useState(false);

  const [intervenants, setIntervenants] = useState([]);
  const [intervenantForm, setIntervenantForm] = useState(emptyIntervenant);

  const [commentaires, setCommentaires] = useState([]);
  const [commentaireText, setCommentaireText] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [suggestionsDemandees, setSuggestionsDemandees] = useState(false);
  const [suggestionsAppliquees, setSuggestionsAppliquees] = useState(new Set());

  const [suggestionsTechniciens, setSuggestionsTechniciens] = useState([]);
  const [loadingTechniciens, setLoadingTechniciens] = useState(false);
  const [techniciensErreur, setTechniciensErreur] = useState(null);
  const [techniciensDemandes, setTechniciensDemandes] = useState(false);

  const diagAssistantRef = useRef(null);
  const contentRef = useRef(null);

  // ─── Reset ───
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuggestions([]);
    setSuggestionsAppliquees(new Set());
    setSuggestionsTechniciens([]);
    setSuggestionsDemandees(false);
    setTechniciensDemandes(false);
    setTaches([]);
    setTacheForm(emptyTache);
    setIntervenants([]);
    setIntervenantForm(emptyIntervenant);
    setCommentaires([]);
    setCommentaireText('');
    setActiveSection('general');
  }, [isOpen]);

  // ─── Chargement des listes ───
  useEffect(() => {
    if (!isOpen) return;

    const fetchLists = async () => {
      setLoadingLists(true);
      try {
        const [persPage, prestPage, immoPage, articlesPage] = await Promise.all([
          personnelService.getAll(0, 200),
          prestataireService.getAll(0, 200),
          lotArticleImmobilistationService.getAll(0, 200),
          articleService.getAll(0, 300),
        ]);
        setPersonnels(persPage.content ?? []);
        setPrestataires(prestPage.content ?? []);
        setImmobilisations(immoPage.content ?? []);
        setArticles(articlesPage.content ?? []);
      } catch (err) {
        console.error('Erreur chargement :', err);
      } finally {
        setLoadingLists(false);
      }
    };

    fetchLists();
  }, [isOpen]);

  // ─── Pré-remplissage ───
  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && bonMaintenance) {
      setFormData({
        num: bonMaintenance.num || '',
        n: bonMaintenance.n ?? '',
        titre: bonMaintenance.titre || '',
        description: bonMaintenance.description || '',
        type: bonMaintenance.type ?? '',
        urgence: bonMaintenance.urgence ?? '',
        prestataireId: bonMaintenance.prestataireId ?? '',
        lotArticleImmobilistationId: bonMaintenance.lotArticleImmobilistationId ?? '',
        personnelDemandantId: bonMaintenance.personnelDemandantId ?? '',
        date: toInputDateTime(bonMaintenance.date),
        dateFinIntervention: toInputDateTime(bonMaintenance.dateFinIntervention),
        effet: bonMaintenance.effet || '',
        cause: bonMaintenance.cause || '',
        remede: bonMaintenance.remede || '',
        commentaire: bonMaintenance.commentaire || '',
        arretOblig: bonMaintenance.arretOblig ?? false,
      });
    } else {
      const ctx = authService.getContexteMetier();
      setFormData({
        ...emptyForm,
        prestataireId: ctx.prestataireId ?? '',
        personnelDemandantId: ctx.userId ?? '',
        ...(initialValues || {}),
      });
    }
  }, [isOpen, bonMaintenance, isEditing, initialValues]);

  // ─── Scroll content to top when section changes ───
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ─── Vérif stock immobilisation ───
  useEffect(() => {
    if (!formData.lotArticleImmobilistationId) {
      setImmoQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingImmoQte(true);
    lotArticleImmobilistationService.getById(formData.lotArticleImmobilistationId)
      .then((immo) => {
        if (cancelled) return null;
        if (!immo?.lotArticleId) {
          setImmoQteDisponible(null);
          return null;
        }
        return lotArticleService.getById(immo.lotArticleId);
      })
      .then((lotArticle) => {
        if (!cancelled && lotArticle) setImmoQteDisponible(lotArticle.qte ?? null);
      })
      .catch(() => { if (!cancelled) setImmoQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingImmoQte(false); });
    return () => { cancelled = true; };
  }, [formData.lotArticleImmobilistationId]);

  // ─── Vérif stock tâche ───
  useEffect(() => {
    if (!tacheForm.prestataireArticlesId) {
      setTacheDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingTacheDisponible(true);
    pieceLigneService.getQuantiteDisponible(tacheForm.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setTacheDisponible(qte); })
      .catch(() => { if (!cancelled) setTacheDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingTacheDisponible(false); });
    return () => { cancelled = true; };
  }, [tacheForm.prestataireArticlesId]);

  // ─── Ajouts / suppressions ───
  const addTache = () => {
    if (!tacheForm.designation.trim()) {
      alert("La désignation de la tâche est obligatoire.");
      return;
    }
    setTaches((prev) => [...prev, { ...tacheForm, _localId: Date.now() }]);
    setTacheForm(emptyTache);
  };
  const removeTache = (id) => setTaches((prev) => prev.filter((t) => t._localId !== id));

  const addIntervenant = () => {
    if (!intervenantForm.personnelId && !intervenantForm.sousTraitantId) {
      alert('Sélectionne un technicien ou un sous-traitant.');
      return;
    }
    setIntervenants((prev) => [...prev, { ...intervenantForm, _localId: Date.now() }]);
    setIntervenantForm(emptyIntervenant);
  };
  const removeIntervenant = (id) => setIntervenants((prev) => prev.filter((i) => i._localId !== id));

  const addCommentaire = () => {
    if (!commentaireText.trim()) return;
    setCommentaires((prev) => [...prev, { commentaire: commentaireText.trim(), _localId: Date.now() }]);
    setCommentaireText('');
  };
  const removeCommentaire = (id) => setCommentaires((prev) => prev.filter((c) => c._localId !== id));

  const stripLocalId = (arr) => arr.map(({ _localId, ...rest }) => rest);

  // ─── Assistant diagnostic ───
  const analyserDiagnostic = async () => {
    if (!formData.titre.trim() && !formData.description.trim()) {
      setSuggestionsError("Renseigne un titre ou une description.");
      return;
    }
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    setSuggestionsDemandees(true);
    setSuggestionsAppliquees(new Set());
    try {
      const result = await diagnosticAssistantService.suggerer({
        titre: formData.titre,
        description: formData.description,
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId || null,
      });
      setSuggestions(result ?? []);
    } catch (err) {
      console.error(err);
      setSuggestionsError("Impossible de récupérer des suggestions.");
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const appliquerSuggestion = (s, idx) => {
    setFormData((prev) => ({
      ...prev,
      cause: s.causeProbable || prev.cause,
      remede: s.remedeSuggere || prev.remede,
      effet: s.effetAssocie || prev.effet,
    }));
    setSuggestionsAppliquees((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const origineLabel = (origine) => {
    switch (origine) {
      case 'meme_equipement': return 'Même équipement';
      case 'meme_type_equipement': return "Même type d'équipement";
      default: return 'Symptômes similaires';
    }
  };

  // ─── Assistant affectation ───
  const suggererTechniciens = async () => {
    setLoadingTechniciens(true);
    setTechniciensErreur(null);
    setTechniciensDemandes(true);
    try {
      const result = await repartitionInterventionsService.suggererTechniciens({
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId || null,
        dateDebut: formData.date || null,
        dateFin: formData.dateFinIntervention || null,
      });
      setSuggestionsTechniciens(result ?? []);
    } catch (err) {
      console.error(err);
      setTechniciensErreur('Impossible de calculer des suggestions.');
      setSuggestionsTechniciens([]);
    } finally {
      setLoadingTechniciens(false);
    }
  };

  const assignerTechnicien = (s) => {
    setIntervenantForm((prev) => ({ ...prev, personnelId: String(s.personnelId) }));
    setActiveSection('intervenants');
  };

  // ─── Submit ───
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.titre.trim()) {
      setError('Le titre est obligatoire.');
      setActiveSection('general');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        num: formData.num.trim() || null,
        n: formData.n === '' ? null : Number(formData.n),
        titre: formData.titre.trim(),
        description: formData.description.trim() || null,
        type: formData.type === '' ? null : Number(formData.type),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        prestataireId: formData.prestataireId === '' ? null : Number(formData.prestataireId),
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId === '' ? null : Number(formData.lotArticleImmobilistationId),
        personnelDemandantId: formData.personnelDemandantId === '' ? null : Number(formData.personnelDemandantId),
        date: formData.date || null,
        dateFinIntervention: formData.dateFinIntervention || null,
        effet: formData.effet.trim() || null,
        cause: formData.cause.trim() || null,
        remede: formData.remede.trim() || null,
        commentaire: formData.commentaire.trim() || null,
        arretOblig: formData.arretOblig,
      };

      const children = isEditing ? null : {
        taches: stripLocalId(taches).map((t) => ({
          designation: t.designation.trim(),
          ordre: t.ordre === '' ? null : Number(t.ordre),
          dateDebut: t.dateDebut || null,
          dateFin: t.dateFin || null,
          prestataireArticlesId: t.prestataireArticlesId === '' ? null : Number(t.prestataireArticlesId),
          qte: t.qte === '' ? null : Number(t.qte),
          sousTraitantId: t.sousTraitantId === '' ? null : Number(t.sousTraitantId),
        })),
        intervenants: stripLocalId(intervenants).map((i) => ({
          personnelId: i.personnelId === '' ? null : Number(i.personnelId),
          sousTraitantId: i.sousTraitantId === '' ? null : Number(i.sousTraitantId),
          dateDebutIntervention: i.dateDebutIntervention || null,
          dateFinIntervention: i.dateFinIntervention || null,
          nbrHeure: i.nbrHeure === '' ? null : Number(i.nbrHeure),
          coutUnitaire: i.coutUnitaire === '' ? null : Number(i.coutUnitaire),
          commentaire: i.commentaire.trim() || null,
        })),
        commentaires: stripLocalId(commentaires),
      };

      await onSave(payload, children);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Échec de l'enregistrement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const suggestionsVisibles = suggestions.filter((_, i) => !suggestionsAppliquees.has(i));
  const urgenceLabel = NIVEAU_OPTIONS.find((o) => o.value === Number(formData.urgence))?.label;

  const sectionCounts = {
    diagnostic: suggestionsVisibles.length,
    taches: taches.length,
    intervenants: intervenants.length,
    commentaires: commentaires.length,
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Informations générales</h3>
              <p>Titre, description et niveau d'urgence</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label>Numéro</label>
                <input type="text" name="num" value={formData.num} onChange={handleChange} placeholder="BM-2026-014" />
              </div>
              <div className="bmm-field">
                <label>N° interne</label>
                <input type="number" name="n" value={formData.n} onChange={handleChange} />
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Titre <span className="bmm-required">*</span></label>
                <input
                  type="text"
                  name="titre"
                  value={formData.titre}
                  onChange={handleChange}
                  placeholder="Ex : Remplacement filtre climatisation bloc B"
                  autoFocus
                />
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Décris le problème ou l'opération à réaliser..."
                />
              </div>

              <div className="bmm-field">
                <label>Urgence</label>
                <select name="urgence" value={formData.urgence} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label>Type (code)</label>
                <input type="number" name="type" value={formData.type} onChange={handleChange} />
              </div>
            </div>

            <label className={`bmm-toggle-card ${formData.arretOblig ? 'active' : ''}`}>
              <input type="checkbox" name="arretOblig" checked={formData.arretOblig} onChange={handleChange} />
              <div className="bmm-toggle-icon">
                <AlertTriangle size={18} strokeWidth={2.2} />
              </div>
              <div className="bmm-toggle-text">
                <span className="bmm-toggle-title">Arrêt obligatoire de l'équipement</span>
                <span className="bmm-toggle-desc">L'équipement sera immobilisé pendant l'intervention</span>
              </div>
            </label>
          </div>
        );

      case 'affectation':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Affectation &amp; planning</h3>
              <p>Prestataire, immobilisation et dates</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field">
                <label>Prestataire</label>
                <select name="prestataireId" value={formData.prestataireId} onChange={handleChange} disabled={loadingLists}>
                  <option value="">— Aucun —</option>
                  {prestataires.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label>Immobilisation</label>
                <SearchableSelect
                  id="bmm-immo"
                  name="lotArticleImmobilistationId"
                  value={formData.lotArticleImmobilistationId}
                  onChange={handleChange}
                  options={immobilisations}
                  loading={loadingLists}
                  placeholder="Rechercher une immobilisation..."
                  emptyMessage="Aucune immobilisation ne correspond"
                  allowEmpty
                  emptyOptionLabel="— Aucune —"
                  getValue={(i) => i.id}
                  getLabel={(i) =>
                    i.designation || i.libelle || i.code || `Immobilisation #${i.id}`
                  }
                  getOptionHint={(i) => (i.code ? `Code : ${i.code}` : null)}
                />
                {formData.lotArticleImmobilistationId && (
                  <p className="bmm-hint">
                    {checkingImmoQte
                      ? 'Vérification du stock...'
                      : (immoQteDisponible != null
                          ? `Stock : ${immoQteDisponible}`
                          : 'Stock inconnu')}
                  </p>
                )}
                {!checkingImmoQte && formData.lotArticleImmobilistationId && immoQteDisponible != null && Number(immoQteDisponible) <= 0 && (
                  <div className="bmm-alert bmm-alert--danger">
                    <AlertTriangle size={14} strokeWidth={2.5} />
                    <span>Quantité non disponible.</span>
                  </div>
                )}
              </div>

              <div className="bmm-field">
                <label>Personnel demandeur</label>
                <SearchableSelect
                  id="bmm-personnel"
                  name="personnelDemandantId"
                  value={formData.personnelDemandantId}
                  onChange={handleChange}
                  options={personnels}
                  loading={loadingLists}
                  placeholder="Rechercher un personnel..."
                  emptyMessage="Aucun personnel ne correspond"
                  allowEmpty
                  emptyOptionLabel="— Aucun —"
                  getValue={(p) => p.id}
                  getLabel={(p) =>
                    `${p.nom || ''} ${p.prenom || ''}`.trim() +
                    (p.matricule ? ` (${p.matricule})` : '')
                  }
                  getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                />
              </div>

              <div className="bmm-field">
                <label>Date début</label>
                <input type="datetime-local" name="date" value={formData.date} onChange={handleChange} />
              </div>

              <div className="bmm-field bmm-field--full">
                <label>Date fin</label>
                <input type="datetime-local" name="dateFinIntervention" value={formData.dateFinIntervention} onChange={handleChange} />
              </div>
            </div>
          </div>
        );

      case 'diagnostic':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Diagnostic intelligent</h3>
              <p>Assistant basé sur l'historique des interventions</p>
            </div>

            <div className="bmm-assistant" ref={diagAssistantRef}>
              <div className="bmm-assistant-header">
                <div className="bmm-assistant-title">
                  <div className="bmm-assistant-icon">
                    <Sparkles size={16} strokeWidth={2.2} />
                  </div>
                  <div>
                    <span className="bmm-assistant-title-main">Assistant diagnostic</span>
                    <span className="bmm-assistant-title-sub">Compare au historique des interventions</span>
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={analyserDiagnostic} disabled={loadingSuggestions}>
                  {loadingSuggestions ? (
                    <>
                      <Loader2 size={14} className="bmm-spin" style={{ marginRight: 6 }} />
                      Analyse...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} strokeWidth={2.4} style={{ marginRight: 6 }} />
                      Analyser
                    </>
                  )}
                </Button>
              </div>

              {suggestionsError && (
                <div className="bmm-assistant-error">
                  <AlertCircle size={14} strokeWidth={2.5} />
                  <span>{suggestionsError}</span>
                </div>
              )}

              {suggestionsDemandees && !loadingSuggestions && !suggestionsError && suggestions.length === 0 && (
                <p className="bmm-assistant-empty">Aucun cas similaire trouvé.</p>
              )}

              {suggestionsVisibles.length > 0 && (
                <ul className="bmm-suggestion-list">
                  {suggestions.map((s, idx) => {
                    if (suggestionsAppliquees.has(idx)) return null;
                    return (
                      <li key={idx} className="bmm-suggestion-card">
                        <div className="bmm-suggestion-head">
                          <span className="bmm-suggestion-badge">{origineLabel(s.origineMatch)}</span>
                          <span className="bmm-suggestion-score">{s.confiance}% · {s.occurrences} cas</span>
                        </div>
                        <p className="bmm-suggestion-line"><strong>Cause :</strong> {s.causeProbable || '—'}</p>
                        {s.effetAssocie && (
                          <p className="bmm-suggestion-line"><strong>Effet :</strong> {s.effetAssocie}</p>
                        )}
                        <p className="bmm-suggestion-line"><strong>Solution :</strong> {s.remedeSuggere || '—'}</p>
                        <Button type="button" variant="secondary" onClick={() => appliquerSuggestion(s, idx)}>
                          <Check size={14} strokeWidth={2.6} style={{ marginRight: 6 }} />
                          Utiliser
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {suggestions.length > 0 && suggestionsAppliquees.size === suggestions.length && (
                <p className="bmm-assistant-empty">✅ Toutes les suggestions ont été appliquées.</p>
              )}
            </div>

            <div className="bmm-grid" style={{ marginTop: 16 }}>
              <div className="bmm-field">
                <label>Cause</label>
                <input type="text" name="cause" value={formData.cause} onChange={handleChange} />
              </div>
              <div className="bmm-field">
                <label>Effet</label>
                <input type="text" name="effet" value={formData.effet} onChange={handleChange} />
              </div>
              <div className="bmm-field bmm-field--full">
                <label>Remède</label>
                <input type="text" name="remede" value={formData.remede} onChange={handleChange} />
              </div>
            </div>
          </div>
        );

      case 'taches':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Tâches</h3>
              <p>Opérations prévues pour cette intervention</p>
            </div>

            {isEditing ? (
              <div className="bmm-notice">
                <Info size={16} strokeWidth={2.4} />
                <span>Gère les tâches depuis « Détails » une fois le bon enregistré.</span>
              </div>
            ) : (
              <>
                <div className="bmm-inline-form">
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <input
                      type="text"
                      placeholder="Désignation *"
                      value={tacheForm.designation}
                      onChange={(e) => setTacheForm({ ...tacheForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="bmm-inline-field bmm-inline-field--narrow">
                    <input
                      type="number"
                      placeholder="Ordre"
                      value={tacheForm.ordre}
                      onChange={(e) => setTacheForm({ ...tacheForm, ordre: e.target.value })}
                    />
                  </div>
                  <div className="bmm-inline-field">
                    <input
                      type="datetime-local"
                      value={tacheForm.dateDebut}
                      onChange={(e) => setTacheForm({ ...tacheForm, dateDebut: e.target.value })}
                      title="Début"
                    />
                  </div>
                  <div className="bmm-inline-field">
                    <input
                      type="datetime-local"
                      value={tacheForm.dateFin}
                      onChange={(e) => setTacheForm({ ...tacheForm, dateFin: e.target.value })}
                      title="Fin"
                    />
                  </div>

                  {/* ✅ Article avec recherche (compact) */}
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <SearchableSelect
                      id="bmm-tache-article"
                      name="prestataireArticlesId"
                      value={tacheForm.prestataireArticlesId}
                      onChange={(e) => setTacheForm({ ...tacheForm, prestataireArticlesId: e.target.value })}
                      options={articles}
                      placeholder="Rechercher un article..."
                      emptyMessage="Aucun article ne correspond"
                      allowEmpty
                      emptyOptionLabel="— Article (optionnel) —"
                      getValue={(a) => a.id}
                      getLabel={(a) => a.designation || a.libelle || `Article #${a.id}`}
                      getOptionHint={(a) => (a.code ? `Code : ${a.code}` : null)}
                      compact
                    />
                  </div>

                  <div className="bmm-inline-field bmm-inline-field--narrow">
                    <input
                      type="number"
                      placeholder="Qté"
                      value={tacheForm.qte}
                      onChange={(e) => setTacheForm({ ...tacheForm, qte: e.target.value })}
                    />
                  </div>

                  {/* ✅ Sous-traitant avec recherche (compact) */}
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <SearchableSelect
                      id="bmm-tache-soustraitant"
                      name="sousTraitantId"
                      value={tacheForm.sousTraitantId}
                      onChange={(e) => setTacheForm({ ...tacheForm, sousTraitantId: e.target.value })}
                      options={prestataires}
                      placeholder="Rechercher un sous-traitant..."
                      emptyMessage="Aucun sous-traitant ne correspond"
                      allowEmpty
                      emptyOptionLabel="— Sous-traitant —"
                      getValue={(p) => p.id}
                      getLabel={(p) =>
                        p.raisonSociale ||
                        `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() ||
                        `Prestataire #${p.id}`
                      }
                      getOptionHint={(p) => (p.code ? `Code : ${p.code}` : null)}
                      compact
                    />
                  </div>

                  <div className="bmm-inline-field">
                    <button type="button" className="bmm-inline-add" onClick={addTache}>
                      <Plus size={14} strokeWidth={2.6} />
                      Ajouter
                    </button>
                  </div>
                </div>

                {tacheForm.prestataireArticlesId && (
                  <p className="bmm-hint">
                    {checkingTacheDisponible ? 'Vérification...' : (tacheDisponible != null ? `Stock : ${tacheDisponible}` : 'Stock inconnu')}
                  </p>
                )}

                {taches.length === 0 ? (
                  <div className="bmm-empty">
                    <ClipboardList size={28} strokeWidth={1.6} />
                    <p>Aucune tâche ajoutée</p>
                  </div>
                ) : (
                  <ul className="bmm-list bmm-list--scrollable">
                    {taches.map((t) => {
                      const article = articles.find((a) => String(a.id) === String(t.prestataireArticlesId));
                      return (
                        <li key={t._localId} className="bmm-list-item">
                          <div className="bmm-list-item-content">
                            <span className="bmm-list-item-title">{t.designation}</span>
                            <span className="bmm-list-item-meta">
                              {article && <><Package size={12} strokeWidth={2.5} /> {article.designation}</>}
                              {t.qte && <> · Qté {t.qte}</>}
                            </span>
                          </div>
                          <button type="button" className="bmm-list-item-remove" onClick={() => removeTache(t._localId)}>
                            <Trash2 size={14} strokeWidth={2.4} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        );

      case 'intervenants':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Intervenants</h3>
              <p>Techniciens et sous-traitants affectés</p>
            </div>

            {isEditing ? (
              <div className="bmm-notice">
                <Info size={16} strokeWidth={2.4} />
                <span>Gère les intervenants depuis « Détails » une fois le bon enregistré.</span>
              </div>
            ) : (
              <>
                <div className="bmm-assistant">
                  <div className="bmm-assistant-header">
                    <div className="bmm-assistant-title">
                      <div className="bmm-assistant-icon">
                        <UserPlus size={16} strokeWidth={2.2} />
                      </div>
                      <div>
                        <span className="bmm-assistant-title-main">Qui affecter ?</span>
                        <span className="bmm-assistant-title-sub">Suggestions selon expérience et charge</span>
                      </div>
                    </div>
                    <Button type="button" variant="secondary" onClick={suggererTechniciens} disabled={loadingTechniciens}>
                      {loadingTechniciens ? (
                        <>
                          <Loader2 size={14} className="bmm-spin" style={{ marginRight: 6 }} />
                          Analyse...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} strokeWidth={2.4} style={{ marginRight: 6 }} />
                          Suggérer
                        </>
                      )}
                    </Button>
                  </div>

                  {techniciensErreur && (
                    <div className="bmm-assistant-error">
                      <AlertCircle size={14} strokeWidth={2.5} />
                      <span>{techniciensErreur}</span>
                    </div>
                  )}

                  {techniciensDemandes && !loadingTechniciens && !techniciensErreur && suggestionsTechniciens.length === 0 && (
                    <p className="bmm-assistant-empty">Aucun technicien candidat.</p>
                  )}

                  {suggestionsTechniciens.length > 0 && (
                    <ul className="bmm-suggestion-list bmm-suggestion-list--scrollable">
                      {suggestionsTechniciens.map((s) => (
                        <li key={s.personnelId} className="bmm-suggestion-card">
                          <div className="bmm-suggestion-head">
                            <span className="bmm-suggestion-badge">
                              {s.nbInterventionsSurCeType > 0 ? `${s.nbInterventionsSurCeType} intervention(s)` : 'Sans historique'}
                            </span>
                            <span className="bmm-suggestion-score">{s.score}%</span>
                          </div>
                          <p className="bmm-suggestion-line">
                            <strong>{s.prenom} {s.nom}</strong>{s.fonction ? ` — ${s.fonction}` : ''}
                          </p>
                          <p className="bmm-suggestion-line">
                            Charge : {s.chargeActuelle} en cours
                            {s.conflitPeriode && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · occupé</span>}
                          </p>
                          <Button type="button" variant="secondary" onClick={() => assignerTechnicien(s)}>
                            <UserPlus size={14} strokeWidth={2.4} style={{ marginRight: 6 }} />
                            Affecter
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bmm-inline-form">
                  {/* ✅ Technicien interne avec recherche (compact) */}
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <SearchableSelect
                      id="bmm-interv-personnel"
                      name="personnelId"
                      value={intervenantForm.personnelId}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, personnelId: e.target.value })}
                      options={personnels}
                      placeholder="Rechercher un technicien..."
                      emptyMessage="Aucun technicien ne correspond"
                      allowEmpty
                      emptyOptionLabel="— Technicien interne —"
                      getValue={(p) => p.id}
                      getLabel={(p) =>
                        `${p.nom || ''} ${p.prenom || ''}`.trim() +
                        (p.matricule ? ` (${p.matricule})` : '')
                      }
                      getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
                      compact
                    />
                  </div>

                  {/* ✅ Sous-traitant avec recherche (compact) */}
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <SearchableSelect
                      id="bmm-interv-soustraitant"
                      name="sousTraitantId"
                      value={intervenantForm.sousTraitantId}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, sousTraitantId: e.target.value })}
                      options={prestataires}
                      placeholder="Rechercher un sous-traitant..."
                      emptyMessage="Aucun sous-traitant ne correspond"
                      allowEmpty
                      emptyOptionLabel="— Sous-traitant —"
                      getValue={(p) => p.id}
                      getLabel={(p) =>
                        p.raisonSociale ||
                        `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() ||
                        `Prestataire #${p.id}`
                      }
                      getOptionHint={(p) => (p.code ? `Code : ${p.code}` : null)}
                      compact
                    />
                  </div>

                  <div className="bmm-inline-field">
                    <input
                      type="datetime-local"
                      value={intervenantForm.dateDebutIntervention}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, dateDebutIntervention: e.target.value })}
                      title="Début"
                    />
                  </div>
                  <div className="bmm-inline-field">
                    <input
                      type="datetime-local"
                      value={intervenantForm.dateFinIntervention}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, dateFinIntervention: e.target.value })}
                      title="Fin"
                    />
                  </div>
                  <div className="bmm-inline-field bmm-inline-field--narrow">
                    <input
                      type="number"
                      placeholder="Nb heures"
                      value={intervenantForm.nbrHeure}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, nbrHeure: e.target.value })}
                    />
                  </div>
                  <div className="bmm-inline-field bmm-inline-field--narrow">
                    <input
                      type="number"
                      placeholder="Coût unitaire"
                      value={intervenantForm.coutUnitaire}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, coutUnitaire: e.target.value })}
                    />
                  </div>
                  <div className="bmm-inline-field bmm-inline-field--wide">
                    <input
                      type="text"
                      placeholder="Commentaire"
                      value={intervenantForm.commentaire}
                      onChange={(e) => setIntervenantForm({ ...intervenantForm, commentaire: e.target.value })}
                    />
                  </div>
                  <div className="bmm-inline-field">
                    <button type="button" className="bmm-inline-add" onClick={addIntervenant}>
                      <Plus size={14} strokeWidth={2.6} />
                      Ajouter
                    </button>
                  </div>
                </div>

                {intervenants.length === 0 ? (
                  <div className="bmm-empty">
                    <Users size={28} strokeWidth={1.6} />
                    <p>Aucun intervenant ajouté</p>
                  </div>
                ) : (
                  <ul className="bmm-list bmm-list--scrollable">
                    {intervenants.map((i) => {
                      const personnel = personnels.find((p) => String(p.id) === String(i.personnelId));
                      const prest = prestataires.find((p) => String(p.id) === String(i.sousTraitantId));
                      return (
                        <li key={i._localId} className="bmm-list-item">
                          <div className="bmm-list-item-content">
                            <span className="bmm-list-item-title">
                              {personnel ? `${personnel.nom} ${personnel.prenom}` : (prest?.raisonSociale || '—')}
                            </span>
                            {i.nbrHeure && (
                              <span className="bmm-list-item-meta">{i.nbrHeure}h</span>
                            )}
                          </div>
                          <button type="button" className="bmm-list-item-remove" onClick={() => removeIntervenant(i._localId)}>
                            <Trash2 size={14} strokeWidth={2.4} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        );

      case 'commentaires':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Commentaires</h3>
              <p>Notes et précisions ajoutées</p>
            </div>

            {isEditing ? (
              <div className="bmm-notice">
                <Info size={16} strokeWidth={2.4} />
                <span>Gère les commentaires depuis « Détails » une fois le bon enregistré.</span>
              </div>
            ) : (
              <>
                <div className="bmm-inline-form">
                  <div className="bmm-inline-field bmm-inline-field--full">
                    <input
                      type="text"
                      placeholder="Ajouter un commentaire..."
                      value={commentaireText}
                      onChange={(e) => setCommentaireText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCommentaire(); } }}
                    />
                  </div>
                  <div className="bmm-inline-field">
                    <button type="button" className="bmm-inline-add" onClick={addCommentaire}>
                      <Plus size={14} strokeWidth={2.6} />
                      Ajouter
                    </button>
                  </div>
                </div>

                {commentaires.length === 0 ? (
                  <div className="bmm-empty">
                    <MessageSquare size={28} strokeWidth={1.6} />
                    <p>Aucun commentaire</p>
                  </div>
                ) : (
                  <ul className="bmm-list bmm-list--scrollable">
                    {commentaires.map((c) => (
                      <li key={c._localId} className="bmm-list-item">
                        <div className="bmm-list-item-content">
                          <span className="bmm-list-item-title">{c.commentaire}</span>
                        </div>
                        <button type="button" className="bmm-list-item-remove" onClick={() => removeCommentaire(c._localId)}>
                          <Trash2 size={14} strokeWidth={2.4} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        );

      case 'details':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Commentaire général</h3>
              <p>Informations complémentaires du bon</p>
            </div>

            <div className="bmm-field">
              <label>Commentaire général</label>
              <textarea
                name="commentaire"
                value={formData.commentaire}
                onChange={handleChange}
                rows={6}
                placeholder="Notes internes, contexte particulier..."
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
      <div className="bmm-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Wrench size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">
                {isEditing ? 'Modification' : 'Nouvelle entrée'}
              </span>
              <h2>{isEditing ? 'Modifier le bon' : (titleOverride || 'Nouveau bon de maintenance')}</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            {urgenceLabel && (
              <span className={`bmm-urgence-badge urgence-${formData.urgence}`}>
                {urgenceLabel}
              </span>
            )}
            <button type="button" className="bmm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* LAYOUT SPLIT : NAV + CONTENU */}
        <form className="bmm-layout" onSubmit={handleSubmit}>

          <aside className="bmm-nav">
            <div className="bmm-nav-title">Sections</div>
            <nav className="bmm-nav-list">
              {NAV_SECTIONS.filter((s) => !isEditing || (s.id !== 'taches' && s.id !== 'intervenants' && s.id !== 'commentaires')).map((s) => {
                const isActive = activeSection === s.id;
                const count = sectionCounts[s.id];
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`bmm-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveSection(s.id)}
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

          <div className="bmm-content" ref={contentRef}>
            {renderContent()}

            {error && (
              <div className="bmm-error">
                <AlertCircle size={16} strokeWidth={2.5} />
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

export default BonMaintenanceModal;