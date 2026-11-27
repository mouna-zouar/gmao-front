import { Component } from 'react';
import { LoaderCircle } from 'lucide-react';
import { t } from '../i18n';
import './ChargementPage.css';

export default function ChargementPage() {
  return (
    <div className="chargement-page" role="status" aria-live="polite" aria-label={t('Chargement…')}>
      <div className="chargement-page__barre" aria-hidden="true" />
      <div className="chargement-page__squelette" aria-hidden="true">
        <div className="cp-sq cp-sq--titre" />
        <div className="cp-sq-ligne">
          <div className="cp-sq cp-sq--carte" /><div className="cp-sq cp-sq--carte" /><div className="cp-sq cp-sq--carte" /><div className="cp-sq cp-sq--carte" />
        </div>
        <div className="cp-sq cp-sq--bloc" />
      </div>
      <p className="chargement-page__texte"><LoaderCircle size={16} className="chargement-page__icone" aria-hidden="true" /> {t('Chargement de la page…')}</p>
    </div>
  );
}

const CLE_RECHARGEMENT = 'gmao.rechargement-module';
const estErreurModule = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(String(e?.message || e));

export class LimiteChargement extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur) {
    if (!estErreurModule(erreur)) return;
    try {
      if (sessionStorage.getItem(CLE_RECHARGEMENT)) return;
      sessionStorage.setItem(CLE_RECHARGEMENT, '1');
    } catch { return; }
    window.location.reload();
  }

  componentDidMount() {
    this.minuterie = setTimeout(() => { try { sessionStorage.removeItem(CLE_RECHARGEMENT); } catch { /* indisponible */ } }, 15000);
  }

  componentWillUnmount() {
    clearTimeout(this.minuterie);
  }

  componentDidUpdate(prev) {
    if (this.state.erreur && prev.children !== this.props.children) this.setState({ erreur: null });
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="chargement-page chargement-page--erreur" role="alert">
        <span>{t('Cette page n’a pas pu être chargée.')}</span>
        <button type="button" onClick={() => window.location.reload()}>{t('Recharger')}</button>
      </div>
    );
  }
}
