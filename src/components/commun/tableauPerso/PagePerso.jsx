import { LoaderCircle, RefreshCw, Settings2 } from 'lucide-react';
import FiltreLieu, { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { PERIODES } from './outilsPerso';
import { t, locale } from '../../../i18n';

/*
 * Briques de page des tableaux de bord personnalisables :
 * EntetePerso (en-tête). Le chargement est dans useTableauPerso (outilsPerso.js).
 */

/** En-tête : titre, lieu, période, Personnaliser, Rafraîchir, puis ligne « mis à jour » et avertissements. */
export function EntetePerso({ icone: Icone, titre, etat, edition, setEdition, indisponibles = [] }) {
  const carteLieux = useCarteLieux();
  const { jours, setJours, lieuId, setLieuId, chargement, erreur, majLe, charger, donnees } = etat;
  const libellePeriode = t(PERIODES.find((p) => p.cle === jours)?.label || '');
  return (
    <>
      <div className="tb-header">
        <div className="tb-header-icone"><Icone size={24} strokeWidth={2} aria-hidden="true" /></div>
        <div className="tb-header-texte"><h1>{titre}</h1></div>
        <div className="tb-header-actions">
          <FiltreLieu carte={carteLieux} valeur={lieuId} onChange={setLieuId} className="fl-select" />
          <div className="tb-periodes" role="group" aria-label={t('Période')}>
            {PERIODES.map((p) => (
              <button key={p.cle} type="button" aria-pressed={jours === p.cle} onClick={() => setJours(p.cle)}>{t(p.label)}</button>
            ))}
          </div>
          <button type="button" className={`tb-btn ${edition ? 'is-actif' : ''}`} onClick={() => setEdition((e) => !e)} aria-pressed={edition}>
            <Settings2 size={14} strokeWidth={2.4} aria-hidden="true" /> {t('Personnaliser')}
          </button>
          <button type="button" className="tb-btn" onClick={() => charger(true)} disabled={chargement}>
            {chargement ? <LoaderCircle size={14} className="tb-tourne" aria-hidden="true" /> : <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" />}
            {t('Rafraîchir')}
          </button>
        </div>
      </div>
      {majLe && (
        <p className="tb-maj">
          {t('Mis à jour à {h}', { h: new Date(majLe).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}
          {donnees?.periode && <> · {t('période : {p}', { p: libellePeriode })}</>}
        </p>
      )}
      {erreur && <p className="tb-message tb-message--erreur">{erreur}</p>}
      {indisponibles.length > 0 && (
        <p className="tb-message tb-message--attention">{t('Certaines données n’ont pas pu être chargées : {l}.', { l: indisponibles.join(', ') })}</p>
      )}
      {!donnees && !erreur && <div className="tb-chargement">{t('Chargement…')}</div>}
    </>
  );
}
