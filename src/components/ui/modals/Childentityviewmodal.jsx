import React from 'react';
import { X } from 'lucide-react';
import './ChildEntityModals.css';

const ChildEntityViewModal = ({ show, onClose, title, columns, item }) => {
  if (!show || !item) return null;

  return (
    <div className="cem-overlay" onClick={onClose}>
      <div className="cem-box" onClick={(e) => e.stopPropagation()}>
        <div className="cem-header">
          <h3>{title}</h3>
          <button type="button" className="cem-close-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="cem-body">
          {columns.map((c) => (
            <div key={c.key} className="cem-view-row">
              <span className="cem-view-label">{c.label}</span>
              <span className="cem-view-value">
                {c.format ? c.format(item[c.key]) : (item[c.key] ?? '—')}
              </span>
            </div>
          ))}
        </div>

        <div className="cem-footer">
          <button type="button" className="cem-btn-cancel" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default ChildEntityViewModal;