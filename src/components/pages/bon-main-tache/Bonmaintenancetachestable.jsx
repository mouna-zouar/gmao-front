import React, { useState, useEffect, useMemo } from 'react';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import './BonMaintenanceTachesTable.css';

const ETAT_OPTIONS = [
  { value: 0, label: 'Nouveau' },
  { value: 1, label: 'En cours' },
  { value: 2, label: 'Terminé' },
  { value: 10, label: 'Annulé' },
];

const ETAT_BADGE_CLASS = {
  0: 'bmtt-badge--nouveau',
  1: 'bmtt-badge--encours',
  2: 'bmtt-badge--termine',
  10: 'bmtt-badge--annule',
};

function etatLabel(etat) {
  if (etat == null) return '—';
  return ETAT_OPTIONS.find((o) => o.value === etat)?.label ?? `État ${etat}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 15;

/**
 * Table de TOUTES les tâches, tous bons de maintenance confondus — affichage
 * seul, sans modale. Le changement d'état se fait directement via le select
 * dans la ligne (sauvegarde immédiate). Filtrable par numéro/titre de bon.
 */
export default function BonMaintenanceTachesTable() {
  const [taches, setTaches] = useState([]);
  const [bonsParId, setBonsParId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tachesPage, bonsPage] = await Promise.all([
        bonMaintenanceTacheService.getAll(0, 500),
        bonMaintenanceService.getAll(0, 500),
      ]);

      setTaches(tachesPage.content ?? []);

      const map = {};
      (bonsPage.content ?? []).forEach((b) => { map[b.id] = b; });
      setBonsParId(map);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les tâches. Vérifie que le serveur est bien lancé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleEtatChange = async (tache, nouvelEtat) => {
    setSavingId(tache.id);
    try {
      const updated = await bonMaintenanceTacheService.update(tache.id, {
        ...tache,
        etat: Number(nouvelEtat),
      });
      setTaches((prev) => prev.map((t) => (t.id === tache.id ? updated : t)));
    } catch (err) {
      console.error(err);
      alert("Échec du changement d'état de la tâche.");
    } finally {
      setSavingId(null);
    }
  };

  const filteredTaches = useMemo(() => {
    if (!searchTerm) return taches;
    const terme = searchTerm.toLowerCase();
    return taches.filter((t) => {
      const bon = bonsParId[t.bonMaintenanceId];
      return t.designation?.toLowerCase().includes(terme)
        || bon?.num?.toLowerCase().includes(terme)
        || bon?.titre?.toLowerCase().includes(terme);
    });
  }, [taches, searchTerm, bonsParId]);

  const totalPages = Math.max(1, Math.ceil(filteredTaches.length / PAGE_SIZE));

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const paginatedTaches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTaches.slice(start, start + PAGE_SIZE);
  }, [filteredTaches, currentPage]);

  return (
    <div className="bmtt-container">
      <div className="bmtt-header">
        <h2>Tâches — tous bons de maintenance</h2>
        <span className="bmtt-total-badge">{filteredTaches.length} tâche{filteredTaches.length > 1 ? 's' : ''}</span>
      </div>

      <div className="bmtt-filter-bar">
        <input
          type="text"
          placeholder="Rechercher par désignation, numéro ou titre de bon..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bmtt-search-input"
        />
      </div>

      <div className="bmtt-wrap">
        {error && <div className="bmtt-error">{error}</div>}

        <table className="bmtt-table">
          <thead>
            <tr>
              <th>Bon de maintenance</th>
              <th>Désignation</th>
              <th>Début</th>
              <th>Fin</th>
              <th style={{ width: 90 }}>Qté</th>
              <th style={{ width: 170 }}>État</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="bmtt-empty-cell">Chargement...</td>
              </tr>
            ) : paginatedTaches.length === 0 ? (
              <tr>
                <td colSpan={6} className="bmtt-empty-cell">
                  {taches.length === 0 ? "Aucune tâche pour l'instant." : 'Aucune tâche ne correspond à cette recherche.'}
                </td>
              </tr>
            ) : (
              paginatedTaches.map((t) => {
                const bon = bonsParId[t.bonMaintenanceId];
                return (
                  <tr key={t.id}>
                    <td className="bmtt-bon-cell">
                      {bon ? (bon.num || bon.titre || `Bon #${bon.id}`) : `Bon #${t.bonMaintenanceId}`}
                    </td>
                    <td className="bmtt-designation-cell">{t.designation}</td>
                    <td>{formatDateTime(t.dateDebut)}</td>
                    <td>{formatDateTime(t.dateFin)}</td>
                    <td>{t.qte ?? '—'}</td>
                    <td>
                      <div className="bmtt-etat-cell">
                        <span className={`bmtt-badge ${ETAT_BADGE_CLASS[t.etat] || ''}`}>
                          {etatLabel(t.etat)}
                        </span>
                        <select
                          className="bmtt-etat-select"
                          value={t.etat ?? ''}
                          disabled={savingId === t.id}
                          onChange={(e) => handleEtatChange(t, e.target.value)}
                        >
                          {ETAT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {savingId === t.id && <span className="bmtt-saving">...</span>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredTaches.length > 0 && (
        <div className="bmtt-pagination">
          <span className="bmtt-pagination-info">
            Page {currentPage} / {totalPages}
          </span>
          <div className="bmtt-pagination-controls">
            <button
              type="button"
              className="bmtt-pagination-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Précédent
            </button>
            <button
              type="button"
              className="bmtt-pagination-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}