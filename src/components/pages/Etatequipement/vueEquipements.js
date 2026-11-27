import { prechargerParties } from '../../../store/referentiels';

/** Page Équipements : équipements, services, états, disponibilité, risques et connexions en un seul appel. */
export function prechargerVueEquipements() {
  return prechargerParties('/vues/equipements', [
    { nom: 'equipements', url: '/lot-article-immobilistation', params: { page: 0, size: 5000 }, store: ['equipements'] },
    { nom: 'services', url: '/service', params: { page: 0, size: 1000 }, store: ['services'] },
    { nom: 'etats', url: '/etat-equipement', params: {}, store: ['etatsEquipements'] },
    { nom: 'disponibilites', url: '/disponibilite', params: {}, store: ['disponibilites', {}] },
    { nom: 'risques', url: '/maintenance-risque', params: { limite: 1000 }, store: ['risques', { limite: 1000 }] },
    { nom: 'connexions', url: '/equipements/connexions', params: {}, store: ['connexionsEquipements'] },
  ]);
}
