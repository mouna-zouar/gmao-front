// Traçage du bon : journal vertical, regroupé par jour, mis à jour en direct.
// Même langage visuel que la page « parcours de réparation ».
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Loader2, Inbox, User, ChevronDown, Clock, RefreshCw, WifiOff,
  Megaphone, ClipboardList, Stethoscope, ListChecks, Wrench, ShieldCheck, Power, History,
  Radio, Pause,
} from 'lucide-react';

import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';

import { t, tp, locale } from '../../../i18n';
import './Tracage3DTab.css';

// ============================================================
// CONFIG
// ============================================================
const POLL_INTERVAL_MS = 8000;
const MAX_RETRIES = 3;

// Chaque type d'événement : une icône, un ton, et une famille pour les filtres
const TYPE_STYLES = {
  reclamation:  { label: 'Réclamation',       icon: Megaphone,     ton: 'now',   famille: 'debut' },
  bon:          { label: 'Bon créé',          icon: ClipboardList, ton: 'brand', famille: 'debut' },
  diagnostic:   { label: 'Diagnostic',        icon: Stethoscope,   ton: 'info',  famille: 'reparation' },
  tache:        { label: 'Tâche',             icon: ListChecks,    ton: 'violet', famille: 'reparation' },
  intervention: { label: 'Intervention',      icon: Wrench,        ton: 'violet', famille: 'reparation' },
  controle:     { label: 'Contrôle',          icon: ShieldCheck,   ton: 'ok',    famille: 'validation' },
  remise:       { label: 'Remise en service', icon: Power,         ton: 'ok',    famille: 'validation' },
  historique:   { label: 'Action',            icon: History,       ton: 'calme', famille: 'debut' },
};

const FAMILLES = [
  { key: 'tout', label: 'Tout' },
  { key: 'debut', label: 'Signalement' },
  { key: 'reparation', label: 'Réparation' },
  { key: 'validation', label: 'Validation' },
];

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const INTERVENANT_ETAT_LABELS = { 0: 'Nouveau', 1: 'En cours', 2: 'Terminé', 10: 'Annulé' };
const ETAT_IMMO_LABELS = { 1: 'Fonctionnel avec problème', 2: 'En panne', 3: 'À changer', 4: 'Hors service' };
const GRAVITE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

// ============================================================
// HELPERS
// ============================================================
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatHeure(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function libelleJour(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return t('Date inconnue');
  const aujourdHui = new Date();
  const debut = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((debut(aujourdHui) - debut(d)) / 86400000);
  if (ecart === 0) return t("Aujourd'hui");
  if (ecart === 1) return t('Hier');
  const txt = d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function cleJour(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'x' : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatMontant(v) {
  if (v == null) return null;
  return t('{montant} DT', { montant: Number(v).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

function nomComplet(p) {
  if (!p) return null;
  return `${p.nom || ''} ${p.prenom || ''}`.trim() || null;
}

function hashEtape(e) {
  return `${e.type}|${e.date}|${e.label}|${e.acteur || ''}`;
}

function dureeLisible(ms) {
  const h = ms / 3600000;
  if (h < 1) return t('{n} min', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t('{n} h', { n: h.toFixed(h < 10 ? 1 : 0).replace('.', ',') });
  return tp('jour', Math.round(h / 24));
}

// ============================================================
// CONSTRUCTION DES ÉTAPES
// Les détails vides ne sont pas affichés : on n'ajoute que ce qui est renseigné.
// ============================================================
function details(entries) {
  return entries.filter(([, v]) => v != null && v !== '' && v !== '—');
}

function construireEtapes({ bon, reclamations, historique, diagnostics, taches, intervenants, controles, remises }) {
  const raw = [];

  (reclamations ?? []).forEach((r) => raw.push({
    type: 'reclamation',
    date: r.date,
    label: t('Réclamation {num}', { num: r.num || `#${r.id}` }),
    summary: r.description || r.objet || t('Un problème a été signalé'),
    acteur: r.auteur || r.personnelNom,
    priorite: 1,
    details: details([
      ['Ce qui a été signalé', r.description || r.objet],
      ['Service', r.serviceNom || r.service?.description],
      ['Signalé par', r.auteur || r.personnelNom],
    ]),
  }));

  if (bon?.date) raw.push({
    type: 'bon',
    date: bon.date,
    label: t('Bon {num} créé', { num: bon.num || `#${bon.id}` }),
    summary: bon.titre || t('Le dossier de réparation est ouvert'),
    acteur: bon.personnelCreationNom,
    priorite: 2,
    details: details([
      ['Titre', bon.titre],
      ['Description', bon.description],
      ['Urgence', bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : null],
      ['Service', bon.serviceNom || bon.service?.description],
      ['Prestataire', bon.prestataire?.raisonSociale || bon.prestataire?.nom],
    ]),
  });

  (diagnostics ?? []).forEach((d) => raw.push({
    type: 'diagnostic',
    date: d.dateDiagnostic,
    label: t('Diagnostic réalisé'),
    summary: d.causeProbable || d.observations || t('La panne a été analysée'),
    acteur: d.personnelNom,
    priorite: 3,
    badge: d.gravite != null ? { texte: t('Gravité {niveau}', { niveau: t(GRAVITE_LABELS[d.gravite] || String(d.gravite)).toLowerCase() }), ton: d.gravite === 3 ? 'alert' : d.gravite === 2 ? 'now' : 'info' } : null,
    details: details([
      ['Cause probable', d.causeProbable],
      ['Temps estimé', d.dureeEstimeeHeures != null ? t('{n} h', { n: d.dureeEstimeeHeures }) : null],
      ['Pièce à changer', d.besoinPiece === true ? 'Oui' : d.besoinPiece === false ? 'Non' : null],
      ['Observations', d.observations],
    ]),
  }));

  (taches ?? []).forEach((tache) => raw.push({
    type: 'tache',
    date: tache.dateDebut || tache.dateDebutIntervention || bon?.date,
    label: tache.designation || t('Tâche #{id}', { id: tache.id }),
    summary: tache.nom || null,
    acteur: tache.intervenantNom,
    priorite: 4,
    badge: tache.etat != null ? { texte: ETAT_LABELS[tache.etat] || t('État {n}', { n: tache.etat }), ton: tache.etat === 4 ? 'ok' : tache.etat === 10 ? 'calme' : 'brand' } : null,
    details: details([
      ['Prévu', (tache.dateDebut || tache.dateFin) ? `${formatDateTime(tache.dateDebut)} → ${formatDateTime(tache.dateFin)}` : null],
      ['Réalisé', (tache.dateDebutIntervention || tache.dateFinIntervention) ? `${formatDateTime(tache.dateDebutIntervention)} → ${formatDateTime(tache.dateFinIntervention)}` : null],
      ['Quantité', tache.qte != null ? String(tache.qte) : null],
      ['Sous-traitant', tache.sousTraitant?.raisonSociale],
    ]),
  }));

  (intervenants ?? []).forEach((i) => {
    const nom = i.personnel
      ? nomComplet(i.personnel)
      : (i.sousTraitant?.raisonSociale || i.intervenantNom || t('Intervenant #{id}', { id: i.id }));
    raw.push({
      type: 'intervention',
      date: i.dateDebutIntervention || bon?.date,
      label: t('{nom} intervient', { nom }),
      summary: i.commentaire || (i.personnelId ? t('Technicien de l’équipe') : i.sousTraitantId ? t('Sous-traitant') : null),
      acteur: nom,
      priorite: 5,
      badge: i.etat != null ? { texte: INTERVENANT_ETAT_LABELS[i.etat] || t('État {n}', { n: i.etat }), ton: i.etat === 2 ? 'ok' : i.etat === 10 ? 'calme' : 'brand' } : null,
      details: details([
        ['Début', i.dateDebutIntervention ? formatDateTime(i.dateDebutIntervention) : null],
        ['Fin', i.dateFinIntervention ? formatDateTime(i.dateFinIntervention) : null],
        ['Heures', i.nbrHeure != null ? t('{n} h', { n: i.nbrHeure }) : null],
        ['Coût', formatMontant(i.coutTotal)],
        ['Commentaire', i.commentaire],
      ]),
    });
  });

  (controles ?? []).forEach((c) => raw.push({
    type: 'controle',
    date: c.dateControle,
    label: c.typeControle ? t('Contrôle {type}', { type: t(c.typeControle).toLowerCase() }) : t('Contrôle réalisé'),
    summary: c.resultat || null,
    acteur: c.personnelNom,
    priorite: 6,
    badge: c.conforme == null ? null : { texte: c.conforme ? 'Conforme' : 'Non conforme', ton: c.conforme ? 'ok' : 'alert' },
    details: details([
      ['Valeur mesurée', c.valeurMesuree != null ? String(c.valeurMesuree) : null],
      ['Valeur attendue', c.valeurAttendue != null ? String(c.valeurAttendue) : null],
      ['Résultat', c.resultat],
      ['Observations', c.observations],
    ]),
  }));

  (remises ?? []).forEach((r) => raw.push({
    type: 'remise',
    date: r.date,
    label: r.conforme ? t('Remise en service autorisée') : t('Remise en service refusée'),
    summary: r.observations || null,
    acteur: r.autoriseParNom,
    priorite: 7,
    badge: { texte: r.conforme ? 'Autorisée' : 'Refusée', ton: r.conforme ? 'ok' : 'alert' },
    details: details([
      ['État avant', r.etatAvant != null ? ETAT_IMMO_LABELS[r.etatAvant] : null],
      ['État après', r.etatApres != null ? ETAT_IMMO_LABELS[r.etatApres] : null],
      ['Observations', r.observations],
    ]),
  }));

  if (raw.length === 0) {
    (historique ?? []).forEach((h) => raw.push({
      type: 'historique',
      date: h.date,
      label: t(h.action || 'Action'),
      summary: h.description || null,
      acteur: h.personnelCreationNom,
      priorite: 99,
      details: details([['Description', h.description]]),
    }));
  }

  return raw
    .filter((e) => e.date)
    .sort((a, b) => {
      const dt = new Date(a.date) - new Date(b.date);
      if (dt !== 0) return dt;
      return (a.priorite ?? 50) - (b.priorite ?? 50);
    })
    .map((e, i) => ({
      id: `e${i}-${hashEtape(e)}`,
      index: i,
      ...e,
      style: TYPE_STYLES[e.type] || TYPE_STYLES.historique,
    }));
}

// Nombre qui monte de 0 à sa valeur (≈ 0,8 s), sauf si l'utilisateur réduit les animations
function useCompteur(cible) {
  const [valeur, setValeur] = useState(0);
  const precedent = useRef(0);
  useEffect(() => {
    const depart = precedent.current;
    precedent.current = cible;
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit || depart === cible) {
      setValeur(cible);
      return undefined;
    }
    const debut = performance.now();
    const duree = 800;
    let raf;
    const pas = (tache) => {
      const p = Math.min((tache - debut) / duree, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValeur(Math.round(depart + (cible - depart) * ease));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible]);
  return valeur;
}

// Petit tracé de moniteur cardiaque qui défile tant que le direct est actif
const PoulsDirect = ({ actif }) => (
  <svg className={`trx-pouls ${actif ? 'is-actif' : ''}`} viewBox="0 0 120 24" aria-hidden="true">
    <path
      d="M0 12 H30 L36 12 L40 4 L46 20 L52 2 L57 16 L61 12 H90 L96 12 L100 4 L106 20 L112 2 L117 16 L120 12"
      pathLength="1"
    />
  </svg>
);

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function TracageTab({ bon, reclamations: reclamationsProp = [] }) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(null);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newStepIds, setNewStepIds] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [famille, setFamille] = useState('tout');
  const [ordreRecent, setOrdreRecent] = useState(false);
  // Entrée en cascade : seulement au premier affichage et quand on change de filtre
  const [cascade, setCascade] = useState(true);
  const [pulsation, setPulsation] = useState(0);

  const listeRef = useRef(null);
  const previousHashRef = useRef(new Set());
  const retryCountRef = useRef(0);

  // ---------- Chargement ----------
  const fetchAll = useCallback(async (silent = false) => {
    if (!bon?.id) return;
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const [historique, diagnostics, taches, intervenants, controles, remises] = await Promise.all([
        bonMaintenanceHistoriqueService.findByBonMaintenanceId(bon.id).catch(() => []),
        bonMaintenanceDiagnosticService.getByBonMaintenance(bon.id).catch(() => []),
        bonMaintenanceTacheService.getByBonMaintenance(bon.id).catch(() => []),
        bonMaintenanceIntervenantService.getByBonMaintenance(bon.id).catch(() => []),
        bonMaintenanceControleEquipementService.getByBonMaintenance(bon.id).catch(() => []),
        bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bon.id).catch(() => []),
      ]);
      setRaw({
        historique: historique ?? [],
        diagnostics: diagnostics ?? [],
        taches: taches ?? [],
        intervenants: intervenants ?? [],
        controles: controles ?? [],
        remises: remises ?? [],
        reclamations: reclamationsProp ?? [],
      });
      setLastUpdate(new Date());
      retryCountRef.current = 0;
    } catch (err) {
      console.error('Erreur fetch traçage :', err);
      retryCountRef.current += 1;
      if (retryCountRef.current >= MAX_RETRIES) {
        setError(t("La connexion au serveur est perdue. Vérifiez le réseau puis réessayez."));
        setIsLive(false);
      }
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  }, [bon?.id, reclamationsProp]);

  useEffect(() => {
    if (!bon?.id) {
      setLoading(false);
      return;
    }
    fetchAll(false);
  }, [bon?.id, fetchAll]);

  // ---------- Mise à jour en direct ----------
  useEffect(() => {
    if (!isLive || !bon?.id) return undefined;
    const interval = setInterval(() => fetchAll(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive, bon?.id, fetchAll]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setIsLive(false);
      else if (bon?.id) {
        setIsLive(true);
        fetchAll(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [bon?.id, fetchAll]);

  // ---------- Étapes ----------
  const etapes = useMemo(() => (raw ? construireEtapes({ bon, ...raw }) : []), [bon, raw]);

  const compteParFamille = useMemo(() => {
    const c = { tout: etapes.length };
    etapes.forEach((e) => { c[e.style.famille] = (c[e.style.famille] || 0) + 1; });
    return c;
  }, [etapes]);

  const visibles = useMemo(() => {
    const f = famille === 'tout' ? etapes : etapes.filter((e) => e.style.famille === famille);
    return ordreRecent ? [...f].reverse() : f;
  }, [etapes, famille, ordreRecent]);

  // Regroupement par jour
  const jours = useMemo(() => {
    const groupes = [];
    visibles.forEach((e) => {
      const k = cleJour(e.date);
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.cle === k) dernier.etapes.push(e);
      else groupes.push({ cle: k, libelle: libelleJour(e.date), etapes: [e] });
    });
    return groupes;
  }, [visibles]);

  const resume = useMemo(() => {
    if (etapes.length === 0) return null;
    const dates = etapes.map((e) => new Date(e.date).getTime());
    const acteurs = new Set(etapes.map((e) => e.acteur).filter(Boolean));
    return {
      total: etapes.length,
      duree: dureeLisible(Math.max(...dates) - Math.min(...dates)),
      personnes: acteurs.size,
    };
  }, [etapes]);

  // ---------- Nouvelles étapes : on les ouvre et on les montre ----------
  useEffect(() => {
    if (etapes.length === 0) return undefined;
    const currentHashes = new Set(etapes.map((e) => e.id));
    const previousHashes = previousHashRef.current;
    let timer;
    if (previousHashes.size > 0) {
      const nouveaux = etapes.filter((e) => !previousHashes.has(e.id)).map((e) => e.id);
      if (nouveaux.length > 0) {
        setNewStepIds(nouveaux);
        setFamille('tout');
        timer = setTimeout(() => setNewStepIds([]), 4000);
        const dernier = nouveaux[nouveaux.length - 1];
        setOuverts((prev) => new Set(prev).add(dernier));
        requestAnimationFrame(() => {
          listeRef.current?.querySelector(`[data-step-id="${CSS.escape(dernier)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }
    previousHashRef.current = currentHashes;
    return () => clearTimeout(timer);
  }, [etapes]);

  useEffect(() => {
    setCascade(true);
    const tache = setTimeout(() => setCascade(false), 1400);
    return () => clearTimeout(tache);
  }, [famille, ordreRecent]);

  // Une petite pulsation à chaque actualisation réussie
  useEffect(() => { if (lastUpdate) setPulsation((n) => n + 1); }, [lastUpdate]);

  const nbEvenements = useCompteur(resume?.total ?? 0);
  const nbPersonnes = useCompteur(resume?.personnes ?? 0);

  const basculer = (id) => {
    setOuverts((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toutOuvrir = () => {
    setOuverts((prev) => (prev.size >= visibles.length ? new Set() : new Set(visibles.map((e) => e.id))));
  };

  // ---------- Rendu ----------
  if (loading) {
    return (
      <div className="trx-etat">
        <Loader2 size={30} className="trx-tourne" />
        <p>{t("Chargement du journal…")}</p>
      </div>
    );
  }

  if (etapes.length === 0) {
    return (
      <div className="trx-etat">
        <Inbox size={30} />
        <p>{t("Rien n’a encore été enregistré sur ce bon. Chaque action apparaîtra ici automatiquement.")}</p>
      </div>
    );
  }

  return (
    <div className="trx">
      {/* ===== Résumé en une phrase + direct ===== */}
      <section className={`trx-entete ${refreshing ? 'is-actualise' : ''}`}>
        <p className="trx-phrase">
          <strong className="trx-chiffre">{tp('événement', nbEvenements)}</strong>
          {' '}{t('sur')} <strong>{resume.duree}</strong>
          {resume.personnes > 0 && <>{t(', avec')} <strong className="trx-chiffre">{tp('personne', nbPersonnes)}</strong></>}{t('.')}
        </p>

        <div className="trx-direct">
          <button
            type="button"
            className={`trx-direct-btn ${isLive ? 'is-on' : ''}`}
            onClick={() => setIsLive((v) => !v)}
            aria-pressed={isLive}
          >
            {isLive ? <Radio size={16} /> : <Pause size={16} />}
            {isLive ? t("Mise à jour automatique") : t("Mise à jour en pause")}
            <PoulsDirect actif={isLive} />
          </button>
          <button
            type="button"
            className="trx-rafraichir"
            onClick={() => fetchAll(false)}
            disabled={refreshing}
            aria-label={t("Actualiser maintenant")}
            title={t("Actualiser maintenant")}
          >
            <RefreshCw size={16} className={refreshing ? 'trx-tourne' : ''} />
          </button>
          {lastUpdate && (
            <span className="trx-maj" key={pulsation}>
              {t('Actualisé à {heure}', { heure: lastUpdate.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
        </div>
      </section>

      {error && (
        <div className="trx-erreur" role="alert">
          <WifiOff size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => { setIsLive(true); fetchAll(false); }}>{t("Réessayer")}</button>
        </div>
      )}

      {/* ===== Filtres ===== */}
      <div className="trx-outils">
        <div className="trx-filtres" role="tablist" aria-label={t("Filtrer le journal")}>
          {FAMILLES.filter((f) => f.key === 'tout' || compteParFamille[f.key]).map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={famille === f.key}
              className={`trx-filtre ${famille === f.key ? 'is-actif' : ''}`}
              onClick={() => setFamille(f.key)}
            >
              {t(f.label)}
              <span>{compteParFamille[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="trx-outils-droite">
          <button type="button" className="trx-lien" onClick={() => setOrdreRecent((v) => !v)}>
            {ordreRecent ? t("Du plus ancien au plus récent") : t("Du plus récent au plus ancien")}
          </button>
          <button type="button" className="trx-lien" onClick={toutOuvrir}>
            {ouverts.size >= visibles.length ? t("Tout replier") : t("Tout déplier")}
          </button>
        </div>
      </div>

      {/* ===== Journal ===== */}
      <div
        className={`trx-journal ${refreshing ? 'is-actualise' : ''} ${cascade ? 'is-cascade' : ''}`}
        ref={listeRef}
        key={`${famille}-${ordreRecent}`}
      >
        {jours.map((jour, ji) => (
          <section key={jour.cle} className="trx-jour" aria-label={jour.libelle} style={{ '--j': ji }}>
            <h3 className="trx-jour-titre">{jour.libelle}</h3>
            <ol className="trx-liste">
              {jour.etapes.map((e, ei) => {
                const Icon = e.style.icon;
                const ouvert = ouverts.has(e.id);
                const nouveau = newStepIds.includes(e.id);
                const aDesDetails = e.details.length > 0;
                return (
                  <li
                    key={e.id}
                    data-step-id={e.id}
                    className={`trx-evt trx-ton--${e.style.ton} ${ouvert ? 'is-ouvert' : ''} ${nouveau ? 'is-nouveau' : ''}`}
                    style={{ '--i': Math.min(visibles.indexOf(e), 14), '--ei': ei }}
                  >
                    <span className="trx-evt-heure">{formatHeure(e.date)}</span>
                    <span className="trx-evt-point" aria-hidden="true"><Icon size={17} /></span>

                    <div className="trx-evt-carte">
                      <button
                        type="button"
                        className="trx-evt-tete"
                        onClick={() => aDesDetails && basculer(e.id)}
                        aria-expanded={aDesDetails ? ouvert : undefined}
                        disabled={!aDesDetails}
                      >
                        <span className="trx-evt-textes">
                          <span className="trx-evt-type">
                            {t(e.style.label)}
                            {nouveau && <span className="trx-nouveau">{t("Nouveau")}</span>}
                          </span>
                          <span className="trx-evt-titre">{t(e.label)}</span>
                          {e.summary && <span className="trx-evt-resume">{e.summary}</span>}
                          {e.acteur && (
                            <span className="trx-evt-acteur"><User size={13} /> {e.acteur}</span>
                          )}
                        </span>
                        {e.badge && <span className={`trx-badge trx-ton--${e.badge.ton}`}>{t(e.badge.texte)}</span>}
                        {aDesDetails && <ChevronDown size={18} className="trx-evt-chevron" />}
                      </button>

                      {ouvert && aDesDetails && (
                        <dl className="trx-evt-details">
                          {e.details.map(([k, v], di) => (
                            <div key={k} style={{ '--d': di }}>
                              <dt>{t(k)}</dt>
                              <dd>{typeof v === 'string' ? t(v) : v}</dd>
                            </div>
                          ))}
                          <div>
                            <dt>{t("Date exacte")}</dt>
                            <dd>{formatDateTime(e.date)}</dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {isLive && (
          <p className="trx-attente">
            <span className="trx-attente-point" aria-hidden="true" />
            <Clock size={15} /> {t("Les prochaines actions s’ajouteront ici toutes seules.")}
          </p>
        )}
      </div>
    </div>
  );
}