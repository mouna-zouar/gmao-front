import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Plus, Pencil, Trash2, Search, Filter, RotateCcw,
  Download, Printer, BarChart3, Loader2,
  Car, User, Calendar, Gauge, Coins, MapPin,
  ShieldAlert, Activity, XCircle, Clock,
} from 'lucide-react';
import vehiculeIncidentService from '../../../../services/vehiculeIncidentService';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeIncidentModal from '../../../ui/modals/VehiculeIncidentModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import './VehiculeIncidents.css';

// Codes alignés sur le backend (voir commentaires sur les champs
// `type`, `gravite` et `etat` dans VehiculeIncident.java).
const TYPE_LABELS = {
  1: 'Accident',
  2: 'Panne',
  3: 'Vol',
  4: 'Dégradation',
  5: 'Autre',
};

const GRAVITE_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Grave',
};

const ETAT_LABELS = {
  0: 'Ouvert',
  1: 'En cours',
  2: 'Clôturé',
};

// `color` sert à la fois pour la pastille du tableau et pour les boutons
// de changement rapide d'état dans la barre d'actions.
const ETAT_META = {
  0: { class: 'declared',   Icon: AlertTriangle, color: 'amber' },
  1: { class: 'inprogress', Icon: Activity,      color: 'blue'  },
  2: { class: 'closed',     Icon: XCircle,       color: 'slate' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMontant(v) {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formatKm(v) {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('fr-FR')} km`;
}

function typeLabel(t) { return TYPE_LABELS[t] ?? `Type ${t}`; }
function graviteLabel(g) { return GRAVITE_LABELS[g] ?? `Gravité ${g}`; }
function etatLabel(e) { return ETAT_LABELS[e] ?? `État ${e}`; }

export default function VehiculeIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');
  const [graviteFilter, setGraviteFilter] = useState('all');

  const [vehiculesMap, setVehiculesMap] = useState({});
  const [personnelsMap, setPersonnelsMap] = useState({});

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingEtat, setIsUpdatingEtat] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false, type: 'warning', title: '', message: '',
    confirmText: 'Confirmer', onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, vehPage, persPage] = await Promise.all([
        vehiculeIncidentService.getAll(0, 100),
        vehiculeService.getAll(0, 500),
        personnelService.getAll(0, 500),
      ]);

      setIncidents(page.content ?? []);

      const vMap = {};
      (vehPage.content ?? []).forEach((v) => { vMap[v.id] = v; });
      setVehiculesMap(vMap);

      const pMap = {};
      (persPage.content ?? []).forEach((p) => { pMap[p.id] = p; });
      setPersonnelsMap(pMap);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les incidents. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Garde la sélection synchronisée après un rechargement de la liste
  // (utile après un changement d'état rapide).
  useEffect(() => {
    if (!selected) return;
    const fresh = incidents.find((i) => i.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [incidents]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = incidents.length;
    const declares = incidents.filter((i) => i.etat === 0).length;
    const enCours = incidents.filter((i) => i.etat === 1).length;
    const resolus = incidents.filter((i) => i.etat === 2 || i.etat === 3).length;
    const coutTotal = incidents.reduce((sum, i) => sum + (Number(i.cout) || 0), 0);
    return { total, declares, enCours, resolus, coutTotal };
  }, [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      const veh = vehiculesMap[i.vehiculeId];
      const pers = personnelsMap[i.conducteurId];

      const haystack = [
        veh?.matricule, veh?.marque,
        pers?.nom, pers?.prenom, pers?.matricule,
        i.description,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
      const matchesEtat = etatFilter === 'all' || String(i.etat) === etatFilter;
      const matchesGravite = graviteFilter === 'all' || String(i.gravite) === graviteFilter;

      return matchesSearch && matchesEtat && matchesGravite;
    });
  }, [incidents, searchTerm, etatFilter, graviteFilter, vehiculesMap, personnelsMap]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
    setGraviteFilter('all');
  };

  const handleRowClick = (i) => {
    setSelected((prev) => (prev?.id === i.id ? null : i));
  };

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = () => { if (selected) setModalOpen(true); };

  const handleSave = async (payload) => {
    if (selected) await vehiculeIncidentService.update(selected.id, payload);
    else await vehiculeIncidentService.create(payload);
    setSelected(null);
    await load();
  };

  const closeConfirmModal = () => setConfirmModal((p) => ({ ...p, show: false }));

  const handleDelete = () => {
    if (!selected || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: "Supprimer l'incident",
      message: `Supprimer cet incident ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeIncidentService.remove(selected.id);
          setIncidents((prev) => prev.filter((i) => i.id !== selected.id));
          setSelected(null);
        } catch (err) {
          console.error(err);
          alert('Échec de la suppression.');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  // Changement rapide d'état depuis la barre d'action.
  // On reconstruit le payload complet à partir de l'incident sélectionné
  // pour ne modifier QUE le champ `etat`.
  const handleQuickEtat = async (newEtat) => {
    if (!selected || isUpdatingEtat) return;
    if (Number(selected.etat) === Number(newEtat)) return;

    setIsUpdatingEtat(true);
    try {
      const payload = {
        vehiculeId: selected.vehiculeId,
        type: selected.type,
        dateIncident: selected.dateIncident,
        emplacementId: selected.emplacementId,
        conducteurId: selected.conducteurId,
        description: selected.description,
        gravite: selected.gravite,
        etat: Number(newEtat),
        kilometrage: selected.kilometrage,
        cout: selected.cout,
        gmaoId: selected.gmaoId,
        personnelCreationId: selected.personnelCreationId,
        commentaire: selected.commentaire,
      };
      await vehiculeIncidentService.update(selected.id, payload);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Échec du changement d'état.");
    } finally {
      setIsUpdatingEtat(false);
    }
  };

  const handleExportExcel = () => {
    const entetes = ['Véhicule', 'Conducteur', 'Type', 'Date', 'Gravité', 'État', 'Coût (DT)'];
    const lignes = filtered.map((i) => {
      const veh = vehiculesMap[i.vehiculeId];
      const pers = personnelsMap[i.conducteurId];
      return [
        (veh?.matricule || '—').replace(/"/g, '""'),
        (pers ? `${pers.nom || ''} ${pers.prenom || ''}`.trim() : '—').replace(/"/g, '""'),
        typeLabel(i.type),
        formatDate(i.dateIncident),
        graviteLabel(i.gravite),
        etatLabel(i.etat),
        i.cout ?? '—',
      ];
    });

    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${c}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicule-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();
  const handleStats = () => alert('Dashboard à venir.');

  // États vers lesquels on peut basculer (tous sauf l'état courant).
  const nextEtats = selected
    ? Object.keys(ETAT_META)
        .map(Number)
        .filter((k) => k !== Number(selected.etat))
    : [];

  return (
    <div className="vin-container">

      {/* HEADER */}
      <div className="vin-header-card">
        <div className="vin-header-left">
          <div className="vin-header-icon-wrap">
            <AlertTriangle size={24} strokeWidth={2} />
          </div>
          <div>
            <h2>Incidents véhicule</h2>
            <p className="vin-header-subtitle">
              Suivi des accidents, pannes et événements sur le parc
            </p>
          </div>
        </div>

        <div className="vin-stats">
          <div className="vin-stat">
            <span className="vin-stat-value">{stats.total}</span>
            <span className="vin-stat-label">Total</span>
          </div>
          <div className="vin-stat stat-declared">
            <span className="vin-stat-value">{stats.declares}</span>
            <span className="vin-stat-label">Déclarés</span>
          </div>
          <div className="vin-stat stat-progress">
            <span className="vin-stat-value">{stats.enCours}</span>
            <span className="vin-stat-label">En cours</span>
          </div>
          <div className="vin-stat stat-resolved">
            <span className="vin-stat-value">{stats.resolus}</span>
            <span className="vin-stat-label">Résolus</span>
          </div>
          <div className="vin-stat stat-cost">
            <span className="vin-stat-value">{formatMontant(stats.coutTotal)}</span>
            <span className="vin-stat-label">Coût</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vin-actions-bar">
        <button className="vin-action-btn ajouter" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Nouvel incident</span>
        </button>

        <button
          className={`vin-action-btn modifier ${!selected ? 'disabled' : ''}`}
          disabled={!selected}
          onClick={openEdit}
        >
          <Pencil size={18} strokeWidth={2.2} />
          <span>Modifier</span>
        </button>

        <button
          className={`vin-action-btn supprimer ${(!selected || isDeleting) ? 'disabled' : ''}`}
          disabled={!selected || isDeleting}
          onClick={handleDelete}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>

        {/* Boutons de changement rapide d'état (visibles si un incident est sélectionné) */}
        {selected && nextEtats.length > 0 && (
          <>
            <span className="vin-actions-sep" aria-hidden="true" />
            {nextEtats.map((target) => {
              const meta = ETAT_META[target];
              const Icon = meta.Icon;
              return (
                <button
                  key={target}
                  type="button"
                  className={`vin-action-btn etat-quick color-${meta.color} ${isUpdatingEtat ? 'disabled' : ''}`}
                  disabled={isUpdatingEtat}
                  title={`Passer à : ${etatLabel(target)}`}
                  onClick={() => handleQuickEtat(target)}
                >
                  {isUpdatingEtat ? (
                    <Loader2 size={16} strokeWidth={2.4} className="vin-spin" />
                  ) : (
                    <Icon size={16} strokeWidth={2.4} />
                  )}
                  <span>{etatLabel(target)}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* FILTRES */}
      <div className="vin-filter-panel">
        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <Search size={14} strokeWidth={2.5} />
            Recherche
          </span>
          <div className="vin-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vin-filter-icon" />
            <input
              type="text"
              placeholder="Véhicule, conducteur, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <Filter size={14} strokeWidth={2.5} />
            État
          </span>
          <div className="vin-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous les états</option>
              {Object.entries(ETAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="vin-filter-group">
          <span className="vin-filter-label">
            <ShieldAlert size={14} strokeWidth={2.5} />
            Gravité
          </span>
          <div className="vin-filter-input-wrap">
            <select value={graviteFilter} onChange={(e) => setGraviteFilter(e.target.value)}>
              <option value="all">Toutes les gravités</option>
              {Object.entries(GRAVITE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vin-filter-reset" onClick={handleResetFilters}>
          <RotateCcw size={14} strokeWidth={2.5} />
          Réinitialiser
        </button>

        <div className="vin-export-stack">
          <button className="vin-export-btn excel" onClick={handleExportExcel} title="Export CSV">
            <Download size={16} strokeWidth={2.5} />
          </button>
          <button className="vin-export-btn print" onClick={handlePrint} title="Imprimer">
            <Printer size={16} strokeWidth={2.5} />
          </button>
          <button className="vin-export-btn stats" onClick={handleStats} title="Stats">
            <BarChart3 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {error && (
        <div className="vin-error-banner">
          <AlertTriangle size={18} strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vin-table-wrap">
        <table className="vin-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Conducteur</th>
              <th>Type</th>
              <th>Date</th>
              <th>Gravité</th>
              <th>Coût</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="vin-table-empty">
                  <div className="vin-empty-state">
                    <Loader2 size={26} strokeWidth={2} className="vin-spin" />
                    <span>Chargement des incidents...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="vin-table-empty">
                  <div className="vin-empty-state">
                    <AlertTriangle size={32} strokeWidth={1.6} />
                    <span>
                      {incidents.length === 0
                        ? "Aucun incident enregistré."
                        : 'Aucun incident ne correspond à ces filtres.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const veh = vehiculesMap[i.vehiculeId];
                const pers = personnelsMap[i.conducteurId];
                const meta = ETAT_META[i.etat] ?? ETAT_META[0];
                const EtatIcon = meta.Icon;
                return (
                  <tr
                    key={i.id}
                    className={`vin-row ${selected?.id === i.id ? 'selected' : ''}`}
                    onClick={() => handleRowClick(i)}
                  >
                    <td>
                      <div className="vin-cell-vehicle">
                        <div className="vin-cell-vehicle-icon">
                          <Car size={14} strokeWidth={2.2} />
                        </div>
                        <div className="vin-cell-vehicle-text">
                          <span className="vin-cell-main">
                            {veh?.matricule || `Véhicule #${i.vehiculeId}`}
                          </span>
                          {veh?.marque && (
                            <span className="vin-cell-sub">{veh.marque}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      {pers ? (
                        <div className="vin-cell-driver">
                          <div className="vin-cell-driver-avatar">
                            <User size={14} strokeWidth={2.2} />
                          </div>
                          <span className="vin-cell-main">
                            {`${pers.nom || ''} ${pers.prenom || ''}`.trim()}
                          </span>
                        </div>
                      ) : (
                        <span className="vin-cell-empty">—</span>
                      )}
                    </td>

                    <td>
                      <span className="vin-tag">{typeLabel(i.type)}</span>
                    </td>

                    <td>
                      <span className="vin-cell-date">
                        <Calendar size={12} strokeWidth={2.5} />
                        {formatDate(i.dateIncident)}
                      </span>
                    </td>

                    <td>
                      <span className={`vin-gravite gravite-${i.gravite}`}>
                        {graviteLabel(i.gravite)}
                      </span>
                    </td>

                    <td>
                      <span className="vin-cell-amount">
                        <Coins size={13} strokeWidth={2.5} />
                        {formatMontant(i.cout)}
                      </span>
                    </td>

                    <td>
                      <span className={`vin-pill ${meta.class}`}>
                        <EtatIcon
                          size={12}
                          strokeWidth={2.5}
                          className={i.etat === 1 ? 'vin-spin' : ''}
                        />
                        {etatLabel(i.etat)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <VehiculeIncidentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        incident={selected}
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