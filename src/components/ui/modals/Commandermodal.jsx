import React, { useState, useEffect, useMemo } from 'react';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import pieceLigneService from '../../../services/pieceLigneService';
import './Modal.css';
import './CommanderModal.css';

const CommanderModal = ({ isOpen, onClose, bonMaintenance, onCommandeCreee }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [articles, setArticles] = useState([]);
  // disponible[bonMaintenanceTacheId] = quantité disponible en stock pour l'article de cette tâche
  const [disponible, setDisponible] = useState({});
  // qte[bonMaintenanceTacheId] = quantité à commander (éditable)
  const [qte, setQte] = useState({});

  const [sousTraitantId, setSousTraitantId] = useState('');
  // checked[bonMaintenanceTacheId] = booléen
  const [checked, setChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!isOpen || !bonMaintenance?.id) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await bonMaintenanceCommandeService.getArticlesDisponibles(bonMaintenance.id);
        setArticles(data ?? []);

        // Quantité disponible en stock par article, puis quantité par défaut à commander =
        // le manquant (besoin - disponible), c-à-d ce que le stock ne peut pas couvrir.
        // Coché uniquement si un manquant existe réellement (sinon rien à commander, Demander suffit).
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
            const manquant = dispo != null ? Math.max(0, a.qteRestante - dispo) : a.qteRestante;
            qteParTache[a.bonMaintenanceTacheId] = manquant;
            initialChecked[a.bonMaintenanceTacheId] = manquant > 0;
          })
        );

        setDisponible(disponibleParTache);
        setQte(qteParTache);
        setChecked(initialChecked);

        // Sous-traitant par défaut : le premier trouvé
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

  // Liste des sous-traitants distincts présents dans les articles disponibles
  const sousTraitants = useMemo(() => {
    const map = new Map();
    articles.forEach((a) => {
      if (a.sousTraitantId != null && !map.has(a.sousTraitantId)) {
        map.set(a.sousTraitantId, a.sousTraitantNom || `Sous-traitant #${a.sousTraitantId}`);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [articles]);

  // Articles filtrés pour le sous-traitant sélectionné
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

  const articlesACommander = articlesFiltres.filter((a) => checked[a.bonMaintenanceTacheId]);

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container commander-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Commander — {bonMaintenance?.num || bonMaintenance?.titre || `Bon #${bonMaintenance?.id}`}</h2>
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
          ) : sousTraitants.length === 0 ? (
            <p className="cmd-empty">
              Aucun article restant à commander pour ce bon (aucune tâche avec article + sous-traitant assignés, ou tout est déjà commandé).
            </p>
          ) : (
            <>
              <div className="cmd-field">
                <label>Sous-traitant</label>
                <select value={sousTraitantId} onChange={(e) => setSousTraitantId(e.target.value)}>
                  {sousTraitants.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>

              <div className="cmd-table-wrap">
                <table className="cmd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Article</th>
                      <th style={{ width: 80 }}>Besoin</th>
                      <th style={{ width: 90 }}>Stock dispo</th>
                      <th style={{ width: 100 }}>Qté à commander</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articlesFiltres.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="cmd-empty-cell">Aucun article pour ce sous-traitant.</td>
                      </tr>
                    ) : (
                      articlesFiltres.map((a) => {
                        const dispo = disponible[a.bonMaintenanceTacheId];
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
                                style={{ width: '70px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #dbe4e2' }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
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
              onClick={handleCommander}
              disabled={submitting || loading || articlesACommander.length === 0}
            >
              {submitting ? 'Commande en cours...' : `Commander (${articlesACommander.length})`}
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

export default CommanderModal;