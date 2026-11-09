import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import reclamationService from '../../../services/Reclamationservice';
import './VerificationsReclamation.css';

/*
 * Champ « Vérifications » de la fenêtre de réclamation (champ personnalisé du formulaire dynamique).
 * valeur : { equipementId, checklist, reponses: { 0: 'OUI', …, finale: 'NON' }, chargement, erreur }
 * Les questions dépendent de la famille de l'équipement choisi : rechargées quand il change.
 */

const REPONSES = [
  { valeur: 'OUI', label: 'Oui' },
  { valeur: 'NON', label: 'Non' },
  { valeur: 'NA', label: 'Sans objet' },
];
const LIBELLE = { OUI: 'Oui', NON: 'Non', NA: 'Sans objet' };

const nbReponses = (v) => (v?.checklist?.questions ?? []).filter((_, i) => v.reponses?.[i]).length + (v?.reponses?.finale ? 1 : 0);

/** Message qui empêche de continuer, ou null (si les questions n'ont pas pu être chargées, on laisse passer). */
export function manqueVerifications(v, equipementId) {
  if (!equipementId) return 'Choisis d’abord l’équipement concerné.';
  if (v?.erreur && String(v.equipementId) === String(equipementId)) return null;
  if (!v?.checklist || v.chargement || String(v.equipementId) !== String(equipementId)) {
    return 'Les vérifications sont en cours de chargement, réessaie dans un instant.';
  }
  if (nbReponses(v) < v.checklist.questions.length + 1) return 'Réponds à toutes les vérifications pour continuer.';
  return null;
}

/** Réponses envoyées au serveur : [{ question, reponse }], ou null. */
export function reponsesChecklist(v) {
  if (!v?.checklist) return null;
  return [
    ...v.checklist.questions.map((q, i) => ({ question: q, reponse: LIBELLE[v.reponses?.[i]] })),
    { question: v.checklist.questionFinale, reponse: LIBELLE[v.reponses?.finale] },
  ];
}

/** Le demandeur dit que le problème a disparu après les vérifications. */
export const problemeRegle = (v) => v?.reponses?.finale === 'NON';

function Choix({ question, valeur, options, onChoisir }) {
  return (
    <span className="vr-choix" role="radiogroup" aria-label={question}>
      {options.map((r) => (
        <button key={r.valeur} type="button" role="radio" aria-checked={valeur === r.valeur}
          className={`vr-btn ${valeur === r.valeur ? `is-choisi is-${r.valeur.toLowerCase()}` : ''}`}
          onClick={() => onChoisir(r.valeur)}>
          {r.label}
        </button>
      ))}
    </span>
  );
}

export default function VerificationsReclamation({ equipementId, valeur, onChange }) {
  const v = valeur || {};

  // Questions de la famille de l'équipement (les réponses repartent de zéro quand il change)
  useEffect(() => {
    if (!equipementId || String(v.equipementId) === String(equipementId)) return undefined;
    let annule = false;
    onChange({ equipementId, chargement: true, reponses: {} });
    reclamationService.checklist(equipementId)
      .then((checklist) => { if (!annule) onChange({ equipementId, checklist, reponses: {} }); })
      .catch(() => { if (!annule) onChange({ equipementId, erreur: true, reponses: {} }); });
    return () => { annule = true; };
  }, [equipementId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!equipementId) return <p className="vr-vide">Choisis d’abord l’équipement concerné (étape Équipement).</p>;
  if (v.chargement || String(v.equipementId) !== String(equipementId)) {
    return <p className="vr-vide"><Loader2 size={15} className="cf-tourne" /> Chargement des vérifications…</p>;
  }
  if (v.erreur) return <p className="vr-vide">Les vérifications n’ont pas pu être chargées. Tu peux quand même envoyer la réclamation.</p>;

  const c = v.checklist;
  const repondre = (cle, r) => onChange({ ...v, reponses: { ...v.reponses, [cle]: r } });
  const points = [
    ...c.questions.map((q, i) => ({ cle: i, question: q, options: REPONSES })),
    { cle: 'finale', question: c.questionFinale, options: REPONSES.filter((r) => r.valeur !== 'NA'), finale: true },
  ];

  return (
    <div className="vr">
      <p className="vr-famille">
        {c.familleNom ? `${c.parDefaut ? 'Vérifications générales' : 'Vérifications'} — famille ${c.familleNom}` : 'Vérifications générales'}
        <span>{nbReponses(v)} / {points.length}</span>
      </p>
      <ol className="vr-liste">
        {points.map((p) => (
          <li key={p.cle} className={`vr-point ${p.finale ? 'vr-point--finale' : ''} ${v.reponses?.[p.cle] ? 'is-repondu' : ''}`}>
            <span className="vr-question">{p.question}</span>
            <Choix question={p.question} valeur={v.reponses?.[p.cle]} options={p.options} onChoisir={(r) => repondre(p.cle, r)} />
          </li>
        ))}
      </ol>
    </div>
  );
}
