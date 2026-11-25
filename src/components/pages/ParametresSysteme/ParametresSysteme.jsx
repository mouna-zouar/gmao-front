import { useEffect, useMemo, useState } from 'react';
import {
  Save,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  LoaderCircle,
  Search,
  Languages,
  CalendarClock,
  Activity,
  CirclePause,
  Timer,
  CarFront,
  Boxes,
  RefreshCw,
  Settings2,
  X,
  Undo2,
  Tags,
  Printer,
  ClipboardCheck,
  Eye,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../constants/modules';
import parametreService from '../../../services/parametreService';
import EquipementMaintenanceTypesSettings from '../Etatequipement/Equipementmaintenancetypessettings';
import { useSearchParams } from 'react-router-dom';
import ReglageLangue from '../../../i18n/Reglagelangue';
import { t } from '../../../i18n';
import './ParametresSysteme.css';
import { ChampValeur } from './ChampsParametre';
import { ReglesConditionnellesVue } from './ReglesConditionnellesVue';
import { CodesPanneVue } from './CodesPanneVue';
import { ChecklistsReclamationVue } from './ChecklistsReclamationVue';

function codeTache(cle) {
  const m = /^planif\.([a-z_]+)\.heure$/.exec(cle);
  return m ? m[1] : null;
}

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

const SECTIONS_MENU = ['Application', 'Automatisation', 'Réclamations', 'Cubix', 'Autres réglages'];

const TON_SECTION = { Application: 'indigo', Automatisation: 'teal', Réclamations: 'ambre', Cubix: 'violet', 'Autres réglages': 'ardoise' };

function partiesTache(cle) {
  const m = /^planif\.([a-z_]+)\.(actif|heure|intervalle)$/.exec(cle);
  return m ? { code: m[1], champ: m[2] } : null;
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const rubrique = searchParams.get('r');

  const choisirRubrique = (id) => {
    setRecherche('');
    setSearchParams(id ? { r: id } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { if (id) localStorage.setItem(CLE_RUBRIQUE, id); } catch {}
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
            <EquipementMaintenanceTypesSettings integre />
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

  const mots = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const resultats = mots.length === 0 ? [] : rubriques
    .filter((r) => r.id !== 'general')
    .map((r) => ({ ...r, trouves: r.items.filter((p) => correspondRecherche(p, mots)) }))
    .filter((r) => r.trouves.length > 0)
    .filter((r, i, tab) => r.id !== 'preventif' || !tab.some((x) => x.id === 'planif'));

  const nbModifies = (r) => r.items.filter(estModifie).length;

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
