import React, { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import equipementService from '../../../services/equipementService';
import ScannerQR from '../Equipements/ScannerQR';
import { imprimerEtiquettes } from '../Equipements/qrEtiquettes';
import etatEquipementService from '../../../services/Etatequipementservice';
import disponibiliteService from '../../../services/Disponibiliteservice ';
import risqueService from '../../../services/Risqueservice';
import { CRITICITE_OPTIONS, CRITICITE_DEFAUT, criticiteHex } from '../../../constants/Criticite';
import EquipementMaintenancePanel from './Equipementmaintenancepanel';
import EquipementMaintenanceTypesSettings from './EquipementMaintenanceTypesSettings';
import { t, tp, locale, tPdf, localePdf } from '../../../i18n';
import './EtatEquipement.css';
import '../Equipements/Equipements.css';

/* ---------- Risque ---------- */
const RISQUE_NIVEAU_LABELS = { CRITIQUE: 'Critique', ELEVE: 'Élevé', MODERE: 'Modéré', FAIBLE: 'Faible' };
const RISQUE_NIVEAU_CLASS = { CRITIQUE: 'critique', ELEVE: 'eleve', MODERE: 'modere', FAIBLE: 'faible' };
const RISQUE_TENDANCE_LABELS = { HAUSSE: 'En hausse', BAISSE: 'En baisse', STABLE: 'Stable' };

/* ---------- Disponibilité ---------- */
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
  EN_SERVICE: 'ee-badge--service',
  EN_PANNE: 'ee-badge--panne',
  EN_REPARATION: 'ee-badge--reparation',
  HORS_SERVICE: 'ee-badge--horsservice',
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
  <svg className="ee-spinner" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);
const IconSearch = () => (
  <Svg size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
const IconChevron = () => (<Svg size={14}><path d="m6 9 6 6 6-6" /></Svg>);
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
const IconSettings = () => (
  <Svg size={15}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);
const IconPrint = () => (
  <Svg size={15}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Svg>
);
const IconQr = () => (
  <Svg size={15}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM21 14v3M14 21h3M21 21h.01" />
  </Svg>
);
const IconClose = () => (<Svg size={14}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
const IconArrowRight = () => (<Svg size={13}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);

const ETAT_ICONS = {
  EN_SERVICE: IconCheckCircle,
  EN_PANNE: IconXCircle,
  EN_REPARATION: IconWrench,
  HORS_SERVICE: IconPause,
};

/* ---------- Export PDF ---------- */
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
    if (y > 280) { doc.addPage(); y = 20; }
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
  const navigate = useNavigate();
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
  const [selection, setSelection] = useState(() => new Map());
  const [scanner, setScanner] = useState(false);
  const [impression, setImpression] = useState(false);

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

  const basculerSelection = (id, nom) => setSelection((s) => {
    const n = new Map(s);
    if (n.has(id)) n.delete(id); else n.set(id, nom);
    return n;
  });

  const imprimerSelection = async () => {
    setImpression(true);
    try {
      const lignes = await Promise.all([...selection.entries()].map(async ([id, nom]) => {
        try {
          const f = await equipementService.getFiche(id);
          return { id, designation: f?.identite?.designation || nom, marque: f?.identite?.marque, modele: f?.identite?.modele, numPiece: f?.identite?.numPiece, codeBarre: f?.identite?.codeBarre };
        } catch {
          return { id, designation: nom };
        }
      }));
      await imprimerEtiquettes(lignes);
    } finally {
      setImpression(false);
    }
  };

  const fermerScanner = useCallback(() => setScanner(false), []);

  // Recherche insensible à la casse et aux accents, sur le nom et le n° de l'équipement ;
  // plusieurs mots : chacun doit être présent (« moniteur rea » trouve « Moniteur réanimation »).
  const sansAccents = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const motsRecherche = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const correspond = (e) => {
    if (motsRecherche.length === 0) return true;
    const texte = sansAccents([e.cibleNom, e.lotArticleImmobilistationId, e.bonMaintenanceReferenceNum].filter((x) => x != null).join(' '));
    return motsRecherche.every((m) => texte.includes(m.replace(/^#/, '')));
  };

  // Un seul état par équipement (au cas où le serveur en renverrait deux pour le même)
  const etatsUniques = useMemo(() => {
    const parId = new Map();
    etats.forEach((e) => {
      const id = e.lotArticleImmobilistationId;
      const deja = parId.get(id);
      if (!deja || String(e.derniereMiseAJour || '') > String(deja.derniereMiseAJour || '')) parId.set(id, e);
    });
    return [...parId.values()];
  }, [etats]);

  const etatsAffiches = etatsUniques
    .filter((e) => filtreEtat === 'TOUS' || e.etatActuel === filtreEtat)
    .filter(correspond);

  const compteurs = useMemo(() => {
    return etatsUniques.reduce((acc, e) => {
      acc[e.etatActuel] = (acc[e.etatActuel] || 0) + 1;
      return acc;
    }, {});
  }, [etatsUniques]);

  const total = etatsUniques.length;

  return (
    <div className={`ee-page ${isModal ? 'ee-page--modal' : ''}`}>
      {!isModal && (
        <header className="ee-header">
          <div className="ee-header__text">
            <h1>{t("Équipements")}</h1>
            <p>{t("État, fiche, historique des pannes, documents et étiquettes QR")}</p>
          </div>

          <div className="ee-header__actions">
            <button
              className="ee-btn ee-btn--secondaire"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <IconSettings />
              <span>{settingsOpen ? t("Fermer les paramètres") : t("Paramètres préventifs")}</span>
            </button>
            <button
              className="ee-btn ee-btn--primaire"
              onClick={recalculerTout}
              disabled={recalculant}
            >
              {recalculant ? <IconSpinner /> : <IconRefresh />}
              <span>{recalculant ? t("Recalcul en cours") : t("Recalculer tout")}</span>
            </button>
          </div>
        </header>
      )}

      {!isModal && settingsOpen && (
        <section style={{ marginBottom: 24 }}>
          <EquipementMaintenanceTypesSettings />
        </section>
      )}

      {isModal && (
        <div className="ee-action-bar">
          <div className="ee-action-bar__group">
            <span className="ee-action-bar__pill">{t("États calculés")}</span>
          </div>
          <div className="ee-action-bar__group">
            <button
              className="ee-btn ee-btn--primaire"
              onClick={recalculerTout}
              disabled={recalculant}
            >
              {recalculant ? <IconSpinner /> : <IconRefresh />}
              <span>{recalculant ? t("Recalcul en cours") : t("Recalculer tout")}</span>
            </button>
          </div>
        </div>
      )}

      <div className="ee-action-bar">
        <div className="ee-action-bar__group">
          {selection.size > 0 ? (
            <span className="ee-action-bar__pill">
              {tp('étiquette sélectionnée', selection.size)}
            </span>
          ) : (
            <span className="ee-action-bar__hint">
              {t('Sélectionnez des équipements pour imprimer leurs étiquettes.')}
            </span>
          )}
        </div>

        <div className="ee-action-bar__group">
          {selection.size > 0 && (
            <button
              type="button"
              className="ee-btn ee-btn--ghost ee-btn--sm"
              onClick={() => setSelection(new Map())}
            >
              <IconClose /> {t('Vider')}
            </button>
          )}

          {selection.size > 0 && (
            <button
              type="button"
              className="ee-btn ee-btn--primaire"
              onClick={imprimerSelection}
              disabled={impression}
            >
              {impression ? <IconSpinner /> : <IconPrint />}
              <span>
                {impression ? t('Impression...') : tp('Imprimer les étiquettes', selection.size)}
              </span>
            </button>
          )}

          <button
            type="button"
            className="ee-btn ee-btn--secondaire"
            onClick={() => setScanner(true)}
          >
            <IconQr />
            <span>{t('Scanner un QR code')}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="ee-message">
          <IconInfo />
          <span>{message}</span>
        </div>
      )}

      {!loading && total > 0 && (
        <section className="ee-summary">
          {ETATS.map((et) => {
            const Icon = ETAT_ICONS[et];
            return (
              <div
                key={et}
                className={`ee-summary__item ee-summary__item--${et.toLowerCase()}`}
              >
                <div className="ee-summary__head">
                  <span className="ee-summary__label">{t(ETAT_LABELS[et])}</span>
                  <span className="ee-summary__icon"><Icon /></span>
                </div>
                <span className="ee-summary__nombre">{compteurs[et] || 0}</span>
              </div>
            );
          })}
        </section>
      )}

      <div className="ee-filtres">
        <div className="ee-recherche-wrap">
          <span className="ee-recherche-icon"><IconSearch /></span>
          <input
            type="text"
            placeholder={t("Rechercher un équipement...")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="ee-recherche"
          />
        </div>

        <div className="ee-filtres-niveau">
          {FILTRES.map(({ key, label }) => (
            <button
              key={key}
              data-etat={key}
              className={`ee-filtre-btn ${filtreEtat === key ? 'ee-filtre-btn--active' : ''}`}
              onClick={() => setFiltreEtat(key)}
            >
              <span className="ee-filtre-btn__dot" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="ee-empty">{t("Chargement...")}</p>
      ) : error ? (
        <p className="ee-error">
          <IconAlert />
          <span>{error}</span>
        </p>
      ) : etatsAffiches.length === 0 ? (
        <p className="ee-empty">
          <IconInbox />
          <span>
            {etats.length === 0
              ? t("Aucun état calculé pour le moment — clique sur \"Recalculer tout\" pour initialiser.")
              : t("Aucun équipement ne correspond à ce filtre.")}
          </span>
        </p>
      ) : (
        <ul className="ee-list">
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
                className={`ee-card ee-card--${etatKey} ${isOpen ? 'is-open' : ''}`}
              >
                <button
                  className="ee-card__header"
                  onClick={() => ouvrirHistorique(e.lotArticleImmobilistationId)}
                >
                  <div className="ee-card__titre-wrap">
                    <span className={`ee-badge ${ETAT_CLASS[e.etatActuel] || ''}`}>
                      <span className="ee-badge__dot" />
                      {t(ETAT_LABELS[e.etatActuel] || e.etatActuel)}
                    </span>
                    <span className="ee-card__titre">{e.cibleNom}</span>
                    {dispo && (
                      <span
                        className={`ee-dispo-pill ee-dispo-pill--${niveauDispo}`}
                        title={t("Taux de disponibilité sur les 12 derniers mois")}
                      >
                        {formatTaux(dispo.tauxDisponibilitePct)} {t("dispo")}
                      </span>
                    )}
                    {risque && (
                      <span
                        className={`ee-risque-pill ee-risque-pill--${niveauRisque}`}
                        title={t("Score de risque de panne (0-100)")}
                      >
                        {t("Risque")} {risque.scoreRisque}
                      </span>
                    )}
                  </div>

                  <span className="ee-card__depuis">
                    {jours !== null && (
                      <>
                        <IconClock />
                        <span>{tp('depuis jours', jours)}</span>
                      </>
                    )}
                    <span className="ee-card__chevron">
                      <IconChevron />
                    </span>
                  </span>
                </button>

                {e.bonMaintenanceReferenceNum && (
                  <p className="ee-card__bon">
                    <IconFile />
                    <span>{t("Bon de référence :")} <strong>{e.bonMaintenanceReferenceNum}</strong></span>
                  </p>
                )}

                <div className="ee-card__criticite" onClick={(ev) => ev.stopPropagation()}>
                  <label className="ee-case" title={t('Ajouter à l’impression des étiquettes')}>
                    <input
                      type="checkbox"
                      checked={selection.has(e.lotArticleImmobilistationId)}
                      onChange={() => basculerSelection(e.lotArticleImmobilistationId, e.cibleNom)}
                      aria-label={t('Sélectionner {nom}', { nom: e.cibleNom || `#${e.lotArticleImmobilistationId}` })}
                    />
                  </label>
                  <span
                    className="ee-criticite-dot"
                    style={{ backgroundColor: criticiteHex(e.criticite) }}
                  />
                  <label htmlFor={`criticite-${e.lotArticleImmobilistationId}`}>{t("Criticité")}</label>
                  <select
                    id={`criticite-${e.lotArticleImmobilistationId}`}
                    className="ee-criticite-select"
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
                  <button
                    type="button"
                    className="ee-card__fiche"
                    onClick={() => navigate(`/equipement/${e.lotArticleImmobilistationId}`)}
                  >
                    <span>{t("Voir la fiche")}</span>
                    <IconArrowRight />
                  </button>
                </div>

                {isOpen && (
                  <div className="ee-historique">
                    <div className="ee-dispo-bloc">
                      <span className="ee-dispo-bloc__title">
                        <IconGauge />
                        {t("Disponibilité (12 derniers mois)")}
                      </span>
                      {loadingDispo && !dispo ? (
                        <p className="ee-dispo-bloc__loading">{t("Calcul en cours...")}</p>
                      ) : dispo ? (
                        <div className="ee-dispo-bloc__grid">
                          <div className="ee-dispo-bloc__item">
                            <span className="ee-dispo-bloc__label">{t("Taux")}</span>
                            <span className={`ee-dispo-bloc__valeur ee-dispo-bloc__valeur--${niveauDispo}`}>
                              {formatTaux(dispo.tauxDisponibilitePct)}
                            </span>
                          </div>
                          <div className="ee-dispo-bloc__item">
                            <span className="ee-dispo-bloc__label">{t("Pannes")}</span>
                            <span className="ee-dispo-bloc__valeur">{dispo.nbPannes}</span>
                          </div>
                          <div className="ee-dispo-bloc__item">
                            <span className="ee-dispo-bloc__label">{t("MTBF")}</span>
                            <span className="ee-dispo-bloc__valeur">{formatDureeHeures(dispo.mtbfHeures)}</span>
                          </div>
                          <div className="ee-dispo-bloc__item">
                            <span className="ee-dispo-bloc__label">{t("MTTR")}</span>
                            <span className="ee-dispo-bloc__valeur">{formatDureeHeures(dispo.mttrHeures)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="ee-dispo-bloc__loading">{t("Disponibilité indisponible pour cet équipement.")}</p>
                      )}
                    </div>

                    <div className="ee-risque-bloc">
                      <span className="ee-dispo-bloc__title">
                        <IconGauge />
                        {t("Risque de panne (score prédictif)")}
                      </span>
                      {loadingRisque && !risque ? (
                        <p className="ee-dispo-bloc__loading">{t("Calcul en cours...")}</p>
                      ) : risque ? (
                        <div className="ee-risque-bloc__content">
                          <span className={`ee-risque-score ee-risque-score--${niveauRisque}`}>
                            {risque.scoreRisque}
                            <small>/100</small>
                          </span>
                          <div className="ee-risque-bloc__grid">
                            <div className="ee-dispo-bloc__item">
                              <span className="ee-dispo-bloc__label">{t("Niveau")}</span>
                              <span className={`ee-dispo-bloc__valeur ee-dispo-bloc__valeur--${niveauRisque}`}>
                                {t(RISQUE_NIVEAU_LABELS[risque.niveauRisque] || risque.niveauRisque)}
                              </span>
                            </div>
                            <div className="ee-dispo-bloc__item">
                              <span className="ee-dispo-bloc__label">{t("Pannes / 12 mois")}</span>
                              <span className="ee-dispo-bloc__valeur">{risque.nbPannes12Mois}</span>
                            </div>
                            <div className="ee-dispo-bloc__item">
                              <span className="ee-dispo-bloc__label">{t("Tendance")}</span>
                              <span className="ee-dispo-bloc__valeur">{t(RISQUE_TENDANCE_LABELS[risque.tendance] || risque.tendance)}</span>
                            </div>
                            <div className="ee-dispo-bloc__item">
                              <span className="ee-dispo-bloc__label">{t("Garantie")}</span>
                              <span className="ee-dispo-bloc__valeur">
                                {risque.garantieExpiree === true ? t("Expirée") : risque.garantieExpiree === false ? t("Active") : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="ee-dispo-bloc__loading">{t("Score de risque indisponible pour cet équipement.")}</p>
                      )}
                    </div>

                    <div className="etat-maintenance-preventive-bloc" onClick={(ev) => ev.stopPropagation()}>
                      <EquipementMaintenancePanel
                        immobilisation={{ id: e.lotArticleImmobilistationId, designation: e.cibleNom }}
                        onOpenBon={(bonId) => { window.location.href = `/bons-maintenance?id=${bonId}`; }}
                      />
                    </div>

                    <div className="ee-historique__toolbar">
                      <span className="ee-historique__title">
                        <IconHistory />
                        {t("Historique des transitions")}
                      </span>
                      <button
                        className="ee-export-btn"
                        onClick={() => exporterHistoriquePDF(e, historique)}
                        disabled={loadingHistorique}
                      >
                        <IconDownload />
                        {t("Exporter en PDF")}
                      </button>
                    </div>

                    {loadingHistorique ? (
                      <p className="ee-empty">{t("Chargement de l'historique...")}</p>
                    ) : historique.length === 0 ? (
                      <p className="ee-empty">{t("Aucune transition enregistrée.")}</p>
                    ) : (
                      <ul className="ee-historique__list">
                        {historique.map((tache) => (
                          <li key={tache.id} className="ee-historique__item">
                            <span className="ee-historique__transition">
                              {tache.etatPrecedent
                                ? <>{t(ETAT_LABELS[tache.etatPrecedent] || tache.etatPrecedent)} <span className="rtl-miroir">→</span> </>
                                : t("Première détection : ")}
                              <strong>{t(ETAT_LABELS[tache.etatNouveau] || tache.etatNouveau)}</strong>
                            </span>
                            <span className="ee-historique__date">
                              {formatDateTime(tache.dateTransition)}
                            </span>
                            {tache.bonMaintenanceNum && (
                              <span className="ee-historique__bon">
                                {t("Bon")} {tache.bonMaintenanceNum}
                              </span>
                            )}
                            {tache.motif && (
                              <span className="ee-historique__motif">« {tache.motif} »</span>
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

      {scanner && <ScannerQR onClose={fermerScanner} />}
    </div>
  );
}