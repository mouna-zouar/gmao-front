import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  FileText,
  Wrench,
  RefreshCw,
  Eye,
  X,
  UserRound,
  CalendarDays,
  CheckCircle2,
  HardHat,
  ShieldCheck,
  Power,
  PenLine,
  ExternalLink,
  MessageCircle,
  Stethoscope,
  Undo2,
  ChevronDown,
  Hourglass,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import authService from '../../../services/Authservice';
import espacePersonnelService from '../../../services/espacePersonnelService';
import chatBonService from '../../../services/chatBonService';
import suiviDemandeService from '../../../services/suiviDemandeService';
import MesDemandes from '../MesDemandes/MesDemandes';
import EspaceReclamation from './EspaceReclamation';
import BonMaintenanceDetails from '../bonmaintenance/Bonmaintenancedetails';
import {
  INTERVENANT_ETAT_LABELS,
  TACHE_ETAT_LABELS,
  GRAVITE_LABELS,
  ETAT_IMMOBILISATION_OPTIONS,
} from '../bonmaintenance/BmdCommun';
import { t, tp, locale } from '../../../i18n';
import { libelleTypeEntretien, libelleSourceInformation } from '../../../constants/FicheIntervention';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import EspaceKanban from './EspaceKanban';
import EspaceDiscussions from './EspaceDiscussions';
import { MiniCalendrier, ASurveiller } from './EspaceAgenda';
import { COLONNES_KANBAN, construireTravaux } from './espacePlanning';
import './EspacePersonnel.css';
import './EspacePlanning.css';
import './EspaceTheme.css';

/* ------------------------------------------------------------------ */
/*  Référentiels d'états                                               */
/* ------------------------------------------------------------------ */

const ETAT_LABELS = {
  bons: { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' },
  reclamations: {
    0: 'Ouverte',
    1: 'En cours',
    2: 'Clôturée',
   
  },
  // Valeurs réelles de BonMaintenanceTache.etat (1 Nouveau … 10 Annulé)
  taches: TACHE_ETAT_LABELS,
  interventions: INTERVENANT_ETAT_LABELS,
};

// Mêmes tons que partout dans la GMAO (constants/statuts.js) : Annulé et Rejetée en gris
const ETAT_TONS = {
  bons: { 1: 'info', 2: 'attention', 3: 'action', 4: 'ok', 10: 'neutre' },
  reclamations: { 0: 'info', 1: 'action', 2: 'ok', 3: 'attention', 4: 'neutre' },
  taches: { 1: 'info', 2: 'attention', 3: 'action', 4: 'ok', 10: 'neutre' },
  interventions: { 0: 'info', 1: 'action', 2: 'ok', 10: 'neutre' },
};

// Types de la pastille commune (BadgeStatut) pour les bons et les réclamations
const TYPE_BADGE = { bons: 'bon', reclamations: 'reclamation' };

// Étapes du suivi des demandes qui ne comptent plus comme « en cours »
const DEMANDES_TERMINEES = ['REPAREE', 'REFUSEE', 'ANNULEE'];

const ACTIVE_STATES = {
  bons: [1, 2, 3],
  reclamations: [0, 1, 3],
  taches: [1, 2, 3]
};

const etatLabel = (type, value) => {
  if (value === null || value === undefined || value === '') return '—';
  const label = ETAT_LABELS[type]?.[value];
  return label ? t(label) : String(value);
};

const etatTon = (type, value) => ETAT_TONS[type]?.[value] ?? 'neutre';

/* ------------------------------------------------------------------ */
/*  Rôles sur un bon (renvoyés par /espace-personnel/{id}/bons-roles)  */
/* ------------------------------------------------------------------ */

const ROLES = {
  INTERVENANT: { label: 'Intervenant', icon: HardHat, ton: 'action' },
  DIAGNOSTIQUEUR: { label: 'Diagnostic', icon: Stethoscope, ton: 'attention' },
  CONTROLEUR: { label: 'Contrôle', icon: ShieldCheck, ton: 'info' },
  REMISE_EN_SERVICE: { label: 'Remise en service', icon: Power, ton: 'ok' },
  CREATEUR: { label: 'Créateur', icon: PenLine, ton: 'neutre' },
  DEMANDEUR: { label: 'Demandeur', icon: UserRound, ton: 'neutre' },
};

// Filtres du tableau des bons : « Créés / demandés » regroupe les deux rôles administratifs
const FILTRES_ROLE = [
  { id: 'tous', label: 'Tous', roles: null },
  { id: 'intervenant', label: 'Intervenant', roles: ['INTERVENANT'] },
  { id: 'diagnostic', label: 'Diagnostic', roles: ['DIAGNOSTIQUEUR'] },
  { id: 'controle', label: 'Contrôle', roles: ['CONTROLEUR'] },
  { id: 'remise', label: 'Remise en service', roles: ['REMISE_EN_SERVICE'] },
  { id: 'demandes', label: 'Créés / demandés', roles: ['CREATEUR', 'DEMANDEUR'] },
];

const aRole = (ligne, roles) => !roles || roles.some((r) => ligne.roles.includes(r));

// Ancien endpoint (sans rôles) : on reconstitue créateur / demandeur pour rester compatible
const versLigneBon = (bon, personnelId) => ({
  ...bon,
  roles: [
    String(bon.personnelCreationId) === String(personnelId) && 'CREATEUR',
    String(bon.personnelDemandantId) === String(personnelId) && 'DEMANDEUR',
  ].filter(Boolean),
  intervention: null,
  diagnostic: null,
  controle: null,
  remiseEnService: null,
});

// Nouveau format : { bon, roles, intervention, controle, remiseEnService } → une ligne « à plat »
const aplatir = (m) => ({
  ...(m.bon ?? {}),
  roles: m.roles ?? [],
  intervention: m.intervention ?? null,
  diagnostic: m.diagnostic ?? null,
  controle: m.controle ?? null,
  remiseEnService: m.remiseEnService ?? null,
});

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
};

const dateHeureLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const valueLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  // Date ISO venue du backend (2026-10-13T09:00:00) : affichée comme une date
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return dateHeureLabel(value);
  if (typeof value === 'boolean') return value ? t('Oui') : t('Non');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const etatImmoLabel = (v) => {
  const o = ETAT_IMMOBILISATION_OPTIONS.find((x) => x.value === v);
  return o ? t(o.label) : null;
};

const salutation = () => {
  const h = new Date().getHours();
  if (h < 12) return t('Bonjour');
  if (h < 18) return t('Bon après-midi');
  return t('Bonsoir');
};

// Résumé court de la participation la plus « terrain » (affiché dans le tableau)
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

/* ------------------------------------------------------------------ */
/*  Composants atomiques                                               */
/* ------------------------------------------------------------------ */

function StatusPill({ ton = 'neutre', children }) {
  return <span className={`ep-pill ep-ton--${ton}`}>{children}</span>;
}

function RolePills({ roles }) {
  if (!roles?.length) return '—';
  return (
    <span className="ep-roles">
      {roles.map((r) => {
        const def = ROLES[r];
        if (!def) return null;
        const Icon = def.icon;
        return (
          <span key={r} className={`ep-role ep-ton--${def.ton}`}>
            <Icon size={12} strokeWidth={2.4} />
            {t(def.label)}
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Modale de détails                                                  */
/* ------------------------------------------------------------------ */

const MODAL_CONFIG = {
  bons: {
    eyebrow: 'Bon de maintenance',
    icon: Wrench,
    primaryKey: 'titre',
    referenceKey: 'num',
    dateKey: 'dateCreation',
    etatKey: 'etat',
    fields: [
      ['num', 'Numéro du bon'],
      ['titre', 'Objet'],
      ['description', 'Description'],
      ['dateCreation', 'Date de création', dateLabel],
      ['date', 'Intervention prévue le', dateLabel],
      ['dateFinIntervention', 'Fin d’intervention prévue', dateLabel],
      ['dateIntervention', 'Date d’intervention', dateLabel],
      ['dateCloture', 'Date de clôture', dateLabel],
      ['personnelDemandantNom', 'Demandeur'],
      ['personnelCreationNom', 'Créé par'],
      ['type', 'Type d’entretien', (v) => t(libelleTypeEntretien(v))],
      ['urgence', 'Urgence', (v) => t(NIVEAUX_URGENCE[v] || '')],
      ['sourceInformation', 'Source de l’information', (v) => t(libelleSourceInformation(v))],
      ['etatImmoABM', 'État de l’équipement', (v) => t(ETAT_IMMOBILISATION_OPTIONS.find((o) => Number(o.value) === Number(v))?.label || '')],
      ['arretOblig', 'Arrêt obligatoire', (v) => (v ? t('Oui') : t('Non'))],
      ['equipementNom', 'Équipement'],
      ['serviceNom', 'Service'],
      ['prestataireNom', 'Prestataire'],
      ['depotNom', 'Dépôt'],
      ['cause', 'Cause']
    ]
  },
  taches: {
    eyebrow: 'Tâche',
    icon: ClipboardList,
    primaryKey: 'designation',
    referenceKey: null, // pas d'identifiant technique affiché
    dateKey: 'dateDebut',
    etatKey: 'etat',
    fields: [
      ['designation', 'Désignation'],
      ['description', 'Description'],
      ['bonMaintenanceNum', 'Bon de maintenance associé'],
      ['dateDebut', 'Début prévu', dateLabel],
      ['dateFin', 'Fin prévue', dateLabel],
      ['dateCreation', 'Date de création', dateLabel],
      ['personnelAffecteNom', 'Intervenant']
    ]
  },
  reclamations: {
    eyebrow: 'Réclamation',
    icon: FileText,
    primaryKey: 'description',
    referenceKey: 'num',
    dateKey: 'date',
    etatKey: 'etat',
    fields: [
      ['num', 'Numéro de réclamation'],
      ['description', 'Description'],
      ['date', 'Date', dateLabel],
      ['dateCreation', 'Date de création', dateLabel],
      ['personnelAffecteNom', 'Affectée à'],
      ['personnelDemandantNom', 'Demandeur'],
      ['bonMaintenanceId', 'Bon de maintenance associé']
    ]
  }
};

// Clés techniques du bon à ne pas afficher dans « autres informations »
// Libellés de l'urgence (codes du backend)
const NIVEAUX_URGENCE = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée', 4: 'Urgente' };

const CLES_MASQUEES = new Set(['id', 'n', 'etat', 'createdAt', 'updatedAt', 'roles', 'intervention', 'diagnostic', 'controle', 'remiseEnService']);
// Identifiants techniques (id, personnelId, lotArticleImmobilistationId…) : jamais affichés
const estIdentifiant = (cle) => cle === 'id' || /Ids?$/.test(cle);

// Noms lisibles à la place des identifiants (équipement, prestataire, service)
const nomPrestataire = (p) => (p ? (p.raisonSociale || [p.prenom, p.nom].filter(Boolean).join(' ') || null) : null);
const enrichirPourAffichage = (item, type) => {
  if (!item || type !== 'bons') return item;
  return {
    ...item,
    equipementNom: item.equipementNom || item.lotArticleImmobilistation?.designation || item.immobilisation || null,
    prestataireNom: item.prestataireNom || nomPrestataire(item.prestataire),
    serviceNom: item.serviceNom || item.service?.description || null,
    depotNom: item.depotNom || item.depot?.nom || null,
  };
};

function Participation({ item }) {
  const blocs = [];

  if (item.intervention) {
    const i = item.intervention;
    blocs.push({
      key: 'intervention',
      role: 'INTERVENANT',
      titre: t('Mon intervention'),
      pill: <StatusPill ton={etatTon('interventions', i.etat)}>{etatLabel('interventions', i.etat)}</StatusPill>,
      lignes: [
        [t('Début'), dateHeureLabel(i.dateDebutIntervention)],
        [t('Fin'), dateHeureLabel(i.dateFinIntervention)],
        i.nbrHeure != null && [t('Heures'), t('{n} h', { n: i.nbrHeure })],
        i.commentaire && [t('Commentaire'), i.commentaire],
      ],
    });
  }

  if (item.diagnostic) {
    const d = item.diagnostic;
    const gravite = GRAVITE_LABELS[d.gravite];
    blocs.push({
      key: 'diagnostic',
      role: 'DIAGNOSTIQUEUR',
      titre: t('Mon diagnostic'),
      pill: gravite ? (
        <StatusPill ton={d.gravite === 3 ? 'alerte' : d.gravite === 2 ? 'attention' : 'info'}>{t(gravite)}</StatusPill>
      ) : null,
      lignes: [
        [t('Date'), dateHeureLabel(d.dateDiagnostic)],
        d.causeProbable && [t('Cause probable'), d.causeProbable],
        d.besoinPiece != null && [t('Pièce à changer'), d.besoinPiece ? t('Oui') : t('Non')],
        d.dureeEstimeeHeures != null && [t('Durée estimée'), t('{n} h', { n: d.dureeEstimeeHeures })],
        d.observations && [t('Observations'), d.observations],
      ],
    });
  }

  if (item.controle) {
    const c = item.controle;
    blocs.push({
      key: 'controle',
      role: 'CONTROLEUR',
      titre: t('Mon contrôle'),
      pill: c.conforme == null ? null : (
        <StatusPill ton={c.conforme ? 'ok' : 'alerte'}>{c.conforme ? t('Conforme') : t('Non conforme')}</StatusPill>
      ),
      lignes: [
        [t('Date'), dateHeureLabel(c.dateControle)],
        c.typeControle && [t('Type'), t(c.typeControle)],
        (c.valeurMesuree != null || c.valeurAttendue != null)
          && [t('Mesuré / attendu'), `${c.valeurMesuree ?? '—'} / ${c.valeurAttendue ?? '—'}`],
        c.observations && [t('Observations'), c.observations],
      ],
    });
  }

  if (item.remiseEnService) {
    const r = item.remiseEnService;
    blocs.push({
      key: 'remise',
      role: 'REMISE_EN_SERVICE',
      titre: t('Ma décision de remise en service'),
      pill: <StatusPill ton={r.conforme ? 'ok' : 'alerte'}>{r.conforme ? t('Autorisée') : t('Refusée')}</StatusPill>,
      lignes: [
        [t('Date'), dateHeureLabel(r.date)],
        etatImmoLabel(r.etatAvant) && [t('État avant'), etatImmoLabel(r.etatAvant)],
        etatImmoLabel(r.etatApres) && [t('État après'), etatImmoLabel(r.etatApres)],
        r.observations && [t('Observations'), r.observations],
      ],
    });
  }

  if (blocs.length === 0) return null;

  return (
    <section className="ep-participation" aria-label={t('Ma participation')}>
      <h3>{t('Ma participation')}</h3>
      <div className="ep-participation-grid">
        {blocs.map((b) => {
          const def = ROLES[b.role];
          const Icon = def.icon;
          return (
            <article key={b.key} className={`ep-participation-card ep-ton--${def.ton}`}>
              <header>
                <span className="ep-participation-icon"><Icon size={16} /></span>
                <strong>{b.titre}</strong>
                {b.pill}
              </header>
              <dl>
                {b.lignes.filter(Boolean).map(([label, valeur]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{valeur}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DetailModal({ item: itemBrut, type, onClose, onOuvrirBon, onOuvrirReclamation }) {
  useEffect(() => {
    if (!itemBrut) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [itemBrut, onClose]);

  if (!itemBrut) return null;
  const item = enrichirPourAffichage(itemBrut, type);

  const config = MODAL_CONFIG[type] ?? MODAL_CONFIG.bons;
  const Icon = config.icon;
  const etatValue = item[config.etatKey];
  const ton = etatTon(type, etatValue);
  const label = etatLabel(type, etatValue);

  const reference = config.referenceKey ? item[config.referenceKey] : undefined;
  const titre = item[config.primaryKey] ?? '—';

  const displayedFields = config.fields.filter(([key]) =>
    !estIdentifiant(key) && item[key] !== null && item[key] !== undefined && item[key] !== ''
  );

  const knownKeys = new Set(config.fields.map(([key]) => key));
  const extraFields = Object.entries(item)
    .filter(
      ([key, value]) =>
        !knownKeys.has(key) &&
        !CLES_MASQUEES.has(key) &&
        !estIdentifiant(key) &&
        value !== null &&
        value !== undefined &&
        typeof value !== 'object'
    )
    .map(([key, value]) => [key, key, () => valueLabel(value)]);

  const allFields = [...displayedFields, ...extraFields];

  return (
    <div
      className="ep-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`ep-modal ep-ton--${ton}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-modal-title"
      >
        <header className="ep-modal-hero">
          <div className="ep-modal-hero-top">
            <span className="ep-modal-hero-icon">
              <Icon size={22} />
            </span>
            <span className="ep-modal-hero-eyebrow">{t(config.eyebrow)}</span>
            <button
              type="button"
              className="ep-icon-button"
              onClick={onClose}
              aria-label={t('Fermer')}
            >
              <X size={18} />
            </button>
          </div>

          <h2 id="ep-modal-title" className="ep-modal-hero-title">
            {titre}
          </h2>

          <div className="ep-modal-hero-meta">
            {reference !== undefined && (
              <span className="ep-modal-ref">#{reference}</span>
            )}
            {TYPE_BADGE[type]
              ? <BadgeStatut type={TYPE_BADGE[type]} valeur={etatValue} />
              : <StatusPill ton={ton}>{label}</StatusPill>}
            {type === 'bons' && <RolePills roles={item.roles} />}
            {item[config.dateKey] && (
              <span className="ep-modal-date">
                <CalendarDays size={14} />
                {dateLabel(item[config.dateKey])}
              </span>
            )}
          </div>
        </header>

        <div className="ep-modal-body">
          {type === 'bons' && <Participation item={item} />}

          {allFields.length ? (
            <div className="ep-detail-grid">
              {allFields.map(([key, fieldLabel, formatter]) => (
                <div className="ep-detail-item" key={key}>
                  <span>{t(fieldLabel)}</span>
                  <strong>
                    {formatter ? valueLabel(formatter(item[key])) : valueLabel(item[key])}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="ep-empty">
              {t('Aucune information supplémentaire disponible.')}
            </p>
          )}
        </div>

        <footer className="ep-modal-footer">
          {type === 'bons' && item.id != null && (
            <button type="button" className="ep-btn ep-btn--primaire" onClick={() => onOuvrirBon(item)}>
              <ExternalLink size={15} />
              {t('Ouvrir le bon')}
            </button>
          )}
          {type === 'reclamations' && item.id != null && (
            <button type="button" className="ep-btn ep-btn--primaire" onClick={() => onOuvrirReclamation(item.id)}>
              <ExternalLink size={15} />
              {t('Ouvrir la réclamation')}
            </button>
          )}
          <button type="button" className="ep-btn ep-btn--ghost" onClick={onClose}>
            {t('Fermer')}
          </button>
        </footer>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Présentation des bons et réclamations : fiches groupées par état    */
/* ------------------------------------------------------------------ */

// Groupes affichés dans l'ordre du travail : ce qui est en cours d'abord, le terminé replié
const GROUPES_BONS = [
  { id: 'cours', etats: [3], label: 'En cours', ton: 'action' },
  { id: 'nouveaux', etats: [1], label: 'À démarrer', ton: 'info' },
  { id: 'suspendus', etats: [2], label: 'Suspendus', ton: 'attention' },
  { id: 'effectues', etats: [4], label: 'Effectués', ton: 'ok', replie: true },
  { id: 'annules', etats: [10], label: 'Annulés', ton: 'neutre', replie: true },
];

function grouper(liste, groupes) {
  const connus = new Set(groupes.flatMap((g) => g.etats));
  const resultat = groupes.map((g) => ({ ...g, items: liste.filter((x) => g.etats.includes(x.etat)) }));
  const autres = liste.filter((x) => !connus.has(x.etat));
  if (autres.length) resultat.push({ id: 'autres', etats: [], label: 'Autres', ton: 'neutre', items: autres });
  return resultat.filter((g) => g.items.length > 0);
}

function Groupe({ groupe, children }) {
  const [ouvert, setOuvert] = useState(!groupe.replie);
  return (
    <section className={`ep-groupe ep-ton--${groupe.ton}`}>
      <button type="button" className="ep-groupe-entete" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span className="ep-groupe-point" aria-hidden="true" />
        <h3>{t(groupe.label)}</h3>
        <span className="ep-groupe-nb">{groupe.items.length}</span>
        <ChevronDown size={16} className={`ep-groupe-fleche ${ouvert ? 'is-ouvert' : ''}`} aria-hidden="true" />
      </button>
      {ouvert && <ul className="ep-fiches">{children}</ul>}
    </section>
  );
}

function FicheBon({ bon, nonLus, onApercu, onOuvrir, onDiscuter }) {
  const r = resumeParticipation(bon);
  return (
    <li className={`ep-fiche ep-ton--${etatTon('bons', bon.etat)}`}>
      <div className="ep-fiche-ref">
        <strong>{bon.num || t('Sans numéro')}</strong>
        <span className="ep-date"><CalendarDays size={12} />{dateLabel(bon.dateCreation)}</span>
      </div>
      <div className="ep-fiche-corps">
        <h4>{bon.titre || t('Sans objet')}</h4>
        <div className="ep-fiche-meta">
          <RolePills roles={bon.roles} />
          {r && <StatusPill ton={r.ton}>{r.texte}</StatusPill>}
        </div>
      </div>
      <div className="ep-fiche-actions">
        <button
          type="button"
          className={`ep-ico ${nonLus > 0 ? 'ep-ico--message' : ''}`}
          onClick={() => onDiscuter(bon.id)}
          title={nonLus > 0 ? tp('message non lu', nonLus) : t('Discuter')}
          aria-label={nonLus > 0 ? `${tp('message non lu', nonLus)} · ${t('Ouvrir la discussion')}` : t('Discuter')}
        >
          <MessageCircle size={16} />
          {nonLus > 0 && <span className="ep-ico-nb">{nonLus}</span>}
        </button>
        <button type="button" className="ep-ico" onClick={() => onApercu(bon)} title={t('Aperçu')} aria-label={t('Aperçu')}>
          <Eye size={16} />
        </button>
        <button type="button" className="ep-ouvrir" onClick={() => onOuvrir(bon)}>
          <ExternalLink size={15} /> {t('Ouvrir')}
        </button>
      </div>
    </li>
  );
}

const initialesDe = (nom) => {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return ((mots[0][0] || '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
};

/* ------------------------------------------------------------------ */
/*  Page principale                                                    */
/* ------------------------------------------------------------------ */

export default function EspacePersonnel() {
  const user = authService.getCurrentUser();

  const personnelId =
    user?.personnelId ?? user?.personnel?.id ?? user?.userId;

  // Nom de l'utilisateur connecté : userNom vient du login (fiche Personnel de Cubix),
  // sinon prénom + nom, sinon l'identifiant de connexion.
  const displayName =
    user?.userNom ||
    [user?.prenom, user?.nom].filter(Boolean).join(' ') ||
    user?.username ||
    user?.login ||
    user?.email ||
    '';

  // ?onglet=demandes (lien des notifications « Votre demande … ») ouvre directement l'onglet voulu
  const [searchParams] = useSearchParams();
  const ongletUrl = searchParams.get('onglet');
  const [activeTab, setActiveTab] = useState(ongletUrl || 'bons');
  useEffect(() => { if (ongletUrl) setActiveTab(ongletUrl); }, [ongletUrl, searchParams]);
  const [filtreRole, setFiltreRole] = useState('tous');
  const [data, setData] = useState({ bons: [], taches: [], reclamations: [], demandes: [] });
  const [nonLusChat, setNonLusChat] = useState({});
  // Bon dont on ouvre directement la conversation (clic sur la pastille de messages non lus)
  const [chatInitial, setChatInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  // Bon ouvert en pleine page (même écran de détail que dans « Bons de maintenance »)
  const [bonOuvert, setBonOuvert] = useState(null);
  // Réclamation ouverte en pleine page (même écran de détail que dans « Réclamations »)
  const [reclamationOuverte, setReclamationOuverte] = useState(null);
  // Kanban : tâches en cours d'enregistrement et message en bas d'écran (avec « Annuler »)
  const [tachesEnCours, setTachesEnCours] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const minuterieToast = useRef(null);

  const load = useCallback(async () => {
    if (personnelId === null || personnelId === undefined || personnelId === '') {
      setError(
        t("Votre compte n'est pas associé à un identifiant personnel. Contactez l'administrateur.")
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Bons avec rôles (intervenant, contrôle, remise en service…) ; repli sur l'ancien
      // endpoint si le backend n'est pas encore à jour.
      const chargerBons = espacePersonnelService.getMesBonsAvecRoles(personnelId)
        .then((liste) => (Array.isArray(liste) ? liste.map(aplatir) : []))
        .catch(() => espacePersonnelService.getMesBons(personnelId)
          .then((liste) => (Array.isArray(liste) ? liste.map((b) => versLigneBon(b, personnelId)) : [])));

      const [bons, taches] = await Promise.all([
        chargerBons,
        espacePersonnelService.getMesTaches(personnelId)
      ]);

      setData((d) => ({
        ...d,
        bons,
        taches: Array.isArray(taches) ? taches : []
      }));

      // Suivi de mes demandes (compteur de l'onglet), sans bloquer la page si indisponible
      suiviDemandeService.getMesDemandes(personnelId)
        .then((demandes) => setData((d) => ({ ...d, demandes })))
        .catch(() => {});

      // Messages non lus du chat de chaque bon (sans bloquer la page si indisponible)
      chatBonService.getNonLus(bons.map((b) => b.id))
        .then(setNonLusChat)
        .catch(() => setNonLusChat({}));
    } catch (e) {
      console.error('Erreur chargement espace personnel', e);
      setError(
        t("Impossible de charger vos données. Vérifiez les API de l'espace personnel et le backend GMAO.")
      );
    } finally {
      setLoading(false);
    }
  }, [personnelId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = (item, type) => {
    setSelectedItem(item);
    setSelectedType(type);
  };

  const closeDetails = useCallback(() => {
    setSelectedItem(null);
    setSelectedType(null);
  }, []);

  const ouvrirBon = (bon) => {
    closeDetails();
    setReclamationOuverte(null);
    setBonOuvert(bon);
  };

  const ouvrirReclamation = (id) => {
    if (id == null) return;
    closeDetails();
    setReclamationOuverte(id);
  };

  // ---------- Travaux à faire (calendrier, « À surveiller ») ----------
  const travaux = useMemo(() => construireTravaux(data), [data]);
  const bonsParId = useMemo(() => new Map(data.bons.map((b) => [b.id, b])), [data.bons]);

  const ouvrirTravail = (travail) => {
    if (travail.type === 'tache') openDetails(travail.source, 'taches');
    else ouvrirBon(travail.source);
  };

  const afficherToast = useCallback((contenu) => {
    clearTimeout(minuterieToast.current);
    setToast(contenu);
    minuterieToast.current = setTimeout(() => setToast(null), contenu.erreur ? 7000 : 6000);
  }, []);

  useEffect(() => () => clearTimeout(minuterieToast.current), []);

  const remplacerTache = useCallback((id, maj) => setData((d) => ({
    ...d,
    taches: d.taches.map((x) => (x.id === id ? { ...x, ...maj } : x)),
  })), []);

  // ---------- Kanban : changement d'état d'une tâche (glisser-déposer ou menu) ----------
  const deplacerTache = useCallback(async (tache, nouvelEtat, { annulable = true } = {}) => {
    const ancienEtat = tache.etat;
    if (ancienEtat === nouvelEtat || tachesEnCours.has(tache.id)) return;

    remplacerTache(tache.id, { etat: nouvelEtat }); // affichage immédiat
    setTachesEnCours((s) => new Set(s).add(tache.id));
    const libelle = (etat) => t(COLONNES_KANBAN.find((c) => c.etat === etat)?.label || String(etat));

    try {
      const maj = await espacePersonnelService.changerEtatTache(personnelId, tache.id, nouvelEtat);
      if (maj) remplacerTache(tache.id, maj);
      afficherToast({
        texte: t('« {nom} » → {etat}', { nom: tache.designation || t('Tâche sans nom'), etat: libelle(nouvelEtat) }),
        // « Annuler » remet l'ancien état (sans proposer d'annuler l'annulation)
        annuler: annulable ? { tache: { ...tache, ...(maj || {}), etat: nouvelEtat }, etat: ancienEtat } : null,
      });
    } catch (err) {
      remplacerTache(tache.id, { etat: ancienEtat });
      const status = err?.response?.status;
      afficherToast({
        erreur: true,
        texte: status === 403
          ? t('Cette tâche ne vous est pas affectée : son état ne peut pas être changé ici.')
          : t("L'état de la tâche n'a pas pu être enregistré. Réessayez."),
      });
    } finally {
      setTachesEnCours((s) => { const n = new Set(s); n.delete(tache.id); return n; });
    }
  }, [personnelId, tachesEnCours, afficherToast, remplacerTache]);

  const tabs = useMemo(
    () => [
      {
        id: 'bons',
        label: t('Bons de maintenance'),
        icon: Wrench,
        items: data.bons,
        activeStates: ACTIVE_STATES.bons
      },
      {
        id: 'taches',
        label: t('Mes tâches'),
        icon: ClipboardList,
        items: data.taches,
        activeStates: ACTIVE_STATES.taches
      },
      {
        id: 'demandes',
        label: t('Mes demandes'),
        icon: Hourglass,
        items: data.demandes,
        activeStates: []
      },
      {
        id: 'discussions',
        label: t('Discussions'),
        icon: MessageCircle,
        items: data.bons,
        activeStates: []
      }
    ],
    [data]
  );

  const totalNonLus = Object.values(nonLusChat).reduce((somme, n) => somme + (n || 0), 0);

  const ouvrirDiscussion = (bonId) => {
    setChatInitial(bonId);
    setActiveTab('discussions');
  };

  // Compteurs par rôle pour les filtres du tableau des bons
  const compteRoles = useMemo(() => {
    const c = {};
    FILTRES_ROLE.forEach((f) => { c[f.id] = data.bons.filter((b) => aRole(b, f.roles)).length; });
    return c;
  }, [data.bons]);

  const bonsFiltres = useMemo(() => {
    const filtre = FILTRES_ROLE.find((f) => f.id === filtreRole) ?? FILTRES_ROLE[0];
    return data.bons.filter((b) => aRole(b, filtre.roles));
  }, [data.bons, filtreRole]);


  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  // Réclamation ouverte : écran de détail complet, avec retour à l'espace (rechargé au retour)
  if (reclamationOuverte != null) {
    return (
      <EspaceReclamation
        reclamationId={reclamationOuverte}
        onBack={() => { setReclamationOuverte(null); load(); }}
        onOuvrirBon={ouvrirBon}
      />
    );
  }

  // Bon ouvert : on affiche l'écran de détail complet, avec retour à l'espace (rechargé au retour)
  if (bonOuvert) {
    return (
      <BonMaintenanceDetails
        bonMaintenance={bonOuvert}
        onBack={() => { setBonOuvert(null); load(); }}
      />
    );
  }


  // Phrase de synthèse du bandeau : ce qui demande de l'attention aujourd'hui
  const tachesAFaire = data.taches.filter((x) => ACTIVE_STATES.taches.includes(x.etat)).length;
  const enRetard = travaux.filter((tr) => tr.statut?.niveau === 'retard').length;
  const syntheses = [
    tachesAFaire > 0 && { cle: 'taches', texte: tp('tâche à faire', tachesAFaire), onglet: 'taches' },
    enRetard > 0 && { cle: 'retard', texte: tp('travail en retard', enRetard), onglet: 'taches', alerte: true },
    totalNonLus > 0 && { cle: 'messages', texte: tp('message non lu', totalNonLus), onglet: 'discussions', alerte: true },
  ].filter(Boolean);

  const compteOnglet = (tab) => {
    if (tab.id === 'discussions') return totalNonLus;
    if (tab.id === 'demandes') return tab.items.filter((x) => !DEMANDES_TERMINEES.includes(x.etape)).length;
    return tab.items.filter((x) => tab.activeStates.includes(x.etat)).length;
  };

  const aideOnglet = {
    bons: t('Groupés par état : ce qui est en cours d’abord'),
    taches: t('Glissez les cartes d’une colonne à l’autre'),
    demandes: t('Où en sont les pannes que vous avez signalées, jusqu\'à la réparation'),
    discussions: t('Les messages arrivent en direct'),
  }[activeTab];

  return (
    <main className="ep-page ep-theme">
      {/* ------- BANDEAU : qui je suis, ce qui m'attend, et les onglets ------- */}
      <header className="ep-bandeau">
        <div className="ep-bandeau-haut">
          <span className="ep-avatar" aria-hidden="true">{initialesDe(displayName)}</span>
          <div className="ep-bandeau-texte">
            <p className="ep-bandeau-date">
              {new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1>{salutation()}{displayName ? `, ${displayName}` : ''}</h1>
            <p className="ep-synthese">
              {loading ? t('Chargement de vos données…') : syntheses.length === 0 ? t('Rien d’urgent aujourd’hui.') : (
                <>
                  {syntheses.map((x, i) => (
                    <span key={x.cle}>
                      {i > 0 && (i === syntheses.length - 1 ? ` ${t('et')} ` : ', ')}
                      <button
                        type="button"
                        className={`ep-synthese-lien ${x.alerte ? 'is-alerte' : ''}`}
                        onClick={() => { if (x.onglet === 'discussions') setChatInitial(null); setActiveTab(x.onglet); }}
                      >
                        {x.texte}
                      </button>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
          <button type="button" className="ep-actualiser" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'ep-spin' : ''} />
            <span>{t('Actualiser')}</span>
          </button>
        </div>

        <nav className="ep-onglets" role="tablist" aria-label={t('Mon espace')}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const n = compteOnglet(tab);
            const actif = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={actif}
                className={`ep-onglet ${actif ? 'is-actif' : ''}`}
                onClick={() => { if (tab.id === 'discussions') setChatInitial(null); setActiveTab(tab.id); }}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
                <span
                  className={`ep-onglet-nb ${tab.id === 'discussions' && n > 0 ? 'is-alerte' : ''}`}
                  title={tab.id === 'discussions' ? tp('message non lu', n) : tp('actif', n)}
                >
                  {tab.id === 'discussions' ? n : tab.items.length}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      {error && (
        <div className="ep-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="ep-layout">
        <div className="ep-principal" role="tabpanel">
          <div className="ep-contenu-entete">
            <h2>{currentTab.label}</h2>
            <p>{aideOnglet}</p>
          </div>

          {activeTab === 'bons' && !loading && data.bons.length > 0 && (
            <div className="ep-filtres-role" role="group" aria-label={t('Filtrer par rôle')}>
              {FILTRES_ROLE.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ep-filtre-role ${filtreRole === f.id ? 'is-actif' : ''}`}
                  aria-pressed={filtreRole === f.id}
                  onClick={() => setFiltreRole(f.id)}
                >
                  {t(f.label)}
                  <span className="ep-filtre-role-compte">{compteRoles[f.id]}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'demandes' ? (
            <MesDemandes
              integre
              onCharge={(demandes) => setData((d) => ({ ...d, demandes }))}
              onOuvrir={ouvrirReclamation}
            />
          ) : loading ? (
            <div className="ep-empty">
              <RefreshCw size={18} className="ep-spin" />
              <span>{t('Chargement de vos données…')}</span>
            </div>
          ) : activeTab === 'bons' ? (
            bonsFiltres.length === 0 ? (
              <div className="ep-empty">
                <Wrench size={18} />
                <span>{filtreRole === 'tous' ? t('Aucun bon de maintenance ne vous est associé.') : t('Aucun bon pour ce rôle.')}</span>
              </div>
            ) : (
              grouper(bonsFiltres, GROUPES_BONS).map((g) => (
                <Groupe key={g.id} groupe={g}>
                  {g.items.map((bon) => (
                    <FicheBon
                      key={bon.id}
                      bon={bon}
                      nonLus={nonLusChat[bon.id] || 0}
                      onApercu={(b) => openDetails(b, 'bons')}
                      onOuvrir={ouvrirBon}
                      onDiscuter={ouvrirDiscussion}
                    />
                  ))}
                </Groupe>
              ))
            )
          ) : activeTab === 'discussions' ? (
            <div className="ep-surface">
              <EspaceDiscussions
                key={chatInitial ?? 'liste'}
                bons={data.bons}
                personnelId={personnelId}
                bonInitial={chatInitial}
                onOuvrirBon={ouvrirBon}
                onNonLusChange={setNonLusChat}
              />
            </div>
          ) : activeTab === 'taches' ? (
            data.taches.length === 0 ? (
              <div className="ep-empty">
                <ClipboardList size={18} />
                <span>{t('Aucune tâche ne vous est affectée.')}</span>
              </div>
            ) : (
              <EspaceKanban
                taches={data.taches}
                bonsParId={bonsParId}
                enCours={tachesEnCours}
                onDeplacer={deplacerTache}
                onApercu={(tache) => openDetails(tache, 'taches')}
                onOuvrirBon={ouvrirBon}
              />
            )
          ) : null}
        </div>

        {/* ------- À DROITE : calendrier des travaux et échéances ------- */}
        <aside className="ep-cote" aria-label={t('Mon planning')}>
          <ASurveiller travaux={travaux} onOuvrir={ouvrirTravail} />
          <MiniCalendrier travaux={travaux} onOuvrir={ouvrirTravail} />
        </aside>
      </div>

      {toast && (
        <div className={`ep-toast ${toast.erreur ? 'ep-toast--erreur' : ''}`} role="status" aria-live="polite">
          {toast.erreur ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.texte}</span>
          {toast.annuler && (
            <button
              type="button"
              onClick={() => {
                const { tache, etat } = toast.annuler;
                setToast(null);
                deplacerTache(tache, etat, { annulable: false });
              }}
            >
              <Undo2 size={14} /> {t('Annuler')}
            </button>
          )}
          <button type="button" className="ep-toast-fermer" onClick={() => setToast(null)} aria-label={t('Fermer')}>
            <X size={14} />
          </button>
        </div>
      )}

      <DetailModal
        item={selectedItem}
        type={selectedType}
        onClose={closeDetails}
        onOuvrirBon={ouvrirBon}
        onOuvrirReclamation={ouvrirReclamation}
      />
    </main>
  );
}