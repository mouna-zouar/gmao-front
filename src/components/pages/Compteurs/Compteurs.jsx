import { useCallback, useEffect, useState } from 'react';
import compteurService from '../../../services/compteurService';
import { ICONES_MODULES } from '../../../constants/modules';
import { ModaleFormulaire, PageListe } from '../../commun';
import { t } from '../../../i18n';

/* Compteurs (heures, cycles, distance…) : page liste et fenêtre de la bibliothèque commune. */

const NATURES = [
  { value: 0, label: 'Temps' },
  { value: 1, label: 'Cycles' },
  { value: 2, label: 'Distance' },
];
const natureLabel = (n) => {
  if (n == null) return '';
  const o = NATURES.find((x) => x.value === Number(n));
  return o ? t(o.label) : t('Code {n}', { n });
};

const COLONNES = [
  { cle: 'nom', label: 'Nom', valeur: (c) => c.nom },
  { cle: 'unite', label: 'Unité', valeur: (c) => c.unite },
  { cle: 'nature', label: 'Nature', valeur: (c) => natureLabel(c.nature) },
];

const CHAMPS = [
  { nom: 'nom', label: 'Nom', type: 'texte', requis: true, longueurMax: 100, largeur: 'pleine', autoFocus: true, placeholder: 'Ex : Heures de fonctionnement' },
  { nom: 'unite', label: 'Unité', type: 'texte', longueurMax: 30, placeholder: 'Ex : h, km, cycles' },
  { nom: 'nature', label: 'Nature', type: 'liste', traduireOptions: true, options: NATURES, optionVide: '— Non précisée —' },
];

export default function Compteurs() {
  const [compteurs, setCompteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreNature, setFiltreNature] = useState('all');
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const page = await compteurService.getAll(0, 500);
      setCompteurs(page.content ?? []);
    } catch {
      setErreur(t('Impossible de charger les compteurs. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lignes = filtreNature === 'all' ? compteurs : compteurs.filter((c) => String(c.nature) === filtreNature);

  return (
    <PageListe
      icone={ICONES_MODULES.compteurs}
      titre={t('Compteurs')}
      sousTitre={t('Unités de mesure suivies sur les équipements (heures, cycles, distance...)')}
      stats={[{ label: t('Total'), valeur: compteurs.length }]}
      colonnes={COLONNES}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      filtres={(
        <select value={filtreNature} onChange={(e) => setFiltreNature(e.target.value)} aria-label={t('Nature')}>
          <option value="all">{t('Toutes les natures')}</option>
          {NATURES.map((n) => <option key={n.value} value={n.value}>{t(n.label)}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouveau compteur')}
      onModifier={(c) => setFenetre({ ouverte: true, objet: c })}
      onSupprimer={async (c) => { await compteurService.remove(c.id); await charger(); }}
      messageSuppression={(c) => t('Supprimer le compteur « {nom} » ? Cette action est irréversible.', { nom: c.nom })}
      cleStockage="compteurs"
      nomExport="compteurs"
      vide={{ aucun: t('Aucun compteur pour l’instant.'), aucunFiltre: t('Aucun compteur ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.compteurs}
        surtitres={{ creation: t('Nouveau compteur'), modification: t('Modification') }}
        titres={{ creation: t('Créer un compteur'), modification: t('Modifier le compteur') }}
        sections={[{ cle: 'general', label: t('Compteur'), description: t('Ce qui est mesuré sur l’équipement et son unité') }]}
        champs={CHAMPS}
        objet={fenetre.objet}
        taille="md"
        onEnregistrer={async (payload, { creation }) => {
          if (creation) await compteurService.create(payload);
          else await compteurService.update(fenetre.objet.id, payload);
          await charger();
        }}
      />
    </PageListe>
  );
}
