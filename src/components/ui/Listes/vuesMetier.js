import {
  ShoppingCart, ClipboardCheck, Archive,
  AlarmClock, CalendarCheck, CircleUserRound, Flame, Hourglass, Inbox, ListTodo, OctagonAlert, UserCheck, UserX, Users,
} from 'lucide-react';
import { ACTIFS } from '../../../constants/statuts';
import authService from '../../../services/Authservice';

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

export const echeanceBon = (b) => enDate(b.dateFinIntervention) || enDate(b.date);
export const bonActif = (b) => ACTIFS.bon.includes(Number(b.etat));
export const bonArchive = (b) => b.validationStatut === 'VALIDE';
export const bonEnRetard = (b) => {
  const e = echeanceBon(b);
  return bonActif(b) && e != null && e < debutDuJour();
};

export function vuesBons({ personnelId, serviceId }, mesBonIds, achatIds) {
  const estAMoi = (b) => (mesBonIds?.has(String(b.id)))
    || memeId(b.personnelCreationId, personnelId)
    || memeId(b.personnelDemandantId, personnelId);
  const maintenant = new Date();
  const vues = [
    { id: 'tous', label: 'Tous', icone: Inbox },
    { id: 'a-traiter', label: 'À traiter', icone: ListTodo, aide: 'Nouveaux, suspendus et en cours', filtre: bonActif },
    { id: 'a-valider', label: 'À valider', icone: ClipboardCheck, ton: 'attention', aide: 'Bons effectués qui attendent la validation du manager', filtre: (b) => b.validationStatut === 'A_VALIDER' },
    { id: 'archives', label: 'Archivés', icone: Archive, aide: 'Bons validés par le manager et archivés', filtre: bonArchive, archives: true },
  ];
  if (personnelId != null) {
    vues.push(
      { id: 'mes-bons', label: 'Mes bons', icone: CircleUserRound, aide: 'Bons que j\'ai créés, demandés ou où j\'interviens', filtre: (b) => estAMoi(b) && bonActif(b) },
      { id: 'achats', label: 'Achats à faire', icone: ShoppingCart, ton: 'attention', aide: 'Bons dont les tâches ont des articles à demander ou à commander', filtre: (b) => !!achatIds?.has(String(b.id)) },
      { id: 'mes-retards', label: 'Mes bons en retard', icone: AlarmClock, ton: 'alerte', aide: 'Mes bons à traiter dont la date prévue est passée', filtre: (b) => estAMoi(b) && bonEnRetard(b) },
    );
  }
  if (personnelId == null) {
    vues.push({ id: 'achats', label: 'Achats à faire', icone: ShoppingCart, ton: 'attention', aide: 'Bons dont les tâches ont des articles à demander ou à commander', filtre: (b) => !!achatIds?.has(String(b.id)) });
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
  return vues.map((v) => (v.archives ? v : {
    ...v, sansFiltre: !v.filtre, filtre: v.filtre ? (b) => !bonArchive(b) && v.filtre(b) : (b) => !bonArchive(b),
  }));
}

export const reclamationActive = (r) => ACTIFS.reclamation.includes(Number(r.etat));
export const reclamationATraiter = (r) => [0, 5, 1].includes(Number(r.etat ?? 0));

export function vuesReclamations({ personnelId, serviceId }) {
  const vues = [
    { id: 'toutes', label: 'Toutes', icone: Inbox },
    { id: 'a-traiter', label: 'À traiter', icone: ListTodo, aide: 'Nouvelles, en file et en cours', filtre: (r) => reclamationATraiter(r) },
    {
      id: 'non-affectees', label: 'Non affectées', icone: UserX, ton: 'attention', aide: 'À traiter, sans groupe ni technicien',
      filtre: (r) => reclamationATraiter(r) && r.groupeId == null && r.personnelAffecteId == null && !(r.groupePersonnels?.length > 0),
    },
  ];
  if (personnelId != null) {
    vues.push(
      { id: 'mes-reclamations', label: 'Mes réclamations', icone: CircleUserRound, aide: 'Réclamations que j\'ai créées', filtre: (r) => memeId(r.personnelCreationId, personnelId) },
      { id: 'affectees', label: 'Affectées à moi', icone: UserCheck, aide: 'À moi ou à un groupe dont je fais partie',
        filtre: (r) => (memeId(r.personnelAffecteId, personnelId) || (r.groupePersonnels || []).some((m) => memeId(m.id, personnelId))) && reclamationATraiter(r) },
      { id: 'a-valider', label: 'À clôturer', icone: Hourglass, ton: 'attention', aide: 'Mes réclamations résolues qui attendent la clôture', filtre: (r) => Number(r.etat) === 3 && memeId(r.personnelCreationId, personnelId) },
    );
  }
  if (serviceId != null) {
    vues.push({
      id: 'mon-groupe', label: 'Mon groupe', icone: Users, aide: 'À traiter, affectées au groupe de mon service',
      filtre: (r) => memeId(r.groupeId, serviceId) && reclamationATraiter(r),
    });
    vues.push({
      id: 'urgentes-service', label: 'Urgentes de mon service', icone: Flame, ton: 'alerte',
      filtre: (r) => memeId(r.serviceId, serviceId) && Number(r.urgence) === 3 && reclamationActive(r),
    });
  }
  vues.push({ id: 'critiques', label: 'Critiques', icone: OctagonAlert, ton: 'alerte', aide: 'Criticité élevée, non clôturées', filtre: (r) => Number(r.criticite) === 3 && reclamationActive(r) });
  return vues;
}
