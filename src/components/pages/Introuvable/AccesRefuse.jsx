import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, ShieldX } from 'lucide-react';
import { t } from '../../../i18n';
import './PageIntrouvable.css';

export default function AccesRefuse() {
  const navigate = useNavigate();

  return (
    <div className="pi-page">
      <div className="pi-carte">
        <div className="pi-icone"><ShieldX size={34} /></div>
        <div className="pi-code">403</div>
        <h1 className="pi-titre">{t('Accès refusé')}</h1>
        <p className="pi-texte">{t('Vous n’avez pas le droit d’ouvrir cette page.')}</p>
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
