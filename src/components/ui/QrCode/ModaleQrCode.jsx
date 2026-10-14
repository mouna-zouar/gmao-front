import { useEffect, useState } from 'react';
import { Check, Copy, Printer, QrCode, X } from 'lucide-react';
import { imprimerEtiquettesQr, qrSvg } from '../../../utils/qrCode';
import { t } from '../../../i18n';
import './ModaleQrCode.css';

/*
 * Fenêtre « QR code » d'un bon de maintenance ou d'une réclamation : aperçu de l'étiquette,
 * impression, copie du lien. Le QR code ouvre la page dans l'application.
 * Props : url, titre, sousTitre, reference, appel (phrase sous le QR code), onClose
 */
export default function ModaleQrCode({ url, titre, sousTitre, reference, appel, onClose }) {
  const [svg, setSvg] = useState('');
  const [copie, setCopie] = useState(false);

  useEffect(() => { qrSvg(url).then(setSvg); }, [url]);

  useEffect(() => {
    const echap = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onClose]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers indisponible (adresse non https) : le lien reste affiché */
    }
  };

  const etiquette = { url, titre, sousTitre, reference, appel };

  return (
    <div className="qrm-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qrm" role="dialog" aria-modal="true" aria-labelledby="qrm-titre">
        <header className="qrm-entete">
          <h2 id="qrm-titre"><QrCode size={20} /> {t('QR code')}</h2>
          <button type="button" className="qrm-ico" onClick={onClose} aria-label={t('Fermer')}><X size={18} /></button>
        </header>

        <div className="qrm-apercu">
          {/* SVG produit par la bibliothèque qrcode à partir de l'adresse de la page */}
          <div className="qrm-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="qrm-texte">
            <strong>{titre}</strong>
            {sousTitre && <span>{sousTitre}</span>}
            {reference && <span className="qrm-ref">{reference}</span>}
            {appel && <em>{appel}</em>}
          </div>
        </div>

        <p className="qrm-aide">{t('Avec l’appareil photo d’un téléphone, ce QR code ouvre cette page dans la GMAO. Il est aussi imprimé sur la fiche.')}</p>
        <div className="qrm-lien">
          <span>{url}</span>
          <button type="button" className="qrm-ico" onClick={copier} aria-label={t('Copier le lien')} title={t('Copier le lien')}>
            {copie ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <footer className="qrm-pied">
          <button type="button" className="qrm-bouton qrm-bouton--clair" onClick={onClose}>{t('Fermer')}</button>
          <button type="button" className="qrm-bouton" onClick={() => imprimerEtiquettesQr([etiquette])}>
            <Printer size={17} /> {t('Imprimer l’étiquette')}
          </button>
        </footer>
      </div>
    </div>
  );
}
