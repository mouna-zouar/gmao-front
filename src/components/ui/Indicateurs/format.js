import { t, locale } from '../../../i18n';

/* ─── Formats ─── */
export const nf = (n, dec = 0) => Number(n).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });

export function formater(valeur, format = 'nombre') {
  if (valeur == null || Number.isNaN(valeur)) return '—';
  switch (format) {
    case 'pct': return t('{n} %', { n: nf(valeur, valeur < 10 ? 1 : 0) });
    case 'dt': return t('{montant} DT', { montant: nf(valeur, valeur >= 1000 ? 0 : 3) });
    case 'duree': {
      // valeur en heures
      if (valeur < 1) return t('{n} min', { n: nf(valeur * 60) });
      if (valeur < 48) return t('{n} h', { n: nf(valeur, valeur < 10 ? 1 : 0) });
      return t('{n} j', { n: nf(valeur / 24, 1) });
    }
    case 'jours': return t('{n} j', { n: nf(valeur, valeur < 10 ? 1 : 0) });
    case 'km': return t('{n} km', { n: nf(valeur) });
    case 'litres': return t('{n} L', { n: nf(valeur) });
    default: return nf(valeur, Number.isInteger(valeur) ? 0 : 1);
  }
}

const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
export function libelleMois(cle) {
  const [a, m] = cle.split('-').map(Number);
  if (locale() === 'fr-FR') return MOIS_FR[m - 1];
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(new Date(a, m - 1, 1)).replace('.', '');
}

