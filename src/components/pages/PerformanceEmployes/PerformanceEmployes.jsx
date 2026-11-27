import { useEffect, useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { Carte, Vide } from '../../commun/TableauBord';
import { formatTemps } from '../bonmaintenance/BmdCommun';
import { t, locale } from '../../../i18n';
import './PerformanceEmployes.css';
import { lireRequete } from '../../../store/referentiels';

const nb = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale()));
const duree = (s) => (s ? formatTemps(s) : '—');

const TRIS = [
  { cle: 'dureeInterventionsSecondes', label: 'Durée des interventions' },
  { cle: 'dureeTachesSecondes', label: 'Durée des tâches' },
  { cle: 'nbInterventions', label: 'Interventions réalisées' },
  { cle: 'nbTaches', label: 'Tâches réalisées' },
];
const NB_VISIBLES = 10;

const FILTRES_TACHES = [
  { cle: 'tous', label: 'Tous', garder: () => true },
  { cle: 'finies', label: 'Toutes ses tâches finies', garder: (e) => e.nbTachesAssociees > 0 && !e.nbTachesNonFinies },
  { cle: 'nonFinies', label: 'Tâches non finies', garder: (e) => e.nbTachesNonFinies > 0 },
];

const dureeCourte = (s) => {
  if (!s) return '—';
  if (s < 3600) return t('{n} min', { n: Math.max(1, Math.round(s / 60)) });
  const h = s / 3600;
  return h < 48 ? t('{n} h', { n: nb(Math.round(h * 10) / 10) }) : t('{n} j', { n: nb(Math.round((h / 24) * 10) / 10) });
};

const initiales = (nom) => String(nom || '?').trim().split(/\s+/).slice(0, 2).map((m) => m[0]?.toUpperCase() || '').join('') || '?';

function Anneau({ interventions, taches }) {
  const total = (interventions || 0) + (taches || 0);
  const r = 26;
  const c = 2 * Math.PI * r;
  const partI = total ? (interventions || 0) / total : 0;
  return (
    <svg className="pfe-anneau" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="pfe-anneau-fond" />
      {total > 0 && (
        <>
          <circle cx="32" cy="32" r={r} className="pfe-anneau-taches" strokeDasharray={`${c} ${c}`} />
          {partI > 0 && <circle cx="32" cy="32" r={r} className="pfe-anneau-interv" strokeDasharray={`${partI * c} ${c}`} />}
        </>
      )}
      <text x="32" y="36" textAnchor="middle" className="pfe-anneau-texte">{dureeCourte(total)}</text>
    </svg>
  );
}

function CarteEmploye({ e, rang }) {
  return (
    <li className="pfe-emp">
      <div className="pfe-emp-tete">
        <span className="pfe-avatar" aria-hidden="true">{initiales(e.nom)}</span>
        <span className="pfe-emp-nom" title={e.nom}>{e.nom}</span>
        {e.nbTachesNonFinies > 0
          ? <span className="pfe-etat pfe-etat--afinir" title={t('{n} tâche(s) à finir', { n: nb(e.nbTachesNonFinies) })}>{nb(e.nbTachesNonFinies)}</span>
          : e.nbTachesAssociees > 0 ? <span className="pfe-etat pfe-etat--ok" title={t('Toutes ses tâches finies')}>✓</span> : null}
        <span className="pfe-emp-rang">#{rang}</span>
      </div>
      <div className="pfe-emp-corps">
        <Anneau interventions={e.dureeInterventionsSecondes} taches={e.dureeTachesSecondes} />
        <dl className="pfe-emp-chiffres">
          {(e.nbInterventions > 0 || e.dureeInterventionsSecondes > 0) && (
            <div title={t('Moyenne {m}', { m: duree(e.dureeMoyenneInterventionSecondes) })}>
              <dt><i className="pfe-point pfe-point--interv" /><b>{nb(e.nbInterventions)}</b> {t('interv.')}</dt>
              <dd>{dureeCourte(e.dureeInterventionsSecondes)}</dd>
            </div>
          )}
          {(e.nbTaches > 0 || e.dureeTachesSecondes > 0) && (
            <div title={t('Moyenne {m}', { m: duree(e.dureeMoyenneTacheSecondes) })}>
              <dt><i className="pfe-point pfe-point--taches" /><b>{nb(e.nbTaches)}</b> {t('tâches')}</dt>
              <dd>{dureeCourte(e.dureeTachesSecondes)}</dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  );
}

export default function PerformanceEmployes({ jours, onOuvrirChrono }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [tri, setTri] = useState('dureeInterventionsSecondes');
  const [tout, setTout] = useState(false);
  const [filtreTaches, setFiltreTaches] = useState('tous');

  useEffect(() => {
    let annule = false;
    setErreur(null);
    lireRequete('performanceEmployes', { jours })
      .then((d) => { if (!annule) setDonnees(d); })
      .catch(() => { if (!annule) setErreur(t('La performance des employés n’a pas pu être chargée.')); });
    return () => { annule = true; };
  }, [jours]);

  const employes = useMemo(() => {
    const garder = FILTRES_TACHES.find((f) => f.cle === filtreTaches)?.garder ?? (() => true);
    const liste = (donnees?.employes ?? []).filter(garder);
    liste.sort((a, b) => (b[tri] ?? 0) - (a[tri] ?? 0) || b.dureeInterventionsSecondes - a.dureeInterventionsSecondes);
    return liste;
  }, [donnees, tri, filtreTaches]);
  const nbFiltre = (f) => (donnees?.employes ?? []).filter(f.garder).length;
  const visibles = tout ? employes : employes.slice(0, NB_VISIBLES);

  const avecEmployes = (donnees?.employes ?? []).length > 0;

  return (
    <Carte className="tb-carte--liste pfe-section" titre={t('Performance des employés')}
      pastille={donnees ? t('{n} employé(s)', { n: employes.length }) : null}>
      {erreur && <p className="tb-message tb-message--attention">{erreur}</p>}

      <div className="pfe-barre-outils">
        {avecEmployes && (
          <div className="pfe-filtres">
            <select value={filtreTaches} onChange={(e) => { setFiltreTaches(e.target.value); setTout(false); }} aria-label={t('Tâches')}>
              {FILTRES_TACHES.map((f) => <option key={f.cle} value={f.cle}>{t('Tâches')} : {t(f.label)} ({nbFiltre(f)})</option>)}
            </select>
            <select value={tri} onChange={(e) => setTri(e.target.value)} aria-label={t('Trier par')}>
              {TRIS.map((x) => <option key={x.cle} value={x.cle}>{t('Trier par')} : {t(x.label)}</option>)}
            </select>
          </div>
        )}
        {onOuvrirChrono && (
          <button type="button" className="pfe-lien pfe-lien--chrono" onClick={onOuvrirChrono}>
            <Radio size={14} aria-hidden="true" /> {t('Voir le chrono en direct')}
          </button>
        )}
      </div>


      {!donnees && !erreur ? <Vide>{t('Chargement…')}</Vide> : employes.length === 0 ? (
        <Vide>{filtreTaches === 'tous' ? t('Aucune intervention ni tâche réalisée sur la période.') : t('Aucun employé ne correspond à ce filtre.')}</Vide>
      ) : (
        <>
          <ul className="pfe-legende" aria-hidden="true">
            <li><i className="pfe-point pfe-point--interv" /> {t('Interventions')}</li>
            <li><i className="pfe-point pfe-point--taches" /> {t('Tâches')}</li>
          </ul>
          <ol className="pfe-emps" aria-label={t('Performance par employé')}>
            {visibles.map((e, i) => <CarteEmploye key={e.personnelId} e={e} rang={i + 1} />)}
          </ol>
          {employes.length > NB_VISIBLES && (
            <button type="button" className="pfe-lien pfe-voir-tout" onClick={() => setTout((v) => !v)}>
              {tout ? t('Afficher les {n} premiers', { n: NB_VISIBLES }) : t('Afficher les {n} employés', { n: employes.length })}
            </button>
          )}
        </>
      )}
    </Carte>
  );
}
