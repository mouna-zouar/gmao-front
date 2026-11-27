import { serviceDiffere } from '../fabriques/serviceDiffere';
import { creerReferentiel } from '../fabriques/creerReferentiel';
import { creerRequete } from '../fabriques/creerRequete';

const parametreService = serviceDiffere(() => import('../../services/parametreService'));
const stockAlerteService = serviceDiffere(() => import('../../services/stockAlerteService'));

const MIN = 60 * 1000;

export const parametres = creerReferentiel({
  nom: 'parametres',
  charger: () => parametreService.getAll(),
  validiteMs: 5 * MIN,
  invalidePar: /^parametres/,
});

export const alertesStock = creerRequete({
  nom: 'alertesStock',
  executer: (_params, { forcer }) => stockAlerteService.synthese(forcer),
  validiteMs: 2 * MIN,
  invalidePar: /^(stock|bon-maintenance|piece|demande)/,
  maxEntrees: 1,
});

export const reglagesStock = creerRequete({
  nom: 'reglagesStock',
  executer: () => stockAlerteService.reglages(),
  validiteMs: 10 * MIN,
  invalidePar: /^stock\/alertes\/reglages/,
  maxEntrees: 1,
});
