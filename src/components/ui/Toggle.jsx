import React from 'react';
import './Toggle.css';

const Toggle = ({ label, checked, onChange, name }) => {
    return (
        <div className="toggle-wrapper">
            {label && <span className="toggle-label">{label}</span>}
            <label className="toggle-switch">
                <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
            </label>
        </div>
    );
};

export default Toggle;
