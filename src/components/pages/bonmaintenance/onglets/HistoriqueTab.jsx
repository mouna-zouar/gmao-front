import { useEffect, useState } from 'react';
import { Loader2, Inbox } from 'lucide-react';
import bonMaintenanceHistoriqueService from '../../../../services/Bonmaintenancehistoriqueservice';
import { formatDateTime } from '../BmdCommun';
import { t } from '../../../../i18n';

export function HistoriqueTab({ bonMaintenanceId }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceHistoriqueService.findByBonMaintenanceId(bonMaintenanceId);
      setHistorique(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>{t("Historique")}</h3>
          <span className="bmd-panel-count">{historique.length}</span>
        </div>
      </div>

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          {t("Impossible de charger l'historique :")} {loadError}
        </p>
      ) : historique.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun historique pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-history-list">
          {historique.map((h) => (
            <li key={h.id} className="bmd-history-row">
              <span className="bmd-history-action">{h.action}</span>
              <span className="bmd-history-date">{formatDateTime(h.date)}</span>
              <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
