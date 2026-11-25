import { Eye, ExternalLink, MessageCircle } from 'lucide-react';
import { GRAVITE_LABELS } from '../bonmaintenance/BmdCommun';
import { t, tp } from '../../../i18n';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import EspaceTableau from './EspaceTableau';
import { etatLabel, etatTon, dateLabel } from './espaceCommun';
import { StatusPill } from './StatusPill';

function resumeParticipation(ligne) {
  if (ligne.intervention) {
    return {
      ton: etatTon('interventions', ligne.intervention.etat),
      texte: t('Intervention : {etat}', { etat: etatLabel('interventions', ligne.intervention.etat) }),
    };
  }
  if (ligne.diagnostic) {
    const d = ligne.diagnostic;
    const gravite = GRAVITE_LABELS[d.gravite];
    return {
      ton: d.gravite === 3 ? 'alerte' : d.gravite === 2 ? 'attention' : 'info',
      texte: gravite ? t('Diagnostic : gravité {g}', { g: t(gravite).toLowerCase() }) : t('Diagnostic réalisé'),
    };
  }
  if (ligne.controle) {
    const c = ligne.controle;
    return {
      ton: c.conforme == null ? 'neutre' : c.conforme ? 'ok' : 'alerte',
      texte: c.conforme == null ? t('Contrôle réalisé') : c.conforme ? t('Contrôle conforme') : t('Contrôle non conforme'),
    };
  }
  if (ligne.remiseEnService) {
    const r = ligne.remiseEnService;
    return {
      ton: r.conforme ? 'ok' : 'alerte',
      texte: r.conforme ? t('Remise en service autorisée') : t('Remise en service refusée'),
    };
  }
  return null;
}

const RANG_ETAT_BON = { 3: 0, 1: 1, 2: 2, 4: 3, 10: 4 };

export function TableauBons({ bons, nonLusChat, onApercu, onOuvrir, onDiscuter, outils }) {
  const sansClic = (fn) => (e) => { e.stopPropagation(); fn(); };
  const colonnes = [
    {
      cle: 'num', label: 'N°', largeur: 120, valeur: (b) => b.num || '',
      rendu: (b) => <strong className="ept-ref">{b.num || t('Sans numéro')}</strong>,
    },
    {
      cle: 'titre', label: 'Objet', valeur: (b) => b.titre || '',
      rendu: (b) => <span className="ept-texte">{b.titre || t('Sans objet')}</span>,
    },
    {
      cle: 'etat', label: 'État', largeur: 140, valeur: (b) => RANG_ETAT_BON[b.etat] ?? 9,
      rendu: (b) => <BadgeStatut type="bon" valeur={b.etat} taille="petit" />,
    },
    {
      cle: 'participation', label: 'Ma participation', triable: false,
      rendu: (b) => { const r = resumeParticipation(b); return r ? <StatusPill ton={r.ton}>{r.texte}</StatusPill> : '—'; },
    },
    {
      cle: 'date', label: 'Date', largeur: 120, valeur: (b) => (b.dateCreation ? new Date(b.dateCreation).getTime() : null),
      rendu: (b) => <span className="ept-date">{dateLabel(b.dateCreation)}</span>,
    },
    {
      cle: 'actions', label: '', triable: false, largeur: 150, align: 'right',
      rendu: (b) => {
        const nonLus = nonLusChat[b.id] || 0;
        return (
          <span className="ept-actions">
            <button type="button" className={`ep-ico ${nonLus > 0 ? 'ep-ico--message' : ''}`} onClick={sansClic(() => onDiscuter(b.id))}
              title={nonLus > 0 ? tp('message non lu', nonLus) : t('Discuter')} aria-label={t('Discuter')}>
              <MessageCircle size={15} />
              {nonLus > 0 && <span className="ep-ico-nb">{nonLus}</span>}
            </button>
            <button type="button" className="ep-ico" onClick={sansClic(() => onApercu(b))} title={t('Aperçu')} aria-label={t('Aperçu')}>
              <Eye size={15} />
            </button>
            <button type="button" className="ep-ouvrir" onClick={sansClic(() => onOuvrir(b))}>
              <ExternalLink size={14} /> {t('Ouvrir')}
            </button>
          </span>
        );
      },
    },
  ];
  return (
    <EspaceTableau
      colonnes={colonnes}
      lignes={bons}
      onOuvrir={onOuvrir}
      triInitial={{ cle: 'etat', sens: 'asc' }}
      recherchePlaceholder={t('Rechercher un bon (n°, objet)…')}
      vide={t('Aucun bon de maintenance.')}
      ligneClasse={(b) => (b.etat === 4 || b.etat === 10 ? 'is-termine' : '')}
      outils={outils}
    />
  );
}
