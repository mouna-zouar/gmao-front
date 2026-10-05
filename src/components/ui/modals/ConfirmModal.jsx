import React from 'react';
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
                    <svg className="modal-confirm-icon success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'danger':
                return (
                    <svg className="modal-confirm-icon danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                );
            case 'info':
                return (
                    <svg className="modal-confirm-icon info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            default: // warning
                return (
                    <svg className="modal-confirm-icon warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
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
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
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