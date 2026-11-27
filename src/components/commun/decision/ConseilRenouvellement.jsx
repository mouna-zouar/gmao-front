import { Link } from 'react-router-dom';
import { CalendarClock, Eye, RefreshCcw } from 'lucide-react';
import { useRequete } from '../../../store/hooks';
import { t, locale } from '../../../i18n';
import { montant, phraseRaison } from './phrasesDecision';
import './Decision.css';

const DECISIONS = {
  REMPLACER: { ton: 'rouge', icone: RefreshCcw, titre: 'Remplacer plutôt que réparer' },
  PLANIFIER: { ton: 'ambre', icone: CalendarClock, titre: 'Réparer, et planifier son remplacement' },
  SURVEILLER: { ton: 'bleu', icone: Eye, titre: 'Réparer, mais surveiller cet équipement' },
};

/** Conseil « réparer ou remplacer ? » d'un équipement ; rien n'est affiché quand réparer est la bonne décision. */
export default function ConseilRenouvellement({ equipementId }) {
  const { donnees: d } = useRequete('reparerOuRemplacer', { id: equipementId }, { auto: Boolean(equipementId) });
  const conf = d ? DECISIONS[d.decision] : null;
  if (!conf) return null;
  const Icone = conf.icone;
  const c = d.comparaison || {};
  const annee = d.decision === 'PLANIFIER' && d.anneeConseillee ? t(' (conseillé en {a})', { a: d.anneeConseillee }) : '';

  return (
    <section className={`dec-conseil dec-conseil--${conf.ton}`} aria-label={t('Réparer ou remplacer ?')}>
      <div className="dec-conseil__icone"><Icone size={20} strokeWidth={2.2} aria-hidden="true" /></div>
      <div className="dec-conseil__corps">
        <p className="dec-conseil__surtitre">{t('Réparer ou remplacer ?')}</p>
        <h3 className="dec-conseil__titre">{t(conf.titre)}{annee}</h3>
        <ul className="dec-conseil__raisons">
          {d.raisons.slice(0, 3).map((r) => <li key={r.code}>{phraseRaison(r)}</li>)}
        </ul>
        <div className="dec-conseil__comparaison">
          <span>
            {t('Sur {n} ans', { n: c.horizonAns || 3 })}{' : '}
            <strong>{t('garder ≈ {m} de maintenance', { m: c.coutGarder != null ? montant(c.coutGarder) : '—' })}</strong>
            {' · '}
            <strong>{c.coutRemplacer != null ? t('remplacer ≈ {m}', { m: montant(c.coutRemplacer) }) : t('coût de remplacement non renseigné')}</strong>
          </span>
          {c.anneesEquilibre != null && (
            <span className="dec-conseil__equilibre">
              {t('Le neuf est rentabilisé en {n} ans de réparations évitées', { n: c.anneesEquilibre.toLocaleString(locale(), { maximumFractionDigits: 1 }) })}
            </span>
          )}
        </div>
        <p className="dec-conseil__note">
          {t('Estimation à partir des coûts des 12 derniers mois.')}{' '}
          <Link to="/renouvellement">{t('Voir le plan de renouvellement')}</Link>
        </p>
      </div>
    </section>
  );
}
