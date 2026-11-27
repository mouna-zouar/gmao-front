import { tPdf, localePdf } from '../../../i18n';

const ETAT_LABELS = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  HORS_SERVICE: 'Hors service',
};

function formatDateTime(iso, loc = localePdf()) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

export async function exporterHistoriquePDF(equipement, historique) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  const titre = `${tPdf("Historique d'état")} — ${equipement.cibleNom || tPdf('Équipement #{id}', { id: equipement.lotArticleImmobilistationId })}`;
  doc.text(titre, marginX, y, { maxWidth: pageWidth - marginX * 2 });
  y += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(tPdf('État actuel : {etat}', { etat: ETAT_LABELS[equipement.etatActuel] ? tPdf(ETAT_LABELS[equipement.etatActuel]) : equipement.etatActuel }), marginX, y);
  y += 5;
  if (equipement.depuisLe) {
    doc.text(tPdf('Depuis le {date}', { date: formatDateTime(equipement.depuisLe, localePdf()) }), marginX, y);
    y += 5;
  }
  doc.setTextColor(120);
  doc.text(
    tPdf('Document généré le {date} à {heure}', { date: new Date().toLocaleDateString(localePdf()), heure: new Date().toLocaleTimeString(localePdf(), { hour: '2-digit', minute: '2-digit' }) }),
    marginX, y
  );
  doc.setTextColor(0);
  y += 8;

  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(tPdf('Date'), marginX, y);
  doc.text(tPdf('Transition'), marginX + 32, y);
  doc.text(tPdf('Bon'), marginX + 120, y);
  y += 3;
  doc.setDrawColor(230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);

  if (historique.length === 0) {
    doc.setTextColor(140);
    doc.text(tPdf('Aucune transition enregistrée.'), marginX, y);
    doc.setTextColor(0);
  }

  historique.forEach((tache) => {
    if (y > 280) { doc.addPage(); y = 20; }
    const dateStr = formatDateTime(tache.dateTransition, localePdf());
    const libellePdf = (e) => (ETAT_LABELS[e] ? tPdf(ETAT_LABELS[e]) : e);
    const transitionStr = `${tache.etatPrecedent ? `${libellePdf(tache.etatPrecedent)} → ` : tPdf('Première détection : ')}${libellePdf(tache.etatNouveau)}`;

    doc.text(dateStr, marginX, y);
    doc.text(transitionStr, marginX + 32, y, { maxWidth: 82 });
    doc.text(tache.bonMaintenanceNum || '—', marginX + 120, y);
    if (tache.motif) {
      y += 4.5;
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text(tache.motif, marginX + 32, y, { maxWidth: 130 });
      doc.setFontSize(9);
      doc.setTextColor(0);
    }
    y += 7;
  });

  const nomFichier = `historique-etat-${(equipement.cibleNom || 'equipement').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  doc.save(nomFichier);
}
