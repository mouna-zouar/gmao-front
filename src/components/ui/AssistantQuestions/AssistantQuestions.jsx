import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ChevronRight, LoaderCircle, MessageSquarePlus, Sparkles, X } from 'lucide-react';
import assistantService from '../../../services/assistantService';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  nouvelleConversation, poserQuestion, selectAssistantEnCours, selectMessagesAssistant,
} from '../../../store/assistantSlice';
import { t, langueActuelle } from '../../../i18n';
import './AssistantQuestions.css';

/*
 * « Demander à l'IA » : questions en langage naturel sur les données de la GMAO
 * (équivalent des conversations avec vos données de Maximo).
 * La réponse est écrite par l'IA ; les tableaux et les liens viennent des données (jamais inventés).
 * La conversation reste ouverte d'une page à l'autre (le panneau vit dans la mise en page).
 */

const SUGGESTIONS_DEFAUT = [
  'Quels bons sont en retard ?',
  'Quels équipements sont en panne en ce moment ?',
  'Quels équipements ont eu le plus de pannes ce trimestre ?',
  'Combien a coûté la maintenance ce mois-ci ?',
  'Les délais SLA sont-ils respectés ce mois-ci ?',
  'Quels documents de véhicules expirent bientôt ?',
];

const LIENS = {
  bon: (id) => `/bons-maintenance?id=${id}`,
  equipement: (id) => `/equipement/${id}`,
  reclamation: (id) => `/reclamations?id=${id}`,
  vehicule: () => '/vehicules',
};


/* Texte de l'IA : paragraphes, listes « - », **gras** — sans HTML injecté. */
function TexteIa({ texte }) {
  const blocs = [];
  let liste = null;
  String(texte || '').split('\n').forEach((ligne) => {
    const l = ligne.trim();
    if (!l) { liste = null; return; }
    const puce = /^[-•*]\s+(.*)$/.exec(l) || /^\d+[.)]\s+(.*)$/.exec(l);
    if (puce) {
      if (!liste) { liste = []; blocs.push({ type: 'liste', items: liste }); }
      liste.push(puce[1]);
    } else {
      liste = null;
      blocs.push({ type: 'p', texte: l });
    }
  });
  const gras = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((m, i) => (
    m.startsWith('**') && m.endsWith('**') ? <strong key={i}>{m.slice(2, -2)}</strong> : <Fragment key={i}>{m}</Fragment>
  ));
  return (
    <div className="aq-texte" dir="auto">
      {blocs.map((b, i) => (b.type === 'liste'
        ? <ul key={i}>{b.items.map((it, k) => <li key={k}>{gras(it)}</li>)}</ul>
        : <p key={i}>{gras(b.texte)}</p>))}
    </div>
  );
}

/* Tableau d'un outil : chaque ligne avec lien ouvre l'élément. */
function TableauResultat({ r, onOuvrir }) {
  if (!r.colonnes?.length || !r.lignes?.length) return null;
  const autres = (r.total || 0) - r.lignes.length;
  return (
    <section className="aq-resultat">
      <header>
        <h4 dir="auto">{t(r.titre)}</h4>
        <span className="aq-pastille">{r.total}</span>
      </header>
      <div className="aq-table-defile">
        <table>
          <thead><tr>{r.colonnes.map((c) => <th key={c}>{t(c)}</th>)}</tr></thead>
          <tbody>
            {r.lignes.map((l, i) => {
              const lien = l.lienType && LIENS[l.lienType] ? LIENS[l.lienType](l.lienId) : null;
              return (
                <tr key={i} className={lien ? 'is-lien' : ''} onClick={lien ? () => onOuvrir(lien) : undefined}
                  tabIndex={lien ? 0 : undefined} onKeyDown={lien ? (e) => { if (e.key === 'Enter') onOuvrir(lien); } : undefined}
                  title={lien ? t('Ouvrir') : undefined}>
                  {l.valeurs.map((v, k) => <td key={k} dir="auto">{v === '' || v == null ? '—' : String(v)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {autres > 0 && <p className="aq-autres">{t('… et {n} autre(s)', { n: autres })}</p>}
    </section>
  );
}

export default function AssistantQuestions({ ouvert, onFermer }) {
  const navigate = useNavigate();
  // Conversation dans le store Redux (src/store/assistantSlice.js) : gardée d'une page à l'autre
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessagesAssistant);
  const enCours = useAppSelector(selectAssistantEnCours);
  const [saisie, setSaisie] = useState('');
  const [suggestions, setSuggestions] = useState(SUGGESTIONS_DEFAUT);
  const finRef = useRef(null);
  const saisieRef = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    setTimeout(() => saisieRef.current?.focus(), 50);
    assistantService.suggestions().then((l) => { if (l.length) setSuggestions(l); }).catch(() => {});
    const echap = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert, onFermer]);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, enCours]);

  const envoyer = async (texte) => {
    const question = (texte ?? saisie).trim();
    if (!question || enCours) return;
    setSaisie('');
    await dispatch(poserQuestion({ question, langue: langueActuelle() }));
    setTimeout(() => saisieRef.current?.focus(), 50);
  };

  const ouvrir = (lien) => {
    navigate(lien);
    if (window.innerWidth < 900) onFermer();
  };

  if (!ouvert) return null;

  return (
    <>
      <div className="aq-voile" onClick={onFermer} aria-hidden="true" />
      <aside className="aq-panneau" role="dialog" aria-label={t('Assistant GMAO')}>
        <header className="aq-tete">
          <span className="aq-tete__icone"><Sparkles size={18} aria-hidden="true" /></span>
          <div className="aq-tete__texte">
            <h2>{t('Assistant GMAO')}</h2>
            <p>{t('Posez une question sur vos données')}</p>
          </div>
          {messages.length > 0 && (
            <button type="button" className="aq-icone-btn" onClick={() => dispatch(nouvelleConversation())} title={t('Nouvelle conversation')} aria-label={t('Nouvelle conversation')}>
              <MessageSquarePlus size={17} />
            </button>
          )}
          <button type="button" className="aq-icone-btn" onClick={onFermer} title={t('Fermer')} aria-label={t('Fermer')}>
            <X size={18} />
          </button>
        </header>

        <div className="aq-fil" aria-live="polite">
          {messages.length === 0 && (
            <div className="aq-accueil">
              <Sparkles size={26} aria-hidden="true" />
              <h3>{t('Que voulez-vous savoir ?')}</h3>
              <p>{t('Bons, équipements, pannes, délais, coûts, réclamations, alertes et véhicules : je cherche dans la GMAO et je vous réponds avec les chiffres.')}</p>
              <div className="aq-suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => envoyer(t(s))}>
                    <span dir="auto">{t(s)}</span><ChevronRight size={14} className="rtl-miroir" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (m.role === 'moi' ? (
            <div key={i} className="aq-bulle aq-bulle--moi" dir="auto">{m.texte}</div>
          ) : (
            <div key={i} className="aq-bulle aq-bulle--ia">
              {m.reponse && <TexteIa texte={m.reponse} />}
              {(m.message || m.injoignable) && <p className="aq-message">{m.message ? t(m.message) : t('L’assistant est injoignable pour le moment.')}</p>}
              {(m.resultats || []).map((r, k) => <TableauResultat key={k} r={r} onOuvrir={ouvrir} />)}
              {m.suggestions?.length > 0 && (
                <div className="aq-suggestions aq-suggestions--petites">
                  {m.suggestions.slice(0, 3).map((s) => (
                    <button key={s} type="button" onClick={() => envoyer(t(s))}><span dir="auto">{t(s)}</span></button>
                  ))}
                </div>
              )}
            </div>
          )))}

          {enCours && (
            <div className="aq-bulle aq-bulle--ia aq-attente">
              <LoaderCircle size={16} className="aq-tourne" aria-hidden="true" />
              {t('Je cherche dans vos données…')}
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form className="aq-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
          <textarea
            ref={saisieRef}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
            placeholder={t('Ex. : quels bons préventifs sont en retard ?')}
            rows={1}
            maxLength={500}
            dir="auto"
            aria-label={t('Votre question')}
          />
          <button type="submit" className="aq-envoyer" disabled={!saisie.trim() || enCours} aria-label={t('Envoyer')} title={t('Envoyer')}>
            <ArrowUp size={18} />
          </button>
        </form>
        <p className="aq-note">{t('Réponses générées par l’IA à partir des données de la GMAO : vérifiez avant de décider.')}</p>
      </aside>
    </>
  );
}
