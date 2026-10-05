import { useEffect, useMemo, useState } from 'react';
import {
  IdCard, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2, AlertTriangle,
  User, Calendar, CheckCircle2, XCircle,
} from 'lucide-react';
import permisConduiteService from '../../../../services/permisConduiteService';
import personnelService from '../../../../services/personnelService';
import PermisConduiteModal from '../../../ui/modals/PermisConduiteModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import './PermisConduite.css';

// Référentiel de secours des catégories (au cas où l'appel API échoue avant chargement).
const CATEGORIE_LABELS = {
  A1: 'A1', A: 'A', B: 'B', B_E: 'B+E', C: 'C', C_E: 'C+E', D: 'D', D_E: 'D+E', F: 'F',
};

function categorieLabel(code) {
  return CATEGORIE_LABELS[code] ?? code;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isExpire(dateExpiration) {
  if (!dateExpiration) return false;
  const d = new Date(dateExpiration);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default function PermisConduite() {
  const [permis, setPermis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');

  const [personnelsMap, setPersonnelsMap] = useState({});

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: 'Confirmer', onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, persPage] = await Promise.all([
        permisConduiteService.getAll(0, 200),
        personnelService.getAll(0, 500),
      ]);

      setPermis(page.content ?? []);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les permis de conduite. Vérifie que le serveur est bien lancé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = permis.length;
    const valides = permis.filter((p) => !isExpire(p.dateExpiration)).length;
    const expires = permis.filter((p) => isExpire(p.dateExpiration)).length;
    const poidsLourd = permis.filter((p) =>
      (p.categories ?? []).some((c) => ['C', 'C_E', 'D', 'D_E'].includes(c))
    ).length;
    return { total, valides, expires, poidsLourd };
  }, [permis]);

  const filtered = useMemo(() => {
    return permis.filter((p) => {
      const pers = personnelsMap[p.personnelId];

      const haystack = [
        pers?.nom, pers?.prenom, pers?.matricule, p.numero, p.lieuDelivrance,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesCategorie = categorieFilter === 'all' || (p.categories ?? []).includes(categorieFilter);
      const expire = isExpire(p.dateExpiration);
      const matchesStatut =
        statutFilter === 'all' ||
        (statutFilter === 'valide' && !expire) ||
        (statutFilter === 'expire' && expire);

      return matchesSearch && matchesCategorie && matchesStatut;
    });
  }, [permis, searchTerm, categorieFilter, statutFilter, personnelsMap]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategorieFilter('all');
    setStatutFilter('all');
  };

  const handleRowClick = (p) => {
    setSelected((prev) => (prev?.id === p.id ? null : p));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await permisConduiteService.update(selected.id, payload);
    else await permisConduiteService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le permis',
      message: 'Supprimer ce permis de conduire ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await permisConduiteService.remove(selected.id);
          setPermis((prev) => prev.filter((p) => p.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression de ce permis.');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Conducteur', 'Matricule', 'Numéro permis', 'Catégories', 'Date délivrance', "Date d'expiration", 'Lieu', 'Statut'];
    const lignes = filtered.map((p) => {
      const pers = personnelsMap[p.personnelId];
      const expire = isExpire(p.dateExpiration);
      return [
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—').replace(/"/g, '""'),
        (pers?.matricule || '—').replace(/"/g, '""'),
        (p.numero || '—').replace(/"/g, '""'),
        (p.categories ?? []).map(categorieLabel).join(' / '),
        formatDate(p.dateDelivrance),
        p.dateExpiration ? formatDate(p.dateExpiration) : 'Sans expiration',
        (p.lieuDelivrance || '—').replace(/"/g, '""'),
        expire ? 'Expiré' : 'Valide',
      ];
    });

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permis-conduite-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleStats = () => alert('Dashboard à venir.');

  return (
    <div className="pc-container">

      {/* HEADER */}
      <div className="pc-header-card">
        <div className="pc-header-left">
          <div className="pc-header-icon-wrap">
            <IdCard size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>Permis de conduire</h2>
            <p className="pc-header-subtitle">
              Suivi des permis des conducteurs et de leurs catégories (réglementation tunisienne)
            </p>
          </div>
        </div>

        <div className="pc-stats">
          <div className="pc-stat">
            <span className="pc-stat-value">{stats.total}</span>
            <span className="pc-stat-label">Total</span>
          </div>
          <div className="pc-stat stat-active">
            <span className="pc-stat-value">{stats.valides}</span>
            <span className="pc-stat-label">Valides</span>
          </div>
          <div className="pc-stat stat-inactive">
            <span className="pc-stat-value">{stats.expires}</span>
            <span className="pc-stat-label">Expirés</span>
          </div>
          <div className="pc-stat stat-principal">
            <span className="pc-stat-value">{stats.poidsLourd}</span>
            <span className="pc-stat-label">Poids lourd / bus</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="pc-actions-bar">
        <button className="pc-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Ajouter</span>
        </button>

        <button
          className={`pc-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>

        <button
          className={`pc-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>
      </div>

      {/* FILTRES */}
      <div className="pc-filter-panel">
        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="pc-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="pc-filter-icon" />
            <input
              type="text"
              placeholder="Conducteur, numéro, lieu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            Catégorie
          </span>
          <div className="pc-filter-input-wrap">
            <select value={categorieFilter} onChange={(e) => setCategorieFilter(e.target.value)}>
              <option value="all">Toutes les catégories</option>
              {Object.entries(CATEGORIE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pc-filter-group">
          <span className="pc-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            Statut
          </span>
          <div className="pc-filter-input-wrap">
            <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="valide">Valide</option>
              <option value="expire">Expiré</option>
            </select>
          </div>
        </div>

        <button className="pc-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="pc-export-stack">
          <button className="pc-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="pc-export-btn print" onClick={handlePrint} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="pc-export-btn stats" onClick={handleStats} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="pc-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Conducteur</th>
              <th>N° permis</th>
              <th>Catégories</th>
              <th>Délivrance</th>
              <th>Expiration</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="pc-table-empty">
                  <div className="pc-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="pc-spin" />
                    <span>Chargement des permis...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="pc-table-empty">
                  <div className="pc-empty-state">
                    <IdCard size={32} strokeWidth={1.6} />
                    <span>
                      {permis.length === 0
                        ? "Aucun permis de conduire pour l'instant."
                        : 'Aucun permis ne correspond à ces filtres.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const pers = personnelsMap[p.personnelId];
                const expire = isExpire(p.dateExpiration);

                return (
                  <tr
                    key={p.id}
                    className={`pc-row ${selected?.id === p.id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(p)}
                  >
                    <td>
                      {pers ? (
                        <div className="pc-cell-driver">
                          <div className="pc-cell-driver-avatar">
                            <User size={14} strokeWidth={2.2} />
                          </div>
                          <div className="pc-cell-driver-text">
                            <span className="pc-cell-main">
                              {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                            </span>
                            {pers.matricule && (
                              <span className="pc-cell-sub">{pers.matricule}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="pc-cell-empty">—</span>
                      )}
                    </td>

                    <td>
                      <span className="pc-cell-main">{p.numero || '—'}</span>
                    </td>

                    <td>
                      <div className="pc-cat-list">
                        {(p.categories ?? []).length === 0 ? (
                          <span className="pc-cell-empty">—</span>
                        ) : (
                          (p.categories ?? []).map((c) => (
                            <span key={c} className="pc-cat-chip">{categorieLabel(c)}</span>
                          ))
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="pc-date-badge">
                        <Calendar size={11} strokeWidth={2.5} />
                        {formatDate(p.dateDelivrance)}
                      </span>
                    </td>

                    <td>
                      <span className="pc-date-badge">
                        <Calendar size={11} strokeWidth={2.5} />
                        {p.dateExpiration ? formatDate(p.dateExpiration) : 'Sans expiration'}
                      </span>
                    </td>

                    <td>
                      <span className={`pc-pill ${expire ? 'expire' : 'valide'}`}>
                        {expire ? (
                          <XCircle size={11} strokeWidth={2.5} />
                        ) : (
                          <CheckCircle2 size={11} strokeWidth={2.5} />
                        )}
                        {expire ? 'Expiré' : 'Valide'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PermisConduiteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        permis={selected}
        isEditing={!!selected}
      />

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
}
