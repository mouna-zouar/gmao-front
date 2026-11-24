import { statut } from '../../../constants/statuts';
import { t } from '../../../i18n';
import './BadgeStatut.css';

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
