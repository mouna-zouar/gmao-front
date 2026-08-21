import React, { useState, useEffect } from 'react';
import Button from '../../ui/Button';
import '../../ui/modals/Modal.css';

const CompteurModal = ({ isOpen, onClose, onSave, compteur, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    nom: '',
    unite: '',
    nature: '',
  });

  useEffect(() => {
    if (isOpen && compteur && isEditing) {
      setFormData({
        nom: compteur.nom || '',
        unite: compteur.unite || '',
        nature: compteur.nature ?? '',
      });
    } else if (isOpen) {
      setFormData({ nom: '', unite: '', nature: '' });
    }
    setError(null);
  }, [isOpen, compteur, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        nom: formData.nom.trim(),
        unite: formData.unite.trim() || null,
        nature: formData.nature === '' ? null : Number(formData.nature),
      };
      await onSave(payload);
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
      <div className="modal-container compteur-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier le compteur' : 'Nouveau compteur'}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="step-content">
            <div className="form-grid">
              <div className="form-group">
                <label>Nom *</label>
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  placeholder="Ex : Heures de fonctionnement"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Unité</label>
                <input
                  type="text"
                  name="unite"
                  value={formData.unite}
                  onChange={handleChange}
                  placeholder="Ex : heures, km, cycles"
                />
              </div>

              <div className="form-group">
                <label>Nature (code)</label>
                <input
                  type="number"
                  name="nature"
                  value={formData.nature}
                  onChange={handleChange}
                  placeholder="Ex : 0"
                />
              </div>

              {error && <div className="form-error">{error}</div>}
            </div>
          </div>

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

export default CompteurModal;