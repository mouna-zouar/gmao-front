import { t } from '../../i18n';

const LARGEURS = ['72%', '48%', '86%', '60%', '40%', '78%', '55%'];

export default function LignesChargement({ colonnes = 5, lignes = 6, premiereCase = false }) {
  return (
    <>
      {Array.from({ length: lignes }, (_, i) => (
        <tr key={i} className="g-ligne-chargement" aria-hidden={i > 0 ? 'true' : undefined}>
          {Array.from({ length: Math.max(1, colonnes) }, (_, j) => (
            <td key={j}>
              {i === 0 && j === 0 && <span className="g-lecteur-ecran">{t('Chargement…')}</span>}
              <span className={`g-squelette ${premiereCase && j === 0 ? 'g-squelette--case' : ''}`}
                style={premiereCase && j === 0 ? undefined : { width: LARGEURS[(i + j) % LARGEURS.length] }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
