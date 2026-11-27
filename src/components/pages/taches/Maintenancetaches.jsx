import { useState } from 'react';
import { useExecuter, useModule } from '../../../store/hooks';
import { tachesMaintenance } from '../../../store/modules/planification';
import { ICONES_MODULES } from '../../../constants/modules';
import { ModaleFormulaire, PageListe } from '../../commun';
import { t } from '../../../i18n';

const PARAMS = { page: 0, taille: 500 };
const COLONNES = [{ cle: 'nom', label: 'Nom', valeur: (x) => x.nom }];
const CHAMPS = [
  { nom: 'nom', label: 'Nom', type: 'texte', requis: true, longueurMax: 255, largeur: 'pleine', autoFocus: true, placeholder: 'Ex : Vérification des alarmes' },
];

export default function MaintenanceTaches() {
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });
  const module = useModule(tachesMaintenance, PARAMS);
  const executer = useExecuter();
  const taches = module.elements;
  const chargement = module.statut === 'vide' || module.statut === 'chargement';
  const erreur = module.statut === 'erreur' ? t('Impossible de charger les tâches. Vérifie que le serveur est bien lancé.') : null;

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
      onSupprimer={(x) => executer(tachesMaintenance.actions.supprimer(x.id))}
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
          if (creation) await executer(tachesMaintenance.actions.creer(payload));
          else await executer(tachesMaintenance.actions.modifier({ id: fenetre.objet.id, donnees: payload }));
        }}
      />
    </PageListe>
  );
}
