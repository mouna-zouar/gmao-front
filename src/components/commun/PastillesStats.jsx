import { t } from '../../i18n';
import './commun.css';

/*
 * Statistiques d'en-tête en pastilles (chiffre + libellé), comme la liste des bons de maintenance.
 * Placées dans l'en-tête d'une page, elles occupent une ligne entière sous le titre.
 *
 *   <PastillesStats stats={[
 *     { label: 'Total', valeur: 12, actif: filtre === 'all', onClick: () => setFiltre('all') },
 *     { label: 'En panne', valeur: 3, ton: 'rouge', icone: CircleX, onClick: … },
 *     { label: 'Coût', valeur: '1 200 DT', couleur: '#7c3aed' },
 *   ]} />
 *
 * ton : teal (défaut), vert, rouge, orange, ambre, bleu, violet, gris — ou couleur : n'importe quelle couleur CSS.
 * Avec onClick, la pastille devient un bouton (filtre) ; actif la remplit de sa couleur.
 */
export const COULEURS_TONS = {
  teal: '#0794a4',
  vert: '#059669',
  rouge: '#dc2626',
  orange: '#ea580c',
  ambre: '#d97706',
  bleu: '#2563eb',
  violet: '#7c3aed',
  gris: '#64748b',
  neutre: '#64748b',
};

export default function PastillesStats({ stats = [], ariaLabel, className = '' }) {
  if (!stats.length) return null;
  return (
    <div className={`cl-pastilles ${className}`.trim()} role="group" aria-label={ariaLabel || t('Statistiques')}>
      {stats.map((s) => {
        const Icone = s.icone;
        const style = { '--stat-color': s.couleur || COULEURS_TONS[s.ton] || COULEURS_TONS.teal };
        const contenu = (
          <>
            {Icone && <Icone size={14} aria-hidden="true" />}
            <b>{s.valeur}</b>
            <small>{s.label}</small>
            {s.alerte && <span className="cl-pastille__point" aria-hidden="true" />}
          </>
        );
        return s.onClick ? (
          <button
            key={s.cle || s.label}
            type="button"
            className={`cl-pastille ${s.actif ? 'is-actif' : ''}`}
            style={style}
            onClick={s.onClick}
            aria-pressed={s.actif ? true : undefined}
            title={s.aide}
          >
            {contenu}
          </button>
        ) : (
          <span key={s.cle || s.label} className="cl-pastille" style={style} title={s.aide}>{contenu}</span>
        );
      })}
    </div>
  );
}
