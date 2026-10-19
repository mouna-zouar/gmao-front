import {
  AlarmClock, CalendarCheck, CircleUserRound, Flame, Hourglass, Inbox, ListTodo, OctagonAlert, UserCheck,
} from 'lucide-react';
import { ACTIFS } from '../../../constants/statuts';
import authService from '../../../services/Authservice';

/*
 * Vues prêtes à l'emploi des listes Bons et Réclamations.
 * Chaque vue est un filtre sur les lignes déjà chargées : rien de plus n'est demandé au serveur,
 * sauf la liste des bons où l'utilisateur intervient (pour « Mes bons »).
 */

/** Qui est connecté : identifiants utiles aux vues « Mes… » et « … de mon service ». */
export function contexteUtilisateur() {
  const user = authService.getCurrentUser?.() || null;
  const ctx = authService.getContexteMetier?.() || {};
  const personnelId = user?.personnelId ?? user?.personnel?.id ?? user?.userId ?? null;
  return {
    personnelId,
    serviceId: ctx.serviceId ?? user?.serviceId ?? null,
    cle: String(user?.userId ?? user?.login ?? 'anonyme'),
  };
}

const memeId = (a, b) => a != null && b != null && String(a) === String(b);

const debutDuJour = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const enDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Date à laquelle le bon devait être fini : fin d'intervention prévue, sinon date du bon. */
export const echeanceBon = (b) => enDate(b.dateFinIntervention) || enDate(b.date);
export const bonActif = (b) => ACTIFS.bon.includes(Number(b.etat));
export const bonEnRetard = (b) => {
  const e = echeanceBon(b);
  return bonActif(b) && e != null && e < debutDuJour();
};

/** Vues de la liste des bons. `mesBonIds` : Set des bons où l'utilisateur a un rôle (ou null). */
export function vuesBons({ personnelId, serviceId }, mesBonIds) {
  const estAMoi = (b) => (mesBonIds?.has(String(b.id)))
    || memeId(b.personnelCreationId, personnelId)
    || memeId(b.personnelDemandantId, personnelId);
  const maintenant = new Date();
  const vues = [
    { id: 'tous', label: 'Tous', icone: Inbox },
    { id: 'a-traiter', label: 'À traiter', icone: ListTodo, aide: 'Nouveaux, suspendus et en cours', filtre: bonActif },
  ];
  if (personnelId != null) {
    vues.push(
      { id: 'mes-bons', label: 'Mes bons', icone: CircleUserRound, aide: 'Bons que j\'ai créés, demandés ou où j\'interviens', filtre: (b) => estAMoi(b) && bonActif(b) },
      { id: 'mes-retards', label: 'Mes bons en retard', icone: AlarmClock, ton: 'alerte', aide: 'Mes bons à traiter dont la date prévue est passée', filtre: (b) => estAMoi(b) && bonEnRetard(b) },
    );
  }
  vues.push({ id: 'retard', label: 'En retard', icone: Hourglass, ton: 'attention', aide: 'Bons à traiter dont la date prévue est passée', filtre: bonEnRetard });
  if (serviceId != null) {
    vues.push({
      id: 'urgents-service', label: 'Urgents de mon service', icone: Flame, ton: 'alerte',
      aide: 'Bons à traiter d\'urgence élevée dans mon service',
      filtre: (b) => memeId(b.serviceId, serviceId) && Number(b.urgence) === 3 && bonActif(b),
    });
  }
  vues.push({
    id: 'clotures-mois', label: 'Effectués ce mois', icone: CalendarCheck, ton: 'ok',
    filtre: (b) => {
      if (Number(b.etat) !== 4) return false;
      const d = enDate(b.dateCloture) || enDate(b.dateFinIntervention);
      return d != null && d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear();
    },
  });
  return vues;
}

export const reclamationActive = (r) => ACTIFS.reclamation.includes(Number(r.etat));

/** Vues de la liste des réclamations. */
export function vuesReclamations({ personnelId, serviceId }) {
  const vues = [
    { id: 'toutes', label: 'Toutes', icone: Inbox },
    { id: 'a-traiter', label: 'À traiter', icone: ListTodo, aide: 'Ouvertes et en cours', filtre: (r) => [0, 1].includes(Number(r.etat)) },
  ];
  if (personnelId != null) {
    vues.push(
      { id: 'mes-reclamations', label: 'Mes réclamations', icone: CircleUserRound, aide: 'Réclamations que j\'ai créées', filtre: (r) => memeId(r.personnelCreationId, personnelId) },
      { id: 'affectees', label: 'Affectées à moi', icone: UserCheck, filtre: (r) => memeId(r.personnelAffecteId, personnelId) && reclamationActive(r) },
      { id: 'a-valider', label: 'À valider', icone: Hourglass, ton: 'attention', aide: 'Mes réclamations traitées qui attendent ma validation', filtre: (r) => Number(r.etat) === 3 && memeId(r.personnelCreationId, personnelId) },
    );
  }
  if (serviceId != null) {
    vues.push({
      id: 'urgentes-service', label: 'Urgentes de mon service', icone: Flame, ton: 'alerte',
      filtre: (r) => memeId(r.serviceId, serviceId) && Number(r.urgence) === 3 && reclamationActive(r),
    });
  }
  vues.push({ id: 'critiques', label: 'Critiques', icone: OctagonAlert, ton: 'alerte', aide: 'Criticité élevée, non clôturées', filtre: (r) => Number(r.criticite) === 3 && reclamationActive(r) });
  return vues;
}
