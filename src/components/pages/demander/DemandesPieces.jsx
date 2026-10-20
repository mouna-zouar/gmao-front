import React, { useEffect, useState } from 'react';
import bonMaintenancePieceService from '../../../services/bonMaintenancePieceService';
import pieceLigneService from '../../../services/pieceLigneService';
import { t } from '../../../i18n';
import { Check, LoaderCircle, Package, RefreshCw, TriangleAlert, X } from 'lucide-react';
import './DemandesPieces.css';

/* ---------- Config ---------- */
const ETAT_LABELS = {
  EN_ATTENTE: 'En attente',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  COMMANDE: 'Commandée',
  SERVIE: 'Servie',
};

const ETAT_CLASS = {
  EN_ATTENTE: 'etat-attente',
  ACCEPTEE: 'etat-acceptee',
  REFUSEE: 'etat-refusee',
  COMMANDE: 'etat-commande',
  SERVIE: 'etat-servie',
};

/* ---------- Icônes SVG ---------- */
const IconRefresh = () => (
  <RefreshCw size={13} aria-hidden="true" />
);

const IconCheck = () => (
  <Check size={13} aria-hidden="true" />
);

const IconX = () => (
  <X size={13} aria-hidden="true" />
);

const IconAlert = () => (
  <TriangleAlert size={15} aria-hidden="true" />
);

const IconPackage = () => (
  <Package size={26} strokeWidth={1.6} aria-hidden="true" />
);

const IconSpinner = () => (
  <LoaderCircle size={13} strokeWidth={2.5} className="btn-spinner" aria-hidden="true" />
);

/* ---------- Composant ---------- */
const DemandesPieces = ({ bonMaintenanceId }) => {
  const [demandes, setDemandes] = useState([]);
  // Stock dispo par article : undefined = en cours, null = indisponible, nombre = stock
  const [stocks, setStocks] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [error, setError] = useState(null);

  /* ---------- Stock disponible (même source que le modal Demander et l'acceptation) ---------- */
  const chargerStocks = async (liste) => {
    const ids = [
      ...new Set(liste.map((d) => d.prestataireArticlesId).filter(Boolean)),
    ];

    const entrees = await Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await pieceLigneService.getQuantiteDisponible(id)];
        } catch (err) {
          console.error('Erreur récupération stock article', id, err);
          return [id, null];
        }
      })
    );

    setStocks(Object.fromEntries(entrees));
  };

  /* ---------- Chargement ---------- */
  const loadDemandes = async () => {
    if (!bonMaintenanceId) {
      setDemandes([]);
      setStocks({});
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await bonMaintenancePieceService.findByBonMaintenanceId(bonMaintenanceId);

      let demandesData = [];
      if (Array.isArray(data)) demandesData = data;
      else if (Array.isArray(data?.content)) demandesData = data.content;
      else if (Array.isArray(data?.data)) demandesData = data.data;

      setDemandes(demandesData);
      setStocks({});
      chargerStocks(demandesData); // sans await : le tableau s'affiche tout de suite
    } catch (err) {
      console.error('Erreur chargement demandes pièces', err);
      setError(err?.response?.data?.message || 'Impossible de charger les demandes.');
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDemandes(); }, [bonMaintenanceId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Actions ---------- */
  const handleAction = async (id, type) => {
    if (!id) return;
    try {
      setActionLoading(id);
      setActionType(type);
      setError(null);

      if (type === 'accepter') {
        await bonMaintenancePieceService.accepter(id);
      } else {
        await bonMaintenancePieceService.refuser(id);
      }

      await loadDemandes();
    } catch (err) {
      console.error(`Erreur ${type} demande`, err);
      setError(
        err?.response?.data?.message ||
        (type === 'accepter' ? t('Impossible d’accepter la demande.') : t('Impossible de refuser la demande.'))
      );
    } finally {
      setActionLoading(null);
      setActionType(null);
    }
  };

  const handleAccepter = (id) => handleAction(id, 'accepter');
  const handleRefuser = (id) => handleAction(id, 'refuser');

  const getEtatLabel = (etat) => t(ETAT_LABELS[etat] || etat || '—');
  const getEtatClass = (etat) => ETAT_CLASS[etat] || '';

  const renderStock = (demande) => {
    if (!demande.prestataireArticlesId) return '—';

    const stock = stocks[demande.prestataireArticlesId];
    if (stock === undefined) return <span className="stock-pill stock-pill--loading">…</span>;
    if (stock === null) return <span className="stock-pill stock-pill--empty">—</span>;

    const insuffisant =
      demande.etat === 'EN_ATTENTE' && Number(demande.qte) > Number(stock);

    return (
      <span
        className={`stock-pill${insuffisant ? ' stock-pill--insuffisant' : ''}`}
        title={insuffisant ? t("Stock insuffisant pour cette demande") : t("Stock disponible")}
      >
        {stock}
      </span>
    );
  };

  /* ---------- Rendu : loading ---------- */
  if (loading) {
    return (
      <div className="demandes-loading">
        <span>{t("Chargement des demandes...")}</span>
      </div>
    );
  }

  return (
    <div className="demandes-container">
      {/* ---------- Header ---------- */}
      <div className="demandes-header">
        <div className="demandes-header__text">
          <span className="demandes-eyebrow">{t("Pièces · Demandes")}</span>
          <h2>{t("Demandes de pièces")}</h2>
          <p>{t("Liste des pièces demandées pour ce bon de maintenance")}</p>
        </div>

        <button
          type="button"
          className="btn-refresh"
          onClick={loadDemandes}
          disabled={loading}
        >
          <IconRefresh />
          <span>{t("Actualiser")}</span>
        </button>
      </div>

      {/* ---------- Erreur ---------- */}
      {error && (
        <div className="demandes-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Vide ou tableau ---------- */}
      {demandes.length === 0 ? (
        <div className="demandes-empty">
          <span className="empty-icon">
            <IconPackage />
          </span>
          <h3>{t("Aucune demande")}</h3>
          <p>{t("Aucune pièce n'a encore été demandée pour ce bon.")}</p>
        </div>
      ) : (
        <div className="demandes-table-wrapper">
          <table className="demandes-table">
            <thead>
              <tr>
                <th>{t("ID")}</th>
                <th>{t("Article")}</th>
                <th>{t("Mode stock")}</th>
                <th>{t("Qté")}</th>
                <th>{t("Stock dispo")}</th>
                <th>{t("État")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>

            <tbody>
              {demandes.map((demande) => {
                const isLoading = actionLoading === demande.id;
                return (
                  <tr key={demande.id}>
                    <td className="col-id">#{demande.id}</td>

                    <td className="col-article">
                      {demande.prestataireArticlesId
                        ? t('Article #{id}', { id: demande.prestataireArticlesId })
                        : '—'}
                    </td>

                    <td className="col-mode">
                      {demande.modeStock ?? '—'}
                    </td>

                    <td className="col-qte">
                      <strong>{demande.qte ?? 0}</strong>
                    </td>

                    <td className="col-stock">{renderStock(demande)}</td>

                    <td>
                      <span className={`etat-badge ${getEtatClass(demande.etat)}`}>
                        {t(getEtatLabel(demande.etat))}
                      </span>
                    </td>

                    <td className="col-actions">
                      {demande.etat === 'EN_ATTENTE' ? (
                        <div className="demande-actions">
                          <button
                            type="button"
                            className="btn-accepter"
                            onClick={() => handleAccepter(demande.id)}
                            disabled={isLoading}
                            title={t("Accepter la demande")}
                          >
                            {isLoading && actionType === 'accepter' ? (
                              <IconSpinner />
                            ) : (
                              <IconCheck />
                            )}
                            <span>
                              {isLoading && actionType === 'accepter' ? t("Traitement") : t("Accepter")}
                            </span>
                          </button>

                          <button
                            type="button"
                            className="btn-refuser"
                            onClick={() => handleRefuser(demande.id)}
                            disabled={isLoading}
                            title={t("Refuser la demande")}
                          >
                            {isLoading && actionType === 'refuser' ? (
                              <IconSpinner />
                            ) : (
                              <IconX />
                            )}
                            <span>
                              {isLoading && actionType === 'refuser' ? t("Traitement") : t("Refuser")}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <span className="action-disabled" aria-hidden="true">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DemandesPieces;