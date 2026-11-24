import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, MapPinOff } from 'lucide-react';
import { t } from '../../../i18n';
import './PageIntrouvable.css';

export default function PageIntrouvable() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="pi-page">
      <div className="pi-carte">
        <div className="pi-icone"><MapPinOff size={34} /></div>
        <div className="pi-code">404</div>
        <h1 className="pi-titre">{t('Page introuvable')}</h1>
        <p className="pi-texte">{t("L'adresse {chemin} n'existe pas.", { chemin: pathname })}</p>
        <div className="pi-actions">
          <button type="button" className="cm-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> {t('Retour')}
          </button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={() => navigate('/')}>
            <Home size={16} /> {t('Accueil')}
          </button>
        </div>
      </div>
    </div>
  );
}
