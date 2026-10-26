import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Loader2, RefreshCw } from 'lucide-react';
import maintenanceConditionnelleService from '../../../services/maintenanceConditionnelleService';
import { ETATS_REGLE, MODES, fmt } from '../Equipements/EquipementMaintenanceConditionnelle';
import { t, locale } from '../../../i18n';

/** Vue d'ensemble des règles de maintenance conditionnelle (elles se créent dans la fiche de chaque équipement). */
export default function ReglesConditionnellesVue() {
  const navigate = useNavigate();
  const [regles, setRegles] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = () => {
    setErreur('');
    maintenanceConditionnelleService.regles()
      .then(setRegles)
      .catch(() => { setRegles([]); setErreur(t('Impossible de charger les règles.')); });
  };
  useEffect(charger, []);

  const quand = (iso) => (iso ? new Date(iso).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <Gauge size={15} aria-hidden="true" /> {t('Règles de maintenance conditionnelle')}
        <button type="button" className="ps-icone-btn" onClick={charger} title={t('Rafraîchir')} aria-label={t('Rafraîchir')}>
          <RefreshCw size={15} />
        </button>
      </h3>
      <p className="ps-mc-aide">{t('Bons préventifs créés selon l’état réel des équipements (seuil, tendance ou compteur d’une sonde). Elles se créent dans la fiche de chaque équipement, bloc « Maintenance conditionnelle ».')}</p>
      {regles === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : regles.length === 0 ? (
        <p className="ps-mc-vide">{erreur || t('Aucune règle pour l’instant.')}</p>
      ) : (
        <div className="ps-mc-defile">
          <table className="ps-mc-table">
            <thead>
              <tr>
                <th>{t('Équipement')}</th>
                <th>{t('Règle')}</th>
                <th>{t('État')}</th>
                <th>{t('Valeur')}</th>
                <th>{t('Vérifiée')}</th>
              </tr>
            </thead>
            <tbody>
              {regles.map((r) => {
                const e = ETATS_REGLE[r.dernierEtat] || { ton: 'info', label: 'Pas encore évaluée' };
                return (
                  <tr key={r.id}>
                    <td>
                      <button type="button" className="ps-lien" onClick={() => navigate(`/equipement/${r.lotArticleImmobilistationId}`)}>
                        {r.equipementNom || `#${r.lotArticleImmobilistationId}`}
                      </button>
                    </td>
                    <td>
                      <strong>{r.libelle}</strong>
                      <small>{t(MODES.find((m) => m.value === r.mode)?.label || r.mode)} · {r.resume}</small>
                    </td>
                    <td>
                      <span className={`ps-mc-etat ps-mc-ton--${e.ton}`}>{t(e.label)}</span>
                      {r.bonEnCoursId && (
                        <button type="button" className="ps-lien ps-mc-bon" onClick={() => navigate(`/bons-maintenance?id=${r.bonEnCoursId}`)}>
                          {t('Bon n° {n}', { n: r.bonEnCoursNum })}
                        </button>
                      )}
                    </td>
                    <td className="ps-mc-num">
                      {r.derniereValeur != null ? `${fmt(r.derniereValeur)} ${r.unite || ''}` : '—'}
                      {r.progression != null && <small>{Math.round(r.progression * 100)} %</small>}
                    </td>
                    <td className="ps-mc-num">{quand(r.derniereEvaluation)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
