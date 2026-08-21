import React, { useState, useMemo, useCallback } from 'react';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import pieceService from '../../../services/pieceService';
import pieceLigneService from '../../../services/pieceLigneService';
import calendrierService from '../../../services/calendrierService';
import ColumnSettingsModal from '../../ui/modals/ColumnSettingsModal';
import './ReferentielConsultation.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Config déclarative : un seul composant générique pilote les 4 référentiels.
const ENTITY_CONFIG = {
  personnel: {
    title: 'Personnel',
    service: personnelService,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M17 11l2 2 4-4" /></svg>,
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" /></svg>,
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
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
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
    columns: [
      { key: 'code', label: 'Code', searchable: true },
      { key: 'description', label: 'Description', searchable: true },
      { key: 'type', label: 'Type', searchable: false },
      { key: 'eventDrop', label: 'Glisser-déposer', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'eventResize', label: 'Redimensionner', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
      { key: 'dayClick', label: 'Clic sur jour', searchable: false, format: (v) => (v ? 'Oui' : 'Non') },
    ],
  },
};

const PAGE_SIZE = 10;
const FETCH_SIZE = 200; // taille du batch chargé depuis le backend, paginé ensuite côté client

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
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
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
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button className="referentiel-action-btn fermer" onClick={onClose}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
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