import React, { useCallback, useEffect, useMemo, useState } from 'react';
import disponibiliteService from '../../../services/Disponibiliteservice ';
import { criticiteHex, criticiteLabel } from '../../../constants/Criticite';
import { t, tp, locale } from '../../../i18n';
import './Disponibilite.css';

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
const TAILLES_PAGE = [7, 14, 21, 50];
const TAILLE_PAGE_DEFAUT = 7;

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
  <Svg><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 4v5h-5M3 20v-5h5" /></Svg>
);

const IconSpinner = () => (
  <svg className="disp-spinner" width="15" height="15" viewBox="0 0 24 24"
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

const IconGauge = () => (
  <Svg size={16}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M12 3a9 9 0 0 0-9 9M4.2 9.5l1.9.8M19.8 9.5l-1.9.8" /><path d="m13.5 13.5 3-4.5" /></Svg>
);

const IconTrendDown = () => (
  <Svg size={16}><path d="M22 17 13.5 8.5 8.5 13.5 2 7" /><path d="M16 17h6v-6" /></Svg>
);

const IconClockRepeat = () => (
  <Svg size={16}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" /></Svg>
);

const IconWrenchAlt = () => (
  <Svg size={16}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z" /></Svg>
);

const IconActivity = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const IconChevron = ({ direction = 'right' }) => (
  <Svg size={14}>
    {direction === 'left'
      ? <path d="m15 18-6-6 6-6" />
      : <path d="m9 18 6-6-6-6" />}
  </Svg>
);

/* ---------- Pagination ---------- */
function construirePages(pageActuelle, totalPages) {
  // Retourne un tableau du genre : [1, '…', 4, 5, 6, '…', 20]
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
    <div className="disp-pagination">
      <div className="disp-pagination__left">
        <span className="disp-pagination__info">
          {t('Page {p} sur {total}', { p: page, total: totalPages })}
          {' · '}<span className="disp-pagination__count">{tp('équipement', totalItems)}</span>
        </span>
      </div>

      <div className="disp-pagination__center">
        <button
          type="button"
          className="disp-pagination__btn disp-pagination__btn--nav"
          onClick={() => onChangePage(page - 1)}
          disabled={page <= 1}
          aria-label={t("Page précédente")}
        >
          <span className="rtl-miroir"><IconChevron direction="left" /></span>
        </button>

        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`ellipsis-${idx}`} className="disp-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`disp-pagination__btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onChangePage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="disp-pagination__btn disp-pagination__btn--nav"
          onClick={() => onChangePage(page + 1)}
          disabled={page >= totalPages}
          aria-label={t("Page suivante")}
        >
          <span className="rtl-miroir"><IconChevron direction="right" /></span>
        </button>
      </div>

      <div className="disp-pagination__right">
        <label className="disp-pagination__size">
          <span>{t("Par page")}</span>
          <select
            value={taillePage}
            onChange={(e) => onChangeTaille(Number(e.target.value))}
            className="disp-pagination__select"
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
export default function Disponibilite() {
  const [periodeKey, setPeriodeKey] = useState('12M');
  const [donnees, setDonnees] = useState([]);
  const [loading, setLoading] = useState(false);
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

  // Reset page à 1 quand la recherche change
  useEffect(() => { setPage(1); }, [recherche]);

  // Reset page à 1 quand la période change
  useEffect(() => { setPage(1); }, [periodeKey]);

  // Si la taille de page change, on revient à la page 1
  useEffect(() => { setPage(1); }, [taillePage]);

  // Si la page courante dépasse le total, on la borne
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