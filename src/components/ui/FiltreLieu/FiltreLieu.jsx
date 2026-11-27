import { useMemo } from 'react';
import { lieuxAplatis, lieuEtSousLieux, lieuDeLigne } from '../../../services/lieuxCache';
import { useReferentiel } from '../../../store/hooks';
import { CARTE_VIDE } from '../../../store/listesReference';
import { t } from '../../../i18n';
import './FiltreLieu.css';

export function useCarteLieux() {
  const { liste: carte, statut } = useReferentiel('lieux');
  if (statut === 'pret') return carte;
  return statut === 'erreur' ? CARTE_VIDE : null;
}

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
