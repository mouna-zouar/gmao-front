import { useEffect, useState } from 'react';
import { CalendarClock, GraduationCap, TriangleAlert } from 'lucide-react';
import formationService from '../../../services/formationService';
import { RESULTATS_FORMATION, STATUTS_FORMATION } from './formationLibelles';
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
  // Inscrit à une formation sur cet équipement, mais pas encore validée (formation « Réalisée » + résultat « Réussi »)
  const enAttente = res.enAttente ?? [];
  if (enAttente.length) {
    return (
      <div className="fo-alerte fo-alerte--attente" role="status">
        <CalendarClock size={15} aria-hidden="true" />
        <span>
          {enAttente.map((f) => (
            <span key={f.formationId} className="fo-alerte__ligne">
              {t('« {intitule} » pas encore validée', { intitule: f.intitule })}
              {' : '}
              <b>{t(STATUTS_FORMATION[f.statut]?.label || f.statut || '')}</b>
              {' · '}
              <b>{t(RESULTATS_FORMATION[f.resultat]?.label || f.resultat || '')}</b>
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <p className="fo-alerte fo-alerte--non" role="alert">
      <TriangleAlert size={15} aria-hidden="true" />
      {t('Aucune formation réussie sur « {famille} »', { famille: cible })}
    </p>
  );
}
