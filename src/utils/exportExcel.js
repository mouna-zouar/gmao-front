const nomFeuille = (nom) => String(nom || 'Liste').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Liste';

export async function exporterExcel({ fichier, entetes, lignes, feuille }) {
  const XLSX = await import('xlsx');
  const donnees = [entetes, ...lignes].map((l) => l.map((x) => (x == null ? '' : x)));
  const f = XLSX.utils.aoa_to_sheet(donnees);
  f['!cols'] = entetes.map((_, i) => ({
    wch: Math.min(60, Math.max(10, ...donnees.map((l) => String(l[i] ?? '').length + 2))),
  }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, f, nomFeuille(feuille));
  XLSX.writeFile(classeur, `${fichier || 'liste'}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
