import { statut } from '../../../constants/statuts';
import { t } from '../../../i18n';
import './BadgeStatut.css';

/*
 * Pastille de statut, identique sur tous les écrans : icône + mot, couleur du ton.
 *   <BadgeStatut type="bon" valeur={b.etat} />
 *   <BadgeStatut type="reclamation" valeur={r.etat} taille="petit" />
 *   <BadgeStatut type="niveau" valeur={b.urgence} prefixe="Urgence" />
 * La couleur n'est jamais seule : le libellé est toujours écrit (ou lu par un lecteur d'écran).
 */
export default function BadgeStatut({ type, valeur, taille = 'normal', prefixe, sansTexte = false, className = '' }) {
  const def = statut(type, valeur);
  const { Icone } = def;
  const libelle = t(def.libelle, def.params);
  const texte = prefixe ? `${t(prefixe)} : ${libelle}` : libelle;
  return (
    <span
      className={`statut statut--${def.ton} statut--${taille} ${className}`}
      title={sansTexte ? texte : undefined}
      aria-label={sansTexte ? texte : undefined}
      role={sansTexte ? 'img' : undefined}
    >
      <Icone className="statut__icone" aria-hidden="true" />
      {!sansTexte && <span className="statut__texte">{texte}</span>}
    </span>
  );
}
