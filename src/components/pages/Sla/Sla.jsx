import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import slaService from '../../../services/slaService';
import { prioriteLabel, prioriteRang } from '../../../constants/Priorite';
import { t, tp, locale } from '../../../i18n';
import { ClipboardCheck, FileSpreadsheet, Inbox, LoaderCircle, RefreshCw, Search, ShieldCheck, Target, Timer, TriangleAlert } from 'lucide-react';
import './Sla.css';

/* ---------- Config ---------- */
const PRIORITE_HEX = { P1: '#ef4444', P2: '#f97316', P3: '#3b82f6', P4: '#64748b' };

const STATUT_LABELS = {
  RESPECTE: 'Respecté',
  DEPASSE: 'Dépassé',
  EN_COURS: 'En cours',
  NON_APPLICABLE: 'N/A',
};

const STATUT_CLASS = {
  RESPECTE: 'sla-statut--respecte',
  DEPASSE: 'sla-statut--depasse',
  EN_COURS: 'sla-statut--encours',
  NON_APPLICABLE: 'sla-statut--na',
};

const PERIODES = [
  { key: '7J',  label: '7 jours',  jours: 7 },
  { key: '30J', label: '30 jours', jours: 30 },
  { key: '3M',  label: '3 mois',   jours: 90 },
  { key: '12M', label: '12 mois',  jours: 365 },
];

const VUES = [
  { key: 'PERIODE',     label: 'Bons de la période' },
  { key: 'DEPASSEMENTS', label: 'Dépassements en cours' },
];

/* ---------- Pagination ---------- */
const TAILLES_PAGE = [5, 10, 20, 50];
const TAILLE_PAGE_DEFAUT = 5;

/* ---------- Utils ---------- */
function calculerBornes(periodeKey) {
  const fin = new Date();
  const debut = new Date(fin);
  const conf = PERIODES.find((p) => p.key === periodeKey) || PERIODES[2];
  debut.setDate(debut.getDate() - conf.jours);
  return { dateDebut: debut.toISOString(), dateFin: fin.toISOString() };
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function formatDuree(heures) {
  if (heures === null || heures === undefined) return '—';
  const n1 = (v) => v.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (heures < 48) return t('{n} h', { n: n1(heures) });
  return t('{n} j', { n: n1(heures / 24) });
}

function formatTaux(taux) {
  if (taux === null || taux === undefined) return '—';
  return t('{n} %', { n: taux.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
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
  <LoaderCircle size={15} strokeWidth={2.5} className="sla-spinner" aria-hidden="true" />
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

const IconTarget = () => (
  <Target size={16} aria-hidden="true" />
);

const IconCheckShield = () => (
  <ShieldCheck size={16} aria-hidden="true" />
);

const IconAlertTriangle = () => (
  <TriangleAlert size={16} aria-hidden="true" />
);

const IconStopwatch = () => (
  <Timer size={16} aria-hidden="true" />
);

const IconChevron = ({ direction = 'right' }) => (
  <Svg size={14}>
    {direction === 'left'
      ? <path d="m15 18-6-6 6-6" />
      : <path d="m9 18 6-6-6-6" />}
  </Svg>
);

const IconClipboardCheck = () => (
  <ClipboardCheck size={24} strokeWidth={2} aria-hidden="true" />
);

/* Icône tableur Excel */
const IconExcel = () => (
  <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
);

/* ---------- Export Excel ---------- */
function exporterExcel({ vue, periodeLabel, bornes, bilan, bons }) {
  const wb = XLSX.utils.book_new();
  const dateExport = new Date().toLocaleString('fr-FR');

  /* ----- Feuille 1 : Synthèse ----- */
  const syntheseData = [
    ['Rapport SLA', ''],
    ['Vue', vue === 'PERIODE' ? 'Bons de la période' : 'Dépassements en cours'],
    ['Période', vue === 'PERIODE' ? periodeLabel : '— (dépassements ouverts)'],
    ['Du', bornes ? new Date(bornes.dateDebut).toLocaleDateString('fr-FR') : '—'],
    ['Au', bornes ? new Date(bornes.dateFin).toLocaleDateString('fr-FR') : '—'],
    ['Généré le', dateExport],
    ['', ''],
  ];

  if (bilan) {
    syntheseData.push(
      ['Indicateur', 'Valeur'],
      ['Taux de respect — Réponse', bilan.tauxRespectReponsePct != null ? `${bilan.tauxRespectReponsePct.toFixed(1)} %` : '—'],
      ['Taux de respect — Résolution', bilan.tauxRespectResolutionPct != null ? `${bilan.tauxRespectResolutionPct.toFixed(1)} %` : '—'],
      ['Bons analysés', bilan.nbBonsAnalyses ?? 0],
      ['Dépassements réponse', bilan.nbReponseDepassee ?? 0],
      ['Dépassements résolution', bilan.nbResolutionDepassee ?? 0],
      ['Total dépassements', (bilan.nbReponseDepassee ?? 0) + (bilan.nbResolutionDepassee ?? 0)],
    );
  } else {
    syntheseData.push(
      ['Indicateur', 'Valeur'],
      ['Bons en dépassement', bons.length],
    );
  }

  const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseData);
  wsSynthese['!cols'] = [{ wch: 34 }, { wch: 24 }];
  wsSynthese['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthèse');

  /* ----- Feuille 2 : Par priorité (si dispo) ----- */
  if (bilan?.parPriorite?.length) {
    const prioRows = bilan.parPriorite.map((p) => ({
      'Priorité': p.priorite,
      'Libellé': prioriteLabel(p.priorite),
      'Nb bons': Number(p.nbBons ?? 0),
      'Respect réponse (%)': p.tauxRespectReponsePct != null ? Number(p.tauxRespectReponsePct.toFixed(2)) : '',
      'Respect résolution (%)': p.tauxRespectResolutionPct != null ? Number(p.tauxRespectResolutionPct.toFixed(2)) : '',
    }));
    const wsPrio = XLSX.utils.json_to_sheet(prioRows);
    wsPrio['!cols'] = [
      { wch: 10 },
      { wch: 26 },
      { wch: 12 },
      { wch: 20 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPrio, 'Par priorité');
  }

  /* ----- Feuille 3 : Bons ----- */
  const bonsRows = bons.map((b) => ({
    'N°': b.num || '',
    'Titre': b.titre || '',
    'Priorité': b.priorite || '',
    'Libellé priorité': b.priorite ? prioriteLabel(b.priorite) : '',
    'Statut réponse': STATUT_LABELS[b.statutReponse] ? t(STATUT_LABELS[b.statutReponse]) : (b.statutReponse || '—'),
    'Statut résolution': STATUT_LABELS[b.statutResolution] ? t(STATUT_LABELS[b.statutResolution]) : (b.statutResolution || '—'),
    'Délai réponse réel (h)': b.delaiReponseReelHeures != null ? Number(b.delaiReponseReelHeures.toFixed(2)) : '',
    'Délai réponse cible (h)': b.delaiReponseCibleHeures != null ? Number(b.delaiReponseCibleHeures.toFixed(2)) : '',
    'Délai résolution réel (h)': b.delaiResolutionReelHeures != null ? Number(b.delaiResolutionReelHeures.toFixed(2)) : '',
    'Délai résolution cible (h)': b.delaiResolutionCibleHeures != null ? Number(b.delaiResolutionCibleHeures.toFixed(2)) : '',
    'Échéance réponse': b.echeanceReponse ? formatDateTime(b.echeanceReponse) : '',
    'Échéance résolution': b.echeanceResolution ? formatDateTime(b.echeanceResolution) : '',
  }));

  const wsBons = XLSX.utils.json_to_sheet(bonsRows);
  wsBons['!cols'] = [
    { wch: 12 },
    { wch: 42 },
    { wch: 10 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBons, 'Bons');

  /* ----- Nom du fichier ----- */
  const vueSlug = vue === 'DEPASSEMENTS' ? 'depassements' : periodeLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const nomFichier = `sla-${vueSlug}-${date}.xlsx`;

  XLSX.writeFile(wb, nomFichier);
}

/* ---------- Pagination ---------- */
function construirePages(pageActuelle, totalPages) {
  const pages = [];
  const ajouter = (v) => { if (!pages.includes(v)) pages.push(v); };

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) ajouter(i);
    return pages;
  }

  ajouter(1);
  if (pageActuelle > 3) ajouter('…');
  for (let i = Math.max(2, pageActuelle - 1); i <= Math.min(totalPages - 1, pageActuelle + 1); i++) {
    ajouter(i);
  }
  if (pageActuelle < totalPages - 2) ajouter('…');
  ajouter(totalPages);
  return pages;
}

function Pagination({
  page, totalPages, totalItems, taillePage,
  onChangePage, onChangeTaille,
}) {
  if (totalPages <= 1 && totalItems <= TAILLES_PAGE[0]) return null;

  const pages = construirePages(page, totalPages);

  return (
    <div className="sla-pagination">
      <div className="sla-pagination__left">
        <span className="sla-pagination__info">
          {t("Page")} <strong>{page}</strong> {t("sur")} <strong>{totalPages}</strong>
          {' · '}<span className="sla-pagination__count">{tp('bon', totalItems)}</span>
        </span>
      </div>

      <div className="sla-pagination__center">
        <button
          type="button"
          className="sla-pagination__btn sla-pagination__btn--nav"
          onClick={() => onChangePage(page - 1)}
          disabled={page <= 1}
          aria-label={t("Page précédente")}
        >
          <span className="rtl-miroir"><IconChevron direction="left" /></span>
        </button>

        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`ellipsis-${idx}`} className="sla-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`sla-pagination__btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onChangePage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="sla-pagination__btn sla-pagination__btn--nav"
          onClick={() => onChangePage(page + 1)}
          disabled={page >= totalPages}
          aria-label={t("Page suivante")}
        >
          <span className="rtl-miroir"><IconChevron direction="right" /></span>
        </button>
      </div>

      <div className="sla-pagination__right">
        <label className="sla-pagination__size">
          <span>{t("Par page")}</span>
          <select
            value={taillePage}
            onChange={(e) => onChangeTaille(Number(e.target.value))}
            className="sla-pagination__select"
          >
            {TAILLES_PAGE.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/* ---------- Composant principal ---------- */
export default function Sla() {
  const [vue, setVue] = useState('PERIODE');
  const [periodeKey, setPeriodeKey] = useState('30J');
  const [bons, setBons] = useState([]);
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [recherche, setRecherche] = useState('');

  /* ---------- Pagination ---------- */
  const [page, setPage] = useState(1);
  const [taillePage, setTaillePage] = useState(TAILLE_PAGE_DEFAUT);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (vue === 'DEPASSEMENTS') {
        const data = await slaService.getDepassements();
        setBons(data ?? []);
        setBilan(null);
      } else {
        const bornes = calculerBornes(periodeKey);
        const [listeBons, bilanData] = await Promise.all([
          slaService.getParPeriode(bornes),
          slaService.getBilan(bornes),
        ]);
        setBons(listeBons ?? []);
        setBilan(bilanData);
      }
    } catch (err) {
      console.error('Erreur chargement SLA :', err);
      setError(t("Impossible de charger les données SLA."));
    } finally {
      setLoading(false);
    }
  }, [vue, periodeKey]);

  useEffect(() => { charger(); }, [charger]);

  const bonsAffiches = useMemo(() => {
    return bons
      .filter((b) => !recherche.trim()
        || (b.titre || '').toLowerCase().includes(recherche.trim().toLowerCase())
        || (b.num || '').toLowerCase().includes(recherche.trim().toLowerCase()))
      .slice()
      .sort((a, b) => prioriteRang(a.priorite) - prioriteRang(b.priorite));
  }, [bons, recherche]);

  /* ---------- Pagination ---------- */
  const totalItems = bonsAffiches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / taillePage));
  const pageCourante = Math.min(page, totalPages);

  const bonsPaginees = useMemo(() => {
    const debut = (pageCourante - 1) * taillePage;
    return bonsAffiches.slice(debut, debut + taillePage);
  }, [bonsAffiches, pageCourante, taillePage]);

  useEffect(() => { setPage(1); }, [recherche]);
  useEffect(() => { setPage(1); }, [vue]);
  useEffect(() => { setPage(1); }, [periodeKey]);
  useEffect(() => { setPage(1); }, [taillePage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /* ---------- Helper pour classer les taux ---------- */
  const getTauxClass = (taux) =>
    taux >= 90 ? 'sla-prio-bar--bon'
    : taux >= 70 ? 'sla-prio-bar--moyen'
    : 'sla-prio-bar--critique';

  /* ---------- Export Excel ---------- */
  const periodeLabel = PERIODES.find((p) => p.key === periodeKey)?.label || periodeKey;

  const handleExportExcel = () => {
    if (!bons.length && !bilan) return;
    setExporting(true);
    try {
      exporterExcel({
        vue,
        periodeLabel,
        bornes: vue === 'PERIODE' ? calculerBornes(periodeKey) : null,
        bilan,
        // On exporte TOUS les bons filtrés (pas seulement la page paginée)
        bons: bonsAffiches,
      });
    } catch (err) {
      console.error('Erreur export Excel :', err);
      setError(t("Impossible de générer le fichier Excel."));
    } finally {
      setTimeout(() => setExporting(false), 300);
    }
  };

  const peutExporter = !loading && (bonsAffiches.length > 0 || (bilan && bilan.nbBonsAnalyses > 0));

  return (
    <div className="sla-page">
      {/* ---------- Header ---------- */}
      <header className="sla-header">
        <div className="sla-header__icon-wrap">
          <IconClipboardCheck />
        </div>
        <div className="sla-header__text">
          <h1>{t("SLA")}</h1>
          <p>
            {t("Délais de réponse et de résolution contractuels par priorité, mesurés sur les dates réelles des bons — pas d'estimation.")}
          </p>
        </div>

        <div className="sla-header__actions">
          <div className="sla-vue-select">
            {VUES.map((v) => (
              <button
                key={v.key}
                className={`sla-vue-btn ${vue === v.key ? 'sla-vue-btn--active' : ''}`}
                onClick={() => setVue(v.key)}
              >
                {t(v.label)}
              </button>
            ))}
          </div>

          {vue === 'PERIODE' && (
            <div className="sla-periode-select">
              {PERIODES.map((p) => (
                <button
                  key={p.key}
                  className={`sla-periode-btn ${periodeKey === p.key ? 'sla-periode-btn--active' : ''}`}
                  onClick={() => setPeriodeKey(p.key)}
                >
                  {t(p.label)}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="sla-export-btn"
            onClick={handleExportExcel}
            disabled={!peutExporter || exporting}
            title={t("Exporter en Excel")}
          >
            {exporting ? <IconSpinner /> : <IconExcel />}
            <span>{exporting ? t("Export…") : t("Excel")}</span>
          </button>

          <button className="sla-refresh-btn" onClick={charger} disabled={loading}>
            {loading ? <IconSpinner /> : <IconRefresh />}
            <span>{loading ? t("Chargement") : t("Rafraîchir")}</span>
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      {vue === 'PERIODE' && !loading && bilan && (
        <section className="sla-kpis">
          <div className={`sla-kpi ${(bilan.tauxRespectReponsePct ?? 100) >= 90 ? 'sla-kpi--bon' : (bilan.tauxRespectReponsePct ?? 100) >= 70 ? 'sla-kpi--moyen' : 'sla-kpi--critique'}`}>
            <div className="sla-kpi__icon"><IconTarget /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">{t("Respect délai de réponse")}</span>
              <span className="sla-kpi__valeur">{formatTaux(bilan.tauxRespectReponsePct)}</span>
            </div>
          </div>

          <div className={`sla-kpi ${(bilan.tauxRespectResolutionPct ?? 100) >= 90 ? 'sla-kpi--bon' : (bilan.tauxRespectResolutionPct ?? 100) >= 70 ? 'sla-kpi--moyen' : 'sla-kpi--critique'}`}>
            <div className="sla-kpi__icon"><IconCheckShield /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">{t("Respect délai de résolution")}</span>
              <span className="sla-kpi__valeur">{formatTaux(bilan.tauxRespectResolutionPct)}</span>
            </div>
          </div>

          <div className="sla-kpi sla-kpi--neutre">
            <div className="sla-kpi__icon"><IconStopwatch /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">{t("Bons analysés")}</span>
              <span className="sla-kpi__valeur">{bilan.nbBonsAnalyses}</span>
            </div>
          </div>

          <div className={`sla-kpi ${bilan.nbReponseDepassee + bilan.nbResolutionDepassee > 0 ? 'sla-kpi--critique' : 'sla-kpi--bon'}`}>
            <div className="sla-kpi__icon"><IconAlertTriangle /></div>
            <div className="sla-kpi__body">
              <span className="sla-kpi__label">{t("Dépassements (réponse + résolution)")}</span>
              <span className="sla-kpi__valeur">{bilan.nbReponseDepassee + bilan.nbResolutionDepassee}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Répartition par priorité — cartes ---------- */}
      {vue === 'PERIODE' && !loading && bilan && bilan.parPriorite?.length > 0 && (
        <section className="sla-priorites">
          <div className="sla-priorites__header">
            <h3 className="sla-priorites__title">{t("Répartition par priorité")}</h3>
            <span className="sla-priorites__sub">
              {tp('bon analysé', bilan.parPriorite.reduce((s, p) => s + p.nbBons, 0))}
            </span>
          </div>

          <div className="sla-priorites__grid">
            {bilan.parPriorite.map((p) => {
              const tauxRep = p.tauxRespectReponsePct ?? 100;
              const tauxRes = p.tauxRespectResolutionPct ?? 100;

              return (
                <div
                  key={p.priorite}
                  className="sla-prio-card"
                  style={{ '--prio-color': PRIORITE_HEX[p.priorite] }}
                >
                  <div className="sla-prio-card__head">
                    <div className="sla-prio-card__badge">
                      <span className="sla-prio-card__dot" />
                      <span className="sla-prio-card__label">{p.priorite}</span>
                    </div>
                    <span className="sla-prio-card__nb">
                      {tp('bon', p.nbBons)}
                    </span>
                  </div>

                  <div className="sla-prio-card__name">{t(prioriteLabel(p.priorite))}</div>

                  <div className="sla-prio-card__bars">
                    <div className="sla-prio-bar">
                      <div className="sla-prio-bar__head">
                        <span className="sla-prio-bar__label">{t("Réponse")}</span>
                        <span className="sla-prio-bar__value">{formatTaux(tauxRep)}</span>
                      </div>
                      <div className="sla-prio-bar__track">
                        <div
                          className={`sla-prio-bar__fill ${getTauxClass(tauxRep)}`}
                          style={{ width: `${Math.min(100, Math.max(0, tauxRep))}%` }}
                        />
                      </div>
                    </div>

                    <div className="sla-prio-bar">
                      <div className="sla-prio-bar__head">
                        <span className="sla-prio-bar__label">{t("Résolution")}</span>
                        <span className="sla-prio-bar__value">{formatTaux(tauxRes)}</span>
                      </div>
                      <div className="sla-prio-bar__track">
                        <div
                          className={`sla-prio-bar__fill ${getTauxClass(tauxRes)}`}
                          style={{ width: `${Math.min(100, Math.max(0, tauxRes))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Recherche ---------- */}
      <div className="sla-filtres">
        <div className="sla-recherche-wrap">
          <span className="sla-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder={t("Rechercher par titre ou numéro...")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="sla-recherche"
          />
        </div>
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="sla-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="sla-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : bonsAffiches.length === 0 ? (
        <p className="sla-empty">
          <IconInbox />
          <span>
            {vue === 'DEPASSEMENTS'
              ? t("Aucun dépassement en cours — tous les bons ouverts sont dans les délais.")
              : t("Aucun bon ne correspond à cette recherche sur la période.")}
          </span>
        </p>
      ) : (
        <>
          <ul className="sla-list">
            {bonsPaginees.map((b) => (
              <li key={b.bonMaintenanceId} className="sla-card">
                <div className="sla-card__header">
                  <div className="sla-card__titre-wrap">
                    <span className="sla-priorite-dot" style={{ backgroundColor: PRIORITE_HEX[b.priorite] }} />
                    <span className="sla-card__titre">{b.titre || t('Bon {num}', { num: b.num || b.bonMaintenanceId })}</span>
                    <span className="sla-card__num">{b.num}</span>
                  </div>
                  <span className="sla-card__priorite-label">{t(prioriteLabel(b.priorite))}</span>
                </div>

                <div className="sla-card__delais">
                  <div className="sla-delai">
                    <span className="sla-delai__label">{t("Réponse")}</span>
                    <span className={`sla-statut ${STATUT_CLASS[b.statutReponse] || ''}`}>
                      {STATUT_LABELS[b.statutReponse] ? t(STATUT_LABELS[b.statutReponse]) : b.statutReponse}
                    </span>
                    <span className="sla-delai__detail">
                      {b.delaiReponseReelHeures !== null && b.delaiReponseReelHeures !== undefined
                        ? t('{reel} (cible {cible})', { reel: formatDuree(b.delaiReponseReelHeures), cible: formatDuree(b.delaiReponseCibleHeures) })
                        : b.echeanceReponse ? t('Échéance {date}', { date: formatDateTime(b.echeanceReponse) }) : '—'}
                    </span>
                  </div>

                  <div className="sla-delai">
                    <span className="sla-delai__label">{t("Résolution")}</span>
                    <span className={`sla-statut ${STATUT_CLASS[b.statutResolution] || ''}`}>
                      {STATUT_LABELS[b.statutResolution] ? t(STATUT_LABELS[b.statutResolution]) : b.statutResolution}
                    </span>
                    <span className="sla-delai__detail">
                      {b.delaiResolutionReelHeures !== null && b.delaiResolutionReelHeures !== undefined
                        ? t('{reel} (cible {cible})', { reel: formatDuree(b.delaiResolutionReelHeures), cible: formatDuree(b.delaiResolutionCibleHeures) })
                        : b.echeanceResolution ? t('Échéance {date}', { date: formatDateTime(b.echeanceResolution) }) : '—'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={pageCourante}
            totalPages={totalPages}
            totalItems={totalItems}
            taillePage={taillePage}
            onChangePage={setPage}
            onChangeTaille={setTaillePage}
          />
        </>
      )}
    </div>
  );
}