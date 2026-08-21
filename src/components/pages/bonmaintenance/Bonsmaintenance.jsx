import { useEffect, useMemo, useState } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import bonMaintenanceFullService from '../../../services/bonMaintenanceFullService';
import BonMaintenanceModal from '../../ui/modals/BonMaintenanceModal';
import BonMaintenanceDetails from './BonMaintenanceDetails';
import FicheBonMaintenance from '../Fichebonmaintenance/FicheBonMaintenance';
import CommanderModal from '../../ui/modals/CommanderModal';
import DemanderModal from '../../ui/modals/DemanderModal';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';
import './BonsMaintenance.css';

const ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const ETAT_BADGE_CLASS = {
  1: 'bons-badge--nouveau',
  2: 'bons-badge--suspendu',
  3: 'bons-badge--encours',
  4: 'bons-badge--effectue',
  10: 'bons-badge--annule',
};

function etatLabel(etat) {
  if (etat == null) return '—';
  return ETAT_LABELS[etat] ?? `État ${etat}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Colonnes triables : clé -> fonction d'extraction de la valeur de tri
const SORTABLE_COLUMNS = {
  num: (b) => b.num || '',
  titre: (b) => b.titre || '',
  prestataire: (b) => b.prestataire?.raisonSociale || b.prestataire?.nom || '',
  urgence: (b) => b.urgence ?? -1,
  date: (b) => (b.date ? new Date(b.date).getTime() : 0),
  etat: (b) => b.etat ?? -1,
};

const PAGE_SIZE = 10;

export default function BonsMaintenance() {
  const [bons, setBons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtre
  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  // Tri
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Pagination (côté client, sur la liste déjà filtrée/triée)
  const [currentPage, setCurrentPage] = useState(1);

  // Sélection + modal
  const [selectedBon, setSelectedBon] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  // Allumage des boutons Demander/Commander selon la disponibilité en stock des tâches du bon sélectionné
  const [demanderAllume, setDemanderAllume] = useState(false);
  const [commanderAllume, setCommanderAllume] = useState(false);
  // Incrémenté après chaque demande/commande créée, pour forcer le recalcul de l'allumage
  // et des lignes du tableau (le useEffect ne se relance pas tout seul sinon, car
  // selectedBon ne change pas de référence après ces actions).
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);

  // Modale Commander
  const [commanderOpen, setCommanderOpen] = useState(false);
  // Modale Demander
  const [demanderOpen, setDemanderOpen] = useState(false);

  // Infos calculées par ligne visible : tooltip des documents d'achat + alerte stock insuffisant
  // { [bonId]: { tooltip: string, stockInsuffisant: boolean } }
  const [rowInfo, setRowInfo] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await bonMaintenanceService.getAll(0, 200);
      setBons(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les bons de maintenance. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Calcule si Demander/Commander doivent être "allumés" (et surtout : utilisables) — calcul
  // fait entièrement côté front. Règle simple : dès qu'un document Demander (ou Commander)
  // a déjà été lancé pour ce bon (peu importe la quantité couverte), le bouton correspondant
  // s'éteint. Il ne se rallume que si l'action n'a encore jamais été lancée pour ce bon.
  useEffect(() => {
    let cancelled = false;

    const calculer = async () => {
      if (!selectedBon) {
        setDemanderAllume(false);
        setCommanderAllume(false);
        return;
      }

      try {
        const [taches, documents] = await Promise.all([
          bonMaintenanceTacheService.getByBonMaintenance(selectedBon.id),
          bonMaintenanceDocumentAchatService.findByBonMaintenanceId(selectedBon.id),
        ]);

        if (cancelled) return;

        const tachesAvecArticle = (taches ?? []).filter((t) => t.prestataireArticlesId != null);
        const tachesCommandables = tachesAvecArticle.filter((t) => t.sousTraitantId != null);

        const demandeDejaLancee = (documents ?? []).some((d) => d.piece?.codePieceType === '.D_Fourniture');
        const commandeDejaLancee = (documents ?? []).some((d) => d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR');

        setDemanderAllume(tachesAvecArticle.length > 0 && !demandeDejaLancee);
        setCommanderAllume(tachesCommandables.length > 0 && !commandeDejaLancee);
      } catch (err) {
        console.error('Erreur calcul allumage Demander/Commander :', err);
        if (!cancelled) {
          setDemanderAllume(false);
          setCommanderAllume(false);
        }
      }
    };

    calculer();
    return () => { cancelled = true; };
  }, [selectedBon, actionsRefreshKey]);

  const filteredBons = useMemo(() => {
    return bons.filter((b) => {
      const matchesSearch = !searchTerm
        || b.titre?.toLowerCase().includes(searchTerm.toLowerCase())
        || b.num?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEtat = etatFilter === 'all' || String(b.etat) === etatFilter;

      return matchesSearch && matchesEtat;
    });
  }, [bons, searchTerm, etatFilter]);

  const sortedBons = useMemo(() => {
    const extractor = SORTABLE_COLUMNS[sortColumn];
    if (!extractor) return filteredBons;

    const sorted = [...filteredBons].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      if (typeof va === 'string') {
        return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
      }
      return va - vb;
    });

    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [filteredBons, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedBons.length / PAGE_SIZE));

  // Revenir à la page 1 quand la recherche/le filtre/le tri change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, etatFilter, sortColumn, sortDirection]);

  // Si la page courante dépasse le nombre de pages disponibles (ex: après une suppression), on recale
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedBons = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedBons.slice(start, start + PAGE_SIZE);
  }, [sortedBons, currentPage]);

  // Pour chaque ligne visible : construit le tooltip des documents d'achat (Demander/Commander)
  // liés à ce bon, et détermine si une tâche a une quantité demandée supérieure au stock
  // disponible (pour colorer la ligne en rouge). Recalculé uniquement à chaque changement de
  // page affichée, pas sur les 200 bons chargés d'un coup, pour limiter les appels réseau.
  useEffect(() => {
    let cancelled = false;

    const calculerPourLigne = async (bon) => {
      let tooltip = "Aucun document d'achat (Demander/Commander) pour ce bon.";
      let stockInsuffisant = false;

      // Quantités déjà commandées (Commander), sommées par article, pour ce bon.
      const dejaCommandeParArticle = {};

      try {
        const documents = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bon.id);
        const lignesTexte = (documents ?? [])
          .filter((d) => d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' || d.piece?.codePieceType === '.D_Fourniture')
          .map((d) => {
            const typeLabel = d.piece.codePieceType === '.COMMANDE_FOURNISSEUR' ? 'Commande' : 'Demande';
            const articlesTexte = (d.lignes ?? [])
              .map((l) => `Article #${l.prestataireArticlesId} (Qté ${l.qte ?? '—'})`)
              .join(', ');
            return `${typeLabel} — ${articlesTexte || 'aucun article'}`;
          });
        if (lignesTexte.length > 0) {
          tooltip = lignesTexte.join('\n');
        }

        (documents ?? [])
          .filter((d) => d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR')
          .forEach((d) => {
            (d.lignes ?? []).forEach((l) => {
              if (l.prestataireArticlesId == null) return;
              const qte = l.qte ?? 0;
              dejaCommandeParArticle[l.prestataireArticlesId] = (dejaCommandeParArticle[l.prestataireArticlesId] ?? 0) + qte;
            });
          });
      } catch (err) {
        console.error(`Erreur chargement documents d'achat pour le bon ${bon.id} :`, err);
      }

      try {
        const taches = await bonMaintenanceTacheService.getByBonMaintenance(bon.id);
        const tachesAvecArticle = (taches ?? []).filter((t) => t.prestataireArticlesId != null);

        const verifications = await Promise.all(
          tachesAvecArticle.map(async (t) => {
            try {
              const disponible = await pieceLigneService.getQuantiteDisponible(t.prestataireArticlesId);
              const qte = t.qte ?? 0;
              const manquant = disponible != null ? Math.max(0, qte - disponible) : qte;

              if (manquant <= 0) return false;

              // Le manquant est déjà couvert par une commande fournisseur existante ?
              const dejaCommande = dejaCommandeParArticle[t.prestataireArticlesId] ?? 0;
              return dejaCommande < manquant;
            } catch {
              return false;
            }
          })
        );
        stockInsuffisant = verifications.some(Boolean);
      } catch (err) {
        console.error(`Erreur vérification stock pour le bon ${bon.id} :`, err);
      }

      return { tooltip, stockInsuffisant };
    };

    const calculerTout = async () => {
      const entries = await Promise.all(
        paginatedBons.map(async (bon) => [bon.id, await calculerPourLigne(bon)])
      );
      if (!cancelled) {
        setRowInfo(Object.fromEntries(entries));
      }
    };

    if (paginatedBons.length > 0) {
      calculerTout();
    } else {
      setRowInfo({});
    }

    return () => { cancelled = true; };
  }, [paginatedBons, actionsRefreshKey]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) range.push(i);
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

  const sortIndicator = (column) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleRowClick = (bon) => {
    setSelectedBon((prev) => (prev?.id === bon.id ? null : bon));
  };

  const openCreate = () => {
    setSelectedBon(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedBon) return;
    setViewMode('edit');
  };

  const openCommander = () => {
    if (!selectedBon) return;
    setCommanderOpen(true);
  };

  const openDemander = () => {
    if (!selectedBon) return;
    setDemanderOpen(true);
  };

  const handleSave = async (payload, children) => {
    if (selectedBon) {
      await bonMaintenanceService.update(selectedBon.id, payload);
    } else {
      const result = await bonMaintenanceFullService.createFull(payload, children || {});
      if (result.errors.length > 0) {
        const summary = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
        alert(
          `Le bon a été créé, mais ${result.errors.length} élément(s) enfant(s) n'ont pas pu être ajoutés :\n${summary}\n\n`
          + "Tu peux les ajouter manuellement depuis l'onglet Détails du bon."
        );
      }
    }
    setSelectedBon(null);
    await load();
  };

  const handleDelete = async () => {
    if (!selectedBon || isDeleting) return;
    if (!window.confirm(`Supprimer le bon "${selectedBon.titre}" ?`)) return;

    setIsDeleting(true);
    try {
      await bonMaintenanceService.remove(selectedBon.id);
      setBons((prev) => prev.filter((b) => b.id !== selectedBon.id));
      setSelectedBon(null);
    } catch (err) {
      console.error(err);
      alert("Échec de la suppression de ce bon de maintenance.");
    } finally {
      setIsDeleting(false);
    }
  };

  const runTransition = async (action) => {
    if (!selectedBon || transitioning) return;
    setTransitioning(true);
    try {
      const updated = await action();
      setBons((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSelectedBon(updated);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Transition d'état refusée.";
      alert(message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleEnCours = () => runTransition(() => bonMaintenanceService.passerEnCours(selectedBon.id));

  const handleSuspendre = () => {
    const motif = window.prompt('Motif de suspension :');
    if (!motif || !motif.trim()) return;
    runTransition(() => bonMaintenanceService.suspendre(selectedBon.id, motif.trim()));
  };

  const handleEffectuer = () => {
    const saisie = window.prompt(
      "État final de l'immobilisation (nombre, laisser vide si non applicable) :"
    );
    if (saisie === null) return; // annulé
    const etat = saisie.trim() === '' ? null : Number(saisie);
    if (etat !== null && Number.isNaN(etat)) {
      alert('Valeur invalide pour l\'état de l\'immobilisation.');
      return;
    }
    runTransition(() => bonMaintenanceService.marquerEffectue(selectedBon.id, etat));
  };

  const handleAnnuler = () => {
    if (!window.confirm('Annuler ce bon de maintenance ?')) return;
    runTransition(() => bonMaintenanceService.annuler(selectedBon.id));
  };

  if (viewMode === 'details' && selectedBon) {
    return (
      <div className="bons-container">
        <BonMaintenanceDetails bonMaintenance={selectedBon} onBack={() => setViewMode('list')} />
      </div>
    );
  }

  if (viewMode === 'edit' && selectedBon) {
    return (
      <FicheBonMaintenance
        bonMaintenanceId={selectedBon.id}
        startInEditMode
        onClose={async () => {
          setViewMode('list');
          setSelectedBon(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="bons-container">

      <div className="bons-header-card">
        <div className="bons-header-title-box">
          <svg className="bons-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
          </svg>
          <div>
            <h2>Bons de maintenance</h2>
            <p className="bons-header-subtitle">Gestion des interventions de maintenance</p>
          </div>
        </div>
        <span className="bons-badge-total">Total : {sortedBons.length}</span>
      </div>

      <div className="bons-actions-bar">
        <button className="bons-action-btn ajouter" onClick={openCreate}>
          <span className="bons-action-icon">+</span>
          <span>Ajouter</span>
        </button>

        <button
          className={`bons-action-btn modifier ${!selectedBon ? 'disabled' : ''}`}
          disabled={!selectedBon}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`bons-action-btn details ${!selectedBon ? 'disabled' : ''}`}
          disabled={!selectedBon}
          onClick={() => setViewMode('details')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Détails</span>
        </button>

        <button
          className={`bons-action-btn demander ${(!selectedBon || !demanderAllume) ? 'disabled' : ''} ${demanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !demanderAllume}
          onClick={openDemander}
          title={!selectedBon ? '' : (!demanderAllume ? 'Rien à demander pour ce bon' : '')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>Demander</span>
        </button>

        <button
          className={`bons-action-btn commander ${(!selectedBon || !commanderAllume) ? 'disabled' : ''} ${commanderAllume ? 'allume' : ''}`}
          disabled={!selectedBon || !commanderAllume}
          onClick={openCommander}
          title={!selectedBon ? '' : (!commanderAllume ? 'Rien à commander pour ce bon' : '')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.936-4.719 2.399-7.22a.75.75 0 00-.727-.891H5.106M7.5 14.25L5.106 5.165M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          <span>Commander</span>
        </button>

        <button
          className={`bons-action-btn supprimer ${(!selectedBon || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedBon || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>

        <div className="bons-actions-divider" />

        <button
          className={`bons-action-btn encours ${(!selectedBon || transitioning) ? 'disabled' : ''}`}
          disabled={!selectedBon || transitioning}
          onClick={handleEnCours}
        >
          En cours
        </button>
        <button
          className={`bons-action-btn suspendre ${(!selectedBon || transitioning) ? 'disabled' : ''}`}
          disabled={!selectedBon || transitioning}
          onClick={handleSuspendre}
        >
          Suspendre
        </button>
        <button
          className={`bons-action-btn effectuer ${(!selectedBon || transitioning) ? 'disabled' : ''}`}
          disabled={!selectedBon || transitioning}
          onClick={handleEffectuer}
        >
          Effectué
        </button>
        <button
          className={`bons-action-btn annuler ${(!selectedBon || transitioning) ? 'disabled' : ''}`}
          disabled={!selectedBon || transitioning}
          onClick={handleAnnuler}
        >
          Annuler
        </button>
      </div>

      <div className="bons-filter-panel">
        <div className="bons-filter-group">
          <span className="bons-filter-label">Recherche</span>
          <div className="bons-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par titre ou numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bons-filter-group">
          <span className="bons-filter-label">État</span>
          <div className="bons-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="1">Nouveau</option>
              <option value="2">Suspendu</option>
              <option value="3">En cours</option>
              <option value="4">Effectué</option>
              <option value="10">Annulé</option>
            </select>
          </div>
        </div>

        <button className="bons-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>
      </div>

      {error && <div className="bons-error-banner">{error}</div>}

      <div className="bons-table-wrap">
        <table className="bons-table">
          <thead>
            <tr>
              <th className="bons-th-sortable" onClick={() => handleSort('num')}>Numéro{sortIndicator('num')}</th>
              <th className="bons-th-sortable" onClick={() => handleSort('titre')}>Titre{sortIndicator('titre')}</th>
              <th className="bons-th-sortable" onClick={() => handleSort('prestataire')}>Prestataire{sortIndicator('prestataire')}</th>
              <th className="bons-th-sortable" onClick={() => handleSort('urgence')}>Urgence{sortIndicator('urgence')}</th>
              <th className="bons-th-sortable" onClick={() => handleSort('date')}>Date{sortIndicator('date')}</th>
              <th className="bons-th-sortable" onClick={() => handleSort('etat')}>État{sortIndicator('etat')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="bons-table-empty">Chargement...</td>
              </tr>
            ) : sortedBons.length === 0 ? (
              <tr>
                <td colSpan={6} className="bons-table-empty">
                  {bons.length === 0
                    ? "Aucun bon de maintenance pour l'instant. Ajoute le premier avec le bouton ci-dessus."
                    : "Aucun bon ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              paginatedBons.map((b) => (
                <tr
                  key={b.id}
                  className={`bons-row ${selectedBon?.id === b.id ? 'selected' : ''} ${rowInfo[b.id]?.stockInsuffisant ? 'stock-insuffisant' : ''}`}
                  onClick={() => handleRowClick(b)}
                  title={rowInfo[b.id]?.tooltip || ''}
                >
                  <td style={{ fontWeight: 600 }}>{b.num || '—'}</td>
                  <td>{b.titre}</td>
                  <td>{b.prestataire?.raisonSociale || b.prestataire?.nom || '—'}</td>
                  <td>{b.urgence != null ? b.urgence : '—'}</td>
                  <td>{formatDate(b.date)}</td>
                  <td>
                    <span className={`bons-badge ${ETAT_BADGE_CLASS[b.etat] || ''}`}>
                      {etatLabel(b.etat)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sortedBons.length > 0 && (
        <div className="bons-pagination">
          <span className="bons-pagination-info">
            {sortedBons.length} résultat{sortedBons.length > 1 ? 's' : ''}
            {' — page '}{currentPage}{' / '}{totalPages}
          </span>

          <div className="bons-pagination-controls">
            <button
              type="button"
              className="bons-pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Précédent
            </button>

            {paginationRange.map((p) => (
              <button
                key={p}
                type="button"
                className={`bons-pagination-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="bons-pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      <BonMaintenanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        bonMaintenance={selectedBon}
        isEditing={!!selectedBon}
      />

      <DemanderModal
        isOpen={demanderOpen}
        onClose={() => setDemanderOpen(false)}
        bonMaintenance={selectedBon}
        onDemandeCreee={() => {
          alert('Demande créée avec succès.');
          setActionsRefreshKey((k) => k + 1);
        }}
      />

      <CommanderModal
        isOpen={commanderOpen}
        onClose={() => setCommanderOpen(false)}
        bonMaintenance={selectedBon}
        onCommandeCreee={() => {
          alert('Commande créée avec succès.');
          setActionsRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}