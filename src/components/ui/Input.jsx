import React from 'react';
import './Input.css';

export default function Input({ label, type = "text", name, value, onChange, placeholder, fullWidth = false, suffix, className = "" }) {
    return (
        <div className={`input-group ${fullWidth ? 'full' : ''} ${className}`}>
            {label && <label>{label}</label>}
            {suffix ? (
                <div className="input-with-suffix">
                    <input
                        type={type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                    />
                    <span className="input-suffix">{suffix}</span>
                </div>
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                />
            )}
        </div>
    );
}
