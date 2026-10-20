import { useState, useEffect, useMemo } from 'react';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import { t, locale } from '../../../i18n';
import {  Search, SquareKanban, Table2, TriangleAlert } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';
import './Bonmaintenancetachestable.css';

// Colonnes du kanban, dans l'ordre d'affichage
const COLONNES = [
  { etat: 1, label: 'Nouveau', cls: 'nouveau' },
  { etat: 2, label: 'Suspendu', cls: 'suspendu' },
  { etat: 3, label: 'En cours', cls: 'encours' },
  { etat: 4, label: 'Effectué', cls: 'termine' },
  { etat: 10, label: 'Annulé', cls: 'annule' },
];

// Affichage choisi (tableau ou kanban), mémorisé pour ce navigateur
const CLE_VUE = 'bmk-vue';
function lireVue() {
  try { return window.localStorage.getItem(CLE_VUE) === 'tableau' ? 'tableau' : 'kanban'; } catch { return 'kanban'; }
}
function ecrireVue(v) {
  try { window.localStorage.setItem(CLE_VUE, v); } catch { /* stockage indisponible */ }
}

const IconeKanban = () => (
  <SquareKanban size={16} strokeWidth={2} aria-hidden="true" />
);
const IconeTableau = () => (
  <Table2 size={16} strokeWidth={2} aria-hidden="true" />
);

// Tri du tableau
const TRIS = {
  bon: (a, b) => String(a.bon).localeCompare(String(b.bon), undefined, { numeric: true }) || (a.t.ordre ?? 0) - (b.t.ordre ?? 0),
  designation: (a, b) => String(a.t.designation || '').localeCompare(String(b.t.designation || '')),
  debut: (a, b) => (Date.parse(a.t.dateDebut) || 0) - (Date.parse(b.t.dateDebut) || 0),
  fin: (a, b) => (Date.parse(a.t.dateFin) || 0) - (Date.parse(b.t.dateFin) || 0),
  etat: (a, b) => COLONNES.findIndex((c) => c.etat === a.t.etat) - COLONNES.findIndex((c) => c.etat === b.t.etat),
};

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
  const [vue, setVue] = useState(lireVue);
  const [filtreEtat, setFiltreEtat] = useState('tous');
  const [tri, setTri] = useState({ cle: 'bon', sens: 1 });

  const changerVue = (v) => { setVue(v); ecrireVue(v); };
  const trierPar = (cle) => setTri((t_) => ({ cle, sens: t_.cle === cle ? -t_.sens : 1 }));

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverEtat, setDragOverEtat] = useState(null);

  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', confirmText: t("Confirmer"), onConfirm: null, error: null, confirming: false,
  });

  // Chargement à l'ouverture (loading vaut déjà true au départ)
  useEffect(() => {
    let actif = true;
    Promise.all([
      bonMaintenanceTacheService.getAll(0, 500),
      bonMaintenanceService.getAll(0, 500),
    ])
      .then(([tachesPage, bonsPage]) => {
        if (!actif) return;
        setTaches(tachesPage.content ?? []);
        const map = {};
        (bonsPage.content ?? []).forEach((b) => { map[b.id] = b; });
        setBonsParId(map);
      })
      .catch((err) => {
        console.error(err);
        if (actif) setError(t("Impossible de charger les tâches. Vérifie que le serveur est bien lancé."));
      })
      .finally(() => { if (actif) setLoading(false); });
    return () => { actif = false; };
  }, []);

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

  const nomBon = (tache) => {
    const bon = bonsParId[tache.bonMaintenanceId];
    return bon ? (bon.num || bon.titre || t('Bon #{id}', { id: bon.id })) : t('Bon #{id}', { id: tache.bonMaintenanceId });
  };

  // Lignes du tableau : filtre d'état + tri par colonne
  const lignesTableau = useMemo(() => {
    const lignes = filteredTaches
      .filter((tache) => filtreEtat === 'tous' || tache.etat === Number(filtreEtat))
      .map((tache) => ({ t: tache, bon: nomBon(tache) }));
    lignes.sort((a, b) => TRIS[tri.cle](a, b) * tri.sens);
    return lignes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTaches, filtreEtat, tri, bonsParId]);

  const entete = (cle, libelle) => (
    <th aria-sort={tri.cle === cle ? (tri.sens === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="bmk-th-tri" onClick={() => trierPar(cle)}>
        {libelle}
        <span className="bmk-th-fleche" aria-hidden="true">{tri.cle === cle ? (tri.sens === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  const selectEtat = (tache) => (
    <select
      className="bmk-card-move"
      value={tache.etat}
      disabled={savingId === tache.id}
      onChange={(e) => deplacerTache(tache, Number(e.target.value))}
      aria-label={t('Changer l\'état de « {nom} »', { nom: tache.designation || '' })}
    >
      {COLONNES.map((c) => (
        <option key={c.etat} value={c.etat}>{t(c.label)}</option>
      ))}
    </select>
  );

  return (
    <div className="bmk-container">
      <div className="bmk-header-card">
        <div className="bmk-header-title-box">
          <ICONES_MODULES.tachesBons strokeWidth={2} className="bmk-header-icon" aria-hidden="true" />
          <div>
            <h2>{t("Tâches — tous bons de maintenance")}</h2>
            <p className="bmk-header-subtitle">
              {vue === 'kanban'
                ? t("Glissez une carte d'une colonne à l'autre pour changer son état")
                : t("Cliquez sur un titre de colonne pour trier ; changez l'état depuis la dernière colonne")}
            </p>
          </div>
        </div>
        <span className="bmk-badge-total">{t('Total : {n}', { n: vue === 'tableau' ? lignesTableau.length : filteredTaches.length })}</span>
      </div>

      <div className="bmk-toolbar">
        <div className="bmk-search">
          <Search strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            placeholder={t("Rechercher par désignation, numéro ou titre de bon...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {vue === 'tableau' && (
          <select className="bmk-filtre-etat" value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label={t('Filtrer par état')}>
            <option value="tous">{t('Tous les états')}</option>
            {COLONNES.map((c) => <option key={c.etat} value={c.etat}>{t(c.label)}</option>)}
          </select>
        )}
        <button className="bmk-reset" onClick={() => { setSearchTerm(''); setFiltreEtat('tous'); }}>{t("Réinitialiser")}</button>

        {/* Choix de l'affichage */}
        <div className="bmk-vues" role="group" aria-label={t("Affichage")}>
          <button type="button" className={`bmk-vue ${vue === 'tableau' ? 'is-active' : ''}`} aria-pressed={vue === 'tableau'} onClick={() => changerVue('tableau')}>
            <IconeTableau /> {t('Tableau')}
          </button>
          <button type="button" className={`bmk-vue ${vue === 'kanban' ? 'is-active' : ''}`} aria-pressed={vue === 'kanban'} onClick={() => changerVue('kanban')}>
            <IconeKanban /> {t('Kanban')}
          </button>
        </div>
      </div>

      {error && <div className="bmk-error-banner">{error}</div>}

      {loading ? (
        <div className="bmk-loading">{t("Chargement...")}</div>
      ) : vue === 'tableau' ? (
        <div className="bmk-table-carte">
          {lignesTableau.length === 0 ? (
            <div className="bmk-table-vide">{searchTerm || filtreEtat !== 'tous' ? t('Aucune tâche ne correspond à ces filtres.') : t('Aucune tâche')}</div>
          ) : (
            <div className="bmk-table-defilement">
              <table className="bmk-table">
                <thead>
                  <tr>
                    {entete('bon', t('Bon'))}
                    {entete('designation', t('Désignation'))}
                    {entete('debut', t('Début'))}
                    {entete('fin', t('Fin'))}
                    <th className="bmk-num">{t('Qté')}</th>
                    {entete('etat', t('État'))}
                    <th>{t("Changer l'état")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesTableau.map(({ t: tache, bon }) => (
                    <tr key={tache.id} className={savingId === tache.id ? 'is-saving' : ''}>
                      <td className="bmk-td-bon">{bon}</td>
                      <td className="bmk-td-designation">{tache.ordre != null ? <span className="bmk-ordre">{tache.ordre}.</span> : null} {tache.designation}</td>
                      <td className="bmk-td-date">{formatDateTime(tache.dateDebut)}</td>
                      <td className="bmk-td-date">{formatDateTime(tache.dateFin)}</td>
                      <td className="bmk-num">{tache.qte ?? '—'}</td>
                      <td><BadgeStatut type="tache" valeur={tache.etat} taille="petit" /></td>
                      <td>{selectEtat(tache)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                      return (
                        <article
                          key={tache.id}
                          className={`bmk-card ${draggingId === tache.id ? 'is-dragging' : ''} ${savingId === tache.id ? 'is-saving' : ''}`}
                          draggable={savingId !== tache.id}
                          onDragStart={(e) => handleDragStart(e, tache)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="bmk-card-bon">{nomBon(tache)}</div>
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
                            {selectEtat(tache)}
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
                <TriangleAlert size={48} strokeWidth={2} className="modal-confirm-icon danger" aria-hidden="true" />
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