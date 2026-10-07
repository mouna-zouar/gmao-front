import { useEffect } from 'react';
import './PageModal.css';

export default function PageModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  accent = '#0794a4',
  size = 'xl',
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Icon = icon;

  return (
    <div
      className="pmodal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`pmodal pmodal--${size}`}
        onClick={(e) => e.stopPropagation()}
        style={{ '--modal-accent': accent }}
      >
        <header className="pmodal__header">
          <div className="pmodal__title-wrap">
            {Icon && (
              <span className="pmodal__icon">
                <Icon size={22} />
              </span>
            )}
            <div className="pmodal__title-text">
              <h2 className="pmodal__title">{title}</h2>
              {subtitle && <p className="pmodal__subtitle">{subtitle}</p>}
            </div>
          </div>

          <button
            type="button"
            className="pmodal__close"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer (Échap)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="pmodal__body">
          {children}
        </div>
      </div>
    </div>
  );
}