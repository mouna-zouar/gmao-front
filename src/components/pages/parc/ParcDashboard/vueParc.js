import { prechargerParties } from '../../../../store/referentiels';

const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Tableau de bord du parc : synthèse, véhicules, carburant, incidents, missions, amendes et coûts en un seul appel. */
export function prechargerVueParc() {
  const auj = new Date();
  const debut = `${auj.getFullYear()}-01-01`;
  const fin = isoJour(auj);
  return prechargerParties('/vues/parc-dashboard', [
    { nom: 'dashboard', url: '/parc/dashboard', params: {}, store: ['tableauParc', {}] },
    { nom: 'vehicules', url: '/vehicule', params: { page: 0, size: 2000 }, store: ['vehicules'] },
    { nom: 'carburant', url: '/vehicule-bon-carburant', params: { page: 0, size: 3000 }, store: ['bonsCarburantParc', { page: 0, taille: 3000 }] },
    { nom: 'incidents', url: '/vehicule-incidents', params: { page: 0, size: 2000 }, store: ['incidentsParc', { page: 0, taille: 2000 }] },
    { nom: 'missions', url: '/vehicule-mission', params: { page: 0, size: 3000 }, store: ['missionsParc', { page: 0, taille: 3000 }] },
    { nom: 'amendes', url: '/vehicule-amendes', params: { page: 0, size: 1000, sort: 'dateInfraction,desc' }, store: ['amendesParc', { page: 0, taille: 1000 }] },
    { nom: 'couts', url: '/vehicule-couts', params: { debut, fin } },
  ], { debut, fin });
}
