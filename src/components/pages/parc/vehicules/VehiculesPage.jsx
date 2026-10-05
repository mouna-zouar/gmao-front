import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Bookmark, Navigation, Wrench, Ban, XCircle, Tag, Loader2,
  AlertTriangle, Settings, Truck, ShieldCheck, HardHat, AlertOctagon,
} from 'lucide-react';
import vehiculeService from '../../../../services/vehiculeService';
import vehiculeMaintenanceService from '../../../../services/vehiculeMaintenanceService';
import VehiculeMaintenancePanel from './VehiculeMaintenancePanel';
import VehiculeModal from '../../../ui/modals/VehiculeModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import VehiculeMaintenanceTypesSettings from './VehiculeMaintenanceTypesSettings';
import VehiculeKilometrageHistorique from './VehiculeKilometrageHistorique';
import {
  ETAT_VEHICULE_LABELS,
  etatVehiculeLabel,
  etatVehiculeColor,
  allowedNextEtats,
} from '../../../../constants/vehiculeEtat';
import { criticiteLabel, criticiteColor } from '../../../../constants/Criticite';
import './VehiculesPage.css';

const TYPE_LABELS = {
  0: 'Véhicule léger',
  1: 'Camion',
  2: 'Engin',
  3: 'Tracteur',
  4: 'Autre',
};

function typeLabel(type) {
  return TYPE_LABELS[type] ?? `Type ${type}`;
}

// Icône affichée pour chaque état CIBLE dans les boutons d'action rapide
// de la barre du haut (à côté de Modifier/Supprimer).
const ETAT_TARGET_ICON = {
  0: CheckCircle2,
  1: Bookmark,
  2: Navigation,
  3: Wrench,
  4: Ban,
  5: XCircle,
  6: Tag,
};

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');

  const [selectedVehicule, setSelectedVehicule] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingEtat, setIsUpdatingEtat] = useState(false);

  /** { [vehiculeId]: { enRetard, aVenir } } — chargement non bloquant. */
  const [alertesMaintenance, setAlertesMaintenance] = useState({});

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: 'warning',
    title: '',
    message: '',
    confirmText: 'Confirmer',
    onConfirm: null,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await vehiculeService.getAll(0, 100);
      setVehicules(page.content ?? []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les véhicules. Vérifie que le serveur est bien lancé.");
    } finally {
      setLoading(false);
    }
  };

  // Alertes de maintenance des véhicules affichés. Volontairement séparé du
  // chargement principal : une erreur ici ne doit pas empêcher l'affichage de
  // la liste des véhicules.
  useEffect(() => {
    if (!vehicules.length) {
      setAlertesMaintenance({});
      return;
    }

    let annule = false;

    (async () => {
      const entrees = await Promise.all(
        vehicules.map(async (v) => {
          try {
            const statuts = await vehiculeMaintenanceService.getStatuts(v.id);
            return [
              v.id,
              {
                enRetard: statuts.filter((st) => st.statut === 'EN_RETARD').length,
                aVenir: statuts.filter(
                  (st) => st.statut === 'A_VENIR' || st.statut === 'ATTEINT'
                ).length,
              },
            ];
          } catch {
            return [v.id, { enRetard: 0, aVenir: 0 }];
          }
        })
      );
      if (!annule) setAlertesMaintenance(Object.fromEntries(entrees));
    })();

    return () => {
      annule = true;
    };
  }, [vehicules]);

  useEffect(() => {
    load();
  }, []);

  // Garde `selectedVehicule` synchronisé avec la liste rechargée (utile
  // après un changement d'état rapide, pour que les boutons se
  // mettent à jour sans perdre la sélection).
  useEffect(() => {
    if (!selectedVehicule) return;
    const fresh = vehicules.find((v) => v.id === selectedVehicule.id);
    if (fresh && fresh !== selectedVehicule) setSelectedVehicule(fresh);
    if (!fresh) setSelectedVehicule(null);
  }, [vehicules]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredVehicules = useMemo(() => {
    return vehicules.filter((v) => {
      const matchesSearch = !searchTerm
        || v.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
        || v.marque?.toLowerCase().includes(searchTerm.toLowerCase())
        || v.numChassis?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEtat = etatFilter === 'all' || String(v.etat ?? 0) === etatFilter;

      return matchesSearch && matchesEtat;
    });
  }, [vehicules, searchTerm, etatFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setEtatFilter('all');
  };

  const handleRowClick = (vehicule) => {
    setSelectedVehicule((prev) => (prev?.id === vehicule.id ? null : vehicule));
  };

  const openCreate = () => {
    setSelectedVehicule(null);
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedVehicule) return;
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (selectedVehicule) {
      await vehiculeService.update(selectedVehicule.id, payload);
    } else {
      await vehiculeService.create(payload);
    }
    setSelectedVehicule(null);
    await load();
  };

  // Changement rapide d'état (cycle de vie) depuis la barre d'action.
  // Le backend (VehiculeServiceImpl.changeEtat) revalide la transition ;
  // ce front ne fait que proposer les boutons pertinents (UX), il ne
  // remplace pas la validation serveur.
  const handleQuickEtat = async (newEtat) => {
    if (!selectedVehicule || isUpdatingEtat) return;
    setIsUpdatingEtat(true);
    try {
      await vehiculeService.changeEtat(selectedVehicule.id, newEtat);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Échec du changement d'état.");
    } finally {
      setIsUpdatingEtat(false);
    }
  };

  /**
   * Après une création manuelle de bon : on recharge la liste pour que les
   * badges de maintenance (et l'état du véhicule si le bon l'a fait basculer)
   * reflètent la nouvelle situation.
   */
  const handleBonCree = () => {
    load();
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = () => {
    if (!selectedVehicule || isDeleting) return;
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Supprimer le véhicule',
      message: `Supprimer le véhicule "${selectedVehicule.matricule}" ? Cette action est irréversible.`,
      confirmText: 'Supprimer',
      onConfirm: async () => {
        closeConfirmModal();
        setIsDeleting(true);
        try {
          await vehiculeService.remove(selectedVehicule.id);
          setVehicules((prev) => prev.filter((v) => v.id !== selectedVehicule.id));
          setSelectedVehicule(null);
        } catch (err) {
          console.error(err);
          alert("Échec de la suppression de ce véhicule.");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleExportExcel = () => {
    const entetes = ['Matricule', 'Marque', 'N° Châssis', 'Type', 'Kilométrage', 'État'];
    const lignes = filteredVehicules.map((v) => [
      (v.matricule || '').replace(/"/g, '""'),
      (v.marque || '—').replace(/"/g, '""'),
      (v.numChassis || '—').replace(/"/g, '""'),
      typeLabel(v.type),
      v.kilometrage != null ? String(v.kilometrage) : '—',
      etatVehiculeLabel(v.etat),
    ]);

    const csv = [entetes, ...lignes]
      .map((ligne) => ligne.map((cellule) => `"${cellule}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStats = () => {
    alert('Ouvre le dashboard des véhicules pour les statistiques détaillées.');
  };

  const nextEtats = allowedNextEtats(selectedVehicule?.etat);

  // ── Statistiques KPI (mémoïsées) ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total = vehicules.length;
    const enService = vehicules.filter((v) => (v.etat ?? 0) === 0).length;
    const enMaintenance = vehicules.filter((v) => (v.etat ?? 0) === 3).length;
    const enAlerte = Object.values(alertesMaintenance).filter(
      (a) => a.enRetard > 0
    ).length;
    return { total, enService, enMaintenance, enAlerte };
  }, [vehicules, alertesMaintenance]);

  return (
    <div className="vehicules-container">

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="vehicules-header-card">
        <div className="vehicules-header-title-box">
          <svg className="vehicules-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
          <div>
            <h2>Véhicules</h2>
            <p className="vehicules-header-subtitle">
              Parc de véhicules suivis (matricule, marque, cycle de vie...)
            </p>
          </div>
        </div>
        <span className="vehicules-badge-total">Total : {filteredVehicules.length}</span>
      </div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <div className="vehicules-kpi-grid">
        <div className="vehicules-kpi-card kpi-total">
          <div className="vehicules-kpi-icon">
            <Truck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.total}</span>
            <span className="vehicules-kpi-label">Véhicules au total</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-service">
          <div className="vehicules-kpi-icon">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enService}</span>
            <span className="vehicules-kpi-label">En service</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-maintenance">
          <div className="vehicules-kpi-icon">
            <HardHat size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enMaintenance}</span>
            <span className="vehicules-kpi-label">En maintenance</span>
          </div>
        </div>

        <div className="vehicules-kpi-card kpi-alerte">
          <div className="vehicules-kpi-icon">
            <AlertOctagon size={20} strokeWidth={2.2} />
          </div>
          <div className="vehicules-kpi-body">
            <span className="vehicules-kpi-value">{stats.enAlerte}</span>
            <span className="vehicules-kpi-label">Alertes actives</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ ACTIONS BAR ═══════════════ */}
      <div className="vehicules-actions-bar">
        <button className="vehicules-action-btn ajouter" onClick={openCreate}>
          <span className="vehicules-action-icon">+</span>
          <span>Ajouter</span>
        </button>
        <button
          className={`vehicules-action-btn modifier ${!selectedVehicule ? 'disabled' : ''}`}
          disabled={!selectedVehicule}
          onClick={openEdit}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Modifier</span>
        </button>

        <button
          className={`vehicules-action-btn supprimer ${(!selectedVehicule || isDeleting) ? 'disabled' : ''}`}
          disabled={!selectedVehicule || isDeleting}
          onClick={handleDelete}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
        </button>

        {selectedVehicule && (
          <>
            <span className="vehicules-actions-sep" aria-hidden="true" />
            {nextEtats.length === 0 ? (
              <span className="vehicules-etat-locked">
                {etatVehiculeLabel(selectedVehicule.etat)} — état terminal, aucune action.
              </span>
            ) : (
              nextEtats.map((target) => {
                const Icon = ETAT_TARGET_ICON[target] ?? CheckCircle2;
                return (
                  <button
                    key={target}
                    type="button"
                    className={`vehicules-action-btn etat-quick color-${etatVehiculeColor(target)} ${isUpdatingEtat ? 'disabled' : ''}`}
                    disabled={isUpdatingEtat}
                    title={`Passer à : ${etatVehiculeLabel(target)}`}
                    onClick={() => handleQuickEtat(target)}
                  >
                    {isUpdatingEtat ? (
                      <Loader2 size={16} strokeWidth={2.5} className="vehicules-spin" />
                    ) : (
                      <Icon size={16} strokeWidth={2.5} />
                    )}
                    <span>{etatVehiculeLabel(target)}</span>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ═══════════════ FILTER PANEL ═══════════════ */}
      <div className="vehicules-filter-panel">
        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">Recherche</span>
          <div className="vehicules-filter-input-wrap">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par matricule, marque, châssis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="vehicules-filter-group">
          <span className="vehicules-filter-label">État</span>
          <div className="vehicules-filter-input-wrap">
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)}>
              <option value="all">Tous</option>
              {Object.entries(ETAT_VEHICULE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="vehicules-filter-reset" onClick={handleResetFilters}>
          Réinitialiser
        </button>
        <button
          type="button"
          className="vp-settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="Paramétrer les seuils de maintenance préventive"
        >
          <Settings size={16} /> Paramètres maintenance
        </button>
        <div className="vehicules-export-stack">
          <button className="vehicules-export-btn excel" title="Exporter en Excel (CSV)" onClick={handleExportExcel}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button className="vehicules-export-btn print" title="Imprimer" onClick={handlePrint}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zM9 9V5a2 2 0 012-2h2a2 2 0 012 2v4M7 13h10" />
            </svg>
          </button>
          <button className="vehicules-export-btn stats" title="Statistiques" onClick={handleStats}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="vehicules-error-banner">{error}</div>}

      {/* ═══════════════ TABLE ═══════════════ */}
      <div className="vehicules-table-wrap">
        <table className="vehicules-table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Marque</th>
              <th>Type</th>
              <th>Kilométrage</th>
              <th>État</th>
              <th>Criticité</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="vehicules-table-empty">Chargement...</td>
              </tr>
            ) : filteredVehicules.length === 0 ? (
              <tr>
                <td colSpan={6} className="vehicules-table-empty">
                  {vehicules.length === 0
                    ? "Aucun véhicule pour l'instant. Ajoute le premier avec le bouton ci-dessus."
                    : "Aucun véhicule ne correspond à ces filtres."}
                </td>
              </tr>
            ) : (
              filteredVehicules.map((v) => (
                <tr
                  key={v.id}
                  className={`vehicules-row ${selectedVehicule?.id === v.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(v)}
                >
                  <td>
                    <span className="vehicules-matricule-badge">
                      {v.matricule || `#${v.id}`}
                    </span>
                  </td>
                  <td>{v.marque || '—'}</td>
                  <td>{typeLabel(v.type)}</td>
                  <td>
                    {v.kilometrage != null
                      ? `${Number(v.kilometrage).toLocaleString('fr-FR')} km`
                      : '—'}
                    {alertesMaintenance[v.id]?.enRetard > 0 && (
                      <span
                        className="vp-badge-retard"
                        title={`${alertesMaintenance[v.id].enRetard} maintenance(s) en retard`}
                      >
                        <AlertTriangle size={12} strokeWidth={2.5} />
                        {alertesMaintenance[v.id].enRetard}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`vehicules-pill color-${etatVehiculeColor(v.etat)}`}>
                      {etatVehiculeLabel(v.etat)}
                    </span>
                  </td>
                  <td>
                    <span className={`vehicules-pill color-${criticiteColor(v.criticite)}`}>
                      {v.criticite || 'C3'} · {criticiteLabel(v.criticite)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════ DETAIL ZONE (fiche sélectionnée) ═══════════════ */}
      {selectedVehicule && (
        <div className="vehicules-detail-zone">

          {/* Bandeau contextuel : rappelle quel véhicule est ouvert */}
          <div className="vehicules-detail-header">
            <div className="vehicules-detail-header-left">
              <span className="vehicules-detail-accent" aria-hidden="true" />
              <div>
                <span className="vehicules-detail-eyebrow">
                  Fiche détaillée
                </span>
                <h3 className="vehicules-detail-title">
                  <span className="vehicules-matricule-badge">
                    {selectedVehicule.matricule || `#${selectedVehicule.id}`}
                  </span>
                  {selectedVehicule.marque && (
                    <span className="vehicules-detail-marque">
                      {selectedVehicule.marque}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <button
              type="button"
              className="vehicules-detail-close"
              onClick={() => setSelectedVehicule(null)}
              title="Fermer la fiche"
              aria-label="Fermer la fiche"
            >
              ×
            </button>
          </div>

          {/* Contenu : panneau maintenance + historique compteur */}
          <div className="vehicules-detail-content">
            <VehiculeMaintenancePanel
              vehicule={selectedVehicule}
              onOpenBon={(bonId) => { window.location.href = `/bons-maintenance?id=${bonId}`; }}
              onBonCree={handleBonCree}
            />
            <VehiculeKilometrageHistorique vehiculeId={selectedVehicule.id} />
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="vp-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="vp-settings-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="vp-settings-close"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
            <VehiculeMaintenanceTypesSettings />
          </div>
        </div>
      )}

      <VehiculeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        vehicule={selectedVehicule}
        isEditing={!!selectedVehicule}
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