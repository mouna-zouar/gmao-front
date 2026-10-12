import React, { useState, useEffect, useMemo } from 'react';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import { t, locale } from '../../../i18n';
import './Bonmaintenancetachestable.css';

// Colonnes du kanban, dans l'ordre d'affichage
const COLONNES = [
  { etat: 1, label: 'Nouveau', cls: 'nouveau' },
  { etat: 2, label: 'Suspendu', cls: 'suspendu' },
  { etat: 3, label: 'En cours', cls: 'encours' },
  { etat: 4, label: 'Effectué', cls: 'termine' },
  { etat: 10, label: 'Annulé', cls: 'annule' },
];

function etatLabel(etat) {
  return t(COLONNES.find((c) => c.etat === etat)?.label ?? 'État {n}', { n: etat });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BonMaintenanceTachesKanban() {
  const [taches, setTaches] = useState([]);
  const [bonsParId, setBonsParId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverEtat, setDragOverEtat] = useState(null);

  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', confirmText: t("Confirmer"), onConfirm: null, error: null, confirming: false,
  });

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
      setError(t("Impossible de charger les tâches. Vérifie que le serveur est bien lancé."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ---------- Changement d'état (optimiste, avec retour arrière si refus) ----------
  const appliquerEtat = async (tache, nouvelEtat, { onError } = {}) => {
    const ancienneTache = tache;
    setSavingId(tache.id);
    setTaches((prev) => prev.map((tache_) => (tache_.id === tache.id ? { ...tache_, etat: nouvelEtat } : tache_)));
    try {
      const updated = await bonMaintenanceTacheService.update(tache.id, { ...tache, etat: nouvelEtat });
      setTaches((prev) => prev.map((tache_) => (tache_.id === updated.id ? updated : tache_)));
      return true;
    } catch (err) {
      console.error(err);
      setTaches((prev) => prev.map((tache_) => (tache_.id === ancienneTache.id ? ancienneTache : tache_)));
      const message = err.response?.data?.message || "Échec du changement d'état de la tâche.";
      if (onError) onError(message);
      else setErrorModal({ show: true, title: t("Changement d'état refusé"), message });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const closeConfirmModal = () =>
    setConfirmModal((prev) => ({ ...prev, show: false, error: null, confirming: false }));

  const deplacerTache = (tache, nouvelEtat) => {
    if (!tache || tache.etat === nouvelEtat) return;

    if (nouvelEtat === 10) {
      setConfirmModal({
        show: true,
        title: t("Annuler la tâche"),
        message: t('Annuler la tâche « {nom} » ?', { nom: tache.designation }),
        confirmText: t("Annuler la tâche"),
        error: null,
        confirming: false,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, confirming: true, error: null }));
          const ok = await appliquerEtat(tache, 10, {
            onError: (message) => setConfirmModal((prev) => ({ ...prev, confirming: false, error: message })),
          });
          if (ok) setConfirmModal((prev) => ({ ...prev, show: false, confirming: false }));
        },
      });
      return;
    }

    appliquerEtat(tache, nouvelEtat);
  };

  // ---------- Drag & drop ----------
  const handleDragStart = (e, tache) => {
    setDraggingId(tache.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tache.id));
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverEtat(null);
  };

  const handleDragOver = (e, etat) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverEtat !== etat) setDragOverEtat(etat);
  };

  const handleDrop = (e, etat) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain')) || draggingId;
    const tache = taches.find((tache_) => tache_.id === id);
    setDraggingId(null);
    setDragOverEtat(null);
    deplacerTache(tache, etat);
  };

  // ---------- Recherche ----------
  const filteredTaches = useMemo(() => {
    const terme = searchTerm.trim().toLowerCase();
    if (!terme) return taches;
    return taches.filter((tache) => {
      const bon = bonsParId[tache.bonMaintenanceId];
      return (
        (tache.designation?.toLowerCase() || '').includes(terme)
        || (bon?.num?.toLowerCase() || '').includes(terme)
        || (bon?.titre?.toLowerCase() || '').includes(terme)
      );
    });
  }, [taches, searchTerm, bonsParId]);

  const tachesParEtat = useMemo(() => {
    const map = {};
    COLONNES.forEach((c) => { map[c.etat] = []; });
    filteredTaches.forEach((tache) => {
      if (map[tache.etat]) map[tache.etat].push(tache);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)));
    return map;
  }, [filteredTaches]);

  return (
    <div className="bmk-container">
      <div className="bmk-header-card">
        <div className="bmk-header-title-box">
          <svg className="bmk-header-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <div>
            <h2>{t("Tâches — tous bons de maintenance")}</h2>
            <p className="bmk-header-subtitle">{t("Glissez une carte d'une colonne à l'autre pour changer son état")}</p>
          </div>
        </div>
        <span className="bmk-badge-total">{t('Total : {n}', { n: filteredTaches.length })}</span>
      </div>

      <div className="bmk-toolbar">
        <div className="bmk-search">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input
            type="text"
            placeholder={t("Rechercher par désignation, numéro ou titre de bon...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="bmk-reset" onClick={() => setSearchTerm('')}>{t("Réinitialiser")}</button>
      </div>

      {error && <div className="bmk-error-banner">{error}</div>}

      {loading ? (
        <div className="bmk-loading">{t("Chargement...")}</div>
      ) : (
        <div className="bmk-board">
          {COLONNES.map((col) => {
            const cartes = tachesParEtat[col.etat];
            const isOver = dragOverEtat === col.etat && draggingId != null;
            return (
              <section
                key={col.etat}
                className={`bmk-column bmk-column--${col.cls} ${isOver ? 'is-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.etat)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOverEtat(null);
                }}
                onDrop={(e) => handleDrop(e, col.etat)}
              >
                <header className="bmk-column-header">
                  <span className="bmk-column-title">
                    <span className="bmk-column-dot" />
                    {t(col.label)}
                  </span>
                  <span className="bmk-column-count">{cartes.length}</span>
                </header>

                <div className="bmk-column-body">
                  {cartes.length === 0 ? (
                    <div className="bmk-column-empty">{t("Aucune tâche")}</div>
                  ) : (
                    cartes.map((tache) => {
                      const bon = bonsParId[tache.bonMaintenanceId];
                      return (
                        <article
                          key={tache.id}
                          className={`bmk-card ${draggingId === tache.id ? 'is-dragging' : ''} ${savingId === tache.id ? 'is-saving' : ''}`}
                          draggable={savingId !== tache.id}
                          onDragStart={(e) => handleDragStart(e, tache)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="bmk-card-bon">
                            {bon ? (bon.num || bon.titre || t('Bon #{id}', { id: bon.id })) : t('Bon #{id}', { id: tache.bonMaintenanceId })}
                          </div>
                          <div className="bmk-card-title">
                            {tache.ordre != null ? `${tache.ordre}. ` : ''}{tache.designation}
                          </div>

                          <div className="bmk-card-dates">
                            <span>{formatDateTime(tache.dateDebut)}</span>
                            <span className="bmk-card-arrow">→</span>
                            <span>{formatDateTime(tache.dateFin)}</span>
                          </div>

                          <div className="bmk-card-footer">
                            {tache.qte != null ? <span className="bmk-card-qte">{t('Qté')} {tache.qte}</span> : <span />}

                            {/* Alternative au glisser-déposer (tactile / clavier) */}
                            <select
                              className="bmk-card-move"
                              value={tache.etat}
                              disabled={savingId === tache.id}
                              onChange={(e) => deplacerTache(tache, Number(e.target.value))}
                              aria-label={t("Changer l'état")}
                            >
                              {COLONNES.map((c) => (
                                <option key={c.etat} value={c.etat}>{t(c.label)}</option>
                              ))}
                            </select>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        error={confirmModal.error}
        confirming={confirmModal.confirming}
      />

      {errorModal.show && (
        <div className="modal-overlay confirm-overlay" onClick={() => setErrorModal({ show: false, title: '', message: '' })}>
          <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-content">
              <div className="confirm-modal-icon-wrapper">
                <svg width="48" height="48" className="modal-confirm-icon danger" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="confirm-modal-text">
                <h3>{errorModal.title}</h3>
                <p>{errorModal.message}</p>
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button
                type="button"
                className="confirm-btn primary danger"
                onClick={() => setErrorModal({ show: false, title: '', message: '' })}
              >
                {t("Fermer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}