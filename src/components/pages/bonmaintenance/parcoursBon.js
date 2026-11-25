import {
  CheckCircle,
  XCircle,
  Users,
  ShieldCheck,
  Wrench,
  Stethoscope,
  Power,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from './BmdCommun';
import { t, tp } from '../../../i18n';

export const ETAT = {
  NOUVEAU: 1,
  SUSPENDU: 2,
  EN_COURS: 3,
  EFFECTUE: 4,
  ANNULE: 10,
};

export const ETAPES_DEF = [
  { key: 'signale', label: 'Signalé', aide: 'La panne a été déclarée', icon: Flag, rubrique: 'historique' },
  { key: 'diagnostic', label: 'Diagnostic', aide: 'On cherche la cause', icon: Stethoscope, rubrique: 'diagnostic' },
  { key: 'reparation', label: 'Réparation', aide: 'Les techniciens réparent', icon: Wrench, rubrique: 'reparation' },
  { key: 'controle', label: 'Contrôle', aide: 'On vérifie que tout marche', icon: ShieldCheck, rubrique: 'controle' },
  { key: 'cloture', label: 'Clôturé', aide: 'Le dossier est fermé', icon: CheckCircle, rubrique: 'historique' },
];

export function construireParcours({ bon, nbDiagnostics, intervenants, controle, remise }) {
  const termines = intervenants.filter((i) => i.etat === 2).length;
  const actifs = intervenants.filter((i) => i.etat !== 10);
  const reparationFaite = actifs.length > 0 && actifs.every((i) => i.etat === 2);
  const cloture = bon.etat === ETAT.EFFECTUE;

  const etat = {
    signale: { fait: true, detail: formatDate(bon.date) },
    diagnostic: { fait: nbDiagnostics > 0, detail: nbDiagnostics > 0 ? tp('diagnostic fait', nbDiagnostics) : null },
    reparation: {
      fait: reparationFaite,
      detail: intervenants.length > 0 ? tp('terminé sur', termines, { total: actifs.length }) : null,
    },
    controle: {
      fait: controle?.conforme === true,
      probleme: controle?.conforme === false,
      detail: controle ? (controle.conforme ? 'Conforme' : 'Non conforme') : null,
    },
    remise: {
      fait: remise?.conforme === true,
      probleme: remise?.conforme === false,
      detail: remise ? (remise.conforme ? 'Autorisée' : 'Refusée') : null,
    },
    cloture: { fait: cloture, detail: cloture ? formatDate(bon.dateCloture) : null },
  };

  const indexActuel = cloture ? ETAPES_DEF.length : ETAPES_DEF.findIndex((e) => !etat[e.key].fait);

  const etapes = ETAPES_DEF.map((def, i) => {
    let statut = 'avenir';
    if (cloture || i < indexActuel) statut = 'fait';
    else if (i === indexActuel) statut = etat[def.key].probleme ? 'probleme' : 'actuel';
    return { ...def, ...etat[def.key], statut };
  });

  return { etapes, indexActuel, cloture };
}

// eslint-disable-next-line no-unused-vars
function prochaineAction({ bon, parcours, intervenants }) {
  if (bon.etat === ETAT.ANNULE) {
    return {
      ton: 'neutre', icon: XCircle,
      titre: t("Ce bon a été annulé"),
      texte: t("Aucune action n'est attendue. L'historique garde la trace de ce qui a été fait."),
      bouton: { label: t("Voir l'historique"), rubrique: 'historique' },
    };
  }
  if (parcours.cloture) {
    return {
      ton: 'fini', icon: CheckCircle,
      titre: t("Réparation terminée"),
      texte: t("L'équipement est de retour dans son service et le dossier est fermé."),
      bouton: { label: t("Revoir tout le parcours"), rubrique: 'tracage' },
    };
  }
  const actuelle = parcours.etapes[parcours.indexActuel];
  switch (actuelle?.key) {
    case 'diagnostic':
      return {
        ton: 'action', icon: Stethoscope,
        titre: t("Trouvez la cause de la panne"),
        texte: t("Notez ce que vous constatez sur l’équipement."),
        bouton: { label: t("Faire le diagnostic"), rubrique: 'diagnostic', form: true },
      };
    case 'reparation':
      if (intervenants.length === 0) {
        return {
          ton: 'action', icon: Users,
          titre: t("Choisissez qui va réparer"),
          texte: t("Ajoutez un technicien de l’équipe ou un sous-traitant pour cette réparation."),
          bouton: { label: t("Ajouter un intervenant"), rubrique: 'reparation', form: true },
        };
      }
      return {
        ton: 'action', icon: Wrench,
        titre: t("La réparation est en cours"),
        texte: t("Quand un intervenant a fini, changez son état en « Terminé ». L’étape suivante se débloque toute seule."),
        bouton: { label: t("Suivre la réparation"), rubrique: 'reparation' },
        secondaire: { label: t("Ajouter un intervenant"), rubrique: 'reparation', form: true },
      };
    case 'controle':
      if (actuelle.probleme) {
        return {
          ton: 'alerte', icon: AlertTriangle,
          titre: t("Le contrôle n’est pas bon"),
          texte: t("L’équipement n’a pas passé le dernier contrôle. Faites une nouvelle réparation, puis contrôlez à nouveau."),
          bouton: { label: t("Faire un nouveau contrôle"), rubrique: 'controle', form: true },
          secondaire: { label: t("Ajouter une réparation"), rubrique: 'reparation', form: true },
        };
      }
      return {
        ton: 'action', icon: ShieldCheck,
        titre: t("Vérifiez que l’équipement fonctionne"),
        texte: t("Testez l’équipement et indiquez s’il est conforme. Une valeur mesurée peut être ajoutée."),
        bouton: { label: t("Faire le contrôle"), rubrique: 'controle', form: true },
      };
    case 'remise':
      if (actuelle.probleme) {
        return {
          ton: 'alerte', icon: AlertTriangle,
          titre: t("La remise en service a été refusée"),
          texte: t("Corrigez ce qui bloque, puis enregistrez une nouvelle décision."),
          bouton: { label: t("Enregistrer une nouvelle décision"), rubrique: 'remiseEnService', form: true },
        };
      }
      return {
        ton: 'action', icon: Power,
        titre: t("Rendez l’équipement à son service"),
        texte: t("Indiquez qui autorise la remise en service et dans quel état se trouve l’équipement."),
        bouton: { label: t("Autoriser la remise en service"), rubrique: 'remiseEnService', form: true },
      };
    default:
      return {
        ton: 'action', icon: CheckCircle,
        titre: t("Toutes les étapes sont faites"),
        texte: t("Le bon va se clôturer. Vous pouvez vérifier le journal des actions."),
        bouton: { label: t("Voir l'historique"), rubrique: 'historique' },
      };
  }
}
