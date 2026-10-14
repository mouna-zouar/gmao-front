import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { Camera, Loader2, ScanLine, X } from 'lucide-react';
import equipementService from '../../../services/equipementService';
import { t } from '../../../i18n';
import './Equipements.css';

/*
 * Lecture du QR code d'un équipement avec la caméra, ou saisie du code à la main.
 * Le lecteur intégré du navigateur (BarcodeDetector) est utilisé quand il existe ;
 * sinon jsQR analyse l'image (iPhone, Firefox…).
 * La caméra n'est accessible que sur une adresse https:// (ou localhost).
 *
 * onTrouve(id) : mode « choix » (formulaires) — l'équipement trouvé est rendu à l'appelant
 * au lieu d'ouvrir sa fiche.
 */
export default function ScannerQR({ onClose, onTrouve, titre, aide }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [etat, setEtat] = useState('demarrage'); // demarrage | lecture | recherche | sans-camera
  const [erreur, setErreur] = useState('');
  const [saisie, setSaisie] = useState('');
  const traite = useRef(false);
  // Code refusé : la caméra ne le renvoie pas en boucle au serveur
  const dernierRefus = useRef('');

  const ouvrirDepuisCode = async (valeur, { manuel = false } = {}) => {
    if (traite.current || !valeur?.trim()) return;
    if (!manuel && valeur.trim() === dernierRefus.current) return;
    traite.current = true;
    setEtat('recherche');
    setErreur('');
    try {
      const id = await equipementService.resoudreCode(valeur.trim());
      if (onTrouve) {
        onTrouve(id);
        return;
      }
      onClose();
      navigate(`/equipement/${id}`);
    } catch (err) {
      traite.current = false;
      dernierRefus.current = valeur.trim();
      setEtat(videoRef.current?.srcObject ? 'lecture' : 'sans-camera');
      setErreur(err?.response?.data?.message || t('Aucun équipement ne correspond à ce code.'));
    }
  };

  useEffect(() => {
    let flux = null;
    let minuterie = null;
    let actif = true;

    const demarrer = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEtat('sans-camera');
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!actif) { flux.getTracks().forEach((p) => p.stop()); return; }
        const video = videoRef.current;
        video.srcObject = flux;
        await video.play();
        setEtat('lecture');

        const detecteur = 'BarcodeDetector' in window
          ? new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
          : null;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        minuterie = setInterval(async () => {
          if (traite.current || !video.videoWidth) return;
          try {
            if (detecteur) {
              const codes = await detecteur.detect(video);
              if (codes.length) ouvrirDepuisCode(codes[0].rawValue);
            } else {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) ouvrirDepuisCode(code.data);
            }
          } catch {
            /* image illisible : on réessaie à la prochaine */
          }
        }, 300);
      } catch {
        setEtat('sans-camera');
      }
    };

    demarrer();
    const echap = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', echap);
    return () => {
      actif = false;
      clearInterval(minuterie);
      flux?.getTracks().forEach((p) => p.stop());
      document.removeEventListener('keydown', echap);
    };
    // ouvrirDepuisCode lit des refs : pas besoin de relancer la caméra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  return (
    <div className="eq-modale-fond eq-theme" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="eq-modale eq-scanner" role="dialog" aria-modal="true" aria-labelledby="eq-scanner-titre">
        <header className="eq-modale-entete">
          <h2 id="eq-scanner-titre"><ScanLine size={20} /> {titre || t('Scanner un équipement')}</h2>
          <button type="button" className="eq-ico" onClick={onClose} aria-label={t('Fermer')}><X size={18} /></button>
        </header>

        <div className="eq-scanner-video">
          <video ref={videoRef} muted playsInline aria-label={t('Image de la caméra')} />
          <canvas ref={canvasRef} hidden />
          {etat === 'lecture' && <span className="eq-scanner-viseur" aria-hidden="true" />}
          {etat !== 'lecture' && (
            <div className="eq-scanner-message">
              {etat === 'sans-camera' ? (
                <>
                  <Camera size={28} />
                  <p>{t('Caméra indisponible : autorisez-la dans le navigateur (adresse https:// requise), ou tapez le code ci-dessous.')}</p>
                </>
              ) : (
                <>
                  <Loader2 size={28} className="eq-tourne" />
                  <p>{etat === 'recherche' ? t('Recherche de l’équipement…') : t('Ouverture de la caméra…')}</p>
                </>
              )}
            </div>
          )}
        </div>
        <p className="eq-scanner-aide">{aide || t('Placez le QR code de l’étiquette dans le cadre : la fiche s’ouvre toute seule.')}</p>

        <form className="eq-scanner-saisie" onSubmit={(e) => { e.preventDefault(); ouvrirDepuisCode(saisie, { manuel: true }); }}>
          <label htmlFor="eq-code">{t('Ou tapez le code-barre ou le numéro de l’équipement')}</label>
          <div>
            <input id="eq-code" value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" />
            <button type="submit" className="eq-bouton" disabled={!saisie.trim() || etat === 'recherche'}>{onTrouve ? t('Choisir') : t('Ouvrir')}</button>
          </div>
        </form>
        {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
      </div>
    </div>
  );
}
