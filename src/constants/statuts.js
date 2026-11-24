import {
  Activity, Ban, CheckCircle2, CircleDot, CirclePause, Clock, Hourglass, OctagonAlert, Scale,
  SignalHigh, SignalLow, SignalMedium, Wrench, XCircle,
} from 'lucide-react';

export const TONS = {
  info:      { texte: '#2c5fb8', fond: '#e6eefb', bord: '#c4d5f5', couleur: '#2c5fb8' },
  action:    { texte: '#05606b', fond: '#e3f3f5', bord: '#b4e0e5', couleur: '#0794a4' },
  attention: { texte: '#97570e', fond: '#fdf1e1', bord: '#f6d5a8', couleur: '#e8962e' },
  ok:        { texte: '#157553', fond: '#e2f5ee', bord: '#b3e3d1', couleur: '#1f9d74' },
  alerte:    { texte: '#b8323a', fond: '#fde8e9', bord: '#f6c2c5', couleur: '#d9434b' },
  neutre:    { texte: '#4b6670', fond: '#e8eef0', bord: '#d0dcdf', couleur: '#7f969d' },
};

const s = (libelle, ton, Icone) => ({ libelle, ton, Icone });

export const STATUTS = {
  bon: {
    1: s('Nouveau', 'info', CircleDot),
    2: s('Suspendu', 'attention', CirclePause),
    3: s('En cours', 'action', Activity),
    4: s('Effectué', 'ok', CheckCircle2),
    10: s('Annulé', 'neutre', XCircle),
  },
  reclamation: {
    0: s('Nouveau', 'info', CircleDot),
    5: s('En file', 'attention', Hourglass),
    1: s('En cours', 'action', Activity),
    3: s('Résolue', 'ok', CheckCircle2),
    2: s('Clôturée', 'ok', CheckCircle2),
    4: s('Annulée', 'neutre', XCircle),
  },
  intervenant: {
    0: s('Nouveau', 'info', CircleDot),
    1: s('En cours', 'action', Activity),
    2: s('Terminé', 'ok', CheckCircle2),
    10: s('Annulé', 'neutre', XCircle),
  },
  equipement: {
    EN_SERVICE: s('En service', 'ok', CheckCircle2),
    EN_PANNE: s('En panne', 'alerte', OctagonAlert),
    EN_REPARATION: s('En réparation', 'action', Wrench),
    HORS_SERVICE: s('Hors service', 'neutre', Ban),
  },
  amende: {
    0: s('À payer', 'attention', Clock),
    1: s('Contestée', 'info', Scale),
    2: s('Payée', 'ok', CheckCircle2),
    3: s('Annulée', 'neutre', XCircle),
  },
  niveau: {
    1: s('Faible', 'neutre', SignalLow),
    2: s('Moyenne', 'attention', SignalMedium),
    3: s('Élevée', 'alerte', SignalHigh),
  },
};
STATUTS.tache = STATUTS.bon;

export function statut(type, valeur) {
  const def = STATUTS[type]?.[valeur];
  if (def) return def;
  if (valeur == null || valeur === '') return { libelle: '—', ton: 'neutre', Icone: CircleDot, inconnu: true };
  return { libelle: 'État {n}', params: { n: valeur }, ton: 'neutre', Icone: CircleDot, inconnu: true };
}

export function optionsStatut(type) {
  const entrees = Object.entries(STATUTS[type] || {});
  const ordre = ORDRE[type];
  if (ordre) entrees.sort(([a], [b]) => ordre.indexOf(Number(a)) - ordre.indexOf(Number(b)));
  return entrees.map(([valeur, def]) => ({
    valeur: /^\d+$/.test(valeur) ? Number(valeur) : valeur,
    ...def,
  }));
}

const ORDRE = {
  reclamation: [0, 5, 1, 3, 2, 4],
};

export const ACTIFS = {
  bon: [1, 2, 3],
  tache: [1, 2, 3],
  reclamation: [0, 5, 1, 3],
  intervenant: [0, 1],
  amende: [0, 1],
};
