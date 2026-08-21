import React, { useState, useEffect } from 'react';
import Button from '../Button';
import './Modal.css';

const MaintenanceTacheModal = ({ isOpen, onClose, onSave, maintenanceTache, isEditing }) => {
  const [nom, setNom] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && maintenanceTache && isEditing) {
      setNom(maintenanceTache.nom || '');
    } else if (isOpen) {
      setNom('');
    }
    setError(null);
  }, [isOpen, maintenanceTache, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({ nom: nom.trim() });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Échec de l'enregistrement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier la tâche' : 'Nouvelle tâche de maintenance'}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Vidange, Contrôle visuel..."
              autoFocus
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="navigation-footer">
            <div className="nav-buttons">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceTacheModal;