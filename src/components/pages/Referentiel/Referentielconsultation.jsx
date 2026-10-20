import React, { useState, useMemo, useCallback } from 'react';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import pieceService from '../../../services/pieceService';
import pieceLigneService from '../../../services/pieceLigneService';
import calendrierService from '../../../services/calendrierService';
import serviceService from '../../../services/Serviceservice';
import cliniqueService from '../../../services/cliniqueService';
import prestataireDepotService from '../../../services/Prestatairedepotservice';
import depotQteService from '../../../services/depotQteService';
import depotQteLotService from '../../../services/depotQteLotService';
import articleStockDepotService from '../../../services/articleStockDepotService';
import cliniqueStockDepotService from '../../../services/cliniqueStockDepotService';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';
import { Archive, Banknote, Building2, Calendar, Columns3, Database, Eye, FileText, Hospital, Search, Settings, Tag, UserCheck, Warehouse, X } from 'lucide-react';
import './ReferentielConsultation.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ENTITY_CONFIG = {
  personnel: {
    title: 'Personnel',
    service: personnelService,
    icon: <UserCheck strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'matricule', label: 'Matricule', searchable: true },
      { key: 'nom', label: 'Nom', searchable: true },
      { key: 'prenom', label: 'Prénom', searchable: true },
      { key: 'fonction', label: 'Fonction', searchable: true },
      { key: 'email', label: 'Email', searchable: true },
      { key: 'telephone', label: 'Téléphone', searchable: false },
    ],
  },
  prestataire: {
    title: 'Prestataires',
    service: prestataireService,
    icon: <Building2 strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'raisonSociale', label: 'Raison sociale', searchable: true },
      { key: 'nom', label: 'Nom', searchable: true },
      { key: 'prenom', label: 'Prénom', searchable: true },
      { key: 'telephone', label: 'Téléphone', searchable: false },
      { key: 'email', label: 'Email', searchable: true },
    ],
  },
  lotArticleImmobilistation: {
    title: 'Lots article immobilisé',
    service: lotArticleImmobilistationService,
    icon: <Banknote strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'designation', label: 'Désignation', searchable: true },
      { key: 'marque', label: 'Marque', searchable: true },
      { key: 'modele', label: 'Modèle', searchable: true },
      { key: 'numPiece', label: 'N° pièce', searchable: true },
      { key: 'codeBarre', label: 'Code barre', searchable: true },
      { key: 'etatFonc', label: 'État fonc.', searchable: false },
    ],
  },
  piece: {
    title: 'Pièces',
    service: pieceService,
    icon: <FileText strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'numPiece', label: 'N° pièce', searchable: true },
      { key: 'num', label: 'N°', searchable: false },
      { key: 'date', label: 'Date', searchable: false, format: formatDate },
      { key: 'description', label: 'Description', searchable: true },
      { key: 'ttc', label: 'TTC', searchable: false, format: (v) => (v != null ? `${v} DT` : '—') },
      { key: 'etat', label: 'État', searchable: false },
      { key: 'personnelCreationNom', label: 'Créé par', searchable: true },
    ],
  },
  pieceLigne: {
    title: 'Lignes de pièce',
    service: pieceLigneService,
    icon: <Columns3 strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'pieceId', label: 'Pièce (ID)', searchable: false },
      { key: 'prestataireArticlesId', label: 'Article (ID)', searchable: false },
      { key: 'qte', label: 'Qté', searchable: false },
      { key: 'unite', label: 'Unité', searchable: true },
      { key: 'qteColisee', label: 'Qté colisée', searchable: false },
      { key: 'prixUnitaire', label: 'Prix unitaire', searchable: false, format: (v) => (v != null ? `${v} DT` : '—') },
      { key: 'montantHT', label: 'Montant HT', searchable: false, format: (v) => (v != null ? `${v} DT` : '—') },
    ],
  },
  calendrier: {
    title: 'Calendriers',
    service: calendrierService,
    icon: <Calendar strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'code', label: 'Code', searchable: true },
      { key: 'description', label: 'Description', searchable: true },
      { key: 'type', label: 'Type', searchable: false },
      { key: 'eventDrop', label: 'Glisser-déposer', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'eventResize', label: 'Redimensionner', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'dayClick', label: 'Clic sur jour', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
    ],
  },
  service: {
    title: 'Services',
    service: serviceService,
    icon: <Building2 strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'code', label: 'Code', searchable: true },
      { key: 'description', label: 'Description', searchable: true },
      { key: 'typeService', label: 'Type', searchable: false },
      { key: 'estServiceParDefault', label: 'Par défaut', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'estBE', label: 'Biomédical', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
    ],
  },
  clinique: {
    title: 'Cliniques',
    service: cliniqueService,
    icon: <Hospital strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'nom', label: 'Nom', searchable: true },
      { key: 'adresse', label: 'Adresse', searchable: true },
      { key: 'telephone', label: 'Téléphone', searchable: false },
      { key: 'mail', label: 'Email', searchable: true },
    ],
  },
  prestataireDepot: {
    title: 'Dépôts',
    service: prestataireDepotService,
    icon: <Database strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'nom', label: 'Nom', searchable: true },
      { key: 'codeDepots', label: 'Code', searchable: true },
      { key: 'estPrincipal', label: 'Principal', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'estExterne', label: 'Externe', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'controlerStock', label: 'Contrôle stock', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
    ],
  },
  articleStockDepot: {
    title: 'Articles de stock',
    service: articleStockDepotService,
    icon: <Archive strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'nom', label: 'Nom', searchable: true },
      { key: 'description', label: 'Description', searchable: true },
      { key: 'unite', label: 'Unité', searchable: true },
    ],
  },
  depotQte: {
    title: 'Quantités en dépôt',
    service: depotQteService,
    icon: <Archive strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'prestataireArticleId', label: 'Article (ID)', searchable: false },
      { key: 'depotId', label: 'Dépôt (ID)', searchable: false },
      { key: 'qte', label: 'Quantité', searchable: false },
      { key: 'seuil', label: 'Seuil', searchable: false },
      { key: 'emplacement', label: 'Emplacement', searchable: true },
      { key: 'qteMax', label: 'Qté max', searchable: false },
      { key: 'dateExpiration', label: 'Expiration', searchable: false, format: formatDate },
    ],
  },
  depotQteLot: {
    title: 'Lots / N° série',
    service: depotQteLotService,
    icon: <Tag strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'depotQteId', label: 'Ligne stock (ID)', searchable: false },
      { key: 'nSerie', label: 'N° série / lot', searchable: true },
      { key: 'qte', label: 'Quantité', searchable: false },
      { key: 'dateExpiration', label: 'Expiration', searchable: false, format: formatDate },
    ],
  },
  cliniqueStockDepot: {
    title: 'Stock clinique',
    service: cliniqueStockDepotService,
    icon: <Warehouse strokeWidth={2} aria-hidden="true" />,
    columns: [
      { key: 'cliniqueId', label: 'Clinique (ID)', searchable: false },
      { key: 'articleStockDepotId', label: 'Article (ID)', searchable: false },
      { key: 'qte', label: 'Quantité', searchable: false },
      { key: 'emplacement', label: 'Emplacement', searchable: true },
      { key: 'datePeremption', label: 'Péremption', searchable: false, format: formatDate },
      { key: 'dateMiseEnDepot', label: 'Mise en dépôt', searchable: false, format: formatDate },
    ],
  },
};

const PAGE_SIZE = 10;
const FETCH_SIZE = 200;

export default function ReferentielConsultation() {
  const [activeView, setActiveView] = useState(null);

  const [dataByType, setDataByType] = useState({});
  const [loadingByType, setLoadingByType] = useState({});
  const [errorByType, setErrorByType] = useState({});

  const [columnVisibility, setColumnVisibility] = useState(() => {
    const initial = {};
    Object.entries(ENTITY_CONFIG).forEach(([type, cfg]) => {
      initial[type] = cfg.columns.map((c) => ({ ...c, visible: true }));
    });
    return initial;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState('all');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedSearchColumn, setAppliedSearchColumn] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchType = useCallback(async (type) => {
    const cfg = ENTITY_CONFIG[type];
    if (!cfg) return;
    setLoadingByType((prev) => ({ ...prev, [type]: true }));
    setErrorByType((prev) => ({ ...prev, [type]: null }));
    try {
      const page = await cfg.service.getAll(0, FETCH_SIZE);
      setDataByType((prev) => ({ ...prev, [type]: page.content ?? [] }));
    } catch (err) {
      console.error(`Erreur chargement ${type} :`, err);
      setErrorByType((prev) => ({ ...prev, [type]: `Impossible de charger « ${cfg.title} » depuis le serveur.` }));
    } finally {
      setLoadingByType((prev) => ({ ...prev, [type]: false }));
    }
  }, []);

  const resetFilters = () => {
    setSearchTerm('');
    setSearchColumn('all');
    setAppliedSearchTerm('');
    setAppliedSearchColumn('all');
    setCurrentPage(1);
  };

  const openView = (type) => {
    if (activeView === type) {
      setActiveView(null);
      resetFilters();
      return;
    }
    setActiveView(type);
    resetFilters();
    if (!dataByType[type]) {
      fetchType(type);
    }
  };

  const toggleColumnVisibility = (type, key) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [type]: prev[type].map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    }));
  };

  const toggleColumnSearchability = (type, key) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [type]: prev[type].map((c) => (c.key === key ? { ...c, searchable: !c.searchable } : c)),
    }));
  };

  const handleSearchApply = () => {
    setAppliedSearchTerm(searchTerm);
    setAppliedSearchColumn(searchColumn);
    setCurrentPage(1);
  };

  return (
    <div className="referentiel-wrapper">
      <header className="referentiel-page-header">
        <h1>Référentiels</h1>
        <p>Consultation des données de référence (personnel, prestataires, immobilisations, pièces)</p>
      </header>

      <div className="referentiel-icon-grid">
        {Object.entries(ENTITY_CONFIG).map(([type, cfg]) => (
          <div key={type} className={`referentiel-icon-card ${activeView === type ? 'active' : ''}`}>
            <div className="referentiel-card-icon-wrapper">{cfg.icon}</div>
            <h3>{cfg.title}</h3>
            <div className="referentiel-card-hover-actions">
              <button
                className={`referentiel-h-action-btn view ${activeView === type ? 'viewing' : ''}`}
                onClick={() => openView(type)}
              >
                <Eye size={18} strokeWidth={2.5} aria-hidden="true" />
                <span>{activeView === type ? 'Fermer' : 'Visualiser'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={`referentiel-detail-reveal ${activeView ? 'visible' : ''}`}>
        {activeView && (
          <ReferentielDetailView
            type={activeView}
            title={ENTITY_CONFIG[activeView].title}
            data={dataByType[activeView] ?? []}
            loading={!!loadingByType[activeView]}
            error={errorByType[activeView]}
            columns={columnVisibility[activeView]}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchColumn={searchColumn}
            setSearchColumn={setSearchColumn}
            appliedSearchTerm={appliedSearchTerm}
            appliedSearchColumn={appliedSearchColumn}
            onSearchApply={handleSearchApply}
            onResetFilters={resetFilters}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onOpenSettings={() => setShowSettings(true)}
            onClose={() => { setActiveView(null); resetFilters(); }}
          />
        )}
      </div>

      <ColumnSettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        type={activeView}
        columns={columnVisibility[activeView] || []}
        onToggleVisibility={(key) => toggleColumnVisibility(activeView, key)}
        onToggleSearch={(key) => toggleColumnSearchability(activeView, key)}
      />
    </div>
  );
}

function ReferentielDetailView({
  type, title, data, loading, error, columns,
  searchTerm, setSearchTerm, searchColumn, setSearchColumn,
  appliedSearchTerm, appliedSearchColumn, onSearchApply, onResetFilters,
  currentPage, setCurrentPage, onOpenSettings, onClose,
}) {
  const visibleCols = columns.filter((c) => c.visible);
  const searchableCols = columns.filter((c) => c.searchable);

  const filteredData = useMemo(() => {
    if (!appliedSearchTerm) return data;
    const term = appliedSearchTerm.toLowerCase();
    return data.filter((item) => {
      if (appliedSearchColumn === 'all') {
        return searchableCols.some((col) => {
          const val = item[col.key];
          return val != null && val.toString().toLowerCase().includes(term);
        });
      }
      const val = item[appliedSearchColumn];
      return val != null && val.toString().toLowerCase().includes(term);
    });
  }, [data, appliedSearchTerm, appliedSearchColumn, searchableCols]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, safePage]);

  const goToPage = (p) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

  return (
    <div className="referentiel-detail-container">
      <div className="referentiel-actions-bar">
        <span className="referentiel-view-title">{title}</span>
        <div className="referentiel-actions-right">
          <button className="referentiel-settings-btn" onClick={onOpenSettings} title="Paramètres des colonnes">
            <Settings size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <button className="referentiel-action-btn fermer" onClick={onClose}>
            <X size={18} strokeWidth={2} aria-hidden="true" />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      <div className="referentiel-filter-panel">
        <div className="referentiel-filter-group-item">
          <span className="referentiel-filter-label">Colonne</span>
          <select value={searchColumn} onChange={(e) => setSearchColumn(e.target.value)}>
            <option value="all">Tous les champs</option>
            {searchableCols.map((col) => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        </div>

        <div className="referentiel-filter-group-item wide">
          <span className="referentiel-filter-label">Recherche</span>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchApply(); }}
          />
        </div>

        <button className="referentiel-search-btn" onClick={onSearchApply}>
          <Search size={16} strokeWidth={2.5} aria-hidden="true" />
          Chercher
        </button>

        <button className="referentiel-reset-btn" onClick={onResetFilters}>
          Réinitialiser
        </button>
      </div>

      <div className="referentiel-table-section">
        <div className="referentiel-table-wrap">
          <table className="referentiel-table">
            <thead>
              <tr>
                {visibleCols.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length} className="referentiel-empty-msg">Chargement...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={visibleCols.length} className="referentiel-empty-msg referentiel-error-msg">{error}</td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="referentiel-empty-msg">
                    {data.length === 0 ? 'Aucune donnée disponible.' : 'Aucun résultat pour ces filtres.'}
                  </td>
                </tr>
              ) : (
                pageData.map((item) => (
                  <tr key={item.id}>
                    {visibleCols.map((col) => (
                      <td key={col.key}>
                        {col.format
                          ? col.format(item[col.key])
                          : (typeof item[col.key] === 'boolean' ? (item[col.key] ? 'Oui' : 'Non') : (item[col.key] ?? '—'))}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && filteredData.length > 0 && (
          <div className="referentiel-pagination">
            <span className="referentiel-pagination-info">
              {filteredData.length} élément{filteredData.length > 1 ? 's' : ''} — page {safePage} / {totalPages}
            </span>
            <div className="referentiel-pagination-controls">
              <button
                className="referentiel-pag-btn"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
              >
                Précédent
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`referentiel-pag-btn ${p === safePage ? 'active' : ''}`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="referentiel-pag-btn"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}