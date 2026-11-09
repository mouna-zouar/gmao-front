import { useEffect, useState } from 'react';
import { Check, History, Loader2, Package, Sparkles, Timer, Wrench } from 'lucide-react';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import { dateFormation } from '../Formations/formationLibelles';
import { formatTemps } from './BmdCommun';
import { t } from '../../../i18n';
import '../Formations/Formations.css';

/*
 * Assistant des tâches : tâches déjà faites sur l'équipement du bon et sur sa famille (autres bons),
 * les plus fréquentes d'abord. « Utiliser » reprend la désignation, la précision et l'article habituel.
 * onUtiliser(suggestion) ; utilisee : désignation déjà reprise (mise en évidence) ; articles : pour afficher le nom de l'article.
 */
export default function AssistantTaches({ bonMaintenanceId, onUtiliser, utilisee, articles = [], sansArticle = false }) {
  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => {
    setSuggestions(null);
    if (!bonMaintenanceId) return undefined;
    let annule = false;
    bonMaintenanceTacheService.suggestions({ bonMaintenanceId })
      .then((s) => { if (!annule) setSuggestions(s); })
      .catch((e) => { console.error('[GMAO assistant tâches]', e); if (!annule) setSuggestions([]); });
    return () => { annule = true; };
  }, [bonMaintenanceId]);

  if (!bonMaintenanceId) return null;
  const nomArticle = (id) => {
    const a = articles.find((x) => String(x.id) === String(id));
    return a ? (a.designation || a.code || `#${id}`) : `#${id}`;
  };

  return (
    <section className="fo-assistant" aria-label={t('Tâches suggérées')}>
      <h4><Sparkles size={15} aria-hidden="true" /> {t('Tâches suggérées')}</h4>
      {suggestions == null ? (
        <p className="fo-assistant__vide"><Loader2 size={14} className="cf-tourne" /> {t('Recherche dans l’historique…')}</p>
      ) : suggestions.length === 0 ? (
        <p className="fo-assistant__vide">{t('Aucune tâche déjà faite sur cet équipement ou sa famille.')}</p>
      ) : (
        <ul>
          {suggestions.map((s) => {
            const actif = utilisee != null && utilisee.trim().toLowerCase() === s.designation.trim().toLowerCase();
            return (
              <li key={s.designation} className={actif ? 'est-actif' : ''}>
                <div className="fo-assistant__tete">
                  <strong title={s.designation}>{s.designation}</strong>
                </div>
                <div className="fo-assistant__raisons">
                  {s.utilisationsEquipement > 0 && <span className="fo-r fo-r--formation"><Wrench size={12} />{t('{n} sur cet équipement', { n: s.utilisationsEquipement })}</span>}
                  {s.utilisationsFamille > 0 && <span className="fo-r"><Wrench size={12} />{t('{n} sur la famille', { n: s.utilisationsFamille })}</span>}
                  {s.dureeMoyenneSecondes > 0 && <span className="fo-r" title={t('Durée moyenne')}><Timer size={12} />{formatTemps(s.dureeMoyenneSecondes)}</span>}
                  {!sansArticle && s.prestataireArticlesId && (
                    <span className="fo-r" title={t('Article habituel')}><Package size={12} />{nomArticle(s.prestataireArticlesId)}{s.qte ? ` × ${s.qte}` : ''}</span>
                  )}
                  {s.derniereFois && <span className="fo-r fo-r--doux"><History size={12} />{dateFormation(s.derniereFois)}</span>}
                </div>
                <button type="button" className="fo-assistant__choisir" onClick={() => onUtiliser?.(s)} disabled={actif}>
                  {actif ? <><Check size={13} /> {t('Reprise')}</> : t('Utiliser')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
