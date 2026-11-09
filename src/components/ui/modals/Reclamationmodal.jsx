import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ClipboardCheck, FileText, ThumbsUp, Wrench } from 'lucide-react';
import ModaleFormulaire from '../../commun/ModaleFormulaire';
import SuggestionCodePanne from './SuggestionCodePanne';
import VerificationsReclamation, { manqueVerifications, problemeRegle, reponsesChecklist } from './VerificationsReclamation';
import serviceService from '../../../services/Serviceservice';
import authService from '../../../services/Authservice';
import parametreService from '../../../services/parametreService';
import { SOURCES_INFORMATION, optionsTypeEntretien } from '../../../constants/FicheIntervention';

/*
 * Fenêtre « Nouvelle réclamation » / « Modifier la réclamation », décrite par ses champs
 * (affichage, validation et envoi faits par ModaleFormulaire).
 * Création en assistant : Équipement (service puis équipement) → Vérifications → Description (avec la classification).
 *
 * valeursInitiales (création) : { lotArticleImmobilistationId, description, criticite, urgence, type, sourceInformation }
 * — fiche équipement, scan d'un QR code, alerte machine.
 */

const NIVEAUX = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];


const SECTIONS = [
  { cle: 'equipement', label: 'Équipement', icone: Wrench, creation: true, description: 'Choisis l’équipement concerné : les vérifications et les codes panne dépendent de sa famille.' },
  { cle: 'verifications', label: 'Vérifications', icone: ClipboardCheck, creation: true, description: 'Fais ces vérifications sur l’équipement : beaucoup de pannes se règlent ainsi, sans intervention.' },
  { cle: 'general', label: 'Description', icone: FileText, description: 'Décris précisément le problème signalé.' },
];

function champs(reclamation) {
  const liste = [
    // ── Équipement (création) ──
    {
      nom: 'lotArticleImmobilistationId', label: 'Équipement', type: 'equipement', requis: true, creation: true,
      section: 'equipement', largeur: 'pleine', messageRequis: 'Choisis l’équipement concerné pour continuer.', autoFocus: true,
      service: 'serviceId', serviceLibelle: 'serviceNom',
      aide: 'Tapez le nom, la marque, le n° de série ou le code-barre, ou scannez l’étiquette. Le bon de maintenance sera créé pour cet équipement à la prise en charge.',
    },
    // ── Vérifications (création) : réponses envoyées en « checklist » ──
    {
      nom: 'checklist', label: '', type: 'personnalise', creation: true, section: 'verifications', largeur: 'pleine', defaut: {},
      rendu: ({ valeur, changer, valeurs }) => (
        <VerificationsReclamation equipementId={valeurs.lotArticleImmobilistationId} valeur={valeur} onChange={changer} />
      ),
      valider: (v, valeurs) => manqueVerifications(v, valeurs.lotArticleImmobilistationId),
      transformer: (v) => reponsesChecklist(v),
    },
    // ── Description ──
    { nom: 'description', label: 'Description', type: 'zone', requis: true, section: 'general', largeur: 'pleine', lignes: 4, autoFocus: true, placeholder: 'Décrivez le problème rencontré...' },
    {
      nom: 'codePanneId', label: 'Code panne', type: 'personnalise', section: 'general', largeur: 'pleine',
      rendu: ({ valeur, valeurs, changerChamp }) => (
        <SuggestionCodePanne
          description={valeurs.description}
          lotArticleImmobilistationId={valeurs.lotArticleImmobilistationId || reclamation?.lotArticleImmobilistationId}
          reclamationId={reclamation?.id ?? null}
          codePanneId={valeur}
          codePanneSource={valeurs.codePanneSource}
          libelleActuel={reclamation?.codePanneCode ? `${reclamation.codePanneCode} · ${reclamation.codePanneLibelle || ''}` : null}
          onChoisir={(id, source) => { changerChamp('codePanneId', id ? String(id) : ''); changerChamp('codePanneSource', id ? source : ''); }}
        />
      ),
      transformer: (v) => (v === '' || v == null ? null : Number(v)),
    },
    { nom: 'codePanneSource', cache: true, transformer: (v, valeurs) => (valeurs.codePanneId ? (v || 'MANUEL') : null) },
    // Numéro et N° interne : non affichés (attribués par le serveur), gardés tels quels en modification
    { nom: 'num', cache: true },
    { nom: 'n', cache: true },
    // Prestataire : vient des paramètres système (non affiché)
    { nom: 'prestataireId', cache: true },
    { nom: 'prestataireNom', cache: true },
    {
      nom: 'serviceId', label: 'Service', type: 'recherche', section: 'general',
      chargerOptions: () => serviceService.getAll(0, 200), cleOptions: 'reclamation-services',
      optionLabel: (s) => s.description || s.code || `Service #${s.id}`,
      optionAide: (s) => (s.code && s.description ? `Code : ${s.code}` : null),
      filtrerOptions: (l, v) => (v.prestataireId ? l.filter((s) => s.prestataireId == null || String(s.prestataireId) === String(v.prestataireId)) : l),
      viderSiAbsent: true, libelleVers: 'serviceNom', placeholder: 'Rechercher un service...',
    },
    { nom: 'serviceNom', cache: true },
    // ── Classification (avec la description) ──
    { nom: 'criticite', label: 'Criticité', type: 'liste', section: 'general', options: NIVEAUX, optionVide: '— Non renseigné —', traduireOptions: true },
    { nom: 'urgence', label: 'Urgence', type: 'liste', section: 'general', options: NIVEAUX, optionVide: '— Non renseigné —', traduireOptions: true },
    { nom: 'type', label: 'Type d’entretien', type: 'liste', section: 'general', options: (v) => optionsTypeEntretien(v.type), optionVide: '— Non renseigné —', traduireOptions: true },
    { nom: 'sourceInformation', label: 'Source de l’information', type: 'liste', section: 'general', options: SOURCES_INFORMATION, optionVide: '— Non renseigné —', traduireOptions: true },
  ];
  // Création : le service se choisit avant l'équipement (la liste des équipements suit ce service)
  if (!reclamation) {
    const i = liste.findIndex((c) => c.nom === 'serviceId');
    const j = liste.findIndex((c) => c.nom === 'lotArticleImmobilistationId');
    if (i > j && j >= 0) {
      const [service] = liste.splice(i, 1);
      liste.splice(j, 0, { ...service, section: 'equipement', largeur: 'pleine' });
    }
  }
  return liste;
}

/** Qui fait la demande (création) : suivi dans Mon espace → « Mes demandes ». */
function createur() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    personnelCreationId: id != null ? Number(id) : null,
    personnelCreationNom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}

export default function ReclamationModal({ isOpen, onClose, onSave, reclamation, isEditing, valeursInitiales }) {
  const objet = isEditing ? reclamation : null;
  const liste = useMemo(() => champs(objet), [objet]);

  // Prestataire des paramètres système, relu à chaque ouverture
  const [prestataireParametre, setPrestataireParametre] = useState(null);
  useEffect(() => {
    if (!isOpen) return undefined;
    let annule = false;
    parametreService.prestataireEquipements().then((v) => { if (!annule) setPrestataireParametre(v); });
    return () => { annule = true; };
  }, [isOpen]);

  // Création : service et prestataire de l'utilisateur, puis ce que propose l'appelant
  const initiales = useMemo(() => {
    if (isEditing) return null;
    const ctx = authService.getContexteMetier();
    return { serviceId: ctx.serviceId, serviceNom: ctx.serviceNom || '', prestataireId: ctx.prestataireId, ...(valeursInitiales || {}) };
  }, [isEditing, valeursInitiales, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const enregistrer = (payload, { creation }) => onSave({
    ...payload,
    // Création : prestataire imposé par les paramètres système (sinon celui de la session)
    ...(creation && prestataireParametre ? { prestataireId: prestataireParametre, prestataireNom: null } : {}),
    // L'affectation se fait avec « Affecter » : en modification, le technicien actuel est renvoyé tel quel
    ...(creation ? createur() : {
      personnelAffecteId: reclamation?.personnelAffecteId ?? null,
      personnelAffecteNom: reclamation?.personnelAffecteNom ?? null,
    }),
  });

  return (
    <ModaleFormulaire
      ouvert={isOpen}
      onFermer={onClose}
      icone={AlertCircle}
      titres={{ creation: 'Nouvelle réclamation', modification: 'Modifier la réclamation' }}
      sousTitre={isEditing && reclamation?.num ? reclamation.num : null}
      champs={liste}
      sections={SECTIONS}
      objet={objet}
      initiales={initiales}
      etapes
      libelleEnregistrer={isEditing ? 'Mettre à jour' : 'Créer la réclamation'}
      onEnregistrer={enregistrer}
      confirmerAvantEnvoi={(v) => (problemeRegle(v.checklist) ? {
        icone: ThumbsUp,
        titre: 'Le problème semble réglé',
        texte: 'Tu as indiqué que le problème n’est plus présent après les vérifications. Il n’est peut-être pas nécessaire d’envoyer la réclamation.',
        abandonner: 'Ne pas envoyer',
        envoyer: 'Envoyer quand même',
      } : null)}
    />
  );
}
