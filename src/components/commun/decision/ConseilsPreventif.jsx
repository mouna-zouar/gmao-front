import { useState } from 'react';
import { CalendarRange, ChevronDown, PencilLine, RefreshCw } from 'lucide-react';
import { useRequete } from '../../../store/hooks';
import { t, locale } from '../../../i18n';
import { phraseRaison } from './phrasesDecision';
import './Decision.css';

const RECOS = {
  RAPPROCHER: { ton: 'rouge', label: 'Rapprocher' },
  VERIFIER: { ton: 'ambre', label: 'Revoir le contenu' },
  ESPACER: { ton: 'vert', label: 'Espacer' },
  CONSERVER: { ton: 'neutre', label: 'Adapté' },
  DONNEES_INSUFFISANTES: { ton: 'neutre', label: 'Historique insuffisant' },
};
const ACTIONNABLES = new Set(['RAPPROCHER', 'VERIFIER', 'ESPACER']);
const nb = (v) => Number(v).toLocaleString(locale(), { maximumFractionDigits: 1 });

function Gain({ c }) {
  if (c.recommandation === 'RAPPROCHER' && c.pannesEviteesParAn > 0) {
    return <span className="dec-prev__gain">{t('≈ {n} panne(s) évitée(s) par an', { n: nb(c.pannesEviteesParAn) })}</span>;
  }
  if (c.recommandation === 'ESPACER' && c.interventionsEnMoinsParAn > 0) {
    return (
      <span className="dec-prev__gain">
        {c.heuresLibereesParAn > 0
          ? t('≈ {n} intervention(s) et {h} h libérées par an', { n: nb(c.interventionsEnMoinsParAn), h: nb(c.heuresLibereesParAn) })
          : t('≈ {n} intervention(s) de moins par an', { n: nb(c.interventionsEnMoinsParAn) })}
      </span>
    );
  }
  return null;
}

/** « Ajuster le préventif » : fréquences à rapprocher, à espacer ou à revoir, d'après les pannes des 24 derniers mois. */
export default function ConseilsPreventif({ onModifier }) {
  const [tout, setTout] = useState(false);
  const { donnees, chargement, recharger } = useRequete('conseilsPreventif', {});
  const liste = donnees || [];
  const actionnables = liste.filter((c) => ACTIONNABLES.has(c.recommandation));
  const autres = liste.length - actionnables.length;
  const affiches = tout ? liste : actionnables;
  if (!chargement && !liste.length) return null;

  return (
    <section className="dec-top dec-prev" aria-label={t('Ajuster le préventif')}>
      <header className="dec-top__tete">
        <span className="dec-top__icone"><CalendarRange size={18} strokeWidth={2.2} aria-hidden="true" /></span>
        <div className="dec-top__titres">
          <h3>{t('Ajuster le préventif')}</h3>
          <p>{t('Comparaison des préventifs réalisés et des pannes survenues entre deux passages, sur les 24 derniers mois')}</p>
        </div>
        <button type="button" className="dec-top__btn" onClick={() => recharger(true)} title={t('Actualiser')} aria-label={t('Actualiser')}>
          <RefreshCw size={15} className={chargement ? 'dec-tourne' : ''} aria-hidden="true" />
        </button>
      </header>

      {!liste.length ? (
        <ol className="dec-top__liste">{[0, 1].map((i) => <li key={i} className="dec-top__fantome" aria-hidden="true" />)}</ol>
      ) : (
        <>
          {!affiches.length && (
            <p className="dec-prev__calme">{t('Aucun ajustement conseillé : les fréquences actuelles correspondent aux pannes observées.')}</p>
          )}
          <ul className="dec-prev__liste">
            {affiches.map((c) => {
              const r = RECOS[c.recommandation] || RECOS.CONSERVER;
              return (
                <li key={c.typeId} className="dec-prev__ligne">
                  <span className={`dec-prev__badge dec-prev__badge--${r.ton}`}>{t(r.label)}</span>
                  <div className="dec-prev__texte">
                    <strong dir="auto">{c.libelle || c.code}{c.code && c.libelle ? <small> · {c.code}</small> : null}</strong>
                    <span className="dec-prev__intervalle">
                      {t('Tous les {n} j', { n: c.intervalleJours })}
                      {c.intervalleConseille != null && <> <span className="rtl-miroir">→</span> <b>{t('conseillé : tous les {n} j', { n: c.intervalleConseille })}</b></>}
                      {' · '}{t('{n} équipement(s)', { n: c.equipements })}
                    </span>
                    {c.raisons?.[0] && <span className="dec-prev__raison">{phraseRaison(c.raisons[0])}</span>}
                    <Gain c={c} />
                  </div>
                  {onModifier && ACTIONNABLES.has(c.recommandation) && (
                    <button type="button" className="dec-prev__modifier" onClick={() => onModifier(c.typeId)}>
                      <PencilLine size={14} aria-hidden="true" /> {t('Modifier')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {autres > 0 && (
            <button type="button" className="dec-prev__plus" onClick={() => setTout((v) => !v)} aria-expanded={tout}>
              <ChevronDown size={14} className={tout ? '' : 'dec-replie'} aria-hidden="true" />
              {tout ? t('Masquer les types sans ajustement') : (autres === 1 ? t('Voir l’autre type (adapté ou sans historique suffisant)') : t('Voir les {n} autres types (adaptés ou sans historique suffisant)', { n: autres }))}
            </button>
          )}
        </>
      )}
    </section>
  );
}
