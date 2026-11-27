import { useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { STATS } from './dispositionTableau';
import { t } from '../../../i18n';

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Miniature({ id, titre, rendu, glisse, setGlisse, onAjouter, onModifier, onSupprimer }) {
  return (
    <li
      className={`tbg-mini ${glisse?.id === id ? 'is-glisse' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setGlisse({ source: 'galerie', id }); }}
      onDragEnd={() => setGlisse(null)}
    >
      <button type="button" className="tbg-mini-carte" onClick={() => onAjouter(id)} title={t('Cliquer ou glisser pour ajouter')}>
        <span className="tbg-mini-apercu" aria-hidden="true">{rendu}</span>
        <span className="tbg-mini-titre">{titre}</span>
      </button>
      {(onModifier || onSupprimer) && (
        <span className="tbg-mini-outils">
          {onModifier && <button type="button" onClick={() => onModifier(id)} title={t('Modifier')} aria-label={t('Modifier')}><Pencil size={13} /></button>}
          {onSupprimer && <button type="button" onClick={() => onSupprimer(id)} title={t('Supprimer définitivement')} aria-label={t('Supprimer définitivement')}><Trash2 size={13} /></button>}
        </span>
      )}
    </li>
  );
}

export default function GalerieCartes({ disposition, actions, statsRendus, glisse, setGlisse, onCreer, onModifier, onTerminer }) {
  const [recherche, setRecherche] = useState('');
  const [survol, setSurvol] = useState(false);
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const garde = (titre) => mots.every((m) => sansAccents(titre).includes(m));
  const origines = STATS.filter((s) => !disposition.stats.includes(s.id) && garde(t(s.titre)));
  const persos = disposition.persos.filter((p) => !disposition.stats.includes(p.id) && garde(p.titre));
  const peutRetirer = glisse?.source === 'stat';

  return (
    <aside
      className={`tbg ${peutRetirer ? 'is-cible' : ''} ${survol && peutRetirer ? 'is-survol' : ''}`}
      aria-label={t('Galerie de cartes')}
      onDragOver={(e) => { if (peutRetirer) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
      onDragEnter={() => setSurvol(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSurvol(false); }}
      onDrop={(e) => { e.preventDefault(); setSurvol(false); if (peutRetirer) actions.retirerStat(glisse.id); setGlisse(null); }}
    >
      <div className="tbg-tete">
        <h2>{t('Galerie de cartes')}</h2>
        <button type="button" className="tbg-fermer" onClick={onTerminer} aria-label={t('Fermer')}><X size={16} /></button>
      </div>
      <label className="tbg-recherche">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('Rechercher une carte…')} />
      </label>
      <button type="button" className="tbg-creer" onClick={onCreer}><Plus size={15} aria-hidden="true" /> {t('Créer une carte…')}</button>

      <div className="tbg-corps">
        {peutRetirer && <p className="tbg-depot">{t('Déposer ici pour retirer la carte')}</p>}
        {origines.length > 0 && (
          <>
            <h3>{t('Cartes d’origine')}</h3>
            <ul className="tbg-liste">
              {origines.map((s) => (
                <Miniature key={s.id} id={s.id} titre={t(s.titre)} rendu={statsRendus[s.id]} glisse={glisse} setGlisse={setGlisse} onAjouter={actions.ajouterStat} />
              ))}
            </ul>
          </>
        )}
        {persos.length > 0 && (
          <>
            <h3>{t('Mes cartes')}</h3>
            <ul className="tbg-liste">
              {persos.map((p) => (
                <Miniature key={p.id} id={p.id} titre={p.titre} rendu={statsRendus[p.id]} glisse={glisse} setGlisse={setGlisse}
                  onAjouter={actions.ajouterStat} onModifier={onModifier} onSupprimer={actions.supprimerPerso} />
              ))}
            </ul>
          </>
        )}
        {!origines.length && !persos.length && !peutRetirer && (
          <p className="tbg-vide">{mots.length ? t('Aucune carte ne correspond.') : t('Toutes les cartes sont déjà affichées.')}</p>
        )}
      </div>

      <div className="tbg-pied">
        <button type="button" className="tb-btn" onClick={actions.reinitialiser}><RotateCcw size={14} aria-hidden="true" /> {t('Réinitialiser')}</button>
        <button type="button" className="tb-btn tb-btn--principal" onClick={onTerminer}><Check size={14} aria-hidden="true" /> {t('Terminer')}</button>
      </div>
    </aside>
  );
}
