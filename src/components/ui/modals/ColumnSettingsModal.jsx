import React from 'react';
import './ColumnSettingsModal.css';
import Toggle from '../Toggle';

const ColumnSettingsModal = ({ show, onClose, columns, onToggleVisibility, onToggleSearch, type }) => {
    if (!show) return null;

    const getTitle = () => {
        switch (type) {
            case 'regime':   return 'Colonnes - Régimes Horaires';
            case 'prime':    return 'Colonnes - Primes Globales';
            case 'fonction': return 'Colonnes - Fonctions';
            case 'service':  return 'Colonnes - Services';
            case 'vehicule': return 'Colonnes - Véhicules';
            case 'bonCarburant': return 'Colonnes - Bons carburant';
            case 'incident': return 'Colonnes - Incidents véhicule';
            case 'mission':  return 'Colonnes - Missions véhicules';
            case 'reservation': return 'Colonnes - Réservations véhicule';
            case 'projet':   return 'Colonnes - Projets';
            case 'emplacement': return 'Colonnes - Emplacements';
            case 'permis':   return 'Colonnes - Permis de conduire';
            case 'vehiculeConducteur': return 'Colonnes - Véhicules / Conducteurs';
            case 'reclamation': return 'Colonnes - Réclamations';
            case 'bon':      return 'Colonnes - Bons de maintenance';
            default:         return 'Gestion des colonnes';
        }
    };

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal-container" onClick={e => e.stopPropagation()}>
                <div className="settings-modal-header">
                    <div className="header-title">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <h2>{getTitle()}</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="settings-modal-body">
                    <div className="settings-grid-header">
                        <span>Champ</span>
                        <span className="center">Affichage</span>
                        <span className="center">Recherche</span>
                    </div>
                    <div className="settings-items-list">
                        {columns.map(col => (
                            <div key={col.key} className="settings-row">
                                <span className="col-name">{col.label}</span>
                                <div className="toggle-group center">
                                    <Toggle
                                        checked={col.visible}
                                        onChange={() => onToggleVisibility(col.key)}
                                    />
                                </div>
                                <div className="toggle-group center">
                                    <Toggle
                                        checked={col.searchable}
                                        onChange={() => onToggleSearch(col.key)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="settings-modal-footer">
                    <button className="done-btn" onClick={onClose}>Terminer</button>
                </div>
            </div>
        </div>
    );
};

export default ColumnSettingsModal;