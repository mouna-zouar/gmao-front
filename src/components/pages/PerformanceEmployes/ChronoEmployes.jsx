import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, LoaderCircle, RefreshCw, Search, Timer, Users, Wrench } from 'lucide-react';
import performanceEmployesService from '../../../services/performanceEmployesService';
import { PastillesStats } from '../../commun';
import { formatTemps, useMaintenant } from '../bonmaintenance/BmdCommun';
import { t, locale } from '../../../i18n';
import './PerformanceEmployes.css';

/*
 * Chrono des employés : qui travaille en ce moment, sur quel bon, et depuis combien de temps.
 * Les temps tournent à l'écran ; la liste est rechargée depuis le serveur toutes les minutes.
 */

const RAFRAICHIR_MS = 60 * 1000;

const ms = (d) => (d ? new Date(d).getTime() : null);
const enPlus = (depuis, maintenant) => (depuis ? Math.max(0, (maintenant - ms(depuis)) / 1000) : 0);
const heure = (d) => (d ? new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '');
const initiales = (nom) => (nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

export default function ChronoEmployes({ onOuvrirBon }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('tous'); // tous | enCours | enPause
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setDonnees(await performanceEmployesService.chrono());
      setErreur(null);
    } catch {
      setErreur(t('Impossible de charger le chrono des employés. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, RAFRAICHIR_MS);
    return () => clearInterval(id);
  }, [charger]);

  const employes = useMemo(() => donnees?.employes ?? [], [donnees]);
  const maintenant = useMaintenant(employes.some((e) => e.enCours));

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return employes.filter((e) => {
      if (filtre === 'enCours' && !e.enCours) return false;
      if (filtre === 'enPause' && e.enCours) return false;
      if (!q) return true;
      return [e.nom, ...e.elements.flatMap((x) => [x.bonNum, x.bonTitre, x.equipement, x.libelle])]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [employes, filtre, recherche]);

  const basculer = (cle) => setFiltre((f) => (f === cle ? 'tous' : cle));
  const stats = [
    { cle: 'tous', label: t('Employés'), valeur: employes.length, ton: 'teal', icone: Users, actif: filtre === 'tous', onClick: () => setFiltre('tous') },
    { cle: 'enCours', label: t('Travaillent maintenant'), valeur: donnees?.enCours ?? 0, ton: 'vert', icone: Timer, actif: filtre === 'enCours', onClick: () => basculer('enCours') },
    { cle: 'enPause', label: t('En pause'), valeur: donnees?.enPause ?? 0, ton: 'gris', actif: filtre === 'enPause', onClick: () => basculer('enPause') },
  ];

  return (
    <div className="pfe-chrono">
      <div className="pfe-barre">
        <PastillesStats stats={stats} ariaLabel={t('Résumé du chrono')} />
        <div className="pfe-barre-droite">
          <label className="pfe-recherche">
            <Search size={15} aria-hidden="true" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder={t('Employé, bon, équipement…')} aria-label={t('Rechercher')} />
          </label>
          <button type="button" className="pfe-btn" onClick={charger} disabled={chargement}>
            {chargement ? <LoaderCircle size={15} className="pfe-tourne" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
            {t('Actualiser')}
          </button>
        </div>
      </div>

      {erreur && <p className="pfe-message">{erreur}</p>}
      {!donnees && chargement && <p className="pfe-vide"><LoaderCircle size={18} className="pfe-tourne" /> {t('Chargement…')}</p>}
      {donnees && visibles.length === 0 && (
        <p className="pfe-vide">
          <Timer size={22} />
          {employes.length === 0 ? t('Aucun employé n’a d’intervention ouverte pour le moment.') : t('Aucun employé ne correspond.')}
        </p>
      )}

      <div className="pfe-grille">
        {visibles.map((e) => {
          const total = e.elements
            .filter((x) => x.type === 'INTERVENTION')
            .reduce((s, x) => s + x.tempsPasseSecondes + enPlus(x.enCoursDepuis, maintenant), 0);
          return (
            <article key={e.personnelId} className={`pfe-carte ${e.enCours ? 'is-en-cours' : ''}`}>
              <header className="pfe-carte-tete">
                <span className="pfe-avatar" aria-hidden="true">{initiales(e.nom)}</span>
                <div className="pfe-carte-nom">
                  <strong>{e.nom}</strong>
                  <span className={`pfe-statut ${e.enCours ? 'is-en-cours' : ''}`}>
                    <span className="pfe-point" aria-hidden="true" />
                    {e.enCours ? t('Travaille depuis {h}', { h: heure(e.enCoursDepuis) }) : t('En pause')}
                  </span>
                </div>
                <div className="pfe-carte-temps" title={t('Temps cumulé sur ses interventions ouvertes')}>
                  <Timer size={15} aria-hidden="true" />
                  <strong>{formatTemps(total)}</strong>
                  <small>{t('{n} ouverte(s)', { n: e.nbOuverts })}</small>
                </div>
              </header>
              <ul className="pfe-elements">
                {e.elements.map((x) => {
                  const s = x.tempsPasseSecondes + enPlus(x.enCoursDepuis, maintenant);
                  const Icone = x.type === 'TACHE' ? ClipboardList : Wrench;
                  return (
                    <li key={`${x.type}-${x.id}`} className={x.enCoursDepuis ? 'is-en-cours' : ''}>
                      <Icone size={14} className="pfe-elements-icone" aria-hidden="true" />
                      <button type="button" className="pfe-elements-texte" onClick={() => onOuvrirBon?.(x.bonId)} disabled={!onOuvrirBon || !x.bonId}
                        title={onOuvrirBon ? t('Ouvrir le bon') : undefined}>
                        <span className="pfe-elements-titre">
                          {x.type === 'TACHE' ? (x.libelle || t('Tâche')) : (x.bonTitre || t('Intervention'))}
                        </span>
                        <span className="pfe-elements-sous">
                          {[x.bonNum || (x.bonId ? `#${x.bonId}` : null), x.equipement].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                      <span className="pfe-elements-temps">
                        {x.enCoursDepuis && <span className="pfe-point" aria-hidden="true" />}
                        {formatTemps(s)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
