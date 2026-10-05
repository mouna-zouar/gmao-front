import React, { useCallback, useEffect, useMemo, useState } from 'react';
import maintenanceRisqueService from '../../../services/maintenanceRisqueService ';
import './MaintenancePredictive.css';

const NIVEAU_LABELS = {
  FAIBLE: 'Faible',
  MODERE: 'Modéré',
  ELEVE: 'Élevé',
  CRITIQUE: 'Critique',
};

const NIVEAU_CLASS = {
  FAIBLE: 'risque-badge--faible',
  MODERE: 'risque-badge--modere',
  ELEVE: 'risque-badge--eleve',
  CRITIQUE: 'risque-badge--critique',
};

const TENDANCE_ICON = {
  HAUSSE: '↑',
  BAISSE: '↓',
  STABLE: '→',
};

const TENDANCE_CLASS = {
  HAUSSE: 'tendance--hausse',
  BAISSE: 'tendance--baisse',
  STABLE: 'tendance--stable',
};

const PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MaintenancePredictive() {
  const [risques, setRisques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtreNiveau, setFiltreNiveau] = useState('TOUS');
  const [recherche, setRecherche] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await maintenanceRisqueService.calculerRisques(100);
      setRisques(data ?? []);
    } catch (err) {
      console.error('Erreur calcul risques maintenance :', err);
      setError('Impossible de calculer les scores de risque pour le moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /* ---------- Filtrage ---------- */
  const risquesFiltres = useMemo(() => {
    return risques
      .filter((r) => filtreNiveau === 'TOUS' || r.niveauRisque === filtreNiveau)
      .filter((r) => !recherche.trim() || (r.designation || '').toLowerCase().includes(recherche.trim().toLowerCase()));
  }, [risques, filtreNiveau, recherche]);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(risquesFiltres.length / PAGE_SIZE));

  useEffect(() => { setCurrentPage(1); }, [filtreNiveau, recherche]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const risquesAffiches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return risquesFiltres.slice(start, start + PAGE_SIZE);
  }, [risquesFiltres, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const paginationRange = useMemo(() => {
    const range = [];
    for (let i = 1; i <= totalPages; i += 1) range.push(i);
    return range;
  }, [totalPages]);

  const nbCritiques = risques.filter((r) => r.niveauRisque === 'CRITIQUE').length;
  const nbEleves = risques.filter((r) => r.niveauRisque === 'ELEVE').length;

  return (
    <div className="risque-page">
      <div className="risque-header">
        <div>
          <h1>Maintenance prédictive</h1>
        </div>
        <button className="risque-refresh-btn" onClick={charger} disabled={loading}>
          {loading ? 'Calcul...' : '🔄 Recalculer'}
        </button>
      </div>

      {!loading && risques.length > 0 && (
        <div className="risque-summary">
          <div className="risque-summary__item risque-summary__item--critique">
            <span className="risque-summary__nombre">{nbCritiques}</span>
            <span className="risque-summary__label">équipement{nbCritiques > 1 ? 's' : ''} à risque critique</span>
          </div>
          <div className="risque-summary__item risque-summary__item--eleve">
            <span className="risque-summary__nombre">{nbEleves}</span>
            <span className="risque-summary__label">à risque élevé</span>
          </div>
          <div className="risque-summary__item">
            <span className="risque-summary__nombre">{risques.length}</span>
            <span className="risque-summary__label">équipements analysés</span>
          </div>
        </div>
      )}

      <div className="risque-filtres">
        <input
          type="text"
          placeholder="Rechercher un équipement..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="risque-recherche"
        />
        <div className="risque-filtres-niveau">
          {['TOUS', 'CRITIQUE', 'ELEVE', 'MODERE', 'FAIBLE'].map((n) => (
            <button
              key={n}
              className={`risque-filtre-btn ${filtreNiveau === n ? 'risque-filtre-btn--active' : ''}`}
              onClick={() => setFiltreNiveau(n)}
            >
              {n === 'TOUS' ? 'Tous' : NIVEAU_LABELS[n]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="risque-empty">Calcul des scores en cours...</p>
      ) : error ? (
        <p className="risque-error">{error}</p>
      ) : risquesFiltres.length === 0 ? (
        <p className="risque-empty">Aucun équipement ne correspond à ce filtre.</p>
      ) : (
        <>
          <div className="risque-table-wrapper">
            <table className="risque-table">
              <thead>
                <tr>
                  <th>Équipement</th>
                  <th>Score</th>
                  <th>Niveau</th>
                  <th>Pannes (12 mois)</th>
                  <th>Tendance</th>
                  <th>Âge</th>
                  <th>Garantie</th>
                  <th>Dernière intervention</th>
                </tr>
              </thead>
              <tbody>
                {risquesAffiches.map((r) => (
                  <tr key={r.lotArticleImmobilistationId}>
                    <td>
                      <div className="risque-equipement-nom">{r.designation || `Équipement #${r.lotArticleImmobilistationId}`}</div>
                      {(r.marque || r.modele) && (
                        <div className="risque-equipement-sub">{[r.marque, r.modele].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td>
                      <div className="risque-score-bar-wrapper">
                        <div className="risque-score-bar">
                          <div
                            className={`risque-score-bar__fill ${NIVEAU_CLASS[r.niveauRisque] || ''}`}
                            style={{ width: `${r.scoreRisque}%` }}
                          />
                        </div>
                        <span className="risque-score-valeur">{r.scoreRisque}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`risque-badge ${NIVEAU_CLASS[r.niveauRisque] || ''}`}>
                        {NIVEAU_LABELS[r.niveauRisque] || r.niveauRisque}
                      </span>
                    </td>
                    <td>{r.nbPannes12Mois}</td>
                    <td>
                      <span className={`tendance ${TENDANCE_CLASS[r.tendance] || ''}`}>
                        {TENDANCE_ICON[r.tendance] || ''} {r.nbPannesTrimestreRecent}/{r.nbPannesTrimestrePrecedent}
                      </span>
                    </td>
                    <td>{r.ageAnnees != null ? `${r.ageAnnees} ans` : '—'}</td>
                    <td>
                      {r.garantieExpiree === null ? '—' : r.garantieExpiree ? (
                        <span className="garantie garantie--expiree">Expirée</span>
                      ) : (
                        <span className="garantie garantie--active">Active</span>
                      )}
                    </td>
                    <td>{formatDate(r.derniereIntervention)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="risque-pagination">
            <span className="risque-pagination-info">
              {risquesFiltres.length} résultat{risquesFiltres.length > 1 ? 's' : ''} — page {currentPage} / {totalPages}
            </span>
            <div className="risque-pagination-controls">
              <button
                type="button"
                className="risque-pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Précédent
              </button>

              {paginationRange.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`risque-pagination-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="risque-pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Suivant
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}