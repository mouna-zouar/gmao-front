import React, { useState, useEffect } from 'react';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';
import './Modal.css';
import './CommanderModal.css';

const DemanderModal = ({ isOpen, onClose, bonMaintenance, onDemandeCreee }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [articles, setArticles] = useState([]);
  // disponible[bonMaintenanceTacheId] = quantité disponible en stock pour l'article de cette tâche
  const [disponible, setDisponible] = useState({});
  // checked[bonMaintenanceTacheId] = booléen
  const [checked, setChecked] = useState({});
  // qte[bonMaintenanceTacheId] = quantité à demander (éditable)
  const [qte, setQte] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isOpen || !bonMaintenance?.id) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await bonMaintenanceCommandeService.getArticlesADemander(bonMaintenance.id);
        setArticles(data ?? []);

        // Quantité disponible en stock par article, puis quantité par défaut à demander =
        // min(besoin, disponible) — on ne demande pas plus que ce que le stock peut couvrir.
        const disponibleParTache = {};
        const qteParTache = {};
        const initialChecked = {};

        await Promise.all(
          (data ?? []).map(async (a) => {
            let dispo = null;
            try {
              dispo = await pieceLigneService.getQuantiteDisponible(a.prestataireArticlesId);
            } catch (err) {
              console.error('Erreur quantité disponible', a.prestataireArticlesId, err);
            }
            disponibleParTache[a.bonMaintenanceTacheId] = dispo;
            qteParTache[a.bonMaintenanceTacheId] = dispo != null
              ? Math.min(a.qteRestante, dispo)
              : a.qteRestante;
            initialChecked[a.bonMaintenanceTacheId] = true;
          })
        );

        setDisponible(disponibleParTache);
        setQte(qteParTache);
        setChecked(initialChecked);
      } catch (err) {
        console.error(err);
        setError("Impossible de charger les articles restant à demander.");
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, bonMaintenance?.id]);

  const toggleArticle = (bonMaintenanceTacheId) => {
    setChecked((prev) => ({ ...prev, [bonMaintenanceTacheId]: !prev[bonMaintenanceTacheId] }));
  };

  const handleQteChange = (bonMaintenanceTacheId, value) => {
    setQte((prev) => ({ ...prev, [bonMaintenanceTacheId]: value === '' ? '' : Number(value) }));
  };

  const articlesADemander = articles.filter((a) => checked[a.bonMaintenanceTacheId]);

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
      if (qteAEnvoyer === '' || qteAEnvoyer == null || qteAEnvoyer <= 0) {
        erreurs.push(article);
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await bonMaintenanceDocumentAchatService.demander({
          bonMaintenanceId: bonMaintenance.id,
          prestataireArticlesId: article.prestataireArticlesId,
          qte: qteAEnvoyer,
          bonMaintenanceTacheId: article.bonMaintenanceTacheId,
        });
      } catch (err) {
        console.error('Échec demande article', article, err);
        erreurs.push(article);
      }
    }

    setSubmitting(false);

    if (erreurs.length > 0) {
      setSubmitError(
        `${erreurs.length} article(s) sur ${articlesADemander.length} n'ont pas pu être demandés (quantité invalide ou échec serveur).`
      );
      return;
    }

    if (onDemandeCreee) onDemandeCreee();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container commander-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Demander — {bonMaintenance?.num || bonMaintenance?.titre || `Bon #${bonMaintenance?.id}`}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="cmd-empty">Chargement des articles disponibles...</p>
          ) : error ? (
            <p className="cmd-empty cmd-error">{error}</p>
          ) : articles.length === 0 ? (
            <p className="cmd-empty">
              Aucun article restant à demander pour ce bon (aucune tâche avec article assigné, ou tout est déjà demandé).
            </p>
          ) : (
            <>
              <div className="cmd-table-wrap">
                <table className="cmd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Article</th>
                      <th style={{ width: 90 }}>Besoin</th>
                      <th style={{ width: 90 }}>Stock dispo</th>
                      <th style={{ width: 100 }}>Qté à demander</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((a) => {
                      const dispo = disponible[a.bonMaintenanceTacheId];
                      const qteInsuffisante = dispo != null && Number(qte[a.bonMaintenanceTacheId]) > dispo;
                      return (
                        <tr key={a.bonMaintenanceTacheId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!checked[a.bonMaintenanceTacheId]}
                              onChange={() => toggleArticle(a.bonMaintenanceTacheId)}
                            />
                          </td>
                          <td>{a.designation}</td>
                          <td>{a.qteRestante}</td>
                          <td>{dispo != null ? dispo : '—'}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={qte[a.bonMaintenanceTacheId] ?? ''}
                              onChange={(e) => handleQteChange(a.bonMaintenanceTacheId, e.target.value)}
                              style={{
                                width: '70px', padding: '5px 8px', borderRadius: '6px',
                                border: qteInsuffisante ? '1.5px solid #dc2626' : '1px solid #dbe4e2',
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {submitError && <div className="form-error">{submitError}</div>}
            </>
          )}
        </div>

        <div className="navigation-footer">
          <div className="nav-buttons">
            <button
              type="button"
              className="cmd-submit-btn"
              onClick={handleDemander}
              disabled={submitting || loading || articlesADemander.length === 0}
            >
              {submitting ? 'Demande en cours...' : `Demander (${articlesADemander.length})`}
            </button>
          </div>
          <button type="button" className="cmd-cancel-btn" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemanderModal;