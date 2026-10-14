// ============================================================
// IMPRESSION — listes et fiches de détail
//
// Construit un vrai document imprimable (en-tête avec logo, titre, date,
// contenu, pied de page numéroté) dans un iframe caché, puis ouvre la boîte
// d'impression du navigateur. L'utilisateur peut aussi y choisir
// « Enregistrer en PDF ». Toujours en A4 portrait.
//
// Le document suit la langue de l'application (français, arabe de droite à
// gauche, anglais) : c'est le navigateur qui le dessine, donc l'arabe s'affiche
// correctement, contrairement aux PDF jsPDF.
//
// 1) Une liste :
//   imprimerListe({
//     titre: t('Véhicules'),
//     colonnes: [t('Matricule'), { label: t('Kilométrage'), align: 'end' }],
//     lignes: [['123 TU 4567', '12 500 km'], …],
//     filtres: [{ label: t('Recherche'), valeur: 'toyota' }],   // facultatif
//   });
//
// 2) Une fiche de détail :
//   imprimerFiche({
//     titre: 'Pompe à perfusion',
//     reference: 'BM-0012',  statut: 'En cours',               // facultatifs
//     sections: [
//       { titre: 'Informations générales', champs: [{ label: 'Service', valeur: 'Bloc' }, …] },
//       { titre: 'Tâches', colonnes: [...], lignes: [[...], …], vide: 'Aucune tâche' },
//       { titre: 'Description', texte: '…' },
//     ],
//     signatures: ['Technicien', 'Responsable maintenance'],   // facultatif
//   });
// ============================================================
import { t, tp, locale, LANGUES, langueActuelle } from '../i18n';

// Logo résolu par Vite au moment du build ; s'il manque, il est simplement masqué.
const LOGO_URL = new URL('../assets/logo_SoftSys.png', import.meta.url).href;

const echapper = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const vide = (v) => v === null || v === undefined || String(v).trim() === '';

// Échappe une chaîne pour la propriété CSS `content: "…"`.
const chaineCss = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function normaliserColonne(c) {
  if (c && typeof c === 'object') return { label: c.label ?? '', align: c.align || 'start', largeur: c.largeur };
  return { label: c ?? '', align: 'start' };
}

// ---------- Tableau ----------
function tableauHtml(colonnes, lignes, texteVide) {
  const cols = colonnes.map(normaliserColonne);
  const thead = cols.map((c) => `<th class="al-${c.align}"${c.largeur ? ` style="width:${echapper(c.largeur)}"` : ''}>${echapper(c.label)}</th>`).join('');
  const tbody = lignes.length === 0
    ? `<tr><td class="vide" colspan="${cols.length || 1}">${echapper(texteVide || t('Aucune donnée à imprimer.'))}</td></tr>`
    : lignes.map((ligne) => `<tr>${cols.map((c, i) => {
      const v = ligne[i];
      // <bdi> : un matricule « 123 TU 4567 » ou une valeur latine reste dans le bon ordre en arabe
      return `<td class="al-${c.align}"><bdi>${echapper(vide(v) ? '—' : v)}</bdi></td>`;
    }).join('')}</tr>`).join('');
  return `<table class="${cols.length > 6 ? 'serre' : ''}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

// ---------- Squelette commun (en-tête, styles, pied de page) ----------
function documentHtml({ titre, sousTitre, entreteDroite, corps, qr }) {
  const code = langueActuelle();
  const langue = LANGUES[code] || LANGUES.fr;
  const ar = code === 'ar';
  const maintenant = new Date();
  const date = maintenant.toLocaleDateString(locale(), { day: '2-digit', month: 'long', year: 'numeric' });
  const heure = maintenant.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

  const police = ar
    ? "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif"
    : "'Figtree', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const piedDate = t('Imprimé le {date} à {heure}', { date, heure });

  return `<!doctype html>
<html lang="${langue.code}" dir="${langue.dir}">
<head>
<meta charset="utf-8">
<title>${echapper(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">
<style>
  @page {
    size: A4 portrait;
    margin: 14mm 12mm 16mm;
    @bottom-left { content: ${chaineCss(langue.dir === 'rtl' ? '' : piedDate)}; font: 8.5pt ${police}; color: #64748b; }
    @bottom-right { content: ${chaineCss(langue.dir === 'rtl' ? piedDate : '')}; font: 8.5pt ${police}; color: #64748b; }
    @bottom-center { content: ${chaineCss(t('Page'))} " " counter(page) " / " counter(pages); font: 8.5pt ${police}; color: #64748b; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${police}; color: #0f172a; font-size: 9.5pt; line-height: 1.45; }

  .entete {
    display: flex; align-items: center; gap: 14px;
    padding-bottom: 10px; margin-bottom: 14px;
    border-bottom: 2.5px solid #0f766e;
  }
  .entete img { height: 34px; width: auto; }
  .entete-texte { flex: 1; min-width: 0; }
  .marque { font-size: 8pt; font-weight: 700; color: #0f766e; text-transform: ${ar ? 'none' : 'uppercase'}; letter-spacing: ${ar ? '0' : '.08em'}; }
  h1 { margin: 2px 0 0; font-size: 17pt; font-weight: 800; letter-spacing: ${ar ? '0' : '-.01em'}; }
  .sous-titre { margin: 2px 0 0; color: #475569; font-size: 9.5pt; }
  .meta { text-align: end; color: #475569; font-size: 8.5pt; white-space: nowrap; }
  .meta b { display: block; color: #0f172a; font-size: 11pt; }
  /* QR code de la fiche (ouvre le bon ou la réclamation dans l'application) */
  .qr { flex-shrink: 0; width: 23mm; text-align: center; font-size: 6.5pt; color: #475569; line-height: 1.2; }
  .qr svg { display: block; width: 23mm; height: 23mm; }
  .statut { display: inline-block; margin-top: 3px; padding: 1px 9px; border-radius: 999px; background: #ccfbf1; color: #115e59; font-weight: 700; font-size: 8.5pt; }

  .filtres { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 10px; }
  .filtres-titre { font-size: 8pt; font-weight: 700; color: #64748b; margin-inline-end: 4px; }
  .filtre { border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 9px; font-size: 8.5pt; background: #f8fafc; }
  .filtre b { font-weight: 600; color: #475569; }

  table { width: 100%; border-collapse: collapse; }
  table.serre { font-size: 8pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #0f766e; color: #fff; font-weight: 700; font-size: 8.5pt; padding: 6px 7px; border: 1px solid #0f766e; }
  table.serre th { font-size: 7.5pt; padding: 5px 5px; }
  td { padding: 5px 7px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
  table.serre td { padding: 4px 5px; }
  tbody tr:nth-child(even) td { background: #f1f5f9; }
  .al-start { text-align: start; }
  .al-center { text-align: center; }
  .al-end { text-align: end; font-variant-numeric: tabular-nums; }
  td.vide { text-align: center; color: #64748b; padding: 14px; font-style: italic; }
  .total { margin-top: 8px; font-size: 8.5pt; color: #475569; text-align: end; }

  /* Fiche de détail */
  .section { margin: 0 0 14px; break-inside: auto; }
  .section h2 {
    margin: 0 0 7px; padding: 0 0 4px; font-size: 11pt; font-weight: 800; color: #0f766e;
    border-bottom: 1px solid #cbd5e1; break-after: avoid; page-break-after: avoid;
  }
  .champs { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .champ { display: flex; gap: 8px; padding: 5px 9px; border-bottom: 1px solid #eef2f6; break-inside: avoid; }
  .champ:nth-child(odd) { border-inline-end: 1px solid #eef2f6; }
  .champ.large { grid-column: 1 / -1; border-inline-end: 0; }
  .champ dt { flex: 0 0 38%; color: #64748b; font-weight: 600; font-size: 8.5pt; }
  .champ.large dt { flex-basis: 19%; }
  .champ dd { margin: 0; flex: 1; font-weight: 600; word-break: break-word; white-space: pre-line; }
  /* plaintext : un texte saisi en français garde sa ponctuation à la bonne place dans une fiche en arabe */
  .texte { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; white-space: pre-line; unicode-bidi: plaintext; }
  .signatures { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 14px; margin-top: 22px; break-inside: avoid; }
  .signature { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; height: 70px; font-size: 8.5pt; color: #475569; font-weight: 600; }

  @media screen { body { padding: 16px; } }
</style>
</head>
<body>
  <header class="entete">
    <img src="${echapper(LOGO_URL)}" alt="" onerror="this.remove()">
    <div class="entete-texte">
      <div class="marque">GMAO</div>
      <h1>${echapper(titre)}</h1>
      ${sousTitre ? `<p class="sous-titre">${echapper(sousTitre)}</p>` : ''}
    </div>
    <div class="meta">
      ${entreteDroite || ''}
      ${echapper(date)} · ${echapper(heure)}
    </div>
    ${qr ? `<div class="qr">${qr}<span>${echapper(t('Scanner pour ouvrir'))}</span></div>` : ''}
  </header>
  ${corps}
</body>
</html>`;
}

// ---------- Contenus ----------
function listeHtml({ titre, sousTitre, colonnes, lignes, filtres }) {
  const filtresActifs = (filtres || []).filter((f) => f && !vide(f.valeur));
  const blocFiltres = filtresActifs.length === 0 ? '' : `
    <div class="filtres">
      <span class="filtres-titre">${echapper(t('Filtres appliqués'))}</span>
      ${filtresActifs.map((f) => `<span class="filtre"><b>${echapper(f.label)}</b> <bdi>${echapper(f.valeur)}</bdi></span>`).join('')}
    </div>`;
  return documentHtml({
    titre,
    sousTitre,
    entreteDroite: `<b>${echapper(tp('ligne', lignes.length))}</b>`,
    corps: `${blocFiltres}
      ${tableauHtml(colonnes, lignes)}
      <p class="total">${echapper(t('Total : {n}', { n: lignes.length }))}</p>`,
  });
}

function sectionHtml(s) {
  if (!s) return '';
  const titre = s.titre ? `<h2>${echapper(s.titre)}</h2>` : '';
  if (s.champs) {
    const champs = s.champs.filter((c) => c && (!vide(c.valeur) || c.toujours));
    if (champs.length === 0) return '';
    return `<section class="section">${titre}<dl class="champs">${champs.map((c) => (
      `<div class="champ${c.large ? ' large' : ''}"><dt>${echapper(c.label)}</dt><dd><bdi>${echapper(vide(c.valeur) ? '—' : c.valeur)}</bdi></dd></div>`
    )).join('')}</dl></section>`;
  }
  if (s.colonnes) {
    return `<section class="section">${titre}${tableauHtml(s.colonnes, s.lignes || [], s.vide)}</section>`;
  }
  if (s.texte !== undefined) {
    if (vide(s.texte)) return '';
    return `<section class="section">${titre}<div class="texte">${echapper(s.texte)}</div></section>`;
  }
  return '';
}

function ficheHtml({ titre, sousTitre, reference, statut, sections, signatures, qr }) {
  const droite = `${reference ? `<b><bdi>${echapper(reference)}</bdi></b>` : ''}${statut ? `<span class="statut">${echapper(statut)}</span><br>` : ''}`;
  const blocSignatures = signatures && signatures.length > 0
    ? `<div class="signatures">${signatures.map((s) => `<div class="signature">${echapper(s)}</div>`).join('')}</div>`
    : '';
  return documentHtml({
    titre,
    sousTitre,
    entreteDroite: droite,
    corps: (sections || []).map(sectionHtml).join('') + blocSignatures,
    qr,
  });
}

// ---------- Impression via un iframe caché ----------
function imprimerHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  let lance = false;
  const nettoyer = () => setTimeout(() => iframe.remove(), 500);

  const lancer = () => {
    if (lance) return;
    lance = true;
    win.addEventListener('afterprint', nettoyer, { once: true });
    win.focus();
    win.print();
    // Filet de sécurité : certains navigateurs ne déclenchent pas afterprint
    setTimeout(nettoyer, 60000);
  };

  // Attendre les polices et le logo (sans bloquer plus de 2 s si le réseau est lent)
  const pret = Promise.all([
    doc.fonts ? doc.fonts.ready : Promise.resolve(),
    ...Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise((ok) => {
      img.addEventListener('load', ok, { once: true });
      img.addEventListener('error', ok, { once: true });
    }))),
  ]);
  Promise.race([pret, new Promise((ok) => setTimeout(ok, 2000))]).then(lancer);
}

/**
 * Imprime une liste filtrée (A4 portrait ; police resserrée au-delà de 6 colonnes).
 * @param {{titre:string, sousTitre?:string, colonnes:(string|{label:string, align?:'start'|'center'|'end', largeur?:string})[], lignes:any[][], filtres?:{label:string, valeur:any}[]}} options
 */
export function imprimerListe({ titre, sousTitre, colonnes, lignes, filtres }) {
  imprimerHtml(listeHtml({ titre, sousTitre, colonnes, lignes: lignes || [], filtres }));
}

/**
 * Imprime une fiche de détail (A4 portrait).
 * Sections : { titre, champs: [{label, valeur, large?}] } | { titre, colonnes, lignes, vide? } | { titre, texte }.
 * qr (facultatif) : SVG d'un QR code affiché dans l'en-tête (voir utils/qrCode.js).
 * Les champs et textes vides sont omis ; un tableau vide affiche son message `vide`.
 */
export function imprimerFiche({ titre, sousTitre, reference, statut, sections, signatures, qr }) {
  imprimerHtml(ficheHtml({ titre, sousTitre, reference, statut, sections, signatures, qr }));
}

// Exposés pour les tests de rendu
export { listeHtml as _listeHtml, ficheHtml as _ficheHtml };

export default imprimerListe;