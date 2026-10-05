import React, { useState, useEffect } from 'react';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenancePieceService from '../../../services/bonMaintenancePieceService';
import pieceLigneService from '../../../services/pieceLigneService';
import { repartirStock } from '../../../services/Stockallocation';
import './DemanderModal.css';

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
const DemanderModal = ({
  isOpen,
  onClose,
  bonMaintenance,
  onDemandeCreee,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [articles, setArticles] = useState([]);
  const [disponible, setDisponible] = useState({});
  const [checked, setChecked] = useState({});
  const [qte, setQte] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  /* ==========================================================
     CHARGEMENT DES ARTICLES À DEMANDER
     ========================================================== */
  useEffect(() => {
    if (!isOpen || !bonMaintenance?.id) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      setSubmitError(null);

      try {
        const data = await bonMaintenanceCommandeService.getArticlesADemander(bonMaintenance.id);
        const articlesData = data ?? [];

        setArticles(articlesData);

        const disponibleParTache = {};
        const qteParTache = {};
        const initialChecked = {};

        // Un seul appel par article (plusieurs tâches peuvent partager le même article)
        const idsArticles = [
          ...new Set(
            articlesData.map((a) => a.prestataireArticlesId).filter(Boolean)
          ),
        ];
        const stockParArticle = {};

        await Promise.all(
          idsArticles.map(async (articleId) => {
            try {
              stockParArticle[articleId] =
                await pieceLigneService.getQuantiteDisponible(articleId);
            } catch (err) {
              console.error('Erreur récupération stock article', articleId, err);
              stockParArticle[articleId] = null;
            }
          })
        );

        articlesData.forEach((article) => {
          const key = article.bonMaintenanceTacheId;
          disponibleParTache[key] = stockParArticle[article.prestataireArticlesId] ?? null;
          qteParTache[key] = article.qteRestante;
          initialChecked[key] = true;
        });

        setDisponible(disponibleParTache);
        setQte(qteParTache);
        setChecked(initialChecked);
      } catch (err) {
        console.error('Erreur chargement articles à demander', err);
        setError('Impossible de charger les articles restant à demander.');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, bonMaintenance?.id]);

  /* ==========================================================
     FERMETURE VIA ESCAPE
     ========================================================== */
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape' && !submitting) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submitting]);

  /* ==========================================================
     ACTIONS
     ========================================================== */
  const toggleArticle = (bonMaintenanceTacheId) => {
    setChecked((prev) => ({
      ...prev,
      [bonMaintenanceTacheId]: !prev[bonMaintenanceTacheId],
    }));
  };

  const handleQteChange = (bonMaintenanceTacheId, value) => {
    setQte((prev) => ({
      ...prev,
      [bonMaintenanceTacheId]: value === '' ? '' : Number(value),
    }));
  };

  const handleQteStep = (bonMaintenanceTacheId, delta) => {
    const current = Number(qte[bonMaintenanceTacheId]) || 0;
    const next = Math.max(0, current + delta);
    handleQteChange(bonMaintenanceTacheId, next);
  };

  const toggleAll = () => {
    const allChecked = articles.every((a) => checked[a.bonMaintenanceTacheId]);
    const next = {};
    articles.forEach((a) => {
      next[a.bonMaintenanceTacheId] = !allChecked;
    });
    setChecked(next);
  };

  /* ==========================================================
     ARTICLES SÉLECTIONNÉS
     ========================================================== */
  const articlesADemander = articles.filter(
    (article) => checked[article.bonMaintenanceTacheId]
  );

  const totalQte = articlesADemander.reduce(
    (sum, a) => sum + (Number(qte[a.bonMaintenanceTacheId]) || 0),
    0
  );

  const allChecked =
    articles.length > 0 &&
    articles.every((a) => checked[a.bonMaintenanceTacheId]);

  /* ==========================================================
     SOUMISSION
     ========================================================== */
  const handleDemander = async () => {
    if (articlesADemander.length === 0) {
      setSubmitError('Sélectionne au moins un article à demander.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const erreurs = [];

    for (const article of articlesADemander) {
      const qteAEnvoyer = qte[article.bonMaintenanceTacheId];

      if (qteAEnvoyer === '' || qteAEnvoyer == null || Number(qteAEnvoyer) <= 0) {
        erreurs.push(article);
        continue;
      }

      try {
        await bonMaintenancePieceService.create({
          bonMaintenanceId: bonMaintenance.id,
          prestataireArticlesId: article.prestataireArticlesId,
          modeStock: article.modeStock ?? 1,
          qte: Number(qteAEnvoyer),
        });
      } catch (err) {
        console.error('Échec demande article', article, err);
        erreurs.push(article);
      }
    }

    setSubmitting(false);

    if (erreurs.length > 0) {
      setSubmitError(
        `${erreurs.length} article(s) sur ${articlesADemander.length} n'ont pas pu être demandés.`
      );
      return;
    }

    if (onDemandeCreee) {
      onDemandeCreee();
    }

    onClose();
  };

  /* ==========================================================
     FERMETURE
     ========================================================== */
  const handleClose = () => {
    if (submitting) return;
    setSubmitError(null);
    setError(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  // Stock partagé entre les lignes d'un même article (ordre d'affichage)
  const repartition = repartirStock(
    articles.map((a) => ({
      key: a.bonMaintenanceTacheId,
      articleId: a.prestataireArticlesId,
      qte: qte[a.bonMaintenanceTacheId],
      dispo: disponible[a.bonMaintenanceTacheId],
      actif: !!checked[a.bonMaintenanceTacheId],
    }))
  );

  /* ==========================================================
     RENDU
     ========================================================== */
  return (
    <div className="dm-overlay" onClick={handleClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ============================== */}
        {/* HEADER                          */}
        {/* ============================== */}
        <div className="dm-header">
          <div className="dm-header__text">
            <span className="dm-header__eyebrow">Bon de maintenance</span>
            <h2>
              {bonMaintenance?.num ||
                bonMaintenance?.titre ||
                `Bon #${bonMaintenance?.id}`}
            </h2>
            <p className="dm-header__subtitle">
              Sélectionne les pièces à demander et ajuste les quantités si nécessaire.
            </p>
          </div>

          <button
            type="button"
            className="dm-close-btn"
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
        <div className="dm-body">

          {/* -------- Chargement -------- */}
          {loading ? (
            <p className="dm-empty">Chargement des articles...</p>

          ) : error ? (
            <p className="dm-empty dm-error">{error}</p>

          ) : articles.length === 0 ? (
            <p className="dm-empty">
              Aucun article restant à demander pour ce bon.
            </p>

          ) : (
            <>
              {/* -------- Toolbar sélection -------- */}
              <div className="dm-toolbar">
                <div className="dm-toolbar__count">
                  <span
                    className={`dm-toolbar__count-num ${
                      articlesADemander.length === 0
                        ? 'dm-toolbar__count-num--zero'
                        : ''
                    }`}
                  >
                    {articlesADemander.length}
                  </span>
                  <span>
                    sélectionné{articlesADemander.length > 1 ? 's' : ''}
                  </span>
                  <span className="dm-toolbar__sep">·</span>
                  <span className="dm-toolbar__hint">
                    sur {articles.length} au total
                  </span>
                </div>

                <button
                  type="button"
                  className="dm-toolbar__toggle"
                  onClick={toggleAll}
                >
                  {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              {/* -------- Tableau -------- */}
              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Article</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Besoin</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Stock dispo</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Stock restant</th>
                      <th style={{ width: 140, textAlign: 'center' }}>Qté à demander</th>
                    </tr>
                  </thead>

                  <tbody>
                    {articles.map((article) => {
                      const id = article.bonMaintenanceTacheId;
                      const dispo = disponible[id];
                      const quantite = qte[id];
                      const isChecked = !!checked[id];

                      // Stock restant / manque, en tenant compte des autres lignes du même article
                      const { restant: stockRestant, manque: qteACommander } =
                        repartition[id] ?? { restant: null, manque: 0 };

                      const stockInsuffisant = qteACommander > 0;

                      return (
                        <tr key={id} className={!isChecked ? 'is-unchecked' : ''}>
                          <td>
                            <label className="dm-check">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleArticle(id)}
                              />
                              <span className="dm-check__box">
                                <IconCheck />
                              </span>
                            </label>
                          </td>

                          <td className="dm-cell-article">
                            {article.designation ||
                              `Article #${article.prestataireArticlesId}`}
                            {article.prestataireArticlesId && article.designation && (
                              <span className="dm-cell-article__ref">
                                Réf. #{article.prestataireArticlesId}
                              </span>
                            )}
                          </td>

                          <td className="dm-cell-num">
                            <span className="dm-cell-besoin__pill">
                              {article.qteRestante}
                            </span>
                          </td>

                          <td className="dm-cell-num dm-cell-stock">
                            {dispo != null ? (
                              <span className="dm-cell-stock__pill">{dispo}</span>
                            ) : (
                              <span className="dm-cell-stock__pill dm-cell-stock__pill--empty">
                                —
                              </span>
                            )}
                          </td>

                          <td className="dm-cell-num dm-cell-stock">
                            {stockRestant != null ? (
                              <span
                                className={`dm-cell-stock__pill${
                                  stockRestant < 0 ? ' dm-cell-stock__pill--negatif' : ''
                                }`}
                                title={
                                  stockRestant < 0
                                    ? 'Stock insuffisant'
                                    : 'Stock restant après la demande'
                                }
                              >
                                {stockRestant}
                              </span>
                            ) : (
                              <span className="dm-cell-stock__pill dm-cell-stock__pill--empty">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <div
                              className={`dm-qte ${
                                stockInsuffisant ? 'is-insufficient' : ''
                              }`}
                            >
                              <button
                                type="button"
                                className="dm-qte__step dm-qte__step--minus"
                                onClick={() => handleQteStep(id, -1)}
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
                                onChange={(e) => handleQteChange(id, e.target.value)}
                              />

                              <button
                                type="button"
                                className="dm-qte__step dm-qte__step--plus"
                                onClick={() => handleQteStep(id, 1)}
                                aria-label="Augmenter"
                              >
                                <IconPlus />
                              </button>
                            </div>

                            {stockInsuffisant && (
                              <div className="dm-hint">
                                À commander : <strong>{qteACommander}</strong>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* -------- Récapitulatif -------- */}
              <div className="dm-summary">
                <span className="dm-summary__item dm-summary__item--accent">
                  <strong>{articlesADemander.length}</strong> article
                  {articlesADemander.length > 1 ? 's' : ''} à demander
                </span>
                <span className="dm-summary__item">
                  Quantité totale : <strong>{totalQte}</strong>
                </span>
              </div>

              {/* -------- Erreur de soumission -------- */}
              {submitError && (
                <div className="dm-form-error">{submitError}</div>
              )}
            </>
          )}
        </div>

        {/* ============================== */}
        {/* FOOTER                          */}
        {/* ============================== */}
        <div className="dm-footer">
          <div className="dm-nav-buttons">
            <button
              type="button"
              className="dm-submit-btn"
              onClick={handleDemander}
              disabled={
                submitting || loading || articlesADemander.length === 0
              }
            >
              {submitting && <span className="dm-spinner" aria-hidden="true" />}
              <span>{submitting ? 'Demande en cours...' : 'Demander'}</span>
              {!submitting && (
                <span className="dm-submit-btn__count">
                  {articlesADemander.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="dm-cancel-btn"
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

export default DemanderModal;