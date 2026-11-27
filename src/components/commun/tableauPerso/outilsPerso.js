/*
 * Moteur des tableaux de bord personnalisables (général, bons, réclamations).
 * Constantes partagées + fabrique du hook useDisposition pour un « profil » (catalogue de cartes).
 * Pas de composant ici (règle react-refresh) : les composants sont dans BlocsPerso.jsx, GalerieCartes.jsx, ModaleCarteChiffree.jsx.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t, locale } from '../../../i18n';
import {
  Activity, BellRing, Building2, CalendarClock, CircleCheck, CircleDollarSign, ClipboardCheck, Cpu, FileText, Gauge, Hammer, Hash,
  HeartPulse, MessageSquareWarning, OctagonAlert, Package, Pipette, Plug, Settings, ShieldCheck, Stethoscope, Thermometer, Timer,
  TrendingUp, TriangleAlert, Truck, UserRound, Users, Wrench, Zap,
} from 'lucide-react';

export const LARGEURS = ['tiers', 'moitie', 'deux-tiers', 'pleine'];
export const LIBELLE_LARGEUR = { tiers: '1/3', moitie: '1/2', 'deux-tiers': '2/3', pleine: '1/1' };

export const ICONES_CARTE = {
  cle: { label: 'Clé à molette', icone: Wrench },
  marteau: { label: 'Marteau', icone: Hammer },
  reglage: { label: 'Réglages', icone: Settings },
  reclamation: { label: 'Réclamation', icone: MessageSquareWarning },
  alerte: { label: 'Alerte', icone: OctagonAlert },
  attention: { label: 'Attention', icone: TriangleAlert },
  cloche: { label: 'Cloche', icone: BellRing },
  equipement: { label: 'Équipement', icone: Cpu },
  medical: { label: 'Médical', icone: Stethoscope },
  pouls: { label: 'Pouls', icone: HeartPulse },
  thermometre: { label: 'Thermomètre', icone: Thermometer },
  pipette: { label: 'Pipette', icone: Pipette },
  energie: { label: 'Énergie', icone: Zap },
  prise: { label: 'Prise', icone: Plug },
  horloge: { label: 'Horloge', icone: Timer },
  calendrier: { label: 'Calendrier', icone: CalendarClock },
  argent: { label: 'Coût', icone: CircleDollarSign },
  piece: { label: 'Pièce', icone: Package },
  camion: { label: 'Livraison', icone: Truck },
  validation: { label: 'Validation', icone: ClipboardCheck },
  termine: { label: 'Terminé', icone: CircleCheck },
  bouclier: { label: 'Sécurité', icone: ShieldCheck },
  jauge: { label: 'Jauge', icone: Gauge },
  tendance: { label: 'Tendance', icone: TrendingUp },
  activite: { label: 'Activité', icone: Activity },
  document: { label: 'Document', icone: FileText },
  personne: { label: 'Personne', icone: UserRound },
  equipe: { label: 'Équipe', icone: Users },
  batiment: { label: 'Bâtiment', icone: Building2 },
  nombre: { label: 'Nombre', icone: Hash },
};

export const COULEURS_TONS = {
  teal: { label: 'Turquoise', hex: '#0794a4' },
  bleu: { label: 'Bleu Parc', hex: '#287da8' },
  violet: { label: 'Bleu nuit', hex: '#2e3f5a' },
  vert: { label: 'Succès', hex: '#1f9d74' },
  ambre: { label: 'Attention', hex: '#e8962e' },
  orange: { label: 'Ocre', hex: '#b8701a' },
  rouge: { label: 'Alerte', hex: '#d9434b' },
  neutre: { label: 'Gris', hex: '#64748b' },
};

export const STYLE_PAR_GROUPE = {
  Bons: { icone: 'cle', teinte: 'teal' },
  Réclamations: { icone: 'reclamation', teinte: 'orange' },
  Équipements: { icone: 'equipement', teinte: 'bleu' },
  Coûts: { icone: 'argent', teinte: 'vert' },
  SLA: { icone: 'horloge', teinte: 'violet' },
};

export function couleurHex(texte) {
  const s = String(texte || '').trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3})$/);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  m = s.match(/^#?([0-9a-f]{6})$/);
  if (m) return `#${m[1]}`;
  m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (m && m.slice(1, 4).every((x) => Number(x) <= 255)) {
    return `#${m.slice(1, 4).map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

export function variablesCouleur(hex) {
  const h = couleurHex(hex);
  if (!h) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return { '--c': h, '--c-fond': `rgba(${r}, ${g}, ${b}, 0.12)`, '--c-bord': `rgba(${r}, ${g}, ${b}, 0.28)` };
}

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

export const PREFIXE_PERSO = 'perso:';

export function deplacer(liste, source, cible) {
  if (source === cible || !liste.includes(source)) return liste;
  const sans = liste.filter((x) => x !== source);
  const index = sans.indexOf(cible);
  sans.splice(index < 0 ? sans.length : index, 0, source);
  return sans;
}

/* ---------- Formats communs ---------- */
export const nb = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));
export const pct = (v) => (v == null ? '—' : `${nb(v, v >= 99.5 && v < 100 ? 1 : 0)} %`);
export const dt = (v, court = false) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (court && Math.abs(n) >= 1e6) return `⁦${(n / 1e6).toLocaleString(locale(), { maximumFractionDigits: 2 })} M DT⁩`;
  if (court && Math.abs(n) >= 1000) return `⁦${(n / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} k DT⁩`;
  return `⁦${n.toLocaleString(locale(), { maximumFractionDigits: 0 })} DT⁩`;
};
export const heures = (h) => {
  if (h == null) return '—';
  if (h < 1) return t('{n} min', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t('{n} h', { n: nb(h, 1) });
  return t('{n} j', { n: nb(h / 24, 1) });
};
export const joursFmt = (v) => (v == null ? '—' : t('{n} j', { n: nb(v, 1) }));
export function evolution(actuel, precedent) {
  if (actuel == null || precedent == null || precedent === 0) return null;
  const v = ((actuel - precedent) / precedent) * 100;
  return `⁦${v > 0 ? '+' : ''}${nb(v)} %⁩`;
}
const FORMATS = { pct, heures, jours: joursFmt, dt: (v) => dt(v, true), montant: (v) => dt(v, true) };
export const formater = (format, v) => (FORMATS[format] || nb)(v);

/**
 * Fabrique le hook de disposition d'un tableau de bord.
 * profil : { prefixe: 'gmao.tableau-bons', version: 1, stats: [{id, titre, defaut?}], cartes: [{id,largeur}], indicateurs: [{cle,...}] }
 * Une carte chiffrée avec defaut: false reste dans la galerie tant que l'utilisateur ne l'ajoute pas.
 * Clé enregistrée : `${prefixe}.disposition.v${version}.${utilisateur}`.
 */
export function creerDisposition({ prefixe, version, stats: STATS, cartes: CARTES, indicateurs: INDICATEURS }) {
  const VERSION = version;
  function parDefaut() {
    return { version: VERSION, stats: STATS.filter((s) => s.defaut !== false).map((s) => s.id), connues: STATS.map((s) => s.id), persos: [], tailles: { stats: {}, cartes: {} } };
  }

  function nettoyer(brut) {
    if (!brut || brut.version !== VERSION) return parDefaut();
    const clesIndicateurs = new Set(INDICATEURS.map((i) => i.cle));
    const persos = (Array.isArray(brut.persos) ? brut.persos : [])
      .filter((p) => p?.id?.startsWith(PREFIXE_PERSO) && clesIndicateurs.has(p.indicateur))
      .map((p) => ({ ...p, couleur: couleurHex(p.couleur) }));
    const ids = new Set([...STATS.map((s) => s.id), ...persos.map((p) => p.id)]);
    const connues = new Set(Array.isArray(brut.connues) ? brut.connues : []);
    const stats = [...new Set((brut.stats || []).filter((id) => ids.has(id)))];
    STATS.forEach((s) => { if (s.defaut !== false && !connues.has(s.id) && !stats.includes(s.id)) stats.push(s.id); });
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

  function useDisposition(utilisateurId) {
    const cle = `${prefixe}.disposition.v${VERSION}.${utilisateurId ?? 'anonyme'}`;
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

  return useDisposition;
}

/* ---------- Chargement d'une page de tableau de bord ---------- */
export const PERIODES = [
  { cle: 7, label: '7 j' },
  { cle: 30, label: '30 j' },
  { cle: 90, label: '90 j' },
  { cle: 365, label: '12 mois' },
];

const lirePeriode = (cle) => {
  try {
    const v = Number(localStorage.getItem(cle));
    return PERIODES.some((p) => p.cle === v) ? v : 30;
  } catch { return 30; }
};

/** Charge les données d'un tableau de bord ; rafraîchit toutes les 5 minutes si l'onglet est visible. */
export function useTableauPerso(charge, clePeriode) {
  const [jours, setJoursBrut] = useState(() => lirePeriode(clePeriode));
  const [lieuId, setLieuId] = useState('');
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [majLe, setMajLe] = useState(null);
  const enCours = useRef(false);

  const setJours = (v) => {
    setJoursBrut(v);
    try { localStorage.setItem(clePeriode, String(v)); } catch { /* stockage indisponible */ }
  };

  const charger = useCallback(async (recalculer = false) => {
    if (enCours.current) return;
    enCours.current = true;
    setChargement(true);
    try {
      setDonnees(await charge(jours, recalculer, lieuId || null));
      setErreur(null);
      setMajLe(Date.now());
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le tableau de bord. Vérifie que le serveur est lancé.'));
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, [charge, jours, lieuId]);

  useEffect(() => {
    const id = setTimeout(() => charger(), 0);
    return () => clearTimeout(id);
  }, [charger]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) charger(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [charger]);

  return { jours, setJours, lieuId, setLieuId, donnees, chargement, erreur, majLe, charger };
}

