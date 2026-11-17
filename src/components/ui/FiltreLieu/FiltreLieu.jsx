import { useEffect, useMemo, useState } from 'react';
import { carteLieux, lieuxAplatis, lieuEtSousLieux, lieuDeLigne } from '../../../services/lieuxCache';
import { t } from '../../../i18n';
import './FiltreLieu.css';

/** Carte des lieux (null tant qu'elle n'est pas chargée, {} si injoignable). */
export function useCarteLieux() {
  const [carte, setCarte] = useState(null);
  useEffect(() => {
    let actif = true;
    carteLieux().then((c) => { if (actif) setCarte(c); }).catch(() => { if (actif) setCarte({ lieux: [], equipements: {} }); });
    return () => { actif = false; };
  }, []);
  return carte;
}

/**
 * Filtre « lieu » des listes : valeur = id du lieu ('' = tous). Le lieu choisi compte avec ses sous-lieux.
 * dansLieu(ligne) : la ligne (lieuId, sinon équipement) est-elle dans le lieu filtré ?
 */
export function useFiltreLieu(carte, valeur, cleEquipement = 'lotArticleImmobilistationId') {
  const ensemble = useMemo(() => (valeur ? lieuEtSousLieux(carte, valeur) : null), [carte, valeur]);
  return useMemo(() => (ligne) => {
    if (!ensemble) return true;
    const l = lieuDeLigne(carte, ligne?.lieuId, ligne?.[cleEquipement]);
    return l != null && ensemble.has(l);
  }, [ensemble, carte, cleEquipement]);
}

export default function FiltreLieu({ carte, valeur, onChange, className }) {
  const liste = useMemo(() => lieuxAplatis(carte), [carte]);
  if (!liste.length && !valeur) return null;
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={t('Filtrer par lieu')}
      className={[className, valeur ? 'leq-filtre-actif' : ''].filter(Boolean).join(' ') || undefined}>
      <option value="">{t('Tous les lieux')}</option>
      {liste.map((l) => (
        <option key={l.id} value={String(l.id)}>{'  '.repeat(l.niveau)}{l.nom}</option>
      ))}
    </select>
  );
}
