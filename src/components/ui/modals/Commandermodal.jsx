import React, { useState, useEffect, useMemo } from 'react';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';
import { repartirStock } from '../../../services/Stockallocation';
import './CommanderModal.css';

/* ============================================================
   ICÔNES SVG
   ============================================================ */
const IconX = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconMinus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ============================================================
   COMPOSANT
   ============================================================ */
const CommanderModal = ({ isOpen, onClose, bonMaintenance, onCommandeCreee }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [articles, setArticles] = useState([]);
  const [disponible, setDisponible] = useState({});
  const [qte, setQte] = useState({});
  const [sousTraitantId, setSousTraitantId] = useState('');
  const [checked, setChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isOpen || !bonMaintenance?.id) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSubmitError(null);

      try {
        const data = await bonMaintenanceCommandeService.getArticlesDisponibles(bonMaintenance.id);
        setArticles(data ?? []);

        const disponibleParTache = {};
        const qteParTache = {};
        const initialChecked = {};

        // Un seul appel par article (plusieurs tâches peuvent partager le même article)
        const idsArticles = [
          ...new Set(
            (data ?? []).map((a) => a.prestataireArticlesId).filter(Boolean)
          ),
        ];
        const stockParArticle = {};

        await Promise.all(
          idsArticles.map(async (articleId) => {
            try {
              stockParArticle[articleId] =
                await pieceLigneService.getQuantiteDisponible(articleId);
            } catch (err) {
              console.error('Erreur quantité disponible', articleId, err);
              stockParArticle[articleId] = null;
            }
          })
        );

        // Quantité manquante par tâche, le stock étant partagé entre les tâches du même article
        const repartitionInitiale = repartirStock(
          (data ?? []).map((a) => ({
            key: a.bonMaintenanceTacheId,
            articleId: a.prestataireArticlesId,
            qte: a.qteRestante,
            dispo: stockParArticle[a.prestataireArticlesId] ?? null,
            actif: true,
          }))
        );

        (data ?? []).forEach((a) => {
          const key = a.bonMaintenanceTacheId;
          const dispo = stockParArticle[a.prestataireArticlesId] ?? null;
          disponibleParTache[key] = dispo;
          const manquant = dispo != null ? repartitionInitiale[key].manque : a.qteRestante;
          qteParTache[key] = manquant;
          initialChecked[key] = manquant > 0;
        });

        setDisponible(disponibleParTache);
        setQte(qteParTache);
        setChecked(initialChecked);

        const premierSousTraitant = data?.[0]?.sousTraitantId;
        setSousTraitantId(premierSousTraitant != null ? String(premierSousTraitant) : '');
      } catch (err) {
        console.error(err);
        setError("Impossible de charger les articles disponibles à la commande.");
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, bonMaintenance?.id]);

  const sousTraitants = useMemo(() => {
    const map = new Map();
    articles.forEach((a) => {
      if (a.sousTraitantId != null && !map.has(a.sousTraitantId)) {
        map.set(a.sousTraitantId, a.sousTraitantNom || `Sous-traitant #${a.sousTraitantId}`);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [articles]);

  const articlesFiltres = useMemo(() => {
    if (!sousTraitantId) return [];
    return articles.filter((a) => String(a.sousTraitantId) === String(sousTraitantId));
  }, [articles, sousTraitantId]);

  const toggleArticle = (bonMaintenanceTacheId) => {
    setChecked((prev) => ({ ...prev, [bonMaintenanceTacheId]: !prev[bonMaintenanceTacheId] }));
  };

  const handleQteChange = (bonMaintenanceTacheId, value) => {
    setQte((prev) => ({ ...prev, [bonMaintenanceTacheId]: value === '' ? '' : Number(value) }));
  };

  const handleQteStep = (bonMaintenanceTacheId, delta) => {
    const current = Number(qte[bonMaintenanceTacheId]) || 0;
    const next = Math.max(0, current + delta);
    handleQteChange(bonMaintenanceTacheId, next);
  };

  const articlesACommander = articlesFiltres.filter((a) => checked[a.bonMaintenanceTacheId]);

  const toggleAll = () => {
    const allChecked = articlesFiltres.length > 0 &&
      articlesFiltres.every((a) => checked[a.bonMaintenanceTacheId]);
    const next = { ...checked };
    articlesFiltres.forEach((a) => {
      next[a.bonMaintenanceTacheId] = !allChecked;
    });
    setChecked(next);
  };

  const totalQte = articlesACommander.reduce(
    (sum, a) => sum + (Number(qte[a.bonMaintenanceTacheId]) || 0),
    0
  );

  const allChecked = articlesFiltres.length > 0 &&
    articlesFiltres.every((a) => checked[a.bonMaintenanceTacheId]);

  const handleCommander = async () => {
    if (articlesACommander.length === 0) {
      setSubmitError('Sélectionne au moins un article à commander.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const erreurs = [];
    for (const article of articlesACommander) {
      const qteAEnvoyer = qte[article.bonMaintenanceTacheId];
      if (qteAEnvoyer === '' || qteAEnvoyer == null || qteAEnvoyer <= 0) {
        erreurs.push(article);
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await bonMaintenanceDocumentAchatService.commander({
          bonMaintenanceId: bonMaintenance.id,
          cibleId: Number(sousTraitantId),
          prestataireArticlesId: article.prestataireArticlesId,
          qte: qteAEnvoyer,
          bonMaintenanceTacheId: article.bonMaintenanceTacheId,
        });
      } catch (err) {
        console.error('Échec commande article', article, err);
        erreurs.push(article);
      }
    }

    setSubmitting(false);

    if (erreurs.length > 0) {
      setSubmitError(
        `${erreurs.length} article(s) sur ${articlesACommander.length} n'ont pas pu être commandés (quantité invalide ou échec serveur).`
      );
      return;
    }

    if (onCommandeCreee) onCommandeCreee();
    onClose();
  };

  const handleClose = () => {
    if (submitting) return;
    setSubmitError(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // Stock partagé entre les lignes d'un même article (ordre d'affichage)
  const repartition = repartirStock(
    articlesFiltres.map((a) => ({
      key: a.bonMaintenanceTacheId,
      articleId: a.prestataireArticlesId,
      qte: qte[a.bonMaintenanceTacheId],
      dispo: disponible[a.bonMaintenanceTacheId],
      actif: !!checked[a.bonMaintenanceTacheId],
    }))
  );

  return (
    <div className="cmd-overlay" onClick={handleClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>

        {/* ============================== */}
        {/* HEADER                          */}
        {/* ============================== */}
        <div className="cmd-header">
          <div className="cmd-header__text">
            <span className="cmd-header__eyebrow">Bon de maintenance</span>
            <h2>
              Commander — {bonMaintenance?.num || bonMaintenance?.titre || `Bon #${bonMaintenance?.id}`}
            </h2>
            <p className="cmd-header__subtitle">
              Sélectionne les articles à commander chez le sous-traitant et ajuste les quantités.
            </p>
          </div>

          <button
            type="button"
            className="cmd-close-btn"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fermer"
          >
            <IconX />
          </button>
        </div>

        {/* ============================== */}
        {/* BODY                            */}
        {/* ============================== */}
        <div className="cmd-body">

          {loading ? (
            <p className="cmd-empty">Chargement des articles disponibles...</p>

          ) : error ? (
            <p className="cmd-empty cmd-error">{error}</p>

          ) : sousTraitants.length === 0 ? (
            <p className="cmd-empty">
              Aucun article restant à commander pour ce bon (aucune tâche avec article + sous-traitant assignés, ou tout est déjà commandé).
            </p>

          ) : (
            <>
              {/* -------- Sélecteur sous-traitant -------- */}
              <div className="cmd-field">
                <label>Sous-traitant</label>
                <div className="cmd-select-wrap">
                  <select
                    value={sousTraitantId}
                    onChange={(e) => setSousTraitantId(e.target.value)}
                  >
                    {sousTraitants.map((s) => (
                      <option key={s.id} value={s.id}>{s.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* -------- Toolbar sélection -------- */}
              {articlesFiltres.length > 0 && (
                <div className="cmd-toolbar">
                  <div className="cmd-toolbar__count">
                    <span
                      className={`cmd-toolbar__count-num ${
                        articlesACommander.length === 0
                          ? 'cmd-toolbar__count-num--zero'
                          : ''
                      }`}
                    >
                      {articlesACommander.length}
                    </span>
                    <span>
                      sélectionné{articlesACommander.length > 1 ? 's' : ''}
                    </span>
                    <span className="cmd-toolbar__sep">·</span>
                    <span className="cmd-toolbar__hint">
                      sur {articlesFiltres.length} au total
                    </span>
                  </div>

                  <button
                    type="button"
                    className="cmd-toolbar__toggle"
                    onClick={toggleAll}
                  >
                    {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
              )}

              {/* -------- Tableau -------- */}
              <div className="cmd-table-wrap">
                <table className="cmd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Article</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Besoin</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Stock dispo</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Stock restant</th>
                      <th style={{ width: 140, textAlign: 'center' }}>Qté à commander</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articlesFiltres.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="cmd-empty-cell">
                          Aucun article pour ce sous-traitant.
                        </td>
                      </tr>
                    ) : (
                      articlesFiltres.map((a) => {
                        const dispo = disponible[a.bonMaintenanceTacheId];
                        const quantite = qte[a.bonMaintenanceTacheId];
                        const isChecked = !!checked[a.bonMaintenanceTacheId];

                        // Stock restant, en tenant compte des autres lignes du même article
                        const { restant: stockRestant } =
                          repartition[a.bonMaintenanceTacheId] ?? { restant: null };

                        return (
                          <tr key={a.bonMaintenanceTacheId} className={!isChecked ? 'is-unchecked' : ''}>
                            {/* Checkbox premium */}
                            <td>
                              <label className="cmd-check">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArticle(a.bonMaintenanceTacheId)}
                                />
                                <span className="cmd-check__box">
                                  <IconCheck />
                                </span>
                              </label>
                            </td>

                            {/* Article */}
                            <td className="cmd-cell-article">
                              {a.designation || `Article #${a.prestataireArticlesId}`}
                              {a.prestataireArticlesId && a.designation && (
                                <span className="cmd-cell-article__ref">
                                  Réf. #{a.prestataireArticlesId}
                                </span>
                              )}
                            </td>

                            {/* Besoin */}
                            <td className="cmd-cell-num">
                              <span className="cmd-cell-besoin__pill">{a.qteRestante}</span>
                            </td>

                            {/* Stock dispo */}
                            <td className="cmd-cell-num cmd-cell-stock">
                              {dispo != null ? (
                                <span className="cmd-cell-stock__pill">{dispo}</span>
                              ) : (
                                <span className="cmd-cell-stock__pill cmd-cell-stock__pill--empty">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Stock restant */}
                            <td className="cmd-cell-num cmd-cell-stock">
                              {stockRestant != null ? (
                                <span
                                  className={`cmd-cell-stock__pill${
                                    stockRestant < 0 ? ' cmd-cell-stock__pill--negatif' : ''
                                  }`}
                                  title={
                                    stockRestant < 0
                                      ? 'Stock insuffisant'
                                      : 'Stock restant après la quantité saisie'
                                  }
                                >
                                  {stockRestant}
                                </span>
                              ) : (
                                <span className="cmd-cell-stock__pill cmd-cell-stock__pill--empty">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Quantité avec stepper */}
                            <td>
                              <div className="cmd-qte">
                                <button
                                  type="button"
                                  className="cmd-qte__step cmd-qte__step--minus"
                                  onClick={() => handleQteStep(a.bonMaintenanceTacheId, -1)}
                                  disabled={Number(quantite || 0) <= 0}
                                  aria-label="Diminuer"
                                >
                                  <IconMinus />
                                </button>

                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={quantite ?? ''}
                                  onChange={(e) => handleQteChange(a.bonMaintenanceTacheId, e.target.value)}
                                />

                                <button
                                  type="button"
                                  className="cmd-qte__step cmd-qte__step--plus"
                                  onClick={() => handleQteStep(a.bonMaintenanceTacheId, 1)}
                                  aria-label="Augmenter"
                                >
                                  <IconPlus />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* -------- Récapitulatif -------- */}
              {articlesACommander.length > 0 && (
                <div className="cmd-summary">
                  <span className="cmd-summary__item cmd-summary__item--accent">
                    <strong>{articlesACommander.length}</strong> article
                    {articlesACommander.length > 1 ? 's' : ''} à commander
                  </span>
                  <span className="cmd-summary__item">
                    Quantité totale : <strong>{totalQte}</strong>
                  </span>
                </div>
              )}

              {/* -------- Erreur de soumission -------- */}
              {submitError && (
                <div className="cmd-form-error">{submitError}</div>
              )}
            </>
          )}
        </div>

        {/* ============================== */}
        {/* FOOTER                          */}
        {/* ============================== */}
        <div className="cmd-footer">
          <div className="cmd-nav-buttons">
            <button
              type="button"
              className="cmd-submit-btn"
              onClick={handleCommander}
              disabled={submitting || loading || articlesACommander.length === 0}
            >
              {submitting && <span className="cmd-spinner" aria-hidden="true" />}
              <span>{submitting ? 'Commande en cours...' : 'Commander'}</span>
              {!submitting && (
                <span className="cmd-submit-btn__count">
                  {articlesACommander.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="cmd-cancel-btn"
            onClick={handleClose}
            disabled={submitting}
          >
            <span>Annuler</span>
            <kbd>ESC</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommanderModal;