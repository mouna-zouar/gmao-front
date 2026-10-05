import jsPDF from 'jspdf';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Imprime (télécharge en PDF) un document d'achat lié à un bon de maintenance : une
 * "Demande de fourniture" (stock interne) ou une "Commande fournisseur" (sous-traitant),
 * avec toutes ses lignes (articles, quantités).
 *
 * @param documentAchat  BonMaintenanceDocumentAchatDTO — doit contenir .piece et .lignes
 * @param options.bon           BonMaintenanceDTO du bon lié (pour l'en-tête)
 * @param options.articles      liste des articles (pour résoudre les désignations)
 * @param options.prestataires  liste des prestataires (pour résoudre le nom du fournisseur)
 */
export function imprimerDocumentAchat(documentAchat, { bon, articles = [], prestataires = [] } = {}) {
  const piece = documentAchat.piece || {};
  const lignes = documentAchat.lignes || [];
  const estCommande = piece.codePieceType === '.COMMANDE_FOURNISSEUR';
  const typeLabel = estCommande ? 'Commande fournisseur' : 'Demande de fourniture';

  const fournisseur = estCommande && piece.cibleId != null
    ? (prestataires.find((p) => String(p.id) === String(piece.cibleId))?.raisonSociale || `Fournisseur #${piece.cibleId}`)
    : null;

  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  const sautDePageSiBesoin = (h = 10) => {
    if (y + h > pageHeight - 14) {
      doc.addPage();
      y = 20;
    }
  };

  // ─── En-tête ───
  doc.setFontSize(17);
  doc.setFont(undefined, 'bold');
  doc.text(typeLabel, marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(90);
  doc.text(`N° ${piece.numPiece || `#${piece.id}`}`, marginX, y);
  y += 6;
  if (bon) {
    doc.text(`Bon de maintenance : ${bon.num || `#${bon.id}`}${bon.titre ? ` — ${bon.titre}` : ''}`, marginX, y);
    y += 6;
  }
  if (fournisseur) {
    doc.text(`Fournisseur : ${fournisseur}`, marginX, y);
    y += 6;
  }
  doc.text(`Date : ${formatDateTime(piece.dateCreation || piece.date)}`, marginX, y);
  y += 6;
  doc.setTextColor(140);
  doc.setFontSize(8.5);
  doc.text(`Document généré le ${formatDateTime(new Date().toISOString())}`, marginX, y);
  doc.setTextColor(0);
  y += 10;

  // ─── Tableau des lignes ───
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  doc.setFontSize(9.5);
  doc.setFont(undefined, 'bold');
  doc.text('Article', marginX, y);
  doc.text('Quantité', pageWidth - marginX - 55, y);
  doc.text('Prix unitaire', pageWidth - marginX - 25, y);
  y += 3;
  doc.setDrawColor(230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);

  if (lignes.length === 0) {
    doc.setTextColor(150);
    doc.text('Aucune ligne sur ce document.', marginX, y);
    doc.setTextColor(0);
    y += 7;
  }

  lignes.forEach((l) => {
    sautDePageSiBesoin(7);
    const article = articles.find((a) => String(a.id) === String(l.prestataireArticlesId));
    const designation = article?.designation || `Article #${l.prestataireArticlesId}`;
    doc.text(designation, marginX, y, { maxWidth: pageWidth - marginX * 2 - 65 });
    doc.text(l.qte != null ? String(l.qte) : '—', pageWidth - marginX - 55, y);
    doc.text(l.prixUnitaire != null ? `${l.prixUnitaire} DT` : '—', pageWidth - marginX - 25, y);
    y += 7;
  });

  y += 3;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  if (piece.description) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text('Description :', marginX, y);
    y += 5;
    doc.setTextColor(0);
    const desc = doc.splitTextToSize(piece.description, pageWidth - marginX * 2);
    desc.forEach((l) => { sautDePageSiBesoin(5); doc.text(l, marginX, y); y += 4.5; });
  }

  const prefixe = estCommande ? 'commande' : 'demande';
  const nomFichier = `${prefixe}-${(piece.numPiece || piece.id || 'document').toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  doc.save(nomFichier);
}