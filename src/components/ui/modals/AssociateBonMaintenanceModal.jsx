import React, { useEffect, useMemo, useState } from 'react';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import './Modal.css';

const BON_ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

function bonEtatLabel(etat) {
  if (etat == null) return '—';
  return BON_ETAT_LABELS[etat] ?? `État ${etat}`;
}

const AssociateBonMaintenanceModal = ({ isOpen, onClose, reclamation }) => {
  const [linkedBons, setLinkedBons] = useState([]);
  const [loadingLinkedBons, setLoadingLinkedBons] = useState(false);
  const [allBons, setAllBons] = useState([]);
  const [bonToLink, setBonToLink] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAllBons = async () => {
      try {
        const page = await bonMaintenanceService.getAll(0, 200);
        setAllBons(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement bons de maintenance :', err);
        setAllBons([]);
      }
    };
    fetchAllBons();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !reclamation) {
      setLinkedBons([]);
      return;
    }

    const fetchLinkedBons = async () => {
      setLoadingLinkedBons(true);
      try {
        const bons = await reclamationBonMaintenanceService.getBonMaintenancesByReclamation(reclamation.id);
        setLinkedBons(bons ?? []);
      } catch (err) {
        console.error('Erreur chargement bons liés :', err);
        setLinkedBons([]);
      } finally {
        setLoadingLinkedBons(false);
      }
    };

    fetchLinkedBons();
    setBonToLink('');
  }, [isOpen, reclamation]);

  const availableBonsToLink = useMemo(() => {
    const linkedIds = new Set(linkedBons.map((b) => b.id));
    return allBons.filter((b) => !linkedIds.has(b.id));
  }, [allBons, linkedBons]);

  const handleLinkBon = async () => {
    if (!bonToLink || !reclamation) return;
    setLinking(true);
    try {
      await reclamationBonMaintenanceService.link(reclamation.id, Number(bonToLink));
      const bons = await reclamationBonMaintenanceService.getBonMaintenancesByReclamation(reclamation.id);
      setLinkedBons(bons ?? []);
      setBonToLink('');
    } catch (err) {
      console.error(err);
      alert("Échec de l'association.");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkBon = async (bonId) => {
    if (!reclamation) return;
    setUnlinkingId(bonId);
    try {
      await reclamationBonMaintenanceService.unlink(reclamation.id, bonId);
      setLinkedBons((prev) => prev.filter((b) => b.id !== bonId));
    } catch (err) {
      console.error(err);
      alert("Échec de la dissociation.");
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container associate-bon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Associer un bon de maintenance — {reclamation?.num || `Réclamation #${reclamation?.id}`}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ padding: '4px 2px' }}>
            {loadingLinkedBons ? (
              <p style={{ color: '#64748b' }}>Chargement...</p>
            ) : linkedBons.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucun bon de maintenance associé pour l'instant.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                {linkedBons.map((bon) => (
                  <li
                    key={bon.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{bon.num || `Bon #${bon.id}`}</span>
                      {bon.titre && <span style={{ color: '#64748b' }}> — {bon.titre}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 600 }}>
                        {bonEtatLabel(bon.etat)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkBon(bon.id)}
                        disabled={unlinkingId === bon.id}
                        style={{
                          padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: '6px',
                          background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {unlinkingId === bon.id ? '...' : 'Dissocier'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={bonToLink}
                onChange={(e) => setBonToLink(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Sélectionner un bon de maintenance...</option>
                {availableBonsToLink.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.num || `Bon #${b.id}`}{b.titre ? ` — ${b.titre}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLinkBon}
                disabled={!bonToLink || linking}
                style={{
                  padding: '9px 16px', border: 'none', borderRadius: '8px',
                  background: '#0f766e', color: '#fff', fontWeight: 600, cursor: 'pointer',
                  opacity: (!bonToLink || linking) ? 0.6 : 1,
                }}
              >
                {linking ? 'Association...' : 'Associer'}
              </button>
            </div>
          </div>
        </div>

        <div className="navigation-footer">
          <div className="nav-buttons" />
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px', border: '1px solid #cbd5e1', borderRadius: '8px',
              background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssociateBonMaintenanceModal;