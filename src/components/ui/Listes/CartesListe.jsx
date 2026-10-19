import { ChevronRight } from 'lucide-react';
import { t } from '../../../i18n';
import BadgeStatut from '../BadgeStatut/BadgeStatut';
import { CaseSelection } from './SelectionMultiple';
import './VuesListe.css';

/*
 * La liste en cartes, affichée à la place du tableau sur téléphone (≤ 760 px).
 * Le parent garde son tableau, dont le conteneur porte la classe « liste-adaptative__tableau ».
 *
 *   lignes : [{ id, num, titre, statut: { type, valeur }, meta: [{ icone, texte, alerte }], niveau }]
 */
export default function CartesListe({ lignes, selectionId, onChoisir, onOuvrir, vide, coches, onCocher }) {
  if (!lignes.length) {
    return <div className="cartes-liste"><p className="cartes-liste__vide">{vide}</p></div>;
  }
  return (
    <ul className="cartes-liste" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {lignes.map((l) => {
        const choisie = selectionId === l.id;
        return (
          <li key={l.id}>
            <article
              className={`carte-ligne ${choisie ? 'carte-ligne--selection' : ''}`}
              onClick={() => onChoisir?.(l.source)}
              aria-current={choisie ? 'true' : undefined}
            >
              <div className="carte-ligne__haut">
                {onCocher ? (
                  <span className="carte-ligne__case" onClick={(e) => e.stopPropagation()}>
                    <CaseSelection coche={coches?.has(l.id) || false} onChange={() => onCocher(l.source)} label={t('Sélectionner {num}', { num: l.num })} />
                    <span className="carte-ligne__num">{l.num}</span>
                  </span>
                ) : <span className="carte-ligne__num">{l.num}</span>}
                <BadgeStatut type={l.statut.type} valeur={l.statut.valeur} taille="petit" />
              </div>
              <h3 className="carte-ligne__titre">{l.titre || t('Sans titre')}</h3>
              {(l.meta?.length > 0 || l.niveau) && (
                <div className="carte-ligne__meta">
                  {l.niveau && <BadgeStatut type="niveau" valeur={l.niveau.valeur} prefixe={l.niveau.prefixe} taille="petit" />}
                  {l.meta?.filter((m) => m.texte).map((m, i) => {
                    const Icone = m.icone;
                    return (
                      <span key={i} className={`carte-ligne__meta-item ${m.alerte ? 'carte-ligne__retard' : ''}`}>
                        {Icone && <Icone aria-hidden="true" />}{m.texte}
                      </span>
                    );
                  })}
                </div>
              )}
              {onOuvrir && (
                <div className="carte-ligne__bas">
                  <button
                    type="button"
                    className="carte-ligne__ouvrir"
                    onClick={(e) => { e.stopPropagation(); onOuvrir(l.source); }}
                  >
                    {t('Ouvrir')}
                    <ChevronRight className="rtl-miroir" aria-hidden="true" />
                  </button>
                </div>
              )}
            </article>
          </li>
        );
      })}
    </ul>
  );
}