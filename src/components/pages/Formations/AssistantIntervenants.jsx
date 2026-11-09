import { useEffect, useState } from 'react';
import { Check, GraduationCap, History, ListChecks, Loader2, Sparkles, Wrench } from 'lucide-react';
import formationService from '../../../services/formationService';
import { dateFormation } from './formationLibelles';
import { t } from '../../../i18n';
import './Formations.css';

/*
 * Assistant de choix des intervenants : techniciens proposés pour l'équipement (du bon ou donné),
 * classés selon les interventions et tâches déjà faites dessus, sur sa famille, et leurs formations.
 * onChoisir(personnelId, personnelNom) ; choisi : identifiant déjà sélectionné (mis en évidence).
 */
export default function AssistantIntervenants({ bonMaintenanceId, lotArticleImmobilistationId, onChoisir, choisi }) {
  const [suggestions, setSuggestions] = useState(null);
  const cle = bonMaintenanceId || lotArticleImmobilistationId ? `${bonMaintenanceId}|${lotArticleImmobilistationId}` : '';

  useEffect(() => {
    setSuggestions(null);
    if (!cle) return undefined;
    let annule = false;
    formationService.suggestionsIntervenants({ bonMaintenanceId, lotArticleImmobilistationId })
      .then((s) => { if (!annule) setSuggestions(s); })
      .catch((e) => { console.error('[GMAO assistant intervenants]', e); if (!annule) setSuggestions([]); });
    return () => { annule = true; };
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cle) return null;
  return (
    <section className="fo-assistant" aria-label={t('Intervenants suggérés')}>
      <h4><Sparkles size={15} aria-hidden="true" /> {t('Intervenants suggérés')}</h4>
      {suggestions == null ? (
        <p className="fo-assistant__vide"><Loader2 size={14} className="cf-tourne" /> {t('Recherche dans l’historique…')}</p>
      ) : suggestions.length === 0 ? (
        <p className="fo-assistant__vide">{t('Aucun historique ni formation pour cet équipement.')}</p>
      ) : (
        <ul>
          {suggestions.map((s) => {
            const actif = choisi != null && String(choisi) === String(s.personnelId);
            return (
              <li key={s.personnelId} className={actif ? 'est-actif' : ''}>
                <div className="fo-assistant__tete">
                  <strong>{s.personnelNom || t('Personnel #{id}', { id: s.personnelId })}</strong>
                  <span className="fo-assistant__score" title={t('Score sur 100')}>
                    <span style={{ width: `${s.score}%` }} />
                    <b>{s.score}</b>
                  </span>
                </div>
                <div className="fo-assistant__raisons">
                  {s.formations?.length > 0 && <span className="fo-r fo-r--formation" title={s.formations.join('\n')}><GraduationCap size={12} />{s.formations.length > 1 ? t('{n} formations', { n: s.formations.length }) : s.formations[0]}</span>}
                  {s.interventionsEquipement > 0 && <span className="fo-r"><Wrench size={12} />{t('{n} sur cet équipement', { n: s.interventionsEquipement })}</span>}
                  {s.tachesEquipement > 0 && <span className="fo-r"><ListChecks size={12} />{t('{n} tâche(s) effectuée(s)', { n: s.tachesEquipement })}</span>}
                  {s.interventionsFamille > 0 && <span className="fo-r fo-r--doux"><Wrench size={12} />{t('{n} sur la famille', { n: s.interventionsFamille })}</span>}
                  {s.derniereIntervention && <span className="fo-r fo-r--doux"><History size={12} />{dateFormation(s.derniereIntervention)}</span>}
                </div>
                <button type="button" className="fo-assistant__choisir" onClick={() => onChoisir?.(s.personnelId, s.personnelNom)} disabled={actif}>
                  {actif ? <><Check size={13} /> {t('Choisi')}</> : t('Choisir')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
