import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Link,
  FilePlus,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Building2,
  Calendar
} from 'lucide-react';
import reclamationService from '../../../services/reclamationService';
import ReclamationModal from '../../ui/modals/ReclamationModal';
import ReclamationDetails from './ReclamationDetails';
// ⚠️ Adapte ce chemin au dossier où se trouve BonMaintenanceDetails.jsx
import BonMaintenanceDetails from '../BonMaintenance/BonMaintenanceDetails';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import BonMaintenanceModal from '../../ui/modals/BonMaintenanceModal';
import bonMaintenanceFullService from '../../../services/bonMaintenanceFullService';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';
import { t, locale } from '../../../i18n';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import { STATUTS, TONS, optionsStatut } from '../../../constants/statuts';
import { imprimerListe } from '../../../utils/imprimerListe';
import VuesListe from '../../ui/Listes/VuesListe';
import CartesListe from '../../ui/Listes/CartesListe';
import SelectionMultiple, { CaseSelection } from '../../ui/Listes/SelectionMultiple';
import { useVueActive } from '../../ui/Listes/stockageVues';
import { contexteUtilisateur, vuesReclamations } from '../../ui/Listes/vuesMetier';
import './Reclamations.css';
import './ReclamationsStats.css';

// Barre de statistiques : un compteur par état, mêmes couleurs et icônes que les pastilles
const ETATS_STATS = optionsStatut('reclamation');

// Libellés, couleurs et icônes des états : registre commun (constants/statuts.js)
const ETAT_LABELS = Object.fromEntries(Object.entries(STATUTS.reclamation).map(([k, v]) => [k, v.libelle]));

const NIVEAU_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Élevée',
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ?? t('État {n}', { n: etat });
}

function niveauLabel(niveau) {
  if (niveau == null) return '—';
  return NIVEAU_LABELS[niveau] ?? t('Niveau {n}', { n: niveau });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function personnelLabel(r) {
  return r.personnelAffecte
    ? `${r.personnelAffecte.nom ?? ''} ${r.personnelAffecte.prenom ?? ''}`.trim()
    : (r.personnelAffecteNom || '');
}

/* Colonnes paramétrables (affichage + recherche) */
const RECLAMATION_COLUMNS_DEFAULT = [
  { key: 'num',         label: 'Numéro',            visible: true, searchable: true  },
  { key: 'description', label: 'Description',       visible: true, searchable: true  },
  { key: 'service',     label: 'Service',           visible: true, searchable: false },
  { key: 'criticite',   label: 'Criticité',         visible: true, searchable: false },
  { key: 'urgence',     label: 'Urgence',           visible: true, searchable: false },
  { key: 'personnel',   label: 'Personnel affecté', visible: true, searchable: false },
  { key: 'date',        label: 'Date',              visible: true, searchable: false },
  { key: 'etat',        label: 'État',              visible: true, searchable: false },
];

function getColumnSearchValue(r, key) {
  switch (key) {
    case 'num':         return r.num || '';
    case 'description': return r.description || '';
    case 'service':     return r.serviceNom || r.service?.description || '';
    case 'criticite':   return niveauLabel(r.criticite);
    case 'urgence':     return niveauLabel(r.urgence);
    case 'personnel':   return personnelLabel(r);
    case 'date':        return formatDate(r.date);
    case 'etat':        return etatLabel(r.etat);
    default:            return '';
  }
}

/* Valeurs utilisées pour le tri */
const SORTABLE_COLUMNS = {
  num:         (r) => r.num || '',
  description: (r) => r.description || '',
  service:     (r) => r.serviceNom || r.service?.description || '',
  criticite:   (r) => r.criticite ?? -1,
  urgence:     (r) => r.urgence ?? -1,
  personnel:   (r) => personnelLabel(r),
  date:        (r) => (r.date ? new Date(r.date).getTime() : 0),
  etat:        (r) => r.etat ?? -1,
};

export default function Reclamations() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  // ✅ Tri par défaut : date la plus récente en premier
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Vues de la liste (« Affectées à moi », « Urgentes de mon service »…) et vues enregistrées
  const [moi] = useState(contexteUtilisateur);
  const [vueId, setVueId] = useVueActive('reclamations', moi.cle, 'toutes');
  const vuesListe = useMemo(() => vuesReclamations(moi), [moi]);
  const vueCourante = vuesListe.find((v) => v.id === vueId) || vuesListe[0];
  const choisirVue = (id, reglages) => {
    setVueId(id);
    if (!reglages) return;
    setSearchTerm(reglages.recherche ?? '');
    setEtatFilter(String(reglages.etat ?? 'all'));
    if (reglages.tri) { setSortColumn(reglages.tri); setSortDirection(reglages.sens || 'asc'); }
  };

  const [columnSettings, setColumnSettings] = useState(RECLAMATION_COLUMNS_DEFAULT);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnSettingsInstanceKey, setColumnSettingsInstanceKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [associateOpen, setAssociateOpen] = useState(false);
  const [createBonOpen, setCreateBonOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState(null);
  const [bonOuvert, setBonOuvert] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: t("Confirmer"),
    onConfirm: null,
  });

  const [rejetModal, setRejetModal] = useState({ show: false, motif: '' });

  // Statistiques par état (comme dans « Bons de maintenance »), calculées sur toutes les réclamations
  const [showStats, setShowStats] = useState(true);
  const etatStats = useMemo(() => {
    const stats = {};
    reclamations.forEach((r) => { stats[r.etat] = (stats[r.etat] || 0) + 1; });
    return stats;
  }, [reclamations]);
  const [validating, setValidating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await reclamationService.getAll(0, 100);
      setReclamations(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError(t("Impossible de charger les réclamations. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredReclamations = useMemo(() => {
    const searchableCols = columnSettings.filter((c) => c.searchable).map((c) => c.key);
    const term = searchTerm.trim().toLowerCase();

    const filtered = reclamations.filter((r) => {
      const matchesSearch = !term
        || searchableCols.some((key) => getColumnSearchValue(r, key).toLowerCase().includes(term));

      const matchesEtat = etatFilter === 'all' || String(r.etat) === etatFilter;
      const matchesVue = !vueCourante.filtre || vueCourante.filtre(r);

      return matchesSearch && matchesEtat && matchesVue;
    });

    const extractor = sortColumn ? SORTABLE_COLUMNS[sortColumn] : null;
    if (!extractor) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'fr', { sensitivity: 'base', numeric: true });
      return va - vb;
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [reclamations, searchTerm, etatFilter, columnSettings, sortColumn, sortDirection, vueCourante]);

  const totalPages = Math.max(1, Math.ceil(filteredReclamations.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, etatFilter, sortColumn, sortDirection, vueId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedReclamations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReclamations.slice(start, start + pageSize);
  }, [filteredReclamations, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) {
      range.push(i);
    }
    return range;
  }, [totalPages]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown size={13} className="reclamations-sort-icon" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={13} className="reclamations-sort-icon active" />
      : <ArrowDown size={13} className="reclamations-sort-icon active" />;
  };

  const openColumnSettings = () => {
    setColumnSettingsInstanceKey((k) => k + 1);
    setShowColumnSettings(true);
  };

  const toggleColumnVisibility = (key) => {
    setColumnSettings((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  const toggleColumnSearchability = (key) => {
    setColumnSettings((prev) => prev.map((c) => (c.key === key ? { ...c, searchable: !c.searchable } : c)));
  };

  const visibleColumns = columnSettings.filter((c) => c.visible);

  // Pré-remplissage du bon à partir de la réclamation sélectionnée
  const bonInitialValues = useMemo(() => {
    if (!selectedReclamation) return null;
    const r = selectedReclamation;
    return {
      titre: r.num ? t('Réclamation {num}', { num: r.num }) : t('Réclamation #{id}', { id: r.id }),
      description: r.description || '',
      urgence: r.urgence ?? '',
      lotArticleImmobilistationId: r.lotArticleImmobilistationId ?? '',
    };
  }, [selectedReclamation]);

  const TABLE_COLUMNS_DEF = {
    num: { cell: (r) => <td key="num" style={{ fontWeight: 600 }}>{r.num || '—'}</td> },
    description: { cell: (r) => <td key="description" className="reclamations-desc-cell">{t(r.description)}</td> },
    service: { cell: (r) => <td key="service">{r.serviceNom || r.service?.description || '—'}</td> },
    criticite: { cell: (r) => <td key="criticite">{r.criticite ? <BadgeStatut type="niveau" valeur={r.criticite} taille="petit" /> : '—'}</td> },
    urgence: { cell: (r) => <td key="urgence">{r.urgence ? <BadgeStatut type="niveau" valeur={r.urgence} taille="petit" /> : '—'}</td> },
    personnel: { cell: (r) => <td key="personnel">{personnelLabel(r) || '—'}</td> },
    date: { cell: (r) => <td key="date">{formatDate(r.date)}</td> },
    etat: {
      cell: (r) => (
        <td key="etat">
          <BadgeStatut type="reclamation" valeur={r.etat} />
        </td>
      ),
    },
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
    setVueId('toutes');
  };

  const handleRowClick = (reclamation) => {
    setSelectedReclamation((prev) => (prev?.id === reclamation.id ? null : reclamation));
  };

  const openCreate = () => {
    setSelectedReclamation(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedReclamation) return;
    setModalOpen(true);
  };

  const openAssociate = () => {
    if (!selectedReclamation) return;
    setAssociateOpen(true);
  };

  const openCreateBon = () => {
    if (!selectedReclamation) return;
    setCreateBonOpen(true);
  };

  /**
   * Crée le bon de maintenance (avec ses enfants éventuels) puis le lie
   * automatiquement à la réclamation sélectionnée.
   */
  const handleCreateBon = async (payload, children) => {
    if (!selectedReclamation) return;
    const result = await bonMaintenanceFullService.createFull(payload, children || {});
    const bon = result.bonMaintenance;

    try {
      await reclamationBonMaintenanceService.link(selectedReclamation.id, bon.id);
    } catch (err) {
      console.error(err);
      alert(t('Le bon {num} a été créé, mais son association à la réclamation a échoué. Utilisez le bouton « Associer » pour le lier manuellement.', { num: bon.num || `#${bon.id}` }));
    }

    if (result.errors.length > 0) {
      const summary = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
      alert(t("Le bon a été créé, mais {n} élément(s) n'ont pas pu être ajoutés :", { n: result.errors.length }) + `\n${summary}`);
    }

    await apresAction();
  };

  const rechargerDetails = async (id, { silencieux = false } = {}) => {
    if (!silencieux) {
      setDetailsLoading(true);
      setDetailsData(null);
    }
    try {
      const data = await reclamationService.getWithBonMaintenance(id);
      setDetailsData(data);
      // Garde la sélection à jour (les actions Valider / Rejeter / Modifier s'appuient dessus)
      const rec = data?.reclamation ?? data;
      if (rec?.id) setSelectedReclamation(rec);
    } catch (err) {
      console.error('Erreur chargement des détails :', err);
      alert(t("Impossible de charger les détails de cette réclamation."));
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openDetails = async (reclamation = selectedReclamation) => {
    if (!reclamation) return;
    setSelectedReclamation(reclamation);
    setDetailsOpen(true);
    await rechargerDetails(reclamation.id);
  };

  // Lien direct /reclamations?id=12 (QR code d'une fiche, notification)
  const [parametres, setParametres] = useSearchParams();
  const idLien = Number(parametres.get('id')) || null;

  const fermerDetails = () => {
    setDetailsOpen(false);
    setDetailsData(null);
    setSelectedReclamation(null);
    if (parametres.has('id')) setParametres({}, { replace: true });
  };

  // Ouvre la réclamation du lien direct
  useEffect(() => {
    if (idLien) openDetails({ id: idLien });
    // openDetails est recréée à chaque rendu : on ne réagit qu'au changement d'identifiant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idLien]);


  // Après une action : sur la page de détail on la rafraîchit, sur la liste on désélectionne
  const apresAction = async () => {
    await load();
    if (detailsOpen && selectedReclamation) {
      await rechargerDetails(selectedReclamation.id, { silencieux: true });
    } else {
      setSelectedReclamation(null);
    }
  };

  const handleSave = async (payload) => {
    let saved;
    if (selectedReclamation) {
      saved = await reclamationService.update(selectedReclamation.id, payload);
    } else {
      saved = await reclamationService.create(payload);
      if (saved.bonMaintenanceId) {
        alert(t('Réclamation créée. Bon de maintenance associé généré (id {id}).', { id: saved.bonMaintenanceId }));
      }
    }

    await apresAction();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false, error: null, confirming: false }));

  const handleDelete = () => {
    if (!selectedReclamation || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: t("Supprimer la réclamation"),
      message: t('Supprimer la réclamation « {num} » ? Cette action est irréversible.', { num: selectedReclamation.num || selectedReclamation.id }),
      confirmText: t("Supprimer"),
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await reclamationService.remove(selectedReclamation.id);
          setReclamations((prev) => prev.filter((r) => r.id !== selectedReclamation.id));
          setSelectedReclamation(null);
          setDetailsOpen(false);
          setDetailsData(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression de cette réclamation."));
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  /* ── Sélection multiple (cases à cocher) pour supprimer plusieurs réclamations d'un coup ── */
  const [coches, setCoches] = useState(() => new Set());
  const [derniereCoche, setDerniereCoche] = useState(null);
  // On ne garde que les réclamations encore présentes (après suppression, rechargement…)
  const cochesValides = useMemo(() => reclamations.filter((r) => coches.has(r.id)).map((r) => r.id), [reclamations, coches]);
  const basculerCoche = (rec, index, plage) => {
    setCoches((prev) => {
      const suite = new Set(prev);
      const cocher = !prev.has(rec.id);
      // Maj+clic : coche (ou décoche) toute la plage depuis la dernière case cliquée
      if (plage && derniereCoche != null) {
        const [a, b] = [Math.min(derniereCoche, index), Math.max(derniereCoche, index)];
        paginatedReclamations.slice(a, b + 1).forEach((x) => (cocher ? suite.add(x.id) : suite.delete(x.id)));
      } else if (cocher) suite.add(rec.id);
      else suite.delete(rec.id);
      return suite;
    });
    setDerniereCoche(index);
  };
  const pageCochee = paginatedReclamations.length > 0 && paginatedReclamations.every((r) => coches.has(r.id));
  const pagePartielle = !pageCochee && paginatedReclamations.some((r) => coches.has(r.id));
  const basculerPage = () => setCoches((prev) => {
    const suite = new Set(prev);
    paginatedReclamations.forEach((r) => (pageCochee ? suite.delete(r.id) : suite.add(r.id)));
    return suite;
  });
  const toutCocher = () => setCoches(new Set(filteredReclamations.map((r) => r.id)));
  const viderCoches = () => { setCoches(new Set()); setDerniereCoche(null); };

  // Confirmation puis suppression ; en cas d'échec partiel, « Réessayer » ne reprend que les restantes
  const demanderSuppression = (ids, erreur = null) => {
    const apercu = reclamations.filter((r) => ids.includes(r.id)).slice(0, 5).map((r) => r.num || `#${r.id}`).join(', ');
    setConfirmModal({
      show: true,
      type: 'danger',
      title: ids.length === 1 ? t('Supprimer la réclamation') : t('Supprimer {n} réclamations', { n: ids.length }),
      message: ids.length === 1
        ? t('Supprimer la réclamation « {num} » ? Cette action est irréversible.', { num: apercu })
        : `${t('Supprimer les {n} réclamations sélectionnées ? Cette action est irréversible.', { n: ids.length })} (${apercu}${ids.length > 5 ? '…' : ''})`,
      confirmText: erreur ? t('Réessayer') : t('Supprimer la sélection'),
      error: erreur,
      confirming: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
        setIsDeleting(true);
        try {
          const resultats = await Promise.allSettled(ids.map((id) => reclamationService.remove(id)));
          const supprimees = ids.filter((_, i) => resultats[i].status === 'fulfilled');
          const echecs = ids.filter((_, i) => resultats[i].status === 'rejected');
          setReclamations((prev) => prev.filter((r) => !supprimees.includes(r.id)));
          if (selectedReclamation && supprimees.includes(selectedReclamation.id)) {
            setSelectedReclamation(null);
            setDetailsOpen(false);
            setDetailsData(null);
          }
          setCoches(new Set(echecs)); // les réclamations non supprimées restent cochées
          if (echecs.length === 0) {
            closeConfirmModal();
          } else {
            const raison = resultats.find((r) => r.status === 'rejected')?.reason?.response?.data?.message;
            demanderSuppression(
              echecs,
              t('Supprimées : {ok} · non supprimées : {ko} (elles restent cochées).', { ok: supprimees.length, ko: echecs.length }) + (raison ? ` ${raison}` : ''),
            );
          }
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteSelection = () => {
    if (!cochesValides.length || isDeleting) return;
    demanderSuppression(cochesValides);
  };

  const handleValider = async () => {
    if (!selectedReclamation || validating) return;
    setValidating(true);
    try {
      const updated = await reclamationService.valider(selectedReclamation.id, {});
      // Sur la page de détail, le parcours se met à jour : pas besoin d'alerte
      if (!detailsOpen) {
        alert(updated.bonMaintenanceId
          ? t('Réclamation validée. Bon de maintenance lié (id {id}).', { id: updated.bonMaintenanceId })
          : 'Réclamation validée.');
      }
      await apresAction();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec de la validation.');
    } finally {
      setValidating(false);
    }
  };

  const openRejetModal = () => {
    if (!selectedReclamation) return;
    setRejetModal({ show: true, motif: '' });
  };

  const confirmRejeter = async () => {
    const motif = rejetModal.motif.trim();
    if (!motif || !selectedReclamation) return;
    setRejetModal({ show: false, motif: '' });
    setValidating(true);
    try {
      await reclamationService.rejeter(selectedReclamation.id, { motifRejet: motif });
      await apresAction();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Échec du rejet.');
    } finally {
      setValidating(false);
    }
  };

  // Données du tableau filtré, partagées par l'export CSV et l'impression
  const donneesTableau = () => {
    const entetes = ['Numéro', 'Description', 'Criticité', 'Urgence', 'Personnel affecté', 'Date', 'État'].map((e) => t(e));
    const lignes = filteredReclamations.map((r) => [
      r.num || '',
      (r.description || ''),
      t(niveauLabel(r.criticite)),
      t(niveauLabel(r.urgence)),
      personnelLabel(r),
      formatDate(r.date),
      t(etatLabel(r.etat)),
    ]);
    return { entetes, lignes };
  };

  const handleExportExcel = () => {
    const { entetes, lignes } = donneesTableau();

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${String(cellule ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `reclamations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  // Impression : document mis en page (en-tête, filtres, tableau, pages numérotées)
  const handleImprimerListe = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Réclamations'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Vue'), valeur: vueCourante.filtre ? t(vueCourante.label) : '' },
        { label: t('Recherche'), valeur: searchTerm.trim() },
        { label: t('État'), valeur: etatFilter !== 'all' ? t(etatLabel(Number(etatFilter))) : '' },
      ],
    });
  };

  const handleStats = () => setShowStats((v) => !v);

  // Un bon ouvert depuis la page de détail s'affiche en plein écran, avec retour vers la réclamation
  if (bonOuvert) {
    return (
      <BonMaintenanceDetails
        bonMaintenance={bonOuvert}
        onBack={() => {
          setBonOuvert(null);
          if (selectedReclamation) rechargerDetails(selectedReclamation.id, { silencieux: true });
        }}
      />
    );
  }

  return (
    <>
    {detailsOpen ? (
      <ReclamationDetails
        data={detailsData}
        loading={detailsLoading}
        validating={validating}
        onBack={fermerDetails}
        onModifier={openEdit}
        onValider={handleValider}
        onRejeter={openRejetModal}
        onCreerBon={openCreateBon}
        onAssocier={openAssociate}
        onOuvrirBon={(bon) => setBonOuvert(bon)}
      />
    ) : (
    <div className="reclamations-container">

      <div className="reclamations-header-card">
        <div className="reclamations-header-title-box">
          <button
            type="button"
            className="reclamations-header-icon reclamations-header-icon-btn"
            onClick={openColumnSettings}
            title={t("Paramètres des colonnes")}
            aria-label={t("Paramètres des colonnes")}
          >
            <AlertCircle size={24} />
          </button>
          <div>
            <h2>{t("Réclamations")}</h2>
            <p className="reclamations-header-subtitle">
              {t("Gestion des réclamations")}
            </p>
          </div>
        </div>
        <div className="reclamations-header-stats">
          <span className="reclamations-badge-total">{t("Total :")} {filteredReclamations.length}</span>
          <button
            type="button"
            className={`reclamations-toggle-stats ${showStats ? 'is-actif' : ''}`}
            onClick={() => setShowStats((v) => !v)}
            title={showStats ? t('Masquer les statistiques') : t('Afficher les statistiques')}
            aria-label={showStats ? t('Masquer les statistiques') : t('Afficher les statistiques')}
            aria-pressed={showStats}
          >
            <BarChart3 size={18} />
          </button>
        </div>
      </div>

      {showStats && (
        <div className="reclamations-stats-bar" role="group" aria-label={t('Réclamations par état')}>
          {ETATS_STATS.map((option) => {
            const count = etatStats[option.valeur] || 0;
            const total = reclamations.length || 1;
            const percentage = Math.round((count / total) * 100);
            const valeur = String(option.valeur);
            const isActive = etatFilter === valeur;
            const couleur = TONS[option.ton].couleur;
            const Icone = option.Icone;
            return (
              <button
                type="button"
                key={valeur}
                className={`reclamations-stat-item ${isActive ? 'active' : ''}`}
                onClick={() => setEtatFilter(isActive ? 'all' : valeur)}
                style={{ '--stat-color': couleur }}
                aria-pressed={isActive}
                title={isActive ? t('Retirer le filtre « {etat} »', { etat: t(option.libelle) }) : t('Afficher seulement : {etat}', { etat: t(option.libelle) })}
              >
                <Icone size={18} style={{ color: couleur }} aria-hidden="true" />
                <span className="reclamations-stat-label">{t(option.libelle)}</span>
                <span className="reclamations-stat-count">{loading ? '…' : count}</span>
                <span className="reclamations-stat-bar-bg" aria-hidden="true">
                  <span className="reclamations-stat-bar-fill" style={{ width: `${percentage}%`, backgroundColor: couleur }} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="reclamations-actions-bar">
        <button className="reclamations-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} />
          <span>{t("Ajouter")}</span>
        </button>

        <button
          className={`reclamations-action-btn modifier ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openEdit}
        >
          <Edit size={18} />
          <span>{t("Modifier")}</span>
        </button>

        <button
          className={`reclamations-action-btn details ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={() => openDetails()}
        >
          <Eye size={18} />
          <span>{t("Détails")}</span>
        </button>

        <button
          className={`reclamations-action-btn associer ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openAssociate}
        >
          <Link size={18} />
          <span>{t("Associer")}</span>
        </button>

        <button
          className={`reclamations-action-btn creer-bon ${!selectedReclamation ? 'disabled' : ''}`}
          disabled={!selectedReclamation}
          onClick={openCreateBon}
          title={t("Créer un bon de maintenance pour cette réclamation")}
        >
          <FilePlus size={18} />
          <span>{t("Créer un bon")}</span>
        </button>

        <div className="reclamations-actions-divider" />

        <button
          className={`reclamations-action-btn supprimer ${(!selectedReclamation || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedReclamation || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} />
          <span>{t("Supprimer")}</span>
        </button>
      </div>

      <VuesListe
        liste="reclamations"
        userKey={moi.cle}
        vues={vuesListe}
        items={reclamations}
        chargement={loading}
        vueActive={vueCourante.id}
        reglages={{ recherche: searchTerm, etat: etatFilter, tri: sortColumn, sens: sortDirection }}
        onChoisir={choisirVue}
      />

      <div className="reclamations-filter-panel">
        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">{t("Recherche")}</span>
          <div className="reclamations-filter-input-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder={t("Rechercher dans les colonnes actives...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="reclamations-filter-group">
          <span className="reclamations-filter-label">{t("État")}</span>
          <div className="reclamations-filter-input-wrap">
            <Filter size={16} />
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">{t("Tous")}</option>
              <option value="0">{t("Ouverte")}</option>
              <option value="1">{t("En cours")}</option>
              <option value="2">{t("Clôturée")}</option>
         
            </select>
          </div>
        </div>

        <button className="reclamations-filter-reset" onClick={handleResetFilters}>
          {t("Réinitialiser")}
        </button>

        <div className="reclamations-export-stack">
          <button className="reclamations-export-btn excel" title={t("Exporter en Excel (CSV)")} onClick={handleExportExcel}>
            <FileSpreadsheet size={18} />
          </button>
          <button className="reclamations-export-btn print" title={t("Imprimer")} onClick={handleImprimerListe}>
            <Printer size={18} />
          </button>
          <button className="reclamations-export-btn stats" title={t("Statistiques")} onClick={handleStats}>
            <BarChart3 size={18} />
          </button>
        </div>
      </div>

      {error && <div className="reclamations-error-banner">{error}</div>}

      {/* SÉLECTION MULTIPLE */}
      <SelectionMultiple
        nombre={cochesValides.length}
        total={filteredReclamations.length}
        libelle={(n) => t('Réclamations sélectionnées : {n}', { n })}
        onToutSelectionner={toutCocher}
        onVider={viderCoches}
        onSupprimer={handleDeleteSelection}
        suppressionEnCours={isDeleting}
      />

      <div className="reclamations-table-wrap liste-adaptative__tableau">
        <table className="reclamations-table">
          <thead>
            <tr>
              <th className="selection-col">
                <CaseSelection
                  coche={pageCochee}
                  partiel={pagePartielle}
                  disabled={paginatedReclamations.length === 0}
                  onChange={basculerPage}
                  label={pageCochee ? t('Décocher les réclamations de cette page') : t('Cocher les réclamations de cette page')}
                />
              </th>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`reclamations-th-sortable ${sortColumn === c.key ? 'is-sorted' : ''}`}
                  onClick={() => handleSort(c.key)}
                  aria-sort={sortColumn === c.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  title={t('Trier par {colonne}', { colonne: t(c.label) })}
                >
                  <span className="reclamations-th-inner">
                    <span>{t(c.label)}</span>
                    {renderSortIcon(c.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="reclamations-table-empty">{t("Chargement...")}</td>
              </tr>
            ) : filteredReclamations.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="reclamations-table-empty">
                  {reclamations.length === 0
                    ? t("Aucune réclamation pour l'instant. Ajoute la première avec le bouton ci-dessus.")
                    : t("Aucune réclamation ne correspond à ces filtres.")}
                </td>
              </tr>
            ) : (
              paginatedReclamations.map((r, index) => (
                <tr
                  key={r.id}
                  className={`reclamations-row ${selectedReclamation?.id === r.id ? 'selected' : ''} ${coches.has(r.id) ? 'is-coche' : ''}`}
                  onClick={() => handleRowClick(r)}
                  onDoubleClick={() => openDetails(r)}
                  title={t("Double-cliquez pour voir le détail")}
                >
                  <td className="selection-col" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <CaseSelection
                      coche={coches.has(r.id)}
                      onChange={(e) => basculerCoche(r, index, e.nativeEvent?.shiftKey)}
                      label={t('Sélectionner la réclamation {num}', { num: r.num || r.id })}
                    />
                  </td>
                  {visibleColumns.map((c) => TABLE_COLUMNS_DEF[c.key]?.cell(r))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CARTES (téléphone) */}
      <CartesListe
        lignes={loading ? [] : paginatedReclamations.map((r) => ({
          id: r.id,
          source: r,
          num: r.num || `#${r.id}`,
          titre: r.description,
          statut: { type: 'reclamation', valeur: r.etat },
          niveau: r.urgence ? { valeur: r.urgence, prefixe: 'Urgence' } : null,
          meta: [
            { icone: Building2, texte: r.serviceNom || r.service?.description },
            { icone: Calendar, texte: formatDate(r.date) },
          ],
        }))}
        selectionId={selectedReclamation?.id}
        onChoisir={handleRowClick}
        coches={coches}
        onCocher={(r) => basculerCoche(r, paginatedReclamations.indexOf(r), false)}
        onOuvrir={(r) => { setSelectedReclamation(r); openDetails(r); }}
        vide={loading ? t('Chargement...') : (reclamations.length === 0
          ? t("Aucune réclamation pour l'instant. Ajoute la première avec le bouton ci-dessus.")
          : t('Aucune réclamation ne correspond à ces filtres.'))}
      />

      {!loading && filteredReclamations.length > 0 && (
        <div className="reclamations-pagination">
          <span className="reclamations-pagination-info">
            {filteredReclamations.length} {t("résultat")}{filteredReclamations.length > 1 ? 's' : ''}
            {t(" — page ")}{currentPage}{' / '}{totalPages}
          </span>

          <div className="reclamations-pagination-controls">
            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>

            {paginationRange.map((p) => (
              <button
                key={p}
                type="button"
                className={`reclamations-pagination-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="reclamations-pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
    )}

      <ReclamationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        reclamation={selectedReclamation}
        isEditing={!!selectedReclamation}
      />

      <AssociateBonMaintenanceModal
        isOpen={associateOpen}
        onClose={() => {
          setAssociateOpen(false);
          if (detailsOpen && selectedReclamation) rechargerDetails(selectedReclamation.id, { silencieux: true });
        }}
        reclamation={selectedReclamation}
      />

      <BonMaintenanceModal
        isOpen={createBonOpen}
        onClose={() => setCreateBonOpen(false)}
        onSave={handleCreateBon}
        bonMaintenance={null}
        isEditing={false}
        initialValues={bonInitialValues}
        titleOverride={t('Nouveau bon') + ` — ${selectedReclamation?.num || t('Réclamation #{id}', { id: selectedReclamation?.id ?? '' })}`}
      />

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        error={confirmModal.error}
        confirming={confirmModal.confirming}
      />

      <ColumnSettingsModal
        key={columnSettingsInstanceKey}
        show={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        type="reclamation"
        columns={columnSettings}
        onToggleVisibility={toggleColumnVisibility}
        onToggleSearch={toggleColumnSearchability}
      />

      {rejetModal.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setRejetModal({ show: false, motif: '' })}>
          <div className="confirm-modal-container rejet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <XCircle className="modal-confirm-icon danger" size={48} strokeWidth={2} />
              </div>
              <div className="confirm-modal-text">
                <h3>{t("Rejeter la réclamation")}</h3>
                <p>{t("Indique le motif du rejet.")}</p>
                <textarea
                  className="confirm-modal-input"
                  value={rejetModal.motif}
                  onChange={(e) => setRejetModal((p) => ({ ...p, motif: e.target.value }))}
                  placeholder={t("Motif de rejet...")}
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button type="button" className="confirm-btn secondary" onClick={() => setRejetModal({ show: false, motif: '' })}>
                {t("Annuler")}
              </button>
              <button
                type="button"
                className="confirm-btn primary danger"
                onClick={confirmRejeter}
                disabled={!rejetModal.motif.trim()}
              >
                {t("Rejeter")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}