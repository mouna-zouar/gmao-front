import React, { useState, useEffect } from 'react';
import Button from '../Button';
import personnelService from '../../../services/personnelService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import './Modal.css';
import './ReclamationModal.css';

const ETAT_OPTIONS = [
  { value: 0, label: 'Ouverte' },
  { value: 1, label: 'En cours' },
  { value: 2, label: 'Clôturée' },
];

const NIVEAU_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];

const emptyForm = {
  num: '',
  n: '',
  description: '',
  etat: 0,
  criticite: '',
  urgence: '',
  personnelAffecteId: '',
  lotArticleImmobilistationId: '',
};

const ReclamationModal = ({ isOpen, onClose, onSave, reclamation, isEditing }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [personnels, setPersonnels] = useState([]);
  const [loadingPersonnels, setLoadingPersonnels] = useState(false);

  const [immobilisations, setImmobilisations] = useState([]);
  const [loadingImmobilisations, setLoadingImmobilisations] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPersonnels = async () => {
      setLoadingPersonnels(true);
      try {
        const page = await personnelService.getAll(0, 200);
        setPersonnels(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement personnel :', err);
        setPersonnels([]);
      } finally {
        setLoadingPersonnels(false);
      }
    };

    const fetchImmobilisations = async () => {
      setLoadingImmobilisations(true);
      try {
        const page = await lotArticleImmobilistationService.getAll(0, 200);
        setImmobilisations(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement immobilisations :', err);
        setImmobilisations([]);
      } finally {
        setLoadingImmobilisations(false);
      }
    };

    fetchPersonnels();
    fetchImmobilisations();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && reclamation && isEditing) {
      setFormData({
        num: reclamation.num || '',
        n: reclamation.n ?? '',
        description: reclamation.description || '',
        etat: reclamation.etat ?? 0,
        criticite: reclamation.criticite ?? '',
        urgence: reclamation.urgence ?? '',
        personnelAffecteId: reclamation.personnelAffecteId ?? '',
        lotArticleImmobilistationId: '',
      });
    } else if (isOpen) {
      setFormData(emptyForm);
    }
    setError(null);
  }, [isOpen, reclamation, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      setError('La description est obligatoire.');
      return;
    }

    if (!isEditing && !formData.lotArticleImmobilistationId) {
      setError("L'immobilisation concernée est obligatoire à la création (elle sert à générer le bon de maintenance).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        num: formData.num.trim() || null,
        n: formData.n === '' ? null : Number(formData.n),
        description: formData.description.trim(),
        etat: Number(formData.etat),
        criticite: formData.criticite === '' ? null : Number(formData.criticite),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        personnelAffecteId: formData.personnelAffecteId === '' ? null : Number(formData.personnelAffecteId),
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId === ''
          ? null
          : Number(formData.lotArticleImmobilistationId),
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
      <div className="modal-container reclamation-modal-v2" onClick={(e) => e.stopPropagation()}>
        <div className="rcm-header">
          <div className="rcm-header-text">
            <span className="rcm-eyebrow">{isEditing ? 'Modification' : 'Nouvelle entrée'}</span>
            <h2>{isEditing ? 'Modifier la réclamation' : 'Nouvelle réclamation'}</h2>
          </div>
          <button type="button" className="rcm-close-btn" onClick={onClose} aria-label="Fermer">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="rcm-body" onSubmit={handleSubmit}>

          <section className="rcm-section">
            <h3 className="rcm-section-title">Description du problème</h3>
            <div className="rcm-field">
              <label htmlFor="rcm-description">Description *</label>
              <textarea
                id="rcm-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Décrire le problème signalé..."
                rows={3}
                autoFocus
                required
              />
            </div>
          </section>

          {!isEditing && (
            <section className="rcm-section">
              <h3 className="rcm-section-title">Immobilisation concernée</h3>
              <div className="rcm-field">
                <label htmlFor="rcm-immobilisation">Immobilisation *</label>
                <select
                  id="rcm-immobilisation"
                  name="lotArticleImmobilistationId"
                  value={formData.lotArticleImmobilistationId}
                  onChange={handleChange}
                  disabled={loadingImmobilisations}
                  required
                >
                  <option value="">Sélectionner une immobilisation...</option>
                  {loadingImmobilisations ? (
                    <option disabled>Chargement...</option>
                  ) : (
                    immobilisations.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.designation || `Immobilisation #${i.id}`}
                      </option>
                    ))
                  )}
                </select>
           
              </div>
            </section>
          )}

          <section className="rcm-section">
            <h3 className="rcm-section-title">Classification</h3>
            <div className="rcm-grid">
              <div className="rcm-field">
                <label htmlFor="rcm-criticite">Criticité</label>
                <select id="rcm-criticite" name="criticite" value={formData.criticite} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="rcm-field">
                <label htmlFor="rcm-urgence">Urgence</label>
                <select id="rcm-urgence" name="urgence" value={formData.urgence} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {isEditing && (
                <div className="rcm-field">
                  <label htmlFor="rcm-etat">État</label>
                  <select id="rcm-etat" name="etat" value={formData.etat} onChange={handleChange}>
                    {ETAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          <section className="rcm-section">
            <h3 className="rcm-section-title">Identification &amp; suivi</h3>
            <div className="rcm-grid">
              <div className="rcm-field">
                <label htmlFor="rcm-num">Numéro</label>
                <input
                  id="rcm-num"
                  type="text"
                  name="num"
                  value={formData.num}
                  onChange={handleChange}
                  placeholder="Ex : REC-2026-014"
                />
              </div>

              <div className="rcm-field">
                <label htmlFor="rcm-n">N° interne</label>
                <input
                  id="rcm-n"
                  type="number"
                  name="n"
                  value={formData.n}
                  onChange={handleChange}
                />
              </div>

              <div className="rcm-field">
                <label htmlFor="rcm-personnel">Personnel affecté</label>
                <select
                  id="rcm-personnel"
                  name="personnelAffecteId"
                  value={formData.personnelAffecteId}
                  onChange={handleChange}
                  disabled={loadingPersonnels}
                >
                  <option value="">— Non affecté —</option>
                  {loadingPersonnels ? (
                    <option disabled>Chargement...</option>
                  ) : (
                    personnels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom} {p.prenom}{p.matricule ? ` (${p.matricule})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </section>

          {error && <div className="rcm-error">{error}</div>}

          <div className="rcm-footer">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReclamationModal;