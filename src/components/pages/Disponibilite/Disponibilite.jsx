import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import disponibiliteService from '../../../services/Disponibiliteservice ';
import { criticiteHex, criticiteLabel } from '../../../constants/Criticite';
import { t, tp, locale } from '../../../i18n';
import { Activity, FileSpreadsheet, Gauge, History, Inbox, LoaderCircle, RefreshCw, Search, TrendingDown, TriangleAlert, Wrench } from 'lucide-react';
import './Disponibilite.css';
import PaginationCommune from '../../commun/Pagination';

/* ---------- Config ---------- */
const ETAT_LABELS = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  HORS_SERVICE: 'Hors service',
};

const PERIODES = [
  { key: '30J', label: '30 jours', mois: 1 },
  { key: '3M',  label: '3 mois',   mois: 3 },
  { key: '6M',  label: '6 mois',   mois: 6 },
  { key: '12M', label: '12 mois',  mois: 12 },
];

const SEUIL_BON = 95;
const SEUIL_MOYEN = 80;
/* ---------- Pagination ---------- */
const TAILLES_PAGE = [10, 25, 50, 100];
const TAILLE_PAGE_DEFAUT = 10;

/* ---------- Utils ---------- */
function calculerBornes(periodeKey) {
  const fin = new Date();
  const debut = new Date(fin);
  const conf = PERIODES.find((p) => p.key === periodeKey) || PERIODES[3];
  debut.setMonth(debut.getMonth() - conf.mois);
  return { dateDebut: debut.toISOString(), dateFin: fin.toISOString() };
}

function formatDuree(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return t('{n} h', { n: heures.toFixed(1) });
  return t('{n} j', { n: (heures / 24).toFixed(1) });
}

function tauxNiveau(taux) {
  if (taux === null || taux === undefined) return 'inconnu';
  if (taux >= SEUIL_BON) return 'bon';
  if (taux >= SEUIL_MOYEN) return 'moyen';
  return 'critique';
}

function formatTaux(taux) {
  if (taux === null || taux === undefined) return '—';
  return `${taux.toFixed(1)} %`;
}

/* ---------- Icônes ---------- */
const Svg = (props) => (
  <svg width={props.size || 15} height={props.size || 15} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" {...props} />
);

const IconRefresh = () => (
  <RefreshCw size={15} aria-hidden="true" />
);

const IconSpinner = () => (
  <LoaderCircle size={15} strokeWidth={2.5} className="disp-spinner" aria-hidden="true" />
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

const IconGauge = () => (
  <Gauge size={16} aria-hidden="true" />
);

const IconTrendDown = () => (
  <TrendingDown size={16} aria-hidden="true" />
);

const IconClockRepeat = () => (
  <History size={16} aria-hidden="true" />
);

const IconWrenchAlt = () => (
  <Wrench size={16} aria-hidden="true" />
);

const IconActivity = () => (
  <Activity size={24} strokeWidth={2} aria-hidden="true" />
);

const IconChevron = ({ direction = 'right' }) => (
  <Svg size={14}>
    {direction === 'left'
      ? <path d="m15 18-6-6 6-6" />
      : <path d="m9 18 6-6-6-6" />}
  </Svg>
);

/* Icône tableur Excel */
const IconExcel = () => (
  <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
);

/* ---------- Export Excel ---------- */
function exporterExcel({ periodeLabel, bornes, donnees, kpis }) {
  const wb = XLSX.utils.book_new();

  const dateDebut = new Date(bornes.dateDebut).toLocaleDateString('fr-FR');
  const dateFin = new Date(bornes.dateFin).toLocaleDateString('fr-FR');
  const dateExport = new Date().toLocaleString('fr-FR');

  /* ----- Feuille 1 : Synthèse ----- */
  const syntheseData = [
    ['Rapport de disponibilité', ''],
    ['Période', periodeLabel],
    ['Du', dateDebut],
    ['Au', dateFin],
    ['Généré le', dateExport],
    ['', ''],
    ['Indicateur', 'Valeur'],
    ['Disponibilité moyenne du parc', kpis.tauxMoyen != null ? `${kpis.tauxMoyen.toFixed(2)} %` : '—'],
    ['Pannes sur la période', kpis.totalPannes],
    ['MTBF moyen', kpis.mtbfMoyen != null ? formatDuree(kpis.mtbfMoyen) : '—'],
    ['MTTR moyen', kpis.mttrMoyen != null ? formatDuree(kpis.mttrMoyen) : '—'],
    ['Actifs sous 80 %', kpis.nbCritiques],
    ['', ''],
    ['Nombre d\'équipements suivis', donnees.length],
  ];
  const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseData);
  wsSynthese['!cols'] = [{ wch: 34 }, { wch: 24 }];
  wsSynthese['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse');

  /* ----- Feuille 2 : Détail parc ----- */
  const lignes = donnees.map((d) => {
    const niveau = tauxNiveau(d.tauxDisponibilitePct);
    const niveauLabel =
      niveau === 'bon'      ? 'Bon' :
      niveau === 'moyen'    ? 'Moyen' :
      niveau === 'critique' ? 'Critique' : '—';

    return {
      'Équipement': d.cibleNom || `Équipement #${d.lotArticleImmobilistationId}`,
      'État actuel': ETAT_LABELS[d.etatActuel] ? t(ETAT_LABELS[d.etatActuel]) : (d.etatActuel || '—'),
      'Criticité': d.criticite != null ? t(criticiteLabel(d.criticite)) : '—',
      'Disponibilité (%)': d.tauxDisponibilitePct != null ? Number(d.tauxDisponibilitePct.toFixed(2)) : '',
      'Niveau': niveauLabel,
      'Nb pannes': Number(d.nbPannes ?? 0),
      'MTBF (h)': d.mtbfHeures != null ? Number(d.mtbfHeures.toFixed(2)) : '',
      'MTTR (h)': d.mttrHeures != null ? Number(d.mttrHeures.toFixed(2)) : '',
      'Temps disponible (h)': d.dureeDisponibleHeures != null ? Number(d.dureeDisponibleHeures.toFixed(2)) : '',
      'Temps indisponible (h)': d.dureeIndisponibleHeures != null ? Number(d.dureeIndisponibleHeures.toFixed(2)) : '',
    };
  });

  const wsDetail = XLSX.utils.json_to_sheet(lignes);
  wsDetail['!cols'] = [
    { wch: 38 },  // Équipement
    { wch: 16 },  // État
    { wch: 12 },  // Criticité
    { wch: 16 },  // Dispo %
    { wch: 12 },  // Niveau
    { wch: 10 },  // Pannes
    { wch: 12 },  // MTBF
    { wch: 12 },  // MTTR
    { wch: 20 },  // Temps dispo
    { wch: 22 },  // Temps indispo
  ];

  // Ligne de totaux / moyennes
  const avecTaux = donnees.filter((d) => d.tauxDisponibilitePct != null);
  const totalRow = {
    'Équipement': 'TOTAL / MOYENNE',
    'État actuel': '',
    'Criticité': '',
    'Disponibilité (%)': avecTaux.length
      ? Number((avecTaux.reduce((s, d) => s + d.tauxDisponibilitePct, 0) / avecTaux.length).toFixed(2))
      : '',
    'Niveau': '',
    'Nb pannes': donnees.reduce((s, d) => s + Number(d.nbPannes ?? 0), 0),
    'MTBF (h)': '',
    'MTTR (h)': '',
    'Temps disponible (h)': '',
    'Temps indisponible (h)': '',
  };
  XLSX.utils.sheet_add_json(wsDetail, [totalRow], { skipHeader: true, origin: -1 });

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail parc');

  /* ----- Nom du fichier ----- */
  const cleanLabel = periodeLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const nomFichier = `disponibilite-${cleanLabel}-${date}.xlsx`;

  XLSX.writeFile(wb, nomFichier);
}

/* ---------- Pagination ---------- */

/* Pagination : composant commun (même style dans toute la GMAO) */
function Pagination({ page, totalItems, taillePage, onChangePage, onChangeTaille }) {
  return (
    <PaginationCommune base={1} page={page} taille={taillePage} total={totalItems}
      onPage={onChangePage} onTaille={onChangeTaille} tailles={TAILLES_PAGE} />
  );
}

/* ---------- Composant principal ---------- */
export default function Disponibilite() {
  const [periodeKey, setPeriodeKey] = useState('12M');
  const [donnees, setDonnees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [ligneOuverte, setLigneOuverte] = useState(null);

  /* ---------- Pagination ---------- */
  const [page, setPage] = useState(1);
  const [taillePage, setTaillePage] = useState(TAILLE_PAGE_DEFAUT);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bornes = calculerBornes(periodeKey);
      const data = await disponibiliteService.getAll(bornes);
      setDonnees(data ?? []);
    } catch (err) {
      console.error('Erreur chargement disponibilité :', err);
      setError(t("Impossible de charger la disponibilité du parc."));
    } finally {
      setLoading(false);
    }
  }, [periodeKey]);

  useEffect(() => { charger(); }, [charger]);

  const donneesAffichees = donnees.filter(
    (d) => !recherche.trim() || (d.cibleNom || '').toLowerCase().includes(recherche.trim().toLowerCase())
  );

  /* ---------- Pagination ---------- */
  const totalItems = donneesAffichees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / taillePage));
  const pageCourante = Math.min(page, totalPages);

  const donneesPaginees = useMemo(() => {
    const debut = (pageCourante - 1) * taillePage;
    return donneesAffichees.slice(debut, debut + taillePage);
  }, [donneesAffichees, pageCourante, taillePage]);

  useEffect(() => { setPage(1); }, [recherche]);
  useEffect(() => { setPage(1); }, [periodeKey]);
  useEffect(() => { setPage(1); }, [taillePage]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const kpis = useMemo(() => {
    if (donnees.length === 0) {
      return { tauxMoyen: null, totalPannes: 0, mtbfMoyen: null, mttrMoyen: null, nbCritiques: 0 };
    }
    const avecTaux = donnees.filter((d) => d.tauxDisponibilitePct !== null && d.tauxDisponibilitePct !== undefined);
    const tauxMoyen = avecTaux.length
      ? avecTaux.reduce((s, d) => s + d.tauxDisponibilitePct, 0) / avecTaux.length
      : null;

    const totalPannes = donnees.reduce((s, d) => s + (d.nbPannes || 0), 0);

    const avecMtbf = donnees.filter((d) => d.mtbfHeures !== null && d.mtbfHeures !== undefined);
    const mtbfMoyen = avecMtbf.length ? avecMtbf.reduce((s, d) => s + d.mtbfHeures, 0) / avecMtbf.length : null;

    const avecMttr = donnees.filter((d) => d.mttrHeures !== null && d.mttrHeures !== undefined);
    const mttrMoyen = avecMttr.length ? avecMttr.reduce((s, d) => s + d.mttrHeures, 0) / avecMttr.length : null;

    const nbCritiques = donnees.filter((d) => tauxNiveau(d.tauxDisponibilitePct) === 'critique').length;

    return { tauxMoyen, totalPannes, mtbfMoyen, mttrMoyen, nbCritiques };
  }, [donnees]);

  /* ---------- Export Excel ---------- */
  const periodeLabel = PERIODES.find((p) => p.key === periodeKey)?.label || periodeKey;

  const handleExportExcel = () => {
    if (!donnees.length) return;
    setExporting(true);
    try {
      exporterExcel({
        periodeLabel,
        bornes: calculerBornes(periodeKey),
        donnees,       // on exporte TOUT le parc (pas seulement la page filtrée)
        kpis,
      });
    } catch (err) {
      console.error('Erreur export Excel :', err);
      setError("Impossible de générer le fichier Excel.");
    } finally {
      setTimeout(() => setExporting(false), 300);
    }
  };

  const peutExporter = !loading && donnees.length > 0;

  return (
    <div className="disp-page">
      {/* ---------- Header ---------- */}
      <header className="disp-header">
        <div className="disp-header__icon-wrap">
          <IconActivity />
        </div>
        <div className="disp-header__text">
          <h1>{t("Disponibilité")}</h1>
          <p>
            {t("Taux de disponibilité, MTBF (temps moyen entre pannes) et MTTR (temps moyen de réparation), calculés à partir de l'historique réel des états — pas d'estimation.")}
          </p>
        </div>

        <div className="disp-header__actions">
          <div className="disp-periode-select">
            {PERIODES.map((p) => (
              <button
                key={p.key}
                className={`disp-periode-btn ${periodeKey === p.key ? 'disp-periode-btn--active' : ''}`}
                onClick={() => setPeriodeKey(p.key)}
              >
                {t(p.label)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="disp-export-btn"
            onClick={handleExportExcel}
            disabled={!peutExporter || exporting}
            title={t("Exporter en Excel")}
          >
            {exporting ? <IconSpinner /> : <IconExcel />}
            <span>{exporting ? t("Export…") : t("Excel")}</span>
          </button>

          <button className="disp-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? t("Chargement") : t("Rafraîchir")}</span>
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      {!loading && donnees.length > 0 && (
        <section className="disp-kpis">
          <div className={`disp-kpi disp-kpi--${tauxNiveau(kpis.tauxMoyen)}`}>
            <div className="disp-kpi__icon"><IconGauge /></div>
            <div className="disp-kpi__body">
              <span className="disp-kpi__label">{t("Disponibilité moyenne du parc")}</span>
              <span className="disp-kpi__valeur">{formatTaux(kpis.tauxMoyen)}</span>
            </div>
          </div>

          <div className="disp-kpi disp-kpi--neutre">
            <div className="disp-kpi__icon"><IconWrenchAlt /></div>
            <div className="disp-kpi__body">
              <span className="disp-kpi__label">{t("Pannes sur la période")}</span>
              <span className="disp-kpi__valeur">{kpis.totalPannes}</span>
            </div>
          </div>

          <div className="disp-kpi disp-kpi--neutre">
            <div className="disp-kpi__icon"><IconClockRepeat /></div>
            <div className="disp-kpi__body">
              <span className="disp-kpi__label">{t("MTBF moyen")}</span>
              <span className="disp-kpi__valeur">{formatDuree(kpis.mtbfMoyen)}</span>
            </div>
          </div>

          <div className="disp-kpi disp-kpi--neutre">
            <div className="disp-kpi__icon"><IconTrendDown /></div>
            <div className="disp-kpi__body">
              <span className="disp-kpi__label">{t("MTTR moyen")}</span>
              <span className="disp-kpi__valeur">{formatDuree(kpis.mttrMoyen)}</span>
            </div>
          </div>

          <div className={`disp-kpi ${kpis.nbCritiques > 0 ? 'disp-kpi--critique' : 'disp-kpi--bon'}`}>
            <div className="disp-kpi__icon"><IconAlert /></div>
            <div className="disp-kpi__body">
              <span className="disp-kpi__label">{t('Actifs sous {seuil} %', { seuil: SEUIL_MOYEN })}</span>
              <span className="disp-kpi__valeur">{kpis.nbCritiques}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Recherche ---------- */}
      <div className="disp-filtres">
        <div className="disp-recherche-wrap">
          <span className="disp-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder={t("Rechercher un équipement...")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="disp-recherche"
          />
        </div>
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="disp-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="disp-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : donneesAffichees.length === 0 ? (
        <p className="disp-empty">
          <IconInbox />
          <span>
            {donnees.length === 0
              ? t("Aucune donnée de disponibilité pour le moment — assure-toi que des états d'équipement ont été calculés (page « État des équipements »).")
              : t("Aucun équipement ne correspond à cette recherche.")}
          </span>
        </p>
      ) : (
        <>
          <ul className="disp-list">
            {donneesPaginees.map((d) => {
              const niveau = tauxNiveau(d.tauxDisponibilitePct);
              const isOpen = ligneOuverte === d.lotArticleImmobilistationId;
              const pct = d.tauxDisponibilitePct ?? 0;
              return (
                <li
                  key={d.lotArticleImmobilistationId}
                  className={`disp-card disp-card--${niveau} ${isOpen ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="disp-card__header"
                    onClick={() => setLigneOuverte(isOpen ? null : d.lotArticleImmobilistationId)}
                  >
                    <div className="disp-card__titre-wrap">
                      <span
                        className="disp-criticite-dot"
                        style={{ backgroundColor: criticiteHex(d.criticite) }}
                        title={t(criticiteLabel(d.criticite))}
                      />
                      <span className="disp-card__titre">{d.cibleNom}</span>
                      <span className="disp-etat-pill">{t(ETAT_LABELS[d.etatActuel] || d.etatActuel || '—')}</span>
                    </div>

                    <div className="disp-card__taux">
                      <div className="disp-barre">
                        <div
                          className={`disp-barre__fill disp-barre__fill--${niveau}`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <span className={`disp-taux-valeur disp-taux-valeur--${niveau}`}>
                        {formatTaux(d.tauxDisponibilitePct)}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="disp-detail">
                      <div className="disp-detail__grid">
                        <div className="disp-detail__item">
                          <span className="disp-detail__label">{t("Pannes sur la période")}</span>
                          <span className="disp-detail__valeur">{d.nbPannes}</span>
                        </div>
                        <div className="disp-detail__item">
                          <span className="disp-detail__label">{t("MTBF")}</span>
                          <span className="disp-detail__valeur">{formatDuree(d.mtbfHeures)}</span>
                        </div>
                        <div className="disp-detail__item">
                          <span className="disp-detail__label">{t("MTTR")}</span>
                          <span className="disp-detail__valeur">{formatDuree(d.mttrHeures)}</span>
                        </div>
                        <div className="disp-detail__item">
                          <span className="disp-detail__label">{t("Temps disponible")}</span>
                          <span className="disp-detail__valeur">{formatDuree(d.dureeDisponibleHeures)}</span>
                        </div>
                        <div className="disp-detail__item">
                          <span className="disp-detail__label">{t("Temps indisponible")}</span>
                          <span className="disp-detail__valeur">{formatDuree(d.dureeIndisponibleHeures)}</span>
                        </div>
                      </div>
                      <p className="disp-detail__note">
                        {t('Calculé sur la période {debut} – {fin}.', {
                          debut: new Date(d.dateDebutPeriode).toLocaleDateString(locale()),
                          fin: new Date(d.dateFinPeriode).toLocaleDateString(locale()),
                        })}
                        {d.nbPannes === 0 && ` ${t('Aucune panne enregistrée sur cette fenêtre : MTBF/MTTR non calculables.')}`}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination
            page={pageCourante}
            totalPages={totalPages}
            totalItems={totalItems}
            taillePage={taillePage}
            onChangePage={(p) => {
              setPage(p);
              setLigneOuverte(null);
            }}
            onChangeTaille={setTaillePage}
          />
        </>
      )}
    </div>
  );
}