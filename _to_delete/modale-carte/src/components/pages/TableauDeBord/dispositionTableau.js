import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, BellRing, CalendarClock, CircleDollarSign, ClipboardCheck, Gauge, Hash,
  MessageSquareWarning, OctagonAlert, Package, Timer, TrendingUp, Wrench,
} from 'lucide-react';

export const LARGEURS = ['tiers', 'moitie', 'deux-tiers', 'pleine'];
export const LIBELLE_LARGEUR = { tiers: '1/3', moitie: '1/2', 'deux-tiers': '2/3', pleine: '1/1' };

export const STATS = [
  { id: 'bons', titre: 'Bons ouverts' },
  { id: 'reclamations', titre: 'Réclamations ouvertes' },
  { id: 'arrets', titre: 'Équipements à l’arrêt' },
  { id: 'disponibilite', titre: 'Disponibilité moyenne' },
  { id: 'sla', titre: 'Délais SLA respectés' },
  { id: 'cout', titre: 'Coût de maintenance' },
];

export const CARTES = [
  { id: 'activite', largeur: 'deux-tiers' },
  { id: 'bonsOuverts', largeur: 'tiers' },
  { id: 'retards', largeur: 'moitie' },
  { id: 'arrets', largeur: 'moitie' },
  { id: 'slaPriorite', largeur: 'tiers' },
  { id: 'preventif', largeur: 'tiers' },
  { id: 'etatEquipements', largeur: 'tiers' },
  { id: 'couts', largeur: 'deux-tiers' },
  { id: 'plusCouteux', largeur: 'tiers' },
  { id: 'performance', largeur: 'moitie' },
  { id: 'indicateurs', largeur: 'moitie' },
  { id: 'plusAnciens', largeur: 'pleine' },
];

export const INDICATEURS = [
  { cle: 'bons.ouverts', groupe: 'Bons', label: 'Bons ouverts', format: 'nombre' },
  { cle: 'bons.creesPeriode', groupe: 'Bons', label: 'Bons créés', format: 'nombre', precedent: 'bons.creesPeriodePrecedente' },
  { cle: 'bons.cloturesPeriode', groupe: 'Bons', label: 'Bons clôturés', format: 'nombre' },
  { cle: 'bons.parEtat.3', groupe: 'Bons', label: 'Bons en cours', format: 'nombre' },
  { cle: 'bons.parEtat.2', groupe: 'Bons', label: 'Bons suspendus', format: 'nombre' },
  { cle: 'sla.enRetard', groupe: 'Bons', label: 'Bons en retard (SLA)', format: 'nombre' },
  { cle: 'bons.arretsObligatoires', groupe: 'Bons', label: 'Arrêts obligatoires en cours', format: 'nombre' },
  { cle: 'bons.preventifsPeriode', groupe: 'Bons', label: 'Préventifs prévus', format: 'nombre' },
  { cle: 'bons.preventifsEffectues', groupe: 'Bons', label: 'Préventifs effectués', format: 'nombre' },
  { cle: 'bons.partPreventifPct', groupe: 'Bons', label: 'Part de préventif', format: 'pct' },
  { cle: 'bons.delaiMoyenClotureHeures', groupe: 'Bons', label: 'Délai moyen de clôture', format: 'heures' },
  { cle: 'reclamations.recuesPeriode', groupe: 'Réclamations', label: 'Réclamations reçues', format: 'nombre', precedent: 'reclamations.recuesPeriodePrecedente' },
  { cle: 'reclamations.ouvertes', groupe: 'Réclamations', label: 'Réclamations nouvelles', format: 'nombre' },
  { cle: 'reclamations.enFile', groupe: 'Réclamations', label: 'Réclamations en file', format: 'nombre' },
  { cle: 'reclamations.enCours', groupe: 'Réclamations', label: 'Réclamations en cours', format: 'nombre' },
  { cle: 'reclamations.enAttenteValidation', groupe: 'Réclamations', label: 'Réclamations en attente de validation', format: 'nombre' },
  { cle: 'reclamations.nonAffectees', groupe: 'Réclamations', label: 'Réclamations non affectées', format: 'nombre' },
  { cle: 'reclamations.resolues', groupe: 'Réclamations', label: 'Réclamations résolues', format: 'nombre' },
  { cle: 'reclamations.delaiMoyenResolutionJours', groupe: 'Réclamations', label: 'Délai moyen de résolution', format: 'jours' },
  { cle: 'equipements.total', groupe: 'Équipements', label: 'Équipements suivis', format: 'nombre' },
  { cle: 'equipements.parEtat.EN_PANNE', groupe: 'Équipements', label: 'Équipements en panne', format: 'nombre' },
  { cle: 'equipements.parEtat.EN_REPARATION', groupe: 'Équipements', label: 'Équipements en réparation', format: 'nombre' },
  { cle: 'equipements.critiquesArretes', groupe: 'Équipements', label: 'Équipements critiques à l’arrêt', format: 'nombre' },
  { cle: 'disponibilite.pannes', groupe: 'Équipements', label: 'Pannes', format: 'nombre' },
  { cle: 'disponibilite.tauxMoyenPct', groupe: 'Équipements', label: 'Disponibilité moyenne', format: 'pct' },
  { cle: 'disponibilite.tauxCritiquesPct', groupe: 'Équipements', label: 'Disponibilité des équipements critiques', format: 'pct' },
  { cle: 'disponibilite.mtbfHeures', groupe: 'Équipements', label: 'MTBF', format: 'heures' },
  { cle: 'disponibilite.mttrHeures', groupe: 'Équipements', label: 'MTTR', format: 'heures' },
  { cle: 'alertes.ouvertes', groupe: 'Équipements', label: 'Alertes machines ouvertes', format: 'nombre' },
  { cle: 'alertes.critiquesOuvertes', groupe: 'Équipements', label: 'Alertes machines critiques', format: 'nombre' },
  { cle: 'renouvellement.remplacer', groupe: 'Équipements', label: 'Équipements à remplacer', format: 'nombre' },
  { cle: 'couts.total', groupe: 'Coûts', label: 'Coût total', format: 'dt', precedent: 'couts.totalPrecedent' },
  { cle: 'couts.mainOeuvre', groupe: 'Coûts', label: 'Coût main-d’œuvre', format: 'dt' },
  { cle: 'couts.pieces', groupe: 'Coûts', label: 'Coût des pièces', format: 'dt' },
  { cle: 'couts.achats', groupe: 'Coûts', label: 'Coût des achats', format: 'dt' },
  { cle: 'sla.respectReponsePct', groupe: 'SLA', label: 'Délais de réponse respectés', format: 'pct' },
  { cle: 'sla.respectResolutionPct', groupe: 'SLA', label: 'Délais de résolution respectés', format: 'pct' },
];

export const ICONES_CARTE = {
  cle: { label: 'Clé à molette', icone: Wrench },
  reclamation: { label: 'Réclamation', icone: MessageSquareWarning },
  alerte: { label: 'Alerte', icone: OctagonAlert },
  activite: { label: 'Activité', icone: Activity },
  horloge: { label: 'Horloge', icone: Timer },
  calendrier: { label: 'Calendrier', icone: CalendarClock },
  argent: { label: 'Coût', icone: CircleDollarSign },
  validation: { label: 'Validation', icone: ClipboardCheck },
  jauge: { label: 'Jauge', icone: Gauge },
  cloche: { label: 'Cloche', icone: BellRing },
  piece: { label: 'Pièce', icone: Package },
  tendance: { label: 'Tendance', icone: TrendingUp },
  nombre: { label: 'Nombre', icone: Hash },
};

export const PAGES_LIEN = [
  { value: '/bons-maintenance', label: 'Bons de maintenance' },
  { value: '/bons-maintenance?vue=a-traiter', label: 'Bons à traiter' },
  { value: '/reclamations', label: 'Réclamations' },
  { value: '/reclamations?vue=a-traiter', label: 'Réclamations à traiter' },
  { value: '/equipements', label: 'Équipements' },
  { value: '/disponibilite', label: 'Disponibilité' },
  { value: '/sla', label: 'SLA' },
  { value: '/cout', label: 'Coût' },
  { value: '/alertes-machines', label: 'Alertes machines' },
  { value: '/renouvellement', label: 'Plan de renouvellement' },
  { value: '/planning', label: 'Planning des bons' },
];

export const lireChemin = (donnees, chemin) => String(chemin || '').split('.').reduce((o, k) => (o == null ? undefined : o[k]), donnees);

const VERSION = 3;
export const PREFIXE_PERSO = 'perso:';

function parDefaut() {
  return { version: VERSION, stats: STATS.map((s) => s.id), connues: STATS.map((s) => s.id), persos: [], tailles: { stats: {}, cartes: {} } };
}

function nettoyer(brut) {
  if (!brut || brut.version !== VERSION) return parDefaut();
  const clesIndicateurs = new Set(INDICATEURS.map((i) => i.cle));
  const persos = (Array.isArray(brut.persos) ? brut.persos : []).filter((p) => p?.id?.startsWith(PREFIXE_PERSO) && clesIndicateurs.has(p.indicateur));
  const ids = new Set([...STATS.map((s) => s.id), ...persos.map((p) => p.id)]);
  const connues = new Set(Array.isArray(brut.connues) ? brut.connues : []);
  const stats = [...new Set((brut.stats || []).filter((id) => ids.has(id)))];
  STATS.forEach((s) => { if (!connues.has(s.id) && !stats.includes(s.id)) stats.push(s.id); });
  const brutes = brut.tailles || {};
  const tailles = {
    stats: Object.fromEntries(Object.entries(brutes.stats || {}).filter(([id, v]) => ids.has(id) && v === 'large')),
    cartes: Object.fromEntries(Object.entries(brutes.cartes || {}).filter(([id, v]) => CARTES.some((c) => c.id === id) && LARGEURS.includes(v))),
  };
  return { version: VERSION, stats, connues: STATS.map((s) => s.id), persos, tailles };
}

function lireDisposition(cle) {
  try {
    return nettoyer(JSON.parse(localStorage.getItem(cle) || 'null'));
  } catch {
    return parDefaut();
  }
}

export function deplacer(liste, source, cible) {
  if (source === cible || !liste.includes(source)) return liste;
  const sans = liste.filter((x) => x !== source);
  const index = sans.indexOf(cible);
  sans.splice(index < 0 ? sans.length : index, 0, source);
  return sans;
}

export function useDisposition(utilisateurId) {
  const cle = `gmao.tableau-de-bord.disposition.v${VERSION}.${utilisateurId ?? 'anonyme'}`;
  const [etat, setEtat] = useState(() => ({ cle, disposition: lireDisposition(cle) }));
  const disposition = etat.cle === cle ? etat.disposition : lireDisposition(cle);

  useEffect(() => {
    try { localStorage.setItem(cle, JSON.stringify(disposition)); } catch { /* stockage indisponible */ }
  }, [cle, disposition]);

  const modifier = useCallback((f) => {
    setEtat((e) => ({ cle, disposition: f(e.cle === cle ? e.disposition : lireDisposition(cle)) }));
  }, [cle]);

  const actions = useMemo(() => ({
    deplacerStat: (source, cible) => modifier((d) => ({ ...d, stats: deplacer(d.stats, source, cible) })),
    retirerStat: (id) => modifier((d) => ({ ...d, stats: d.stats.filter((x) => x !== id) })),
    ajouterStat: (id) => modifier((d) => (d.stats.includes(id) ? d : { ...d, stats: [...d.stats, id] })),
    placerStat: (id, index) => modifier((d) => {
      const sans = d.stats.filter((x) => x !== id);
      const i = Math.max(0, Math.min(index, sans.length));
      return { ...d, stats: [...sans.slice(0, i), id, ...sans.slice(i)] };
    }),
    definirTailleStat: (id, large) => modifier((d) => {
      const stats = { ...d.tailles.stats };
      if (large) stats[id] = 'large'; else delete stats[id];
      return { ...d, tailles: { ...d.tailles, stats } };
    }),
    definirLargeur: (id, largeur) => modifier((d) => (LARGEURS.includes(largeur)
      ? { ...d, tailles: { ...d.tailles, cartes: { ...d.tailles.cartes, [id]: largeur } } } : d)),
    reinitialiser: () => modifier((d) => ({ ...parDefaut(), persos: d.persos })),
    changerTailleStat: (id) => modifier((d) => {
      const stats = { ...d.tailles.stats };
      if (stats[id]) delete stats[id]; else stats[id] = 'large';
      return { ...d, tailles: { ...d.tailles, stats } };
    }),
    changerLargeur: (id) => modifier((d) => {
      const actuelle = d.tailles.cartes[id] || CARTES.find((c) => c.id === id)?.largeur || 'moitie';
      const suivante = LARGEURS[(LARGEURS.indexOf(actuelle) + 1) % LARGEURS.length];
      return { ...d, tailles: { ...d.tailles, cartes: { ...d.tailles.cartes, [id]: suivante } } };
    }),
    enregistrerPerso: (carte) => modifier((d) => {
      if (carte.id && d.persos.some((p) => p.id === carte.id)) {
        return { ...d, persos: d.persos.map((p) => (p.id === carte.id ? carte : p)) };
      }
      const id = `${PREFIXE_PERSO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      return { ...d, persos: [...d.persos, { ...carte, id }], stats: [...d.stats, id] };
    }),
    supprimerPerso: (id) => modifier((d) => ({ ...d, persos: d.persos.filter((p) => p.id !== id), stats: d.stats.filter((x) => x !== id) })),
  }), [modifier]);

  return [disposition, actions];
}
