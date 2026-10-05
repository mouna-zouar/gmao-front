import React, { useState, useEffect } from 'react';
import Button from '../Button';
import {
  MapPin, X, Navigation, Home,
  Loader2, Save, AlertTriangle, Building2,
} from 'lucide-react';
import axios from 'axios'; // adaptez à votre client HTTP existant
import './Modal.css';
import './EmplacementModal.css';

const emptyForm = {
  nom: '',
  adresse: '',
  villeId: '',
};

const EmplacementModal = ({ isOpen, onClose, onSave, emplacement, isEditing }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [villes, setVilles] = useState([]);
  const [villesLoading, setVillesLoading] = useState(false);
  const [villesError, setVillesError] = useState(null);

  // Charger la liste des villes à l'ouverture du modal
  useEffect(() => {
    if (!isOpen) return;

    const fetchVilles = async () => {
      setVillesLoading(true);
      setVillesError(null);
      try {
        const res = await axios.get('/api/villes');
        console.log('Réponse /api/villes:', res.data); // <-- à retirer une fois le format confirmé

        // Défensif : gère tableau direct, ou enveloppe { data: [...] }, { result: [...] }, etc.
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.result)
          ? res.data.result
          : [];

        setVilles(data);

        if (data.length === 0) {
          console.warn('Aucune ville trouvée ou format de réponse inattendu.');
        }
      } catch (err) {
        console.error(err);
        setVillesError('Impossible de charger les villes.');
        setVilles([]);
      } finally {
        setVillesLoading(false);
      }
    };

    fetchVilles();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && emplacement) {
      setFormData({
        nom: emplacement.nom || '',
        adresse: emplacement.adresse || '',
        villeId: emplacement.villeId ?? '',
      });
    } else {
      setFormData(emptyForm);
    }
    setError(null);
  }, [isOpen, emplacement, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!formData.nom.trim() && !formData.adresse.trim()) {
      setError('Renseigne au moins un nom ou une adresse.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        nom: formData.nom.trim() || null,
        adresse: formData.adresse.trim() || null,
        villeId: formData.villeId === '' ? null : Number(formData.villeId),
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

  const safeVilles = Array.isArray(villes) ? villes : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="empm-modal" onClick={(e) => e.stopPropagation()}>

        <div className="empm-header">
          <div className="empm-header-left">
            <div className="empm-header-icon">
              <MapPin size={22} strokeWidth={2.2} />
            </div>
            <div>
              <span className="empm-eyebrow">
                {isEditing ? 'Modification' : 'Nouvel emplacement'}
              </span>
              <h2>{isEditing ? "Modifier l'emplacement" : 'Créer un emplacement'}</h2>
            </div>
          </div>
          <button type="button" className="empm-close" onClick={onClose}>
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <form className="empm-body" onSubmit={handleSubmit}>

          <section className="empm-section">
            <header className="empm-section-head">
              <div>
                <h3>Informations de l'emplacement</h3>
                <p>Nom, adresse et ville du lieu</p>
              </div>
            </header>

            <div className="empm-grid">
              <div className="empm-field empm-field--full">
                <label htmlFor="empm-nom">Nom</label>
                <div className="empm-input-icon">
                  <Home size={15} strokeWidth={2.4} />
                  <input
                    id="empm-nom"
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    placeholder="Ex : Siège Tunis"
                    autoFocus
                  />
                </div>
              </div>

              <div className="empm-field empm-field--full">
                <label htmlFor="empm-adresse">Adresse</label>
                <div className="empm-input-icon">
                  <Navigation size={15} strokeWidth={2.4} />
                  <input
                    id="empm-adresse"
                    type="text"
                    name="adresse"
                    value={formData.adresse}
                    onChange={handleChange}
                    placeholder="Ex : 12 Avenue Habib Bourguiba, Tunis"
                  />
                </div>
              </div>

              <div className="empm-field empm-field--full">
                <label htmlFor="empm-ville">Ville</label>
                <div className="empm-input-icon">
                  <Building2 size={15} strokeWidth={2.4} />
                  <select
                    id="empm-ville"
                    name="villeId"
                    value={formData.villeId}
                    onChange={handleChange}
                    disabled={villesLoading}
                  >
                    <option value="">-- Sélectionner une ville --</option>
                    {safeVilles.map((ville) => (
                      <option key={ville.id} value={ville.id}>
                        {ville.nom}
                      </option>
                    ))}
                  </select>
                </div>
                {villesLoading && (
                  <span className="empm-hint">Chargement des villes...</span>
                )}
                {villesError && (
                  <span className="empm-hint empm-hint--error">{villesError}</span>
                )}
              </div>
            </div>
          </section>

          {error && (
            <div className="empm-error">
              <AlertTriangle size={16} strokeWidth={2.5} />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="empm-footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} strokeWidth={2.5} className="empm-spin" style={{ marginRight: 6 }} />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                {isEditing ? 'Mettre à jour' : "Créer l'emplacement"}
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
};

export default EmplacementModal;