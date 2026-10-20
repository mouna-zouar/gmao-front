import React from 'react';
import { Check, Info, TriangleAlert } from 'lucide-react';
import './ConfirmModal.css';

const ConfirmModal = ({
    show,
    onClose,
    onConfirm,
    title = 'Confirmation',
    message = 'Êtes-vous sûr de vouloir effectuer cette action ?',
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    type = 'warning',
    error = null,
    confirming = false,
    children,
}) => {
    if (!show) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <Check className="modal-confirm-icon success" aria-hidden="true" />
                );
            case 'danger':
                return (
                    <TriangleAlert className="modal-confirm-icon danger" aria-hidden="true" />
                );
            case 'info':
                return (
                    <Info className="modal-confirm-icon info" aria-hidden="true" />
                );
            default: // warning
                return (
                    <TriangleAlert className="modal-confirm-icon warning" aria-hidden="true" />
                );
        }
    };

    return (
        <div className="modal-overlay confirm-overlay" onClick={onClose}>
            <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-modal-content">
                    <div className="confirm-modal-icon-wrapper">
                        {getIcon()}
                    </div>
                    <div className="confirm-modal-text">
                        <h3>{title}</h3>
                        <p>{message}</p>
                    </div>
                </div>

                {children}

                {error && (
                    <div className="confirm-modal-error">
                        <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="confirm-modal-footer">
                    <button type="button" className="confirm-btn secondary" onClick={onClose} disabled={confirming}>
                        {cancelText}
                    </button>
                    <button type="button" className={`confirm-btn primary ${type}`} onClick={onConfirm} disabled={confirming}>
                        {confirming ? 'Patientez...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;