import { imprimerHtml } from './imprimerListe';

const LOGO_URL = new URL('../assets/logo_SoftSys.png', import.meta.url).href;

const e = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const p2 = (n) => String(n).padStart(2, '0');

const dateFr = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return e(v);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const nombre = (v) => {
  const n = num(v);
  return n === null ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
};

const montant = (v) => {
  const n = num(v);
  return n === null ? '' : n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

function moins100(n) {
  if (n < 17) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d < 7) return DIZAINES[d] + (u === 0 ? '' : u === 1 ? ' et un' : `-${UNITES[u]}`);
  if (d === 7) return `soixante${u === 1 ? ' et onze' : `-${moins100(10 + u)}`}`;
  if (d === 8) return u === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITES[u]}`;
  return `quatre-vingt-${moins100(10 + u)}`;
}

function moins1000(n) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = '';
  if (c > 0) s = c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 ? 's' : ''}`;
  if (r > 0) s += (s ? ' ' : '') + moins100(r);
  return s;
}

function entierEnLettres(n) {
  if (n === 0) return 'zéro';
  const parts = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1000);
  const reste = n % 1000;
  if (milliards) parts.push(`${moins1000(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) parts.push(`${moins1000(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) parts.push(milliers === 1 ? 'mille' : `${moins1000(milliers).replace(/(cent|vingt)s$/, '$1')} mille`);
  if (reste) parts.push(moins1000(reste));
  return parts.join(' ');
}

function montantEnLettres(valeur, devise) {
  const n = num(valeur);
  if (n === null || n < 0) return '';
  let entier = Math.floor(n);
  let millimes = Math.round((n - entier) * 1000);
  if (millimes === 1000) { entier += 1; millimes = 0; }
  const d = String(devise || '').trim().toUpperCase();
  if (!d || ['DT', 'TND', 'DINAR', 'DINARS'].includes(d)) {
    const txt = `${entierEnLettres(entier)} dinar${entier > 1 ? 's' : ''}`;
    return millimes ? `${txt} et ${entierEnLettres(millimes)} millime${millimes > 1 ? 's' : ''}` : txt;
  }
  return `${entierEnLettres(entier)} ${devise}${millimes ? ` (${montant(n)})` : ''}`;
}

function blocTiers(libelle, t) {
  if (!t || !t.nom) return '';
  const ville = [t.codePostal, t.ville].filter(Boolean).join(' ');
  const lignes = [
    t.adresse || ville ? `${e(t.adresse)}${t.adresse && ville ? ', ' : ''}${e(ville)}` : '',
    t.telephone ? `Tél : ${e(t.telephone)}` : '',
    t.matriculeFiscal ? `M.F. : ${e(t.matriculeFiscal)}` : '',
  ].filter(Boolean);
  return `
    <div class="tiers">
      <div class="tiers-libelle">${e(libelle)}</div>
      <div class="tiers-nom">${e(t.nom)}</div>
      ${lignes.map((l) => `<div>${l}</div>`).join('')}
    </div>`;
}

function infoLigne(libelle, valeur) {
  return valeur ? `<div><span class="lib">${e(libelle)}</span> ${valeur}</div>` : '';
}

function calculerTotaux(lignes) {
  let tht = 0;
  let tremise = 0;
  let ttva = 0;
  lignes.forEach((l) => {
    if (l.gratuit) return;
    const qte = num(l.qte) ?? 0;
    const pu = num(l.prixUnitaire) ?? 0;
    const brut = qte * pu;
    const rem = brut * ((num(l.remise) ?? 0) / 100);
    const net = num(l.montantHT) ?? brut - rem;
    tht += net;
    tremise += rem;
    ttva += net * ((num(l.tva) ?? 0) / 100);
  });
  return { tht, tremise, ttva, timbre: 0, ttc: tht + ttva };
}

function pieceHtml(o) {
  const {
    type, entete = {}, titre, numero, date, saisiePar, cubixNumPiece, dateLivraison, objet, note, devise,
    reference = {}, depot, depotDestination, cible, service, lignes = [],
  } = o;
  const commande = type === 'COMMANDE';
  const afficherPrix = commande && lignes.some((l) => num(l.prixUnitaire) !== null);
  const afficherCode = lignes.some((l) => l.code);
  const afficherUnite = lignes.some((l) => l.unite);
  const tot = afficherPrix ? { ...calculerTotaux(lignes), ...Object.fromEntries(
    Object.entries(o.totaux || {}).filter(([, v]) => num(v) !== null && num(v) !== 0),
  ) } : null;
  if (tot && !(o.totaux && num(o.totaux.ttc))) tot.ttc = tot.tht + tot.ttva + (num(tot.timbre) ?? 0);
  const symbole = devise && devise.trim() ? devise.trim() : 'DT';

  const cols = [
    { titre: 'N°', classe: 'c-num', val: (l, i) => i + 1 },
    afficherCode && { titre: 'Code', classe: 'c-code', val: (l) => e(l.code) },
    { titre: 'Désignation', classe: 'c-design', val: (l) => `${e(l.designation)}${l.gratuit ? ' <span class="gratuit">(Gratuit)</span>' : ''}${
      l.details?.length ? `<div class="details">${l.details.map(e).join('<br />')}</div>` : ''}` },
    afficherUnite && { titre: 'Unité', classe: 'c-unite', val: (l) => e(l.unite) },
    ...(commande
      ? [
        { titre: 'Qté', classe: 'c-nb', val: (l) => nombre(l.qte) },
        ...(afficherPrix ? [
          { titre: 'P.U. HT', classe: 'c-mt', val: (l) => montant(l.prixUnitaire) },
          { titre: 'Rem. %', classe: 'c-pct', val: (l) => (num(l.remise) ? nombre(l.remise) : '') },
          { titre: 'TVA %', classe: 'c-pct', val: (l) => nombre(l.tva) },
          { titre: 'Montant HT', classe: 'c-mt', val: (l) => {
            if (l.gratuit) return montant(0);
            const net = num(l.montantHT) ?? (num(l.qte) ?? 0) * (num(l.prixUnitaire) ?? 0) * (1 - (num(l.remise) ?? 0) / 100);
            return montant(net);
          } },
        ] : []),
      ]
      : [
        { titre: 'Qté demandée', classe: 'c-nb', val: (l) => nombre(l.qte) },
        { titre: 'Qté livrée', classe: 'c-nb', val: () => '' },
        { titre: 'Observation', classe: 'c-obs', val: () => '' },
      ]),
  ].filter(Boolean);

  const nbVides = Math.max(0, (commande ? 6 : 10) - lignes.length);
  const lignesHtml = lignes.map((l, i) => `
      <tr>${cols.map((c) => `<td class="${c.classe}">${c.val(l, i)}</td>`).join('')}</tr>`).join('')
    + Array.from({ length: nbVides }).map(() => `
      <tr class="vide">${cols.map((c) => `<td class="${c.classe}">&nbsp;</td>`).join('')}</tr>`).join('');

  const totalQte = lignes.reduce((s, l) => s + (num(l.qte) ?? 0), 0);

  const signatures = commande
    ? ['Établi par', 'Visa de la direction', 'Cachet et signature du fournisseur']
    : ['Demandeur', 'Responsable maintenance', 'Magasinier (livré par)'];

  const maintenant = new Date();
  const imprimeLe = `Imprimé le ${dateFr(maintenant)} à ${p2(maintenant.getHours())}:${p2(maintenant.getMinutes())}`;
  const piedGauche = `${titre || ''} ${numero || ''} · ${imprimeLe}`.replace(/["\\]/g, '');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${e(titre)} ${e(numero)}</title>
<style>
  @page {
    size: A4 portrait; margin: 12mm 10mm 14mm;
    @bottom-left { content: "${piedGauche}"; font: 8.5px Arial, sans-serif; color: #666; }
    @bottom-right { content: "Page " counter(page) " / " counter(pages); font: 8.5px Arial, sans-serif; color: #666; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #111;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* En-tête */
  .haut { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
          padding-bottom: 10px; border-bottom: 2px solid #4a4a4a; }
  .societe { display: flex; gap: 12px; align-items: flex-start; }
  .societe img { max-height: 64px; max-width: 150px; }
  .societe-nom { font-weight: bold; font-size: 17px; margin-bottom: 2px; }
  .societe div { line-height: 1.4; }

  .bulle { width: 245px; flex-shrink: 0; }
  .bulle h1 { margin: 0; background: #4a4a4a; color: #fff; text-align: center; font-size: 14px;
              text-transform: uppercase; letter-spacing: .5px; padding: 7px 8px; }
  .bulle .info { border: 1px solid #939393; border-top: 0; background: #f4f4f4; padding: 8px 10px; line-height: 1.6; }
  .bulle .numero { font-size: 15px; font-weight: bold; }
  .lib { color: #555; }

  /* Tiers et références */
  .tiers-ligne { display: flex; gap: 10px; margin-top: 12px; }
  .tiers { flex: 1; border: 1px solid #939393; border-radius: 6px; padding: 7px 10px; line-height: 1.45; }
  .tiers-libelle { font-size: 9.5px; text-transform: uppercase; letter-spacing: .6px; color: #666; margin-bottom: 2px; }
  .tiers-nom { font-weight: bold; font-size: 14px; }
  .fleche { align-self: center; font-size: 22px; color: #4a4a4a; }

  .refs { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 10px; padding: 7px 10px;
          background: #f4f4f4; border-left: 3px solid #4a4a4a; line-height: 1.5; }

  /* Tableau */
  table.lignes { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.lignes th { background: #4a4a4a; color: #fff; font-size: 11px; padding: 6px 5px; border: 1px solid #4a4a4a; }
  table.lignes td { border: 1px solid #b5b5b5; padding: 5px; vertical-align: top; height: 24px; }
  table.lignes tbody tr:nth-child(even) td { background: #f6f6f6; }
  table.lignes tr.vide td { background: #fff !important; }
  table.lignes tfoot td { font-weight: bold; background: #ececec; }
  .c-num { width: 28px; text-align: center; }
  .c-code { width: 80px; }
  .c-design { text-align: left; }
  .c-unite { width: 55px; text-align: center; }
  .c-nb { width: 78px; text-align: center; }
  .c-pct { width: 48px; text-align: center; }
  .c-mt { width: 88px; text-align: right; white-space: nowrap; }
  .c-obs { width: 120px; }
  th.c-design { text-align: left; }
  .details { font-size: 10px; color: #555; }
  .gratuit { font-weight: bold; color: #c00; }
  thead { display: table-header-group; }
  tr, .bas, .signatures { page-break-inside: avoid; break-inside: avoid; }

  /* Totaux */
  .bas { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; }
  .lettres { flex: 1; font-size: 11px; line-height: 1.5; }
  .lettres b { text-transform: none; }
  table.totaux { border-collapse: collapse; width: 250px; }
  table.totaux td { border: 1px solid #b5b5b5; padding: 5px 8px; }
  table.totaux td:last-child { text-align: right; white-space: nowrap; }
  table.totaux tr.ttc td { background: #4a4a4a; color: #fff; font-weight: bold; font-size: 13px; }

  .note { margin-top: 12px; border: 1px dashed #939393; padding: 7px 10px; line-height: 1.45; white-space: pre-wrap; }

  /* Signatures */
  .signatures { display: flex; gap: 10px; margin-top: 22px; }
  .signatures div { flex: 1; border: 1px solid #939393; height: 85px; padding: 5px 8px; font-weight: bold; font-size: 11px; }
</style>
</head>
<body>

<div class="haut">
  <div class="societe">
    <img src="${LOGO_URL}" alt="" onerror="this.style.display='none'" />
    <div>
      <div class="societe-nom">${e(entete.nom)}</div>
      ${entete.adresse ? `<div>${e(entete.adresse)}</div>` : ''}
      ${entete.ville || entete.codePostal ? `<div>${e(entete.codePostal)} ${e(entete.ville)}</div>` : ''}
      ${entete.matriculeFiscal ? `<div>M.F. : ${e(entete.matriculeFiscal)}</div>` : ''}
      ${entete.telephone ? `<div>Tél : ${e(entete.telephone)}</div>` : ''}
    </div>
  </div>
  <div class="bulle">
    <h1>${e(titre)}</h1>
    <div class="info">
      <div class="numero">N° ${e(numero)}</div>
      <div><span class="lib">Date :</span> ${dateFr(date)}</div>
      ${commande && dateLivraison ? `<div><span class="lib">Livraison souhaitée :</span> ${dateFr(dateLivraison)}</div>` : ''}
      ${cubixNumPiece ? `<div><span class="lib">N° Cubix :</span> ${e(cubixNumPiece)}</div>` : ''}
    </div>
  </div>
</div>

<div class="tiers-ligne">
  ${commande
    ? `${blocTiers('Fournisseur', cible)}${blocTiers('Livrer à', depot)}`
    : `${blocTiers('Dépôt source', depot)}${depot?.nom && depotDestination?.nom ? '<div class="fleche">&#8594;</div>' : ''}${blocTiers('Dépôt destinataire', depotDestination)}${
      service ? blocTiers('Service', { nom: service }) : ''}`}
</div>

<div class="refs">
  ${infoLigne('Bon de maintenance :', reference.bonNum ? `<b>${e(reference.bonNum)}</b>${reference.bonTitre ? ` — ${e(reference.bonTitre)}` : ''}` : '')}
  ${infoLigne('Équipement :', e(reference.equipement))}
  ${commande && service ? infoLigne('Service :', e(service)) : ''}
  ${infoLigne('Demandeur :', e(reference.demandeur))}
  ${infoLigne('Saisie par :', e(saisiePar))}
  ${infoLigne('Objet :', e(objet))}
</div>

<table class="lignes">
  <thead><tr>${cols.map((c) => `<th class="${c.classe}">${c.titre}</th>`).join('')}</tr></thead>
  <tbody>${lignesHtml}
  </tbody>
  ${!afficherPrix && lignes.length ? `<tfoot><tr>${cols.map((c) => (
    c.classe === 'c-design' ? `<td class="c-design">${lignes.length} article${lignes.length > 1 ? 's' : ''}</td>`
      : c.titre === 'Qté' || c.titre === 'Qté demandée' ? `<td class="c-nb">${nombre(totalQte)}</td>` : '<td></td>'
  )).join('')}</tr></tfoot>` : ''}
</table>

${tot ? `
<div class="bas">
  <div class="lettres">
    Arrêtée la présente commande à la somme de :<br />
    <b>${e(montantEnLettres(tot.ttc, devise))}</b>
  </div>
  <table class="totaux">
    <tr><td>Total HT</td><td>${montant(tot.tht)} ${e(symbole)}</td></tr>
    ${num(tot.tremise) ? `<tr><td>dont remise</td><td>${montant(tot.tremise)} ${e(symbole)}</td></tr>` : ''}
    <tr><td>Total TVA</td><td>${montant(tot.ttva)} ${e(symbole)}</td></tr>
    ${num(tot.timbre) ? `<tr><td>Timbre fiscal</td><td>${montant(tot.timbre)} ${e(symbole)}</td></tr>` : ''}
    <tr class="ttc"><td>Net à payer TTC</td><td>${montant(tot.ttc)} ${e(symbole)}</td></tr>
  </table>
</div>` : ''}

${note ? `<div class="note"><span class="lib">Observations :</span> ${e(note)}</div>` : ''}

<div class="signatures">
  ${signatures.map((s) => `<div>${s}</div>`).join('')}
</div>

</body>
</html>`;
}

export function imprimerPiece(options) {
  imprimerHtml(pieceHtml(options));
}

export default imprimerPiece;
