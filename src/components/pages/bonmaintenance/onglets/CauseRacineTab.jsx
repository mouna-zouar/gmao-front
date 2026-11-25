import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertCircle, ArrowLeft, ClipboardCheck, History, Loader2, Pencil, Plus, Repeat, Save, Search, Trash2 } from 'lucide-react';
import Formulaire from '../../../commun/Formulaire';
import { useFormulaire, valeursDepuis, versPayload } from '../../../commun/useFormulaire';
import { Badge } from '../../../commun/TableauBord';
import rcaCapaService from '../../../../services/rcaCapaService';
import personnelService from '../../../../services/Personnelservice';
import bonMaintenanceDiagnosticService from '../../../../services/Bonmaintenancediagnosticservice';
import { selectUtilisateur } from '../../../../store/authSlice';
import { formatDate, formatDateTime } from '../BmdCommun';
import { t } from '../../../../i18n';
import './CauseRacineTab.css';

const METHODE_RCA_LABELS = {
  CINQ_POURQUOI: '5 Pourquoi',
  ISHIKAWA: 'Ishikawa',
  PARETO: 'Pareto',
  AUTRE: 'Autre',
};

const TYPE_ACTION_LABELS = { CORRECTIVE: 'Corrective', PREVENTIVE: 'Préventive' };

const STATUT_ACTION_LABELS = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VERIFIEE_EFFICACE: 'Vérifiée efficace',
  VERIFIEE_INEFFICACE: 'Vérifiée inefficace',
};

const STATUT_ACTION_CLASS = {
  A_FAIRE: 'bmd-capa-statut--afaire',
  EN_COURS: 'bmd-capa-statut--encours',
  TERMINEE: 'bmd-capa-statut--terminee',
  VERIFIEE_EFFICACE: 'bmd-capa-statut--efficace',
  VERIFIEE_INEFFICACE: 'bmd-capa-statut--inefficace',
};

const STATUTS_VERIFICATION = new Set(['VERIFIEE_EFFICACE', 'VERIFIEE_INEFFICACE']);

const FAMILLES_ISHIKAWA = [
  { cle: 'materiel', label: 'Matériel' },
  { cle: 'methode', label: 'Méthode' },
  { cle: 'mainOeuvre', label: "Main-d'œuvre" },
  { cle: 'milieu', label: 'Milieu' },
  { cle: 'matiere', label: 'Matière' },
  { cle: 'mesure', label: 'Mesure' },
];

const NB_POURQUOI = 5;
const champPourquoi = (i) => `pourquoi${i + 1}`;
const champFamille = (cle) => `ishikawa_${cle}`;

function lireDonnees(analyse) {
  if (!analyse?.donneesMethode) return {};
  try {
    return JSON.parse(analyse.donneesMethode) || {};
  } catch {
    return {};
  }
}

const lignes = (texte) => String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean);

function listePourquoi(valeurs) {
  return Array.from({ length: NB_POURQUOI }, (_, i) => String(valeurs[champPourquoi(i)] || '').trim()).filter(Boolean);
}

function nomPersonne(p) {
  return [p?.prenom, p?.nom].filter(Boolean).join(' ').trim();
}

function nomUtilisateur(user) {
  return user?.userNom || [user?.prenom, user?.nom].filter(Boolean).join(' ') || user?.username || user?.login || '';
}

function versDateHeure(date) {
  return date ? `${String(date).slice(0, 10)}T23:59:00` : null;
}

function encoderDonnees(valeurs, contexte) {
  switch (valeurs.methode) {
    case 'CINQ_POURQUOI':
      return JSON.stringify({ pourquoi: listePourquoi(valeurs) });
    case 'ISHIKAWA':
      return JSON.stringify({
        familles: Object.fromEntries(FAMILLES_ISHIKAWA.map((f) => [f.cle, lignes(valeurs[champFamille(f.cle)])])),
      });
    case 'PARETO':
      return contexte
        ? JSON.stringify({ moisPareto: contexte.moisPareto, totalPannes: contexte.totalPannes, lignes: contexte.pareto || [] })
        : null;
    default:
      return null;
  }
}

function causeParDefaut(valeurs, contexte) {
  if (valeurs.methode === 'CINQ_POURQUOI') {
    const p = listePourquoi(valeurs);
    return p[p.length - 1] || '';
  }
  if (valeurs.methode === 'PARETO') return contexte?.pareto?.[0]?.libelle || '';
  return '';
}

function objetFormulaire(analyse) {
  if (!analyse) return null;
  const d = lireDonnees(analyse);
  const o = { ...analyse };
  (d.pourquoi || []).forEach((p, i) => { if (i < NB_POURQUOI) o[champPourquoi(i)] = p; });
  FAMILLES_ISHIKAWA.forEach((f) => { o[champFamille(f.cle)] = (d.familles?.[f.cle] || []).join('\n'); });
  return o;
}

function problemeDepuisDiagnostic(bon, reclamations, diagnostics) {
  const recl = (reclamations || []).find((r) => r.codePanneCode || r.codePanneLibelle) || (reclamations || [])[0];
  const diag = [...(diagnostics || [])].sort((a, b) => String(b.dateDiagnostic || '').localeCompare(String(a.dateDiagnostic || '')))[0];
  const parties = [];
  if (recl?.codePanneCode || recl?.codePanneLibelle) {
    parties.push([recl.codePanneCode, recl.codePanneLibelle].filter(Boolean).join(' – '));
  }
  const constat = diag?.observations || diag?.causeProbable || recl?.description || bon?.description || bon?.titre;
  if (constat) parties.push(constat);
  return parties.join(' : ');
}

function ChaineCinqPourquoi({ pourquoi }) {
  if (!pourquoi?.length) return null;
  return (
    <ol className="rca-chaine">
      {pourquoi.map((p, i) => (
        <li key={i} className={`rca-chaine__etape ${i === pourquoi.length - 1 ? 'is-racine' : ''}`}>
          <span className="rca-chaine__num">{i + 1}</span>
          <div className="rca-chaine__texte">
            <span className="rca-chaine__question">{t('Pourquoi ?')}</span>
            <span>{p}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ArreteIshikawa({ familles, effet }) {
  const haut = FAMILLES_ISHIKAWA.slice(0, 3);
  const bas = FAMILLES_ISHIKAWA.slice(3);
  const boite = (f) => {
    const causes = familles?.[f.cle] || [];
    return (
      <div key={f.cle} className={`rca-fish__famille ${causes.length ? '' : 'is-vide'}`}>
        <span className="rca-fish__titre">{t(f.label)}</span>
        {causes.length ? (
          <ul>{causes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        ) : (
          <span className="rca-fish__aucune">—</span>
        )}
      </div>
    );
  };
  return (
    <div className="rca-fish" role="figure" aria-label={t('Diagramme Ishikawa')}>
      <div className="rca-fish__epine" aria-hidden="true" />
      <div className="rca-fish__rangee rca-fish__rangee--haut">{haut.map(boite)}</div>
      <div className="rca-fish__rangee rca-fish__rangee--bas">{bas.map(boite)}</div>
      <div className="rca-fish__tete">
        <span className="rca-fish__titre">{t('Effet')}</span>
        <span>{effet}</span>
      </div>
    </div>
  );
}

function GraphePareto({ lignes: donnees, total, mois }) {
  if (!donnees?.length) return <p className="rca-vide">{t('Aucune panne enregistrée sur cet équipement.')}</p>;
  const max = Math.max(...donnees.map((l) => l.nombre), 1);
  const finVital = donnees.findIndex((l) => l.cumulPct >= 80);
  return (
    <div className="rca-pareto">
      <div className="rca-pareto__tete">
        <span>{t('{n} pannes sur {m} mois', { n: total, m: mois })}</span>
        <span className="rca-pareto__legende"><i className="rca-pareto__pastille is-vital" /> {t('80 % des pannes')}</span>
      </div>
      <ul>
        {donnees.map((l, i) => {
          const vital = finVital < 0 || i <= finVital;
          return (
            <li key={`${l.code || 'x'}-${i}`} className="rca-pareto__ligne" title={t('{n} pannes · cumul {c} %', { n: l.nombre, c: l.cumulPct })}>
              <span className="rca-pareto__libelle">{l.code ? <b>{l.code}</b> : null} {l.libelle}</span>
              <span className="rca-pareto__piste">
                <span className={`rca-pareto__barre ${vital ? 'is-vital' : ''}`} style={{ width: `${(l.nombre / max) * 100}%` }} />
              </span>
              <span className="rca-pareto__valeur">{l.nombre}</span>
              <span className="rca-pareto__cumul">{l.cumulPct} %</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LignesActions({ valeur, changer, personnes }) {
  const liste = Array.isArray(valeur) ? valeur : [];
  const maj = (i, champ, v) => changer(liste.map((a, j) => (j === i ? { ...a, [champ]: v } : a)));
  return (
    <div className="rca-lignes-actions">
      {liste.map((a, i) => (
        <div key={i} className="rca-lignes-actions__ligne">
          <select value={a.type} onChange={(e) => maj(i, 'type', e.target.value)} aria-label={t('Type')}>
            {Object.entries(TYPE_ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
          <input type="text" value={a.description} onChange={(e) => maj(i, 'description', e.target.value)} placeholder={t('Description')} aria-label={t('Description')} />
          <select value={a.responsable} onChange={(e) => maj(i, 'responsable', e.target.value)} aria-label={t('Responsable')}>
            <option value="">{t('Responsable')}</option>
            {personnes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" value={a.dateEcheance} onChange={(e) => maj(i, 'dateEcheance', e.target.value)} aria-label={t('Échéance')} />
          <button type="button" className="rca-icone-btn" onClick={() => changer(liste.filter((_, j) => j !== i))} aria-label={t('Retirer')}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="rca-lien-btn" onClick={() => changer([...liste, { type: 'CORRECTIVE', description: '', responsable: '', dateEcheance: '' }])}>
        <Plus size={15} /> {t('Ajouter une action')}
      </button>
    </div>
  );
}

function FormulaireEnLigne({ champs, sections, objet, initiales, onEnregistrer, onAnnuler, libelleEnregistrer, titre, compact }) {
  const creation = !objet;
  const champsActifs = useMemo(() => champs.filter((c) => !(c.creation && !creation)), [champs, creation]);
  const blocs = (sections?.length ? sections : [{ cle: 'general' }]).filter((b) => !(b.creation && !creation));
  const [valeursInitiales] = useState(() => {
    const v = valeursDepuis(champsActifs, objet);
    if (creation && initiales) {
      Object.entries(initiales).forEach(([k, x]) => { if (x !== undefined && x !== null && x !== '' && k in v) v[k] = x; });
    }
    return v;
  });
  const f = useFormulaire(champsActifs, valeursInitiales);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const racine = useRef(null);

  useEffect(() => {
    racine.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    const cible = racine.current?.querySelector('[data-autofocus], input:not([type=hidden]), select, textarea');
    cible?.focus?.({ preventScroll: true });
  }, []);

  const enregistrer = async (e) => {
    e?.preventDefault?.();
    const erreurs = f.valider();
    if (erreurs) {
      const premier = champsActifs.find((c) => erreurs[c.nom]);
      setErreur(erreurs[premier?.nom] || t('Corrigez les champs signalés.'));
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await onEnregistrer(versPayload(champsActifs, f.valeurs), { creation, valeurs: f.valeurs });
      onAnnuler();
    } catch (err) {
      setErreur(err?.response?.data?.message || err?.message || t('Échec de l’enregistrement.'));
      setEnvoi(false);
    }
  };

  return (
    <form ref={racine} className={`rca-form ${compact ? 'rca-form--compact' : ''}`} onSubmit={enregistrer} noValidate>
      {titre && <h3 className="rca-form__titre">{titre}</h3>}
      {erreur && <p className="cm-alerte" role="alert"><AlertCircle size={16} aria-hidden="true" /> {erreur}</p>}
      {blocs.map((b) => (
        <div key={b.cle} className="rca-form__bloc">
          {b.label && <h4 className="rca-form__bloc-titre">{t(b.label)}</h4>}
          <Formulaire champs={champsActifs} valeurs={f.valeurs} erreurs={f.erreurs} section={b.cle}
            onChange={(nom, v) => { setErreur(null); f.changer(nom, v); }} />
        </div>
      ))}
      <div className="rca-form__pied">
        <button type="button" className="rca-btn" onClick={onAnnuler} disabled={envoi}>{t('Annuler')}</button>
        <button type="submit" className="rca-btn rca-btn--principal" disabled={envoi}>
          {envoi ? <Loader2 size={15} className="cf-tourne" /> : <Save size={15} />}
          {envoi ? t('Enregistrement…') : libelleEnregistrer}
        </button>
      </div>
    </form>
  );
}

function usePersonnel() {
  const [personnes, setPersonnes] = useState([]);
  useEffect(() => {
    let annule = false;
    personnelService.getAll(0, 500)
      .then((r) => {
        if (annule) return;
        const noms = (r?.content ?? r ?? []).map(nomPersonne).filter(Boolean);
        setPersonnes([...new Set(noms)].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => { if (!annule) setPersonnes([]); });
    return () => { annule = true; };
  }, []);
  return personnes;
}

const optionsPersonnes = (personnes, actuel) => {
  const liste = actuel && !personnes.includes(actuel) ? [actuel, ...personnes] : personnes;
  return liste.map((p) => ({ value: p, label: p }));
};

export function CauseRacineTab({ bon, reclamations, analyses, loading, onRecharger }) {
  const user = useSelector(selectUtilisateur);
  const personnes = usePersonnel();
  const [contexte, setContexte] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [edition, setEdition] = useState(null);
  const [ajoutAction, setAjoutAction] = useState(null);
  const [verification, setVerification] = useState(null);
  const [majActionId, setMajActionId] = useState(null);
  const lotId = bon?.lotArticleImmobilistationId;

  const [versionContexte, setVersionContexte] = useState(0);
  const chargerContexte = useCallback(() => setVersionContexte((v) => v + 1), []);

  useEffect(() => {
    if (!lotId) return undefined;
    let annule = false;
    rcaCapaService.getContexteEquipement(lotId)
      .then((c) => { if (!annule) setContexte(c); })
      .catch(() => { if (!annule) setContexte(null); });
    return () => { annule = true; };
  }, [lotId, versionContexte]);

  useEffect(() => {
    if (!bon?.id) return undefined;
    let annule = false;
    bonMaintenanceDiagnosticService.getByBonMaintenance(bon.id)
      .then((d) => { if (!annule) setDiagnostics(d ?? []); })
      .catch(() => { });
    return () => { annule = true; };
  }, [bon?.id]);

  const recharger = () => { onRecharger?.(); chargerContexte(); };

  const champsAnalyse = useMemo(() => {
    const estMethode = (m) => (v) => v.methode === m;
    return [
      { nom: 'probleme', label: 'Problème', type: 'zone', lignes: 2, requis: true, largeur: 'pleine', section: 'analyse' },
      {
        nom: 'methode', label: 'Méthode', type: 'liste', requis: true, defaut: 'CINQ_POURQUOI', section: 'analyse', numerique: false,
        options: Object.entries(METHODE_RCA_LABELS).map(([value, label]) => ({ value, label })), traduireOptions: true,
      },
      {
        nom: 'auteur', label: 'Auteur', type: 'recherche', section: 'analyse', numerique: false,
        options: (v) => optionsPersonnes(personnes, v.auteur),
      },
      ...Array.from({ length: NB_POURQUOI }, (_, i) => ({
        nom: champPourquoi(i), label: `Pourquoi ${i + 1}`, type: 'texte', largeur: 'pleine', section: 'methode',
        requis: i === 0, visible: estMethode('CINQ_POURQUOI'), envoyer: false,
      })),
      ...FAMILLES_ISHIKAWA.map((f) => ({
        nom: champFamille(f.cle), label: f.label, type: 'zone', lignes: 2, section: 'methode',
        visible: estMethode('ISHIKAWA'), envoyer: false,
      })),
      {
        nom: 'paretoApercu', type: 'personnalise', largeur: 'pleine', section: 'methode', envoyer: false,
        visible: estMethode('PARETO'),
        rendu: () => (contexte
          ? <GraphePareto lignes={contexte.pareto} total={contexte.totalPannes} mois={contexte.moisPareto} />
          : <p className="rca-vide">{lotId ? t('Chargement…') : t('Aucun équipement lié à ce bon.')}</p>),
      },
      { nom: 'analyseDetaillee', label: 'Notes', type: 'zone', lignes: 3, largeur: 'pleine', section: 'methode' },
      {
        nom: 'causeRacine', label: 'Cause racine', type: 'zone', lignes: 2, largeur: 'pleine', section: 'conclusion',
        valider: (v, vals) => (String(v || '').trim() || causeParDefaut(vals, contexte) ? null : t('Ce champ est obligatoire.')),
      },
      {
        nom: 'actions', type: 'personnalise', largeur: 'pleine', section: 'actions', creation: true, defaut: [], envoyer: false,
        rendu: ({ valeur, changer }) => <LignesActions valeur={valeur} changer={changer} personnes={personnes} />,
      },
    ];
  }, [personnes, contexte, lotId]);

  const sectionsAnalyse = [
    { cle: 'analyse', label: 'Problème' },
    { cle: 'methode', label: 'Méthode' },
    { cle: 'conclusion', label: 'Cause racine' },
    { cle: 'actions', label: 'Actions CAPA', creation: true },
  ];

  const enregistrerAnalyse = async (payload, { valeurs }) => {
    if (valeurs.methode === 'ISHIKAWA' && !FAMILLES_ISHIKAWA.some((f) => lignes(valeurs[champFamille(f.cle)]).length)) {
      throw new Error(t('Renseignez au moins une cause dans le diagramme.'));
    }
    const corps = {
      bonMaintenanceId: bon.id,
      lotArticleImmobilistationId: lotId,
      probleme: payload.probleme,
      methode: payload.methode,
      causeRacine: payload.causeRacine || causeParDefaut(valeurs, contexte),
      analyseDetaillee: payload.analyseDetaillee,
      auteur: payload.auteur,
      donneesMethode: encoderDonnees(valeurs, contexte),
    };
    if (edition?.analyse) {
      await rcaCapaService.modifierAnalyse(edition.analyse.id, corps);
    } else {
      corps.actions = (valeurs.actions || [])
        .filter((a) => a.description?.trim())
        .map((a) => ({ type: a.type, description: a.description.trim(), responsable: a.responsable || null, dateEcheance: versDateHeure(a.dateEcheance) }));
      await rcaCapaService.creerAnalyse(corps);
    }
    recharger();
  };

  const champsAction = useMemo(() => [
    { nom: 'type', label: 'Type', type: 'liste', requis: true, defaut: 'CORRECTIVE', numerique: false, traduireOptions: true,
      options: Object.entries(TYPE_ACTION_LABELS).map(([value, label]) => ({ value, label })) },
    { nom: 'dateEcheance', label: 'Échéance', type: 'date' },
    { nom: 'description', label: 'Description', type: 'zone', lignes: 2, requis: true, largeur: 'pleine' },
    { nom: 'responsable', label: 'Responsable', type: 'recherche', numerique: false, largeur: 'pleine',
      options: (v) => optionsPersonnes(personnes, v.responsable) },
  ], [personnes]);

  const enregistrerAction = async (payload) => {
    await rcaCapaService.ajouterAction(ajoutAction, { ...payload, dateEcheance: versDateHeure(payload.dateEcheance) });
    recharger();
  };

  const champsVerification = useMemo(() => [
    { nom: 'commentaireVerification', label: 'Commentaire', type: 'zone', lignes: 3, requis: true, largeur: 'pleine', autoFocus: true },
  ], []);

  const changerStatut = async (action, statut) => {
    if (STATUTS_VERIFICATION.has(statut)) { setAjoutAction(null); setVerification({ action, statut }); return; }
    setMajActionId(action.id);
    try {
      await rcaCapaService.majStatutAction(action.id, { statut });
      recharger();
    } catch (err) {
      alert(err?.response?.data?.message || t("Impossible de mettre à jour le statut de l'action."));
    } finally {
      setMajActionId(null);
    }
  };

  const enregistrerVerification = async (payload) => {
    await rcaCapaService.majStatutAction(verification.action.id, {
      statut: verification.statut,
      commentaireVerification: payload.commentaireVerification,
    });
    recharger();
  };

  const ouvrirCreation = () => { setAjoutAction(null); setVerification(null); setEdition({ analyse: null }); };
  const objetAnalyse = useMemo(() => objetFormulaire(edition?.analyse), [edition]);
  const initialesAnalyse = useMemo(() => ({
    probleme: problemeDepuisDiagnostic(bon, reclamations, diagnostics),
    auteur: nomUtilisateur(user),
  }), [bon, reclamations, diagnostics, user]);

  const autresAnalyses = (contexte?.analyses || []).filter((a) => a.bonMaintenanceId !== bon?.id);
  const repetees = (contexte?.pannes90Jours || 0) >= 3;

  if (edition) {
    return (
      <div className="bmx-rca rca">
        <div className="rca-barre">
          <button type="button" className="rca-btn rca-btn--petit" onClick={() => setEdition(null)}>
            <ArrowLeft size={14} /> {t('Analyses')}
          </button>
        </div>
        <div className="rca-carte">
          <FormulaireEnLigne
            key={edition.analyse?.id ?? 'nouvelle'}
            titre={edition.analyse ? t("Modifier l'analyse") : t('Nouvelle analyse')}
            champs={champsAnalyse}
            sections={sectionsAnalyse}
            objet={objetAnalyse}
            initiales={initialesAnalyse}
            onEnregistrer={enregistrerAnalyse}
            onAnnuler={() => setEdition(null)}
            libelleEnregistrer={edition.analyse ? t('Enregistrer') : t('Créer')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bmx-rca rca">
      <div className="rca-barre">
        <h3 className="rca-barre__titre">
          <Search size={17} aria-hidden="true" /> {t('Analyses')}
          {analyses?.length > 0 && <span className="rca-barre__nb">{analyses.length}</span>}
        </h3>
        <button type="button" className="rca-btn rca-btn--principal" onClick={ouvrirCreation}>
          <Plus size={16} /> {t('Nouvelle analyse')}
        </button>
      </div>

      {loading ? (
        <p className="rca-vide"><Loader2 size={15} className="cf-tourne" /> {t('Chargement…')}</p>
      ) : !analyses?.length ? (
        <div className="rca-carte rca-carte--vide">
          <p>{t('Aucune analyse pour ce bon.')}</p>
          <button type="button" className="rca-btn" onClick={ouvrirCreation}><Plus size={16} /> {t('Nouvelle analyse')}</button>
        </div>
      ) : analyses.map((analyse) => {
        const d = lireDonnees(analyse);
        return (
          <article key={analyse.id} className="rca-carte">
            <header className="rca-carte__tete">
              <span className="bmd-rca-methode-pill">{t(METHODE_RCA_LABELS[analyse.methode] || analyse.methode)}</span>
              <span className="rca-carte__meta">{analyse.auteur ? `${analyse.auteur} · ` : ''}{formatDateTime(analyse.dateAnalyse)}</span>
              <span className="rca-carte__outils">
                <button type="button" className="rca-btn rca-btn--petit" onClick={() => { setAjoutAction(null); setVerification(null); setEdition({ analyse }); }}>
                  <Pencil size={14} /> {t('Modifier')}
                </button>
                <button type="button" className="rca-btn rca-btn--petit" onClick={() => { setVerification(null); setAjoutAction(analyse.id); }}>
                  <Plus size={14} /> {t('Ajouter une action')}
                </button>
              </span>
            </header>

            <div className="rca-champ">
              <span className="rca-champ__label">{t('Problème')}</span>
              <p>{analyse.probleme}</p>
            </div>

            {analyse.methode === 'CINQ_POURQUOI' && <ChaineCinqPourquoi pourquoi={d.pourquoi} />}
            {analyse.methode === 'ISHIKAWA' && d.familles && <ArreteIshikawa familles={d.familles} effet={analyse.probleme} />}
            {analyse.methode === 'PARETO' && d.lignes && <GraphePareto lignes={d.lignes} total={d.totalPannes} mois={d.moisPareto} />}

            <div className="rca-champ rca-champ--racine">
              <span className="rca-champ__label">{t('Cause racine')}</span>
              <p>{analyse.causeRacine}</p>
            </div>

            {analyse.analyseDetaillee && (
              <div className="rca-champ">
                <span className="rca-champ__label">{t('Notes')}</span>
                <p className="rca-pre">{analyse.analyseDetaillee}</p>
              </div>
            )}

            <div className="rca-actions">
              <span className="rca-champ__label">{t('Actions CAPA')}</span>
              {!analyse.actions?.length ? (
                <p className="rca-vide">{t('Aucune action.')}</p>
              ) : (
                <ul>
                  {analyse.actions.map((action) => (
                    <li key={action.id} className={`bmd-rca-action ${action.enRetard ? 'is-retard' : ''}`}>
                      <div className="bmd-rca-action__top">
                        <span className="bmd-rca-type-pill">{t(TYPE_ACTION_LABELS[action.type] || action.type)}</span>
                        <span className="bmd-rca-action__desc">{action.description}</span>
                      </div>
                      <div className="bmd-rca-action__bottom">
                        <span className="bmd-rca-action__meta">
                          {action.responsable ? `${action.responsable} · ` : ''}
                          {action.dateEcheance ? t('Échéance {date}', { date: formatDate(action.dateEcheance) }) : t('Sans échéance')}
                          {action.enRetard && <span className="bmd-rca-retard-tag"> {t('· En retard')}</span>}
                        </span>
                        <select
                          className={`bmd-capa-statut-select ${STATUT_ACTION_CLASS[action.statut] || ''}`}
                          value={verification?.action.id === action.id ? verification.statut : action.statut}
                          disabled={majActionId === action.id}
                          onChange={(e) => changerStatut(action, e.target.value)}
                          aria-label={t('Statut')}
                        >
                          {Object.entries(STATUT_ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                        </select>
                      </div>
                      {verification?.action.id === action.id && (
                        <FormulaireEnLigne
                          compact
                          titre={t(STATUT_ACTION_LABELS[verification.statut])}
                          champs={champsVerification}
                          onEnregistrer={enregistrerVerification}
                          onAnnuler={() => setVerification(null)}
                          libelleEnregistrer={t('Valider')}
                        />
                      )}
                      {action.commentaireVerification && (
                        <p className="rca-verif">
                          <ClipboardCheck size={14} aria-hidden="true" />
                          <span>{action.commentaireVerification}</span>
                          {action.dateRealisation && <small>{formatDate(action.dateRealisation)}</small>}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {ajoutAction === analyse.id && (
                <FormulaireEnLigne
                  compact
                  titre={t('Ajouter une action')}
                  champs={champsAction}
                  onEnregistrer={enregistrerAction}
                  onAnnuler={() => setAjoutAction(null)}
                  libelleEnregistrer={t('Ajouter')}
                />
              )}
            </div>
          </article>
        );
      })}

      {lotId && contexte && (
        <section className="rca-carte rca-historique">
          <header className="rca-carte__tete">
            <h3 className="rca-barre__titre"><History size={17} aria-hidden="true" /> {t('Sur cet équipement')}</h3>
            {repetees && <Badge ton="rouge"><Repeat size={12} aria-hidden="true" /> {t('Pannes répétées')}</Badge>}
          </header>
          <div className="rca-historique__chiffres">
            <div><b>{contexte.pannes90Jours}</b><span>{t('pannes sur 90 jours')}</span></div>
            <div><b>{contexte.totalPannes}</b><span>{t('pannes sur {m} mois', { m: contexte.moisPareto })}</span></div>
            <div><b>{autresAnalyses.length}</b><span>{t('analyses précédentes')}</span></div>
          </div>
          {autresAnalyses.length > 0 && (
            <ul className="rca-historique__liste">
              {autresAnalyses.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <span className="rca-historique__date">{formatDate(a.dateAnalyse)}</span>
                  <span className="rca-historique__bon">{a.bonNum || `#${a.bonMaintenanceId}`}</span>
                  <span className="bmd-rca-methode-pill">{t(METHODE_RCA_LABELS[a.methode] || a.methode)}</span>
                  <span className="rca-historique__cause">{a.causeRacine}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

    </div>
  );
}
