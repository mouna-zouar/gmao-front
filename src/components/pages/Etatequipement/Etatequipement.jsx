import React, { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import etatEquipementService from '../../../services/Etatequipementservice';
import disponibiliteService from '../../../services/Disponibiliteservice ';
import risqueService from '../../../services/Risqueservice';
import { CRITICITE_OPTIONS, CRITICITE_DEFAUT, criticiteHex } from '../../../constants/Criticite';
import EquipementMaintenancePanel from './Equipementmaintenancepanel';
import EquipementMaintenanceTypesSettings from './EquipementMaintenanceTypesSettings';
import { t, tp, locale, tPdf, localePdf } from '../../../i18n';
import './EtatEquipement.css';

/* ---------- Risque (étape ⑥ de la roadmap métier) ---------- */
const RISQUE_NIVEAU_LABELS = { CRITIQUE: 'Critique', ELEVE: 'Élevé', MODERE: 'Modéré', FAIBLE: 'Faible' };
const RISQUE_NIVEAU_CLASS = { CRITIQUE: 'critique', ELEVE: 'eleve', MODERE: 'modere', FAIBLE: 'faible' };
const RISQUE_TENDANCE_LABELS = { HAUSSE: 'En hausse', BAISSE: 'En baisse', STABLE: 'Stable' };

/* ---------- Disponibilité (étape ③ de la roadmap métier) ---------- */
const DISPO_SEUIL_BON = 95;
const DISPO_SEUIL_MOYEN = 80;

function dispoNiveau(taux) {
  if (taux === null || taux === undefined) return 'inconnu';
  if (taux >= DISPO_SEUIL_BON) return 'bon';
  if (taux >= DISPO_SEUIL_MOYEN) return 'moyen';
  return 'critique';
}

function formatTaux(taux) {
  if (taux === null || taux === undefined) return '—';
  return `${taux.toFixed(1)} %`;
}

function formatDureeHeures(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return t('{n} h', { n: heures.toFixed(1) });
  return t('{n} j', { n: (heures / 24).toFixed(1) });
}

/* ---------- Config ---------- */
const ETAT_LABELS = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  HORS_SERVICE: 'Hors service',
};

const ETAT_CLASS = {
  EN_SERVICE: 'etat-badge--service',
  EN_PANNE: 'etat-badge--panne',
  EN_REPARATION: 'etat-badge--reparation',
  HORS_SERVICE: 'etat-badge--horsservice',
};

const ETATS = ['EN_SERVICE', 'EN_PANNE', 'EN_REPARATION', 'HORS_SERVICE'];

const FILTRES = [
  { key: 'TOUS', label: 'Tous' },
  ...ETATS.map((e) => ({ key: e, label: ETAT_LABELS[e] })),
];

/* ---------- Utils ---------- */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso, loc = locale()) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

function joursDepuis(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
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
  <svg className="etat-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const IconSearch = () => (
  <Svg size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

const IconChevron = () => (
  <Svg size={14}><path d="m6 9 6 6 6-6" /></Svg>
);

const IconInfo = () => (
  <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>
);

const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" />
  </svg>
);

const IconAlert = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconCheckCircle = () => (
  <Svg size={15}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
);

const IconXCircle = () => (
  <Svg size={15}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></Svg>
);

const IconWrench = () => (
  <Svg size={15}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z" /></Svg>
);

const IconPause = () => (
  <Svg size={15}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></Svg>
);

const IconFile = () => (
  <Svg size={13}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></Svg>
);

const IconDownload = () => (
  <Svg size={13}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Svg>
);

const IconClock = () => (
  <Svg size={13}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);

const IconHistory = () => (
  <Svg size={13}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" /></Svg>
);

const IconGauge = () => (
  <Svg size={13}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M12 3a9 9 0 0 0-9 9M4.2 9.5l1.9.8M19.8 9.5l-1.9.8" /><path d="m13.5 13.5 3-4.5" /></Svg>
);

const ETAT_ICONS = {
  EN_SERVICE: IconCheckCircle,
  EN_PANNE: IconXCircle,
  EN_REPARATION: IconWrench,
  HORS_SERVICE: IconPause,
};

/* ---------- Export PDF ----------
   En anglais si l'anglais est choisi, sinon en français : la police standard de jsPDF
   ne sait pas afficher l'alphabet arabe (voir tPdf dans i18n). */
function exporterHistoriquePDF(equipement, historique) {
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  const titre = `${tPdf("Historique d'état")} — ${equipement.cibleNom || tPdf('Équipement #{id}', { id: equipement.lotArticleImmobilistationId })}`;
  doc.text(titre, marginX, y, { maxWidth: pageWidth - marginX * 2 });
  y += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(tPdf('État actuel : {etat}', { etat: ETAT_LABELS[equipement.etatActuel] ? tPdf(ETAT_LABELS[equipement.etatActuel]) : equipement.etatActuel }), marginX, y);
  y += 5;
  if (equipement.depuisLe) {
    doc.text(tPdf('Depuis le {date}', { date: formatDateTime(equipement.depuisLe, localePdf()) }), marginX, y);
    y += 5;
  }
  doc.setTextColor(120);
  doc.text(
    tPdf('Document généré le {date} à {heure}', { date: new Date().toLocaleDateString(localePdf()), heure: new Date().toLocaleTimeString(localePdf(), { hour: '2-digit', minute: '2-digit' }) }),
    marginX, y
  );
  doc.setTextColor(0);
  y += 8;

  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(tPdf('Date'), marginX, y);
  doc.text(tPdf('Transition'), marginX + 32, y);
  doc.text(tPdf('Bon'), marginX + 120, y);
  y += 3;
  doc.setDrawColor(230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);

  if (historique.length === 0) {
    doc.setTextColor(140);
    doc.text(tPdf('Aucune transition enregistrée.'), marginX, y);
    doc.setTextColor(0);
  }

  historique.forEach((tache) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    const dateStr = formatDateTime(tache.dateTransition, localePdf());
    const libellePdf = (e) => (ETAT_LABELS[e] ? tPdf(ETAT_LABELS[e]) : e);
    const transitionStr = `${tache.etatPrecedent ? `${libellePdf(tache.etatPrecedent)} → ` : tPdf('Première détection : ')}${libellePdf(tache.etatNouveau)}`;

    doc.text(dateStr, marginX, y);
    doc.text(transitionStr, marginX + 32, y, { maxWidth: 82 });
    doc.text(tache.bonMaintenanceNum || '—', marginX + 120, y);
    if (tache.motif) {
      y += 4.5;
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text(tache.motif, marginX + 32, y, { maxWidth: 130 });
      doc.setFontSize(9);
      doc.setTextColor(0);
    }
    y += 7;
  });

  const nomFichier = `historique-etat-${(equipement.cibleNom || 'equipement').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  doc.save(nomFichier);
}

/* ---------- Composant ---------- */
export default function EtatEquipement({ isModal = false }) {
  const [etats, setEtats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recalculant, setRecalculant] = useState(false);
  const [message, setMessage] = useState(null);
  const [filtreEtat, setFiltreEtat] = useState('TOUS');
  const [recherche, setRecherche] = useState('');
  const [equipementOuvert, setEquipementOuvert] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);
  const [savingCriticite, setSavingCriticite] = useState(null);
  const [disponibilites, setDisponibilites] = useState({});
  const [loadingDispo, setLoadingDispo] = useState(false);
  const [risques, setRisques] = useState({});
  const [loadingRisque, setLoadingRisque] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await etatEquipementService.getAll();
      setEtats(data ?? []);
    } catch (err) {
      console.error('Erreur chargement états équipement :', err);
      setError(t("Impossible de charger les états."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Taux de disponibilité / MTBF / MTTR (12 derniers mois par défaut, calculé côté
  // backend à partir de l'historique des transitions) — chargé indépendamment des
  // états pour ne pas bloquer l'affichage si ce module est plus lent à répondre.
  const chargerDisponibilites = useCallback(async () => {
    setLoadingDispo(true);
    try {
      const data = await disponibiliteService.getAll();
      const parId = {};
      (data ?? []).forEach((d) => { parId[d.lotArticleImmobilistationId] = d; });
      setDisponibilites(parId);
    } catch (err) {
      console.error('Erreur chargement disponibilité :', err);
    } finally {
      setLoadingDispo(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { chargerDisponibilites(); }, [chargerDisponibilites]);

  // Score de risque (étape ⑥), chargé indépendamment sur tout le parc suivi.
  const chargerRisques = useCallback(async () => {
    setLoadingRisque(true);
    try {
      const data = await risqueService.getRisques(1000);
      const parId = {};
      (data ?? []).forEach((r) => { parId[r.lotArticleImmobilistationId] = r; });
      setRisques(parId);
    } catch (err) {
      console.error('Erreur chargement risques :', err);
    } finally {
      setLoadingRisque(false);
    }
  }, []);

  useEffect(() => { chargerRisques(); }, [chargerRisques]);

  const recalculerTout = async () => {
    setRecalculant(true);
    setMessage(null);
    try {
      await etatEquipementService.recalculerTout();
      setMessage("États recalculés à partir de l'historique des bons de maintenance.");
      await Promise.all([charger(), chargerDisponibilites(), chargerRisques()]);
    } catch (err) {
      console.error('Erreur recalcul états :', err);
      setMessage("Échec du recalcul. Réessaie plus tard.");
    } finally {
      setRecalculant(false);
    }
  };

  const ouvrirHistorique = async (equipementId) => {
    if (equipementOuvert === equipementId) {
      setEquipementOuvert(null);
      return;
    }
    setEquipementOuvert(equipementId);
    setLoadingHistorique(true);
    try {
      const data = await etatEquipementService.getHistorique(equipementId);
      setHistorique(data ?? []);
    } catch (err) {
      console.error('Erreur chargement historique :', err);
      setHistorique([]);
    } finally {
      setLoadingHistorique(false);
    }
  };

  /**
   * Assigne la criticité d'un équipement. Mise à jour optimiste de la liste locale
   * à partir de la réponse serveur (qui fait foi, y compris si la ligne EtatEquipement
   * vient d'être initialisée côté backend pour un équipement jamais recalculé).
   */
  const changerCriticite = async (lotArticleImmobilistationId, criticite) => {
    setSavingCriticite(lotArticleImmobilistationId);
    try {
      const updated = await etatEquipementService.definirCriticite(
        lotArticleImmobilistationId, criticite
      );
      setEtats((prev) => {
        const existeDeja = prev.some(
          (e) => e.lotArticleImmobilistationId === lotArticleImmobilistationId
        );
        return existeDeja
          ? prev.map((e) =>
              e.lotArticleImmobilistationId === lotArticleImmobilistationId ? updated : e
            )
          : [...prev, updated];
      });
    } catch (err) {
      console.error('Erreur assignation criticité :', err);
      setMessage("Échec de l'enregistrement de la criticité. Réessaie plus tard.");
    } finally {
      setSavingCriticite(null);
    }
  };

  const etatsAffiches = etats
    .filter((e) => filtreEtat === 'TOUS' || e.etatActuel === filtreEtat)
    .filter((e) => !recherche.trim() || (e.cibleNom || '').toLowerCase().includes(recherche.trim().toLowerCase()));

  const compteurs = useMemo(() => {
    return etats.reduce((acc, e) => {
      acc[e.etatActuel] = (acc[e.etatActuel] || 0) + 1;
      return acc;
    }, {});
  }, [etats]);

  const total = etats.length;

  return (
    <div className={`etat-page ${isModal ? 'etat-page--modal' : ''}`}>
      {/* ---------- Header (masqué en mode modale) ---------- */}
      {!isModal && (
        <header className="etat-header">
          <div className="etat-header__text">
            <span className="etat-eyebrow">{t("Équipements · Supervision")}</span>
            <h1>{t("État des équipements")}</h1>
            <p>
              {t("Statut logique calculé automatiquement à chaque événement — création de bon, changement d'état, remise en service — indépendamment de l'état SQL Server legacy.")}
            </p>
          </div>

          <div className="etat-header__actions">
            <button
              className="etat-recalculer-btn"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <span>{settingsOpen ? t("Fermer les paramètres") : t("Maintenance préventive — paramètres")}</span>
            </button>
            <button className="etat-recalculer-btn" onClick={recalculerTout} disabled={recalculant}>
              {recalculant ? <IconSpinner /> : <IconRefresh />}
              <span>{recalculant ? t("Recalcul en cours") : t("Recalculer tout")}</span>
            </button>
          </div>
        </header>
      )}

      {/* ---------- Référentiel des maintenances préventives réglementaires ---------- */}
      {!isModal && settingsOpen && (
        <section style={{ marginBottom: 24 }}>
          <EquipementMaintenanceTypesSettings />
        </section>
      )}

      {/* ---------- Bouton recalcul en mode modale ---------- */}
      {isModal && (
        <div className="etat-modal-toolbar">
          <button className="etat-recalculer-btn" onClick={recalculerTout} disabled={recalculant}>
            {recalculant ? <IconSpinner /> : <IconRefresh />}
            <span>{recalculant ? t("Recalcul en cours") : t("Recalculer tout")}</span>
          </button>
        </div>
      )}

      {/* ---------- Message ---------- */}
      {message && (
        <div className="etat-message">
          <IconInfo />
          <span>{message}</span>
        </div>
      )}

      {/* ---------- Stats ---------- */}
      {!loading && total > 0 && (
        <section className="etat-summary">
          {ETATS.map((et) => {
            const Icon = ETAT_ICONS[et];
            return (
              <div
                key={et}
                className={`etat-summary__item etat-summary__item--${et.toLowerCase()}`}
              >
                <div className="etat-summary__head">
                  <span className="etat-summary__label">{t(ETAT_LABELS[et])}</span>
                  <span className="etat-summary__icon"><Icon /></span>
                </div>
                <span className="etat-summary__nombre">{compteurs[et] || 0}</span>
              </div>
            );
          })}
        </section>
      )}

      {/* ---------- Recherche + filtres ---------- */}
      <div className="etat-filtres">
        <div className="etat-recherche-wrap">
          <span className="etat-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder={t("Rechercher un équipement...")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="etat-recherche"
          />
        </div>

        <div className="etat-filtres-niveau">
          {FILTRES.map(({ key, label }) => (
            <button
              key={key}
              data-etat={key}
              className={`etat-filtre-btn ${filtreEtat === key ? 'etat-filtre-btn--active' : ''}`}
              onClick={() => setFiltreEtat(key)}
            >
              <span className="etat-filtre-btn__dot" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Liste ---------- */}
      {loading ? (
        <p className="etat-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="etat-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : etatsAffiches.length === 0 ? (
        <p className="etat-empty">
          <IconInbox />
          <span>
            {etats.length === 0
              ? t("Aucun état calculé pour le moment — clique sur \"Recalculer tout\" pour initialiser.")
              : t("Aucun équipement ne correspond à ce filtre.")}
          </span>
        </p>
      ) : (
        <ul className="etat-list">
          {etatsAffiches.map((e) => {
            const etatKey = e.etatActuel?.toLowerCase();
            const isOpen = equipementOuvert === e.lotArticleImmobilistationId;
            const jours = e.depuisLe ? joursDepuis(e.depuisLe) : null;
            const dispo = disponibilites[e.lotArticleImmobilistationId];
            const niveauDispo = dispo ? dispoNiveau(dispo.tauxDisponibilitePct) : 'inconnu';
            const risque = risques[e.lotArticleImmobilistationId];
            const niveauRisque = risque ? RISQUE_NIVEAU_CLASS[risque.niveauRisque] : null;
            return (
              <li
                key={e.lotArticleImmobilistationId}
                className={`etat-card etat-card--${etatKey} ${isOpen ? 'is-open' : ''}`}
              >
                <button
                  className="etat-card__header"
                  onClick={() => ouvrirHistorique(e.lotArticleImmobilistationId)}
                >
                  <div className="etat-card__titre-wrap">
                    <span className={`etat-badge ${ETAT_CLASS[e.etatActuel] || ''}`}>
                      <span className="etat-badge__dot" />
                      {t(ETAT_LABELS[e.etatActuel] || e.etatActuel)}
                    </span>
                    <span className="etat-card__titre">{e.cibleNom}</span>
                    {dispo && (
                      <span
                        className={`etat-dispo-pill etat-dispo-pill--${niveauDispo}`}
                        title={t("Taux de disponibilité sur les 12 derniers mois")}
                      >
                        {formatTaux(dispo.tauxDisponibilitePct)} {t("dispo")}
                      </span>
                    )}
                    {risque && (
                      <span
                        className={`etat-risque-pill etat-risque-pill--${niveauRisque}`}
                        title={t("Score de risque de panne (0-100)")}
                      >
                        {t("Risque")} {risque.scoreRisque}
                      </span>
                    )}
                  </div>

                  <span className="etat-card__depuis">
                    {jours !== null && (
                      <>
                        <IconClock />
                        <span>{tp('depuis jours', jours)}</span>
                      </>
                    )}
                    <span className="etat-card__chevron">
                      <IconChevron />
                    </span>
                  </span>
                </button>

                {e.bonMaintenanceReferenceNum && (
                  <p className="etat-card__bon">
                    <IconFile />
                    <span>{t("Bon de référence :")} <strong>{e.bonMaintenanceReferenceNum}</strong></span>
                  </p>
                )}

                <div className="etat-card__criticite" onClick={(ev) => ev.stopPropagation()}>
                  <span
                    className="etat-criticite-dot"
                    style={{ backgroundColor: criticiteHex(e.criticite) }}
                  />
                  <label htmlFor={`criticite-${e.lotArticleImmobilistationId}`}>{t("Criticité")}</label>
                  <select
                    id={`criticite-${e.lotArticleImmobilistationId}`}
                    className="etat-criticite-select"
                    value={e.criticite || CRITICITE_DEFAUT}
                    disabled={savingCriticite === e.lotArticleImmobilistationId}
                    onChange={(ev) =>
                      changerCriticite(e.lotArticleImmobilistationId, ev.target.value)
                    }
                  >
                    {CRITICITE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.label)}</option>
                    ))}
                  </select>
                </div>

                {isOpen && (
                  <div className="etat-historique">
                    <div className="etat-dispo-bloc">
                      <span className="etat-dispo-bloc__title">
                        <IconGauge />
                        {t("Disponibilité (12 derniers mois)")}
                      </span>
                      {loadingDispo && !dispo ? (
                        <p className="etat-dispo-bloc__loading">{t("Calcul en cours...")}</p>
                      ) : dispo ? (
                        <div className="etat-dispo-bloc__grid">
                          <div className="etat-dispo-bloc__item">
                            <span className="etat-dispo-bloc__label">{t("Taux")}</span>
                            <span className={`etat-dispo-bloc__valeur etat-dispo-bloc__valeur--${niveauDispo}`}>
                              {formatTaux(dispo.tauxDisponibilitePct)}
                            </span>
                          </div>
                          <div className="etat-dispo-bloc__item">
                            <span className="etat-dispo-bloc__label">{t("Pannes")}</span>
                            <span className="etat-dispo-bloc__valeur">{dispo.nbPannes}</span>
                          </div>
                          <div className="etat-dispo-bloc__item">
                            <span className="etat-dispo-bloc__label">{t("MTBF")}</span>
                            <span className="etat-dispo-bloc__valeur">{formatDureeHeures(dispo.mtbfHeures)}</span>
                          </div>
                          <div className="etat-dispo-bloc__item">
                            <span className="etat-dispo-bloc__label">{t("MTTR")}</span>
                            <span className="etat-dispo-bloc__valeur">{formatDureeHeures(dispo.mttrHeures)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="etat-dispo-bloc__loading">{t("Disponibilité indisponible pour cet équipement.")}</p>
                      )}
                    </div>

                    <div className="etat-risque-bloc">
                      <span className="etat-dispo-bloc__title">
                        <IconGauge />
                        {t("Risque de panne (score prédictif)")}
                      </span>
                      {loadingRisque && !risque ? (
                        <p className="etat-dispo-bloc__loading">{t("Calcul en cours...")}</p>
                      ) : risque ? (
                        <div className="etat-risque-bloc__content">
                          <span className={`etat-risque-score etat-risque-score--${niveauRisque}`}>
                            {risque.scoreRisque}
                            <small>/100</small>
                          </span>
                          <div className="etat-risque-bloc__grid">
                            <div className="etat-dispo-bloc__item">
                              <span className="etat-dispo-bloc__label">{t("Niveau")}</span>
                              <span className={`etat-dispo-bloc__valeur etat-dispo-bloc__valeur--${niveauRisque}`}>
                                {t(RISQUE_NIVEAU_LABELS[risque.niveauRisque] || risque.niveauRisque)}
                              </span>
                            </div>
                            <div className="etat-dispo-bloc__item">
                              <span className="etat-dispo-bloc__label">{t("Pannes / 12 mois")}</span>
                              <span className="etat-dispo-bloc__valeur">{risque.nbPannes12Mois}</span>
                            </div>
                            <div className="etat-dispo-bloc__item">
                              <span className="etat-dispo-bloc__label">{t("Tendance")}</span>
                              <span className="etat-dispo-bloc__valeur">{t(RISQUE_TENDANCE_LABELS[risque.tendance] || risque.tendance)}</span>
                            </div>
                            <div className="etat-dispo-bloc__item">
                              <span className="etat-dispo-bloc__label">{t("Garantie")}</span>
                              <span className="etat-dispo-bloc__valeur">
                                {risque.garantieExpiree === true ? t("Expirée") : risque.garantieExpiree === false ? t("Active") : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="etat-dispo-bloc__loading">{t("Score de risque indisponible pour cet équipement.")}</p>
                      )}
                    </div>

                    <div className="etat-maintenance-preventive-bloc" onClick={(ev) => ev.stopPropagation()}>
                      <EquipementMaintenancePanel
                        immobilisation={{ id: e.lotArticleImmobilistationId, designation: e.cibleNom }}
                        onOpenBon={(bonId) => { window.location.href = `/bons-maintenance?id=${bonId}`; }}
                      />
                    </div>

                    <div className="etat-historique__toolbar">
                      <span className="etat-historique__title">
                        <IconHistory />
                        {t("Historique des transitions")}
                      </span>
                      <button
                        className="etat-export-btn"
                        onClick={() => exporterHistoriquePDF(e, historique)}
                        disabled={loadingHistorique}
                      >
                        <IconDownload />
                        {t("Exporter en PDF")}
                      </button>
                    </div>

                    {loadingHistorique ? (
                      <p className="etat-empty">{t("Chargement de l'historique...")}</p>
                    ) : historique.length === 0 ? (
                      <p className="etat-empty">{t("Aucune transition enregistrée.")}</p>
                    ) : (
                      <ul className="etat-historique__list">
                        {historique.map((tache) => (
                          <li key={tache.id} className="etat-historique__item">
                            <span className="etat-historique__transition">
                              {tache.etatPrecedent
                                ? <>{t(ETAT_LABELS[tache.etatPrecedent] || tache.etatPrecedent)} <span className="rtl-miroir">→</span> </>
                                : t("Première détection : ")}
                              <strong>{t(ETAT_LABELS[tache.etatNouveau] || tache.etatNouveau)}</strong>
                            </span>
                            <span className="etat-historique__date">
                              {formatDateTime(tache.dateTransition)}
                            </span>
                            {tache.bonMaintenanceNum && (
                              <span className="etat-historique__bon">
                                {t("Bon")} {tache.bonMaintenanceNum}
                              </span>
                            )}
                            {tache.motif && (
                              <span className="etat-historique__motif">« {tache.motif} »</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}