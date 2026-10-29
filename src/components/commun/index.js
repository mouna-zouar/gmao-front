/*
 * Bibliothèque de composants communs de la GMAO.
 * Voir LISEZMOI.md dans ce dossier pour les exemples.
 *
 *   import { Modale, ModaleFormulaire, PageListe, Stat, Carte } from '../../commun';
 */
export { default as Modale } from './Modale';
export { default as ModaleFormulaire } from './ModaleFormulaire';
export { default as Formulaire, Champ } from './Formulaire';
export { useFormulaire, valeursDepuis, validerChamp, versPayload } from './useFormulaire';
export { default as PageListe } from './PageListe';
export { default as Pagination } from './Pagination';
export { default as PastillesStats, COULEURS_TONS } from './PastillesStats';
export {
  EnteteTableau, Stat, Carte, Barres, Repartition, Liste, Badge, Vide, PLEIN,
} from './TableauBord';
export { default as ConfirmModal } from '../ui/modals/ConfirmModal';
