import { useEffect, useMemo, useState } from 'react';
import {
  Save, RotateCcw, Play, CheckCircle2, AlertTriangle, Wrench, Building2, LoaderCircle, Search,
  Languages, CalendarClock, Activity, CirclePause, Timer, CarFront, Boxes, RefreshCw, Settings2, X, Undo2,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';
import parametreService from '../../../services/parametreService';
import prestataireService from '../../../services/prestataireService';
import authService from '../../../services/Authservice';
import EquipementMaintenanceTypesSettings from '../Etatequipement/EquipementMaintenanceTypesSettings';
import ReglesConditionnellesVue from './ReglesConditionnellesVue';
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
 * Structure de la page : une colonne de rubriques à gauche, la rubrique choisie à droite.
 * Chaque réglage est une ligne « libellé + explication | valeur ».
 * ──────────────────────────────────────────────────────────── */

/** Rubriques connues (nom du groupe côté serveur → présentation). Les groupes inconnus s'ajoutent à la fin. */
const RUBRIQUES = [
  { id: 'general', titre: 'Général', aide: 'Langue de l’application sur cet ordinateur.', Icone: Languages },
  { id: 'planif', groupe: 'Planification des traitements', titre: 'Traitements automatiques', aide: 'Quand les analyses et les alertes tournent toutes seules.', Icone: CalendarClock },
  { id: 'preventif', titre: 'Maintenance préventive', aide: 'Déclenchement des bons préventifs et types de maintenance réglementaire.', Icone: Wrench },
  { id: 'sla', groupe: 'SLA (délais en heures)', titre: 'Délais SLA', aide: 'Délais de réponse et de résolution selon la priorité du bon.', Icone: Timer },
  { id: 'anomalies', groupe: "Détection d'anomalies", titre: 'Détection d’anomalies', aide: 'Quand un pic de réclamations est signalé.', Icone: Activity },
  { id: 'blocages', groupe: 'Détection de blocages', titre: 'Détection de blocages', aide: 'Quand un équipement à l’arrêt est signalé.', Icone: CirclePause },
  { id: 'parc', groupe: "Alertes d'échéance du Parc", titre: 'Alertes du Parc', aide: 'Assurance, visite technique, vignette et vidange des véhicules.', Icone: CarFront },
  { id: 'cubix_immo', groupe: 'Cubix — équipements lus', titre: 'Équipements lus dans Cubix', aide: 'Prestataire et familles d’articles que la GMAO suit.', Icone: Boxes },
  { id: 'cubix_etat', groupe: 'Synchronisation Cubix (état des équipements)', titre: 'État envoyé à Cubix', aide: 'Codes EtatFonc écrits dans Cubix au fil des pannes.', Icone: RefreshCw },
];

const CLE_RUBRIQUE = 'gmao.parametres.rubrique';

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
  const [rubrique, setRubrique] = useState(() => {
    try { return localStorage.getItem(CLE_RUBRIQUE) || 'planif'; } catch { return 'planif'; }
  });

  const choisirRubrique = (id) => {
    setRubrique(id);
    setRecherche('');
    try { localStorage.setItem(CLE_RUBRIQUE, id); } catch { /* stockage indisponible */ }
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
      id: `autre_${i}`, groupe, titre: groupe, aide: '', Icone: Settings2, items,
    }));
    return { m, autres };
  }, [params]);

  const rubriques = useMemo(() => [
    ...RUBRIQUES.map((r) => ({ ...r, items: parRubrique.m.get(r.id) || [] }))
      .filter((r) => r.id === 'general' || r.id === 'preventif' || r.items.length > 0),
    ...parRubrique.autres,
  ], [parRubrique]);

  const rubriqueActive = rubriques.find((r) => r.id === rubrique) || rubriques[1] || rubriques[0];

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
    return (
      <div key={p.cle} className={`ps-ligne ${estModifie(p) ? 'is-modifie' : ''} ${bloc ? 'ps-ligne--bloc' : ''}`}>
        <div className="ps-ligne-texte">
          <label htmlFor={`ps-${p.cle}`} className="ps-ligne-titre">
            {t(p.libelle)} <Badge liste={[p]} />
          </label>
          {p.description && <p className="ps-ligne-aide">{t(p.description)}</p>}
        </div>
        <div className="ps-ligne-valeur">
          <div className="ps-pcard-control">
            <ChampValeur param={p} valeur={draft[p.cle]} onChange={(v) => setValue(p.cle, v)} draft={draft} />
            {p.unite && <span className="ps-unit">{t(p.unite)}</span>}
          </div>
          <BoutonDefaut liste={[p]} />
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
            <div key={code} className={`ps-ligne ps-ligne--tache ${liste.some(estModifie) ? 'is-modifie' : ''} ${actif ? '' : 'is-eteint'}`}>
              <div className="ps-ligne-texte">
                <span className="ps-ligne-titre">{titre} <Badge liste={liste} /></span>
                {ref.description && <p className="ps-ligne-aide">{t(ref.description)}</p>}
              </div>
              <div className="ps-ligne-valeur">
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
        {reste.length > 0 && <div className="ps-lignes">{reste.map(ligneParametre)}</div>}
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
            <div className="ps-carte">
              <h3 className="ps-carte-titre">{t('Déclenchement automatique')}</h3>
              <div className="ps-lignes">{lignesTaches(r.items)}</div>
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
    if (r.id === 'sla') return <div className="ps-carte">{tableauSla(r.items)}</div>;
    if (r.id === 'planif') return <div className="ps-carte"><div className="ps-lignes">{lignesTaches(r.items)}</div></div>;
    return <div className="ps-carte"><div className="ps-lignes">{r.items.map(ligneParametre)}</div></div>;
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

  return (
    <div className="ps-page">
      <header className="ps-entete">
        <div className="ps-entete-titre">
          <span className="ps-entete-icone"><ICONES_MODULES.parametresSysteme size={22} /></span>
          <div>
            <h1>{t('Paramètres système')}</h1>
            <p>{t('Heures des traitements automatiques, seuils de détection, barème SLA et lien avec Cubix.')}</p>
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

      <div className="ps-corps">
        <nav className="ps-nav" aria-label={t('Rubriques des paramètres')}>
          {rubriques.map((r) => {
            const n = nbModifies(r);
            const actif = !mots.length && r.id === rubriqueActive?.id;
            return (
              <button
                key={r.id}
                type="button"
                className={`ps-nav-item ${actif ? 'is-actif' : ''}`}
                aria-current={actif ? 'page' : undefined}
                onClick={() => choisirRubrique(r.id)}
              >
                <span className="ps-nav-icone"><r.Icone size={17} aria-hidden="true" /></span>
                <span className="ps-nav-texte">{t(r.titre)}</span>
                {n > 0 && <span className="ps-nav-point" title={t('{n} modification(s) non enregistrée(s)', { n })}>{n}</span>}
              </button>
            );
          })}
        </nav>

        <main className="ps-contenu">
          {loading ? (
            <div className="ps-vide"><LoaderCircle size={20} className="ps-tourne" /> {t('Chargement...')}</div>
          ) : mots.length > 0 ? (
            resultats.length === 0 ? (
              <div className="ps-vide">{t('Aucun réglage ne correspond à « {texte} ».', { texte: recherche.trim() })}</div>
            ) : (
              resultats.map((r) => (
                <section key={r.id} className="ps-rubrique">
                  <header className="ps-rubrique-tete ps-rubrique-tete--petite">
                    <span className="ps-rubrique-icone"><r.Icone size={16} aria-hidden="true" /></span>
                    <h2>{t(r.titre)}</h2>
                    <button type="button" className="ps-lien" onClick={() => choisirRubrique(r.id)}>{t('Ouvrir la rubrique')}</button>
                  </header>
                  <div className="ps-carte"><div className="ps-lignes">{r.trouves.map(ligneParametre)}</div></div>
                </section>
              ))
            )
          ) : rubriqueActive && (
            <section className="ps-rubrique" aria-labelledby="ps-rubrique-titre">
              <header className="ps-rubrique-tete">
                <span className="ps-rubrique-icone"><rubriqueActive.Icone size={20} aria-hidden="true" /></span>
                <div className="ps-rubrique-texte">
                  <h2 id="ps-rubrique-titre">{t(rubriqueActive.titre)}</h2>
                  {rubriqueActive.aide && <p>{t(rubriqueActive.aide)}</p>}
                </div>
                {rubriqueActive.items.length > 0 && rubriqueActive.id !== 'preventif'
                  && rubriqueActive.items.some((p) => draft[p.cle] !== p.valeurDefaut) && (
                  <button type="button" className="ps-action" onClick={() => reinitialiser(rubriqueActive.items)}>
                    <Undo2 size={13} /> {t('Valeurs par défaut')}
                  </button>
                )}
              </header>
              {contenuRubrique(rubriqueActive)}
            </section>
          )}
        </main>
      </div>

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
