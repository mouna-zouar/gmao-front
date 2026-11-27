import { useState } from 'react';
import { PackageSearch, RefreshCw, ShoppingCart } from 'lucide-react';
import { useRequete } from '../../../store/hooks';
import { t, locale } from '../../../i18n';
import { phraseRaison, tonRaison } from './phrasesDecision';
import './Decision.css';

const CLE_DELAI = 'gmao.stock.delai-fournisseur';
const lireDelai = () => {
  try { const v = Number(localStorage.getItem(CLE_DELAI)); return v >= 1 && v <= 180 ? v : 14; } catch { return 14; }
};
const RECOS = {
  COMMANDER_MAINTENANT: { ton: 'rouge', label: 'Commander maintenant' },
  COMMANDER_BIENTOT: { ton: 'ambre', label: 'Commander bientôt' },
  SOUS_SEUIL: { ton: 'bleu', label: 'Sous le seuil' },
  OK: { ton: 'neutre', label: 'Suffisant' },
};
const nb = (v) => Number(v || 0).toLocaleString(locale(), { maximumFractionDigits: 2 });
const date = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) : '');

/** « Stock : commander quoi, et quand ? ». onCommander reçoit les lignes à mettre dans une commande fournisseur. */
export default function PrevisionStock({ onCommander }) {
  const [delai, setDelai] = useState(lireDelai);
  const [saisie, setSaisie] = useState(String(lireDelai()));
  const { donnees, chargement, recharger } = useRequete('previsionsStock', { delaiJours: delai });
  const liste = donnees?.previsions || [];
  if (!chargement && donnees && !liste.length) return null;

  const valider = () => {
    const v = Math.round(Number(saisie));
    if (!(v >= 1 && v <= 180)) { setSaisie(String(delai)); return; }
    try { localStorage.setItem(CLE_DELAI, String(v)); } catch { /* stockage indisponible */ }
    setDelai(v);
  };
  const versLigne = (p) => ({
    prestataireArticlesId: p.articleId, designation: p.designation, qte: p.quantiteConseillee,
    prixAchat: p.prixAchat, tva: p.tva, unite: p.unite,
  });
  const urgents = liste.filter((p) => p.recommandation === 'COMMANDER_MAINTENANT' && p.quantiteConseillee > 0);

  return (
    <section className="dec-top dec-stock" aria-label={t('Commander quoi, et quand ?')}>
      <header className="dec-top__tete">
        <span className="dec-top__icone"><PackageSearch size={18} strokeWidth={2.2} aria-hidden="true" /></span>
        <div className="dec-top__titres">
          <h3>{t('Commander quoi, et quand ?')}</h3>
          <p>{t('Prévision d’après la consommation des 12 derniers mois et les pièces des tâches déjà prévues')}</p>
        </div>
        <label className="dec-stock__delai">
          {t('Délai fournisseur')}
          <input type="number" min="1" max="180" value={saisie} onChange={(e) => setSaisie(e.target.value)}
            onBlur={valider} onKeyDown={(e) => e.key === 'Enter' && valider()} aria-label={t('Délai fournisseur en jours')} />
          {t('j')}
        </label>
        {onCommander && urgents.length > 1 && (
          <button type="button" className="dec-prev__modifier" onClick={() => onCommander(urgents.map(versLigne))}>
            <ShoppingCart size={14} aria-hidden="true" /> {t('Commander les urgents ({n})', { n: urgents.length })}
          </button>
        )}
        <button type="button" className="dec-top__btn" onClick={() => recharger(true)} title={t('Actualiser')} aria-label={t('Actualiser')}>
          <RefreshCw size={15} className={chargement ? 'dec-tourne' : ''} aria-hidden="true" />
        </button>
      </header>

      {!donnees ? (
        <ol className="dec-top__liste">{[0, 1].map((i) => <li key={i} className="dec-top__fantome" aria-hidden="true" />)}</ol>
      ) : (
        <ul className="dec-prev__liste">
          {liste.map((p) => {
            const r = RECOS[p.recommandation] || RECOS.OK;
            const unite = p.unite ? ` ${p.unite}` : '';
            return (
              <li key={p.articleId} className="dec-prev__ligne">
                <span className={`dec-prev__badge dec-prev__badge--${r.ton}`}>{t(r.label)}</span>
                <div className="dec-prev__texte">
                  <strong dir="auto">{p.designation}{p.code ? <small> · {p.code}</small> : null}</strong>
                  <span className="dec-prev__intervalle">
                    {t('En stock : {d}', { d: nb(p.disponible) + unite })}
                    {p.enCommande > 0 && <> · {t('en commande : {c}', { c: nb(p.enCommande) })}</>}
                    {p.besoinsConnus > 0 && <> · {t('déjà prévu : {b}', { b: nb(p.besoinsConnus) })}</>}
                  </span>
                  <span className="dec-top__raisons">
                    {p.raisons.slice(0, 3).map((x) => (
                      <span key={x.code} className={`dec-puce dec-puce--${tonRaison(x.code)}`}>{phraseRaison(x)}</span>
                    ))}
                  </span>
                  <span className="dec-stock__quand">
                    {p.joursAvantRupture === 0
                      ? t('À commander tout de suite')
                      : p.commanderAvant ? t('À commander avant le {d}', { d: date(p.commanderAvant) }) : null}
                    {p.quantiteConseillee > 0 && <b>{t('Quantité conseillée : {q}', { q: nb(p.quantiteConseillee) + unite })}</b>}
                  </span>
                </div>
                {onCommander && p.quantiteConseillee > 0 && (
                  <button type="button" className="dec-prev__modifier" onClick={() => onCommander([versLigne(p)])}>
                    <ShoppingCart size={14} aria-hidden="true" /> {t('Commander')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
