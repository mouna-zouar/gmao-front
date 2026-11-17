import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ClipboardList, FileText, Wrench, RefreshCw, Eye, X, UserRound, CalendarDays, CheckCircle2, HardHat, ShieldCheck, Power, PenLine, ExternalLink, MessageCircle, Stethoscope, Undo2, Hourglass, GraduationCap, XCircle, ArrowLeft, Search, Sun, MapPin } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import authService from '../../../services/Authservice';
import espacePersonnelService from '../../../services/espacePersonnelService';
import chatBonService from '../../../services/chatBonService';
import suiviDemandeService from '../../../services/suiviDemandeService';
import MesDemandes from '../MesDemandes/MesDemandes';
import reclamationService from '../../../services/Reclamationservice';
import bonMaintenanceFullService from '../../../services/Bonmaintenancefullservice';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import ReclamationDetails from '../Reclamations/Reclamationdetails';
import { useActionsReclamation } from '../Reclamations/ReclamationActions';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import AssociateBonMaintenanceModal from '../../ui/modals/AssociateBonMaintenanceModal';
import BonMaintenanceModal from '../../ui/modals/Bonmaintenancemodal';
import '../../ui/modals/ConfirmModal.css';
import '../Reclamations/Reclamations.css';
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
import MesFormations from '../Formations/MesFormations';
import formationService from '../../../services/formationService';
import BmdChat from '../bonmaintenance/BmdChat';
import { MiniCalendrier, ASurveiller } from './EspaceAgenda';
import EspaceAujourdhui from './EspaceAujourdhui';
import EspaceTableau from './EspaceTableau';
import { COLONNES_KANBAN, construireTravaux, refBon, versDate } from './espacePlanning';
import './EspacePersonnel.css';

/* ------------------------------------------------------------------ */
/*  Référentiels d'états                                               */
/* ------------------------------------------------------------------ */

const ETAT_LABELS = {
  bons: { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' },
  reclamations: {
    0: 'Nouveau',
    5: 'En file',
    1: 'En cours',
    3: 'Résolue',
    2: 'Clôturée',
    4: 'Annulée',
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
const DEMANDES_TERMINEES = ['REPAREE', 'REFUSEE', 'ANNULEE', 'ANNULEE_DEMANDEUR'];

const ACTIVE_STATES = {
  bons: [1, 2, 3],
  reclamations: [0, 5, 1, 3],
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

/* ------------------------------------------------------------------ */
/*  Aperçu d'un bon : en-tête, avancement, infos par thème, mes tâches   */
/* ------------------------------------------------------------------ */
// Parcours d'un bon : Nouveau (1) → En cours (3) → Effectué (4) ; Suspendu (2) et Annulé (10) à part
const PARCOURS_BON = [
  { etat: 1, label: 'Créé' },
  { etat: 3, label: 'En cours' },
  { etat: 4, label: 'Effectué' },
];

/** Barre d'avancement pleine largeur : Créé → En cours → Effectué (Suspendu / Annulé signalés). */
function AvancementBon({ etat }) {
  const rang = etat === 4 ? 2 : etat === 3 || etat === 2 ? 1 : 0;
  const annule = etat === 10;
  return (
    <ol className={`epa-avancement ${annule ? 'is-annule' : ''}`} aria-label={t('Avancement du bon')}>
      {PARCOURS_BON.map((p, i) => {
        const statut = annule ? 'coupe' : i < rang || etat === 4 ? 'fait' : i === rang ? (etat === 2 ? 'pause' : 'courant') : 'avenir';
        return (
          <li key={p.etat} className={`epa-seg epa-seg--${statut}`} aria-current={statut === 'courant' || statut === 'pause' ? 'step' : undefined}>
            <span className="epa-seg-barre" aria-hidden="true" />
            <span className="epa-seg-texte">
              {statut === 'fait' && <CheckCircle2 size={13} aria-hidden="true" />}
              {statut === 'pause' ? t('Suspendu') : t(p.label)}
            </span>
          </li>
        );
      })}
      {annule && (
        <li className="epa-seg epa-seg--annule">
          <span className="epa-seg-barre" aria-hidden="true" />
          <span className="epa-seg-texte"><XCircle size={13} aria-hidden="true" /> {t('Annulé')}</span>
        </li>
      )}
    </ol>
  );
}

/** Petite carte d'informations (seules les lignes renseignées sont affichées). */
function InfosBloc({ titre, icone: Icone, lignes }) {
  const visibles = lignes.filter((l) => l && l[1] != null && l[1] !== '' && l[1] !== '—');
  if (!visibles.length) return null;
  return (
    <section className="epa-carte">
      <h3>{Icone && <Icone size={15} aria-hidden="true" />}{titre}</h3>
      <dl>
        {visibles.map(([label, valeur]) => (
          <div key={label}><dt>{label}</dt><dd>{valeur}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function ApercuBon({ bon: brut, taches = [], nonLus = 0, onClose, onOuvrirBon, onDiscuter }) {
  useEffect(() => {
    if (!brut) return undefined;
    const echap = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [brut, onClose]);
  if (!brut) return null;
  const b = enrichirPourAffichage(brut, 'bons');
  const mesTaches = taches.filter((x) => String(x.bonMaintenanceId) === String(b.id));
  const urgence = NIVEAUX_URGENCE[b.urgence];
  const etatImmo = ETAT_IMMOBILISATION_OPTIONS.find((o) => Number(o.value) === Number(b.etatImmoABM))?.label;
  // Une seule personne : le demandeur s'il est connu, sinon le créateur du bon
  const personne = b.personnelDemandantNom
    ? [t('Demandeur'), b.personnelDemandantNom]
    : [t('Créé par'), b.personnelCreationNom];
  const tonEtat = etatTon('bons', b.etat);

  return (
    <div className="ep-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`epa ep-ton--${tonEtat}`} role="dialog" aria-modal="true" aria-labelledby="epa-titre">
        {/* ------- En-tête ------- */}
        <header className="epa-entete">
          <div className="epa-entete-ligne">
            <span className="epa-icone" aria-hidden="true"><Wrench size={20} /></span>
            <div className="epa-entete-texte">
              <div className="epa-badges">
                <span className="epa-ref">{b.num || t('Bon de maintenance')}</span>
                <BadgeStatut type="bon" valeur={b.etat} taille="petit" />
                {urgence && <span className={`epa-puce ${b.urgence >= 3 ? 'is-alerte' : ''}`}>{t('Urgence')} : {t(urgence)}</span>}
                {b.arretOblig && <span className="epa-puce is-alerte">{t('Arrêt obligatoire')}</span>}
              </div>
              <h2 id="epa-titre">{b.titre || t('Sans objet')}</h2>
              {(b.equipementNom || b.serviceNom) && (
                <p className="epa-sous">
                  {b.equipementNom && <span><Stethoscope size={14} aria-hidden="true" /> {b.equipementNom}</span>}
                  {b.serviceNom && <span><MapPin size={14} aria-hidden="true" /> {b.serviceNom}</span>}
                </p>
              )}
            </div>
            <button type="button" className="epa-fermer" onClick={onClose} aria-label={t('Fermer')}><X size={18} /></button>
          </div>
          <AvancementBon etat={b.etat} />
        </header>

        {/* ------- Corps : à gauche le travail, à droite les infos ------- */}
        <div className="epa-corps">
          <div className="epa-principal">
            <section className="epa-section">
              <h3>{t('Description')}</h3>
              {b.description
                ? <p className="epa-description">{b.description}</p>
                : <p className="epa-vide">{t('Aucune description.')}</p>}
            </section>

            <section className="epa-section">
              <h3>{t('Mes tâches sur ce bon')} {mesTaches.length > 0 && <span className="epa-nb">{mesTaches.length}</span>}</h3>
              {mesTaches.length === 0 ? (
                <p className="epa-vide">{t('Aucune tâche ne vous est affectée sur ce bon.')}</p>
              ) : (
                <ul className="epa-taches">
                  {mesTaches.map((x) => (
                    <li key={x.id} className={`ep-ton--${etatTon('taches', x.etat)}`}>
                      <span className="epa-tache-point" aria-hidden="true" />
                      <span className="epa-tache-nom">{x.designation || x.nom || t('Tâche #{id}', { id: x.id })}</span>
                      {x.dateFin && <span className="epa-tache-date"><CalendarDays size={12} aria-hidden="true" /> {dateLabel(x.dateFin)}</span>}
                      <StatusPill ton={etatTon('taches', x.etat)}>{etatLabel('taches', x.etat)}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Participation item={b} />
          </div>

          <aside className="epa-cote">
            <InfosBloc titre={t('Planning')} icone={CalendarDays} lignes={[
              [t('Créé le'), b.dateCreation ? dateLabel(b.dateCreation) : null],
              [t('Intervention prévue'), b.date ? dateLabel(b.date) : null],
              [t('Fin prévue'), b.dateFinIntervention ? dateLabel(b.dateFinIntervention) : null],
              [t('Intervention'), b.dateIntervention ? dateLabel(b.dateIntervention) : null],
              [t('Clôturé le'), b.dateCloture ? dateLabel(b.dateCloture) : null],
            ]} />
            <InfosBloc titre={t('Équipement')} icone={Stethoscope} lignes={[
              [t('Équipement'), b.equipementNom],
              [t('État'), etatImmo ? t(etatImmo) : null],
              [t('Service'), b.serviceNom],
              [t('Dépôt'), b.depotNom],
            ]} />
            <InfosBloc titre={t('Demande')} icone={UserRound} lignes={[
              personne,
              [t('Type d’entretien'), b.type != null ? t(libelleTypeEntretien(b.type)) : null],
              [t('Source'), b.sourceInformation != null ? t(libelleSourceInformation(b.sourceInformation)) : null],
              [t('Cause'), b.cause],
              [t('Prestataire'), b.prestataireNom],
            ]} />
          </aside>
        </div>

        {/* ------- Actions ------- */}
        <footer className="epa-pied">
          <button type="button" className="ep-btn ep-btn--ghost" onClick={onClose}>{t('Fermer')}</button>
          <span className="epa-espace" />
          {onDiscuter && b.id != null && (
            <button type="button" className="ep-btn ep-btn--ghost epa-discuter" onClick={() => onDiscuter(b.id)}>
              <MessageCircle size={15} /> {t('Discuter')}
              {nonLus > 0 && <span className="epa-nonlus">{nonLus}</span>}
            </button>
          )}
          {b.id != null && (
            <button type="button" className="ep-btn ep-btn--primaire" onClick={() => onOuvrirBon(b)}>
              <ExternalLink size={15} /> {t('Ouvrir le bon')}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function DetailModal({ item: itemBrut, type, onClose, onOuvrirBon, onOuvrirReclamation, taches, nonLusChat, onDiscuter }) {
  if (itemBrut && type === 'bons') {
    return (
      <ApercuBon bon={itemBrut} taches={taches} nonLus={nonLusChat?.[itemBrut.id] || 0}
        onClose={onClose} onOuvrirBon={onOuvrirBon} onDiscuter={onDiscuter} />
    );
  }
  return <DetailModalGenerique item={itemBrut} type={type} onClose={onClose} onOuvrirBon={onOuvrirBon} onOuvrirReclamation={onOuvrirReclamation} />;
}

function DetailModalGenerique({ item: itemBrut, type, onClose, onOuvrirBon, onOuvrirReclamation }) {
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
/*  Présentation des bons : tableau (tri, recherche, filtres de rôle)   */
/* ------------------------------------------------------------------ */

// Ordre de tri « État » : en cours, à démarrer, suspendus, puis effectués et annulés
const RANG_ETAT_BON = { 3: 0, 1: 1, 2: 2, 4: 3, 10: 4 };

function TableauBons({ bons, nonLusChat, onApercu, onOuvrir, onDiscuter, outils }) {
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
  // « Aujourd'hui » (tableau de bord) par défaut
  const [activeTab, setActiveTab] = useState(ongletUrl || 'aujourdhui');
  // Compteur : « Signaler une panne » depuis Aujourd'hui ouvre le formulaire dans Mes demandes
  const [demandeSignalement, setDemandeSignalement] = useState(0);
  useEffect(() => { if (ongletUrl) setActiveTab(ongletUrl); }, [ongletUrl, searchParams]);
  const [filtreRole, setFiltreRole] = useState('tous');
  const [data, setData] = useState({ bons: [], taches: [], reclamations: [], demandes: [], formations: [] });
  const [chargementFormations, setChargementFormations] = useState(true);
  // Mes formations (onglet « Formations »), sans bloquer la page si indisponible
  useEffect(() => {
    if (personnelId == null || personnelId === '') { setChargementFormations(false); return; }
    formationService.duPersonnel(personnelId)
      .then((formations) => setData((d) => ({ ...d, formations })))
      .catch((e) => console.error('[GMAO formations] Mes formations :', e))
      .finally(() => setChargementFormations(false));
  }, [personnelId]);
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
      },
      {
        id: 'formations',
        label: t('Formations'),
        icon: GraduationCap,
        items: data.formations,
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
    if (tab.id === 'formations') return tab.items.filter((x) => x.formation?.statut === 'PLANIFIEE').length;
    return tab.items.filter((x) => tab.activeStates.includes(x.etat)).length;
  };

  const aideOnglet = {
    bons: t('Groupés par état : ce qui est en cours d’abord'),
    taches: t('Glissez les cartes d’une colonne à l’autre'),
    demandes: t('Où en sont les pannes que vous avez signalées, jusqu\'à la réparation'),
    discussions: t('Les messages arrivent en direct'),
    formations: t('Vos formations et leurs résultats'),
  }[activeTab];

  const aller = (onglet) => { if (onglet === 'discussions') setChatInitial(null); setActiveTab(onglet); };
  const signaler = () => { setActiveTab('demandes'); setDemandeSignalement((n) => n + 1); };
  const compteurs = {
    bons: data.bons.filter((b) => ACTIVE_STATES.bons.includes(b.etat)).length,
    taches: tachesAFaire,
    retard: enRetard,
    proches: travaux.filter((tr) => tr.statut?.niveau === 'aujourdhui' || tr.statut?.niveau === 'proche').length,
    messages: totalNonLus,
    demandes: data.demandes.filter((x) => !DEMANDES_TERMINEES.includes(x.etape)).length,
    formations: data.formations.filter((x) => x.formation?.statut === 'PLANIFIEE').length,
  };
  const estAujourdhui = activeTab === 'aujourdhui';
  const filtresRole = (
    <div className="ep-filtres-role ept-filtres" role="group" aria-label={t('Filtrer par rôle')}>
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
  );
  // Le calendrier à droite n'accompagne que les bons (les tâches et discussions prennent toute la largeur)
  const avecCote = activeTab === 'bons';

  return (
    <main className="ep-page ep-theme ep-calme ep2 ep3">
      <div className="ep3-cadre">
        {/* ------- EN-TÊTE : salutation + actualiser ------- */}
        <header className="ep3-entete">
          <span className="ep-avatar ep2-avatar" aria-hidden="true">{initialesDe(displayName)}</span>
          <div className="ep3-entete-texte">
            <p className="ep2-date">
              {new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1>{salutation()}{displayName ? `, ${displayName.split(' ')[0]}` : ''}</h1>
            <p className="ep-synthese ep2-synthese">
              {loading ? t('Chargement de vos données…') : syntheses.length === 0 ? t('Rien d’urgent aujourd’hui.') : (
                <>
                  {syntheses.map((x, i) => (
                    <span key={x.cle}>
                      {i > 0 && (i === syntheses.length - 1 ? ` ${t('et')} ` : ', ')}
                      <button type="button" className={`ep-synthese-lien ${x.alerte ? 'is-alerte' : ''}`} onClick={() => aller(x.onglet)}>
                        {x.texte}
                      </button>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
          <button type="button" className="ep2-actualiser" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'ep-spin' : ''} />
            <span>{loading ? t('Chargement…') : t('Actualiser')}</span>
          </button>
        </header>

        {/* ------- ONGLETS ------- */}
        <nav className="ep3-onglets" role="tablist" aria-label={t('Mon espace')}>
          <button type="button" role="tab" aria-selected={estAujourdhui}
            className={`ep3-onglet ${estAujourdhui ? 'is-actif' : ''}`} onClick={() => aller('aujourdhui')}>
            <Sun size={16} aria-hidden="true" />
            <span>{t("Aujourd'hui")}</span>
            {compteurs.retard > 0 && <span className="ep2-nav-nb is-alerte" title={tp('travail en retard', compteurs.retard)}>{compteurs.retard}</span>}
          </button>
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
                className={`ep3-onglet ${actif ? 'is-actif' : ''}`}
                onClick={() => aller(tab.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
                {n > 0 && (
                  <span
                    className={`ep2-nav-nb ${tab.id === 'discussions' ? 'is-alerte' : ''}`}
                    title={tab.id === 'discussions' ? tp('message non lu', n) : tp('actif', n)}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ------- CONTENU (toute la largeur) ------- */}
        <section className="ep2-contenu ep3-contenu">
          {!estAujourdhui && <p className="ep3-aide">{aideOnglet}</p>}

      {error && (
        <div className="ep-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

          {estAujourdhui ? (
            <EspaceAujourdhui
              chargement={loading}
              compteurs={compteurs}
              travaux={travaux}
              onAller={aller}
              onOuvrirTravail={ouvrirTravail}
              onSignaler={signaler}
            />
          ) : (
      <div className={`ep-layout ep2-layout ${avecCote ? '' : 'ep2-layout--plein'}`}>
        <div className="ep-principal ep2-principal" role="tabpanel">

          {activeTab === 'formations' ? (
            <MesFormations liste={data.formations} chargement={chargementFormations} />
          ) : activeTab === 'demandes' ? (
            <MesDemandes
              integre
              onCharge={(demandes) => setData((d) => ({ ...d, demandes }))}
              onOuvrir={ouvrirReclamation}
              demandeSignalement={demandeSignalement}
            />
          ) : loading ? (
            <div className="ep-empty">
              <RefreshCw size={18} className="ep-spin" />
              <span>{t('Chargement de vos données…')}</span>
            </div>
          ) : activeTab === 'bons' ? (
            bonsFiltres.length === 0 ? (
              <div className="ep-empty ept-vide-bloc">
                {data.bons.length > 0 && filtresRole}
                <Wrench size={18} />
                <span>{filtreRole === 'tous' ? t('Aucun bon de maintenance ne vous est associé.') : t('Aucun bon pour ce rôle.')}</span>
              </div>
            ) : (
              <TableauBons
                bons={bonsFiltres}
                nonLusChat={nonLusChat}
                onApercu={(b) => openDetails(b, 'bons')}
                onOuvrir={ouvrirBon}
                onDiscuter={ouvrirDiscussion}
                outils={filtresRole}
              />
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

        {/* ------- À DROITE : échéances (seulement avec les bons) ------- */}
        {avecCote && (
          <aside className="ep-cote" aria-label={t('Mon planning')}>
            <ASurveiller travaux={travaux} onOuvrir={ouvrirTravail} />
            <MiniCalendrier travaux={travaux} onOuvrir={ouvrirTravail} />
          </aside>
        )}
      </div>
          )}
        </section>
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
        taches={data.taches}
        nonLusChat={nonLusChat}
        onDiscuter={(bonId) => { closeDetails(); ouvrirDiscussion(bonId); }}
      />
    </main>
  );
}

// ═════════════════════════════════════════════════════════════
// Onglet Mes demandes (réclamations)   (ancien fichier EspaceReclamation.jsx)
// ═════════════════════════════════════════════════════════════
/**
 * Réclamation ouverte en pleine page depuis Mon espace (même écran que dans « Réclamations »),
 * avec les mêmes actions : modifier, valider, rejeter, créer / associer un bon, ouvrir le bon lié.
 * « Retour » ramène à Mon espace.
 *
 * Props :
 *   reclamationId : réclamation à afficher
 *   onBack()      : retour à Mon espace (qui se recharge)
 *   onOuvrirBon(bon) : ouvre le bon lié dans Mon espace
 */
function EspaceReclamation({ reclamationId, onBack, onOuvrirBon }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modifierOuvert, setModifierOuvert] = useState(false);
  const [associerOuvert, setAssocierOuvert] = useState(false);
  const [creerBonOuvert, setCreerBonOuvert] = useState(false);

  const reclamation = data?.reclamation ?? data;

  const charger = useCallback(async ({ silencieux = false } = {}) => {
    if (!silencieux) setLoading(true);
    try {
      setData(await reclamationService.getWithBonMaintenance(reclamationId));
    } catch (err) {
      console.error('Erreur chargement de la réclamation :', err);
      alert(t('Impossible de charger les détails de cette réclamation.'));
      onBack?.();
    } finally {
      setLoading(false);
    }
  }, [reclamationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger(); }, [charger]);

  const recharger = () => charger({ silencieux: true });

  const enregistrerModification = async (payload) => {
    await reclamationService.update(reclamationId, payload);
    await recharger();
  };

  // Cycle de vie (affecter, prendre en charge, résoudre, clôturer, rouvrir, annuler)
  const actionsRec = useActionsReclamation(() => recharger());

  /** Crée le bon (avec ses éléments) puis le lie à la réclamation, comme dans « Réclamations ». */
  const creerBon = async (payload, children) => {
    const result = await bonMaintenanceFullService.createFull(payload, children || {});
    const bon = result.bonMaintenance;
    try {
      await reclamationBonMaintenanceService.link(reclamationId, bon.id);
    } catch (err) {
      console.error(err);
      alert(t('Le bon {num} a été créé, mais son association à la réclamation a échoué. Utilisez le bouton « Associer » pour le lier manuellement.', { num: bon.num || `#${bon.id}` }));
    }
    if (result.errors?.length > 0) {
      const resume = result.errors.map((e) => `- ${e.type} #${e.index + 1}`).join('\n');
      alert(t("Le bon a été créé, mais {n} élément(s) n'ont pas pu être ajoutés :", { n: result.errors.length }) + `\n${resume}`);
    }
    await recharger();
  };

  const valeursBon = useMemo(() => {
    if (!reclamation) return null;
    return {
      titre: reclamation.num ? t('Réclamation {num}', { num: reclamation.num }) : t('Réclamation'),
      description: reclamation.description || '',
      urgence: reclamation.urgence ?? '',
      lotArticleImmobilistationId: reclamation.lotArticleImmobilistationId ?? '',
    };
  }, [reclamation]);

  return (
    <>
      <ReclamationDetails
        data={data}
        loading={loading}
        validating={actionsRec.enCours}
        libelleRetour={t('Retour à mon espace')}
        onBack={onBack}
        onModifier={() => setModifierOuvert(true)}
        onAction={(nom) => actionsRec.lancer(nom, reclamation)}
        onCreerBon={() => setCreerBonOuvert(true)}
        onAssocier={() => setAssocierOuvert(true)}
        onOuvrirBon={onOuvrirBon}
      />

      <ReclamationModal
        isOpen={modifierOuvert}
        onClose={() => setModifierOuvert(false)}
        onSave={enregistrerModification}
        reclamation={reclamation}
        isEditing
      />

      <AssociateBonMaintenanceModal
        isOpen={associerOuvert}
        onClose={() => { setAssocierOuvert(false); recharger(); }}
        reclamation={reclamation}
      />

      <BonMaintenanceModal
        isOpen={creerBonOuvert}
        onClose={() => setCreerBonOuvert(false)}
        onSave={creerBon}
        bonMaintenance={null}
        isEditing={false}
        initialValues={valeursBon}
        titleOverride={t('Nouveau bon') + ` — ${reclamation?.num || t('Réclamation')}`}
      />

      {actionsRec.fenetres}
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// Onglet Discussions   (ancien fichier Espacediscussions.jsx)
// ═════════════════════════════════════════════════════════════
/*
 * Discussions de Mon espace : à gauche, le chat de chaque bon sur lequel je travaille
 * (dernier message, non-lus) ; à droite, la conversation choisie, en direct.
 */

const ACTUALISATION_MS = 20000;

const heureOuDate = (v) => {
  const d = versDate(v);
  if (!d) return '';
  const aujourdhui = new Date();
  return d.toDateString() === aujourdhui.toDateString()
    ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};

function EspaceDiscussions({ bons, personnelId, bonInitial, onOuvrirBon, onNonLusChange }) {
  const [resumes, setResumes] = useState({});
  const [choisi, setChoisi] = useState(bonInitial ?? null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState(false);

  const ids = useMemo(() => bons.map((b) => b.id).filter((id) => id != null), [bons]);
  const cleIds = ids.join(',');

  // Dernier message et non-lus de chaque bon ; rafraîchi toutes les 20 s quand la page est visible
  const charger = useCallback(() => {
    if (!cleIds) return;
    chatBonService.getResumes(cleIds.split(',').map(Number))
      .then((liste) => {
        setResumes(Object.fromEntries(liste.map((r) => [r.bonMaintenanceId, r])));
        setErreur(false);
      })
      .catch(() => setErreur(true));
  }, [cleIds]);

  useEffect(() => {
    charger();
    const minuterie = setInterval(() => {
      if (document.visibilityState === 'visible') charger();
    }, ACTUALISATION_MS);
    return () => clearInterval(minuterie);
  }, [charger]);

  // Total des non-lus, pour la carte « Discussions » et le tableau des bons
  useEffect(() => {
    onNonLusChange?.(Object.fromEntries(Object.values(resumes).map((r) => [r.bonMaintenanceId, r.nonLus])));
  }, [resumes, onNonLusChange]);

  // Conversations : d'abord celles qui ont des non-lus, puis par dernier message, puis les bons sans message
  const conversations = useMemo(() => {
    const filtre = recherche.trim().toLowerCase();
    return bons
      .filter((b) => !filtre || [b.num, b.titre].filter(Boolean).join(' ').toLowerCase().includes(filtre))
      .map((b) => ({ bon: b, resume: resumes[b.id] }))
      .sort((a, b) => {
        const na = a.resume?.nonLus || 0;
        const nb = b.resume?.nonLus || 0;
        if ((na > 0) !== (nb > 0)) return na > 0 ? -1 : 1;
        const da = a.resume?.dernierMessage?.id ?? 0;
        const db = b.resume?.dernierMessage?.id ?? 0;
        if (da !== db) return db - da;
        return (versDate(b.bon.dateCreation)?.getTime() ?? 0) - (versDate(a.bon.dateCreation)?.getTime() ?? 0);
      });
  }, [bons, resumes, recherche]);

  const bonChoisi = bons.find((b) => b.id === choisi) || null;

  // Conversation ouverte : ses messages sont lus, et son aperçu suit le dernier message
  const surNonLus = useCallback((n) => {
    if (choisi == null) return;
    setResumes((r) => (r[choisi] && r[choisi].nonLus !== n ? { ...r, [choisi]: { ...r[choisi], nonLus: n } } : r));
  }, [choisi]);

  const surDernierMessage = useCallback((m) => {
    setResumes((r) => {
      const actuel = r[m.bonMaintenanceId];
      if (actuel?.dernierMessage?.id === m.id) return r;
      return { ...r, [m.bonMaintenanceId]: { bonMaintenanceId: m.bonMaintenanceId, nonLus: 0, ...actuel, dernierMessage: m } };
    });
  }, []);

  if (bons.length === 0) {
    return (
      <div className="ep-empty">
        <MessageCircle size={18} />
        <span>{t('Aucun bon de maintenance ne vous est associé.')}</span>
      </div>
    );
  }

  return (
    <div className={`ep-discussions ${bonChoisi ? 'a-conversation' : ''}`}>
      {/* ---- Liste des conversations ---- */}
      <aside className="ep-disc-liste" aria-label={t('Conversations')}>
        <label className="ep-disc-recherche">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher un bon…')}
            aria-label={t('Rechercher un bon…')}
          />
        </label>

        {erreur && <p className="ep-disc-erreur">{t('Impossible de charger les discussions.')}</p>}

        <ul>
          {conversations.map(({ bon, resume }) => {
            const m = resume?.dernierMessage;
            const deMoi = m && String(m.personnelId) === String(personnelId);
            const nonLus = resume?.nonLus || 0;
            return (
              <li key={bon.id}>
                <button
                  type="button"
                  className={`ep-disc-item ${choisi === bon.id ? 'is-choisi' : ''} ${nonLus ? 'a-non-lus' : ''}`}
                  onClick={() => setChoisi(bon.id)}
                  aria-current={choisi === bon.id ? 'true' : undefined}
                >
                  <span className="ep-disc-pastille" aria-hidden="true"><MessageCircle size={16} /></span>
                  <span className="ep-disc-texte">
                    <span className="ep-disc-ligne">
                      <strong className="ep-disc-num">{refBon(bon, bon.id)}</strong>
                      {m && <time className="ep-disc-heure">{heureOuDate(m.dateEnvoi)}</time>}
                    </span>
                    <span className="ep-disc-titre">{bon.titre || '—'}</span>
                    <span className="ep-disc-ligne">
                      <span className="ep-disc-apercu">
                        {m
                          ? `${deMoi ? t('Vous') : (m.personnelNom || t('Un participant'))} : ${m.contenu}`
                          : t('Aucun message pour l’instant')}
                      </span>
                      {nonLus > 0 && <span className="ep-disc-nb">{nonLus}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {conversations.length === 0 && <li className="ep-disc-vide">{t('Aucun bon ne correspond.')}</li>}
        </ul>
      </aside>

      {/* ---- Conversation ---- */}
      <section className="ep-disc-conversation" aria-label={t('Conversation')}>
        {bonChoisi ? (
          <>
            <header className="ep-disc-entete">
              <button type="button" className="ep-disc-retour" onClick={() => setChoisi(null)} aria-label={t('Retour aux conversations')}>
                <ArrowLeft size={18} className="rtl-miroir" />
              </button>
              <div className="ep-disc-entete-texte">
                <strong>{refBon(bonChoisi, bonChoisi.id)}</strong>
                <span>{bonChoisi.titre || ''}</span>
              </div>
              <button type="button" className="ep-open-button ep-open-button--plein" onClick={() => onOuvrirBon(bonChoisi)}>
                <ExternalLink size={15} /> {t('Ouvrir le bon')}
              </button>
            </header>
            <div className="ep-disc-chat">
              <BmdChat
                key={bonChoisi.id}
                bonId={bonChoisi.id}
                onNonLusChange={surNonLus}
                onDernierMessage={surDernierMessage}
              />
            </div>
          </>
        ) : (
          <div className="ep-disc-accueil">
            <span className="ep-disc-accueil-icone"><MessageCircle size={28} /></span>
            <p>{t('Choisissez un bon à gauche pour discuter avec son équipe.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
