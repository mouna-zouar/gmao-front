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
  FAIBLE: 'mp-badge--faible',
  MODERE: 'mp-badge--modere',
  ELEVE: 'mp-badge--eleve',
  CRITIQUE: 'mp-badge--critique',
};

const TENDANCE_ICON = {
  HAUSSE: '↑',
  BAISSE: '↓',
  STABLE: '→',
};

const TENDANCE_CLASS = {
  HAUSSE: 'mp-tendance--hausse',
  BAISSE: 'mp-tendance--baisse',
  STABLE: 'mp-tendance--stable',
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
    <div className="mp-page">
      <div className="mp-header">
        <div>
          <h1>Maintenance prédictive</h1>
        </div>
        <button className="mp-refresh-btn" onClick={charger} disabled={loading}>
          {loading ? 'Calcul...' : '🔄 Recalculer'}
        </button>
      </div>

      {!loading && risques.length > 0 && (
        <div className="mp-summary">
          <div className="mp-summary__item mp-summary__item--critique">
            <span className="mp-summary__nombre">{nbCritiques}</span>
            <span className="mp-summary__label">équipement{nbCritiques > 1 ? 's' : ''} à risque critique</span>
          </div>
          <div className="mp-summary__item mp-summary__item--eleve">
            <span className="mp-summary__nombre">{nbEleves}</span>
            <span className="mp-summary__label">à risque élevé</span>
          </div>
          <div className="mp-summary__item">
            <span className="mp-summary__nombre">{risques.length}</span>
            <span className="mp-summary__label">équipements analysés</span>
          </div>
        </div>
      )}

      <div className="mp-filtres">
        <input
          type="text"
          placeholder="Rechercher un équipement..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="mp-recherche"
        />
        <div className="mp-filtres-niveau">
          {['TOUS', 'CRITIQUE', 'ELEVE', 'MODERE', 'FAIBLE'].map((n) => (
            <button
              key={n}
              className={`mp-filtre-btn ${filtreNiveau === n ? 'mp-filtre-btn--active' : ''}`}
              onClick={() => setFiltreNiveau(n)}
            >
              {n === 'TOUS' ? 'Tous' : NIVEAU_LABELS[n]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="mp-empty">Calcul des scores en cours...</p>
      ) : error ? (
        <p className="mp-error">{error}</p>
      ) : risquesFiltres.length === 0 ? (
        <p className="mp-empty">Aucun équipement ne correspond à ce filtre.</p>
      ) : (
        <>
          <div className="mp-table-wrapper">
            <table className="mp-table">
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
                      <div className="mp-equipement-nom">{r.designation || `Équipement #${r.lotArticleImmobilistationId}`}</div>
                      {(r.marque || r.modele) && (
                        <div className="mp-equipement-sub">{[r.marque, r.modele].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td>
                      <div className="mp-score-bar-wrapper">
                        <div className="mp-score-bar">
                          <div
                            className={`mp-score-bar__fill ${NIVEAU_CLASS[r.niveauRisque] || ''}`}
                            style={{ width: `${r.scoreRisque}%` }}
                          />
                        </div>
                        <span className="mp-score-valeur">{r.scoreRisque}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`mp-badge ${NIVEAU_CLASS[r.niveauRisque] || ''}`}>
                        {NIVEAU_LABELS[r.niveauRisque] || r.niveauRisque}
                      </span>
                    </td>
                    <td>{r.nbPannes12Mois}</td>
                    <td>
                      <span className={`mp-tendance ${TENDANCE_CLASS[r.tendance] || ''}`}>
                        {TENDANCE_ICON[r.tendance] || ''} {r.nbPannesTrimestreRecent}/{r.nbPannesTrimestrePrecedent}
                      </span>
                    </td>
                    <td>{r.ageAnnees != null ? `${r.ageAnnees} ans` : '—'}</td>
                    <td>
                      {r.garantieExpiree === null ? '—' : r.garantieExpiree ? (
                        <span className="mp-garantie mp-garantie--expiree">Expirée</span>
                      ) : (
                        <span className="mp-garantie mp-garantie--active">Active</span>
                      )}
                    </td>
                    <td>{formatDate(r.derniereIntervention)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="mp-pagination">
            <span className="mp-pagination-info">
              {risquesFiltres.length} résultat{risquesFiltres.length > 1 ? 's' : ''} — page {currentPage} / {totalPages}
            </span>
            <div className="mp-pagination-controls">
              <button
                type="button"
                className="mp-pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Précédent
              </button>

              {paginationRange.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`mp-pagination-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className="mp-pagination-btn"
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