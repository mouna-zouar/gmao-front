/**
 * Service chargé à la première utilisation : le store déclare tous les modules de l'application,
 * mais le code de chaque service n'est téléchargé qu'au premier appel d'une de ses méthodes.
 * Toutes les méthodes renvoient une promesse (comme les services d'origine).
 */
export function serviceDiffere(importer) {
  let promesse = null;
  const charger = () => {
    if (!promesse) promesse = importer().then((m) => m.default ?? m).catch((e) => { promesse = null; throw e; });
    return promesse;
  };
  return new Proxy({}, {
    get: (_, methode) => (methode === 'then' || typeof methode === 'symbol'
      ? undefined
      : (...args) => charger().then((service) => service[methode](...args))),
  });
}
