import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import ListeRecherche from '../../commun/ListeRecherche';
import equipementService from '../../../services/equipementService';
import { t } from '../../../i18n';

const nomEquipement = (e) => e.designation || e.libelle || e.code || `#${e.id}`;

/*
 * Choix de plusieurs équipements à la fois : recherche + famille, liste à cocher,
 * « Tout cocher » pour prendre d'un coup tous les équipements affichés.
 */
function ChoixEquipements({ id, deja, basculer, ajouterTous }) {
  const [texte, setTexte] = useState('');
  const [famille, setFamille] = useState('');
  const [familles, setFamilles] = useState([]);
  const [resultats, setResultats] = useState(null);

  useEffect(() => {
    equipementService.familles().then(setFamilles).catch((e) => console.error('[GMAO formations] Familles :', e));
  }, []);

  useEffect(() => {
    let annule = false;
    setResultats(null);
    const minuterie = setTimeout(() => {
      equipementService.rechercher(texte.trim(), 0, 60, famille || null)
        .then((page) => { if (!annule) setResultats(page?.content ?? []); })
        .catch((e) => { console.error('[GMAO formations] Équipements :', e); if (!annule) setResultats([]); });
    }, texte ? 280 : 0);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [texte, famille]);

  const nonCoches = (resultats ?? []).filter((e) => !deja.has(String(e.id)));
  return (
    <div className="fo-multi">
      <div className="fo-multi__filtres">
        <label className="fo-multi__recherche">
          <Search size={15} aria-hidden="true" />
          <input id={id} type="search" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('Rechercher un équipement…')} />
        </label>
        <select value={famille} onChange={(e) => setFamille(e.target.value)} aria-label={t('Famille')}>
          <option value="">{t('Toutes les familles')}</option>
          {familles.map((f) => <option key={f.id} value={f.id}>{f.nom || `#${f.id}`}</option>)}
        </select>
        <button type="button" className="cm-btn" disabled={!nonCoches.length} onClick={() => ajouterTous(nonCoches)}>
          {t('Tout cocher')}{nonCoches.length ? ` (${nonCoches.length})` : ''}
        </button>
      </div>
      <ul className="fo-multi__liste" role="listbox" aria-multiselectable="true" aria-label={t('Équipements')}>
        {resultats == null && <li className="fo-multi__vide"><Loader2 size={14} className="cf-tourne" /> {t('Chargement…')}</li>}
        {resultats?.length === 0 && <li className="fo-multi__vide">{t('Aucun équipement ne correspond')}</li>}
        {(resultats ?? []).map((e) => {
          const coche = deja.has(String(e.id));
          return (
            <li key={e.id} role="option" aria-selected={coche}>
              <label className={coche ? 'est-coche' : ''}>
                <input type="checkbox" checked={coche} onChange={() => basculer({ id: e.id, nom: nomEquipement(e) })} />
                <span className="fo-multi__nom">{nomEquipement(e)}</span>
                <span className="fo-multi__info">{[e.familleNom, e.marque, `#${e.id}`].filter(Boolean).join(' · ')}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/*
 * Choix multiple d'une formation : familles d'équipements ou équipements visés.
 * valeur : [{ id, nom }]. mode 'famille' (liste chargée par chargerOptions) ou 'equipement' (recherche dans le parc).
 */
export default function ChampCibles({ id, valeur, changer, mode = 'famille', chargerOptions }) {
  const liste = Array.isArray(valeur) ? valeur : [];
  const [options, setOptions] = useState([]);
  const [chargement, setChargement] = useState(mode === 'famille');

  useEffect(() => {
    if (mode !== 'famille' || !chargerOptions) return;
    Promise.resolve(chargerOptions())
      .then((l) => setOptions(l ?? []))
      .catch((e) => console.error('[GMAO formations] Familles :', e))
      .finally(() => setChargement(false));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const deja = useMemo(() => new Set(liste.map((c) => String(c.id))), [liste]);
  const ajouter = (cible) => {
    if (!cible || cible.id == null || deja.has(String(cible.id))) return;
    changer([...liste, { id: Number(cible.id), nom: cible.nom || null }]);
  };
  const retirer = (cid) => changer(liste.filter((c) => String(c.id) !== String(cid)));
  const basculer = (cible) => (deja.has(String(cible.id)) ? retirer(cible.id) : ajouter(cible));
  const ajouterTous = (equipements) => changer([...liste, ...equipements
    .filter((e) => !deja.has(String(e.id)))
    .map((e) => ({ id: Number(e.id), nom: nomEquipement(e) }))]);

  return (
    <div className="fo-cibles">
      {mode === 'famille' ? (
        <ListeRecherche id={id} name="famille" value="" onChange={(e) => {
          const f = options.find((o) => String(o.id) === String(e.target.value));
          if (f) ajouter({ id: f.id, nom: f.nom });
        }}
          options={options.filter((o) => !deja.has(String(o.id)))} loading={chargement}
          getValue={(o) => o.id} getLabel={(o) => o.nom || `#${o.id}`}
          getOptionHint={(o) => (o.nombre != null ? t('{n} équipement(s)', { n: o.nombre }) : null)}
          placeholder={t('Ajouter une famille…')} emptyMessage={t('Aucun résultat')} />
      ) : (
        <ChoixEquipements id={id} deja={deja} basculer={basculer} ajouterTous={ajouterTous} />
      )}
      {liste.length > 0 && (
        <ul className="fo-cibles__liste">
          {liste.length > 1 && (
            <li className="fo-cibles__tout">
              <span>{t('{n} sélectionné(s)', { n: liste.length })}</span>
              <button type="button" onClick={() => changer([])} aria-label={t('Tout retirer')} title={t('Tout retirer')}><X size={13} /></button>
            </li>
          )}
          {liste.map((c) => (
            <li key={c.id}>
              <span>{c.nom || `#${c.id}`}</span>
              <button type="button" onClick={() => retirer(c.id)} aria-label={t('Retirer {nom}', { nom: c.nom || `#${c.id}` })}><X size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
