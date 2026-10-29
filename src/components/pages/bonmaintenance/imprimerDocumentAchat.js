import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import articleService from '../../../services/articleService';
import parametreService from '../../../services/parametreService';
import prestataireService from '../../../services/prestataireService';
import depotCubixService from '../../../services/depotCubixService';
import authService from '../../../services/Authservice';
import { imprimerPiece } from '../../../utils/imprimerPiece';
import { t } from '../../../i18n';

/*
 * Impression d'un document d'achat d'un bon (demande de fourniture, commande fournisseur)
 * au format des rapports Cubix (voir utils/imprimerPiece.js).
 */

export const TYPES_PIECE = { '.COMMANDE_FOURNISSEUR': 'Commande fournisseur', '.D_Fourniture': 'Demande de fourniture' };
const CODE_DEMANDE = '.D_Fourniture';

/** En-tête société : Paramètres > En-tête des impressions, sinon le prestataire de la session Cubix. */
export async function enteteImpression() {
  const params = await parametreService.getAll().catch(() => []);
  const v = (cle) => (params || []).find((p) => p.cle === cle)?.valeur?.trim() || '';
  const contexte = authService.getContexteMetier() || {};
  let presta = null;
  if ((!v('impression.societe.nom') || !v('impression.societe.telephone')) && Number(contexte.prestataireId) > 0) {
    presta = await prestataireService.getById(contexte.prestataireId).catch(() => null);
  }
  const nomPresta = presta ? (presta.raisonSociale || `${presta.nom || ''} ${presta.prenom || ''}`.trim()) : '';
  return {
    nom: v('impression.societe.nom') || nomPresta || contexte.prestataireNom || '',
    adresse: v('impression.societe.adresse'),
    ville: v('impression.societe.ville'),
    codePostal: v('impression.societe.code_postal'),
    matriculeFiscal: v('impression.societe.matricule_fiscal'),
    telephone: v('impression.societe.telephone') || presta?.telephone || '',
  };
}

/**
 * Imprime un document d'achat ({ id, pieceId, piece, lignes }).
 * articles (facultatif) : liste déjà chargée pour retrouver les désignations.
 */
export async function imprimerDocumentAchat(d, { bon, articles } = {}) {
  const piece = d.piece || {};
  const [entete, depotCubix, cible, listeArticles] = await Promise.all([
    enteteImpression(),
    piece.depotId ? depotCubixService.getById(piece.depotId).catch(() => null) : Promise.resolve(null),
    piece.cibleId ? prestataireService.getById(piece.cibleId).catch(() => null) : Promise.resolve(null),
    articles?.length ? Promise.resolve(articles) : articleService.getAll(0, 300).then((p) => p.content ?? []).catch(() => []),
  ]);
  const depotNom = depotCubix?.nom || depotCubix?.codeDepots || bon?.depotNom || bon?.depot?.codeDepots;
  const user = authService.getCurrentUser() || {};
  imprimerPiece({
    entete,
    titre: piece.description || TYPES_PIECE[piece.codePieceType] || t('Pièce'),
    numero: piece.numPiece || piece.num || `#${d.pieceId}`,
    date: piece.date || piece.dateCreation,
    saisiePar: piece.personnelCreationNom || user.userNom || user.login || '',
    depot: depotNom ? { nom: depotNom } : null,
    cible: cible ? { nom: cible.raisonSociale || `${cible.nom || ''} ${cible.prenom || ''}`.trim(), telephone: cible.telephone } : null,
    service: bon?.serviceNom || bon?.service?.description || null,
    lignes: (d.lignes ?? []).map((l) => ({
      designation: listeArticles.find((a) => String(a.id) === String(l.prestataireArticlesId))?.designation
        || t('Article #{id}', { id: l.prestataireArticlesId }),
      qte: l.qte,
      qteEmballage: l.qteColisee,
      gratuit: l.estGratuit === true,
    })),
  });
}

/** Imprime la demande de fourniture du bon (la plus récente). Renvoie false s'il n'y en a pas. */
export async function imprimerDemandeDuBon(bon) {
  const docs = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bon.id);
  const demandes = (docs ?? []).filter((d) => d.piece?.codePieceType === CODE_DEMANDE);
  if (demandes.length === 0) return false;
  const derniere = demandes.reduce((a, b) => (new Date(b.piece?.date || 0) > new Date(a.piece?.date || 0) ? b : a));
  await imprimerDocumentAchat(derniere, { bon });
  return true;
}
