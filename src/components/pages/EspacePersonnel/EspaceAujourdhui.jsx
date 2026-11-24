import {
  AlertTriangle, ArrowRight, CalendarClock, ClipboardList, Hourglass, MessageCircle, Plus, Sparkles, Wrench,
} from 'lucide-react';
import { t } from '../../../i18n';
import { MiniCalendrier } from './EspaceAgenda';

const NIVEAUX = {
  retard: { libelle: 'En retard', ton: 'alerte' },
  aujourdhui: { libelle: "Aujourd'hui", ton: 'attention' },
  proche: { libelle: 'Bientôt', ton: 'info' },
  'plus-tard': { libelle: 'Plus tard', ton: 'neutre' },
};

function Indicateur({ icone: Icone, valeur, libelle, ton = 'neutre', onClick, aide }) {
  return (
    <button type="button" className={`ep2-kpi ep2-kpi--${ton} ${valeur > 0 ? 'has-valeur' : ''}`} onClick={onClick} title={aide}>
      <span className="ep2-kpi-icone" aria-hidden="true"><Icone size={18} /></span>
      <span className="ep2-kpi-valeur">{valeur}</span>
      <span className="ep2-kpi-libelle">{libelle}</span>
      <ArrowRight size={14} className="ep2-kpi-fleche" aria-hidden="true" />
    </button>
  );
}

function LigneAFaire({ travail, onOuvrir }) {
  const niveau = travail.statut ? NIVEAUX[travail.statut.niveau] : null;
  const Icone = travail.type === 'tache' ? ClipboardList : Wrench;
  return (
    <li>
      <button type="button" className={`ep2-afaire ep2-afaire--${niveau?.ton || 'neutre'}`} onClick={() => onOuvrir(travail)}>
        <span className="ep2-afaire-barre" aria-hidden="true" />
        <span className="ep2-afaire-icone" aria-hidden="true"><Icone size={16} /></span>
        <span className="ep2-afaire-texte">
          <strong>{travail.titre}</strong>
          {travail.sousTitre && <small>{travail.sousTitre}</small>}
        </span>
        <span className={`ep2-puce ep2-puce--${niveau?.ton || 'neutre'}`}>
          {travail.statut?.texte || t('Sans date')}
        </span>
      </button>
    </li>
  );
}

export default function EspaceAujourdhui({
  chargement, compteurs, travaux, onAller, onOuvrirTravail, onSignaler,
}) {
  const urgents = travaux.filter((tr) => tr.statut && tr.statut.niveau !== 'plus-tard');
  const aFaire = (urgents.length ? urgents : travaux).slice(0, 7);
  const reste = travaux.length - aFaire.length;

  return (
    <div className="ep2-aujourdhui">
      <div className="ep2-kpis">
        <Indicateur icone={Wrench} valeur={compteurs.bons} libelle={t('Bons en cours')} ton="brand" onClick={() => onAller('bons')} />
        <Indicateur icone={ClipboardList} valeur={compteurs.taches} libelle={t('Tâches à faire')} ton="info" onClick={() => onAller('taches')} />
        <Indicateur icone={AlertTriangle} valeur={compteurs.retard} libelle={t('En retard')} ton={compteurs.retard ? 'alerte' : 'neutre'}
          onClick={() => onAller('taches')} aide={t('Travaux dont l’échéance est dépassée')} />
        <Indicateur icone={CalendarClock} valeur={compteurs.proches} libelle={t('Échéance proche')} ton={compteurs.proches ? 'attention' : 'neutre'}
          onClick={() => onAller('taches')} aide={t('Aujourd’hui ou dans les 2 prochains jours')} />
        <Indicateur icone={MessageCircle} valeur={compteurs.messages} libelle={t('Messages non lus')} ton={compteurs.messages ? 'alerte' : 'neutre'}
          onClick={() => onAller('discussions')} />
        <Indicateur icone={Hourglass} valeur={compteurs.demandes} libelle={t('Demandes en cours')} ton="violet" onClick={() => onAller('demandes')} />
      </div>

      <div className="ep2-grille">
        <section className="ep2-carte ep2-carte--afaire" aria-label={t('À faire maintenant')}>
          <header className="ep2-carte-entete">
            <h2><Sparkles size={17} aria-hidden="true" /> {t('À faire maintenant')}</h2>
            {travaux.length > 0 && <span className="ep2-carte-aide">{t('Trié par urgence')}</span>}
          </header>
          {chargement ? (
            <ul className="ep2-afaire-liste">
              {[0, 1, 2].map((i) => <li key={i} className="ep2-squelette" aria-hidden="true" />)}
            </ul>
          ) : aFaire.length === 0 ? (
            <div className="ep2-calme">
              <span className="ep2-calme-icone" aria-hidden="true">☕</span>
              <strong>{t('Rien d’urgent pour le moment.')}</strong>
              <span>{t('Aucun travail en retard ni d’échéance proche.')}</span>
            </div>
          ) : (
            <>
              <ul className="ep2-afaire-liste">
                {aFaire.map((tr) => <LigneAFaire key={tr.cle} travail={tr} onOuvrir={onOuvrirTravail} />)}
              </ul>
              {reste > 0 && (
                <button type="button" className="ep2-lien" onClick={() => onAller('taches')}>
                  {reste === 1 ? t('Voir 1 autre travail') : t('Voir les {n} autres travaux', { n: reste })} <ArrowRight size={14} />
                </button>
              )}
            </>
          )}
        </section>

        <div className="ep2-colonne">
          <section className="ep2-carte ep2-actions" aria-label={t('Actions rapides')}>
            <header className="ep2-carte-entete"><h2>{t('Signaler une panne')}</h2></header>
            <button type="button" className="ep2-action ep2-action--principale" onClick={onSignaler}>
              <Plus size={18} /> <span>{t('Nouvelle demande')}</span>
            </button>
            <p className="ep2-actions-aide">{t('Une panne sur un équipement ? Signalez-la, vous suivrez sa réparation dans « Mes demandes ».')}</p>
          </section>

          <MiniCalendrier travaux={travaux} onOuvrir={onOuvrirTravail} />
        </div>
      </div>
    </div>
  );
}
