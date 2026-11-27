import { useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, MessageSquareWarning, RefreshCw, Target, Wrench } from 'lucide-react';
import { useRequete } from '../../../store/hooks';
import { t } from '../../../i18n';
import { phraseRaison, tonRaison } from './phrasesDecision';
import './Decision.css';

const CLE_REPLI = 'gmao.priorites-du-jour.replie';
const lireRepli = (cle) => { try { return localStorage.getItem(cle) === '1'; } catch { return false; } };

const TYPES = {
  BON: { label: 'Bon', icone: Wrench },
  TACHE: { label: 'Tâche', icone: ListChecks },
  RECLAMATION: { label: 'Réclamation', icone: MessageSquareWarning },
};

/** Ligne commune : les bons de la vue générale prennent la forme des éléments personnels. */
const versElement = (b) => (b.type ? b : {
  type: 'BON', id: b.id, bonId: b.id, num: b.num, titre: b.titre, score: b.score, raisons: b.raisons,
  sousTitre: [b.equipementNom, b.serviceNom].filter(Boolean).join(' · '),
});

/**
 * « Que faire en premier aujourd'hui ? ».
 * Sans personnelId : les bons ouverts de tout le service. Avec personnelId (« Mon espace ») :
 * les bons, tâches et réclamations de cette personne seulement, classés ensemble. onOuvrir reçoit l'élément.
 */
export default function PrioritesDuJour({ onOuvrir, limite = 5, personnelId = null, sousTitre }) {
  const cleRepli = personnelId != null ? `${CLE_REPLI}.moi` : CLE_REPLI;
  const [replie, setReplie] = useState(() => lireRepli(cleRepli));
  const personnel = personnelId != null && personnelId !== '';
  const { donnees, chargement, recharger } = useRequete(
    personnel ? 'prioritesPersonnel' : 'prioritesDuJour',
    personnel ? { limite, personnelId: Number(personnelId) } : { limite },
    { intervalleMs: 5 * 60 * 1000 },
  );
  const liste = (donnees || []).map(versElement);
  if (!chargement && !liste.length) return null;

  const basculer = () => {
    setReplie((r) => {
      try { localStorage.setItem(cleRepli, r ? '0' : '1'); } catch { /* stockage indisponible */ }
      return !r;
    });
  };

  return (
    <section className="dec-top" aria-label={t('Que faire en premier aujourd’hui ?')}>
      <header className="dec-top__tete">
        <span className="dec-top__icone"><Target size={18} strokeWidth={2.2} aria-hidden="true" /></span>
        <div className="dec-top__titres">
          <h3>{t('Que faire en premier aujourd’hui ?')}</h3>
          <p>{sousTitre || t('Classement selon la priorité, les délais SLA, la criticité et l’état des équipements')}</p>
        </div>
        <button type="button" className="dec-top__btn" onClick={() => recharger(true)} title={t('Actualiser')} aria-label={t('Actualiser')}>
          <RefreshCw size={15} className={chargement ? 'dec-tourne' : ''} aria-hidden="true" />
        </button>
        <button type="button" className="dec-top__btn" onClick={basculer} aria-expanded={!replie}
          title={replie ? t('Afficher') : t('Masquer')} aria-label={replie ? t('Afficher') : t('Masquer')}>
          <ChevronDown size={16} className={replie ? 'dec-replie' : ''} aria-hidden="true" />
        </button>
      </header>

      {!replie && (
        <ol className="dec-top__liste">
          {!liste.length && [0, 1, 2].map((i) => <li key={i} className="dec-top__fantome" aria-hidden="true" />)}
          {liste.map((b, i) => {
            const type = TYPES[b.type] || TYPES.BON;
            const Icone = type.icone;
            return (
            <li key={`${b.type}-${b.id}`}>
              <button type="button" className="dec-top__ligne" onClick={() => onOuvrir?.(b)}>
                <span className={`dec-top__rang ${i === 0 ? 'is-premier' : ''}`}>{i + 1}</span>
                <span className="dec-top__texte">
                  <strong dir="auto">
                    {personnel && <span className={`dec-type dec-type--${b.type.toLowerCase()}`}><Icone size={12} aria-hidden="true" />{t(type.label)}</span>}
                    {[b.num, b.titre].filter(Boolean).join(' · ')}
                  </strong>
                  {b.sousTitre && <small dir="auto">{b.sousTitre}</small>}
                  <span className="dec-top__raisons">
                    {b.raisons.slice(0, 3).map((r) => (
                      <span key={r.code} className={`dec-puce dec-puce--${tonRaison(r.code)}`}>{phraseRaison(r)}</span>
                    ))}
                  </span>
                </span>
                <ChevronRight size={18} className="dec-top__fleche rtl-miroir" aria-hidden="true" />
              </button>
            </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
