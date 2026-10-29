import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Timer, Users, Wrench } from 'lucide-react';
import performanceEmployesService from '../../../services/performanceEmployesService';
import { Carte, Stat, Vide } from '../../commun/TableauBord';
import { formatTemps } from '../bonmaintenance/BmdCommun';
import { t, locale } from '../../../i18n';
import './PerformanceEmployes.css';

/*
 * Section « Performance des employés » du tableau de bord GMAO.
 * Uniquement le travail réalisé sur la période choisie en haut de la page :
 * la durée des interventions terminées et celle des tâches effectuées, par employé.
 */

const nb = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale()));
const duree = (s) => (s ? formatTemps(s) : '—');

const TRIS = [
  { cle: 'dureeInterventionsSecondes', label: 'Durée des interventions' },
  { cle: 'dureeTachesSecondes', label: 'Durée des tâches' },
  { cle: 'nbInterventions', label: 'Interventions réalisées' },
  { cle: 'nbTaches', label: 'Tâches réalisées' },
];
const NB_VISIBLES = 10;

function BarreDuree({ secondes, max, ton }) {
  return (
    <span className="pfe-temps-barre">
      <span className="pfe-temps-piste"><span className={`pfe-piste--${ton}`} style={{ width: `${max ? (100 * secondes) / max : 0}%` }} /></span>
      <b>{duree(secondes)}</b>
    </span>
  );
}

export default function PerformanceEmployes({ jours, onOuvrirChrono }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [tri, setTri] = useState('dureeInterventionsSecondes');
  const [tout, setTout] = useState(false);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    performanceEmployesService.performance(jours)
      .then((d) => { if (!annule) setDonnees(d); })
      .catch(() => { if (!annule) setErreur(t('La performance des employés n’a pas pu être chargée.')); });
    return () => { annule = true; };
  }, [jours]);

  const employes = useMemo(() => {
    const liste = [...(donnees?.employes ?? [])];
    liste.sort((a, b) => (b[tri] ?? 0) - (a[tri] ?? 0) || b.dureeInterventionsSecondes - a.dureeInterventionsSecondes);
    return liste;
  }, [donnees, tri]);
  const tot = donnees?.totaux;
  const maxInterv = Math.max(0, ...employes.map((e) => e.dureeInterventionsSecondes));
  const maxTaches = Math.max(0, ...employes.map((e) => e.dureeTachesSecondes));
  const visibles = tout ? employes : employes.slice(0, NB_VISIBLES);

  return (
    <>
      <h2 className="tb-section-titre">
        {t('Performance des employés')}
        <small>{t('Durée réalisée par chaque employé sur la période : interventions terminées et tâches effectuées')}</small>
      </h2>

      {erreur && <p className="tb-message tb-message--attention">{erreur}</p>}

      <div className="tb-stats">
        <Stat icone={Users} ton="teal" valeur={nb(tot?.employes)} label={t('Employés ayant réalisé du travail')}
          sous={onOuvrirChrono ? <button type="button" className="pfe-lien" onClick={onOuvrirChrono}>{t('Voir le chrono en direct')}</button> : null} />
        <Stat icone={Wrench} ton="teal" valeur={nb(tot?.interventions)} label={t('Interventions réalisées')} />
        <Stat icone={Timer} ton="teal" valeur={duree(tot?.dureeInterventionsSecondes)} label={t('Durée des interventions')}
          sous={tot?.interventions ? t('{d} par intervention en moyenne', { d: duree(tot.dureeInterventionsSecondes / tot.interventions) }) : null} />
        <Stat icone={ClipboardCheck} ton="violet" valeur={nb(tot?.taches)} label={t('Tâches réalisées')} />
        <Stat icone={Timer} ton="violet" valeur={duree(tot?.dureeTachesSecondes)} label={t('Durée des tâches')}
          sous={tot?.taches ? t('{d} par tâche en moyenne', { d: duree(tot.dureeTachesSecondes / tot.taches) }) : null} />
        <Stat icone={Users} ton="neutre" valeur={tot?.employes ? duree(tot.dureeInterventionsSecondes / tot.employes) : '—'}
          label={t('Durée réalisée par employé')} sous={t('interventions, en moyenne')} />
      </div>

      <Carte className="tb-carte--liste pfe-carte-tableau" titre={t('Classement des employés')}
        pastille={donnees ? t('{n} employé(s)', { n: employes.length }) : null}>
        {!donnees && !erreur ? <Vide>{t('Chargement…')}</Vide> : employes.length === 0 ? (
          <Vide>{t('Aucune intervention ni tâche réalisée sur la période.')}</Vide>
        ) : (
          <>
            <div className="pfe-tri" role="group" aria-label={t('Trier par')}>
              <span>{t('Trier par')}</span>
              {TRIS.map((x) => (
                <button key={x.cle} type="button" aria-pressed={tri === x.cle} onClick={() => setTri(x.cle)}>{t(x.label)}</button>
              ))}
            </div>
            <div className="pfe-tableau-cadre">
              <table className="tb-table pfe-tableau">
                <thead>
                  <tr>
                    <th rowSpan={2}>#</th>
                    <th rowSpan={2}>{t('Employé')}</th>
                    <th colSpan={3} className="pfe-groupe pfe-groupe--teal">{t('Interventions réalisées')}</th>
                    <th colSpan={3} className="pfe-groupe pfe-groupe--violet">{t('Tâches réalisées')}</th>
                  </tr>
                  <tr>
                    <th className="tb-num">{t('Nombre')}</th>
                    <th>{t('Durée')}</th>
                    <th className="tb-num">{t('Moyenne')}</th>
                    <th className="tb-num">{t('Nombre')}</th>
                    <th>{t('Durée')}</th>
                    <th className="tb-num">{t('Moyenne')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e, i) => (
                    <tr key={e.personnelId}>
                      <td className="pfe-rang">{i + 1}</td>
                      <td><strong className="pfe-nom">{e.nom}</strong></td>
                      <td className="tb-num">{nb(e.nbInterventions)}</td>
                      <td><BarreDuree secondes={e.dureeInterventionsSecondes} max={maxInterv} ton="teal" /></td>
                      <td className="tb-num">{duree(e.dureeMoyenneInterventionSecondes)}</td>
                      <td className="tb-num">{nb(e.nbTaches)}</td>
                      <td><BarreDuree secondes={e.dureeTachesSecondes} max={maxTaches} ton="violet" /></td>
                      <td className="tb-num">{duree(e.dureeMoyenneTacheSecondes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {employes.length > NB_VISIBLES && (
              <button type="button" className="pfe-lien pfe-voir-tout" onClick={() => setTout((v) => !v)}>
                {tout ? t('Afficher les {n} premiers', { n: NB_VISIBLES }) : t('Afficher les {n} employés', { n: employes.length })}
              </button>
            )}
            <p className="tb-note">{t('Seul le travail réalisé compte : interventions terminées et tâches effectuées pendant la période. La durée vient du chronomètre ; pour les plus anciennes, elle est calculée à partir des dates de début et de fin.')}</p>
          </>
        )}
      </Carte>
    </>
  );
}
