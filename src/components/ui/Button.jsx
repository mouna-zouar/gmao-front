import React from 'react';
import './Button.css';

export default function Button({ children, type = "button", variant = "primary", onClick, disabled, className = "", icon }) {
    return (
        <button
            type={type}
            className={`custom-btn ${variant} ${className}`}
            onClick={onClick}
            disabled={disabled}
        >
            {icon && <span className="btn-icon">{icon}</span>}
            {children}
        </button>
    );
}
