import {
  Activity, Ban, CheckCircle2, CircleDot, CirclePause, Clock, Hourglass, OctagonAlert, Scale,
  SignalHigh, SignalLow, SignalMedium, Wrench, XCircle,
} from 'lucide-react';

/*
 * Statuts de la GMAO : UNE couleur et UNE icône par signification, sur tous les écrans.
 *
 *   même sens  →  même ton  →  même couleur
 *   « Nouveau » d'un bon et « Ouverte » d'une réclamation   → info      (bleu)
 *   « En cours » partout, équipement « En réparation »       → action    (teal GMAO)
 *   « Suspendu », « En attente… », « À payer »               → attention (orange)
 *   « Effectué », « Clôturée », « Terminé », « Payée »…      → ok        (vert)
 *   équipement « En panne », urgence élevée                  → alerte    (rouge)
 *   « Annulé », « Rejetée », « Hors service »                → neutre    (gris)
 *
 * Pour afficher un statut : <BadgeStatut type="bon" valeur={3} />  (components/ui/BadgeStatut)
 * Pour une couleur (graphique, barre) : TONS[statut('bon', 3).ton].couleur
 */

/* Couleurs des tons. `texte` sur `fond` : contraste ≥ 4,5:1 (lisible en petit). */
export const TONS = {
  info:      { texte: '#2c5fb8', fond: '#e6eefb', bord: '#c4d5f5', couleur: '#2c5fb8' },
  action:    { texte: '#05606b', fond: '#e3f3f5', bord: '#b4e0e5', couleur: '#0794a4' },
  attention: { texte: '#97570e', fond: '#fdf1e1', bord: '#f6d5a8', couleur: '#e8962e' },
  ok:        { texte: '#157553', fond: '#e2f5ee', bord: '#b3e3d1', couleur: '#1f9d74' },
  alerte:    { texte: '#b8323a', fond: '#fde8e9', bord: '#f6c2c5', couleur: '#d9434b' },
  neutre:    { texte: '#4b6670', fond: '#e8eef0', bord: '#d0dcdf', couleur: '#7f969d' },
};

/* Définition d'un statut : libellé (clé française, traduite à l'affichage), ton, icône. */
const s = (libelle, ton, Icone) => ({ libelle, ton, Icone });

export const STATUTS = {
  // BonMaintenance.etat (et BonMaintenanceTache.etat, mêmes codes)
  bon: {
    1: s('Nouveau', 'info', CircleDot),
    2: s('Suspendu', 'attention', CirclePause),
    3: s('En cours', 'action', Activity),
    4: s('Effectué', 'ok', CheckCircle2),
    10: s('Annulé', 'neutre', XCircle),
  },
  // Reclamation.etat
  reclamation: {
    0: s('Ouverte', 'info', CircleDot),
    1: s('En cours', 'action', Activity),
    2: s('Clôturée', 'ok', CheckCircle2),

  },
  // BonMaintenanceIntervenant.etat
  intervenant: {
    0: s('Nouveau', 'info', CircleDot),
    1: s('En cours', 'action', Activity),
    2: s('Terminé', 'ok', CheckCircle2),
    10: s('Annulé', 'neutre', XCircle),
  },
  // EtatEquipement.etatActuel
  equipement: {
    EN_SERVICE: s('En service', 'ok', CheckCircle2),
    EN_PANNE: s('En panne', 'alerte', OctagonAlert),
    EN_REPARATION: s('En réparation', 'action', Wrench),
    HORS_SERVICE: s('Hors service', 'neutre', Ban),
  },
  // VehiculeAmende.statut
  amende: {
    0: s('À payer', 'attention', Clock),
    1: s('Contestée', 'info', Scale),
    2: s('Payée', 'ok', CheckCircle2),
    3: s('Annulée', 'neutre', XCircle),
  },
  // Urgence, criticité, gravité (1 à 3)
  niveau: {
    1: s('Faible', 'neutre', SignalLow),
    2: s('Moyenne', 'attention', SignalMedium),
    3: s('Élevée', 'alerte', SignalHigh),
  },
};
STATUTS.tache = STATUTS.bon;

/** Statut connu, ou un statut neutre « État n » pour une valeur imprévue (jamais d'erreur). */
export function statut(type, valeur) {
  const def = STATUTS[type]?.[valeur];
  if (def) return def;
  if (valeur == null || valeur === '') return { libelle: '—', ton: 'neutre', Icone: CircleDot, inconnu: true };
  return { libelle: 'État {n}', params: { n: valeur }, ton: 'neutre', Icone: CircleDot, inconnu: true };
}

/** Liste ordonnée des statuts d'un type (filtres, légendes) : [{ valeur, libelle, ton, Icone }] */
export function optionsStatut(type) {
  return Object.entries(STATUTS[type] || {}).map(([valeur, def]) => ({
    valeur: /^\d+$/.test(valeur) ? Number(valeur) : valeur,
    ...def,
  }));
}

/** Statuts « à traiter » (ni terminés ni annulés), par type */
export const ACTIFS = {
  bon: [1, 2, 3],
  tache: [1, 2, 3],
  reclamation: [0, 1, 3],
  intervenant: [0, 1],
  amende: [0, 1],
};
