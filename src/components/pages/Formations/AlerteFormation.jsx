import { useEffect, useState } from 'react';
import { GraduationCap, TriangleAlert } from 'lucide-react';
import formationService from '../../../services/formationService';
import { t } from '../../../i18n';
import './Formations.css';

/*
 * Sous le choix d'un technicien : est-il formé sur cet équipement (ou sa famille) ?
 * Équipement donné directement (lotArticleImmobilistationId) ou par le bon (bonMaintenanceId).
 * Rien n'est affiché si l'équipement n'a pas de famille connue ou si la vérification échoue.
 */
export default function AlerteFormation({ personnelId, bonMaintenanceId, lotArticleImmobilistationId }) {
  const [res, setRes] = useState(null);
  const cle = personnelId && (bonMaintenanceId || lotArticleImmobilistationId) ? `${personnelId}|${bonMaintenanceId}|${lotArticleImmobilistationId}` : '';

  useEffect(() => {
    setRes(null);
    if (!cle) return undefined;
    let annule = false;
    formationService.verifier({ personnelId, bonMaintenanceId, lotArticleImmobilistationId })
      .then((r) => { if (!annule) setRes(r); })
      .catch((e) => console.error('[GMAO formations] Vérification :', e));
    return () => { annule = true; };
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!res || res.forme == null) return null;
  const cible = [res.equipementNom, res.familleNom].filter(Boolean).join(' · ') || '—';
  if (res.forme) {
    return (
      <p className="fo-alerte fo-alerte--ok" role="status">
        <GraduationCap size={15} aria-hidden="true" />
        {t('Formé sur « {famille} »', { famille: cible })}
      </p>
    );
  }
  return (
    <p className="fo-alerte fo-alerte--non" role="alert">
      <TriangleAlert size={15} aria-hidden="true" />
      {t('Aucune formation réussie sur « {famille} »', { famille: cible })}
    </p>
  );
}
