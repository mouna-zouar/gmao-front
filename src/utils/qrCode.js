import QRCode from 'qrcode';
import { t } from '../i18n';

/*
 * QR codes de la GMAO. Chaque QR code contient une adresse de l'application : scanné avec
 * l'appareil photo d'un téléphone, il ouvre directement la page concernée.
 * Attention : l'adresse est celle du navigateur au moment de l'impression ; imprimez depuis
 * l'adresse que les téléphones utiliseront (pas « localhost »).
 */

const origine = () => window.location.origin;

export const urlEquipement = (id) => `${origine()}/equipement/${id}`;
export const urlBon = (id) => `${origine()}/bons-maintenance?id=${id}`;
export const urlReclamation = (id) => `${origine()}/reclamations?id=${id}`;

/** SVG du QR code d'une adresse (correction M : reste lisible un peu abîmé). */
export function qrSvg(texte) {
  return QRCode.toString(texte, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Imprime des étiquettes QR : planche A4 de 3 × 7 (63,5 × 38,1 mm, type Avery L7160),
 * ou une seule étiquette centrée.
 * items : [{ url, titre, sousTitre?, reference?, appel? }]
 */
export async function imprimerEtiquettesQr(items) {
  const svgs = await Promise.all(items.map((e) => qrSvg(e.url)));
  const seule = items.length === 1;
  const etiquettes = items.map((e, i) => `
    <div class="etiquette">
      <div class="qr">${svgs[i]}</div>
      <div class="texte">
        <strong>${echapper(e.titre)}</strong>
        ${e.sousTitre ? `<span>${echapper(e.sousTitre)}</span>` : ''}
        ${e.reference ? `<span class="ref">${echapper(e.reference)}</span>` : ''}
        ${e.appel ? `<em>${echapper(e.appel)}</em>` : ''}
      </div>
    </div>`).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(t('Étiquettes QR'))}</title>
  <style>
    @page { size: A4 portrait; margin: ${seule ? '20mm' : '15.15mm 7.2mm'}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #102a30; }
    .planche { display: grid; grid-template-columns: repeat(3, 63.5mm); grid-auto-rows: 38.1mm; column-gap: 2.5mm; }
    .seule { display: flex; justify-content: center; }
    .seule .etiquette { width: 90mm; height: 50mm; border: 0.3mm dashed #9bb; }
    .etiquette { display: flex; align-items: center; gap: 2.5mm; padding: 2.5mm 3mm; overflow: hidden; break-inside: avoid; }
    .qr { width: 31mm; height: 31mm; flex-shrink: 0; }
    .seule .qr { width: 42mm; height: 42mm; }
    .qr svg { width: 100%; height: 100%; display: block; }
    .texte { display: flex; flex-direction: column; gap: 0.8mm; min-width: 0; font-size: 7.5pt; line-height: 1.2; }
    .texte strong { font-size: 8.5pt; max-height: 3em; overflow: hidden; }
    .texte .ref { font-family: 'Courier New', monospace; font-weight: bold; }
    .texte em { font-style: normal; color: #045a64; font-weight: bold; }
  </style></head><body><div class="${seule ? 'seule' : 'planche'}">${etiquettes}</div></body></html>`;

  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  Object.assign(cadre.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(cadre);
  const doc = cadre.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    cadre.contentWindow.focus();
    cadre.contentWindow.print();
    setTimeout(() => cadre.remove(), 1000);
  }, 250);
}
