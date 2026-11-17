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

export default function EtatLecture({ objet, compact = false, actif = true, responsable = '' }) {
  if (!objet) return null;
  const i = infoLecture(objet);
  const quand = i.date ? new Date(i.date).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  // Durée inconnue (date d'affectation absente) : on n'affiche pas « attend depuis » vide
  const duree = i.secondes != null ? dureeLecture(i.secondes) : '';
  const titre = i.lu
    ? (duree ? t('Lu par {qui} le {quand}, {duree} après l’affectation', { qui: i.par || '—', quand, duree }) : t('Lu par {qui} le {quand}', { qui: i.par || '—', quand }))
    : responsable
      ? (actif && duree ? t('Pas encore lu par {qui} : attend depuis {duree}', { qui: responsable, duree }) : t('Pas encore lu par {qui}', { qui: responsable }))
      : (actif && duree ? t('Pas encore lu par le responsable : attend depuis {duree}', { duree }) : t('Pas encore lu par le responsable'));
  const Icone = i.lu ? Eye : EyeOff;
  if (compact) {
    return (
      <span className={`etat-lecture etat-lecture--compact ${i.lu ? 'is-lu' : 'is-non-lu'}`} title={titre} aria-label={titre} tabIndex={0}>
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

/**
 * Résumé de lecture d'une liste : « 12 lus · 3 non lus », les personnes en info-bulle.
 *   elements   : réclamations ou bons ({ dateLecture, luParNom, dateAttenteLecture, … })
 *   reference  : (e) => n° affiché (REC-…, BM-…)
 *   responsable: (e) => à qui il est affecté (facultatif), pour les non lus
 *   estActif   : (e) => true si l'élément est encore à traiter (un élément clos non lu ne compte pas)
 */
export function ResumeLecture({ elements = [], reference = (e) => e.num || `#${e.id}`, responsable, estActif = () => true }) {
  const lus = elements.filter((e) => e.dateLecture);
  const nonLus = elements.filter((e) => !e.dateLecture && estActif(e));
  if (lus.length === 0 && nonLus.length === 0) return null;

  // Qui a lu : « Ali Ben Salah (5) »
  const parPersonne = new Map();
  lus.forEach((e) => {
    const qui = e.luParNom || t('Inconnu');
    parPersonne.set(qui, (parPersonne.get(qui) || 0) + 1);
  });
  const lignesLus = [...parPersonne.entries()].sort((a, b) => b[1] - a[1]).map(([qui, n]) => `• ${qui} (${n})`);

  // Non lus, du plus ancien au plus récent : « REC-0012 — Ali · attend depuis 2 h »
  const maintenant = Date.now();
  const lignesNonLus = nonLus
    .map((e) => ({ e, i: infoLecture(e, maintenant) }))
    .sort((a, b) => (b.i.secondes ?? 0) - (a.i.secondes ?? 0))
    .map(({ e, i }) => {
      const qui = responsable ? responsable(e) : '';
      const attente = i.secondes != null ? t('attend depuis {duree}', { duree: dureeLecture(i.secondes) }) : '';
      return `• ${reference(e)}${qui ? ` — ${qui}` : ''}${attente ? ` · ${attente}` : ''}`;
    });
  const MAX = 15;
  const couper = (l) => (l.length > MAX ? [...l.slice(0, MAX), t('… et {n} autre(s)', { n: l.length - MAX })] : l);

  const bulle = [
    lus.length ? `${t('Lu par')} :\n${couper(lignesLus).join('\n')}` : t('Aucun élément lu.'),
    nonLus.length ? `${t('Pas encore lus')} :\n${couper(lignesNonLus).join('\n')}` : t('Tout est lu.'),
  ].join('\n\n');

  return (
    <span className="resume-lecture" title={bulle} tabIndex={0} aria-label={bulle}>
      <span className="resume-lecture__lus"><Eye size={14} aria-hidden="true" /> {t('{n} lus', { n: lus.length })}</span>
      <span className="resume-lecture__sep" aria-hidden="true">·</span>
      <span className={`resume-lecture__nonlus ${nonLus.length ? 'is-alerte' : ''}`}>
        <EyeOff size={14} aria-hidden="true" /> {t('{n} non lus', { n: nonLus.length })}
      </span>
    </span>
  );
}

