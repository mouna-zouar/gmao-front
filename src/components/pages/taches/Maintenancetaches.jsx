import { useCallback, useEffect, useState } from 'react';
import maintenanceTacheService from '../../../services/maintenanceTacheService';
import { ICONES_MODULES } from '../../../constants/modules';
import { ModaleFormulaire, PageListe } from '../../commun';
import { t } from '../../../i18n';

/* Référentiel des tâches de maintenance : page liste et fenêtre de la bibliothèque commune. */

const COLONNES = [{ cle: 'nom', label: 'Nom', valeur: (x) => x.nom }];
const CHAMPS = [
  { nom: 'nom', label: 'Nom', type: 'texte', requis: true, longueurMax: 255, largeur: 'pleine', autoFocus: true, placeholder: 'Ex : Vérification des alarmes' },
];

export default function MaintenanceTaches() {
  const [taches, setTaches] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const page = await maintenanceTacheService.getAll(0, 500);
      setTaches(page.content ?? []);
    } catch {
      setErreur(t('Impossible de charger les tâches. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  return (
    <PageListe
      icone={ICONES_MODULES.referentielTaches}
      titre={t('Tâches de maintenance')}
      sousTitre={t('Référentiel des tâches types réutilisables')}
      stats={[{ label: t('Total'), valeur: taches.length }]}
      colonnes={COLONNES}
      lignes={taches}
      chargement={chargement}
      erreur={erreur}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvelle tâche')}
      onModifier={(x) => setFenetre({ ouverte: true, objet: x })}
      onSupprimer={async (x) => { await maintenanceTacheService.remove(x.id); await charger(); }}
      messageSuppression={(x) => t('Supprimer la tâche « {nom} » ? Cette action est irréversible.', { nom: x.nom })}
      cleStockage="taches-referentiel"
      nomExport="taches-maintenance"
      vide={{ aucun: t('Aucune tâche pour l’instant.'), aucunFiltre: t('Aucune tâche ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.referentielTaches}
        surtitres={{ creation: t('Nouvelle tâche'), modification: t('Modification') }}
        titres={{ creation: t('Nouvelle tâche de maintenance'), modification: t('Modifier la tâche') }}
        sections={[{ cle: 'general', label: t('Tâche'), description: t('Tâche type proposée dans les bons de maintenance') }]}
        champs={CHAMPS}
        objet={fenetre.objet}
        taille="sm"
        onEnregistrer={async (payload, { creation }) => {
          if (creation) await maintenanceTacheService.create(payload);
          else await maintenanceTacheService.update(fenetre.objet.id, payload);
          await charger();
        }}
      />
    </PageListe>
  );
}
