import { useEffect, useMemo, useState, cloneElement, Fragment } from 'react';
import { Save, RotateCcw, Play, CheckCircle2, AlertTriangle, Wrench, Building2, LoaderCircle, Search, Languages, CalendarClock, Activity, CirclePause, Timer, CarFront, Boxes, RefreshCw, Settings2, X, Undo2, Tags, Printer, Gauge, Loader2, Plus, Pencil, Power, ClipboardCheck, Trash2, ArrowUp, ArrowDown, Eye, ArrowLeft, ChevronRight } from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';
import parametreService from '../../../services/parametreService';
import prestataireService from '../../../services/prestataireService';
import authService from '../../../services/Authservice';
import EquipementMaintenanceTypesSettings from '../Etatequipement/EquipementMaintenanceTypesSettings';
import { useNavigate, useSearchParams } from 'react-router-dom';
import maintenanceConditionnelleService from '../../../services/maintenanceConditionnelleService';
import { ETATS_REGLE, MODES, fmt } from '../Equipements/EquipementMaintenanceConditionnelle';
import codePanneService from '../../../services/codePanneService';
import reclamationService from '../../../services/Reclamationservice';
import ReglageLangue from '../../../i18n/ReglageLangue';
import { t, locale } from '../../../i18n';
import './ParametresSysteme.css';

/** Pour les paramètres « planif.<code>.heure » : code du traitement exécutable à la main. */
function codeTache(cle) {
  const m = /^planif\.([a-z_]+)\.heure$/.exec(cle);
  return m ? m[1] : null;
}

const nomPrestataire = (p) => (p ? (p.raisonSociale || `${p.nom || ''} ${p.prenom || ''}`.trim() || null) : null);

/** ID d'un prestataire Cubix : saisie de l'ID, nom affiché dessous, raccourci « Ma clinique ». */
function ChampPrestataire({ param, valeur, onChange }) {
  const id = Number(valeur) || 0;
  const [etat, setEtat] = useState({ statut: 'vide' });
  const contexte = authService.getContexteMetier();
  const monId = Number(contexte.prestataireId) || 0;

  useEffect(() => {
    if (id <= 0) { setEtat({ statut: 'vide' }); return undefined; }
    let annule = false;
    setEtat({ statut: 'chargement' });
    const minuterie = setTimeout(() => {
      prestataireService.getById(id)
        .then((p) => { if (!annule) setEtat({ statut: 'ok', nom: nomPrestataire(p) || t('Prestataire #{id}', { id }) }); })
        .catch(() => { if (!annule) setEtat({ statut: 'introuvable' }); });
    }, 400);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [id]);

  return (
    <div className="ps-presta">
      <div className="ps-presta-ligne">
        <input
          id={`ps-${param.cle}`}
          type="number"
          step="1"
          min={0}
          value={valeur ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`ps-${param.cle}-nom`}
        />
        {monId > 0 && monId !== id && (
          <button type="button" className="ps-action" onClick={() => onChange(String(monId))} title={t('Utiliser le prestataire de ma session')}>
            <Building2 size={13} /> {contexte.prestataireNom || t('Ma clinique')}
          </button>
        )}
      </div>
      <p id={`ps-${param.cle}-nom`} className={`ps-presta-nom ps-presta-nom--${etat.statut}`}>
        {etat.statut === 'chargement' && <><LoaderCircle size={13} className="ps-tourne" /> {t('Recherche dans Cubix…')}</>}
        {etat.statut === 'ok' && <><CheckCircle2 size={13} /> {etat.nom}</>}
        {etat.statut === 'introuvable' && <><AlertTriangle size={13} /> {t('Aucun prestataire avec cet ID dans Cubix.')}</>}
        {etat.statut === 'vide' && t('0 : prestataire de la session Cubix, sinon tous les prestataires (liste très longue).')}
      </p>
    </div>
  );
}

/** Familles d'articles Cubix à suivre : liste à cocher avec le nombre d'immobilisations de chacune. */
function ChampFamilles({ param, valeur, onChange, prestataireId }) {
  const [familles, setFamilles] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('');
  const choisies = useMemo(() => new Set(String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean)), [valeur]);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) { setFamilles([]); setErreur(t('Impossible de lire les familles dans Cubix.')); } });
    return () => { annule = true; };
  }, [prestataireId]);

  const basculer = (id) => {
    const n = new Set(choisies);
    const cle = String(id);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    onChange([...n].join(','));
  };

  const liste = (familles || []).filter((f) => !filtre.trim()
    || `${f.nom || ''} ${f.code || ''}`.toLowerCase().includes(filtre.trim().toLowerCase()));
  const total = (familles || []).reduce((s, f) => s + f.nombre, 0);
  const totalChoisi = (familles || []).filter((f) => choisies.has(String(f.id))).reduce((s, f) => s + f.nombre, 0);
  const fmt = (n) => n.toLocaleString(locale());

  return (
    <div className="ps-familles">
      <div className="ps-familles-tete">
        <span className="ps-familles-resume">
          {choisies.size === 0
            ? t('Toutes les familles : {n} équipements', { n: fmt(total) })
            : t('{f} famille(s) cochée(s) : {n} équipements sur {total}', { f: choisies.size, n: fmt(totalChoisi), total: fmt(total) })}
        </span>
        {choisies.size > 0 && (
          <button type="button" className="ps-action" onClick={() => onChange('')}>{t('Tout décocher')}</button>
        )}
      </div>
      <label className="ps-familles-recherche">
        <Search size={14} aria-hidden="true" />
        <input type="text" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille…')} />
      </label>
      {familles === null ? (
        <p className="ps-presta-nom"><LoaderCircle size={13} className="ps-tourne" /> {t('Recherche dans Cubix…')}</p>
      ) : erreur ? (
        <p className="ps-presta-nom ps-presta-nom--introuvable"><AlertTriangle size={13} /> {erreur}</p>
      ) : (
        <ul className="ps-familles-liste" id={`ps-${param.cle}`}>
          {liste.map((f) => (
            <li key={f.id}>
              <label className={choisies.has(String(f.id)) ? 'is-coche' : ''}>
                <input type="checkbox" checked={choisies.has(String(f.id))} onChange={() => basculer(f.id)} />
                <span className="ps-familles-nom">{f.nom || t('Sans famille')}</span>
                <span className="ps-familles-n">{fmt(f.nombre)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampValeur({ param, valeur, onChange, draft }) {
  const common = { id: `ps-${param.cle}`, value: valeur ?? '' };

  switch (param.type) {
    case 'PRESTATAIRE':
      return <ChampPrestataire param={param} valeur={valeur} onChange={onChange} />;
    case 'FAMILLES':
      return <ChampFamilles param={param} valeur={valeur} onChange={onChange} prestataireId={draft?.['cubix.prestataire_id']} />;
    case 'BOOLEEN':
      return (
        <label className="ps-switch">
          <input
            type="checkbox"
            checked={valeur === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          />
          <span className="ps-switch-track" />
          <span className="ps-switch-label">{valeur === 'true' ? t("Oui") : t("Non")}</span>
        </label>
      );
    case 'HEURE':
      return <input {...common} type="time" onChange={(e) => onChange(e.target.value)} />;
    case 'ENTIER':
      return (
        <input
          {...common}
          type="number"
          step="1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'DECIMAL':
      return (
        <input
          {...common}
          type="number"
          step="0.1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />;
  }
}

/* ────────────────────────────────────────────────────────────
 * Structure de la page : un accueil en tuiles (une tuile par rubrique, rangées par section) ;
 * un clic ouvre la rubrique en plein écran (?r=<rubrique>, le bouton Retour du navigateur revient à l'accueil).
 * Chaque réglage est une carte « libellé + explication + valeur ».
 * ──────────────────────────────────────────────────────────── */

/** Rubriques connues (nom du groupe côté serveur → présentation). Les groupes inconnus s'ajoutent à la fin. */
const RUBRIQUES = [
  { id: 'general', section: 'Application', titre: 'Général', aide: 'Langue de l’application sur cet ordinateur.', Icone: Languages },
  { id: 'planif', section: 'Automatisation', groupe: 'Planification des traitements', titre: 'Traitements automatiques', aide: 'Quand les analyses et les alertes tournent toutes seules.', Icone: CalendarClock },
  { id: 'preventif', section: 'Automatisation', titre: 'Maintenance préventive', aide: 'Déclenchement des bons préventifs et types de maintenance réglementaire.', Icone: Wrench },
  { id: 'codes_panne', section: 'Réclamations', titre: 'Codes panne', aide: 'Codes proposés par l’IA pendant la saisie des réclamations.', Icone: Tags },
  { id: 'checklists', section: 'Réclamations', titre: 'Check-lists des réclamations', aide: 'Vérifications que le demandeur fait avant d’envoyer une réclamation, selon la famille de l’équipement.', Icone: ClipboardCheck },
  { id: 'lecture', section: 'Réclamations', groupe: 'Lu / non lu (notifications)', titre: 'Lu / non lu', aide: 'Notifications de lecture et délais avant rappel ou alerte pour les réclamations et bons non lus.', Icone: Eye },
  { id: 'sla', section: 'Automatisation', groupe: 'SLA (délais en heures)', titre: 'Délais SLA', aide: 'Délais de réponse et de résolution selon la priorité du bon.', Icone: Timer },
  { id: 'anomalies', section: 'Automatisation', groupe: "Détection d'anomalies", titre: 'Détection d’anomalies', aide: 'Quand un pic de réclamations est signalé.', Icone: Activity },
  { id: 'blocages', section: 'Automatisation', groupe: 'Détection de blocages', titre: 'Détection de blocages', aide: 'Quand un équipement à l’arrêt est signalé.', Icone: CirclePause },
  { id: 'parc', section: 'Automatisation', groupe: "Alertes d'échéance du Parc", titre: 'Alertes du Parc', aide: 'Assurance, visite technique, vignette et vidange des véhicules.', Icone: CarFront },
  { id: 'cubix_immo', section: 'Cubix', groupe: 'Cubix — équipements lus', titre: 'Équipements lus dans Cubix', aide: 'Prestataire et familles d’articles que la GMAO suit.', Icone: Boxes },
  { id: 'cubix_etat', section: 'Cubix', groupe: 'Synchronisation Cubix (état des équipements)', titre: 'État envoyé à Cubix', aide: 'Codes EtatFonc écrits dans Cubix au fil des pannes.', Icone: RefreshCw },
  { id: 'impression', section: 'Application', groupe: 'En-tête des impressions', titre: 'En-tête des impressions', aide: 'Société, adresse, matricule fiscal et téléphone imprimés en haut des demandes et commandes.', Icone: Printer },
];

const CLE_RUBRIQUE = 'gmao.parametres.rubrique';

/** Groupes du menu de gauche, dans cet ordre ; les rubriques inconnues vont dans « Autres réglages ». */
const SECTIONS_MENU = ['Application', 'Automatisation', 'Réclamations', 'Cubix', 'Autres réglages'];
/** Couleur des tuiles de chaque section */
const TON_SECTION = { Application: 'indigo', Automatisation: 'teal', Réclamations: 'ambre', Cubix: 'violet', 'Autres réglages': 'ardoise' };

/** « planif.anomalies.heure » → { code: 'anomalies', champ: 'heure' } */
function partiesTache(cle) {
  const m = /^planif\.([a-z_]+)\.(actif|heure|intervalle)$/.exec(cle);
  return m ? { code: m[1], champ: m[2] } : null;
}

/** « P1 Immédiate — délai de réponse » → « P1 Immédiate » */
const avantTiret = (texte) => String(texte || '').split(' — ')[0];

const correspondRecherche = (p, mots) => {
  if (mots.length === 0) return true;
  const texte = `${t(p.libelle)} ${p.libelle} ${t(p.description || '')} ${p.cle}`.toLowerCase();
  return mots.every((m) => texte.includes(m));
};

export default function ParametresSysteme() {
  const [params, setParams] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningCode, setRunningCode] = useState(null);
  const [message, setMessage] = useState(null);
  const [recherche, setRecherche] = useState('');
  // Rubrique ouverte dans l'URL (?r=sla) : null = accueil en tuiles
  const [searchParams, setSearchParams] = useSearchParams();
  const rubrique = searchParams.get('r');

  const choisirRubrique = (id) => {
    setRecherche('');
    setSearchParams(id ? { r: id } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { if (id) localStorage.setItem(CLE_RUBRIQUE, id); } catch { /* stockage indisponible */ }
  };

  const apply = (list) => {
    setParams(list);
    setDraft(Object.fromEntries(list.map((p) => [p.cle, p.valeur])));
  };

  const load = async () => {
    setLoading(true);
    try {
      apply(await parametreService.getAll());
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: t('Impossible de charger les paramètres. Vérifie que le serveur est lancé.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const estModifie = (p) => draft[p.cle] !== p.valeur;
  const dirtyKeys = useMemo(() => params.filter(estModifie).map((p) => p.cle), [params, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paramètres de chaque rubrique (la maintenance préventive reprend ses deux réglages de planification)
  const parRubrique = useMemo(() => {
    const m = new Map(RUBRIQUES.map((r) => [r.id, []]));
    const inconnues = new Map();
    params.forEach((p) => {
      const r = RUBRIQUES.find((x) => x.groupe === p.groupe);
      if (r) m.get(r.id).push(p);
      else {
        if (!inconnues.has(p.groupe)) inconnues.set(p.groupe, []);
        inconnues.get(p.groupe).push(p);
      }
      if (p.cle.startsWith('planif.equipement_echeances.') || p.cle.startsWith('planif.maintenance_conditionnelle.')) m.get('preventif').push(p);
    });
    const autres = [...inconnues.entries()].map(([groupe, items], i) => ({
      id: `autre_${i}`, section: 'Autres réglages', groupe, titre: groupe, aide: '', Icone: Settings2, items,
    }));
    return { m, autres };
  }, [params]);

  const rubriques = useMemo(() => [
    ...RUBRIQUES.map((r) => ({ ...r, items: parRubrique.m.get(r.id) || [] }))
      .filter((r) => r.id === 'general' || r.id === 'preventif' || r.id === 'codes_panne' || r.id === 'checklists' || r.items.length > 0),
    ...parRubrique.autres,
  ], [parRubrique]);

  const rubriqueActive = rubrique ? rubriques.find((r) => r.id === rubrique) || null : null;

  const setValue = (cle, valeur) => {
    setMessage(null);
    setDraft((prev) => ({ ...prev, [cle]: valeur }));
  };
  const reinitialiser = (liste) => liste.forEach((p) => setValue(p.cle, p.valeurDefaut));

  const handleSave = async () => {
    if (dirtyKeys.length === 0 || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(dirtyKeys.map((k) => [k, String(draft[k] ?? '')]));
      const saved = await parametreService.saveMany(payload);
      const parCle = new Map(saved.map((p) => [p.cle, p]));
      apply(params.map((p) => parCle.get(p.cle) ?? p));
      setMessage({ type: 'success', text: t('{n} paramètre(s) enregistré(s). Les nouveaux horaires sont appliqués immédiatement.', { n: saved.length }) });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || t("Échec de l'enregistrement.") });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(Object.fromEntries(params.map((p) => [p.cle, p.valeur])));
    setMessage(null);
  };

  const handleExecuter = async (code) => {
    setRunningCode(code);
    setMessage(null);
    try {
      await parametreService.executerTache(code);
      setMessage({ type: 'success', text: t('Traitement exécuté avec les paramètres enregistrés.') });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || t("Échec de l'exécution du traitement.") });
    } finally {
      setRunningCode(null);
    }
  };

  /* ─── Morceaux d'affichage ─── */

  const BoutonDefaut = ({ liste }) => {
    const auDefaut = liste.every((p) => draft[p.cle] === p.valeurDefaut);
    if (auDefaut) return null;
    return (
      <button
        type="button"
        className="ps-icone-btn"
        onClick={() => reinitialiser(liste)}
        title={liste.length === 1 ? t('Valeur par défaut : {valeur}', { valeur: liste[0].valeurDefaut || '—' }) : t('Revenir aux valeurs par défaut')}
        aria-label={t('Revenir aux valeurs par défaut')}
      >
        <RotateCcw size={14} />
      </button>
    );
  };

  const Badge = ({ liste }) => (liste.some(estModifie) ? <span className="ps-badge">{t('modifié')}</span> : null);

  /** Ligne d'un réglage simple. */
  const ligneParametre = (p) => {
    const bloc = p.type === 'FAMILLES';
    const large = bloc || p.type === 'PRESTATAIRE' || p.type === 'TEXTE';
    return (
      <div key={p.cle} className={`ps-reglage ${estModifie(p) ? 'is-modifie' : ''} ${large ? 'ps-reglage--large' : ''} ${p.type === 'BOOLEEN' ? 'ps-reglage--bascule' : ''}`}>
        <div className="ps-reglage-tete">
          <label htmlFor={`ps-${p.cle}`} className="ps-reglage-titre">{t(p.libelle)}</label>
          <Badge liste={[p]} />
          <BoutonDefaut liste={[p]} />
        </div>
        {p.description && <p className="ps-reglage-aide">{t(p.description)}</p>}
        <div className="ps-reglage-valeur ps-pcard-control">
          <ChampValeur param={p} valeur={draft[p.cle]} onChange={(v) => setValue(p.cle, v)} draft={draft} />
          {p.unite && <span className="ps-unit">{t(p.unite)}</span>}
        </div>
      </div>
    );
  };

  /** Traitements planifiés : « activé + heure (ou fréquence) + Exécuter » sur une seule ligne. */
  const lignesTaches = (items) => {
    const taches = new Map();
    const reste = [];
    items.forEach((p) => {
      const pt = partiesTache(p.cle);
      if (!pt) { reste.push(p); return; }
      if (!taches.has(pt.code)) taches.set(pt.code, {});
      taches.get(pt.code)[pt.champ] = p;
    });
    return (
      <>
        {reste.map(ligneParametre)}
        {[...taches.entries()].map(([code, tache]) => {
          const liste = [tache.actif, tache.heure, tache.intervalle].filter(Boolean);
          const ref = tache.actif || liste[0];
          const actif = !tache.actif || draft[tache.actif.cle] === 'true';
          const reglage = tache.heure || tache.intervalle;
          const titre = t(ref.libelle).replace(/\s—\s.*$/, '');
          const executable = Boolean(tache.heure && codeTache(tache.heure.cle));
          return (
            <div key={code} className={`ps-reglage ps-reglage--tache ${liste.some(estModifie) ? 'is-modifie' : ''} ${actif ? '' : 'is-eteint'}`}>
              <div className="ps-reglage-tete">
                <span className="ps-reglage-titre">{titre}</span>
                <Badge liste={liste} />
              </div>
              {ref.description && <p className="ps-reglage-aide">{t(ref.description)}</p>}
              <div className="ps-reglage-valeur ps-reglage-valeur--tache">
                {tache.actif && (
                  <ChampValeur param={tache.actif} valeur={draft[tache.actif.cle]} onChange={(v) => setValue(tache.actif.cle, v)} draft={draft} />
                )}
                {reglage && (
                  <div className={`ps-pcard-control ps-tache-reglage ${actif ? '' : 'is-desactive'}`}>
                    <span className="ps-tache-etiquette">{tache.heure ? t('à') : t('toutes les')}</span>
                    <ChampValeur param={reglage} valeur={draft[reglage.cle]} onChange={(v) => setValue(reglage.cle, v)} draft={draft} />
                    {reglage.unite && <span className="ps-unit">{t(reglage.unite)}</span>}
                  </div>
                )}
                {executable && (
                  <button
                    type="button"
                    className="ps-action ps-action--run"
                    title={t('Exécuter maintenant (avec les paramètres enregistrés)')}
                    disabled={runningCode === code}
                    onClick={() => handleExecuter(code)}
                  >
                    {runningCode === code ? <LoaderCircle size={13} className="ps-tourne" /> : <Play size={13} />}
                    {t('Exécuter')}
                  </button>
                )}
                <BoutonDefaut liste={liste} />
              </div>
            </div>
          );
        })}
      </>
    );
  };

  /** SLA : tableau priorité × (réponse, résolution). */
  const tableauSla = (items) => {
    const lignes = new Map();
    const reste = [];
    items.forEach((p) => {
      const m = /^sla\.(p\d)\.(reponse|resolution)$/.exec(p.cle);
      if (!m) { reste.push(p); return; }
      if (!lignes.has(m[1])) lignes.set(m[1], {});
      lignes.get(m[1])[m[2]] = p;
    });
    const cellule = (p) => (p ? (
      <div className={`ps-pcard-control ps-sla-cellule ${estModifie(p) ? 'is-modifie' : ''}`}>
        <ChampValeur param={p} valeur={draft[p.cle]} onChange={(v) => setValue(p.cle, v)} draft={draft} />
        <span className="ps-unit">h</span>
      </div>
    ) : null);
    return (
      <>
        {lignes.size > 0 && (
          <div className="ps-sla">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('Priorité')}</th>
                  <th scope="col">{t('Délai de réponse')}<small>{t('création → début de l’intervention')}</small></th>
                  <th scope="col">{t('Délai de résolution')}<small>{t('création → clôture du bon')}</small></th>
                  <th scope="col"><span className="ps-sr">{t('Défaut')}</span></th>
                </tr>
              </thead>
              <tbody>
                {[...lignes.entries()].map(([code, l]) => {
                  const liste = [l.reponse, l.resolution].filter(Boolean);
                  const libellePriorite = avantTiret((l.reponse || l.resolution).libelle);
                  return (
                    <tr key={code} className={liste.some(estModifie) ? 'is-modifie' : ''}>
                      <th scope="row">
                        <span className={`ps-prio ps-prio--${code}`}>{code.toUpperCase()}</span>
                        {t(libellePriorite.replace(/^P\d\s*/, ''))}
                      </th>
                      <td>{cellule(l.reponse)}</td>
                      <td>{cellule(l.resolution)}</td>
                      <td><BoutonDefaut liste={liste} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {reste.length > 0 && <div className="ps-grille">{reste.map(ligneParametre)}</div>}
      </>
    );
  };

  const contenuRubrique = (r) => {
    if (r.id === 'general') {
      return (
        <ReglageLangue
          avantChangement={() => dirtyKeys.length === 0
            || window.confirm(t('Des modifications ne sont pas enregistrées et seront perdues. Changer de langue quand même ?'))}
        />
      );
    }
    if (r.id === 'preventif') {
      return (
        <>
          {r.items.length > 0 && (
            <div className="ps-carte ps-carte--transparente">
              <h3 className="ps-carte-titre">{t('Déclenchement automatique')}</h3>
              <div className="ps-grille">{lignesTaches(r.items)}</div>
            </div>
          )}
          <div className="ps-carte ps-carte--libre">
            <EquipementMaintenanceTypesSettings />
          </div>
          <div className="ps-carte">
            <ReglesConditionnellesVue />
          </div>
        </>
      );
    }
    if (r.id === 'codes_panne') return <div className="ps-carte"><CodesPanneVue prestataireId={draft['cubix.prestataire_id']} /></div>;
    if (r.id === 'checklists') return <div className="ps-carte"><ChecklistsReclamationVue prestataireId={draft['cubix.prestataire_id']} /></div>;
    if (r.id === 'sla') return <div className="ps-carte">{tableauSla(r.items)}</div>;
    if (r.id === 'planif') return <div className="ps-grille">{lignesTaches(r.items)}</div>;
    return <div className="ps-grille">{r.items.map(ligneParametre)}</div>;
  };

  /* ─── Recherche dans tous les réglages ─── */
  const mots = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const resultats = mots.length === 0 ? [] : rubriques
    .filter((r) => r.id !== 'general')
    .map((r) => ({ ...r, trouves: r.items.filter((p) => correspondRecherche(p, mots)) }))
    .filter((r) => r.trouves.length > 0)
    // la préventive reprend des réglages de planification : pas de doublon dans les résultats
    .filter((r, i, tab) => r.id !== 'preventif' || !tab.some((x) => x.id === 'planif'));

  const nbModifies = (r) => r.items.filter(estModifie).length;

  /** Petite ligne d'état sous le titre de chaque tuile */
  const resumeTuile = (r) => {
    if (r.id === 'general') return t('Langue de l’application');
    if (r.id === 'codes_panne' || r.id === 'checklists') return t('Liste à gérer');
    if (r.id === 'preventif') return t('Types, règles et déclenchement');
    if (r.id === 'planif') {
      const actifs = r.items.filter((p) => /\.actif$/.test(p.cle));
      return t('{a} sur {n} traitement(s) activé(s)', { a: actifs.filter((p) => draft[p.cle] === 'true').length, n: actifs.length });
    }
    const bascules = r.items.filter((p) => p.type === 'BOOLEEN');
    if (bascules.length === 1 && draft[bascules[0].cle] !== 'true') return t('Désactivé');
    return t('{n} réglage(s)', { n: r.items.length });
  };

  const enTeteRubrique = (r) => {
    const ton = TON_SECTION[r.section] || 'ardoise';
    return (
      <header className={`ps-detail-tete ps-ton--${ton}`}>
        <button type="button" className="ps-retour" onClick={() => choisirRubrique(null)}>
          <ArrowLeft size={16} aria-hidden="true" /> {t('Paramètres')}
        </button>
        <div className="ps-detail-titre">
          <span className="ps-detail-icone"><r.Icone size={22} aria-hidden="true" /></span>
          <div className="ps-detail-texte">
            <span className="ps-detail-section">{t(r.section || 'Autres réglages')}</span>
            <h2 id="ps-rubrique-titre">{t(r.titre)}</h2>
            {r.aide && <p>{t(r.aide)}</p>}
          </div>
          {r.items.length > 0 && r.id !== 'preventif' && r.items.some((p) => draft[p.cle] !== p.valeurDefaut) && (
            <button type="button" className="ps-action" onClick={() => reinitialiser(r.items)}>
              <Undo2 size={13} /> {t('Valeurs par défaut')}
            </button>
          )}
        </div>
      </header>
    );
  };

  const accueil = () => (
    <div className="ps-accueil">
      {SECTIONS_MENU.map((section) => {
        const liste = rubriques.filter((r) => (r.section || 'Autres réglages') === section);
        if (liste.length === 0) return null;
        const ton = TON_SECTION[section] || 'ardoise';
        return (
          <section key={section} className={`ps-section ps-ton--${ton}`} aria-label={t(section)}>
            <h2 className="ps-section-titre"><span className="ps-section-point" aria-hidden="true" />{t(section)}</h2>
            <div className="ps-tuiles">
              {liste.map((r) => {
                const n = nbModifies(r);
                return (
                  <button key={r.id} type="button" className={`ps-tuile ${n > 0 ? 'is-modifie' : ''}`} onClick={() => choisirRubrique(r.id)}>
                    <span className="ps-tuile-icone"><r.Icone size={20} aria-hidden="true" /></span>
                    <span className="ps-tuile-texte">
                      <span className="ps-tuile-titre">{t(r.titre)}</span>
                      <span className="ps-tuile-resume">{resumeTuile(r)}</span>
                    </span>
                    {n > 0
                      ? <span className="ps-tuile-point" title={t('{n} modification(s) non enregistrée(s)', { n })}>{n}</span>
                      : <ChevronRight size={16} className="ps-tuile-fleche" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="ps-page">
      <header className="ps-entete">
        <div className="ps-entete-titre">
          <span className="ps-entete-icone"><ICONES_MODULES.parametresSysteme size={22} /></span>
          <div>
            <h1>{t('Paramètres système')}</h1>
            <p>{t('{n} rubriques · {m} réglages', { n: rubriques.length, m: params.length })}</p>
          </div>
        </div>
        <label className="ps-recherche">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher un réglage…')}
            aria-label={t('Rechercher un réglage…')}
          />
          {recherche && (
            <button type="button" className="ps-icone-btn" onClick={() => setRecherche('')} aria-label={t('Effacer')}>
              <X size={14} />
            </button>
          )}
        </label>
      </header>

      {message && (
        <div className={`ps-banner ps-banner--${message.type}`} role="status">
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
          <button type="button" className="ps-icone-btn" onClick={() => setMessage(null)} aria-label={t('Fermer')}><X size={14} /></button>
        </div>
      )}

      <main className="ps-contenu">
        {loading ? (
          <div className="ps-vide"><LoaderCircle size={20} className="ps-tourne" /> {t('Chargement...')}</div>
        ) : mots.length > 0 ? (
          resultats.length === 0 ? (
            <div className="ps-vide">{t('Aucun réglage ne correspond à « {texte} ».', { texte: recherche.trim() })}</div>
          ) : (
            resultats.map((r) => (
              <section key={r.id} className={`ps-resultat ps-ton--${TON_SECTION[r.section] || 'ardoise'}`}>
                <header className="ps-resultat-tete">
                  <span className="ps-tuile-icone"><r.Icone size={16} aria-hidden="true" /></span>
                  <h2>{t(r.titre)}</h2>
                  <button type="button" className="ps-lien" onClick={() => choisirRubrique(r.id)}>{t('Ouvrir la rubrique')} <ChevronRight size={14} /></button>
                </header>
                <div className="ps-grille">{r.trouves.map(ligneParametre)}</div>
              </section>
            ))
          )
        ) : rubriqueActive ? (
          <section className="ps-detail" aria-labelledby="ps-rubrique-titre">
            {enTeteRubrique(rubriqueActive)}
            {contenuRubrique(rubriqueActive)}
          </section>
        ) : accueil()}
      </main>

      {dirtyKeys.length > 0 && (
        <div className="ps-savebar" role="region" aria-label={t('Modifications non enregistrées')}>
          <span className="ps-savebar-texte">
            <span className="ps-savebar-point" aria-hidden="true" />
            {t('{n} modification(s) non enregistrée(s)', { n: dirtyKeys.length })}
          </span>
          <div className="ps-savebar-actions">
            <button type="button" className="ps-btn ps-btn--ghost" onClick={handleCancel} disabled={saving}>
              {t('Annuler')}
            </button>
            <button type="button" className="ps-btn ps-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? <LoaderCircle size={16} className="ps-tourne" /> : <Save size={16} />}
              {saving ? t('Enregistrement...') : t('Enregistrer')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Règles de maintenance conditionnelle   (ancien fichier ReglesConditionnellesVue.jsx)
// ═════════════════════════════════════════════════════════════
/** Vue d'ensemble des règles de maintenance conditionnelle (elles se créent dans la fiche de chaque équipement). */
function ReglesConditionnellesVue() {
  const navigate = useNavigate();
  const [regles, setRegles] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => {
    setErreur('');
    maintenanceConditionnelleService.regles()
      .then(setRegles)
      .catch(() => { setRegles([]); setErreur(t('Impossible de charger les règles.')); });
  };
  useEffect(charger, []);

  const quand = (iso) => (iso ? new Date(iso).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <Gauge size={15} aria-hidden="true" /> {t('Règles de maintenance conditionnelle')}
        <button type="button" className="ps-icone-btn" onClick={charger} title={t('Rafraîchir')} aria-label={t('Rafraîchir')}>
          <RefreshCw size={15} />
        </button>
      </h3>
      <p className="ps-mc-aide">{t('Bons préventifs créés selon l’état réel des équipements (seuil, tendance ou compteur d’une sonde). Elles se créent dans la fiche de chaque équipement, bloc « Maintenance conditionnelle ».')}</p>
      {regles === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : regles.length === 0 ? (
        <p className="ps-mc-vide">{erreur || t('Aucune règle pour l’instant.')}</p>
      ) : (
        <div className="ps-mc-defile">
          <table className="ps-mc-table">
            <thead>
              <tr>
                <th>{t('Équipement')}</th>
                <th>{t('Règle')}</th>
                <th>{t('État')}</th>
                <th>{t('Valeur')}</th>
                <th>{t('Vérifiée')}</th>
              </tr>
            </thead>
            <tbody>
              {regles.map((r) => {
                const e = ETATS_REGLE[r.dernierEtat] || { ton: 'info', label: 'Pas encore évaluée' };
                return (
                  <tr key={r.id}>
                    <td>
                      <button type="button" className="ps-lien" onClick={() => navigate(`/equipement/${r.lotArticleImmobilistationId}`)}>
                        {r.equipementNom || `#${r.lotArticleImmobilistationId}`}
                      </button>
                    </td>
                    <td>
                      <strong>{r.libelle}</strong>
                      <small>{t(MODES.find((m) => m.value === r.mode)?.label || r.mode)} · {r.resume}</small>
                    </td>
                    <td>
                      <span className={`ps-mc-etat ps-mc-ton--${e.ton}`}>{t(e.label)}</span>
                      {r.bonEnCoursId && (
                        <button type="button" className="ps-lien ps-mc-bon" onClick={() => navigate(`/bons-maintenance?id=${r.bonEnCoursId}`)}>
                          {t('Bon n° {n}', { n: r.bonEnCoursNum })}
                        </button>
                      )}
                    </td>
                    <td className="ps-mc-num">
                      {r.derniereValeur != null ? `${fmt(r.derniereValeur)} ${r.unite || ''}` : '—'}
                      {r.progression != null && <small>{Math.round(r.progression * 100)} %</small>}
                    </td>
                    <td className="ps-mc-num">{quand(r.derniereEvaluation)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Codes panne   (ancien fichier CodesPanneVue.jsx)
// ═════════════════════════════════════════════════════════════
const VIDE = { id: null, code: '', libelle: '', categorie: '', motsCles: '', familles: '', actif: true };

const messageErreur = (e) => {
  const d = e?.response?.data;
  if (typeof d === 'string' && d.trim()) return d;
  return d?.message || d?.error || t('Enregistrement impossible.');
};

/** Catalogue des codes panne : proposés par l'IA pendant la saisie d'une réclamation. */
/** Choix des familles d'un code panne, en pastilles (aucune = toutes les familles). valeur : « 7,12 ». */
function ChoixFamillesCode({ familles, valeur, onChange }) {
  const choisies = new Set(String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean));
  const basculer = (id) => {
    const n = new Set(choisies);
    if (n.has(String(id))) n.delete(String(id)); else n.add(String(id));
    onChange([...n].join(','));
  };
  return (
    <div className="ps-cp-familles" role="group" aria-label={t('Familles')}>
      <span className="ps-cp-familles-titre">{t('Familles concernées')} :</span>
      <button type="button" className={`ps-cp-puce ${choisies.size === 0 ? 'is-choisie' : ''}`} aria-pressed={choisies.size === 0} onClick={() => onChange('')}>
        {t('Toutes les familles')}
      </button>
      {(familles || []).map((f) => (
        <button key={f.id} type="button" className={`ps-cp-puce ${choisies.has(String(f.id)) ? 'is-choisie' : ''}`}
          aria-pressed={choisies.has(String(f.id))} onClick={() => basculer(f.id)}>
          {f.nom || f.code}
        </button>
      ))}
    </div>
  );
}

function CodesPanneVue({ prestataireId }) {
  const [familles, setFamilles] = useState([]);
  useEffect(() => {
    let annule = false;
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) setFamilles([]); });
    return () => { annule = true; };
  }, [prestataireId]);
  const nomsFamilles = (valeur) => {
    const ids = String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0) return t('Toutes');
    return ids.map((id) => familles.find((f) => String(f.id) === id)?.nom || `#${id}`).join(', ');
  };
  const [codes, setCodes] = useState(null);
  const [edition, setEdition] = useState(null); // VIDE (nouveau) ou une copie du code modifié
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [inactifs, setInactifs] = useState(false);

  const charger = () => {
    setErreur('');
    codePanneService.liste(true)
      .then(setCodes)
      .catch(() => { setCodes([]); setErreur(t('Impossible de charger les codes panne.')); });
  };
  useEffect(charger, []);

  const visibles = useMemo(() => (codes || []).filter((c) => inactifs || c.actif), [codes, inactifs]);
  const nbInactifs = (codes || []).filter((c) => !c.actif).length;
  const categories = useMemo(() => [...new Set((codes || []).map((c) => c.categorie).filter(Boolean))].sort(), [codes]);

  const enregistrer = async (c) => {
    setOccupe(true);
    setErreur('');
    try {
      await codePanneService.enregistrer(c);
      setEdition(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const basculer = async (c) => {
    setOccupe(true);
    setErreur('');
    try {
      if (c.actif) await codePanneService.desactiver(c.id);
      else await codePanneService.enregistrer({ ...c, actif: true });
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const champ = (nom, props = {}) => (
    <input
      className="ps-cp-input"
      value={edition?.[nom] ?? ''}
      onChange={(e) => setEdition((x) => ({ ...x, [nom]: e.target.value }))}
      {...props}
    />
  );

  const ligneEdition = (
    <Fragment>
    <tr className="ps-cp-edition">
      <td>{champ('code', { placeholder: 'ELEC-ALIM', maxLength: 30, 'aria-label': t('Code'), autoFocus: true })}</td>
      <td>{champ('libelle', { placeholder: t('Libellé'), maxLength: 200, 'aria-label': t('Libellé') })}</td>
      <td>
        {champ('categorie', { placeholder: t('Catégorie'), list: 'ps-cp-categories', 'aria-label': t('Catégorie') })}
        <datalist id="ps-cp-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </td>
      <td>{champ('motsCles', { placeholder: t('mots séparés par des virgules'), 'aria-label': t('Mots-clés') })}</td>
      <td className="ps-cp-mots">{nomsFamilles(edition?.familles)}</td>
      <td className="ps-cp-actions">
        <button type="button" className="ps-icone-btn" disabled={occupe} onClick={() => enregistrer(edition)} title={t('Enregistrer')} aria-label={t('Enregistrer')}>
          {occupe ? <Loader2 size={15} className="ps-tourne" /> : <Save size={15} />}
        </button>
        <button type="button" className="ps-icone-btn" onClick={() => { setEdition(null); setErreur(''); }} title={t('Annuler')} aria-label={t('Annuler')}>
          <X size={15} />
        </button>
      </td>
    </tr>
    <tr className="ps-cp-edition ps-cp-edition-familles">
      <td colSpan={6}>
        <ChoixFamillesCode familles={familles} valeur={edition?.familles}
          onChange={(v) => setEdition((x) => ({ ...x, familles: v }))} />
      </td>
    </tr>
    </Fragment>
  );

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <Tags size={15} aria-hidden="true" /> {t('Codes panne')}
        <button type="button" className="ps-icone-btn" onClick={charger} title={t('Rafraîchir')} aria-label={t('Rafraîchir')}>
          <RefreshCw size={15} />
        </button>
      </h3>
      <p className="ps-mc-aide">
        {t('Pendant la saisie d’une réclamation, l’IA propose un de ces codes et montre les pannes semblables déjà résolues. Les mots-clés servent quand l’IA ne répond pas.')}
        {' '}{t('Seuls les codes de la famille de l’équipement sont proposés ; un code sans famille vaut pour toutes.')}
      </p>
      <div className="ps-cp-barre">
        <button type="button" className="ps-action" disabled={edition !== null} onClick={() => setEdition({ ...VIDE })}>
          <Plus size={14} /> {t('Nouveau code')}
        </button>
        {nbInactifs > 0 && (
          <label className="ps-cp-filtre">
            <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
            {t('Afficher les codes désactivés ({n})', { n: nbInactifs })}
          </label>
        )}
      </div>
      {erreur && <p className="ps-cp-erreur" role="alert">{erreur}</p>}
      {codes === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="ps-mc-defile">
          <table className="ps-mc-table ps-cp-table">
            <thead>
              <tr>
                <th>{t('Code')}</th>
                <th>{t('Libellé')}</th>
                <th>{t('Catégorie')}</th>
                <th>{t('Mots-clés')}</th>
                <th>{t('Familles')}</th>
                <th><span className="ps-sr">{t('Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {edition && !edition.id && ligneEdition}
              {visibles.length === 0 && !edition && (
                <tr><td colSpan={6} className="ps-mc-vide">{t('Aucun code panne.')}</td></tr>
              )}
              {visibles.map((c) => (edition?.id === c.id ? cloneElement(ligneEdition, { key: c.id }) : (
                <tr key={c.id} className={c.actif ? '' : 'ps-cp-inactif'}>
                  <td className="ps-mc-num"><strong>{c.code}</strong></td>
                  <td dir="auto">{c.libelle}{!c.actif && <small>{t('Désactivé')}</small>}</td>
                  <td>{c.categorie || '—'}</td>
                  <td className="ps-cp-mots" dir="auto">{c.motsCles || '—'}</td>
                  <td className="ps-cp-mots">{nomsFamilles(c.familles)}</td>
                  <td className="ps-cp-actions">
                    <button type="button" className="ps-icone-btn" disabled={edition !== null} onClick={() => setEdition({ ...VIDE, ...c, categorie: c.categorie || '', motsCles: c.motsCles || '', familles: c.familles || '' })} title={t('Modifier')} aria-label={t('Modifier')}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="ps-icone-btn" disabled={occupe || edition !== null} onClick={() => basculer(c)} title={c.actif ? t('Désactiver') : t('Réactiver')} aria-label={c.actif ? t('Désactiver') : t('Réactiver')}>
                      <Power size={15} />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Check-lists des réclamations
// ═════════════════════════════════════════════════════════════
/**
 * Vérifications que le demandeur fait avant d'envoyer une réclamation (« Avez-vous redémarré l'appareil ? »…),
 * par famille d'équipement. Une famille sans check-list reprend la check-list par défaut.
 */
function ChecklistsReclamationVue({ prestataireId }) {
  const [familles, setFamilles] = useState(null);
  const [ecrites, setEcrites] = useState(null); // { defaut: {...}, '12': {...} }
  const [choix, setChoix] = useState('defaut');
  const [questions, setQuestions] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = () => {
    setErreur('');
    reclamationService.checklists()
      .then((l) => setEcrites(Object.fromEntries((l || []).map((c) => [String(c.famille), c]))))
      .catch(() => { setEcrites({}); setErreur(t('Impossible de charger les check-lists.')); });
  };
  useEffect(charger, []);
  useEffect(() => {
    let annule = false;
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) setFamilles([]); });
    return () => { annule = true; };
  }, [prestataireId]);

  const questionFinale = ecrites?.defaut?.questionFinale;
  const propre = ecrites?.[choix];
  const nomFamille = choix === 'defaut' ? null : (familles || []).find((f) => String(f.id) === choix)?.nom || propre?.familleNom || null;

  // Quand on change de famille : ses questions, ou celles par défaut pour partir de quelque chose
  useEffect(() => {
    if (!ecrites) return;
    setQuestions([...(ecrites[choix]?.questions ?? ecrites.defaut?.questions ?? [])]);
    setInfo('');
  }, [choix, ecrites]);

  // Modifiée par rapport aux questions affichées au départ (celles de la famille, sinon celles par défaut)
  const modifie = JSON.stringify(questions.map((q) => q.trim()).filter(Boolean))
    !== JSON.stringify(propre?.questions ?? ecrites?.defaut?.questions ?? []);

  const enregistrer = async (liste) => {
    setOccupe(true);
    setErreur('');
    try {
      await reclamationService.enregistrerChecklist(choix, nomFamille, liste.map((q) => q.trim()).filter(Boolean));
      setInfo(liste.length ? t('Check-list enregistrée.') : t('Cette famille reprend maintenant la check-list par défaut.'));
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const deplacer = (i, sens) => setQuestions((l) => {
    const n = [...l];
    const j = i + sens;
    if (j < 0 || j >= n.length) return l;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const liste = (familles || []).filter((f) => !filtre.trim()
    || `${f.nom || ''} ${f.code || ''}`.toLowerCase().includes(filtre.trim().toLowerCase()));

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <ClipboardCheck size={15} aria-hidden="true" /> {t('Check-lists des réclamations')}
      </h3>
      <p className="ps-mc-aide">
        {t('Avant d’envoyer une réclamation, le demandeur répond à ces vérifications (Oui / Non / Sans objet). Les questions dépendent de la famille de l’équipement ; une famille sans check-list reprend celle par défaut. La dernière question est toujours posée : si le problème a disparu, on lui propose de ne pas envoyer la réclamation.')}
      </p>
      {erreur && <p className="ps-cp-erreur" role="alert">{erreur}</p>}
      {ecrites === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="ps-ck">
          <div className="ps-ck-familles">
            <input className="ps-cp-input" type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)}
              placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille…')} />
            <ul>
              <li>
                <button type="button" className={`ps-ck-famille ${choix === 'defaut' ? 'is-actif' : ''}`} onClick={() => setChoix('defaut')}>
                  <strong>{t('Par défaut (toutes les familles)')}</strong>
                  <small>{t('{n} question(s)', { n: ecrites.defaut?.questions?.length ?? 0 })}</small>
                </button>
              </li>
              {familles === null && <li className="ps-mc-vide"><Loader2 size={14} className="ps-tourne" /></li>}
              {liste.map((f) => {
                const c = ecrites[String(f.id)];
                return (
                  <li key={f.id}>
                    <button type="button" className={`ps-ck-famille ${choix === String(f.id) ? 'is-actif' : ''}`} onClick={() => setChoix(String(f.id))}>
                      <span>{f.nom || f.code || `#${f.id}`}</span>
                      <small className={c ? 'is-propre' : ''}>{c ? t('{n} question(s)', { n: c.questions.length }) : t('par défaut')}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="ps-ck-edition">
            <h4>
              {choix === 'defaut' ? t('Check-list par défaut') : t('Famille {nom}', { nom: nomFamille || `#${choix}` })}
              {choix !== 'defaut' && !propre && <small>{t('Utilise la check-list par défaut : modifiez-la ci-dessous pour en faire une propre à cette famille.')}</small>}
            </h4>
            <ol className="ps-ck-questions">
              {questions.map((q, i) => (
                <li key={i}>
                  <input className="ps-cp-input" value={q} maxLength={250} aria-label={t('Question {n}', { n: i + 1 })}
                    onChange={(e) => setQuestions((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
                  <button type="button" className="ps-icone-btn" onClick={() => deplacer(i, -1)} disabled={i === 0} title={t('Monter')} aria-label={t('Monter')}><ArrowUp size={14} /></button>
                  <button type="button" className="ps-icone-btn" onClick={() => deplacer(i, 1)} disabled={i === questions.length - 1} title={t('Descendre')} aria-label={t('Descendre')}><ArrowDown size={14} /></button>
                  <button type="button" className="ps-icone-btn" onClick={() => setQuestions((l) => l.filter((_, k) => k !== i))} title={t('Supprimer')} aria-label={t('Supprimer')}><Trash2 size={14} /></button>
                </li>
              ))}
              {questionFinale && (
                <li className="ps-ck-finale">
                  <span>{questionFinale}</span>
                  <small>{t('toujours posée en dernier')}</small>
                </li>
              )}
            </ol>
            <div className="ps-cp-barre">
              <button type="button" className="ps-action" onClick={() => setQuestions((l) => [...l, ''])} disabled={questions.length >= 30}>
                <Plus size={14} /> {t('Ajouter une question')}
              </button>
              <button type="button" className="ps-btn ps-btn--primary" disabled={occupe || !modifie || !questions.some((q) => q.trim())} onClick={() => enregistrer(questions)}>
                {occupe ? <Loader2 size={15} className="ps-tourne" /> : <Save size={15} />} {t('Enregistrer')}
              </button>
              {choix !== 'defaut' && propre && (
                <button type="button" className="ps-action" disabled={occupe} onClick={() => enregistrer([])}>
                  <Undo2 size={14} /> {t('Revenir à la check-list par défaut')}
                </button>
              )}
              {info && <span className="ps-ck-info" role="status"><CheckCircle2 size={14} /> {info}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
