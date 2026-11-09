import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ListeRecherche from '../../commun/ListeRecherche';
import ChampEquipement from '../../ui/ChampEquipement/ChampEquipement';
import { t } from '../../../i18n';

/*
 * Choix multiple d'une formation : familles d'équipements ou équipements visés.
 * valeur : [{ id, nom }]. mode 'famille' (liste chargée par chargerOptions) ou 'equipement' (recherche dans le parc).
 */
export default function ChampCibles({ id, valeur, changer, mode = 'famille', chargerOptions }) {
  const liste = Array.isArray(valeur) ? valeur : [];
  const [options, setOptions] = useState([]);
  const [chargement, setChargement] = useState(mode === 'famille');
  // Recrée le champ équipement après chaque ajout (il redevient vide)
  const [cleChamp, setCleChamp] = useState(0);

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
        <ChampEquipement key={cleChamp} id={id} name="equipement" value="" facultatif
          onChange={() => {}}
          onEquipementChoisi={(e) => { ajouter({ id: e.id, nom: e.designation || e.libelle || e.code }); setCleChamp((k) => k + 1); }} />
      )}
      {liste.length > 0 && (
        <ul className="fo-cibles__liste">
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
