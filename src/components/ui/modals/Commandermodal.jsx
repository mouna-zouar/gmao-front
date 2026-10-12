import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';
import { repartirStock } from '../../../services/Stockallocation';
import { ShoppingCart, X, Minus, Plus, Check, Loader2, AlertTriangle } from 'lucide-react';
import './Modal.css';
import './VehiculeModal.css';
import './CommanderModal.css';

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

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

  // ─── Chargement ───
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

        const idsArticles = [
          ...new Set((data ?? []).map((a) => a.prestataireArticlesId).filter(Boolean)),
        ];
        const stockParArticle = {};

        await Promise.all(
          idsArticles.map(async (articleId) => {
            try {
              stockParArticle[articleId] = await pieceLigneService.getQuantiteDisponible(articleId);
            } catch (err) {
              console.error('Erreur quantité disponible', articleId, err);
              stockParArticle[articleId] = null;
            }
          })
        );

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

        const premier = data?.[0]?.sousTraitantId;
        setSousTraitantId(premier != null ? String(premier) : '');
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

  // ─── Sous-traitants ───
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

  const articlesACommander = articlesFiltres.filter((a) => checked[a.bonMaintenanceTacheId]);
  const totalQte = articlesACommander.reduce(
    (sum, a) => sum + (Number(qte[a.bonMaintenanceTacheId]) || 0),
    0
  );
  const allChecked =
    articlesFiltres.length > 0 &&
    articlesFiltres.every((a) => checked[a.bonMaintenanceTacheId]);

  // ─── Handlers ───
  const toggleArticle = (id) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleQteChange = (id, value) =>
    setQte((prev) => ({ ...prev, [id]: value === '' ? '' : Number(value) }));

  const handleQteStep = (id, delta) => {
    const current = Number(qte[id]) || 0;
    handleQteChange(id, Math.max(0, current + delta));
  };

  const toggleAll = () => {
    const next = { ...checked };
    articlesFiltres.forEach((a) => {
      next[a.bonMaintenanceTacheId] = !allChecked;
    });
    setChecked(next);
  };

  const handleCommander = async () => {
    if (articlesACommander.length === 0) {
      setSubmitError('Sélectionne au moins un article à commander.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const erreurs = [];
    for (const article of articlesACommander) {
      const q = qte[article.bonMaintenanceTacheId];
      if (q === '' || q == null || q <= 0) {
        erreurs.push(article);
        continue;
      }
      try {
        await bonMaintenanceDocumentAchatService.commander({
          bonMaintenanceId: bonMaintenance.id,
          cibleId: Number(sousTraitantId),
          prestataireArticlesId: article.prestataireArticlesId,
          qte: q,
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
        `${erreurs.length} article(s) sur ${articlesACommander.length} n'ont pas pu être commandés.`
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
    <div className="modal-overlay" onClick={handleClose}>
      <div className="bmm-modal cmd-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <ShoppingCart size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">Bon de maintenance</span>
              <h2>
                Commander — {bonMaintenance?.num || bonMaintenance?.titre || `Bon #${bonMaintenance?.id}`}
              </h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className="bmm-type-badge">{articlesACommander.length} art.</span>
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
        <div className="bmm-content cmd-body">
          {loading ? (
            <div className="cmd-empty">Chargement des articles disponibles...</div>
          ) : error ? (
            <div className="bmm-error">
              <AlertTriangle size={16} strokeWidth={2.5} />
              <span>{error}</span>
            </div>
          ) : sousTraitants.length === 0 ? (
            <div className="cmd-empty">
              Aucun article restant à commander pour ce bon.
            </div>
          ) : (
            <>
              {/* Sélecteur sous-traitant */}
              <div className="bmm-field">
                <label htmlFor="cmd-st">Sous-traitant</label>
                <select
                  id="cmd-st"
                  value={sousTraitantId}
                  onChange={(e) => setSousTraitantId(e.target.value)}
                >
                  {sousTraitants.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>

              {/* Toolbar */}
              {articlesFiltres.length > 0 && (
                <div className="cmd-toolbar">
                  <div className="cmd-toolbar__count">
                    <span
                      className={`cmd-toolbar__count-num ${
                        articlesACommander.length === 0 ? 'cmd-toolbar__count-num--zero' : ''
                      }`}
                    >
                      {articlesACommander.length}
                    </span>
                    <span>sélectionné{articlesACommander.length > 1 ? 's' : ''}</span>
                    <span className="cmd-toolbar__sep">·</span>
                    <span className="cmd-toolbar__hint">sur {articlesFiltres.length}</span>
                  </div>
                  <button type="button" className="cmd-toolbar__toggle" onClick={toggleAll}>
                    {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
              )}

              {/* Tableau */}
              <div className="cmd-table-wrap">
                <table className="cmd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Article</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Besoin</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Stock</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Restant</th>
                      <th style={{ width: 140, textAlign: 'center' }}>Qté</th>
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
                        const q = qte[a.bonMaintenanceTacheId];
                        const isChecked = !!checked[a.bonMaintenanceTacheId];
                        const { restant: stockRestant } =
                          repartition[a.bonMaintenanceTacheId] ?? { restant: null };

                        return (
                          <tr key={a.bonMaintenanceTacheId} className={!isChecked ? 'is-unchecked' : ''}>
                            <td>
                              <label className="cmd-check">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleArticle(a.bonMaintenanceTacheId)}
                                />
                                <span className="cmd-check__box"><IconCheck /></span>
                              </label>
                            </td>

                            <td className="cmd-cell-article">
                              {a.designation || `Article #${a.prestataireArticlesId}`}
                              {a.prestataireArticlesId && a.designation && (
                                <span className="cmd-cell-article__ref">
                                  Réf. #{a.prestataireArticlesId}
                                </span>
                              )}
                            </td>

                            <td className="cmd-cell-num">
                              <span className="cmd-cell-besoin__pill">{a.qteRestante}</span>
                            </td>

                            <td className="cmd-cell-num">
                              {dispo != null ? (
                                <span className="cmd-cell-stock__pill">{dispo}</span>
                              ) : (
                                <span className="cmd-cell-stock__pill cmd-cell-stock__pill--empty">—</span>
                              )}
                            </td>

                            <td className="cmd-cell-num">
                              {stockRestant != null ? (
                                <span
                                  className={`cmd-cell-stock__pill${
                                    stockRestant < 0 ? ' cmd-cell-stock__pill--negatif' : ''
                                  }`}
                                >
                                  {stockRestant}
                                </span>
                              ) : (
                                <span className="cmd-cell-stock__pill cmd-cell-stock__pill--empty">—</span>
                              )}
                            </td>

                            <td>
                              <div className="cmd-qte">
                                <button
                                  type="button"
                                  className="cmd-qte__step"
                                  onClick={() => handleQteStep(a.bonMaintenanceTacheId, -1)}
                                  disabled={Number(q || 0) <= 0}
                                  aria-label="Diminuer"
                                >
                                  <Minus size={11} strokeWidth={2.5} />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={q ?? ''}
                                  onChange={(e) => handleQteChange(a.bonMaintenanceTacheId, e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="cmd-qte__step"
                                  onClick={() => handleQteStep(a.bonMaintenanceTacheId, 1)}
                                  aria-label="Augmenter"
                                >
                                  <Plus size={11} strokeWidth={2.5} />
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

              {/* Récap inline */}
              {articlesACommander.length > 0 && (
                <div className="cmd-summary">
                  <span>
                    <strong>{articlesACommander.length}</strong> article
                    {articlesACommander.length > 1 ? 's' : ''} · total{' '}
                    <strong>{totalQte}</strong>
                  </span>
                </div>
              )}

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
              {articlesACommander.length} / {articlesFiltres.length}
            </span>
          </div>
          <div className="bmm-footer-right">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCommander}
              disabled={submitting || loading || articlesACommander.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Commande...
                </>
              ) : (
                <>
                  <ShoppingCart size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  Commander ({articlesACommander.length})
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CommanderModal;