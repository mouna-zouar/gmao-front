// ============================================================
// Impression d'une pièce (demande de fourniture, commande fournisseur…)
// au même format que le rapport Cubix « GetDetailImprime » (RapportTransfert) :
//   « Saisie par » · logo + bloc société · bulle (type de pièce, N°, date)
//   · blocs dépôt / cible / service · tableau Désignation / Qté / Qté emballage
//   complété jusqu'à 17 lignes.
//
//   imprimerPiece({
//     entete: { nom, adresse, ville, codePostal, matriculeFiscal, telephone },
//     titre: 'Demande de fourniture', numero: 'DEM-…', date: '2026-10-28T09:00:00',
//     saisiePar: 'Mouna Zouari',
//     depot: { nom, adresse, codePostal, ville, telephone },   // facultatif
//     cible: { nom, adresse, codePostal, ville, telephone },   // facultatif
//     service: 'Radiologie',                                  // facultatif
//     lignes: [{ designation, qte, qteEmballage, gratuit }],
//   });
// ============================================================
import { imprimerHtml } from './imprimerListe';

const LOGO_URL = new URL('../assets/logo_SoftSys.png', import.meta.url).href;
const NB_LIGNES_MIN = 17;

const e = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const dateFr = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return e(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const nombre = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? e(v) : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
};

function blocTiers(classe, t) {
  if (!t) return '';
  return `
    <div class="${classe}">
      <p>
        <span class="tiers-nom">${e(t.nom)}</span><br />
        Adresse : ${e(t.adresse)}  ${e(t.codePostal)} ${e(t.ville)}<br />
        Tél : ${e(t.telephone)}
      </p>
    </div>`;
}

function pieceHtml({ entete = {}, titre, numero, date, saisiePar, depot, cible, service, lignes = [], afficherQteEmballage = true }) {
  const nbCol = afficherQteEmballage ? 3 : 2;
  const lignesHtml = lignes.map((l) => `
        <tr class="ligne">
          <td class="col-designation">${e(l.designation)}${l.gratuit ? '<span class="gratuit">&nbsp;(Gratuit)</span>' : ''}${
  l.details ? `<br />${l.details.map(e).join('<br />')}` : ''}</td>
          <td class="col-qte">${nombre(l.qte)}</td>
          ${afficherQteEmballage ? `<td class="col-qte">${nombre(l.qteEmballage)}</td>` : ''}
        </tr>`).join('');
  const vides = Array.from({ length: Math.max(0, NB_LIGNES_MIN - lignes.length) })
    .map(() => `<tr class="vide"><td colspan="${nbCol}">&nbsp;</td></tr>`).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${e(titre)} ${e(numero)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .saisie { font-size: 11px; }
  .DetailContent { width: 100%; }

  /* En-tête société (logo + coordonnées) */
  #entete { margin: 15px; display: inline-block; vertical-align: top; }
  #entete img.logo { max-height: 70px; max-width: 160px; vertical-align: top; margin-right: 12px; }
  .societeheader { display: inline-block; vertical-align: top; line-height: 1.45; }
  .societe-nom { font-weight: bold; font-size: 20px; }

  /* Bulle : type de pièce, N°, date */
  .bubble { display: inline-block; float: right; position: relative; width: 250px; margin: 15px 15px 0 0; }
  .bubble .rectangle { position: relative; z-index: 2; background: #4a4a4a; color: #fff; text-align: center; padding: 6px 10px; margin: 0 -10px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
  .bubble .rectangle h2 { margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .bubble .triangle-l, .bubble .triangle-r { position: absolute; top: 100%; width: 0; height: 0; border-style: solid; z-index: 1; }
  .bubble .triangle-l { left: -10px; border-width: 0 10px 8px 0; border-color: transparent #222 transparent transparent; }
  .bubble .triangle-r { right: -10px; border-width: 8px 10px 0 0; border-color: #222 transparent transparent transparent; }
  .bubble .info { border: 1px solid #939393; border-top: 0; background: #f4f4f4; padding: 14px 12px 8px; font-size: 13px; line-height: 1.6; }

  /* Dépôt / cible / service */
  .tiers { margin-top: 6px; }
  .depotheader, .cibleheader { display: inline-block; vertical-align: top; min-width: 260px; margin: 6px 15px 0 15px; padding: 2px 12px; border: 1px solid #939393; border-radius: 6px; }
  .depotheader p, .cibleheader p { margin: 6px 0; line-height: 1.45; }
  .tiers-nom { display: inline-block; font-weight: bold; font-size: 20px; text-align: center; }
  .clear { clear: both; }

  /* Tableau */
  table { width: 100%; border-collapse: collapse; }
  .tablehead { margin-top: 20px; }
  .tablehead th { height: 30px; background: #4a4a4a; color: #fff; font-size: 13px; font-weight: bold; text-align: center; border: 1px solid #4a4a4a; padding: 4px 8px; }
  .tablehead th:first-child { text-align: left; }
  .tablecontent { border: 1px solid #939393; border-top: 0; }
  .tablecontent td { padding: 5px 8px; height: 24px; border-right: 1px solid #939393; vertical-align: top; }
  .tablecontent td:last-child { border-right: 0; }
  .tablecontent tr.ligne { border-bottom: 1px solid #939393; }
  .tablecontent tr.ligne:nth-child(even) td { background: #f2f2f2; }
  .tablecontent tr.vide td { background: transparent !important; border-right: 0; }
  .col-designation { text-align: left; }
  .col-qte { width: 200px; text-align: center; }
  .gratuit { font-weight: bold; color: red; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
Saisie par : ${e(saisiePar)}
<br />
<div id="DetailContent" class="DetailContent">

  <div id="entete">
    <img class="logo" src="${LOGO_URL}" alt="" onerror="this.style.display='none'" />
    <div class="societeheader">
      <span class="societe-nom">${e(entete.nom)}</span><br />
      ${e(entete.adresse)} <br />
      ${e(entete.ville)} ${e(entete.codePostal)} <br />
      Matricule Fiscale : ${e(entete.matriculeFiscal)} <br />
      Téléphone : ${e(entete.telephone)}<br />
    </div>
  </div>
  <div class="bubble">
    <div class="rectangle"><h2>${e(titre)}</h2></div>
    <div class="triangle-l"></div>
    <div class="triangle-r"></div>
    <div class="info">
      N° ${e(numero)}<br />
      Date : ${dateFr(date)}
    </div>
  </div>

  <div class="tiers">
    ${blocTiers('depotheader', depot)}
    ${blocTiers('cibleheader', cible)}
    ${service ? `<div class="cibleheader"><p><span class="tiers-nom">${e(service)}</span></p></div>` : ''}
  </div>
  <div class="clear"></div>
  <br />
  <table class="tablehead">
    <tr>
      <th>Désignation</th>
      <th style="width:200px;">Qté</th>
      ${afficherQteEmballage ? '<th style="width:200px;">Qté emballage</th>' : ''}
    </tr>
  </table>
  <div class="tablecontent">
    <table>
      <tbody>${lignesHtml}${vides}
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;
}

export function imprimerPiece(options) {
  imprimerHtml(pieceHtml(options));
}

export default imprimerPiece;
