import React from 'react';
import './ColumnSettingsModal.css';
import Toggle from '../Toggle';
import { Settings } from 'lucide-react';

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
            case 'amende':   return 'Colonnes - Amendes véhicule';
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
                        <Settings size={20} strokeWidth={2} aria-hidden="true" />
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