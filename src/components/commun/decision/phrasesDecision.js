import { t, locale } from '../../../i18n';

const nombre = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
export const montant = (v) => (v == null ? '—' : `${Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 })} DT`);
const duree = (heures) => {
  const h = Math.max(0, Number(heures) || 0);
  return h < 24 ? t('{n} h', { n: h }) : t('{n} j', { n: Math.round(h / 24) });
};

/** Met en phrase une raison renvoyée par l'aide à la décision ({ code, valeurs }). */
export function phraseRaison({ code, valeurs: v = {} }) {
  switch (code) {
    case 'FIN_DE_VIE_DEPASSEE':
      return t('A dépassé sa durée de vie : {age} ans pour {duree} ans prévus', { age: nombre(v.age), duree: v.dureeVie });
    case 'FIN_DE_VIE_PROCHE':
      return t('Proche de sa fin de vie : {age} ans sur {duree} ans prévus', { age: nombre(v.age), duree: v.dureeVie });
    case 'COUT_CUMULE':
      return t('Réparations cumulées : {ratio} % du prix d’achat ({cout})', { ratio: nombre(v.ratio, 0), cout: montant(v.coutCumule) });
    case 'PANNES_REPETEES':
      return t('{n} pannes ces 12 derniers mois', { n: v.pannes });
    case 'CRITICITE':
      return v.criticite === 'C1' ? t('Équipement critique pour la continuité des soins') : t('Équipement important pour le service');
    case 'AVIS_TECHNICIEN':
      return t('Remplacement conseillé par un technicien ({bon}) : « {phrase} »', { bon: v.bon || '—', phrase: v.phrase || '' });
    case 'EQUIPEMENT_SAIN':
      return t('Peu de pannes et encore loin de sa fin de vie');
    case 'PRIORITE':
      return t('Priorité {p} · {libelle}', { p: v.priorite, libelle: t(v.libelle || '') });
    case 'DELAI_DEPASSE':
      return t('Délai de résolution dépassé de {d}', { d: duree(v.heures) });
    case 'DELAI_PROCHE':
      return t('Délai de résolution dans {d}', { d: duree(v.heures) });
    case 'EQUIPEMENT_CRITIQUE':
      return t('Équipement critique (C1)');
    case 'EQUIPEMENT_ARRETE':
      return t('Équipement à l’arrêt');
    case 'NON_AFFECTE':
      return t('Personne n’est encore affecté');
    case 'OUVERT_DEPUIS':
      return t('Ouvert depuis {n} jours', { n: v.jours });
    case 'SUSPENDU':
      return t('Bon suspendu');
    case 'TACHE_EN_RETARD':
      return t('Échéance dépassée de {d}', { d: duree(v.heures) });
    case 'TACHE_ECHEANCE_PROCHE':
      return t('Échéance dans {d}', { d: duree(v.heures) });
    case 'TACHE_EN_COURS':
      return t('Chrono lancé');
    case 'PRIORITE_DU_BON':
      return t('Bon en priorité {p}', { p: v.priorite });
    case 'TACHE_A_FAIRE':
      return t('Tâche à faire');
    case 'RECLAMATION_A_PRENDRE':
      return t('À prendre en charge');
    case 'RECLAMATION_NON_LUE':
      return t('Pas encore lue');
    case 'RECLAMATION_A_VALIDER':
      return t('Résolue : attend votre confirmation');
    case 'RECLAMATION_CRITICITE':
      return v.niveau >= 3 ? t('Criticité élevée') : t('Criticité moyenne');
    case 'RECLAMATION_URGENCE':
      return v.niveau >= 3 ? t('Urgence élevée') : t('Urgence moyenne');
    case 'RECLAMATION_ANCIENNE':
      return t('Reçue il y a {n} jours', { n: v.jours });
    case 'STOCK_BESOINS_CONNUS':
      return t('{q} déjà prévu(s) sur {n} tâche(s) ouverte(s)', { q: nombre(v.qte), n: v.taches });
    case 'STOCK_RUPTURE':
      return t('Stock insuffisant pour les besoins déjà prévus');
    case 'STOCK_RUPTURE_DANS':
      return t('Rupture estimée dans {j} j (délai fournisseur : {d} j)', { j: v.jours, d: v.delai });
    case 'STOCK_CONSOMMATION':
      return t('{q} utilisé(s) en 12 mois (≈ {m} par mois)', { q: nombre(v.qte), m: nombre(v.parMois) });
    case 'STOCK_EN_COMMANDE':
      return t('{q} déjà en commande', { q: nombre(v.qte) });
    case 'STOCK_SOUS_SEUIL':
      return t('Passera sous le seuil de {s}', { s: nombre(v.seuil) });
    case 'PANNES_TARDIVES':
      return t('{p} pannes, en moyenne {m} j après le préventif (intervalle : {i} j) : l’usure arrive avant le passage suivant',
        { p: v.pannes, m: v.mediane, i: v.intervalle });
    case 'PANNES_APRES_PREVENTIF':
      return t('{p} pannes, en moyenne {m} j seulement après le préventif : revoir le contenu du préventif plutôt que sa fréquence',
        { p: v.pannes, m: v.mediane });
    case 'AUCUNE_PANNE':
      return t('Aucune panne en {mois} mois sur {e} équipement(s), pour {r} préventifs réalisés', { mois: v.mois, e: v.equipements, r: v.realisations });
    case 'PREVENTIF_ADAPTE':
      return t('Fréquence adaptée : {p} panne(s) pour {r} préventifs réalisés', { p: v.pannes, r: v.realisations });
    case 'DONNEES_INSUFFISANTES':
      return t('Pas assez d’historique : {r} préventif(s) réalisé(s) en 24 mois (minimum {min})', { r: v.realisations, min: v.minimum });
    default:
      return code;
  }
}

const TONS = {
  DELAI_DEPASSE: 'rouge', EQUIPEMENT_ARRETE: 'rouge', FIN_DE_VIE_DEPASSEE: 'rouge',
  DELAI_PROCHE: 'ambre', EQUIPEMENT_CRITIQUE: 'ambre', NON_AFFECTE: 'ambre', COUT_CUMULE: 'ambre', PANNES_REPETEES: 'ambre',
  STOCK_RUPTURE: 'rouge', STOCK_RUPTURE_DANS: 'ambre', STOCK_SOUS_SEUIL: 'ambre',
  TACHE_EN_RETARD: 'rouge', TACHE_ECHEANCE_PROCHE: 'ambre', RECLAMATION_A_PRENDRE: 'ambre', RECLAMATION_A_VALIDER: 'ambre',
};
export const tonRaison = (code) => TONS[code] || 'neutre';
