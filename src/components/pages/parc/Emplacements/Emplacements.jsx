import { useCallback, useEffect, useState } from 'react';
import { Home, Navigation } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import emplacementService from '../../../../services/emplacementService';
import api from '../../../../services/api';
import { ModaleFormulaire, PageListe } from '../../../commun';
import { t } from '../../../../i18n';
import './Emplacements.css';
import { commePage, obtenirEmplacements } from '../../../../store/referentiels';

/*
 * Écran pilote de la bibliothèque commune (src/components/commun) :
 * la page entière = une description de colonnes + une description de champs.
 * Liste : PageListe (recherche, tri, colonnes réglables, export, impression, double-clic, pagination).
 * Fenêtre : ModaleFormulaire (création et modification, validation, envoi).
 */

/* Colonnes du tableau (valeur : tri, recherche, export ; rendu : affichage) */
const COLONNES = [
  {
    cle: 'nom', label: 'Nom', valeur: (e) => e.nom,
    rendu: (e) => (
      <span className="emp-cell-name">
        <span className="emp-cell-name-icon"><Home size={14} strokeWidth={2.2} /></span>
        <span className="emp-cell-main">{e.nom || '—'}</span>
      </span>
    ),
  },
  {
    cle: 'adresse', label: 'Adresse', valeur: (e) => e.adresse,
    rendu: (e) => (e.adresse
      ? <span className="emp-cell-address"><Navigation size={13} strokeWidth={2.2} /><span>{e.adresse}</span></span>
      : <span className="emp-cell-empty">—</span>),
  },
  { cle: 'ville', label: 'Ville', valeur: (e) => e.villeNom || e.ville?.nom || '', visible: false },
];

/* Champs du formulaire (affichage + validation + conversion pour le serveur) */
const CHAMPS = [
  { nom: 'nom', label: 'Nom', type: 'texte', icone: Home, placeholder: 'Ex : Siège Tunis', longueurMax: 150, largeur: 'pleine', autoFocus: true },
  { nom: 'adresse', label: 'Adresse', type: 'texte', icone: Navigation, placeholder: 'Ex : 12 Avenue Habib Bourguiba, Tunis', longueurMax: 255, largeur: 'pleine' },
  {
    nom: 'villeId', label: 'Ville', type: 'liste', cleOptions: 'villes',
    chargerOptions: () => api.get('/villes').then((r) => r.data), optionValeur: 'id', optionLabel: 'nom',
    optionVide: '— Aucune ville —',
  },
];

export default function Emplacements() {
  const [emplacements, setEmplacements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const page = await obtenirEmplacements().then(commePage);
      setEmplacements(page.content ?? page ?? []);
    } catch {
      setErreur(t('Impossible de charger les emplacements. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (payload, { creation }) => {
    if (creation) await emplacementService.create(payload);
    else await emplacementService.update(fenetre.objet.id, payload);
    await charger();
  };

  return (
    <PageListe
      icone={ICONES_MODULES.emplacements}
      titre={t('Emplacements')}
      sousTitre={t('Lieux et sites référencés')}
      stats={[
        { label: t('Total'), valeur: emplacements.length },
        { label: t('Avec adresse'), valeur: emplacements.filter((e) => e.adresse).length, ton: 'bleu' },
      ]}
      colonnes={COLONNES}
      lignes={emplacements}
      chargement={chargement}
      erreur={erreur}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvel emplacement')}
      onModifier={(e) => setFenetre({ ouverte: true, objet: e })}
      onSupprimer={async (e) => { await emplacementService.remove(e.id); await charger(); }}
      messageSuppression={(e) => t('Supprimer « {nom} » ? Cette action est irréversible.', { nom: e.nom || e.adresse })}
      cleStockage="emplacements"
      nomExport="emplacements"
      vide={{ aucun: t('Aucun emplacement pour l’instant.'), aucunFiltre: t('Aucun emplacement ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.emplacements}
        surtitres={{ creation: t('Nouvel emplacement'), modification: t('Modification') }}
        titres={{ creation: t('Créer un emplacement'), modification: t('Modifier l’emplacement') }}
        sections={[{ cle: 'general', label: t('Informations de l’emplacement'), description: t('Nom, adresse et ville du lieu') }]}
        champs={CHAMPS}
        objet={fenetre.objet}
        taille="md"
        valider={(v) => (!v.nom?.trim() && !v.adresse?.trim() ? t('Renseigne au moins un nom ou une adresse.') : null)}
        onEnregistrer={enregistrer}
      />
    </PageListe>
  );
}
