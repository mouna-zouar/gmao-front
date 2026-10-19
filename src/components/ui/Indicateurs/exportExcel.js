import { t, locale } from '../../../i18n';
import { formater, libelleMois, nf } from './format';

/*
 * Export Excel des indicateurs d'un tableau de bord.
 *   donnees = {
 *     fichier: 'indicateurs-bons',            // nom du fichier (sans extension)
 *     titre: 'Indicateurs — Bons',            // 1re ligne de la feuille « Indicateurs »
 *     periode: '30 derniers jours…',
 *     tuiles: [{ libelle, valeur, precedent, format, detail }],
 *     courbes: [{ titre, mois: ['2026-01', …], series: [{ nom, valeurs }] }],
 *     classements: [{ titre, lignes: [{ libelle, valeur }], format }],
 *   }
 * Les valeurs nulles ou à zéro sont ignorées, comme à l'écran.
 */

const nomFeuille = (titre, pris) => {
  let base = String(titre).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Feuille';
  let nom = base;
  let i = 2;
  while (pris.has(nom)) { nom = `${base.slice(0, 25)} ${i}`; i += 1; }
  pris.add(nom);
  return nom;
};

const evolution = (v, p) => (p ? Math.round(((v - p) / Math.abs(p)) * 1000) / 10 : null);
const arrondi = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
// Unité de la colonne « Valeur » (les durées sont exportées en heures)
const UNITES = { duree: 'heures', pct: '%', dt: 'DT', km: 'km', litres: 'L', jours: 'jours' };

export async function exporterIndicateursExcel(donnees) {
  const XLSX = await import('xlsx');
  const classeur = XLSX.utils.book_new();
  const pris = new Set();
  const date = new Date();

  // Feuille 1 : les indicateurs
  const lignes = [
    [donnees.titre || t('Indicateurs')],
    [donnees.periode || ''],
    [t('Exporté le {date}', { date: date.toLocaleString(locale()) })],
    [],
    [t('Indicateur'), t('Valeur'), t('Unité'), t('Valeur affichée'), t('Période précédente'), t('Évolution'), t('Détail')],
  ];
  (donnees.tuiles || [])
    .filter((x) => x.valeur != null && Number(x.valeur) !== 0)
    .forEach((x) => {
      let evo = '';
      if (x.precedent != null) {
        // Taux : écart en points ; autres valeurs : évolution en %
        evo = x.format === 'pct'
          ? t('{n} pts', { n: `${x.valeur >= x.precedent ? '+' : ''}${nf(x.valeur - x.precedent, 1)}` })
          : (evolution(x.valeur, x.precedent) != null ? t('{n} %', { n: `${x.valeur >= x.precedent ? '+' : ''}${nf(evolution(x.valeur, x.precedent), 1)}` }) : '');
      }
      lignes.push([
        x.libelle,
        arrondi(x.valeur),
        t(UNITES[x.format] || ''),
        formater(x.valeur, x.format),
        x.precedent != null ? arrondi(x.precedent) : '',
        evo,
        x.detail || '',
      ]);
    });
  const f1 = XLSX.utils.aoa_to_sheet(lignes);
  f1['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 9 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(classeur, f1, nomFeuille(t('Indicateurs'), pris));

  // Une feuille par courbe (12 mois)
  (donnees.courbes || []).forEach((c) => {
    if (c.series.every((s) => s.valeurs.every((v) => !v))) return;
    const aoa = [[t('Mois'), ...c.series.map((s) => s.nom)]];
    c.mois.forEach((m, i) => aoa.push([`${libelleMois(m)} ${m.slice(0, 4)}`, ...c.series.map((s) => Math.round((s.valeurs[i] || 0) * 1000) / 1000)]));
    const f = XLSX.utils.aoa_to_sheet(aoa);
    f['!cols'] = [{ wch: 14 }, ...c.series.map(() => ({ wch: 16 }))];
    XLSX.utils.book_append_sheet(classeur, f, nomFeuille(c.titre, pris));
  });

  // Une feuille par classement
  (donnees.classements || []).forEach((c) => {
    const utiles = c.lignes.filter((l) => Number(l.valeur) > 0);
    if (!utiles.length) return;
    const aoa = [[t('Rang'), t('Libellé'), t('Valeur')]];
    utiles.forEach((l, i) => aoa.push([i + 1, l.libelle, Math.round(l.valeur * 1000) / 1000]));
    const f = XLSX.utils.aoa_to_sheet(aoa);
    f['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(classeur, f, nomFeuille(c.titre, pris));
  });

  const jour = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(classeur, `${donnees.fichier || 'indicateurs'}-${jour}.xlsx`);
}
