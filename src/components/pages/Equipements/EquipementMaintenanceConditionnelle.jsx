import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, FlaskConical, Gauge, History, Loader2, Pencil, Plus, Timer, Trash2, TrendingUp, Zap,
} from 'lucide-react';
import maintenanceConditionnelleService from '../../../services/maintenanceConditionnelleService';
import liaisonAgentService from '../../../services/liaisonAgentService';
import { t, locale } from '../../../i18n';

/*
 * « Maintenance conditionnelle » dans la fiche d'un équipement : un bon préventif est créé selon l'état réel
 * de la machine, lu par une sonde de l'agent (RS485 ou Zigbee), et non selon le calendrier.
 *   SEUIL    : la moyenne sur N heures dépasse (ou passe sous) une valeur ;
 *   TENDANCE : la valeur monte (ou baisse) chaque jour depuis N jours ;
 *   COMPTEUR : la valeur a augmenté de X depuis la dernière intervention (heures de fonctionnement…).
 */

export const MODES = [
  { value: 'SEUIL', icone: Gauge, label: 'Seuil', aide: 'La moyenne sur quelques heures dépasse une valeur (une pointe isolée ne compte pas).' },
  { value: 'TENDANCE', icone: TrendingUp, label: 'Tendance', aide: 'La valeur monte (ou baisse) chaque jour depuis plusieurs jours : une dérive lente.' },
  { value: 'COMPTEUR', icone: Timer, label: 'Compteur', aide: 'Tous les X (heures de fonctionnement, cycles…) depuis la dernière intervention.' },
];

export const ETATS_REGLE = {
  OK: { ton: 'ok', label: 'Normal' },
  ATTEINTE: { ton: 'attention', label: 'Condition atteinte' },
  BON_EN_COURS: { ton: 'action', label: 'Bon en cours' },
  DONNEES_INSUFFISANTES: { ton: 'neutre', label: 'Pas assez de mesures' },
  DESACTIVEE: { ton: 'neutre', label: 'Désactivée' },
};
const ETAT_INCONNU = { ton: 'info', label: 'Pas encore évaluée' };

const ETATS_DECLENCHEMENT = {
  EN_COURS: { ton: 'action', label: 'En cours' },
  EFFECTUE: { ton: 'ok', label: 'Effectué' },
  ANNULE: { ton: 'neutre', label: 'Annulé' },
};

const URGENCES = [
  { value: '', label: '— Non renseignée —' },
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
  { value: 4, label: 'Urgente' },
];
const TYPES_BON = [
  { value: 3, label: 'Préventif' },
  { value: 2, label: 'Correctif' },
  { value: 1, label: 'Curatif' },
  { value: 5, label: 'Autre' },
];
const FENETRES = [1, 2, 6, 12, 24, 48];

const vide = {
  libelle: '', liaisonId: '', mode: 'SEUIL', operateur: 'SUP', seuil: '', fenetreHeures: 6,
  joursAnalyse: 3, variationMin: '', valeurReference: '', urgenceBon: '', typeBon: 3, actif: true,
};

const nombre = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export const fmt = (v, max = 2) => (v == null ? '—' : Number(v).toLocaleString(locale(), { maximumFractionDigits: max }));
const dateHeure = (iso) => (iso
  ? new Date(iso).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '');
const nomSonde = (l) => `${l.libelle || l.type}${l.type ? ` (${l.type === 'ZIGBEE' ? 'Zigbee' : 'RS485'})` : ''}`;
const uniteSonde = (l) => (l?.unite || (l?.type === 'ZIGBEE' ? '°C' : ''));

/** Phrase qui dit ce que fera la règle (aperçu du formulaire). */
function phrase(f, unite) {
  const u = unite ? ` ${unite}` : '';
  if (f.mode === 'SEUIL') {
    if (f.seuil === '') return '';
    return t(f.operateur === 'INF'
      ? 'Un bon sera créé si la moyenne sur {h} h passe sous {v}.'
      : 'Un bon sera créé si la moyenne sur {h} h dépasse {v}.', { h: f.fenetreHeures, v: `${fmt(f.seuil)}${u}` });
  }
  if (f.mode === 'TENDANCE') {
    const base = t(f.operateur === 'INF'
      ? 'Un bon sera créé si la moyenne journalière baisse {j} jours de suite'
      : 'Un bon sera créé si la moyenne journalière monte {j} jours de suite', { j: f.joursAnalyse || 3 });
    return nombre(f.variationMin) > 0 ? `${base} ${t('d’au moins {v} au total.', { v: `${fmt(f.variationMin)}${u}` })}` : `${base}.`;
  }
  if (f.seuil === '') return '';
  return t('Un bon sera créé toutes les {v} depuis la dernière intervention.', { v: `${fmt(f.seuil)}${u}` });
}

export default function EquipementMaintenanceConditionnelle({ equipementId, Bloc, Pastille }) {
  const navigate = useNavigate();
  const [regles, setRegles] = useState([]);
  const [sondes, setSondes] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);
  const [tests, setTests] = useState({}); // id -> { enCours, resultat }
  const [voirHistorique, setVoirHistorique] = useState(false);

  const charger = () => {
    setChargement(true);
    Promise.all([
      maintenanceConditionnelleService.regles(equipementId).catch(() => []),
      liaisonAgentService.parEquipement(equipementId).catch(() => []),
      maintenanceConditionnelleService.declenchements(equipementId).catch(() => []),
    ]).then(([r, l, h]) => {
      setRegles(r);
      setSondes(l.filter((x) => x.type === 'RS485' || x.type === 'ZIGBEE'));
      setHistorique(h);
    }).finally(() => setChargement(false));
  };
  useEffect(charger, [equipementId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sondeChoisie = useMemo(() => sondes.find((s) => String(s.id) === String(form?.liaisonId)), [sondes, form?.liaisonId]);
  const unite = uniteSonde(sondeChoisie);

  const ouvrir = (r) => {
    setErreur('');
    if (!r) {
      setForm({ ...vide, liaisonId: sondes.length === 1 ? sondes[0].id : '' });
      return;
    }
    setForm({
      ...vide,
      ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)),
      seuil: r.seuil ?? '', variationMin: r.variationMin ?? '', valeurReference: r.valeurReference ?? '',
      urgenceBon: r.urgenceBon ?? '', typeBon: r.typeBon ?? 3,
      fenetreHeures: r.fenetreHeures ?? 6, joursAnalyse: r.joursAnalyse ?? 3,
    });
  };
  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  const enregistrer = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    const f = form;
    try {
      await maintenanceConditionnelleService.enregistrer({
        id: f.id, libelle: f.libelle, liaisonId: nombre(f.liaisonId), mode: f.mode, operateur: f.operateur,
        seuil: nombre(f.seuil), fenetreHeures: nombre(f.fenetreHeures), joursAnalyse: nombre(f.joursAnalyse),
        variationMin: nombre(f.variationMin), valeurReference: nombre(f.valeurReference),
        urgenceBon: nombre(f.urgenceBon), typeBon: nombre(f.typeBon), actif: f.actif,
      });
      setForm(null);
      charger();
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (r) => {
    try {
      const res = await maintenanceConditionnelleService.supprimer(r.id);
      setASupprimer(null);
      if (res && res.supprimee === false) setErreur(t('Cette règle a déjà créé des bons : elle a été désactivée pour garder son historique.'));
      charger();
    } catch {
      setErreur(t('Suppression impossible.'));
    }
  };

  const tester = async (r) => {
    setTests((x) => ({ ...x, [r.id]: { enCours: true } }));
    try {
      const resultat = await maintenanceConditionnelleService.tester(r.id);
      setTests((x) => ({ ...x, [r.id]: { resultat } }));
    } catch {
      setTests((x) => ({ ...x, [r.id]: { resultat: { etat: 'DONNEES_INSUFFISANTES', message: t('Test impossible.') } } }));
    }
  };

  const evaluer = async (r) => {
    setTests((x) => ({ ...x, [r.id]: { enCours: true } }));
    try {
      const resultat = await maintenanceConditionnelleService.evaluer(r.id);
      setTests((x) => ({ ...x, [r.id]: { resultat } }));
      charger();
    } catch (err) {
      setTests((x) => ({ ...x, [r.id]: { resultat: { etat: 'DONNEES_INSUFFISANTES', message: err?.response?.data?.message || t('Évaluation impossible.') } } }));
    }
  };

  const champ = (libelle, contenu, aide) => (
    <label>
      {libelle}
      {contenu}
      {aide && <small className="eq-lia-aide">{aide}</small>}
    </label>
  );

  const avecUnite = (input) => (unite ? <span className="eq-mc-unite">{input}<span>{unite}</span></span> : input);

  const formulaire = form && (
    <form className="eq-doc-form eq-mc-form" onSubmit={enregistrer} noValidate>
      <div className="eq-cnx-ligne">
        {champ(`${t('Nom de la règle')} *`, (
          <input value={form.libelle} onChange={(e) => maj('libelle', e.target.value)} placeholder={t('Ex. surchauffe moteur, vidange compresseur…')} />
        ))}
        {champ(`${t('Sonde')} *`, (
          <select value={form.liaisonId} onChange={(e) => maj('liaisonId', e.target.value)}>
            <option value="">{t('— Choisir —')}</option>
            {sondes.map((s) => (
              <option key={s.id} value={s.id}>
                {nomSonde(s)}{s.derniereValeur != null ? ` — ${fmt(s.derniereValeur)} ${uniteSonde(s)}` : ''}
              </option>
            ))}
          </select>
        ))}
      </div>

      <div className="eq-mc-modes" role="radiogroup" aria-label={t('Type de règle')}>
        {MODES.map((m) => {
          const Icone = m.icone;
          return (
            <button key={m.value} type="button" role="radio" aria-checked={form.mode === m.value}
              className={`eq-mc-mode ${form.mode === m.value ? 'is-actif' : ''}`} onClick={() => maj('mode', m.value)}>
              <Icone size={18} aria-hidden="true" />
              <strong>{t(m.label)}</strong>
              <span>{t(m.aide)}</span>
            </button>
          );
        })}
      </div>

      {form.mode === 'SEUIL' && (
        <div className="eq-lia-grille">
          {champ(t('Quand la moyenne est'), (
            <select value={form.operateur} onChange={(e) => maj('operateur', e.target.value)}>
              <option value="SUP">{t('au-dessus de')}</option>
              <option value="INF">{t('en dessous de')}</option>
            </select>
          ))}
          {champ(`${t('Seuil')} *`, avecUnite(<input type="number" step="any" value={form.seuil} onChange={(e) => maj('seuil', e.target.value)} />))}
          {champ(t('Moyenne calculée sur'), (
            <select value={form.fenetreHeures} onChange={(e) => maj('fenetreHeures', e.target.value)}>
              {FENETRES.map((h) => <option key={h} value={h}>{t('{n} h', { n: h })}</option>)}
            </select>
          ), t('Plus la durée est longue, moins une pointe passagère compte.'))}
        </div>
      )}

      {form.mode === 'TENDANCE' && (
        <div className="eq-lia-grille">
          {champ(t('Sens'), (
            <select value={form.operateur} onChange={(e) => maj('operateur', e.target.value)}>
              <option value="SUP">{t('La valeur monte')}</option>
              <option value="INF">{t('La valeur baisse')}</option>
            </select>
          ))}
          {champ(t('Jours de suite'), <input type="number" min="1" max="30" value={form.joursAnalyse} onChange={(e) => maj('joursAnalyse', e.target.value)} />,
            t('Chaque moyenne sur 24 h est comparée à la précédente.'))}
          {champ(t('Variation minimum au total'), avecUnite(<input type="number" step="any" min="0" value={form.variationMin} onChange={(e) => maj('variationMin', e.target.value)} placeholder="0" />),
            t('Évite un bon pour une variation insignifiante.'))}
        </div>
      )}

      {form.mode === 'COMPTEUR' && (
        <div className="eq-lia-grille eq-mc-grille-2">
          {champ(`${t('Intervalle')} *`, avecUnite(<input type="number" step="any" min="0" value={form.seuil} onChange={(e) => maj('seuil', e.target.value)} placeholder="500" />),
            t('Ex. 500 heures de fonctionnement entre deux révisions.'))}
          {champ(t('Valeur au dernier entretien'), avecUnite(
            <input type="number" step="any" value={form.valeurReference} onChange={(e) => maj('valeurReference', e.target.value)}
              placeholder={sondeChoisie?.derniereValeur != null ? fmt(sondeChoisie.derniereValeur) : ''} />,
          ), t('Vide : la valeur actuelle de la sonde sert de point de départ.'))}
        </div>
      )}

      {phrase(form, unite) && <p className="eq-mc-phrase"><Zap size={15} aria-hidden="true" /> {phrase(form, unite)}</p>}

      <div className="eq-lia-grille eq-mc-grille-2">
        {champ(t('Type du bon créé'), (
          <select value={form.typeBon} onChange={(e) => maj('typeBon', e.target.value)}>
            {TYPES_BON.map((x) => <option key={x.value} value={x.value}>{t(x.label)}</option>)}
          </select>
        ))}
        {champ(t('Urgence du bon'), (
          <select value={form.urgenceBon} onChange={(e) => maj('urgenceBon', e.target.value)}>
            {URGENCES.map((x) => <option key={x.value} value={x.value}>{t(x.label)}</option>)}
          </select>
        ))}
      </div>
      <label className="eq-cnx-case">
        <input type="checkbox" checked={form.actif !== false} onChange={(e) => maj('actif', e.target.checked)} />
        {t('Règle active (vérifiée automatiquement)')}
      </label>

      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
      <p className="eq-lia-astuce">{t('Un seul bon à la fois par règle. À sa clôture, la règle repart de zéro : nouvelles mesures, ou nouvelle référence du compteur.')}</p>
      <div className="eq-doc-form-actions">
        <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => { setForm(null); setErreur(''); }}>{t('Annuler')}</button>
        <button type="submit" className="eq-bouton" disabled={envoi}>
          {envoi && <Loader2 size={16} className="eq-tourne" />} {t('Enregistrer')}
        </button>
      </div>
    </form>
  );

  const resultatTest = (r) => {
    const test = tests[r.id];
    if (!test) return null;
    if (test.enCours) return <p className="eq-mc-test"><Loader2 size={14} className="eq-tourne" /> {t('Calcul…')}</p>;
    const res = test.resultat;
    const e = ETATS_REGLE[res.etat] || ETAT_INCONNU;
    return (
      <div className={`eq-mc-test eq-ton--${e.ton}`} role="status">
        <Pastille ton={e.ton}>{t(e.label)}</Pastille>
        <span dir="auto">{res.message}</span>
        {res.etat === 'ATTEINTE' && !res.bonId && (
          <button type="button" className="eq-lien" onClick={() => evaluer(r)}>{t('Créer le bon maintenant')}</button>
        )}
        {res.bonId && (
          <button type="button" className="eq-lien" onClick={() => navigate(`/bons-maintenance?id=${res.bonId}`)}>
            {t('Ouvrir le bon n° {n}', { n: res.bonNum })}
          </button>
        )}
      </div>
    );
  };

  const liste = (
    <ul className="eq-lia-liste eq-mc-liste">
      {regles.map((r) => {
        const e = ETATS_REGLE[r.dernierEtat] || ETAT_INCONNU;
        const pct = r.progression != null ? Math.min(100, Math.round(r.progression * 100)) : null;
        const ecart = r.derniereValeur != null && r.valeurReference != null ? r.derniereValeur - r.valeurReference : null;
        return (
          <li key={r.id} className={`eq-ton--${e.ton}`}>
            <div className="eq-lia-tete">
              <strong>{r.libelle}</strong>
              <Pastille ton={e.ton}>{t(e.label)}</Pastille>
            </div>
            <span className="eq-lia-detail">
              {[t(MODES.find((m) => m.value === r.mode)?.label || r.mode), r.resume, r.liaisonLibelle || r.liaisonType].filter(Boolean).join(' · ')}
            </span>
            {r.mode === 'COMPTEUR' && pct != null && (
              <div className="eq-mc-jauge" role="img" aria-label={t('{p} % de l’intervalle', { p: pct })}>
                <span className="eq-mc-jauge__piste"><span style={{ width: `${pct}%` }} data-plein={pct >= 100 ? '1' : undefined} /></span>
                <span className="eq-mc-jauge__txt" dir="ltr">{fmt(ecart, 1)} / {fmt(r.seuil)} {r.unite} · {pct} %</span>
              </div>
            )}
            {r.dernierMessage && (
              <span className="eq-lia-etat" dir="auto">{r.dernierMessage}{r.derniereEvaluation ? ` · ${dateHeure(r.derniereEvaluation)}` : ''}</span>
            )}
            {r.bonEnCoursId && (
              <button type="button" className="eq-lien eq-mc-bon" onClick={() => navigate(`/bons-maintenance?id=${r.bonEnCoursId}`)}>
                {t('Ouvrir le bon n° {n}', { n: r.bonEnCoursNum })}
              </button>
            )}
            {resultatTest(r)}
            <div className="eq-lia-actions">
              {aSupprimer === r.id ? (
                <span className="eq-doc-confirmer">
                  <button type="button" className="eq-lien eq-lien--alerte" onClick={() => supprimer(r)}>{t('Supprimer')}</button>
                  <button type="button" className="eq-lien" onClick={() => setASupprimer(null)}>{t('Annuler')}</button>
                </span>
              ) : (
                <>
                  <button type="button" className="eq-lien" onClick={() => tester(r)} disabled={r.actif === false}>
                    <FlaskConical size={14} /> {t('Tester')}
                  </button>
                  <button type="button" className="eq-lien" onClick={() => ouvrir(r)}><Pencil size={14} /> {t('Modifier')}</button>
                  <button type="button" className="eq-ico" onClick={() => setASupprimer(r.id)} aria-label={t('Supprimer la règle')} title={t('Supprimer la règle')}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Bloc
      titre={t('Maintenance conditionnelle')}
      icone={Gauge}
      action={!form && !chargement && sondes.length > 0 && (
        <button type="button" className="eq-lien" onClick={() => ouvrir(null)}>
          <Plus size={15} /> {t('Ajouter')}
        </button>
      )}
    >
      {chargement ? (
        <p className="eq-vide-texte"><Loader2 size={15} className="eq-tourne" /> {t('Chargement…')}</p>
      ) : form ? formulaire : regles.length === 0 ? (
        <p className="eq-vide-texte">
          {sondes.length === 0
            ? t('Pour créer un bon selon l’état réel de la machine (température, pression, heures de fonctionnement…), ajoutez d’abord une liaison RS485 ou Zigbee dans le bloc « Liaison avec l’agent ».')
            : t('Aucune règle : créez un bon préventif quand une sonde dépasse un seuil, monte plusieurs jours de suite ou qu’un compteur atteint son intervalle.')}
        </p>
      ) : liste}

      {!form && historique.length > 0 && (
        <div className="eq-mc-historique">
          <button type="button" className="eq-lien" onClick={() => setVoirHistorique((v) => !v)} aria-expanded={voirHistorique}>
            <History size={14} /> {t('Bons créés par ces règles ({n})', { n: historique.length })}
            <ChevronDown size={14} className={voirHistorique ? 'eq-mc-tourne' : ''} />
          </button>
          {voirHistorique && (
            <ul>
              {historique.map((d) => {
                const e = ETATS_DECLENCHEMENT[d.etat] || ETATS_DECLENCHEMENT.EN_COURS;
                return (
                  <li key={d.id}>
                    <span className="eq-mc-historique__tete">
                      <span>{dateHeure(d.dateDeclenchement)}</span>
                      <strong>{d.regleLibelle}</strong>
                      <Pastille ton={e.ton}>{t(e.label)}</Pastille>
                      {d.bonMaintenanceId && (
                        <button type="button" className="eq-lien" onClick={() => navigate(`/bons-maintenance?id=${d.bonMaintenanceId}`)}>
                          {t('Bon n° {n}', { n: d.bonMaintenanceNum })}
                        </button>
                      )}
                    </span>
                    {d.explication && <span className="eq-mc-historique__txt" dir="auto">{d.explication}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {erreur && !form && <p className="eq-erreur" role="alert">{erreur}</p>}
    </Bloc>
  );
}
