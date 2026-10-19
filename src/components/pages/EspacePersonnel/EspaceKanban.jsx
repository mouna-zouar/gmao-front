import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ExternalLink,
  Eye,
  GripVertical,
  Loader2,
  MoveRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { t, tp, locale, estRTL } from '../../../i18n';
import { COLONNES_KANBAN, comparerEcheances, refBon, statutEcheance, versDate } from './espacePlanning';

/*
 * Mes tâches en tableau kanban : une colonne par état, on glisse une carte vers une autre
 * colonne pour changer l'état de la tâche. Sur écran tactile ou au clavier, le menu
 * « Déplacer vers… » de chaque carte fait la même chose.
 */

const TERMINEES = [4, 10];
const ETAT_EFFECTUE = 4;
const CARTES_PAR_PAGE = 4;

const dateCourte = (v) => {
  const d = versDate(v);
  return d ? d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) : null;
};

function CarteTache({ tache, bon, enCours, glissee, onDragStart, onDragEnd, onDeplacer, onApercu, onOuvrirBon }) {
  const echeance = tache.dateFin || tache.dateDebut;
  // Une tâche terminée ou annulée n'est plus « en retard »
  const statut = TERMINEES.includes(tache.etat) ? null : statutEcheance(echeance);
  const debut = dateCourte(tache.dateDebut);
  const fin = dateCourte(tache.dateFin);
  const estEffectuee = tache.etat === ETAT_EFFECTUE;

  return (
    <article
      className={`ep-kcarte ${glissee ? 'is-glissee' : ''} ${enCours ? 'is-envoi' : ''} ${statut ? `ep-kcarte--${statut.niveau}` : ''} ${estEffectuee ? 'is-effectuee' : ''}`}
      draggable={!enCours}
      onDragStart={(e) => onDragStart(e, tache)}
      onDragEnd={onDragEnd}
      aria-label={tache.designation}
    >
      <div className="ep-kcarte-haut">
        <GripVertical size={14} className="ep-kcarte-poignee" aria-hidden="true" />
        {estEffectuee && (
          <CheckCircle2
            size={15}
            className="ep-kcarte-check"
            aria-label={t('Effectuée')}
          />
        )}
        <h3>{tache.designation || tache.nom || t('Tâche sans nom')}</h3>
        {enCours && <Loader2 size={14} className="ep-spin" aria-label={t('Enregistrement…')} />}
      </div>

      {(bon || tache.bonMaintenanceId != null) && (
        <p className="ep-kcarte-bon" title={bon?.titre || ''}>
          <strong>{refBon(bon, tache.bonMaintenanceId)}</strong>
          {bon?.titre ? ` · ${bon.titre}` : ''}
        </p>
      )}

      <div className="ep-kcarte-meta">
        {(debut || fin) && (
          <span className="ep-date">
            <CalendarDays size={12} />
            {debut && fin && debut !== fin ? `${debut} ${estRTL() ? '←' : '→'} ${fin}` : (fin || debut)}
          </span>
        )}
        {statut && statut.niveau !== 'plus-tard' && (
          <span className={`ep-echeance ep-echeance--${statut.niveau}`}>{statut.texte}</span>
        )}
      </div>

      <div className="ep-kcarte-actions">
        <button type="button" className="ep-kbouton" onClick={() => onApercu(tache)} title={t('Aperçu')} aria-label={t('Aperçu')}>
          <Eye size={14} />
        </button>
        {tache.bonMaintenanceId != null && (
          <button type="button" className="ep-kbouton" onClick={() => onOuvrirBon(bon || { id: tache.bonMaintenanceId })} title={t('Ouvrir le bon')} aria-label={t('Ouvrir le bon')}>
            <ExternalLink size={14} />
          </button>
        )}
        <label className="ep-kdeplacer" title={t('Déplacer vers…')}>
          <MoveRight size={14} className="rtl-miroir" aria-hidden="true" />
          <span>{t('Déplacer')}</span>
          <select
            value=""
            disabled={enCours}
            aria-label={t('Déplacer « {nom} » vers…', { nom: tache.designation || '' })}
            onChange={(e) => { if (e.target.value) onDeplacer(tache, Number(e.target.value)); }}
          >
            <option value="" disabled>{t('Déplacer vers…')}</option>
            {COLONNES_KANBAN.filter((c) => c.etat !== tache.etat).map((c) => (
              <option key={c.etat} value={c.etat}>{t(c.label)}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

export default function EspaceKanban({ taches, bonsParId, enCours, onDeplacer, onApercu, onOuvrirBon }) {
  const [glisseeId, setGlisseeId] = useState(null);
  const [survol, setSurvol] = useState(null);
  const [afficherAnnulees, setAfficherAnnulees] = useState(false);
  // Page courante par état de colonne : { [etat]: numero }
  const [pages, setPages] = useState({});

  const pageDe = (etat) => pages[etat] ?? 0;
  const changerPage = (etat, p) => setPages((prev) => ({ ...prev, [etat]: p }));

  const parEtat = useMemo(() => {
    const map = new Map(COLONNES_KANBAN.map((c) => [c.etat, []]));
    taches.forEach((tache) => {
      const etat = map.has(tache.etat) ? tache.etat : 1;
      map.get(etat).push({
        tache,
        cle: tache.id,
        echeance: tache.dateFin || tache.dateDebut,
        statut: TERMINEES.includes(tache.etat) ? null : statutEcheance(tache.dateFin || tache.dateDebut),
      });
    });
    map.forEach((liste) => liste.sort(comparerEcheances));
    return map;
  }, [taches]);

  const tacheGlissee = taches.find((x) => x.id === glisseeId);
  const nbAnnulees = parEtat.get(10).length;
  const colonnes = COLONNES_KANBAN.filter((c) => c.etat !== 10 || afficherAnnulees);

  const debutGlisse = (e, tache) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tache.id));
    setGlisseeId(tache.id);
  };
  const finGlisse = () => { setGlisseeId(null); setSurvol(null); };

  const accepte = (colonne) => tacheGlissee && tacheGlissee.etat !== colonne.etat;

  return (
    <div className="ep-kanban-zone">
      <div className="ep-kanban-outils">
    
        {nbAnnulees > 0 && (
          <button type="button" className="ep-klien" onClick={() => setAfficherAnnulees((v) => !v)} aria-pressed={afficherAnnulees}>
            {afficherAnnulees ? t('Masquer les tâches annulées') : tp('tâche annulée masquée', nbAnnulees)}
          </button>
        )}
      </div>

      <div className="ep-kanban" style={{ '--ep-k-colonnes': colonnes.length }}>
        {colonnes.map((col) => {
          const cartes = parEtat.get(col.etat);
          const cible = survol === col.etat && accepte(col);
          const nbPages = Math.max(1, Math.ceil(cartes.length / CARTES_PAR_PAGE));
          const pageCourante = Math.min(pageDe(col.etat), nbPages - 1);
          const debut = pageCourante * CARTES_PAR_PAGE;
          const cartesPage = cartes.slice(debut, debut + CARTES_PAR_PAGE);

          return (
            <section
              key={col.etat}
              className={`ep-kcolonne ep-ton--${col.ton} ${cible ? 'is-cible' : ''} ${tacheGlissee && !accepte(col) ? 'is-source' : ''}`}
              aria-label={t(col.label)}
              onDragOver={(e) => {
                if (!accepte(col)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (survol !== col.etat) setSurvol(col.etat);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setSurvol((s) => (s === col.etat ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData('text/plain'));
                const tache = taches.find((x) => x.id === id);
                finGlisse();
                if (tache && tache.etat !== col.etat) onDeplacer(tache, col.etat);
              }}
            >
              <header className="ep-kcolonne-entete">
                <span className="ep-kcolonne-point" />
                <h3>{t(col.label)}</h3>
                <span className="ep-kcolonne-nb">{cartes.length}</span>
              </header>

              <div className="ep-kcolonne-cartes">
                {cartesPage.map(({ tache }) => (
                  <CarteTache
                    key={tache.id}
                    tache={tache}
                    bon={bonsParId.get(tache.bonMaintenanceId)}
                    enCours={enCours.has(tache.id)}
                    glissee={glisseeId === tache.id}
                    onDragStart={debutGlisse}
                    onDragEnd={finGlisse}
                    onDeplacer={onDeplacer}
                    onApercu={onApercu}
                    onOuvrirBon={onOuvrirBon}
                  />
                ))}
                {cartes.length === 0 && (
                  <p className="ep-kcolonne-vide">{cible ? t('Déposez ici') : t('Aucune tâche')}</p>
                )}
                {cartes.length > 0 && cible && <p className="ep-kcolonne-depot">{t('Déposez ici')}</p>}

                {/* Pagination de la colonne (4 cartes par page) */}
                {nbPages > 1 && (
                  <nav className="ep-kcolonne-pagination" aria-label={t('Pagination des tâches')}>
                    <button
                      type="button"
                      onClick={() => changerPage(col.etat, pageCourante - 1)}
                      disabled={pageCourante === 0}
                      aria-label={t('Page précédente')}
                    >
                      <ChevronLeft size={14} className="rtl-miroir" />
                    </button>
                    <span aria-live="polite">
                      {pageCourante + 1} / {nbPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => changerPage(col.etat, pageCourante + 1)}
                      disabled={pageCourante >= nbPages - 1}
                      aria-label={t('Page suivante')}
                    >
                      <ChevronRight size={14} className="rtl-miroir" />
                    </button>
                  </nav>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}