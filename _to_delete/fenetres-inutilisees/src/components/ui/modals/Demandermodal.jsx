import React, { useState, useEffect } from 'react';
import Button from '../Button';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenancePieceService from '../../../services/bonMaintenancePieceService';
import pieceLigneService from '../../../services/pieceLigneService';
import { repartirStock } from '../../../services/Stockallocation';
import { Package, X, Minus, Plus, Check, Loader2, AlertTriangle } from 'lucide-react';
import './Modal.css';
import './VehiculeModal.css';
import './DemanderModal.css';

const IconCheck = () => (
  <Check strokeWidth={3.2} aria-hidden="true" />
);

const DemanderModal = ({ isOpen, onClose, bonMaintenance, onDemandeCreee }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [articles, setArticles] = useState([]);
  const [disponible, setDisponible] = useState({});
  const [checked, setChecked] = useState({});
  const [qte, setQte] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // ─── Chargement ───
  useEffect(() => {
    if (!isOpen || !bonMaintenance?.id) return;

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

        const idsArticles = [
          ...new Set(articlesData.map((a) => a.prestataireArticlesId).filter(Boolean)),
        ];
        const stockParArticle = {};

        await Promise.all(
          idsArticles.map(async (articleId) => {
            try {
              stockParArticle[articleId] = await pieceLigneService.getQuantiteDisponible(articleId);
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

  // ─── Échap ───
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !submitting) handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submitting]);

  // ─── Actions ───
  const toggleArticle = (id) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleQteChange = (id, value) =>
    setQte((prev) => ({ ...prev, [id]: value === '' ? '' : Number(value) }));

  const handleQteStep = (id, delta) => {
    const current = Number(qte[id]) || 0;
    handleQteChange(id, Math.max(0, current + delta));
  };

  const toggleAll = () => {
    const allChecked = articles.every((a) => checked[a.bonMaintenanceTacheId]);
    const next = {};
    articles.forEach((a) => {
      next[a.bonMaintenanceTacheId] = !allChecked;
    });
    setChecked(next);
  };

  const articlesADemander = articles.filter((a) => checked[a.bonMaintenanceTacheId]);
  const totalQte = articlesADemander.reduce(
    (sum, a) => sum + (Number(qte[a.bonMaintenanceTacheId]) || 0),
    0
  );
  const allChecked =
    articles.length > 0 && articles.every((a) => checked[a.bonMaintenanceTacheId]);

  // ─── Soumission ───
  const handleDemander = async () => {
    if (articlesADemander.length === 0) {
      setSubmitError('Sélectionne au moins un article à demander.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const erreurs = [];
    for (const article of articlesADemander) {
      const q = qte[article.bonMaintenanceTacheId];
      if (q === '' || q == null || Number(q) <= 0) {
        erreurs.push(article);
        continue;
      }
      try {
        await bonMaintenancePieceService.create({
          bonMaintenanceId: bonMaintenance.id,
          prestataireArticlesId: article.prestataireArticlesId,
          modeStock: article.modeStock ?? 1,
          qte: Number(q),
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

    if (onDemandeCreee) onDemandeCreee();
    onClose();
  };

  const handleClose = () => {
    if (submitting) return;
    setSubmitError(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const repartition = repartirStock(
    articles.map((a) => ({
      key: a.bonMaintenanceTacheId,
      articleId: a.prestataireArticlesId,
      qte: qte[a.bonMaintenanceTacheId],
      dispo: disponible[a.bonMaintenanceTacheId],
      actif: !!checked[a.bonMaintenanceTacheId],
    }))
  );

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="bmm-modal dm-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Package size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">Bon de maintenance</span>
              <h2>
                Demander — {bonMaintenance?.num || bonMaintenance?.titre || `Bon #${bonMaintenance?.id}`}
              </h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className="bmm-type-badge">{articlesADemander.length} art.</span>
            <button
              type="button"
              className="bmm-close-btn"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="bmm-content dm-body">
          {loading ? (
            <div className="dm-empty">Chargement des articles...</div>
          ) : error ? (
            <div className="bmm-error">
              <AlertTriangle size={16} strokeWidth={2.5} />
              <span>{error}</span>
            </div>
          ) : articles.length === 0 ? (
            <div className="dm-empty">Aucun article restant à demander pour ce bon.</div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="dm-toolbar">
                <div className="dm-toolbar__count">
                  <span
                    className={`dm-toolbar__count-num ${
                      articlesADemander.length === 0 ? 'dm-toolbar__count-num--zero' : ''
                    }`}
                  >
                    {articlesADemander.length}
                  </span>
                  <span>sélectionné{articlesADemander.length > 1 ? 's' : ''}</span>
                  <span className="dm-toolbar__sep">·</span>
                  <span className="dm-toolbar__hint">sur {articles.length}</span>
                </div>
                <button type="button" className="dm-toolbar__toggle" onClick={toggleAll}>
                  {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              {/* Tableau */}
              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Article</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Besoin</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Stock</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Restant</th>
                      <th style={{ width: 150, textAlign: 'center' }}>Qté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => {
                      const id = article.bonMaintenanceTacheId;
                      const dispo = disponible[id];
                      const quantite = qte[id];
                      const isChecked = !!checked[id];

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
                              <span className="dm-check__box"><IconCheck /></span>
                            </label>
                          </td>

                          <td className="dm-cell-article">
                            {article.designation || `Article #${article.prestataireArticlesId}`}
                            {article.prestataireArticlesId && article.designation && (
                              <span className="dm-cell-article__ref">
                                Réf. #{article.prestataireArticlesId}
                              </span>
                            )}
                          </td>

                          <td className="dm-cell-num">
                            <span className="dm-cell-besoin__pill">{article.qteRestante}</span>
                          </td>

                          <td className="dm-cell-num dm-cell-stock">
                            {dispo != null ? (
                              <span className="dm-cell-stock__pill">{dispo}</span>
                            ) : (
                              <span className="dm-cell-stock__pill dm-cell-stock__pill--empty">—</span>
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
                              <span className="dm-cell-stock__pill dm-cell-stock__pill--empty">—</span>
                            )}
                          </td>

                          <td>
                            <div className={`dm-qte ${stockInsuffisant ? 'is-insufficient' : ''}`}>
                              <button
                                type="button"
                                className="dm-qte__step dm-qte__step--minus"
                                onClick={() => handleQteStep(id, -1)}
                                disabled={Number(quantite || 0) <= 0}
                                aria-label="Diminuer"
                              >
                                <Minus size={12} strokeWidth={2.5} />
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
                                <Plus size={12} strokeWidth={2.5} />
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

              {/* Récap inline */}
              <div className="dm-summary">
                <span className="dm-summary__item dm-summary__item--accent">
                  <strong>{articlesADemander.length}</strong> article
                  {articlesADemander.length > 1 ? 's' : ''} à demander
                </span>
                <span className="dm-summary__item">
                  Quantité totale : <strong>{totalQte}</strong>
                </span>
              </div>

              {submitError && (
                <div className="bmm-error" style={{ marginTop: 14 }}>
                  <AlertTriangle size={16} strokeWidth={2.5} />
                  <span>{submitError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="bmm-footer">
          <div className="bmm-footer-left">
            <span className="bmm-footer-step">
              {articlesADemander.length} / {articles.length}
            </span>
          </div>
          <div className="bmm-footer-right">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleDemander}
              disabled={submitting || loading || articlesADemander.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Demande...
                </>
              ) : (
                <>
                  <Package size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  Demander ({articlesADemander.length})
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DemanderModal;