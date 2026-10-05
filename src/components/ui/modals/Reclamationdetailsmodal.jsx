import React from 'react';
import {
  X,
  FileText,
  AlertCircle,
  Calendar,
  User,
  Wrench,
  Inbox,
  Hash,
  Flag,
} from 'lucide-react';
import './ReclamationDetailsModal.css';

const ETAT_LABELS = { 0: 'Ouverte', 1: 'En cours', 2: 'Clôturée' };

const BON_ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const etatLabel = (e) => ETAT_LABELS[e] ?? `État ${e}`;
const bonEtatLabel = (e) =>
  e == null ? '—' : BON_ETAT_LABELS[e] ?? `État ${e}`;

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getEtatClass(etat, prefix) {
  const map = {
    reclamation: { 0: 'etat-ouvert', 1: 'etat-encours', 2: 'etat-cloture' },
    bon: {
      1: 'bon-nouveau',
      2: 'bon-suspendu',
      3: 'bon-encours',
      4: 'bon-effectue',
      10: 'bon-annule',
    },
  };
  return map[prefix]?.[etat] || '';
}

/* ─────────── Sous-composants ─────────── */

function Cell({ label, value, children, full, muted, icon: Icon }) {
  const isEmpty = !children && (value == null || value === '');
  return (
    <div className={`rdm-cell ${full ? 'full' : ''}`}>
      <div className="rdm-cell-label">
        {Icon && <Icon size={11} strokeWidth={2.4} />}
        {label}
      </div>
      <div className={`rdm-cell-value ${isEmpty || muted ? 'muted' : ''}`}>
        {children ?? (isEmpty ? '—' : value)}
      </div>
    </div>
  );
}

function Section({ title, count, accent, children }) {
  return (
    <section className="rdm-section">
      <div className={`rdm-section-head ${accent ? `is-${accent}` : ''}`}>
        <span className="rdm-section-line" />
        <h3 className="rdm-section-title">{title}</h3>
        {count != null && <span className="rdm-section-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Niveau({ value, labels }) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <span className={`niveau is-${value}`}>
      <span className="niveau-dots">
        <span />
        <span />
        <span />
      </span>
      {labels[value] ?? `Niveau ${value}`}
    </span>
  );
}

function TimelineItem({ label, value, pending }) {
  return (
    <div className={`rdm-timeline-item ${pending ? 'is-pending' : ''}`}>
      <div className="rdm-timeline-dot" />
      <div className="rdm-timeline-content">
        <span className="rdm-timeline-label">{label}</span>
        <span className="rdm-timeline-value">{value ?? '—'}</span>
      </div>
    </div>
  );
}

function EmptyState({ message, inline }) {
  if (inline)
    return <div className="rdm-empty rdm-empty-inline">{message}</div>;
  return (
    <div className="rdm-empty">
      <div className="rdm-empty-icon">
        <Inbox size={24} strokeWidth={1.6} />
      </div>
      <span>{message}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="rdm-skeleton">
      <div className="rdm-skel rdm-skel-block tall" />
      <div className="rdm-skel rdm-skel-block" />
    </div>
  );
}

/* ─────────── Composant principal ─────────── */

const ReclamationDetailsModal = ({ isOpen, onClose, loading, data }) => {
  if (!isOpen) return null;

  const reclamation = data?.reclamation;
  const bonMaintenance = data?.bonMaintenance;

  const NIVEAUX = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

  const dateCrea = formatDate(bonMaintenance?.dateCreation);
  const dateInter = formatDate(bonMaintenance?.dateIntervention);
  const dateClot = formatDate(bonMaintenance?.dateCloture);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rdm-title"
    >
      <div
        className="modal-container rdm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HERO */}
        <header className="rdm-hero">
          <div className="rdm-hero-main">
            <div className="rdm-hero-eyebrow">Réclamation</div>
            <h2 id="rdm-title" className="rdm-hero-ref">
              {reclamation?.num || (reclamation ? `#${reclamation.id}` : '—')}
            </h2>
            {reclamation && (
              <p className="rdm-hero-sub">
                <span
                  className={`badge-etat ${getEtatClass(
                    reclamation.etat,
                    'reclamation'
                  )}`}
                >
                  {etatLabel(reclamation.etat)}
                </span>
                {reclamation.personnelAffecteNom && (
                  <>
                    <span className="divider" />
                    <span>{reclamation.personnelAffecteNom}</span>
                  </>
                )}
                {reclamation.date && (
                  <>
                    <span className="divider" />
                    <span>{formatDate(reclamation.date)}</span>
                  </>
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            className="rdm-close-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        {/* BODY */}
        <div className="rdm-body">
          {loading ? (
            <Skeleton />
          ) : !reclamation ? (
            <EmptyState message="Aucune donnée disponible." />
          ) : (
            <>
              {/* Réclamation */}
              <Section title="Informations" accent="amber">
                <div className="rdm-grid">
                  <Cell
                    label="Numéro"
                    icon={Hash}
                    value={reclamation.num || `#${reclamation.id}`}
                  />
                  <Cell
                    label="Date"
                    icon={Calendar}
                    value={formatDate(reclamation.date) || '—'}
                  />
                  <Cell
                    label="Criticité"
                    icon={Flag}
                    value={
                      <Niveau value={reclamation.criticite} labels={NIVEAUX} />
                    }
                  />
                  <Cell
                    label="Urgence"
                    icon={Flag}
                    value={
                      <Niveau value={reclamation.urgence} labels={NIVEAUX} />
                    }
                  />
                  <Cell
                    label="Personnel affecté"
                    icon={User}
                    full
                    muted={!reclamation.personnelAffecteNom}
                    value={reclamation.personnelAffecteNom || 'Non affecté'}
                  />
                  <Cell
                    label="Description"
                    full
                    muted={!reclamation.description}
                    value={reclamation.description || 'Aucune description'}
                  />
                </div>
              </Section>

              {/* Bon de maintenance */}
              <Section title="Bon de maintenance" accent="sky">
                {bonMaintenance ? (
                  <>
                    <div className="rdm-grid">
                      <Cell
                        label="Numéro"
                        icon={Hash}
                        value={bonMaintenance.num || `#${bonMaintenance.id}`}
                      />
                      <Cell
                        label="État"
                        value={
                          <span
                            className={`badge-etat ${getEtatClass(
                              bonMaintenance.etat,
                              'bon'
                            )}`}
                          >
                            {bonEtatLabel(bonMaintenance.etat)}
                          </span>
                        }
                      />
                      <Cell label="Titre" icon={Wrench} full value={bonMaintenance.titre} />
                      <Cell
                        label="Urgence"
                        value={
                          <Niveau
                            value={bonMaintenance.urgence}
                            labels={NIVEAUX}
                          />
                        }
                      />
                      <Cell
                        label="Personnel demandant"
                        icon={User}
                        value={bonMaintenance.personnelDemandantNom || '—'}
                      />
                      <Cell
                        label="Coût total"
                        full
                        muted={bonMaintenance.coutTotal == null}
                        value={
                          bonMaintenance.coutTotal != null ? (
                            <span className="money">
                              {bonMaintenance.coutTotal}
                            </span>
                          ) : (
                            'Non renseigné'
                          )
                        }
                      />
                    </div>

                    {/* Timeline */}
                    {(dateCrea || dateInter || dateClot) && (
                      <div className="rdm-timeline" style={{ marginTop: 14 }}>
                        <TimelineItem
                          label="Création"
                          value={dateCrea}
                          pending={!dateCrea}
                        />
                        <TimelineItem
                          label="Intervention"
                          value={dateInter}
                          pending={!dateInter}
                        />
                        <TimelineItem
                          label="Clôture"
                          value={dateClot}
                          pending={!dateClot}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    inline
                    message="Aucun bon de maintenance associé."
                  />
                )}
              </Section>
            </>
          )}
        </div>

        {/* FOOTER */}
        <footer className="rdm-footer">
          <button
            type="button"
            className="rdm-footer-close-btn"
            onClick={onClose}
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReclamationDetailsModal;