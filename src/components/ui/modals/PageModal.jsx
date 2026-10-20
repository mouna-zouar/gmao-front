import { useEffect } from 'react';
import { X } from 'lucide-react';
import './PageModal.css';

export default function PageModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  eyebrow, // petit libellé au-dessus du titre, comme dans les modales
  // L'ancien paramètre « accent » est ignoré : toutes les fenêtres ont la couleur des modales.
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
      >
        <header className="pmodal__header">
          <div className="pmodal__title-wrap">
            {Icon && (
              <span className="pmodal__icon">
                <Icon size={22} />
              </span>
            )}
            <div className="pmodal__title-text">
              {eyebrow && <span className="pmodal__eyebrow">{eyebrow}</span>}
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
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </header>

        <div className="pmodal__body">
          {children}
        </div>
      </div>
    </div>
  );
}