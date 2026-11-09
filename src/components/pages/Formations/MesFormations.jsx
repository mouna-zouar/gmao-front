import { GraduationCap } from 'lucide-react';
import { Badge } from '../../commun';
import { RESULTATS_FORMATION, STATUTS_FORMATION, TYPES_FORMATION, periodeFormation } from './formationLibelles';
import { t, locale } from '../../../i18n';
import './Formations.css';

/* « Mon espace » : formations du technicien connecté, avec son résultat. liste : [{ formation, resultat }] */
export default function MesFormations({ liste = [], chargement = false }) {
  if (chargement) return <div className="ep-empty"><span>{t('Chargement…')}</span></div>;
  if (!liste.length) {
    return <div className="ep-empty"><GraduationCap size={18} /><span>{t('Aucune formation enregistrée pour vous.')}</span></div>;
  }
  const badge = (dico, cle) => (dico[cle] ? <Badge ton={dico[cle].ton}>{t(dico[cle].label)}</Badge> : <span className="cl-tiret">—</span>);
  return (
    <div className="fo-mes">
      <table className="fo-mes-table">
        <thead>
          <tr>
            <th>{t('Formation')}</th><th>{t('Type')}</th><th>{t('Famille d’équipements')}</th><th>{t('Dates')}</th>
            <th>{t('Durée')}</th><th>{t('Statut')}</th><th>{t('Résultat')}</th>
          </tr>
        </thead>
        <tbody>
          {liste.map(({ formation: f, resultat }) => (
            <tr key={f.id}>
              <td><strong>{f.intitule}</strong>{f.organisme && <small>{f.organisme}</small>}</td>
              <td>{badge(TYPES_FORMATION, f.type)}</td>
              <td>{f.familleNom || t('Formation générale')}</td>
              <td>{periodeFormation(f) || '—'}</td>
              <td>{f.dureeHeures == null ? '—' : `${Number(f.dureeHeures).toLocaleString(locale(), { maximumFractionDigits: 1 })} h`}</td>
              <td>{badge(STATUTS_FORMATION, f.statut)}</td>
              <td>{badge(RESULTATS_FORMATION, resultat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
