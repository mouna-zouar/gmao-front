import equipementService from '../../../services/equipementService';
import { imprimerEtiquettesQr, qrSvg as qrSvgTexte } from '../../../utils/qrCode';
import { t } from '../../../i18n';

/* QR codes des équipements : le QR code ouvre la fiche de l'appareil (…/equipement/12). */

export function qrSvg(id) {
  return qrSvgTexte(equipementService.urlFiche(id));
}

/** equipements : [{ id, designation, marque, modele, numPiece, codeBarre }] */
export function imprimerEtiquettes(equipements) {
  return imprimerEtiquettesQr(equipements.map((e) => ({
    url: equipementService.urlFiche(e.id),
    titre: e.designation || t('Équipement #{id}', { id: e.id }),
    sousTitre: [e.marque, e.modele].filter(Boolean).join(' '),
    reference: e.numPiece || e.codeBarre || `#${e.id}`,
    appel: t('Scannez pour signaler une panne'),
  })));
}
