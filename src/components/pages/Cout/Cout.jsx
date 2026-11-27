import { useCallback, useEffect, useMemo, useState } from 'react';
import { prioriteLabel } from '../../../constants/Priorite';
import { CircleDollarSign, FileSpreadsheet, Inbox, LoaderCircle, Package, RefreshCw, Search, TriangleAlert, Truck, Wallet, Wrench } from 'lucide-react';
import './Cout.css';
import Pagination from '../../commun/Pagination';
import FiltreLieu, { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { lireRequete } from '../../../store/referentiels';

const PERIODES = [
  { key: '30J', label: '30 jours', jours: 30 },
  { key: '3M',  label: '3 mois',   jours: 90 },
  { key: '6M',  label: '6 mois',   jours: 180 },
  { key: '12M', label: '12 mois',  jours: 365 },
];

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const PAGE_SIZE = 10;
const EQUIP_PAGE_SIZE = 10;

const CHART = {
  W: 800,
  H: 240,
  PAD: { top: 20, right: 20, bottom: 40, left: 56 },
};

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


const IconRefresh = () => (
  <RefreshCw size={15} aria-hidden="true" />
);

const IconSpinner = () => (
  <LoaderCircle size={15} strokeWidth={2.5} className="cout-spinner" aria-hidden="true" />
);

const IconSearch = () => (
  <Search size={15} aria-hidden="true" />
);

const IconAlert = () => (
  <TriangleAlert size={36} strokeWidth={1.5} aria-hidden="true" />
);

const IconInbox = () => (
  <Inbox size={36} strokeWidth={1.5} aria-hidden="true" />
);

const IconCoin = () => (
  <CircleDollarSign size={16} aria-hidden="true" />
);

const IconWrench = () => (
  <Wrench size={16} aria-hidden="true" />
);

const IconBox = () => (
  <Package size={16} aria-hidden="true" />
);

const IconTruck = () => (
  <Truck size={16} aria-hidden="true" />
);



const IconWallet = () => (
  <Wallet size={24} strokeWidth={2} aria-hidden="true" />
);

const IconExcel = () => (
  <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
);

async function exporterExcel({ periodeLabel, bilan, bons, topEquipements }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const dateExport = new Date().toLocaleString('fr-FR');
  const syntheseData = [
    ['Rapport de coûts', ''],
    ['Période', periodeLabel],
    ['Généré le', dateExport],
    ['', ''],
    ['Indicateur', 'Valeur (DT)'],
    ['Coût total de la période', bilan?.coutTotalGlobal ?? 0],
    ["Main d'œuvre", bilan?.coutTotalMainOeuvre ?? 0],
    ['Pièces dépôt', bilan?.coutTotalPiecesDepot ?? 0],
    ['Achats fournisseur', bilan?.coutTotalAchats ?? 0],
    ['', ''],
    ['Nombre de bons', bons.length],
  ];
  const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseData);
  wsSynthese['!cols'] = [{ wch: 32 }, { wch: 22 }];
  wsSynthese['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse');

  const bonsRows = bons.map((b) => ({
    'N°': b.num || '',
    'Titre': b.titre || '',
    'Équipement': b.equipementNom || '',
    'Priorité': b.priorite ? prioriteLabel(b.priorite) : '',
    "Main d'œuvre (DT)": Number(b.coutMainOeuvre ?? 0),
    'Pièces dépôt (DT)': Number(b.coutPiecesDepot ?? 0),
    'Achats (DT)': Number(b.coutAchats ?? 0),
    'Total (DT)': Number(b.coutTotal ?? 0),
  }));
  const wsBons = XLSX.utils.json_to_sheet(bonsRows);

  wsBons['!cols'] = [
    { wch: 12 },
    { wch: 42 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
  ];

  const totalRow = {
    'N°': '',
    'Titre': 'TOTAL',
    'Équipement': '',
    'Priorité': '',
    "Main d'œuvre (DT)": bons.reduce((s, b) => s + Number(b.coutMainOeuvre ?? 0), 0),
    'Pièces dépôt (DT)': bons.reduce((s, b) => s + Number(b.coutPiecesDepot ?? 0), 0),
    'Achats (DT)': bons.reduce((s, b) => s + Number(b.coutAchats ?? 0), 0),
    'Total (DT)': bons.reduce((s, b) => s + Number(b.coutTotal ?? 0), 0),
  };
  XLSX.utils.sheet_add_json(wsBons, [totalRow], { skipHeader: true, origin: -1 });

  XLSX.utils.book_append_sheet(wb, wsBons, 'Bons');

  if (topEquipements?.length) {
    const equipRows = topEquipements.map((e, idx) => ({
      'Rang': idx + 1,
      'Équipement': e.cibleNom || `Équipement #${e.lotArticleImmobilistationId}`,
      'Nombre de bons': Number(e.nbBons ?? 0),
      'Coût total (DT)': Number(e.coutTotal ?? 0),
      'Coût moyen / bon (DT)': Number(e.coutMoyenParBon ?? 0),
    }));
    const wsEquip = XLSX.utils.json_to_sheet(equipRows);
    wsEquip['!cols'] = [
      { wch: 8 },
      { wch: 38 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsEquip, 'Top équipements');
  }

  const cleanLabel = periodeLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const nomFichier = `couts-${cleanLabel}-${date}.xlsx`;

  XLSX.writeFile(wb, nomFichier);
}

export default function Cout() {
  const [periodeKey, setPeriodeKey] = useState('3M');
  const [lieuId, setLieuId] = useState('');
  const carteLieux = useCarteLieux();
  const [bons, setBons] = useState([]);
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [equipPage, setEquipPage] = useState(1);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bornes = { ...calculerBornes(periodeKey), lieuId: lieuId || undefined };
      const [listeBons, bilanData] = await Promise.all([
        lireRequete('coutParPeriode', bornes),
        lireRequete('coutBilan', bornes),
      ]);
      setBons(listeBons ?? []);
      setBilan(bilanData);
    } catch (err) {
      console.error('Erreur chargement coûts :', err);
      setError('Impossible de charger les données de coûts.');
    } finally {
      setLoading(false);
    }
  }, [periodeKey, lieuId]);

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

  const totalPages = Math.max(1, Math.ceil(bonsAffiches.length / PAGE_SIZE));

  useEffect(() => { setCurrentPage(1); }, [recherche, periodeKey]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const bonsPagines = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return bonsAffiches.slice(start, start + PAGE_SIZE);
  }, [bonsAffiches, currentPage]);

  const goToPage = (p) => setCurrentPage(Math.min(Math.max(1, p), totalPages));



  const topEquipements = bilan?.topEquipements ?? [];
  const equipTotalPages = Math.max(1, Math.ceil(topEquipements.length / EQUIP_PAGE_SIZE));

  useEffect(() => { setEquipPage(1); }, [periodeKey]);

  useEffect(() => {
    if (equipPage > equipTotalPages) setEquipPage(equipTotalPages);
  }, [equipPage, equipTotalPages]);

  const equipementsPagines = useMemo(() => {
    const start = (equipPage - 1) * EQUIP_PAGE_SIZE;
    return topEquipements.slice(start, start + EQUIP_PAGE_SIZE);
  }, [topEquipements, equipPage]);

  const goToEquipPage = (p) => setEquipPage(Math.min(Math.max(1, p), equipTotalPages));



  const chartData = useMemo(() => {
    if (!bilan?.coutParMois) return [];
    return Object.entries(bilan.coutParMois).map(([cle, valeur]) => {
      const [annee, mois] = cle.split('-');
      const idx = parseInt(mois, 10) - 1;
      return {
        key: cle,
        label: `${MOIS_COURTS[idx] || mois} ${annee}`,
        shortLabel: MOIS_COURTS[idx] || mois,
        valeur,
      };
    });
  }, [bilan]);

  const chartMax = useMemo(() => {
    if (chartData.length === 0) return 1;
    const max = Math.max(...chartData.map((d) => d.valeur), 0);
    return max > 0 ? max * 1.15 : 1;
  }, [chartData]);

  const chartPoints = useMemo(() => {
    if (chartData.length === 0) return [];
    const innerW = CHART.W - CHART.PAD.left - CHART.PAD.right;
    const innerH = CHART.H - CHART.PAD.top - CHART.PAD.bottom;
    const n = chartData.length;
    return chartData.map((d, i) => {
      const x = CHART.PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = CHART.PAD.top + innerH - (d.valeur / chartMax) * innerH;
      return { ...d, x, y };
    });
  }, [chartData, chartMax]);

  const chartAreaPath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const baseline = CHART.H - CHART.PAD.bottom;
    return (
      `M ${chartPoints[0].x} ${baseline} ` +
      chartPoints.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${chartPoints[chartPoints.length - 1].x} ${baseline} Z`
    );
  }, [chartPoints]);

  const chartLinePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return `M ${chartPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  }, [chartPoints]);

  const chartYTicks = useMemo(() => {
    const innerH = CHART.H - CHART.PAD.top - CHART.PAD.bottom;
    return [0, 0.33, 0.66, 1].map((r) => ({
      ratio: r,
      y: CHART.PAD.top + innerH * (1 - r),
      value: chartMax * r,
    }));
  }, [chartMax]);

  const equipementMax = useMemo(() => {
    if (!topEquipements.length) return 0;
    return Math.max(...topEquipements.map((e) => e.coutTotal), 0);
  }, [topEquipements]);

  const periodeLabel = PERIODES.find((p) => p.key === periodeKey)?.label || periodeKey;

  const handleExportExcel = async () => {
    if (!bonsAffiches.length && !bilan) return;
    setExporting(true);
    try {
      await exporterExcel({
        periodeLabel,
        bilan,
        bons: bonsAffiches,
        topEquipements,
      });
    } catch (err) {
      console.error('Erreur export Excel :', err);
      setError("Impossible de générer le fichier Excel.");
    } finally {
      setTimeout(() => setExporting(false), 300);
    }
  };

  const peutExporter = !loading && (bonsAffiches.length > 0 || (bilan && topEquipements.length > 0));

  return (
    <div className="cout-page">
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
          <FiltreLieu carte={carteLieux} valeur={lieuId} onChange={setLieuId} className="fl-select" />
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

          <button
            type="button"
            className="cout-export-btn"
            onClick={handleExportExcel}
            disabled={!peutExporter || exporting}
            title="Exporter en Excel"
          >
            {exporting ? <IconSpinner /> : <IconExcel />}
            <span>{exporting ? 'Export…' : 'Excel'}</span>
          </button>

          <button className="cout-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? 'Chargement' : 'Rafraîchir'}</span>
          </button>
        </div>
      </header>

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

      {!loading && bilan && (chartData.length > 0 || topEquipements.length > 0) && (
        <section className="cout-panels">
          {chartData.length > 0 && (
            <div className="cout-panel">
              <h3 className="cout-panel__title">Évolution mensuelle</h3>

              <div className="cout-chart">
                <svg
                  viewBox={`0 0 ${CHART.W} ${CHART.H}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="cout-chart__svg"
                  role="img"
                  aria-label="Évolution mensuelle des coûts"
                >
                  <defs>
                    <linearGradient id="coutAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0794a4" stopOpacity="0.35" />
                      <stop offset="60%" stopColor="#0794a4" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#0794a4" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="coutLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3dbcc9" />
                      <stop offset="100%" stopColor="#067a87" />
                    </linearGradient>
                  </defs>

                  {chartYTicks.map((tick, idx) => (
                    <g key={`yt-${idx}`}>
                      <line
                        x1={CHART.PAD.left}
                        x2={CHART.W - CHART.PAD.right}
                        y1={tick.y}
                        y2={tick.y}
                        className="cout-chart__grid"
                      />
                      <text
                        x={CHART.PAD.left - 10}
                        y={tick.y + 4}
                        textAnchor="end"
                        className="cout-chart__y-label"
                      >
                        {formatMontantCourt(tick.value)}
                      </text>
                    </g>
                  ))}

                  <line
                    x1={CHART.PAD.left}
                    x2={CHART.W - CHART.PAD.right}
                    y1={CHART.H - CHART.PAD.bottom}
                    y2={CHART.H - CHART.PAD.bottom}
                    className="cout-chart__axis"
                  />

                  <path d={chartAreaPath} fill="url(#coutAreaGradient)" />

                  <path
                    d={chartLinePath}
                    fill="none"
                    stroke="url(#coutLineGradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {chartPoints.map((p) => (
                    <g key={p.key} className="cout-chart__point-group">
                      <circle cx={p.x} cy={p.y} r="10" className="cout-chart__point-halo" />
                      <circle
                        cx={p.x} cy={p.y} r="5"
                        fill="#ffffff"
                        stroke="#067a87"
                        strokeWidth="2.5"
                        className="cout-chart__point"
                      />
                      <circle cx={p.x} cy={p.y} r="2" fill="#0794a4" />

                      <title>{`${p.label} : ${formatMontant(p.valeur)}`}</title>

                      <text
                        x={p.x}
                        y={CHART.H - CHART.PAD.bottom + 20}
                        textAnchor="middle"
                        className="cout-chart__x-label"
                      >
                        {p.shortLabel}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          )}

          {topEquipements.length > 0 && (
            <div className="cout-panel">
              <h3 className="cout-panel__title">Équipements les plus coûteux</h3>

              <ul className="cout-top-list">
                {equipementsPagines.map((e) => (
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

              <Pagination base={1} page={equipPage} taille={EQUIP_PAGE_SIZE} total={topEquipements.length} onPage={goToEquipPage} masquerSiUnePage />
            </div>
          )}
        </section>
      )}

      <div className="cout-toolbar">
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

        {!loading && bonsAffiches.length > 0 && (
          <span className="cout-toolbar__count">
            {bonsAffiches.length} bon{bonsAffiches.length > 1 ? 's' : ''}
            {recherche && ' filtré' + (bonsAffiches.length > 1 ? 's' : '')}
          </span>
        )}
      </div>

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
        <>
          <ul className="cout-list">
            {bonsPagines.map((b) => (
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

          <Pagination base={1} page={currentPage} taille={PAGE_SIZE} total={bonsAffiches.length} onPage={goToPage} masquerSiUnePage />
        </>
      )}
    </div>
  );
}