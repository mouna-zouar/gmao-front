import React, { useState, useEffect } from 'react';
import './ChildEntityModals.css';

const ChildEntityFormModal = ({ show, onClose, title, fields, initialValues, onSave, saving, isEdit, quantityCheck }) => {
  const [values, setValues] = useState({});
  const [disponible, setDisponible] = useState(null);
  const [checkingDisponible, setCheckingDisponible] = useState(false);

  useEffect(() => {
    if (show) {
      setValues(initialValues || Object.fromEntries(fields.map((f) => [f.name, ''])));
      setDisponible(null);
    }
  }, [show, initialValues, fields]);

  const articleId = quantityCheck ? values[quantityCheck.articleField] : null;

  useEffect(() => {
    if (!quantityCheck || !articleId) {
      setDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingDisponible(true);
    quantityCheck.fetchDisponible(articleId)
      .then((qte) => { if (!cancelled) setDisponible(qte); })
      .catch(() => { if (!cancelled) setDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingDisponible(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  if (!show) return null;

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const qteSaisie = quantityCheck ? Number(values[quantityCheck.qteField]) : null;
  const quantiteInsuffisante = quantityCheck && disponible != null && qteSaisie > disponible;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (quantiteInsuffisante) {
      alert(
        `Quantité demandée (${qteSaisie}) supérieure à la quantité disponible (${disponible}).`
      );
      // Non bloquant : on continue quand même l'enregistrement.
    }
    onSave(values);
  };

  return (
    <div className="cem-overlay" onClick={onClose}>
      <div className="cem-box" onClick={(e) => e.stopPropagation()}>
        <div className="cem-header">
          <h3>{isEdit ? `Modifier — ${title}` : `Ajouter — ${title}`}</h3>
          <button type="button" className="cem-close-btn" onClick={onClose} aria-label="Fermer">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cem-body">
            <div className="cem-grid">
              {fields.map((f) => (
                <div key={f.name} className={`cem-field ${f.full ? 'full' : ''}`}>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={values[f.name] ?? ''} onChange={(e) => handleChange(f.name, e.target.value)}>
                      <option value="">—</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea rows={3} value={values[f.name] ?? ''} onChange={(e) => handleChange(f.name, e.target.value)} />
                  ) : (
                    <input type={f.type} value={values[f.name] ?? ''} onChange={(e) => handleChange(f.name, e.target.value)} />
                  )}

                  {quantityCheck && f.name === quantityCheck.articleField && articleId && (
                    <p className="cem-hint">
                      {checkingDisponible ? 'Vérification du stock...' : (disponible != null ? `Quantité disponible : ${disponible}` : 'Quantité disponible inconnue')}
                    </p>
                  )}

                  {quantityCheck && f.name === quantityCheck.qteField && quantiteInsuffisante && (
                    <p className="cem-warning">
                      ⚠ Quantité demandée ({qteSaisie}) supérieure à la quantité disponible ({disponible}).
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="cem-footer">
            <button type="button" className="cem-btn-cancel" onClick={onClose} disabled={saving}>Annuler</button>
            <button type="submit" className="cem-btn-save" disabled={saving}>
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Ajouter')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChildEntityFormModal;