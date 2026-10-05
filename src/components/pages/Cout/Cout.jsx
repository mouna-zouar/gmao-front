import React, { useCallback, useEffect, useMemo, useState } from 'react';
import coutService from '../../../services/coutService';
import { prioriteLabel } from '../../../constants/Priorite';
import './Cout.css';

/* ---------- Config ---------- */
const PERIODES = [
  { key: '30J', label: '30 jours', jours: 30 },
  { key: '3M',  label: '3 mois',   jours: 90 },
  { key: '6M',  label: '6 mois',   jours: 180 },
  { key: '12M', label: '12 mois',  jours: 365 },
];

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/* ---------- Utils ---------- */
function calculerBornes(periodeKey) {
  const fin = new Date();
  const debut = new Date(fin);
  const conf = PERIODES.find((p) => p.key === periodeKey) || PERIODES[1];
  debut.setDate(debut.getDate() - conf.jours);
  return { dateDebut: debut.toISOString(), dateFin: fin.toISOString() };
}

function formatMontant(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formatMontantCourt(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  if (Math.abs(valeur) >= 1000) return `${(valeur / 1000).toFixed(1)}k DT`;
  return `${valeur.toFixed(0)} DT`;
}

function formatMoisLabel(cle) {
  const [annee, mois] = cle.split('-');
  const idx = parseInt(mois, 10) - 1;
  return `${MOIS_COURTS[idx] || mois} ${annee}`;
}

/* ---------- Icônes ---------- */
const Svg = (props) => (
  <svg width={props.size || 15} height={props.size || 15} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const IconRefresh = () => (
  <Svg><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 4v5h-5M3 20v-5h5" /></Svg>
);

const IconSpinner = () => (
  <svg className="cout-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconSearch = () => (
  <Svg size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

const IconAlert = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

const IconCoin = () => (
  <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M9.5 15c.5 1 1.3 1.5 2.5 1.5 1.7 0 2.5-.8 2.5-1.8 0-2.4-5-1-5-3.4 0-1 .8-1.8 2.5-1.8 1.2 0 2 .5 2.5 1.5M12 7v1M12 16v1" /></Svg>
);

const IconWrench = () => (
  <Svg size={16}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z" /></Svg>
);

const IconBox = () => (
  <Svg size={16}><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="M3 8l9 5 9-5M12 13v8" /></Svg>
);

const IconTruck = () => (
  <Svg size={16}><path d="M3 7h11v10H3z" /><path d="M14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" /></Svg>
);

/* Icône du header */
const IconWallet = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5Z" />
    <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
  </svg>
);

/* ---------- Composant ---------- */
export default function Cout() {
  const [periodeKey, setPeriodeKey] = useState('3M');
  const [bons, setBons] = useState([]);
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bornes = calculerBornes(periodeKey);
      const [listeBons, bilanData] = await Promise.all([
        coutService.getParPeriode(bornes),
        coutService.getBilan(bornes),
      ]);
      setBons(listeBons ?? []);
      setBilan(bilanData);
    } catch (err) {
      console.error('Erreur chargement coûts :', err);
      setError('Impossible de charger les données de coûts.');
    } finally {
      setLoading(false);
    }
  }, [periodeKey]);

  useEffect(() => { charger(); }, [charger]);

  const bonsAffiches = useMemo(() => {
    return bons
      .filter((b) => !recherche.trim()
        || (b.titre || '').toLowerCase().includes(recherche.trim().toLowerCase())
        || (b.num || '').toLowerCase().includes(recherche.trim().toLowerCase())
        || (b.equipementNom || '').toLowerCase().includes(recherche.trim().toLowerCase()))
      .slice()
      .sort((a, b) => b.coutTotal - a.coutTotal);
  }, [bons, recherche]);

  const moisMax = useMemo(() => {
    if (!bilan?.coutParMois) return 0;
    return Math.max(...Object.values(bilan.coutParMois), 0);
  }, [bilan]);

  const equipementMax = useMemo(() => {
    if (!bilan?.topEquipements?.length) return 0;
    return Math.max(...bilan.topEquipements.map((e) => e.coutTotal), 0);
  }, [bilan]);

  return (
    <div className="cout-page">
      {/* ---------- Header ---------- */}
      <header className="cout-header">
        <div className="cout-header__icon-wrap">
          <IconWallet />
        </div>
        <div className="cout-header__text">
          <h1>Coûts</h1>
          <p>
            Coût réel des bons — main d'œuvre, pièces sorties du dépôt et achats fournisseur.
          </p>
        </div>

        <div className="cout-header__actions">
          <div className="cout-periode-select">
            {PERIODES.map((p) => (
              <button
                key={p.key}
                className={`cout-periode-btn ${periodeKey === p.key ? 'cout-periode-btn--active' : ''}`}
                onClick={() => setPeriodeKey(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="cout-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? 'Chargement' : 'Rafraîchir'}</span>
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      {!loading && bilan && (
        <section className="cout-kpis">
          <div className="cout-kpi cout-kpi--total">
            <div className="cout-kpi__icon"><IconCoin /></div>
            <div className="cout-kpi__body">
              <span className="cout-kpi__label">Coût total de la période</span>
              <span className="cout-kpi__valeur">{formatMontant(bilan.coutTotalGlobal)}</span>
            </div>
          </div>

          <div className="cout-kpi cout-kpi--main">
            <div className="cout-kpi__icon"><IconWrench /></div>
            <div className="cout-kpi__body">
              <span className="cout-kpi__label">Main d'œuvre</span>
              <span className="cout-kpi__valeur">{formatMontant(bilan.coutTotalMainOeuvre)}</span>
            </div>
          </div>

          <div className="cout-kpi cout-kpi--pieces">
            <div className="cout-kpi__icon"><IconBox /></div>
            <div className="cout-kpi__body">
              <span className="cout-kpi__label">Pièces dépôt</span>
              <span className="cout-kpi__valeur">{formatMontant(bilan.coutTotalPiecesDepot)}</span>
            </div>
          </div>

          <div className="cout-kpi cout-kpi--achats">
            <div className="cout-kpi__icon"><IconTruck /></div>
            <div className="cout-kpi__body">
              <span className="cout-kpi__label">Achats fournisseur</span>
              <span className="cout-kpi__valeur">{formatMontant(bilan.coutTotalAchats)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Coût par mois + top équipements ---------- */}
      {!loading && bilan && ((bilan.coutParMois && Object.keys(bilan.coutParMois).length > 0) || bilan.topEquipements?.length > 0) && (
        <section className="cout-panels">
          {bilan.coutParMois && Object.keys(bilan.coutParMois).length > 0 && (
            <div className="cout-panel">
              <h3 className="cout-panel__title">Évolution mensuelle</h3>
              <div className="cout-mois-chart">
                {Object.entries(bilan.coutParMois).map(([cle, valeur]) => (
                  <div key={cle} className="cout-mois-bar-wrap">
                    <span className="cout-mois-bar-valeur">{formatMontantCourt(valeur)}</span>
                    <div className="cout-mois-bar-track">
                      <div
                        className="cout-mois-bar-fill"
                        style={{ height: `${moisMax > 0 ? Math.max(4, (valeur / moisMax) * 100) : 4}%` }}
                      />
                    </div>
                    <span className="cout-mois-bar-label">{formatMoisLabel(cle)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bilan.topEquipements?.length > 0 && (
            <div className="cout-panel">
              <h3 className="cout-panel__title">Équipements les plus coûteux</h3>
              <ul className="cout-top-list">
                {bilan.topEquipements.map((e) => (
                  <li key={e.lotArticleImmobilistationId} className="cout-top-item">
                    <div className="cout-top-item__header">
                      <span className="cout-top-item__nom">
                        {e.cibleNom || `Équipement #${e.lotArticleImmobilistationId}`}
                      </span>
                      <span className="cout-top-item__valeur">{formatMontant(e.coutTotal)}</span>
                    </div>
                    <div className="cout-top-item__barre">
                      <div
                        className="cout-top-item__barre-fill"
                        style={{ width: `${equipementMax > 0 ? Math.max(3, (e.coutTotal / equipementMax) * 100) : 3}%` }}
                      />
                    </div>
                    <span className="cout-top-item__meta">
                      {e.nbBons} bon{e.nbBons > 1 ? 's' : ''} · {formatMontant(e.coutMoyenParBon)} en moyenne
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ---------- Recherche ---------- */}
      <div className="cout-filtres">
        <div className="cout-recherche-wrap">
          <span className="cout-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder="Rechercher par titre, numéro ou équipement..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="cout-recherche"
          />
        </div>
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="cout-empty">Chargement...</p>
      ) : error ? (
        <p className="cout-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : bonsAffiches.length === 0 ? (
        <p className="cout-empty">
          <IconInbox />
          <span>Aucun bon ne correspond à cette recherche sur la période.</span>
        </p>
      ) : (
        <ul className="cout-list">
          {bonsAffiches.map((b) => (
            <li key={b.bonMaintenanceId} className="cout-card">
              <div className="cout-card__header">
                <div className="cout-card__titre-wrap">
                  <span className="cout-card__titre">{b.titre || `Bon ${b.num || b.bonMaintenanceId}`}</span>
                  <span className="cout-card__num">{b.num}</span>
                  {b.equipementNom && <span className="cout-card__equip">{b.equipementNom}</span>}
                </div>
                <div className="cout-card__right">
                  {b.priorite && <span className="cout-card__priorite">{prioriteLabel(b.priorite)}</span>}
                  <span className="cout-card__total">{formatMontant(b.coutTotal)}</span>
                </div>
              </div>

              <div className="cout-card__breakdown">
                <div className="cout-breakdown-item">
                  <span className="cout-breakdown-item__label"><IconWrench /> Main d'œuvre</span>
                  <span className="cout-breakdown-item__valeur">{formatMontant(b.coutMainOeuvre)}</span>
                </div>
                <div className="cout-breakdown-item">
                  <span className="cout-breakdown-item__label"><IconBox /> Pièces dépôt</span>
                  <span className="cout-breakdown-item__valeur">{formatMontant(b.coutPiecesDepot)}</span>
                </div>
                <div className="cout-breakdown-item">
                  <span className="cout-breakdown-item__label"><IconTruck /> Achats</span>
                  <span className="cout-breakdown-item__valeur">{formatMontant(b.coutAchats)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}