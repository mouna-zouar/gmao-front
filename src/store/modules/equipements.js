import { creerModule } from '../fabriques/creerModule';
import { creerReferentiel } from '../fabriques/creerReferentiel';
import { creerRequete } from '../fabriques/creerRequete';
import etatEquipementService from '../../services/Etatequipementservice';
import equipementMaintenanceService from '../../services/equipementMaintenanceService';
import equipementService from '../../services/equipementService';
import hierarchieService from '../../services/hierarchieService';
import disponibiliteService from '../../services/Disponibiliteservice';
import risqueService from '../../services/Risqueservice';
import maintenanceConditionnelleService from '../../services/maintenanceConditionnelleService';
import renouvellementService from '../../services/renouvellementService';
import metrologieService from '../../services/metrologieService';
import compteurService from '../../services/Compteurservice';

const MIN = 60 * 1000;
const ECRITURE_PARC = /^(bon-maintenance|etat-equipement|lot-article-immobilistation|equipements|equipement-maintenance|hierarchie)/;
const objet = (vide) => (d) => (d && typeof d === 'object' ? d : vide);

export const etatsEquipements = creerReferentiel({
  nom: 'etatsEquipements',
  charger: () => etatEquipementService.getAll(),
  validiteMs: 2 * MIN,
  invalidePar: ECRITURE_PARC,
});

export const typesMaintenanceEquipement = creerReferentiel({
  nom: 'typesMaintenanceEquipement',
  charger: () => equipementMaintenanceService.getTypes(),
  validiteMs: 10 * MIN,
  invalidePar: /^equipement-maintenance\/types/,
});

export const connexionsEquipements = creerReferentiel({
  nom: 'connexionsEquipements',
  charger: () => equipementService.listeConnexions(),
  validiteMs: 2 * MIN,
  invalidePar: /^equipements\/[^/]+\/connexion/,
});

export const arbreLieux = creerReferentiel({
  nom: 'arbreLieux',
  charger: () => hierarchieService.arbre(),
  validiteMs: MIN,
  invalidePar: /^hierarchie/,
  transformer: objet({ lieux: [] }),
});

export const disponibilites = creerRequete({
  nom: 'disponibilites',
  executer: (periode) => disponibiliteService.getAll(periode).then((d) => d ?? []),
  validiteMs: 5 * MIN,
  invalidePar: ECRITURE_PARC,
});

export const risques = creerRequete({
  nom: 'risques',
  executer: ({ limite }) => risqueService.getRisques(limite).then((d) => d ?? []),
  validiteMs: 5 * MIN,
  invalidePar: ECRITURE_PARC,
});

export const reglesConditionnelles = creerRequete({
  nom: 'reglesConditionnelles',
  executer: ({ equipementId }) => maintenanceConditionnelleService.regles(equipementId).then((d) => d ?? []),
  validiteMs: 2 * MIN,
  invalidePar: /^maintenance-conditionnelle/,
});

export const renouvellement = creerRequete({
  nom: 'renouvellement',
  executer: (_params, { forcer }) => renouvellementService.tableau(forcer),
  validiteMs: 10 * MIN,
  invalidePar: /^renouvellement/,
  maxEntrees: 1,
});

const PERIME_METROLOGIE = /^(metrologie|materiovigilance)/;
export const echeancierMetrologie = creerRequete({
  nom: 'echeancierMetrologie',
  executer: () => metrologieService.echeancier(),
  validiteMs: 2 * MIN,
  invalidePar: PERIME_METROLOGIE,
});
export const controlesMetrologie = creerRequete({
  nom: 'controlesMetrologie',
  executer: ({ equipementId }) => metrologieService.controles(equipementId),
  validiteMs: 2 * MIN,
  invalidePar: PERIME_METROLOGIE,
});
export const incidentsMateriovigilance = creerRequete({
  nom: 'incidentsMateriovigilance',
  executer: () => metrologieService.incidents(),
  validiteMs: 2 * MIN,
  invalidePar: PERIME_METROLOGIE,
});
export const delaisMateriovigilance = creerRequete({
  nom: 'delaisMateriovigilance',
  executer: () => metrologieService.delais(),
  validiteMs: 30 * MIN,
  invalidePar: /^materiovigilance\/delais/,
});

export const compteurs = creerModule({
  nom: 'compteurs',
  service: {
    lister: ({ page = 0, taille = 500 } = {}) => compteurService.getAll(page, taille),
    obtenir: (id) => compteurService.getById(id),
    creer: (donnees) => compteurService.create(donnees),
    modifier: (id, donnees) => compteurService.update(id, donnees),
    supprimer: (id) => compteurService.remove(id),
  },
  validiteMs: 2 * MIN,
  invalidePar: /^compteur/,
});
