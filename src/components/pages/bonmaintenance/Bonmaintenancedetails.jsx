import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Calendar,
  Activity,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Info,
  Play,
  Pause,
  RotateCcw,
  Download,
  Printer,
  ChevronDown,
  Eye,
  PackageSearch,
  ShoppingCart,
  Users,
  ClipboardList,
  FileCheck,
  RotateCw,
  Circle,
  Link,
  Unlink,
  ExternalLink,
  Workflow,
  Inbox,
  X,
  Check,
} from 'lucide-react';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import { prioriteLabel, prioriteColor } from '../../../constants/Priorite';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../services/Bonmaintenanceintervenanthistoriqueservice';
import bonMaintenanceCommentaireService from '../../../services/Bonmaintenancecommentaireservice';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import bonMaintenancePieceImmoService from '../../../services/Bonmaintenancepieceimmoservice';
import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import slaService from '../../../services/slaService';
import coutService from '../../../services/coutService';
import rcaCapaService from '../../../services/rcaCapaService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import personnelService from '../../../services/Personnelservice';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import lotArticleService from '../../../services/lotArticleService';
import pieceLigneService from '../../../services/PieceLigneService';
import articleService from '../../../services/articleService';
import pieceService from '../../../services/Pieceservice';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import './BonMaintenanceDetails.css';

// Constantes d'état
const ETAT = {
  NOUVEAU: 1,
  SUSPENDU: 2,
  EN_COURS: 3,
  EFFECTUE: 4,
  ANNULE: 10,
};

const ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const ETAT_CLASSES = {
  1: 'etat-nouveau',
  2: 'etat-suspendu',
  3: 'etat-encours',
  4: 'etat-effectue',
  10: 'etat-annule',
};

const ETAT_ICONS = {
  1: Circle,
  2: Pause,
  3: Activity,
  4: CheckCircle,
  10: XCircle,
};

const INTERVENANT_ETAT_LABELS = {
  0: 'Nouveau',
  1: 'En cours',
  2: 'Terminé',
  10: 'Annulé',
};

const TABS = [
  { key: 'flow', label: 'Vue d\'ensemble', icon: Eye },
  { key: 'diagnostic', label: 'Diagnostic', icon: Search },
  { key: 'taches', label: 'Tâches', icon: ClipboardList },
  { key: 'intervenants', label: 'Intervenants', icon: Users },
  { key: 'controle', label: 'Contrôle', icon: FileCheck },
  { key: 'remiseEnService', label: 'Remise en service', icon: RotateCw },
  { key: 'commentaires', label: 'Commentaires', icon: Info },
  { key: 'historique', label: 'Historique', icon: Clock },
  { key: 'documents', label: 'Documents d\'achat', icon: FileText },
];

const GRAVITE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const TYPE_CONTROLE_OPTIONS = ['Fonctionnel', 'Sécurité électrique', 'Calibration', 'Étalonnage', 'Autre'];
const ETAT_IMMOBILISATION_OPTIONS = [
  { value: 1, label: 'Fonctionnel avec problème' },
  { value: 2, label: 'En panne' },
  { value: 3, label: 'À changer' },
  { value: 4, label: 'Hors service' },
];

// Fonctions utilitaires
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getEtatLabel(etat) {
  return ETAT_LABELS[etat] || 'Inconnu';
}

function getEtatClass(etat) {
  return ETAT_CLASSES[etat] || '';
}

function getEtatIcon(etat) {
  return ETAT_ICONS[etat] || Circle;
}

const SLA_STATUT_LABELS = {
  RESPECTE: 'Respecté',
  DEPASSE: 'Dépassé',
  EN_COURS: 'En cours',
  NON_APPLICABLE: 'N/A',
};

const SLA_STATUT_CLASS = {
  RESPECTE: 'bmd-sla-statut--respecte',
  DEPASSE: 'bmd-sla-statut--depasse',
  EN_COURS: 'bmd-sla-statut--encours',
  NON_APPLICABLE: 'bmd-sla-statut--na',
};

function slaGlobalClass(sla) {
  if (!sla) return 'bmd-sla-btn--na';
  if (sla.statutReponse === 'DEPASSE' || sla.statutResolution === 'DEPASSE') return 'bmd-sla-btn--depasse';
  if (sla.statutReponse === 'NON_APPLICABLE' && sla.statutResolution === 'NON_APPLICABLE') return 'bmd-sla-btn--na';
  if (sla.statutReponse === 'EN_COURS' || sla.statutResolution === 'EN_COURS') return 'bmd-sla-btn--encours';
  return 'bmd-sla-btn--respecte';
}

function formatDureeHeures(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return `${heures.toFixed(1)} h`;
  return `${(heures / 24).toFixed(1)} j`;
}

function formatMontant(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

const METHODE_RCA_LABELS = {
  CINQ_POURQUOI: '5 Pourquoi',
  ISHIKAWA: 'Ishikawa',
  PARETO: 'Pareto',
  AUTRE: 'Autre',
};

const TYPE_ACTION_LABELS = { CORRECTIVE: 'Corrective', PREVENTIVE: 'Préventive' };

const STATUT_ACTION_LABELS = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VERIFIEE_EFFICACE: 'Vérifiée efficace',
  VERIFIEE_INEFFICACE: 'Vérifiée inefficace',
};

const STATUT_ACTION_CLASS = {
  A_FAIRE: 'bmd-capa-statut--afaire',
  EN_COURS: 'bmd-capa-statut--encours',
  TERMINEE: 'bmd-capa-statut--terminee',
  VERIFIEE_EFFICACE: 'bmd-capa-statut--efficace',
  VERIFIEE_INEFFICACE: 'bmd-capa-statut--inefficace',
};

function nouvelleActionVide() {
  return { type: 'CORRECTIVE', description: '', responsable: '', dateEcheance: '' };
}

function rcaGlobalClass(analyses) {
  if (!analyses) return 'bmd-rca-btn--na';
  if (analyses.length === 0) return 'bmd-rca-btn--na';
  const actions = analyses.flatMap((a) => a.actions || []);
  if (actions.some((a) => a.enRetard)) return 'bmd-rca-btn--retard';
  if (actions.length > 0 && actions.every((a) => a.statut === 'TERMINEE' || a.statut === 'VERIFIEE_EFFICACE' || a.statut === 'VERIFIEE_INEFFICACE')) {
    return 'bmd-rca-btn--ok';
  }
  return 'bmd-rca-btn--encours';
}

function warnIfQuantiteInvalide(articles, articleId, qte, libelleQuantite = 'quantité') {
  if (!articleId) return;
  const article = articles.find((a) => String(a.id) === String(articleId));
  const nomArticle = article?.designation || 'cet article';

  if (qte === '' || qte == null) {
    alert(
      `Attention : aucune ${libelleQuantite} saisie pour "${nomArticle}".\n`
      + `Vous pouvez continuer, mais pensez à renseigner la quantité si nécessaire.`
    );
    return;
  }

  const qteNum = Number(qte);
  if (isNaN(qteNum) || qteNum <= 0) {
    alert(
      `Attention : la ${libelleQuantite} saisie (${qte}) pour "${nomArticle}" semble invalide `
      + `(elle doit être un nombre positif).\n`
      + `Vous pouvez continuer si c'est volontaire.`
    );
  }
}

// ============================================================
// SEARCHABLE SELECT (combobox avec recherche)
// ============================================================
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
  const rootClass = compact ? 'bmd-searchable bmd-searchable--compact' : 'bmd-searchable';

  return (
    <div className={rootClass} ref={containerRef}>
      <div className={`bmd-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={compact ? 13 : 15} strokeWidth={2.3} className="bmd-searchable-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="bmd-searchable-input"
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
            className="bmd-searchable-clear-inline"
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
          className={`bmd-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmd-searchable-menu">
          <div className="bmd-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`bmd-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="bmd-searchable-option-main">
                  <span className="bmd-searchable-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="bmd-searchable-empty">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmd-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="bmd-searchable-option-main">
                      <span className="bmd-searchable-option-label">{getLabel(o)}</span>
                      {hint && (
                        <span className="bmd-searchable-option-hint">{hint}</span>
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

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function BonMaintenanceDetails({ bonMaintenance, onBack }) {
  const [bon, setBon] = useState(bonMaintenance);
  const [loading, setLoading] = useState(!bonMaintenance);
  const [error, setError] = useState(null);
  const [recalculatingPriorite, setRecalculatingPriorite] = useState(false);
  const [activeTab, setActiveTab] = useState('flow');
  const [reclamations, setReclamations] = useState([]);
  const [loadingReclamations, setLoadingReclamations] = useState(false);
  const [equipement, setEquipement] = useState(null);
  const [dernierControle, setDernierControle] = useState(null);
  const [derniereRemiseEnService, setDerniereRemiseEnService] = useState(null);
  const [intervenantsFlow, setIntervenantsFlow] = useState([]);
  const [loadingIntervenantsFlow, setLoadingIntervenantsFlow] = useState(false);
  const [historiqueFlow, setHistoriqueFlow] = useState([]);
  const [slaInfo, setSlaInfo] = useState(null);
  const [loadingSla, setLoadingSla] = useState(false);
  const [showSlaDetail, setShowSlaDetail] = useState(false);
  const [coutInfo, setCoutInfo] = useState(null);
  const [loadingCout, setLoadingCout] = useState(false);
  const [showCoutDetail, setShowCoutDetail] = useState(false);

  const [rcaAnalyses, setRcaAnalyses] = useState([]);
  const [loadingRca, setLoadingRca] = useState(false);
  const [showRcaPanel, setShowRcaPanel] = useState(false);
  const [savingRca, setSavingRca] = useState(false);
  const [majActionId, setMajActionId] = useState(null);
  const [rcaForm, setRcaForm] = useState({
    probleme: '',
    methode: 'CINQ_POURQUOI',
    causeRacine: '',
    analyseDetaillee: '',
    auteur: '',
    actions: [nouvelleActionVide()],
  });
  const [expandedSections, setExpandedSections] = useState({
    reclamation: true,
    bon: true,
    equipement: true,
    interventions: true,
    controle: true,
    remiseService: true,
    historique: false
  });

  useEffect(() => {
    if (!bonMaintenance || !bonMaintenance.id) {
      setLoading(false);
      return;
    }

    const loadBonDetails = async () => {
      setLoading(true);
      try {
        const bonDetails = await bonMaintenanceService.getById(bonMaintenance.id);
        setBon(bonDetails);
      } catch (err) {
        console.error('Erreur chargement détails du bon:', err);
        setError('Impossible de charger les détails du bon de maintenance.');
        setBon(bonMaintenance);
      } finally {
        setLoading(false);
      }
    };

    loadBonDetails();
  }, [bonMaintenance]);

  useEffect(() => {
    if (!bon?.id) {
      setSlaInfo(null);
      return;
    }
    setLoadingSla(true);
    slaService.getPourBon(bon.id)
      .then(setSlaInfo)
      .catch((err) => {
        console.error('Erreur chargement SLA :', err);
        setSlaInfo(null);
      })
      .finally(() => setLoadingSla(false));
  }, [bon?.id]);

  useEffect(() => {
    if (!bon?.id) {
      setCoutInfo(null);
      return;
    }
    setLoadingCout(true);
    coutService.getPourBon(bon.id)
      .then(setCoutInfo)
      .catch((err) => {
        console.error('Erreur chargement coût :', err);
        setCoutInfo(null);
      })
      .finally(() => setLoadingCout(false));
  }, [bon?.id]);

  const chargerRca = useCallback(() => {
    if (!bon?.id) {
      setRcaAnalyses([]);
      return;
    }
    setLoadingRca(true);
    rcaCapaService.getParBon(bon.id)
      .then((data) => setRcaAnalyses(data ?? []))
      .catch((err) => {
        console.error('Erreur chargement RCA/CAPA :', err);
        setRcaAnalyses([]);
      })
      .finally(() => setLoadingRca(false));
  }, [bon?.id]);

  useEffect(() => { chargerRca(); }, [chargerRca]);

  const handleRcaFormChange = (champ, valeur) => {
    setRcaForm((f) => ({ ...f, [champ]: valeur }));
  };

  const handleRcaActionChange = (index, champ, valeur) => {
    setRcaForm((f) => {
      const actions = [...f.actions];
      actions[index] = { ...actions[index], [champ]: valeur };
      return { ...f, actions };
    });
  };

  const handleRcaAjouterLigneAction = () => {
    setRcaForm((f) => ({ ...f, actions: [...f.actions, nouvelleActionVide()] }));
  };

  const handleRcaSupprimerLigneAction = (index) => {
    setRcaForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== index) }));
  };

  const handleRcaSubmit = async () => {
    if (!rcaForm.probleme.trim() || !rcaForm.causeRacine.trim()) {
      alert('Le problème et la cause racine sont obligatoires.');
      return;
    }
    setSavingRca(true);
    try {
      const actionsValides = rcaForm.actions
        .filter((a) => a.description.trim())
        .map((a) => ({
          type: a.type,
          description: a.description,
          responsable: a.responsable || null,
          dateEcheance: a.dateEcheance ? new Date(a.dateEcheance).toISOString() : null,
        }));

      await rcaCapaService.creerAnalyse({
        bonMaintenanceId: bon.id,
        lotArticleImmobilistationId: bon.lotArticleImmobilistationId,
        probleme: rcaForm.probleme,
        methode: rcaForm.methode,
        causeRacine: rcaForm.causeRacine,
        analyseDetaillee: rcaForm.analyseDetaillee || null,
        auteur: rcaForm.auteur || null,
        actions: actionsValides,
      });

      setRcaForm({
        probleme: '', methode: 'CINQ_POURQUOI', causeRacine: '', analyseDetaillee: '', auteur: '',
        actions: [nouvelleActionVide()],
      });
      chargerRca();
    } catch (err) {
      console.error('Erreur création analyse RCA :', err);
      alert("Impossible d'enregistrer l'analyse RCA.");
    } finally {
      setSavingRca(false);
    }
  };

  const handleMajStatutAction = async (actionId, statut) => {
    setMajActionId(actionId);
    try {
      await rcaCapaService.majStatutAction(actionId, { statut });
      chargerRca();
    } catch (err) {
      console.error('Erreur mise à jour statut action CAPA :', err);
      alert("Impossible de mettre à jour le statut de l'action.");
    } finally {
      setMajActionId(null);
    }
  };

  const handleRecalculerPriorite = async () => {
    if (!bon?.id) return;
    setRecalculatingPriorite(true);
    try {
      const updated = await bonMaintenanceService.recalculerPriorite(bon.id);
      setBon(updated);
    } catch (err) {
      console.error('Erreur recalcul priorité :', err);
    } finally {
      setRecalculatingPriorite(false);
    }
  };

  useEffect(() => {
    if (!bonMaintenance || !bonMaintenance.id) return;

    const loadReclamations = async () => {
      setLoadingReclamations(true);
      try {
        const data = await reclamationBonMaintenanceService.getReclamationsByBonMaintenance(bonMaintenance.id);
        setReclamations(data || []);
      } catch (err) {
        console.error('Erreur chargement réclamations:', err);
      } finally {
        setLoadingReclamations(false);
      }
    };

    loadReclamations();
  }, [bonMaintenance]);

  useEffect(() => {
    if (!bon?.lotArticleImmobilistationId) {
      setEquipement(null);
      return;
    }
    lotArticleImmobilistationService.getById(bon.lotArticleImmobilistationId)
      .then(setEquipement)
      .catch((err) => {
        console.error('Erreur chargement équipement :', err);
        setEquipement(null);
      });
  }, [bon?.lotArticleImmobilistationId]);

  useEffect(() => {
    if (!bonMaintenance?.id) return;

    bonMaintenanceControleEquipementService.getByBonMaintenance(bonMaintenance.id)
      .then((data) => setDernierControle((data ?? [])[0] ?? null))
      .catch((err) => {
        console.error('Erreur chargement contrôle :', err);
        setDernierControle(null);
      });

    bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bonMaintenance.id)
      .then((data) => setDerniereRemiseEnService((data ?? [])[0] ?? null))
      .catch((err) => {
        console.error('Erreur chargement remise en service :', err);
        setDerniereRemiseEnService(null);
      });
  }, [bonMaintenance?.id]);

  useEffect(() => {
    if (!bonMaintenance?.id) return;

    setLoadingIntervenantsFlow(true);
    bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenance.id)
      .then((data) => setIntervenantsFlow(data ?? []))
      .catch((err) => {
        console.error('Erreur chargement intervenants :', err);
        setIntervenantsFlow([]);
      })
      .finally(() => setLoadingIntervenantsFlow(false));
  }, [bonMaintenance?.id]);

  useEffect(() => {
    if (!bonMaintenance?.id) return;

    bonMaintenanceHistoriqueService.findByBonMaintenanceId(bonMaintenance.id)
      .then((data) => setHistoriqueFlow(data ?? []))
      .catch((err) => {
        console.error('Erreur chargement historique :', err);
        setHistoriqueFlow([]);
      });
  }, [bonMaintenance?.id]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderEtatBadge = (etat) => {
    const Icon = getEtatIcon(etat);
    return (
      <span className={`bmd-badge-etat ${getEtatClass(etat)}`}>
        <Icon size={14} />
        {getEtatLabel(etat)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bmd-container">
        <div className="bmd-loading">
          <Loader2 size={40} className="spinner" />
          <p>Chargement des détails du bon...</p>
        </div>
      </div>
    );
  }

  if (error || !bon) {
    return (
      <div className="bmd-container">
        <div className="bmd-error">
          <AlertCircle size={40} />
          <p>{error || 'Bon non trouvé'}</p>
          <button onClick={onBack} className="bmd-back-btn">
            <ArrowLeft size={18} />
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  const historique = historiqueFlow;
  const reclamation = reclamations.length > 0 ? reclamations[0] : null;

  return (
    <div className="bmd-container">
      {/* HEADER */}
      <div className="bmd-header">
        <div className="bmd-header-left">
          <h2>
            {bon.num || `Bon #${bon.id}`}
            {renderEtatBadge(bon.etat)}
          </h2>
          <p>{bon.titre || 'Sans titre'}</p>
        </div>
        <div className="bmd-header-right">
          <button
            className={`bmd-sla-btn ${slaGlobalClass(slaInfo)}`}
            onClick={() => setShowSlaDetail((v) => !v)}
            disabled={loadingSla}
            title="Voir le détail SLA (délais de réponse et de résolution)"
          >
            <Clock size={16} />
            {loadingSla ? 'SLA...' : slaInfo
              ? `SLA : ${SLA_STATUT_LABELS[slaInfo.statutReponse] || '—'} / ${SLA_STATUT_LABELS[slaInfo.statutResolution] || '—'}`
              : 'SLA'}
            <ChevronDown size={14} className={`bmd-sla-btn__chevron ${showSlaDetail ? 'is-open' : ''}`} />
          </button>
          <button
            className="bmd-cout-btn"
            onClick={() => setShowCoutDetail((v) => !v)}
            disabled={loadingCout}
            title="Voir le détail du coût (main d'œuvre, pièces, achats)"
          >
            <ClipboardList size={16} />
            {loadingCout ? 'Coût...' : coutInfo ? `Coût : ${formatMontant(coutInfo.coutTotal)}` : 'Coût'}
            <ChevronDown size={14} className={`bmd-sla-btn__chevron ${showCoutDetail ? 'is-open' : ''}`} />
          </button>
          <button
            className={`bmd-rca-btn ${rcaGlobalClass(rcaAnalyses)}`}
            onClick={() => setShowRcaPanel((v) => !v)}
            disabled={loadingRca}
            title="Analyse RCA et actions CAPA"
          >
            <Search size={16} />
            {loadingRca ? 'RCA...' : rcaAnalyses.length === 0 ? 'RCA/CAPA' : `RCA/CAPA (${rcaAnalyses[0].actions?.length || 0})`}
            <ChevronDown size={14} className={`bmd-sla-btn__chevron ${showRcaPanel ? 'is-open' : ''}`} />
          </button>
          <button className="bmd-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
            Retour
          </button>
        </div>
      </div>

      {showSlaDetail && (
        <div className="bmd-sla-panel">
          {!slaInfo ? (
            <p className="bmd-sla-panel__empty">Aucune donnée SLA disponible pour ce bon.</p>
          ) : slaInfo.statutReponse === 'NON_APPLICABLE' ? (
            <p className="bmd-sla-panel__empty">
              SLA non applicable (priorité non calculée, ou bon annulé).
            </p>
          ) : (
            <div className="bmd-sla-panel__grid">
              <div className="bmd-sla-panel__col">
                <span className="bmd-sla-panel__title">Délai de réponse</span>
                <span className={`bmd-sla-statut ${SLA_STATUT_CLASS[slaInfo.statutReponse] || ''}`}>
                  {SLA_STATUT_LABELS[slaInfo.statutReponse] || slaInfo.statutReponse}
                </span>
                <span className="bmd-sla-panel__detail">
                  Cible : {formatDureeHeures(slaInfo.delaiReponseCibleHeures)}
                  {slaInfo.delaiReponseReelHeures != null && (
                    <> · Réel : {formatDureeHeures(slaInfo.delaiReponseReelHeures)}</>
                  )}
                </span>
                {!slaInfo.delaiReponseReelHeures && slaInfo.echeanceReponse && (
                  <span className="bmd-sla-panel__echeance">Échéance : {formatDateTime(slaInfo.echeanceReponse)}</span>
                )}
              </div>
              <div className="bmd-sla-panel__col">
                <span className="bmd-sla-panel__title">Délai de résolution</span>
                <span className={`bmd-sla-statut ${SLA_STATUT_CLASS[slaInfo.statutResolution] || ''}`}>
                  {SLA_STATUT_LABELS[slaInfo.statutResolution] || slaInfo.statutResolution}
                </span>
                <span className="bmd-sla-panel__detail">
                  Cible : {formatDureeHeures(slaInfo.delaiResolutionCibleHeures)}
                  {slaInfo.delaiResolutionReelHeures != null && (
                    <> · Réel : {formatDureeHeures(slaInfo.delaiResolutionReelHeures)}</>
                  )}
                </span>
                {!slaInfo.delaiResolutionReelHeures && slaInfo.echeanceResolution && (
                  <span className="bmd-sla-panel__echeance">Échéance : {formatDateTime(slaInfo.echeanceResolution)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showCoutDetail && (
        <div className="bmd-cout-panel">
          {!coutInfo ? (
            <p className="bmd-sla-panel__empty">Aucune donnée de coût disponible pour ce bon.</p>
          ) : (
            <div className="bmd-cout-panel__grid">
              <div className="bmd-cout-panel__item">
                <span className="bmd-sla-panel__title">Main d'œuvre</span>
                <span className="bmd-cout-panel__valeur">{formatMontant(coutInfo.coutMainOeuvre)}</span>
              </div>
              <div className="bmd-cout-panel__item">
                <span className="bmd-sla-panel__title">Pièces dépôt</span>
                <span className="bmd-cout-panel__valeur">{formatMontant(coutInfo.coutPiecesDepot)}</span>
              </div>
              <div className="bmd-cout-panel__item">
                <span className="bmd-sla-panel__title">Achats fournisseur</span>
                <span className="bmd-cout-panel__valeur">{formatMontant(coutInfo.coutAchats)}</span>
              </div>
              <div className="bmd-cout-panel__item bmd-cout-panel__item--total">
                <span className="bmd-sla-panel__title">Total</span>
                <span className="bmd-cout-panel__valeur bmd-cout-panel__valeur--total">{formatMontant(coutInfo.coutTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {showRcaPanel && (
        <div className="bmd-rca-panel">
          {loadingRca ? (
            <p className="bmd-sla-panel__empty">Chargement...</p>
          ) : rcaAnalyses.length > 0 ? (
            rcaAnalyses.map((analyse) => (
              <div key={analyse.id} className="bmd-rca-analyse">
                <div className="bmd-rca-analyse__header">
                  <span className="bmd-rca-methode-pill">{METHODE_RCA_LABELS[analyse.methode] || analyse.methode}</span>
                  <span className="bmd-rca-analyse__meta">
                    {analyse.auteur ? `${analyse.auteur} · ` : ''}{formatDateTime(analyse.dateAnalyse)}
                  </span>
                </div>

                <div className="bmd-rca-analyse__champ">
                  <span className="bmd-sla-panel__title">Problème constaté</span>
                  <p>{analyse.probleme}</p>
                </div>
                <div className="bmd-rca-analyse__champ">
                  <span className="bmd-sla-panel__title">Cause racine</span>
                  <p>{analyse.causeRacine}</p>
                </div>
                {analyse.analyseDetaillee && (
                  <div className="bmd-rca-analyse__champ">
                    <span className="bmd-sla-panel__title">Analyse détaillée</span>
                    <p className="bmd-rca-analyse__detail">{analyse.analyseDetaillee}</p>
                  </div>
                )}

                {analyse.actions?.length > 0 && (
                  <div className="bmd-rca-actions">
                    <span className="bmd-sla-panel__title">Actions CAPA</span>
                    <ul className="bmd-rca-actions__list">
                      {analyse.actions.map((action) => (
                        <li key={action.id} className={`bmd-rca-action ${action.enRetard ? 'is-retard' : ''}`}>
                          <div className="bmd-rca-action__top">
                            <span className="bmd-rca-type-pill">{TYPE_ACTION_LABELS[action.type] || action.type}</span>
                            <span className="bmd-rca-action__desc">{action.description}</span>
                          </div>
                          <div className="bmd-rca-action__bottom">
                            <span className="bmd-rca-action__meta">
                              {action.responsable ? `${action.responsable} · ` : ''}
                              {action.dateEcheance ? `Échéance ${formatDate(action.dateEcheance)}` : 'Sans échéance'}
                              {action.enRetard && <span className="bmd-rca-retard-tag"> · En retard</span>}
                            </span>
                            <select
                              className={`bmd-capa-statut-select ${STATUT_ACTION_CLASS[action.statut] || ''}`}
                              value={action.statut}
                              disabled={majActionId === action.id}
                              onChange={(e) => handleMajStatutAction(action.id, e.target.value)}
                            >
                              {Object.entries(STATUT_ACTION_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bmd-rca-form">
              <p className="bmd-rca-form__intro">
                Aucune analyse RCA pour ce bon. Documenter la cause racine évite de traiter
                seulement le symptôme.
              </p>

              <label className="bmd-rca-form__label">Problème constaté *</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={2}
                value={rcaForm.probleme}
                onChange={(e) => handleRcaFormChange('probleme', e.target.value)}
                placeholder="Ex : la pompe tombe en panne toutes les 2 semaines depuis 3 mois"
              />

              <div className="bmd-rca-form__row">
                <div className="bmd-rca-form__col">
                  <label className="bmd-rca-form__label">Méthode</label>
                  <select
                    className="bmd-rca-form__select"
                    value={rcaForm.methode}
                    onChange={(e) => handleRcaFormChange('methode', e.target.value)}
                  >
                    {Object.entries(METHODE_RCA_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="bmd-rca-form__col">
                  <label className="bmd-rca-form__label">Auteur</label>
                  <input
                    type="text"
                    className="bmd-rca-form__input"
                    value={rcaForm.auteur}
                    onChange={(e) => handleRcaFormChange('auteur', e.target.value)}
                    placeholder="Nom de l'analyste"
                  />
                </div>
              </div>

              <label className="bmd-rca-form__label">Cause racine *</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={2}
                value={rcaForm.causeRacine}
                onChange={(e) => handleRcaFormChange('causeRacine', e.target.value)}
                placeholder="La cause profonde identifiée, pas le symptôme"
              />

              <label className="bmd-rca-form__label">Analyse détaillée (optionnel)</label>
              <textarea
                className="bmd-rca-form__textarea"
                rows={3}
                value={rcaForm.analyseDetaillee}
                onChange={(e) => handleRcaFormChange('analyseDetaillee', e.target.value)}
                placeholder="Les 5 pourquoi enchaînés, ou les notes du diagramme Ishikawa"
              />

              <div className="bmd-rca-form__actions-header">
                <span className="bmd-rca-form__label">Actions CAPA</span>
                <button type="button" className="bmd-rca-form__add-btn" onClick={handleRcaAjouterLigneAction}>
                  + Ajouter une action
                </button>
              </div>

              {rcaForm.actions.map((action, index) => (
                <div key={index} className="bmd-rca-form__action-row">
                  <select
                    className="bmd-rca-form__select bmd-rca-form__select--type"
                    value={action.type}
                    onChange={(e) => handleRcaActionChange(index, 'type', e.target.value)}
                  >
                    {Object.entries(TYPE_ACTION_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="bmd-rca-form__input bmd-rca-form__input--desc"
                    placeholder="Description de l'action"
                    value={action.description}
                    onChange={(e) => handleRcaActionChange(index, 'description', e.target.value)}
                  />
                  <input
                    type="text"
                    className="bmd-rca-form__input bmd-rca-form__input--resp"
                    placeholder="Responsable"
                    value={action.responsable}
                    onChange={(e) => handleRcaActionChange(index, 'responsable', e.target.value)}
                  />
                  <input
                    type="date"
                    className="bmd-rca-form__input bmd-rca-form__input--date"
                    value={action.dateEcheance}
                    onChange={(e) => handleRcaActionChange(index, 'dateEcheance', e.target.value)}
                  />
                  {rcaForm.actions.length > 1 && (
                    <button
                      type="button"
                      className="bmd-rca-form__remove-btn"
                      onClick={() => handleRcaSupprimerLigneAction(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="bmd-rca-form__submit-btn"
                onClick={handleRcaSubmit}
                disabled={savingRca}
              >
                {savingRca ? 'Enregistrement...' : "Enregistrer l'analyse RCA"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* META STRIP */}
      <div className="bmd-meta-strip">
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Service</span>
          <span className="bmd-meta-value">{bon.serviceNom || bon.service?.description || '—'}</span>
        </div>
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Dépôt</span>
          <span className="bmd-meta-value">{bon.depotNom || bon.depot?.codeDepots || '—'}</span>
        </div>
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Clinique</span>
          <span className="bmd-meta-value">{bon.cliniqueNom || bon.clinique?.nom || '—'}</span>
        </div>
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Urgence</span>
          <span className="bmd-meta-value">
            <span className={`bmd-urgence-badge urgence-${bon.urgence || 0}`}>
              {bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : 'Non définie'}
            </span>
          </span>
        </div>
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Priorité</span>
          <span className="bmd-meta-value">
            <span className={`bmd-urgence-badge priorite-color-${prioriteColor(bon.priorite)}`}>
              {prioriteLabel(bon.priorite)}
            </span>
          </span>
        </div>
        <div className="bmd-meta-item">
          <span className="bmd-meta-label">Date</span>
          <span className="bmd-meta-value">{formatDate(bon.date)}</span>
        </div>

        {reclamations.length > 0 && (
          <div className="bmd-meta-item">
            <span className="bmd-meta-label">Réclamation(s)</span>
            <span className="bmd-meta-value">
              {reclamations.map(r => r.num || `#${r.id}`).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* TABS — Segmented Control */}
      <div className="bmd-tabs">
        {TABS.map((tab, index) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`bmd-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
            >
              <span className="bmd-tab-num">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="bmd-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PANEL */}
      <div className="bmd-panel">
        {activeTab === 'flow' && (
          <FlowTab
            bon={bon}
            reclamation={reclamation}
            reclamations={reclamations}
            equipement={equipement}
            interventions={intervenantsFlow}
            loadingInterventions={loadingIntervenantsFlow}
            controle={dernierControle}
            remiseService={derniereRemiseEnService}
            historique={historique}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            loadingReclamations={loadingReclamations}
            handleRecalculerPriorite={handleRecalculerPriorite}
            recalculatingPriorite={recalculatingPriorite}
          />
        )}
        {activeTab === 'diagnostic' && <DiagnosticTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} />}
        {activeTab === 'taches' && <TachesTab bonMaintenanceId={bon.id} />}
        {activeTab === 'intervenants' && <IntervenantsTab bonMaintenanceId={bon.id} />}
        {activeTab === 'documents' && <DocumentsTab bonMaintenanceId={bon.id} />}
        {activeTab === 'controle' && <ControleEquipementTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} />}
        {activeTab === 'remiseEnService' && <RemiseEnServiceTab bonMaintenanceId={bon.id} defaultLotArticleImmobilistationId={bon.lotArticleImmobilistationId} />}
        {activeTab === 'commentaires' && <CommentairesTab bonMaintenanceId={bon.id} />}
        {activeTab === 'historique' && <HistoriqueTab bonMaintenanceId={bon.id} />}
      </div>
    </div>
  );
}

// ============================================================
// ONGLET FLOW
// ============================================================
function FlowTab({
  bon,
  reclamation,
  reclamations,
  equipement,
  interventions,
  loadingInterventions,
  controle,
  remiseService,
  historique,
  expandedSections,
  toggleSection,
  loadingReclamations,
  handleRecalculerPriorite,
  recalculatingPriorite
}) {
  const renderStepConnector = () => (
    <div className="bmd-flow-connector">
      <ChevronDown size={18} className="connector-arrow" />
    </div>
  );

  const renderStepIcon = (type) => {
    const icons = {
      reclamation: { icon: AlertCircle, class: 'reclamation' },
      bon: { icon: FileText, class: 'bon' },
      equipement: { icon: Building2, class: 'equipement' },
      intervention: { icon: Activity, class: 'intervention' },
      controle: { icon: CheckCircle, class: 'controle' },
      remise: { icon: RotateCcw, class: 'remise' },
    };
    const { icon: Icon, class: className } = icons[type] || icons.bon;
    return (
      <div className={`bmd-flow-icon ${className}`}>
        <Icon size={20} />
      </div>
    );
  };

  const renderEtatBadge = (etat) => {
    const Icon = getEtatIcon(etat);
    return (
      <span className={`bmd-badge-etat ${getEtatClass(etat)}`}>
        <Icon size={12} />
        {getEtatLabel(etat)}
      </span>
    );
  };

  return (
    <div className="bmd-flow-container">
      <div className="bmd-flow-title">
        <Workflow size={24} className="text-primary" />
        <div>
          <h3>Chaîne de traitement</h3>
        </div>
      </div>

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('reclamation')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('reclamation')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 1</span>
              <h4>Réclamation</h4>
              {reclamation && <span className="bmd-flow-subtitle">{reclamation.num || 'REC-XXXX'}</span>}
              {reclamations.length > 1 && (
                <span className="bmd-flow-subtitle badge-multiple">
                  +{reclamations.length - 1} autre(s)
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.reclamation ? '−' : '+'}
          </button>
        </div>
        {expandedSections.reclamation && (
          <div className="bmd-flow-content">
            {loadingReclamations ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> Chargement...</p>
            ) : reclamations.length === 0 ? (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> Aucune réclamation associée
              </p>
            ) : (
              <div className="bmd-flow-details">
                {reclamations.map((r, index) => (
                  <div key={r.id} className="bmd-reclamation-item">
                    <div className="bmd-reclamation-header">
                      <span className="bmd-reclamation-num">#{index + 1}</span>
                      <span className="bmd-reclamation-title">{r.num || `REC-${r.id}`}</span>
                      {r.priorite && (
                        <span className={`priorite-badge priorite-${r.priorite}`}>
                          {r.priorite === 1 ? 'Basse' : r.priorite === 2 ? 'Moyenne' : 'Haute'}
                        </span>
                      )}
                    </div>
                    <div className="bmd-reclamation-details">
                      <div className="detail-row">
                        <span className="detail-label">Date</span>
                        <span className="detail-value">{formatDate(r.date)}</span>
                      </div>
                      {r.description && (
                        <div className="detail-row">
                          <span className="detail-label">Description</span>
                          <span className="detail-value">{r.description}</span>
                        </div>
                      )}
                      {r.statut && (
                        <div className="detail-row">
                          <span className="detail-label">Statut</span>
                          <span className="detail-value">{r.statut}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step active">
        <div className="bmd-flow-header" onClick={() => toggleSection('bon')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('bon')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 2</span>
              <h4>Bon de Maintenance</h4>
              <span className="bmd-flow-subtitle">{bon.num || 'BM-XXXX'} • {renderEtatBadge(bon.etat)}</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.bon ? '−' : '+'}
          </button>
        </div>
        {expandedSections.bon && (
          <div className="bmd-flow-content">
            <div className="bmd-flow-details">
              <div className="detail-row">
                <span className="detail-label">Titre</span>
                <span className="detail-value">{bon.titre || 'Sans titre'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Description</span>
                <span className="detail-value">{bon.description || 'Aucune description'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Urgence</span>
                <span className="detail-value">
                  <span className={`bmd-urgence-badge urgence-${bon.urgence || 0}`}>
                    {bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : 'Non définie'}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Priorité</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`bmd-urgence-badge priorite-color-${prioriteColor(bon.priorite)}`}>
                    {prioriteLabel(bon.priorite)}
                  </span>
                  <button
                    type="button"
                    className="bmd-icon-btn"
                    title="Recalculer la priorité (criticité + urgence + disponibilité d'alternative)"
                    onClick={handleRecalculerPriorite}
                    disabled={recalculatingPriorite}
                  >
                    <RefreshCw size={14} className={recalculatingPriorite ? 'spin' : ''} />
                  </button>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Prestataire</span>
                <span className="detail-value">{bon.prestataire?.raisonSociale || bon.prestataire?.nom || 'Non spécifié'}</span>
              </div>
              {bon.sousTraitant && (
                <div className="detail-row">
                  <span className="detail-label">Sous-traitant</span>
                  <span className="detail-value">{bon.sousTraitant}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('equipement')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('equipement')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 3</span>
              <h4>Équipement</h4>
              {equipement && <span className="bmd-flow-subtitle">{equipement.designation || 'N/A'}</span>}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.equipement ? '−' : '+'}
          </button>
        </div>
        {expandedSections.equipement && (
          <div className="bmd-flow-content">
            {equipement ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">Désignation</span>
                  <span className="detail-value">{equipement.designation || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Marque</span>
                  <span className="detail-value">{equipement.marque || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Modèle</span>
                  <span className="detail-value">{equipement.modele || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">N° pièce</span>
                  <span className="detail-value">{equipement.numPiece || 'N/A'}</span>
                </div>
                {equipement.codeBarre && (
                  <div className="detail-row">
                    <span className="detail-label">Code-barre</span>
                    <span className="detail-value">{equipement.codeBarre}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> Aucun équipement associé
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('interventions')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('intervention')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 4</span>
              <h4>Interventions</h4>
              <span className="bmd-flow-subtitle">{interventions.length} intervention(s)</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.interventions ? '−' : '+'}
          </button>
        </div>
        {expandedSections.interventions && (
          <div className="bmd-flow-content">
            {loadingInterventions ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> Chargement...</p>
            ) : interventions.length > 0 ? (
              <div className="bmd-flow-details">
                {interventions.map((intervention, index) => {
                  const nomIntervenant = intervention.personnel
                    ? `${intervention.personnel.nom} ${intervention.personnel.prenom}`
                    : (intervention.sousTraitant?.raisonSociale
                        || intervention.intervenantNom
                        || `Intervenant #${intervention.id}`);
                  return (
                    <div key={intervention.id ?? index} className="bmd-intervention-item">
                      <div className="bmd-intervention-header">
                        <span className="bmd-intervention-num">#{index + 1}</span>
                        <span className="bmd-intervention-titre">{nomIntervenant}</span>
                        {intervention.nbrHeure != null && (
                          <span className="bmd-intervention-duree">
                            <Clock size={14} />
                            {intervention.nbrHeure}h
                          </span>
                        )}
                      </div>
                      {intervention.commentaire && (
                        <p className="bmd-intervention-description">{intervention.commentaire}</p>
                      )}
                      <div className="bmd-intervention-meta">
                        {intervention.dateDebutIntervention && (
                          <span><Calendar size={14} /> {formatDateTime(intervention.dateDebutIntervention)} → {formatDateTime(intervention.dateFinIntervention)}</span>
                        )}
                        {intervention.etat != null && (
                          <span className={`intervention-statut statut-${intervention.etat}`}>
                            {INTERVENANT_ETAT_LABELS[intervention.etat] || `État ${intervention.etat}`}
                          </span>
                        )}
                        {intervention.coutUnitaire != null && intervention.nbrHeure != null && (
                          <span>{(Number(intervention.coutUnitaire) * Number(intervention.nbrHeure)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> Aucune intervention enregistrée
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('controle')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('controle')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 5</span>
              <h4>Contrôle</h4>
              {controle && (
                <span className={`bmd-flow-subtitle ${controle.conforme ? 'conforme' : 'non-conforme'}`}>
                  {controle.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> Conforme</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> Non conforme</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.controle ? '−' : '+'}
          </button>
        </div>
        {expandedSections.controle && (
          <div className="bmd-flow-content">
            {controle ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">Statut</span>
                  <span className={`detail-value ${controle.conforme ? 'text-success' : 'text-danger'}`}>
                    {controle.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> Conforme</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> Non conforme</>
                    )}
                  </span>
                </div>
                {controle.dateControle && (
                  <div className="detail-row">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDateTime(controle.dateControle)}</span>
                  </div>
                )}
                {controle.personnelNom && (
                  <div className="detail-row">
                    <span className="detail-label">Contrôleur</span>
                    <span className="detail-value">{controle.personnelNom}</span>
                  </div>
                )}
                {controle.typeControle && (
                  <div className="detail-row">
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{controle.typeControle}</span>
                  </div>
                )}
                {controle.valeurMesuree != null && (
                  <div className="detail-row">
                    <span className="detail-label">Valeur mesurée</span>
                    <span className="detail-value">{controle.valeurMesuree}</span>
                  </div>
                )}
                {controle.valeurAttendue != null && (
                  <div className="detail-row">
                    <span className="detail-label">Valeur attendue</span>
                    <span className="detail-value">{controle.valeurAttendue}</span>
                  </div>
                )}
                {controle.resultat && (
                  <div className="detail-row">
                    <span className="detail-label">Résultat</span>
                    <span className="detail-value">{controle.resultat}</span>
                  </div>
                )}
                {controle.observations && (
                  <div className="detail-row">
                    <span className="detail-label">Observations</span>
                    <span className="detail-value">{controle.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> Contrôle non encore effectué
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('remiseService')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('remise')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">Étape 6</span>
              <h4>Remise en service</h4>
              {remiseService && (
                <span className={`bmd-flow-subtitle ${remiseService.conforme ? 'effectuee' : 'non-effectuee'}`}>
                  {remiseService.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> Autorisée</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> Refusée</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.remiseService ? '−' : '+'}
          </button>
        </div>
        {expandedSections.remiseService && (
          <div className="bmd-flow-content">
            {remiseService ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">Statut</span>
                  <span className={`detail-value ${remiseService.conforme ? 'text-success' : 'text-danger'}`}>
                    {remiseService.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> Autorisée</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> Refusée</>
                    )}
                  </span>
                </div>
                {remiseService.date && (
                  <div className="detail-row">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDateTime(remiseService.date)}</span>
                  </div>
                )}
                {remiseService.autoriseParNom && (
                  <div className="detail-row">
                    <span className="detail-label">Autorisé par</span>
                    <span className="detail-value">{remiseService.autoriseParNom}</span>
                  </div>
                )}
                {remiseService.etatApres != null && (
                  <div className="detail-row">
                    <span className="detail-label">État après</span>
                    <span className="detail-value">
                      {ETAT_IMMOBILISATION_OPTIONS.find(o => o.value === remiseService.etatApres)?.label || 'N/A'}
                    </span>
                  </div>
                )}
                {remiseService.observations && (
                  <div className="detail-row">
                    <span className="detail-label">Observations</span>
                    <span className="detail-value">{remiseService.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> Remise en service non encore effectuée
              </p>
            )}
          </div>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bmd-flow-historique">
          <div className="bmd-flow-header" onClick={() => toggleSection('historique')}>
            <div className="bmd-flow-header-left">
              <div className="bmd-flow-icon historique">
                <Clock size={20} />
              </div>
              <div className="bmd-flow-header-text">
                <h4>Historique</h4>
                <span className="bmd-flow-subtitle">{historique.length} événement(s)</span>
              </div>
            </div>
            <button className="bmd-flow-toggle">
              {expandedSections.historique ? '−' : '+'}
            </button>
          </div>
          {expandedSections.historique && (
            <div className="bmd-flow-content">
              <div className="bmd-timeline">
                {historique.map((event, index) => (
                  <div key={index} className="bmd-timeline-item">
                    <div className="bmd-timeline-dot"></div>
                    <div className="bmd-timeline-content">
                      <div className="bmd-timeline-header">
                        <span className="bmd-timeline-date">{formatDateTime(event.date)}</span>
                        <span className="bmd-timeline-action">{event.action || event.type}</span>
                      </div>
                      {event.description && (
                        <p className="bmd-timeline-description">{event.description}</p>
                      )}
                      {event.utilisateur && (
                        <span className="bmd-timeline-user">
                          <User size={12} />
                          {event.utilisateur}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ONGLET DIAGNOSTIC
// ============================================================
const emptyDiagnosticForm = {
  personnelId: '', observations: '', besoinPiece: '',
  prestataireArticlesId: '', qteNecessaire: '', sousTraitantId: '',
  lotArticleImmobilistationId: '', bonMaintenancePieceImmoId: '',
  causeProbable: '', gravite: '', dureeEstimeeHeures: '',
};

function DiagnosticTab({ bonMaintenanceId, defaultLotArticleImmobilistationId }) {
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [piecesImmo, setPiecesImmo] = useState([]);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState(emptyDiagnosticForm);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [lastPersonnelId, setLastPersonnelId] = useState('');

  const [immoQteDisponible, setImmoQteDisponible] = useState(null);
  const [checkingImmoQte, setCheckingImmoQte] = useState(false);

  const [articleQteDisponible, setArticleQteDisponible] = useState(null);
  const [checkingArticleQte, setCheckingArticleQte] = useState(false);

  const openForm = () => {
    setForm({
      ...emptyDiagnosticForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      personnelId: lastPersonnelId,
    });
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceDiagnosticService.getByBonMaintenance(bonMaintenanceId);
      setDiagnostics(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    if (!form.lotArticleImmobilistationId) {
      setImmoQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingImmoQte(true);
    lotArticleImmobilistationService.getById(form.lotArticleImmobilistationId)
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
  }, [form.lotArticleImmobilistationId]);

  useEffect(() => {
    if (!form.prestataireArticlesId) {
      setArticleQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingArticleQte(true);
    pieceLigneService.getQuantiteDisponible(form.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setArticleQteDisponible(qte); })
      .catch(() => { if (!cancelled) setArticleQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingArticleQte(false); });
    return () => { cancelled = true; };
  }, [form.prestataireArticlesId]);

  useEffect(() => {
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(console.error);
    bonMaintenancePieceImmoService.findByBonMaintenanceId(bonMaintenanceId).then((data) => setPiecesImmo(data ?? [])).catch(console.error);
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();

    if (form.besoinPiece === 'true') {
      warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qteNecessaire, 'quantité nécessaire');
    }

    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      const besoinPieceBool = form.besoinPiece === '' ? null : form.besoinPiece === 'true';
      await bonMaintenanceDiagnosticService.create({
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        personnelNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        observations: form.observations.trim() || null,
        besoinPiece: besoinPieceBool,
        prestataireArticlesId: besoinPieceBool && form.prestataireArticlesId !== '' ? Number(form.prestataireArticlesId) : null,
        qteNecessaire: besoinPieceBool && form.qteNecessaire !== '' ? Number(form.qteNecessaire) : null,
        sousTraitantId: besoinPieceBool && form.sousTraitantId !== '' ? Number(form.sousTraitantId) : null,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
        bonMaintenancePieceImmoId: form.bonMaintenancePieceImmoId === '' ? null : Number(form.bonMaintenancePieceImmoId),
        causeProbable: form.causeProbable.trim() || null,
        gravite: form.gravite === '' ? null : Number(form.gravite),
        dureeEstimeeHeures: form.dureeEstimeeHeures === '' ? null : Number(form.dureeEstimeeHeures),
      });
      setLastPersonnelId(form.personnelId);
      setForm(emptyDiagnosticForm);
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du diagnostic.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer le diagnostic',
      message: 'Supprimer ce diagnostic ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceDiagnosticService.remove(id);
          setDiagnostics((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Diagnostics</h3>
          <span className="bmd-panel-count">{diagnostics.length}</span>
        </div>
        <button className="bmd-add-btn" onClick={() => (showForm ? setShowForm(false) : openForm())}>
          <Plus size={16} />
          {showForm ? 'Annuler' : 'Ajouter un diagnostic'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="personnelId"
            value={form.personnelId}
            onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
            options={personnels}
            placeholder="Rechercher un technicien..."
            emptyMessage="Aucun technicien ne correspond"
            allowEmpty
            emptyOptionLabel="— Technicien —"
            getValue={(p) => p.id}
            getLabel={(p) => `${p.nom || ''} ${p.prenom || ''}`.trim()}
            getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
          />

          <SearchableSelect
            name="lotArticleImmobilistationId"
            value={form.lotArticleImmobilistationId}
            onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
            options={immobilisations}
            placeholder="Rechercher une immobilisation..."
            emptyMessage="Aucune immobilisation ne correspond"
            allowEmpty
            emptyOptionLabel="— Immobilisation diagnostiquée —"
            getValue={(i) => i.id}
            getLabel={(i) => i.designation || `#${i.id}`}
            getOptionHint={(i) => (i.code ? `Code : ${i.code}` : null)}
          />
          {form.lotArticleImmobilistationId && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {checkingImmoQte
                ? 'Vérification du stock...'
                : (immoQteDisponible != null ? `Quantité disponible : ${immoQteDisponible}` : 'Quantité disponible inconnue')}
            </div>
          )}
          {!checkingImmoQte && form.lotArticleImmobilistationId && immoQteDisponible != null && Number(immoQteDisponible) <= 0 && (
            <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              ⚠ Quantité non disponible pour cette immobilisation.
            </div>
          )}

          <select value={form.gravite} onChange={(e) => setForm({ ...form, gravite: e.target.value })}>
            <option value="">— Gravité —</option>
            <option value="1">Faible</option>
            <option value="2">Moyenne</option>
            <option value="3">Élevée</option>
          </select>

          <input
            type="number"
            step="0.5"
            placeholder="Durée estimée (heures)"
            value={form.dureeEstimeeHeures}
            onChange={(e) => setForm({ ...form, dureeEstimeeHeures: e.target.value })}
          />

          <select value={form.besoinPiece} onChange={(e) => setForm({ ...form, besoinPiece: e.target.value })}>
            <option value="">— Besoin de pièce ? —</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>

          {form.besoinPiece === 'true' && (
            <>
              <SearchableSelect
                name="prestataireArticlesId"
                value={form.prestataireArticlesId}
                onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
                options={articles}
                placeholder="Rechercher un article..."
                emptyMessage="Aucun article ne correspond"
                allowEmpty
                emptyOptionLabel="— Article nécessaire —"
                getValue={(a) => a.id}
                getLabel={(a) => a.designation || `#${a.id}`}
                getOptionHint={(a) => (a.code ? `Code : ${a.code}` : null)}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Quantité nécessaire"
                value={form.qteNecessaire}
                onChange={(e) => setForm({ ...form, qteNecessaire: e.target.value })}
                onBlur={() => warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qteNecessaire, 'quantité nécessaire')}
              />
              {form.prestataireArticlesId && (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {checkingArticleQte
                    ? 'Vérification du stock...'
                    : (articleQteDisponible != null ? `Quantité disponible : ${articleQteDisponible}` : 'Quantité disponible inconnue')}
                </div>
              )}
              {!checkingArticleQte && form.qteNecessaire !== '' && articleQteDisponible != null && Number(form.qteNecessaire) > Number(articleQteDisponible) && (
                <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                  ⚠ Quantité demandée ({form.qteNecessaire}) supérieure à la quantité disponible ({articleQteDisponible}).
                </div>
              )}
              <SearchableSelect
                name="sousTraitantId"
                value={form.sousTraitantId}
                onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
                options={prestataires}
                placeholder="Rechercher un sous-traitant..."
                emptyMessage="Aucun sous-traitant ne correspond"
                allowEmpty
                emptyOptionLabel="— Sous-traitant (requis pour Commander) —"
                getValue={(p) => p.id}
                getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || `#${p.id}`}
                getOptionHint={(p) => (p.code ? `Code : ${p.code}` : null)}
              />
            </>
          )}

          <input
            type="text"
            placeholder="Cause probable"
            value={form.causeProbable}
            onChange={(e) => setForm({ ...form, causeProbable: e.target.value })}
            style={{ gridColumn: '1 / -1' }}
          />

          <textarea
            placeholder="Observations..."
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            rows={2}
            style={{ gridColumn: '1 / -1' }}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : diagnostics.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun diagnostic pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {diagnostics.map((d) => {
            const immobilisation = immobilisations.find((i) => i.id === d.lotArticleImmobilistationId);
            const articleNecessaire = articles.find((a) => a.id === d.prestataireArticlesId);
            const sousTraitant = prestataires.find((p) => p.id === d.sousTraitantId);
            return (
              <li key={d.id} className="bmd-list-item">
                <div>
                  <span className="bmd-item-title">
                    {d.personnelNom || (d.personnelId != null ? `Technicien #${d.personnelId}` : 'Technicien non renseigné')}
                    {' — '}
                    {d.besoinPiece ? 'Besoin de pièce' : 'Pas de pièce nécessaire'}
                    {d.gravite != null ? ` · Gravité ${GRAVITE_LABELS[d.gravite] || d.gravite}` : ''}
                  </span>
                  <span className="bmd-item-sub">
                    {formatDateTime(d.dateDiagnostic)}
                    {immobilisation ? ` · ${immobilisation.designation}` : ''}
                    {d.besoinPiece && d.prestataireArticlesId != null
                      ? ` · ${articleNecessaire?.designation || `Article #${d.prestataireArticlesId}`}${d.qteNecessaire != null ? ` (Qté ${d.qteNecessaire})` : ''}`
                      : ''}
                    {d.besoinPiece && d.sousTraitantId != null
                      ? ` · Sous-traitant : ${sousTraitant?.raisonSociale || `#${d.sousTraitantId}`}`
                      : ''}
                    {d.causeProbable ? ` · Cause probable : ${d.causeProbable}` : ''}
                    {d.dureeEstimeeHeures != null ? ` · ${d.dureeEstimeeHeures} h estimées` : ''}
                    {d.observations ? ` · ${d.observations}` : ''}
                  </span>
                </div>
                <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET CONTRÔLE
// ============================================================
const emptyControleForm = {
  personnelId: '', typeControle: '', resultat: '', valeurMesuree: '', valeurAttendue: '',
  conforme: '', observations: '', lotArticleImmobilistationId: '',
};

function ControleEquipementTab({ bonMaintenanceId, defaultLotArticleImmobilistationId }) {
  const [controles, setControles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [form, setForm] = useState(emptyControleForm);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [lastPersonnelId, setLastPersonnelId] = useState('');

  const openForm = () => {
    setForm({
      ...emptyControleForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      personnelId: lastPersonnelId,
    });
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceControleEquipementService.getByBonMaintenance(bonMaintenanceId);
      setControles(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      await bonMaintenanceControleEquipementService.create({
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        personnelNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        typeControle: form.typeControle || null,
        resultat: form.resultat.trim() || null,
        valeurMesuree: form.valeurMesuree === '' ? null : Number(form.valeurMesuree),
        valeurAttendue: form.valeurAttendue === '' ? null : Number(form.valeurAttendue),
        conforme: form.conforme === '' ? null : form.conforme === 'true',
        observations: form.observations.trim() || null,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
      });
      setLastPersonnelId(form.personnelId);
      setForm(emptyControleForm);
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du contrôle.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer le contrôle',
      message: 'Supprimer ce contrôle ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceControleEquipementService.remove(id);
          setControles((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Contrôles équipement</h3>
          <span className="bmd-panel-count">{controles.length}</span>
        </div>
        <button className="bmd-add-btn" onClick={() => (showForm ? setShowForm(false) : openForm())}>
          <Plus size={16} />
          {showForm ? 'Annuler' : 'Ajouter un contrôle'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="personnelId"
            value={form.personnelId}
            onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
            options={personnels}
            placeholder="Rechercher un technicien..."
            emptyMessage="Aucun technicien ne correspond"
            allowEmpty
            emptyOptionLabel="— Technicien —"
            getValue={(p) => p.id}
            getLabel={(p) => `${p.nom || ''} ${p.prenom || ''}`.trim()}
            getOptionHint={(p) => (p.matricule ? `Matricule : ${p.matricule}` : null)}
          />

          <SearchableSelect
            name="lotArticleImmobilistationId"
            value={form.lotArticleImmobilistationId}
            onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
            options={immobilisations}
            placeholder="Rechercher une immobilisation..."
            emptyMessage="Aucune immobilisation ne correspond"
            allowEmpty
            emptyOptionLabel="— Immobilisation contrôlée —"
            getValue={(i) => i.id}
            getLabel={(i) => i.designation || `#${i.id}`}
          />

          <select value={form.typeControle} onChange={(e) => setForm({ ...form, typeControle: e.target.value })}>
            <option value="">— Type de contrôle —</option>
            {TYPE_CONTROLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={form.conforme} onChange={(e) => setForm({ ...form, conforme: e.target.value })}>
            <option value="">— Conforme ? —</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>

          <input
            type="number" step="0.01" placeholder="Valeur mesurée"
            value={form.valeurMesuree} onChange={(e) => setForm({ ...form, valeurMesuree: e.target.value })}
          />
          <input
            type="number" step="0.01" placeholder="Valeur attendue"
            value={form.valeurAttendue} onChange={(e) => setForm({ ...form, valeurAttendue: e.target.value })}
          />

          <input
            type="text" placeholder="Résultat" value={form.resultat}
            onChange={(e) => setForm({ ...form, resultat: e.target.value })}
            style={{ gridColumn: '1 / -1' }}
          />

          <textarea
            placeholder="Observations..." value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            rows={2} style={{ gridColumn: '1 / -1' }}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : controles.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun contrôle pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {controles.map((c) => {
            const immobilisation = immobilisations.find((i) => i.id === c.lotArticleImmobilistationId);
            return (
              <li key={c.id} className="bmd-list-item">
                <div>
                  <span className="bmd-item-title">
                    {c.typeControle || 'Contrôle'}
                    {' — '}
                    <span className={c.conforme ? 'bmd-item-status success' : 'bmd-item-status danger'}>
                      {c.conforme ? <><CheckCircle size={14} className="text-success" /> Conforme</> : c.conforme === false ? <><XCircle size={14} className="text-danger" /> Non conforme</> : 'Résultat non renseigné'}
                    </span>
                  </span>
                  <span className="bmd-item-sub">
                    {formatDateTime(c.dateControle)}
                    {c.personnelNom ? ` · ${c.personnelNom}` : ''}
                    {immobilisation ? ` · ${immobilisation.designation}` : ''}
                    {c.valeurMesuree != null ? ` · Mesuré ${c.valeurMesuree}` : ''}
                    {c.valeurAttendue != null ? ` (attendu ${c.valeurAttendue})` : ''}
                    {c.resultat ? ` · ${c.resultat}` : ''}
                    {c.observations ? ` · ${c.observations}` : ''}
                  </span>
                </div>
                <button className="bmd-delete-btn" onClick={() => handleDelete(c.id)}>
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET REMISE EN SERVICE
// ============================================================
const emptyRemiseForm = {
  lotArticleImmobilistationId: '', conforme: '', autoriseParId: '', observations: '',
  etatAvant: '', etatApres: '',
};

function RemiseEnServiceTab({ bonMaintenanceId, defaultLotArticleImmobilistationId }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [form, setForm] = useState(emptyRemiseForm);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [lastAutoriseParId, setLastAutoriseParId] = useState('');

  const openForm = () => {
    setForm({
      ...emptyRemiseForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      autoriseParId: lastAutoriseParId,
    });
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bonMaintenanceId);
      setDecisions(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (form.conforme === '') {
      alert('Merci de préciser si la remise en service est autorisée ou non.');
      return;
    }
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.autoriseParId));
      await bonMaintenanceRemiseEnServiceService.create({
        bonMaintenanceId,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
        conforme: form.conforme === 'true',
        autoriseParId: form.autoriseParId === '' ? null : Number(form.autoriseParId),
        autoriseParNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        observations: form.observations.trim() || null,
        etatAvant: form.etatAvant === '' ? null : Number(form.etatAvant),
        etatApres: form.etatApres === '' ? null : Number(form.etatApres),
      });
      setLastAutoriseParId(form.autoriseParId);
      setForm(emptyRemiseForm);
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement de la décision.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer la décision',
      message: 'Supprimer cette décision de remise en service ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceRemiseEnServiceService.remove(id);
          setDecisions((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Remise en service</h3>
          <span className="bmd-panel-count">{decisions.length}</span>
        </div>
        <button className="bmd-add-btn" onClick={() => (showForm ? setShowForm(false) : openForm())}>
          <Plus size={16} />
          {showForm ? 'Annuler' : 'Ajouter une décision'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="lotArticleImmobilistationId"
            value={form.lotArticleImmobilistationId}
            onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
            options={immobilisations}
            placeholder="Rechercher une immobilisation..."
            emptyMessage="Aucune immobilisation ne correspond"
            allowEmpty
            emptyOptionLabel="— Immobilisation concernée —"
            getValue={(i) => i.id}
            getLabel={(i) => i.designation || `#${i.id}`}
          />

          <SearchableSelect
            name="autoriseParId"
            value={form.autoriseParId}
            onChange={(e) => setForm({ ...form, autoriseParId: e.target.value })}
            options={personnels}
            placeholder="Rechercher..."
            emptyMessage="Aucun personnel ne correspond"
            allowEmpty
            emptyOptionLabel="— Autorisé par —"
            getValue={(p) => p.id}
            getLabel={(p) => `${p.nom || ''} ${p.prenom || ''}`.trim()}
          />

          <select value={form.conforme} onChange={(e) => setForm({ ...form, conforme: e.target.value })}>
            <option value="">— Autoriser la remise en service ? * —</option>
            <option value="true">Oui, conforme — autorisé</option>
            <option value="false">Non — refusé</option>
          </select>

          <select value={form.etatApres} onChange={(e) => setForm({ ...form, etatApres: e.target.value })}>
            <option value="">— État de l'immobilisation après —</option>
            {ETAT_IMMOBILISATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <textarea
            placeholder="Observations..." value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            rows={2} style={{ gridColumn: '1 / -1' }}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
            {saving ? 'Enregistrement...' : 'Enregistrer la décision'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : decisions.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucune décision de remise en service pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {decisions.map((d) => {
            const immobilisation = immobilisations.find((i) => i.id === d.lotArticleImmobilistationId);
            return (
              <li key={d.id} className="bmd-list-item">
                <div>
                  <span className="bmd-item-title">
                    {d.conforme ? <><CheckCircle size={14} className="text-success" /> Remise en service autorisée</> : <><XCircle size={14} className="text-danger" /> Remise en service refusée</>}
                  </span>
                  <span className="bmd-item-sub">
                    {formatDateTime(d.date)}
                    {d.autoriseParNom ? ` · Par ${d.autoriseParNom}` : ''}
                    {immobilisation ? ` · ${immobilisation.designation}` : ''}
                    {d.observations ? ` · ${d.observations}` : ''}
                  </span>
                </div>
                <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET TÂCHES
// ============================================================
const emptyTacheForm = {
  designation: '', ordre: '', dateDebut: '', dateFin: '',
  prestataireArticlesId: '', qte: '', sousTraitantId: '',
};

function TachesTab({ bonMaintenanceId }) {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState(emptyTacheForm);
  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const [tacheQteDisponible, setTacheQteDisponible] = useState(null);
  const [checkingTacheQte, setCheckingTacheQte] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceTacheService.getByBonMaintenance(bonMaintenanceId);
      setTaches(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!form.prestataireArticlesId) {
      setTacheQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingTacheQte(true);
    pieceLigneService.getQuantiteDisponible(form.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setTacheQteDisponible(qte); })
      .catch(() => { if (!cancelled) setTacheQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingTacheQte(false); });
    return () => { cancelled = true; };
  }, [form.prestataireArticlesId]);

  const resetForm = () => {
    setForm(emptyTacheForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t) => {
    setForm({
      designation: t.designation || '',
      ordre: t.ordre ?? '',
      dateDebut: t.dateDebut ? t.dateDebut.slice(0, 16) : '',
      dateFin: t.dateFin ? t.dateFin.slice(0, 16) : '',
      prestataireArticlesId: t.prestataireArticlesId ?? '',
      qte: t.qte ?? '',
      sousTraitantId: t.sousTraitantId ?? '',
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.designation.trim()) return;

    warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qte, 'quantité');

    setSaving(true);
    try {
      const payload = {
        bonMaintenanceId,
        designation: form.designation.trim(),
        ordre: form.ordre === '' ? null : Number(form.ordre),
        dateDebut: form.dateDebut || null,
        dateFin: form.dateFin || null,
        prestataireArticlesId: form.prestataireArticlesId === '' ? null : Number(form.prestataireArticlesId),
        qte: form.qte === '' ? null : Number(form.qte),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
      };

      if (editingId) {
        await bonMaintenanceTacheService.update(editingId, payload);
      } else {
        await bonMaintenanceTacheService.create(payload);
      }

      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      alert(editingId ? "Échec de la modification de la tâche." : "Échec de l'ajout de la tâche.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer la tâche',
      message: 'Supprimer cette tâche ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceTacheService.remove(id);
          setTaches((prev) => prev.filter((t) => t.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Tâches</h3>
          <span className="bmd-panel-count">{taches.length}</span>
        </div>
        <button className="bmd-add-btn" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          <Plus size={16} />
          {showForm ? 'Annuler' : 'Ajouter une tâche'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleSubmit}>
          <input
            type="text" placeholder="Désignation *" value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })} required autoFocus
          />
          <input
            type="number" placeholder="Ordre" value={form.ordre}
            onChange={(e) => setForm({ ...form, ordre: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateDebut}
            onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateFin}
            onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
          />
          <SearchableSelect
            name="prestataireArticlesId"
            value={form.prestataireArticlesId}
            onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
            options={articles}
            placeholder="Rechercher un article..."
            emptyMessage="Aucun article ne correspond"
            allowEmpty
            emptyOptionLabel="— Article lié —"
            getValue={(a) => a.id}
            getLabel={(a) => a.designation || `#${a.id}`}
            getOptionHint={(a) => (a.code ? `Code : ${a.code}` : null)}
          />
          <input
            type="number" placeholder="Quantité" value={form.qte}
            onChange={(e) => setForm({ ...form, qte: e.target.value })}
            onBlur={() => warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qte, 'quantité')}
          />
          {form.prestataireArticlesId && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {checkingTacheQte
                ? 'Vérification du stock...'
                : (tacheQteDisponible != null ? `Quantité disponible : ${tacheQteDisponible}` : 'Quantité disponible inconnue')}
            </div>
          )}
          {!checkingTacheQte && form.qte !== '' && tacheQteDisponible != null && Number(form.qte) > Number(tacheQteDisponible) && (
            <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              ⚠ Quantité demandée ({form.qte}) supérieure à la quantité disponible ({tacheQteDisponible}).
            </div>
          )}
          <SearchableSelect
            name="sousTraitantId"
            value={form.sousTraitantId}
            onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
            options={prestataires}
            placeholder="Rechercher un sous-traitant..."
            emptyMessage="Aucun sous-traitant ne correspond"
            allowEmpty
            emptyOptionLabel="— Sous-traitant —"
            getValue={(p) => p.id}
            getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || `#${p.id}`}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
            {saving ? 'Enregistrement...' : (editingId ? 'Mettre à jour' : 'Ajouter')}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : taches.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucune tâche pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {taches.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((t) => (
            <li key={t.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">{t.ordre != null ? `${t.ordre}. ` : ''}{t.designation}</span>
                <span className="bmd-item-sub">
                  {formatDateTime(t.dateDebut)} → {formatDateTime(t.dateFin)}
                  {t.prestataireArticlesId != null
                    ? ` · ${articles.find((a) => String(a.id) === String(t.prestataireArticlesId))?.designation || `Article #${t.prestataireArticlesId}`}`
                    : ''}
                  {t.qte != null ? ` · Qté ${t.qte}` : ''}
                  {t.sousTraitant?.raisonSociale ? ` · ${t.sousTraitant.raisonSociale}` : (t.sousTraitantId != null ? ` · Sous-traitant #${t.sousTraitantId}` : '')}
                </span>
              </div>
              <div className="bmd-item-actions">
                <button className="bmd-edit-btn" onClick={() => startEdit(t)}>
                  <Edit size={14} />
                </button>
                <button className="bmd-delete-btn" onClick={() => handleDelete(t.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET INTERVENANTS
// ============================================================
function IntervenantsTab({ bonMaintenanceId }) {
  const [intervenants, setIntervenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState({
    personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '',
    nbrHeure: '', coutUnitaire: '', commentaire: '',
  });

  const [expandedHistoId, setExpandedHistoId] = useState(null);
  const [historiqueParIntervenant, setHistoriqueParIntervenant] = useState({});
  const [loadingHistoId, setLoadingHistoId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenanceId);
      setIntervenants(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    if (!showForm) return;
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, [showForm]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bonMaintenanceIntervenantService.create({
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
        dateDebutIntervention: form.dateDebutIntervention || null,
        dateFinIntervention: form.dateFinIntervention || null,
        nbrHeure: form.nbrHeure === '' ? null : Number(form.nbrHeure),
        coutUnitaire: form.coutUnitaire === '' ? null : Number(form.coutUnitaire),
        commentaire: form.commentaire.trim() || null,
      });
      setForm({ personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '', nbrHeure: '', coutUnitaire: '', commentaire: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout de l'intervenant.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: "Supprimer l'intervenant",
      message: 'Supprimer cet intervenant ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceIntervenantService.remove(id);
          setIntervenants((prev) => prev.filter((i) => i.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  const toggleHistorique = async (intervenantId) => {
    if (expandedHistoId === intervenantId) {
      setExpandedHistoId(null);
      return;
    }
    setExpandedHistoId(intervenantId);
    if (!historiqueParIntervenant[intervenantId]) {
      setLoadingHistoId(intervenantId);
      try {
        const data = await bonMaintenanceIntervenantHistoriqueService.getByIntervenant(intervenantId);
        setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: data ?? [] }));
      } catch (err) {
        console.error(err);
        setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: [] }));
      } finally {
        setLoadingHistoId(null);
      }
    }
  };

  const coutTotal = intervenants.reduce((total, i) => {
    const cout = Number(i.coutUnitaire) || 0;
    const heures = Number(i.nbrHeure) || 0;
    return total + cout * heures;
  }, 0);

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Intervenants</h3>
          <span className="bmd-panel-count">{intervenants.length}</span>
          {coutTotal > 0 && (
            <span className="bmd-panel-cout-total">
              Total : {coutTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT
            </span>
          )}
        </div>
        <button className="bmd-add-btn" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} />
          {showForm ? 'Annuler' : 'Ajouter un intervenant'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="personnelId"
            value={form.personnelId}
            onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
            options={personnels}
            placeholder="Rechercher un technicien..."
            emptyMessage="Aucun technicien ne correspond"
            allowEmpty
            emptyOptionLabel="— Technicien interne —"
            getValue={(p) => p.id}
            getLabel={(p) => `${p.nom || ''} ${p.prenom || ''}`.trim()}
          />
          <SearchableSelect
            name="sousTraitantId"
            value={form.sousTraitantId}
            onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
            options={prestataires}
            placeholder="Rechercher un sous-traitant..."
            emptyMessage="Aucun sous-traitant ne correspond"
            allowEmpty
            emptyOptionLabel="— Sous-traitant —"
            getValue={(p) => p.id}
            getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}
          />
          <input
            type="datetime-local" value={form.dateDebutIntervention}
            onChange={(e) => setForm({ ...form, dateDebutIntervention: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateFinIntervention}
            onChange={(e) => setForm({ ...form, dateFinIntervention: e.target.value })}
          />
          <input
            type="number" placeholder="Nb heures" value={form.nbrHeure}
            onChange={(e) => setForm({ ...form, nbrHeure: e.target.value })}
          />
          <input
            type="number" placeholder="Coût unitaire" value={form.coutUnitaire}
            onChange={(e) => setForm({ ...form, coutUnitaire: e.target.value })}
          />
          <input
            type="text" placeholder="Commentaire" value={form.commentaire}
            onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
            style={{ gridColumn: '1 / -1' }}
          />
          <Button type="submit" variant="primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : intervenants.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun intervenant pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {intervenants.map((i) => (
            <li key={i.id} className="bmd-list-item bmd-list-item--stacked">
              <div className="bmd-list-item-row">
                <div>
                  <span className="bmd-item-title">
                    {i.personnel ? `${i.personnel.nom} ${i.personnel.prenom}` : (i.sousTraitant?.raisonSociale || i.intervenantNom || `Intervenant #${i.id}`)}
                  </span>
                  <span className="bmd-item-sub">
                    {formatDateTime(i.dateDebutIntervention)} → {formatDateTime(i.dateFinIntervention)}
                    {i.nbrHeure != null ? ` · ${i.nbrHeure}h` : ''}
                    {i.coutUnitaire != null && i.nbrHeure != null
                      ? ` · ${(Number(i.coutUnitaire) * Number(i.nbrHeure)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`
                      : ''}
                    {i.commentaire ? ` · ${i.commentaire}` : ''}
                  </span>
                </div>
                <div className="bmd-item-actions">
                  <button className="bmd-history-toggle" onClick={() => toggleHistorique(i.id)}>
                    {expandedHistoId === i.id ? 'Masquer historique' : 'Historique'}
                  </button>
                  <button className="bmd-delete-btn" onClick={() => handleDelete(i.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedHistoId === i.id && (
                <div className="bmd-history-panel">
                  {loadingHistoId === i.id ? (
                    <p className="bmd-empty"><Loader2 size={20} className="spinner" /> Chargement...</p>
                  ) : (historiqueParIntervenant[i.id] ?? []).length === 0 ? (
                    <p className="bmd-empty">
                      <Inbox size={20} className="empty-icon" /> Aucun historique pour cet intervenant.
                    </p>
                  ) : (
                    <ul className="bmd-history-list">
                      {historiqueParIntervenant[i.id].map((h) => (
                        <li key={h.id} className="bmd-history-row">
                          <span className="bmd-history-action">{h.action}</span>
                          <span className="bmd-history-date">{formatDateTime(h.date)}</span>
                          <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET DOCUMENTS
// ============================================================
function DocumentsTab({ bonMaintenanceId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pieceId, setPieceId] = useState('');
  const [piecesDisponibles, setPiecesDisponibles] = useState([]);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonMaintenanceId);
      setDocuments(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    pieceService.getAll(0, 200).then((p) => setPiecesDisponibles(p.content ?? [])).catch(console.error);
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!pieceId) return;
    setSaving(true);
    try {
      await bonMaintenanceDocumentAchatService.create({ bonMaintenanceId, pieceId: Number(pieceId) });
      setPieceId('');
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du document.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Retirer le document',
      message: 'Retirer ce document ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceDocumentAchatService.remove(id);
          setDocuments((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Documents d'achat</h3>
          <span className="bmd-panel-count">{documents.length}</span>
        </div>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="pieceId"
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            options={piecesDisponibles}
            placeholder="Rechercher une pièce (MEDSYS)..."
            emptyMessage="Aucune pièce ne correspond"
            getValue={(p) => p.id}
            getLabel={(p) => `${p.numPiece || `#${p.id}`}${p.description ? ` — ${p.description}` : ''}`}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          Impossible de charger les documents d'achat : {loadError}
        </p>
      ) : documents.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun document d'achat pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {documents.map((d) => (
            <li key={d.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' ? 'Commande fournisseur'
                    : d.piece?.codePieceType === '.D_Fourniture' ? 'Demande de fourniture'
                    : (d.piece?.numPiece || `Pièce #${d.pieceId}`)}
                </span>
                <span className="bmd-item-sub">
                  {(d.lignes ?? []).map((l) => {
                    const article = articles.find((a) => String(a.id) === String(l.prestataireArticlesId));
                    return `${article?.designation || `Article #${l.prestataireArticlesId}`} (Qté ${l.qte})`;
                  }).join(', ')}
                  {d.piece?.cibleId != null
                    ? ` · ${prestataires.find((p) => String(p.id) === String(d.piece.cibleId))?.raisonSociale || `Sous-traitant #${d.piece.cibleId}`}`
                    : ''}
                  {d.piece?.description ? ` · ${d.piece.description}` : ''}
                </span>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Retirer"
      />
    </div>
  );
}

// ============================================================
// ONGLET COMMENTAIRES
// ============================================================
function CommentairesTab({ bonMaintenanceId }) {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceCommentaireService.getByBonMaintenance(bonMaintenanceId);
      setCommentaires(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await bonMaintenanceCommentaireService.create({ bonMaintenanceId, commentaire: text.trim() });
      setText('');
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du commentaire.");
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Supprimer le commentaire',
      message: 'Supprimer ce commentaire ? Cette action est irréversible.',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceCommentaireService.remove(id);
          setCommentaires((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        }
      },
    });
  };

  return (
    <div>
      <form className="bmd-comment-form" onSubmit={handleAdd}>
        <textarea
          placeholder="Ajouter un commentaire..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <Button type="submit" variant="primary" disabled={saving || !text.trim()}>
          {saving ? 'Envoi...' : 'Publier'}
        </Button>
      </form>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : commentaires.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun commentaire pour l'instant.
        </p>
      ) : (
        <ul className="bmd-list">
          {commentaires.map((c) => (
            <li key={c.id} className="bmd-list-item bmd-comment-item">
              <div>
                <span className="bmd-item-title">{c.personnelCreation ? `${c.personnelCreation.nom} ${c.personnelCreation.prenom}` : (c.personnelCreationNom || 'Anonyme')}</span>
                <span className="bmd-item-sub">{formatDateTime(c.date)}</span>
                <p className="bmd-comment-text">{c.commentaire}</p>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(c.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Supprimer"
      />
    </div>
  );
}

// ============================================================
// ONGLET HISTORIQUE
// ============================================================
function HistoriqueTab({ bonMaintenanceId }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceHistoriqueService.findByBonMaintenanceId(bonMaintenanceId);
      setHistorique(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>Historique</h3>
          <span className="bmd-panel-count">{historique.length}</span>
        </div>
      </div>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> Chargement...</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          Impossible de charger l'historique : {loadError}
        </p>
      ) : historique.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> Aucun historique pour l'instant.
        </p>
      ) : (
        <ul className="bmd-history-list">
          {historique.map((h) => (
            <li key={h.id} className="bmd-history-row">
              <span className="bmd-history-action">{h.action}</span>
              <span className="bmd-history-date">{formatDateTime(h.date)}</span>
              <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}