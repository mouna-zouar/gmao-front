import { useEffect, useMemo, useState } from 'react';
import { Brain, ClipboardList, FileText, MapPin, MessageSquare, Users, Wrench } from 'lucide-react';
import ModaleFormulaire from '../../commun/ModaleFormulaire';
import personnelService from '../../../services/personnelService';
import { commePage, obtenirArticles, obtenirEquipements, obtenirPrestataires } from '../../../store/referentiels';
import authService from '../../../services/Authservice';
import serviceService from '../../../services/Serviceservice';
import parametreService from '../../../services/parametreService';
import { SOURCES_INFORMATION } from '../../../constants/FicheIntervention';
import { t } from '../../../i18n';
import {
  AssistantDiagnostic, ChoixTypeEntretien, ListeCommentaires, ListeIntervenants, ListeTaches, StockEquipement,
} from './BonMaintenanceSaisie';

/*
 * Fenêtre « Nouveau bon de maintenance » / « Modifier le bon », décrite par ses champs (ModaleFormulaire).
 * Création en assistant : Général → Affectation → Diagnostic → Intervenants → Tâches → Commentaires.
 * Modification : sections Général, Affectation, Diagnostic, Commentaires (tâches, intervenants et
 * commentaires se gèrent ensuite depuis le détail du bon).
 *
 * onSave(bon, enfants) — enfants (création seulement) : { taches, intervenants, commentaires }.
 * initialValues : valeurs proposées à la création (ex. bon créé depuis une réclamation).
 */

const NIVEAUX = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];

/** Maintenant, au format du champ date et heure (heure locale). */
function maintenant() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const SECTIONS = [
  { cle: 'general', label: 'Général', icone: FileText, description: "Titre, description, niveau d'urgence et type d'entretien" },
  { cle: 'affectation', label: 'Affectation', icone: MapPin, description: 'Service, équipement et dates' },
  { cle: 'diagnostic', label: 'Diagnostic', icone: Brain, description: "Assistant basé sur l'historique des interventions, puis cause, effet et remède" },
  { cle: 'intervenants', label: 'Intervenants', icone: Users, creation: true, description: 'Techniciens et sous-traitants affectés' },
  { cle: 'taches', label: 'Tâches', icone: ClipboardList, creation: true, description: 'Opérations prévues pour cette intervention' },
  { cle: 'commentaires', label: 'Commentaires', icone: MessageSquare, description: 'Notes et précisions sur le bon' },
];

const nombre = (v) => (v === '' || v == null ? null : Number(v));
const date = (v) => v || null;

function champs(listes) {
  const { personnels, techniciens, prestataires, articles, chargement } = listes;
  return [
    // ── Général ──
    // Numéro et N° interne : non affichés (attribués par le serveur), gardés tels quels en modification
    { nom: 'num', cache: true },
    { nom: 'n', cache: true },
    { nom: 'titre', label: 'Titre', requis: true, section: 'general', largeur: 'pleine', autoFocus: true, messageRequis: t('Le titre est obligatoire.'),
      placeholder: 'Ex : Remplacement filtre climatisation bloc B' },
    { nom: 'description', label: 'Description', type: 'zone', lignes: 4, section: 'general', largeur: 'pleine', placeholder: "Décris le problème ou l'opération à réaliser..." },
    { nom: 'urgence', label: 'Urgence', type: 'liste', section: 'general', options: NIVEAUX, optionVide: '—', traduireOptions: true },
    { nom: 'sourceInformation', label: "Source de l'information", type: 'liste', section: 'general', options: SOURCES_INFORMATION, optionVide: '—', traduireOptions: true },
    { nom: 'type', label: "Type d'entretien", type: 'personnalise', section: 'general', largeur: 'pleine', transformer: nombre,
      rendu: ({ valeur, changer }) => <ChoixTypeEntretien valeur={valeur} changer={changer} /> },
    { nom: 'arretOblig', label: '', type: 'case', section: 'general', largeur: 'pleine',
      texteCase: "Arrêt obligatoire de l'équipement", aide: "L'équipement sera immobilisé pendant l'intervention." },
    // ── Affectation : le service limite les équipements proposés, l'équipement choisi remplit le service ──
    { nom: 'serviceId', label: 'Service', type: 'recherche', section: 'affectation', largeur: 'pleine',
      chargerOptions: () => serviceService.getAll(0, 200).then((d) => d?.content ?? d ?? []), cleOptions: 'bon-services',
      optionLabel: (s) => s.description || s.code || `Service #${s.id}`,
      optionVide: '— Aucun —', libelleVers: 'serviceNom', placeholder: 'Rechercher un service...' },
    { nom: 'serviceNom', cache: true, envoyer: false },
    { nom: 'lotArticleImmobilistationId', label: 'Équipement', type: 'equipement', section: 'affectation', largeur: 'pleine',
      service: 'serviceId', serviceLibelle: 'serviceNom',
      aide: 'Tapez le nom, la marque, le n° de série ou le code-barre, ou scannez l’étiquette.' },
    { nom: 'stock', label: '', type: 'personnalise', section: 'affectation', largeur: 'pleine', envoyer: false,
      visible: (v) => !!v.lotArticleImmobilistationId,
      rendu: ({ valeurs }) => <StockEquipement equipementId={valeurs.lotArticleImmobilistationId} /> },
    // Prestataire (paramètres système) et demandeur (utilisateur connecté) : non affichés, remplis automatiquement
    { nom: 'prestataireId', cache: true },
    { nom: 'personnelDemandantId', cache: true },
    { nom: 'date', label: 'Date début', type: 'dateheure', section: 'affectation' },
    { nom: 'dateFinIntervention', label: 'Date fin', type: 'dateheure', section: 'affectation',
      valider: (v, valeurs) => (v && valeurs.date && v < valeurs.date ? t('La fin est avant le début.') : null) },
    // ── Diagnostic ──
    { nom: 'assistantDiagnostic', label: '', type: 'personnalise', section: 'diagnostic', largeur: 'pleine', envoyer: false,
      rendu: ({ valeurs, changerChamp }) => <AssistantDiagnostic valeurs={valeurs} changerChamp={changerChamp} /> },
    { nom: 'cause', label: 'Cause', section: 'diagnostic' },
    { nom: 'effet', label: 'Effet', section: 'diagnostic' },
    { nom: 'remede', label: 'Remède', section: 'diagnostic', largeur: 'pleine' },
    // ── Intervenants, tâches et commentaires ajoutés à la création ──
    { nom: 'intervenants', label: '', type: 'personnalise', section: 'intervenants', largeur: 'pleine', creation: true, envoyer: false, defaut: [],
      rendu: ({ valeur, changer, valeurs, changerChamp }) => (
        <ListeIntervenants valeur={valeur} changer={changer} valeurs={valeurs} changerChamp={changerChamp}
          techniciens={techniciens} personnels={personnels} prestataires={prestataires} chargement={chargement} />
      ) },
    { nom: 'taches', label: '', type: 'personnalise', section: 'taches', largeur: 'pleine', creation: true, envoyer: false, defaut: [],
      rendu: ({ valeur, changer, valeurs }) => (
        <ListeTaches valeur={valeur} changer={changer} intervenants={valeurs.intervenants} articles={articles} prestataires={prestataires} chargement={chargement} />
      ) },
    { nom: 'commentaires', label: '', type: 'personnalise', section: 'commentaires', largeur: 'pleine', creation: true, envoyer: false, defaut: [],
      rendu: ({ valeur, changer }) => <ListeCommentaires valeur={valeur} changer={changer} /> },
    { nom: 'commentaire', label: 'Commentaire général', type: 'zone', lignes: 4, section: 'commentaires', largeur: 'pleine', placeholder: 'Notes internes, contexte particulier...' },
  ];
}

/** Enfants du bon envoyés à la création, au format attendu par le service. */
function enfants(v) {
  const sansId = (l) => (l || []).map(({ _id, ...reste }) => reste);
  return {
    taches: sansId(v.taches).map((x) => ({
      designation: x.designation.trim(), ordre: nombre(x.ordre), dateDebut: date(x.dateDebut), dateFin: date(x.dateFin),
      prestataireArticlesId: nombre(x.prestataireArticlesId), qte: nombre(x.qte), sousTraitantId: nombre(x.sousTraitantId),
    })),
    intervenants: sansId(v.intervenants).map((i) => ({
      personnelId: nombre(i.personnelId), sousTraitantId: nombre(i.sousTraitantId),
      dateDebutIntervention: date(i.dateDebutIntervention), dateFinIntervention: date(i.dateFinIntervention),
      nbrHeure: nombre(i.nbrHeure), coutUnitaire: nombre(i.coutUnitaire),
      forfait: i.forfait === '' || !i.sousTraitantId ? null : Number(i.forfait),
      commentaire: i.commentaire.trim() || null,
    })),
    commentaires: sansId(v.commentaires),
  };
}

const BonMaintenanceModal = ({ isOpen, onClose, onSave, bonMaintenance, isEditing, initialValues = null, titleOverride = null }) => {
  const [listes, setListes] = useState({ personnels: [], techniciens: [], prestataires: [], immobilisations: [], articles: [], chargement: false });

  // Listes de choix, à chaque ouverture
  useEffect(() => {
    if (!isOpen) return undefined;
    let annule = false;
    setListes((l) => ({ ...l, chargement: true }));
    Promise.all([
      personnelService.getAll(0, 200),
      obtenirPrestataires(),
      obtenirEquipements().then(commePage),
      obtenirArticles(), // articles du prestataire, catégorie 15
      personnelService.getMaintenance(0, 200), // service maintenance : intervenants
    ])
      .then(([pers, prest, immo, art, tech]) => {
        if (annule) return;
        setListes({
          personnels: pers?.content ?? [], techniciens: tech?.content ?? [], prestataires: prest ?? [],
          immobilisations: immo?.content ?? [], articles: Array.isArray(art) ? art : [], chargement: false,
        });
      })
      .catch((err) => { console.error('Erreur chargement :', err); if (!annule) setListes((l) => ({ ...l, chargement: false })); });
    return () => { annule = true; };
  }, [isOpen]);

  const liste = useMemo(() => champs(listes), [listes]);
  const objet = isEditing ? bonMaintenance : null;

  // Création : date du bon (jamais vide par oubli), prestataire et demandeur de l'utilisateur, puis ce que propose l'appelant
  const initiales = useMemo(() => {
    if (isEditing) return null;
    const ctx = authService.getContexteMetier();
    return { date: maintenant(), prestataireId: ctx.prestataireId, personnelDemandantId: ctx.userId, serviceId: ctx.serviceId, ...(initialValues || {}) };
  }, [isEditing, initialValues, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prestataire des paramètres système, relu à chaque ouverture
  const [prestataireParametre, setPrestataireParametre] = useState(null);
  useEffect(() => {
    if (!isOpen) return undefined;
    let annule = false;
    parametreService.prestataireEquipements().then((v) => { if (!annule) setPrestataireParametre(v); });
    return () => { annule = true; };
  }, [isOpen]);

  const enregistrer = (payload, { creation, valeurs }) => onSave(
    creation && prestataireParametre ? { ...payload, prestataireId: prestataireParametre } : payload,
    creation ? enfants(valeurs) : null,
  );

  return (
    <ModaleFormulaire
      ouvert={isOpen}
      onFermer={onClose}
      icone={Wrench}
      titres={{ creation: titleOverride || t('Nouveau bon de maintenance'), modification: t('Modifier le bon') }}
      sousTitre={isEditing && bonMaintenance?.num ? bonMaintenance.num : null}
      champs={liste}
      sections={SECTIONS}
      objet={objet}
      initiales={initiales}
      etapes
      taille="xl"
      libelleEnregistrer={isEditing ? t('Mettre à jour') : t('Créer le bon')}
      onEnregistrer={enregistrer}
    />
  );
};

export default BonMaintenanceModal;
