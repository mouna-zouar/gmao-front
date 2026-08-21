import React from 'react';
import './Modal.css';

const ETAT_LABELS = {
  0: 'Ouverte',
  1: 'En cours',
  2: 'Clôturée',
};

const BON_ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const NIVEAU_LABELS = {
  1: 'Faible',
  2: 'Moyenne',
  3: 'Élevée',
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ?? `État ${etat}`;
}

function bonEtatLabel(etat) {
  if (etat == null) return '—';
  return BON_ETAT_LABELS[etat] ?? `État ${etat}`;
}

function niveauLabel(niveau) {
  if (niveau == null) return '—';
  return NIVEAU_LABELS[niveau] ?? `Niveau ${niveau}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a', textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: '0.95rem', color: '#0f766e', margin: '18px 0 8px', fontWeight: 700 }}>
      {children}
    </h3>
  );
}

const ReclamationDetailsModal = ({ isOpen, onClose, loading, data }) => {
  if (!isOpen) return null;

  const reclamation = data?.reclamation;
  const bonMaintenance = data?.bonMaintenance;
  const immobilisation = data?.immobilisation;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container reclamation-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Détails de la réclamation</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ padding: '20px', color: '#64748b' }}>Chargement...</p>
          ) : !reclamation ? (
            <p style={{ padding: '20px', color: '#64748b' }}>Aucune donnée disponible.</p>
          ) : (
            <div style={{ padding: '4px 2px' }}>
              <SectionTitle>Réclamation</SectionTitle>
              <InfoRow label="Numéro" value={reclamation.num || `#${reclamation.id}`} />
              <InfoRow label="Description" value={reclamation.description} />
              <InfoRow label="État" value={etatLabel(reclamation.etat)} />
              <InfoRow label="Criticité" value={niveauLabel(reclamation.criticite)} />
              <InfoRow label="Urgence" value={niveauLabel(reclamation.urgence)} />
              <InfoRow
                label="Personnel affecté"
                value={reclamation.personnelAffecteNom || '— Non affecté —'}
              />
              <InfoRow label="Date" value={formatDate(reclamation.date)} />

              <SectionTitle>Bon de maintenance</SectionTitle>
              {bonMaintenance ? (
                <>
                  <InfoRow label="Numéro" value={bonMaintenance.num || `#${bonMaintenance.id}`} />
                  <InfoRow label="Titre" value={bonMaintenance.titre} />
                  <InfoRow label="État" value={bonEtatLabel(bonMaintenance.etat)} />
                  <InfoRow label="Urgence" value={niveauLabel(bonMaintenance.urgence)} />
                  <InfoRow label="Date de création" value={formatDate(bonMaintenance.dateCreation)} />
                  <InfoRow label="Date d'intervention" value={formatDate(bonMaintenance.dateIntervention)} />
                  <InfoRow label="Date de clôture" value={formatDate(bonMaintenance.dateCloture)} />
                  <InfoRow label="Personnel demandant" value={bonMaintenance.personnelDemandantNom} />
                  <InfoRow label="Coût total" value={bonMaintenance.coutTotal != null ? `${bonMaintenance.coutTotal} DT` : '—'} />
                </>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucun bon de maintenance associé.</p>
              )}

              <SectionTitle>Immobilisation</SectionTitle>
              {immobilisation?.lotArticleImmobilistation ? (
                <>
                  <InfoRow
                    label="Lot article immobilisé"
                    value={immobilisation.lotArticleImmobilistation.designation
                      || `#${immobilisation.lotArticleImmobilistation.id}`}
                  />
                  {immobilisation.lotArticle && (
                    <InfoRow
                      label="Lot article"
                      value={immobilisation.lotArticle.designation || `#${immobilisation.lotArticle.id}`}
                    />
                  )}
                </>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucune immobilisation liée.</p>
              )}
            </div>
          )}
        </div>

        <div className="navigation-footer">
          <div className="nav-buttons" />
          <button type="button" className="close-btn-secondary" onClick={onClose} style={{
            padding: '9px 16px', border: '1px solid #cbd5e1', borderRadius: '8px',
            background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer',
          }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReclamationDetailsModal;