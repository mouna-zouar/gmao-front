import { useEffect, useState } from 'react';
import {
  AlertCircle, AlertTriangle, Check, ClipboardList, Loader2, MessageSquare, Package, Plus, Sparkles, Trash2, UserPlus, Users,
} from 'lucide-react';
import ListeRecherche from '../../commun/ListeRecherche';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import lotArticleService from '../../../services/lotArticleService';
import pieceLigneService from '../../../services/pieceLigneService';
import diagnosticAssistantService from '../../../services/Diagnosticassistantservice';
import repartitionInterventionsService from '../../../services/repartitionInterventionsService';
import { optionsTypeEntretien } from '../../../constants/FicheIntervention';
import { t, locale } from '../../../i18n';

/*
 * Morceaux de la fenêtre « Bon de maintenance » (champs personnalisés de ModaleFormulaire) :
 * type d'entretien, stock de l'équipement, assistant diagnostic, intervenants, tâches, commentaires.
 * Les listes (intervenants, tâches, commentaires) sont gardées dans les valeurs du formulaire
 * et envoyées à la création comme « enfants » du bon.
 */

export const nomPrestataire = (p) => p?.raisonSociale || `${p?.nom ?? ''} ${p?.prenom ?? ''}`.trim() || (p ? t('Prestataire #{id}', { id: p.id }) : '—');
export const nomPersonnel = (p) => `${p?.nom || ''} ${p?.prenom || ''}`.trim() + (p?.matricule ? ` (${p.matricule})` : '');
const aideMatricule = (p) => (p.matricule ? t('Matricule : {m}', { m: p.matricule }) : null);
const aideCode = (p) => (p.code ? t('Code : {c}', { c: p.code }) : null);
const nouvelId = () => Date.now() + Math.random();
/** « Entrée » dans une ligne d'ajout n'envoie pas la fenêtre (ni ne passe à l'étape suivante). */
const sansEntree = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); };

/** Type d'entretien : les cases de la fiche d'intervention ENR-MMT 10, avec leur explication. */
export function ChoixTypeEntretien({ valeur, changer }) {
  return (
    <div className="cf-choix" role="radiogroup" aria-label={t("Type d'entretien")}>
      {optionsTypeEntretien(valeur).map((o) => {
        const actif = String(valeur) === String(o.value);
        return (
          <label key={o.value} className={`cf-choix__option ${actif ? 'is-actif' : ''}`}>
            <input type="radio" name="type" value={o.value} checked={actif} onChange={() => changer(String(o.value))} />
            <span className="cf-choix__nom">{t(o.label)}</span>
            {o.aide && <span className="cf-choix__aide">{t(o.aide)}</span>}
          </label>
        );
      })}
    </div>
  );
}

/** Quantité en stock du lot de l'équipement choisi (alerte si épuisé). */
export function StockEquipement({ equipementId }) {
  const [etat, setEtat] = useState({ chargement: false, qte: null });
  useEffect(() => {
    if (!equipementId) { setEtat({ chargement: false, qte: null }); return undefined; }
    let annule = false;
    setEtat({ chargement: true, qte: null });
    lotArticleImmobilistationService.getById(equipementId)
      .then((immo) => (immo?.lotArticleId ? lotArticleService.getById(immo.lotArticleId) : null))
      .then((lot) => { if (!annule) setEtat({ chargement: false, qte: lot?.qte ?? null }); })
      .catch(() => { if (!annule) setEtat({ chargement: false, qte: null }); });
    return () => { annule = true; };
  }, [equipementId]);
  if (!equipementId) return null;
  if (etat.chargement) return <p className="cf-aide">{t('Vérification du stock...')}</p>;
  if (etat.qte != null && Number(etat.qte) <= 0) return <p className="cf-erreur"><AlertTriangle size={13} aria-hidden="true" /> {t('Stock : {n}', { n: etat.qte })} — {t('Quantité non disponible.')}</p>;
  return <p className="cf-aide">{etat.qte != null ? t('Stock : {n}', { n: etat.qte }) : t('Stock inconnu')}</p>;
}

const ORIGINES = { meme_equipement: 'Même équipement', meme_type_equipement: "Même type d'équipement" };

/** Assistant diagnostic : cas similaires de l'historique ; « Utiliser » remplit cause, effet et remède. */
export function AssistantDiagnostic({ valeurs, changerChamp }) {
  const [suggestions, setSuggestions] = useState([]);
  const [appliquees, setAppliquees] = useState(new Set());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [demande, setDemande] = useState(false);

  const analyser = async () => {
    if (!String(valeurs.titre || '').trim() && !String(valeurs.description || '').trim()) {
      setErreur(t('Renseigne un titre ou une description.'));
      return;
    }
    setChargement(true); setErreur(null); setDemande(true); setAppliquees(new Set());
    try {
      setSuggestions((await diagnosticAssistantService.suggerer({
        titre: valeurs.titre, description: valeurs.description,
        lotArticleImmobilistationId: valeurs.lotArticleImmobilistationId || null,
      })) ?? []);
    } catch (err) {
      console.error(err);
      setErreur(t('Impossible de récupérer des suggestions.'));
      setSuggestions([]);
    } finally {
      setChargement(false);
    }
  };

  const utiliser = (s, i) => {
    if (s.causeProbable) changerChamp('cause', s.causeProbable);
    if (s.remedeSuggere) changerChamp('remede', s.remedeSuggere);
    if (s.effetAssocie) changerChamp('effet', s.effetAssocie);
    setAppliquees((a) => new Set(a).add(i));
  };

  return (
    <div className="cf-assistant">
      <div className="cf-assistant__tete">
        <span className="cf-assistant__icone"><Sparkles size={16} aria-hidden="true" /></span>
        <span className="cf-assistant__titre"><strong>{t('Assistant diagnostic')}</strong><small>{t("Compare à l'historique des interventions")}</small></span>
        <button type="button" className="cm-btn" onClick={analyser} disabled={chargement}>
          {chargement ? <Loader2 size={15} className="cf-tourne" /> : <Sparkles size={15} />} {chargement ? t('Analyse...') : t('Analyser')}
        </button>
      </div>
      {erreur && <p className="cf-erreur"><AlertCircle size={13} aria-hidden="true" /> {erreur}</p>}
      {demande && !chargement && !erreur && suggestions.length === 0 && <p className="cf-aide">{t('Aucun cas similaire trouvé.')}</p>}
      {suggestions.length > 0 && appliquees.size === suggestions.length && <p className="cf-aide">{t('Toutes les suggestions ont été appliquées.')}</p>}
      {suggestions.some((_, i) => !appliquees.has(i)) && (
        <ul className="cf-suggestions">
          {suggestions.map((s, i) => (appliquees.has(i) ? null : (
            <li key={i} className="cf-suggestion">
              <div className="cf-suggestion__tete">
                <span className="cf-suggestion__badge">{t(ORIGINES[s.origineMatch] || 'Symptômes similaires')}</span>
                <span className="cf-suggestion__score">{t('{c}% · {n} cas', { c: s.confiance, n: s.occurrences })}</span>
              </div>
              <p><strong>{t('Cause')} :</strong> {s.causeProbable || '—'}</p>
              {s.effetAssocie && <p><strong>{t('Effet')} :</strong> {s.effetAssocie}</p>}
              <p><strong>{t('Solution')} :</strong> {s.remedeSuggere || '—'}</p>
              <button type="button" className="cm-btn" onClick={() => utiliser(s, i)}><Check size={15} /> {t('Utiliser')}</button>
            </li>
          )))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Listes d'éléments ajoutés avant l'enregistrement ───────── */

function Elements({ elements, icone: Icone, vide, rendu, onRetirer }) {
  if (!elements.length) {
    return <div className="cf-elements-vide"><Icone size={26} strokeWidth={1.6} aria-hidden="true" /><span>{vide}</span></div>;
  }
  return (
    <ul className="cf-elements">
      {elements.map((e) => (
        <li key={e._id} className="cf-element">
          <div className="cf-element__texte">{rendu(e)}</div>
          <button type="button" className="cf-element__retirer" onClick={() => onRetirer(e._id)} aria-label={t('Retirer')} title={t('Retirer')}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const INTERVENANT_VIDE = { personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '', nbrHeure: '', coutUnitaire: '', forfait: '', commentaire: '' };

/** Intervenants (techniciens internes ou sous-traitants), avec les suggestions « Qui affecter ? ». */
export function ListeIntervenants({ valeur = [], changer, valeurs, changerChamp, techniciens, personnels, prestataires, chargement }) {
  const [form, setForm] = useState(INTERVENANT_VIDE);
  const [message, setMessage] = useState(null);
  const [sugg, setSugg] = useState({ liste: [], chargement: false, erreur: null, demande: false });
  const maj = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setMessage(null); };

  const suggerer = async () => {
    setSugg({ liste: [], chargement: true, erreur: null, demande: true });
    try {
      const liste = await repartitionInterventionsService.suggererTechniciens({
        lotArticleImmobilistationId: valeurs.lotArticleImmobilistationId || null,
        dateDebut: valeurs.date || null, dateFin: valeurs.dateFinIntervention || null,
      });
      setSugg({ liste: liste ?? [], chargement: false, erreur: null, demande: true });
    } catch (err) {
      console.error(err);
      setSugg({ liste: [], chargement: false, erreur: t('Impossible de calculer des suggestions.'), demande: true });
    }
  };

  const ajouter = () => {
    if (!form.personnelId && !form.sousTraitantId) { setMessage(t('Sélectionne un technicien ou un sous-traitant.')); return; }
    changer([...valeur, { ...form, _id: nouvelId() }]);
    setForm(INTERVENANT_VIDE);
  };

  const retirer = (id) => {
    const retire = valeur.find((i) => i._id === id);
    const reste = valeur.filter((i) => i._id !== id);
    changer(reste);
    // Comme dans Cubix : un article ne se commande qu'auprès d'un sous-traitant du bon.
    // Sous-traitant retiré du bon → retiré aussi des tâches qui l'utilisaient.
    const st = retire?.sousTraitantId;
    if (st && !reste.some((i) => String(i.sousTraitantId) === String(st))) {
      changerChamp('taches', (valeurs.taches || []).map((x) => (String(x.sousTraitantId) === String(st) ? { ...x, sousTraitantId: '' } : x)));
    }
  };

  const nomIntervenant = (i) => {
    const p = personnels.find((x) => String(x.id) === String(i.personnelId)) || techniciens.find((x) => String(x.id) === String(i.personnelId));
    if (p) return `${p.nom || ''} ${p.prenom || ''}`.trim();
    return nomPrestataire(prestataires.find((x) => String(x.id) === String(i.sousTraitantId)));
  };

  return (
    <>
      <div className="cf-assistant">
        <div className="cf-assistant__tete">
          <span className="cf-assistant__icone"><UserPlus size={16} aria-hidden="true" /></span>
          <span className="cf-assistant__titre"><strong>{t('Qui affecter ?')}</strong><small>{t('Suggestions selon expérience et charge')}</small></span>
          <button type="button" className="cm-btn" onClick={suggerer} disabled={sugg.chargement}>
            {sugg.chargement ? <Loader2 size={15} className="cf-tourne" /> : <Sparkles size={15} />} {sugg.chargement ? t('Analyse...') : t('Suggérer')}
          </button>
        </div>
        {sugg.erreur && <p className="cf-erreur"><AlertCircle size={13} aria-hidden="true" /> {sugg.erreur}</p>}
        {sugg.demande && !sugg.chargement && !sugg.erreur && sugg.liste.length === 0 && <p className="cf-aide">{t('Aucun technicien candidat.')}</p>}
        {sugg.liste.length > 0 && (
          <ul className="cf-suggestions cf-suggestions--defile">
            {sugg.liste.map((s) => (
              <li key={s.personnelId} className="cf-suggestion">
                <div className="cf-suggestion__tete">
                  <span className="cf-suggestion__badge">{s.nbInterventionsSurCeType > 0 ? t('{n} intervention(s)', { n: s.nbInterventionsSurCeType }) : t('Sans historique')}</span>
                  <span className="cf-suggestion__score">{s.score}%</span>
                </div>
                <p><strong>{s.prenom} {s.nom}</strong>{s.fonction ? ` — ${s.fonction}` : ''}</p>
                <p>{t('Charge : {n} en cours', { n: s.chargeActuelle })}{s.conflitPeriode && <span className="cf-suggestion__alerte"> · {t('occupé')}</span>}</p>
                <button type="button" className="cm-btn" onClick={() => maj('personnelId', String(s.personnelId))}><UserPlus size={15} /> {t('Choisir')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cf-ajout" onKeyDown={sansEntree}>
        <div className="cf-ajout__champ cf-ajout__champ--large">
          <span>{t('Technicien interne')}</span>
          <ListeRecherche id="bm-interv-personnel" name="personnelId" value={form.personnelId} onChange={(e) => maj('personnelId', e.target.value)}
            options={techniciens} loading={chargement} getLabel={nomPersonnel} getOptionHint={aideMatricule}
            placeholder={t('Rechercher un technicien...')} emptyMessage={t('Aucun technicien ne correspond')} allowEmpty emptyOptionLabel={t('— Technicien interne —')} />
        </div>
        <div className="cf-ajout__champ cf-ajout__champ--large">
          <span>{t('Sous-traitant')}</span>
          <ListeRecherche id="bm-interv-st" name="sousTraitantId" value={form.sousTraitantId} onChange={(e) => maj('sousTraitantId', e.target.value)}
            options={prestataires} loading={chargement} getLabel={nomPrestataire} getOptionHint={aideCode}
            placeholder={t('Rechercher un sous-traitant...')} emptyMessage={t('Aucun sous-traitant ne correspond')} allowEmpty emptyOptionLabel={t('— Sous-traitant —')} />
        </div>
        <label className="cf-ajout__champ"><span>{t('Début')}</span><input type="datetime-local" value={form.dateDebutIntervention} onChange={(e) => maj('dateDebutIntervention', e.target.value)} /></label>
        <label className="cf-ajout__champ"><span>{t('Fin')}</span><input type="datetime-local" value={form.dateFinIntervention} onChange={(e) => maj('dateFinIntervention', e.target.value)} /></label>
        <label className="cf-ajout__champ cf-ajout__champ--etroit"><span>{t('Nb heures')}</span><input type="number" min="0" value={form.nbrHeure} onChange={(e) => maj('nbrHeure', e.target.value)} /></label>
        {form.sousTraitantId ? (
          // Sous-traitant : prix forfaitaire de la prestation, comme dans Cubix
          <label className="cf-ajout__champ cf-ajout__champ--etroit"><span>{t('Forfait (DT)')}</span><input type="number" min="0" step="0.001" value={form.forfait} onChange={(e) => maj('forfait', e.target.value)} /></label>
        ) : (
          <label className="cf-ajout__champ cf-ajout__champ--etroit"><span>{t('Coût unitaire')}</span><input type="number" min="0" value={form.coutUnitaire} onChange={(e) => maj('coutUnitaire', e.target.value)} /></label>
        )}
        <label className="cf-ajout__champ cf-ajout__champ--large"><span>{t('Commentaire')}</span><input type="text" value={form.commentaire} onChange={(e) => maj('commentaire', e.target.value)} /></label>
        <button type="button" className="cm-btn cf-ajout__bouton" onClick={ajouter}><Plus size={15} /> {t('Ajouter')}</button>
      </div>
      {message && <p className="cf-erreur"><AlertCircle size={13} aria-hidden="true" /> {message}</p>}

      <Elements elements={valeur} icone={Users} vide={t('Aucun intervenant ajouté')} onRetirer={retirer}
        rendu={(i) => (
          <>
            <strong>{nomIntervenant(i)}</strong>
            {(i.nbrHeure || (i.sousTraitantId && i.forfait)) && (
              <small>
                {[i.nbrHeure && t('{n} h', { n: i.nbrHeure }),
                  i.sousTraitantId && i.forfait && t('Forfait {m} DT', { m: Number(i.forfait).toLocaleString(locale(), { minimumFractionDigits: 3 }) })].filter(Boolean).join(' · ')}
              </small>
            )}
          </>
        )} />
    </>
  );
}

const TACHE_VIDE = { designation: '', ordre: '', dateDebut: '', dateFin: '', prestataireArticlesId: '', qte: '', sousTraitantId: '' };

/** Tâches prévues ; l'article d'une tâche se commande auprès d'un sous-traitant déjà ajouté au bon. */
export function ListeTaches({ valeur = [], changer, intervenants = [], articles, prestataires, chargement }) {
  const [form, setForm] = useState(TACHE_VIDE);
  const [message, setMessage] = useState(null);
  const [stock, setStock] = useState({ chargement: false, qte: null });
  const maj = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setMessage(null); };

  // Sous-traitants ajoutés à l'étape « Intervenants » : seuls choix possibles pour l'article d'une tâche
  const sousTraitants = prestataires.filter((p) => intervenants.some((i) => i.sousTraitantId !== '' && String(i.sousTraitantId) === String(p.id)));

  useEffect(() => {
    if (!form.prestataireArticlesId) { setStock({ chargement: false, qte: null }); return undefined; }
    let annule = false;
    setStock({ chargement: true, qte: null });
    pieceLigneService.getQuantiteDisponible(form.prestataireArticlesId)
      .then((qte) => { if (!annule) setStock({ chargement: false, qte }); })
      .catch(() => { if (!annule) setStock({ chargement: false, qte: null }); });
    return () => { annule = true; };
  }, [form.prestataireArticlesId]);

  const ajouter = () => {
    if (!form.designation.trim()) { setMessage(t('La désignation de la tâche est obligatoire.')); return; }
    changer([...valeur, { ...form, _id: nouvelId() }]);
    setForm(TACHE_VIDE);
  };

  return (
    <>
      <div className="cf-ajout" onKeyDown={sansEntree}>
        <label className="cf-ajout__champ cf-ajout__champ--large"><span>{t('Désignation')} *</span><input type="text" value={form.designation} onChange={(e) => maj('designation', e.target.value)} /></label>
        <label className="cf-ajout__champ cf-ajout__champ--etroit"><span>{t('Ordre')}</span><input type="number" value={form.ordre} onChange={(e) => maj('ordre', e.target.value)} /></label>
        <label className="cf-ajout__champ"><span>{t('Début')}</span><input type="datetime-local" value={form.dateDebut} onChange={(e) => maj('dateDebut', e.target.value)} /></label>
        <label className="cf-ajout__champ"><span>{t('Fin')}</span><input type="datetime-local" value={form.dateFin} onChange={(e) => maj('dateFin', e.target.value)} /></label>
        <div className="cf-ajout__champ cf-ajout__champ--large">
          <span>{t('Article')}</span>
          <ListeRecherche id="bm-tache-article" name="prestataireArticlesId" value={form.prestataireArticlesId} onChange={(e) => maj('prestataireArticlesId', e.target.value)}
            options={articles} loading={chargement} getLabel={(a) => a.designation || a.libelle || t('Article #{id}', { id: a.id })} getOptionHint={aideCode}
            placeholder={t('Rechercher un article...')} emptyMessage={t('Aucun article ne correspond')} allowEmpty emptyOptionLabel={t('— Article (optionnel) —')} />
        </div>
        <label className="cf-ajout__champ cf-ajout__champ--etroit"><span>{t('Qté')}</span><input type="number" min="0" value={form.qte} onChange={(e) => maj('qte', e.target.value)} /></label>
        <div className="cf-ajout__champ cf-ajout__champ--large">
          <span>{t('Sous-traitant')}</span>
          <ListeRecherche id="bm-tache-st" name="sousTraitantId" value={form.sousTraitantId} onChange={(e) => maj('sousTraitantId', e.target.value)}
            options={sousTraitants} getLabel={nomPrestataire} getOptionHint={aideCode} disabled={sousTraitants.length === 0}
            placeholder={sousTraitants.length ? t('Sous-traitant du bon...') : t('Aucun sous-traitant sur le bon')}
            emptyMessage={t('Aucun sous-traitant ne correspond')} allowEmpty emptyOptionLabel={t('— Sous-traitant —')} />
        </div>
        <button type="button" className="cm-btn cf-ajout__bouton" onClick={ajouter}><Plus size={15} /> {t('Ajouter')}</button>
      </div>
      {message && <p className="cf-erreur"><AlertCircle size={13} aria-hidden="true" /> {message}</p>}
      {form.prestataireArticlesId && (
        <p className="cf-aide">
          {stock.chargement ? t('Vérification...') : (stock.qte != null ? t('Stock : {n}', { n: stock.qte }) : t('Stock inconnu'))}
          {sousTraitants.length === 0 && <> · {t("Pour commander cet article chez un sous-traitant, ajoutez d'abord ce sous-traitant à l'étape « Intervenants ».")}</>}
        </p>
      )}

      <Elements elements={valeur} icone={ClipboardList} vide={t('Aucune tâche ajoutée')} onRetirer={(id) => changer(valeur.filter((x) => x._id !== id))}
        rendu={(x) => {
          const article = articles.find((a) => String(a.id) === String(x.prestataireArticlesId));
          const st = x.sousTraitantId ? prestataires.find((p) => String(p.id) === String(x.sousTraitantId)) : null;
          return (
            <>
              <strong>{x.designation}</strong>
              {(article || x.qte || st) && (
                <small>
                  {article && <><Package size={12} aria-hidden="true" /> {article.designation}</>}
                  {x.qte && <> · {t('Qté {n}', { n: x.qte })}</>}
                  {st && <> · {nomPrestataire(st)}</>}
                </small>
              )}
            </>
          );
        }} />
    </>
  );
}

/** Commentaires ajoutés au bon à sa création (Entrée pour ajouter). */
export function ListeCommentaires({ valeur = [], changer }) {
  const [texte, setTexte] = useState('');
  const ajouter = () => {
    if (!texte.trim()) return;
    changer([...valeur, { commentaire: texte.trim(), _id: nouvelId() }]);
    setTexte('');
  };
  return (
    <>
      <div className="cf-ajout">
        <label className="cf-ajout__champ cf-ajout__champ--plein">
          <span>{t('Nouveau commentaire')}</span>
          <input type="text" value={texte} placeholder={t('Ajouter un commentaire...')} onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ajouter(); } }} />
        </label>
        <button type="button" className="cm-btn cf-ajout__bouton" onClick={ajouter}><Plus size={15} /> {t('Ajouter')}</button>
      </div>
      <Elements elements={valeur} icone={MessageSquare} vide={t('Aucun commentaire')} onRetirer={(id) => changer(valeur.filter((c) => c._id !== id))}
        rendu={(c) => <strong className="cf-element__libre">{c.commentaire}</strong>} />
    </>
  );
}
