import { useEffect, useMemo, useState } from 'react';
import { Trash2, Users } from 'lucide-react';
import ListeRecherche from '../../commun/ListeRecherche';
import personnelService from '../../../services/Personnelservice';
import { Badge } from '../../commun';
import { RESULTATS_FORMATION, nomPersonnel } from './formationLibelles';
import { t } from '../../../i18n';

/*
 * Participants d'une formation : techniciens du service maintenance, chacun avec son résultat.
 * valeur : [{ personnelId, personnelNom, resultat }]
 */
export default function ChampParticipants({ id, valeur, changer }) {
  const participants = Array.isArray(valeur) ? valeur : [];
  const [personnels, setPersonnels] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    personnelService.getMaintenance(0, 500)
      .then((p) => setPersonnels(p?.content ?? p ?? []))
      .catch((e) => console.error('[GMAO formations] Techniciens :', e))
      .finally(() => setChargement(false));
  }, []);

  const deja = useMemo(() => new Set(participants.map((p) => String(p.personnelId))), [participants]);
  const disponibles = personnels.filter((p) => !deja.has(String(p.id)));

  const ajouter = (personnelId) => {
    if (!personnelId) return;
    const p = personnels.find((x) => String(x.id) === String(personnelId));
    changer([...participants, { personnelId: Number(personnelId), personnelNom: nomPersonnel(p), resultat: 'INSCRIT' }]);
  };
  const modifier = (i, resultat) => changer(participants.map((p, j) => (j === i ? { ...p, resultat } : p)));
  const retirer = (i) => changer(participants.filter((_, j) => j !== i));
  const tous = (resultat) => changer(participants.map((p) => ({ ...p, resultat })));

  return (
    <div className="fo-participants">
      <ListeRecherche id={id} name="participant" value="" onChange={(e) => ajouter(e.target.value)}
        options={disponibles} loading={chargement} getValue={(p) => p.id} getLabel={nomPersonnel}
        placeholder={t('Ajouter un technicien…')} emptyMessage={t('Aucun résultat')} />

      {participants.length === 0 ? (
        <p className="fo-participants__vide"><Users size={16} aria-hidden="true" /> {t('Aucun participant')}</p>
      ) : (
        <>
          <div className="fo-participants__tete">
            <Badge ton="teal">{t('{n} participant(s)', { n: participants.length })}</Badge>
            <span className="fo-participants__tous">
              {t('Tous :')}
              {Object.entries(RESULTATS_FORMATION).map(([cle, r]) => (
                <button key={cle} type="button" onClick={() => tous(cle)}>{t(r.label)}</button>
              ))}
            </span>
          </div>
          <ul className="fo-participants__liste">
            {participants.map((p, i) => (
              <li key={p.personnelId}>
                <span className="fo-participants__nom">{p.personnelNom || nomPersonnel(personnels.find((x) => String(x.id) === String(p.personnelId)) || { id: p.personnelId })}</span>
                <select value={p.resultat || 'INSCRIT'} onChange={(e) => modifier(i, e.target.value)}
                  aria-label={t('Résultat de {nom}', { nom: p.personnelNom || '' })} data-ton={RESULTATS_FORMATION[p.resultat || 'INSCRIT']?.ton}>
                  {Object.entries(RESULTATS_FORMATION).map(([cle, r]) => <option key={cle} value={cle}>{t(r.label)}</option>)}
                </select>
                <button type="button" className="fo-participants__retirer" onClick={() => retirer(i)}
                  aria-label={t('Retirer {nom}', { nom: p.personnelNom || '' })}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
