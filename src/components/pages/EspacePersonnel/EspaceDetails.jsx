import { useEffect } from 'react';
import {
  ClipboardList,
  FileText,
  Wrench,
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
  XCircle,
  MapPin,
} from 'lucide-react';
import { GRAVITE_LABELS, ETAT_IMMOBILISATION_OPTIONS } from '../bonmaintenance/BmdCommun';
import { t, locale } from '../../../i18n';
import { libelleTypeEntretien, libelleSourceInformation } from '../../../constants/FicheIntervention';
import BadgeStatut from '../../ui/BadgeStatut/BadgeStatut';
import { etatLabel, etatTon, dateLabel } from './espaceCommun';
import { StatusPill } from './StatusPill';

const TYPE_BADGE = { bons: 'bon', reclamations: 'reclamation' };

const ROLES = {
  INTERVENANT: { label: 'Intervenant', icon: HardHat, ton: 'action' },
  DIAGNOSTIQUEUR: { label: 'Diagnostic', icon: Stethoscope, ton: 'attention' },
  CONTROLEUR: { label: 'Contrôle', icon: ShieldCheck, ton: 'info' },
  REMISE_EN_SERVICE: { label: 'Remise en service', icon: Power, ton: 'ok' },
  CREATEUR: { label: 'Créateur', icon: PenLine, ton: 'neutre' },
  DEMANDEUR: { label: 'Demandeur', icon: UserRound, ton: 'neutre' },
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
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return dateHeureLabel(value);
  if (typeof value === 'boolean') return value ? t('Oui') : t('Non');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const etatImmoLabel = (v) => {
  const o = ETAT_IMMOBILISATION_OPTIONS.find((x) => x.value === v);
  return o ? t(o.label) : null;
};

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
    referenceKey: null,
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

const NIVEAUX_URGENCE = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée', 4: 'Urgente' };

const CLES_MASQUEES = new Set(['id', 'n', 'etat', 'createdAt', 'updatedAt', 'roles', 'intervention', 'diagnostic', 'controle', 'remiseEnService']);

const estIdentifiant = (cle) => cle === 'id' || /Ids?$/.test(cle);

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

const PARCOURS_BON = [
  { etat: 1, label: 'Créé' },
  { etat: 3, label: 'En cours' },
  { etat: 4, label: 'Effectué' },
];

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
  const personne = b.personnelDemandantNom
    ? [t('Demandeur'), b.personnelDemandantNom]
    : [t('Créé par'), b.personnelCreationNom];
  const tonEtat = etatTon('bons', b.etat);

  return (
    <div className="ep-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`epa ep-ton--${tonEtat}`} role="dialog" aria-modal="true" aria-labelledby="epa-titre">
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

export function DetailModal({ item: itemBrut, type, onClose, onOuvrirBon, onOuvrirReclamation, taches, nonLusChat, onDiscuter }) {
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
