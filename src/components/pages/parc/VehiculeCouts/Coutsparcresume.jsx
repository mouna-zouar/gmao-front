import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Wallet } from 'lucide-react';
import vehiculeCoutService from '../../../../services/vehiculeCoutService';
import { BarreRepartition } from './CoutGraphiques';
import { formatDT, bornesPeriode } from '../../../../constants/Coutlibelles';
import { t, locale } from '../../../../i18n';
import './VehiculeCouts.css';

/*
 * Bandeau « Coûts du parc » de la page Véhicules (sous l'en-tête) : année en cours,
 * coût total, coût moyen au km, km parcourus, véhicule le plus coûteux et répartition.
 * `version` : à incrémenter pour recharger (après une saisie de frais, par exemple).
 */
export default function CoutsParcResume({ version = 0, onOuvrir }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    const { debut, fin } = bornesPeriode('annee');
    vehiculeCoutService.parc(debut, fin)
      .then((d) => { if (actif) { setDonnees(d); setErreur(false); } })
      .catch(() => { if (actif) setErreur(true); });
    return () => { actif = false; };
  }, [version]);

  const vehicules = donnees?.vehicules ?? [];
  const plusCher = vehicules.reduce((m, v) => (!m || v.postes.total > m.postes.total ? v : m), null);
  const annee = new Date().getFullYear();
  const km = donnees?.kmParcourus;

  return (
    <section className="vco-resume" aria-labelledby="vco-resume-titre">
      <header className="vco-resume-entete">
        <h3 id="vco-resume-titre"><Wallet size={18} aria-hidden="true" /> {t('Coûts du parc · {annee}', { annee })}</h3>
        {onOuvrir && (
          <button type="button" className="vco-resume-lien" onClick={onOuvrir}>
            {t('Détail par véhicule')} <ChevronRight size={15} className="rtl-miroir" aria-hidden="true" />
          </button>
        )}
      </header>

      {erreur ? (
        <p className="vco-resume-vide">{t('Coûts indisponibles pour le moment.')}</p>
      ) : !donnees ? (
        <p className="vco-resume-vide"><Loader2 size={16} className="vam-tourne" aria-hidden="true" /> {t('Calcul des coûts…')}</p>
      ) : (
        <div className="vco-resume-corps">
          <div className="vco-resume-chiffres">
            <div className="vco-chiffre vco-chiffre--principal">
              <span className="vco-chiffre-val">{formatDT(donnees.totaux?.total)}</span>
              <span className="vco-chiffre-nom">{t('Coût total du parc')}</span>
            </div>
            <div className="vco-chiffre">
              <span className="vco-chiffre-val">{donnees.coutParKm != null ? formatDT(donnees.coutParKm) : '—'}</span>
              <span className="vco-chiffre-nom">{t('Coût moyen au km')}</span>
            </div>
            <div className="vco-chiffre">
              <span className="vco-chiffre-val">{km != null ? t('{n} km', { n: Number(km).toLocaleString(locale()) }) : '—'}</span>
              <span className="vco-chiffre-nom">{t('Km parcourus')}</span>
            </div>
            <div className="vco-chiffre">
              <span className="vco-chiffre-val"><bdi dir="ltr">{plusCher && plusCher.postes.total > 0 ? plusCher.matricule : '—'}</bdi></span>
              <span className="vco-chiffre-nom">
                {plusCher && plusCher.postes.total > 0 ? t('Le plus coûteux · {m}', { m: formatDT(plusCher.postes.total, 0) }) : t('Le plus coûteux')}
              </span>
            </div>
          </div>
          <BarreRepartition postes={donnees.totaux} titre={t('Où va l’argent')} />
        </div>
      )}
    </section>
  );
}