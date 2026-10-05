/**
 * Répartit le stock d'un article entre les lignes qui le demandent.
 *
 * Plusieurs tâches d'un même bon peuvent utiliser le même article : le stock est alors
 * partagé. Sans cette répartition, chaque ligne croit disposer de tout le stock.
 *
 * lignes : tableau ordonné (ordre d'affichage) de
 *   { key, articleId, qte, dispo, actif }
 *   - key       : identifiant de la ligne (ex. bonMaintenanceTacheId)
 *   - articleId : prestataireArticlesId (les lignes de même article partagent le stock)
 *   - qte       : quantité saisie
 *   - dispo     : stock disponible de l'article (null = stock illisible)
 *   - actif     : ligne cochée (une ligne décochée ne consomme rien)
 *
 * Retourne { [key]: { restant, manque } }
 *   - restant : stock de l'article après cette ligne (peut être négatif)
 *   - manque  : part de cette ligne qui n'est pas couverte par le stock
 */
const arrondir = (valeur) => Math.round(valeur * 1000) / 1000;

export function repartirStock(lignes) {
  const cumul = new Map();
  const resultat = {};

  lignes.forEach(({ key, articleId, qte, dispo, actif }) => {
    const avant = cumul.get(articleId) || 0;
    const demande = actif ? Math.max(0, Number(qte) || 0) : 0;
    const apres = avant + demande;
    cumul.set(articleId, apres);

    if (dispo == null) {
      resultat[key] = { restant: null, manque: 0 };
      return;
    }

    const stock = Number(dispo);
    resultat[key] = {
      restant: arrondir(stock - apres),
      manque: arrondir(Math.max(0, apres - stock) - Math.max(0, avant - stock)),
    };
  });

  return resultat;
}