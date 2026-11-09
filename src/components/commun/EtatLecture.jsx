import { Eye, EyeOff } from 'lucide-react';
import { t, locale } from '../../i18n';
import './EtatLecture.css';

/*
 * « Lu / Non lu » d'une réclamation ou d'un bon, avec le temps mis pour le lire
 * (ou depuis combien de temps il attend). objet : { dateAttenteLecture, dateLecture, luParNom }.
 * compact : pastille courte pour les listes.
 */

/** 45 s · 12 min · 2 h 15 · 3 j 4 h */
export function dureeLecture(secondes) {
  if (secondes == null || Number.isNaN(secondes)) return '';
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return t('{n} s', { n: s });
  const min = Math.floor(s / 60);
  if (min < 60) return t('{n} min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${h} h`;
  return h % 24 ? t('{j} j {h} h', { j: Math.floor(h / 24), h: h % 24 }) : t('{j} j', { j: Math.floor(h / 24) });
}

const ms = (d) => (d ? new Date(d).getTime() : null);

export function infoLecture(objet, maintenant = Date.now()) {
  const debut = ms(objet?.dateAttenteLecture);
  const lu = ms(objet?.dateLecture);
  if (lu) return { lu: true, secondes: debut ? (lu - debut) / 1000 : null, par: objet.luParNom || null, date: objet.dateLecture };
  return { lu: false, secondes: debut ? (maintenant - debut) / 1000 : null };
}

export default function EtatLecture({ objet, compact = false, actif = true }) {
  if (!objet) return null;
  const i = infoLecture(objet);
  const quand = i.date ? new Date(i.date).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  // Durée inconnue (date d'affectation absente) : on n'affiche pas « attend depuis » vide
  const duree = i.secondes != null ? dureeLecture(i.secondes) : '';
  const titre = i.lu
    ? (duree ? t('Lu par {qui} le {quand}, {duree} après l’affectation', { qui: i.par || '—', quand, duree }) : t('Lu par {qui} le {quand}', { qui: i.par || '—', quand }))
    : (actif && duree ? t('Pas encore lu par le responsable : attend depuis {duree}', { duree }) : t('Pas encore lu par le responsable'));
  const Icone = i.lu ? Eye : EyeOff;
  if (compact) {
    return (
      <span className={`etat-lecture etat-lecture--compact ${i.lu ? 'is-lu' : 'is-non-lu'}`} title={titre}>
        <Icone size={13} aria-hidden="true" />
        {i.lu ? t('Lu') : t('Non lu')}
        {duree && (i.lu || actif) && <small>{duree}</small>}
      </span>
    );
  }
  return (
    <span className={`etat-lecture ${i.lu ? 'is-lu' : 'is-non-lu'}`} title={titre}>
      <Icone size={14} aria-hidden="true" />
      {i.lu
        ? (duree ? t('Lu par {qui}, {duree} après l’affectation', { qui: i.par || '—', duree }) : t('Lu par {qui}', { qui: i.par || '—' }))
        : (actif && duree ? t('Non lu · attend depuis {duree}', { duree }) : t('Non lu'))}
    </span>
  );
}
