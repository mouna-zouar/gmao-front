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
import { ArrowRight, ChevronDown, Network, CircleCheck, CirclePause, CircleX, Clock, Download, File, Gauge, History, LoaderCircle, Printer, QrCode, RefreshCw, Search, Settings, TriangleAlert, Wrench, X } from 'lucide-react';
import { VeillePage, VeilleKpis, VeilleSegments, VeilleVide, VeilleMessage, Panneau, Pastille, Jauge } from '../../ui/Veille/Veille';

/* ---------- Risque ---------- */
const RISQUE_NIVEAU_LABELS = { CRITIQUE: 'Critique', ELEVE: 'Élevé', MODERE: 'Modéré', FAIBLE: 'Faible' };
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
const ETATS = ['EN_SERVICE', 'EN_PANNE', 'EN_REPARATION', 'HORS_SERVICE'];
// Même échelle de couleurs que les autres écrans de veille
const ETAT_TON = { EN_SERVICE: 'succes', EN_PANNE: 'danger', EN_REPARATION: 'info', HORS_SERVICE: 'orange' };
const RISQUE_TON = { CRITIQUE: 'danger', ELEVE: 'orange', MODERE: 'attention', FAIBLE: 'succes' };
const DISPO_TON = { bon: 'succes', moyen: 'attention', critique: 'danger', inconnu: 'neutre' };

/* ---------- Utils ---------- */
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
const IconRefresh = () => (
  <RefreshCw size={15} aria-hidden="true" />
);
const IconSpinner = () => (
  <LoaderCircle size={15} strokeWidth={2.5} className="ee-spinner" aria-hidden="true" />
);
const IconSearch = () => (
  <Search size={15} aria-hidden="true" />
);
const IconChevron = () => (<ChevronDown size={14} aria-hidden="true" />);
const IconCheckCircle = () => (
  <CircleCheck size={15} aria-hidden="true" />
);
const IconXCircle = () => (
  <CircleX size={15} aria-hidden="true" />
);
const IconWrench = () => (
  <Wrench size={15} aria-hidden="true" />
);
const IconPause = () => (
  <CirclePause size={15} aria-hidden="true" />
);
const IconFile = () => (
  <File size={13} aria-hidden="true" />
);
const IconDownload = () => (
  <Download size={13} aria-hidden="true" />
);
const IconClock = () => (
  <Clock size={13} aria-hidden="true" />
);
const IconHistory = () => (
  <History size={13} aria-hidden="true" />
);
const IconSettings = () => (
  <Settings size={15} aria-hidden="true" />
);
const IconPrint = () => (
  <Printer size={15} aria-hidden="true" />
);
const IconQr = () => (
  <QrCode size={15} aria-hidden="true" />
);
const IconClose = () => (<X size={14} aria-hidden="true" />);
const IconArrowRight = () => (<ArrowRight size={13} aria-hidden="true" />);

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
  // Adresse IP des équipements (fiche équipement → « Connexion réseau ») : filtre Avec / Sans IP
  const [connexions, setConnexions] = useState({});
  const [filtreIp, setFiltreIp] = useState('TOUS');
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

  const chargerConnexions = useCallback(async () => {
    try {
      const data = await equipementService.listeConnexions();
      const parId = {};
      (data ?? []).forEach((c) => { parId[c.lotArticleImmobilistationId] = c; });
      setConnexions(parId);
    } catch (err) {
      console.error('Erreur chargement des adresses IP :', err);
    }
  }, []);

  useEffect(() => { chargerConnexions(); }, [chargerConnexions]);

  const recalculerTout = async () => {
    setRecalculant(true);
    setMessage(null);
    try {
      await etatEquipementService.recalculerTout();
      setMessage("États recalculés à partir de l'historique des bons de maintenance.");
      await Promise.all([charger(), chargerDisponibilites(), chargerRisques(), chargerConnexions()]);
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
    const texte = sansAccents([e.cibleNom, e.lotArticleImmobilistationId, e.bonMaintenanceReferenceNum, connexions[e.lotArticleImmobilistationId]?.adresseIp].filter((x) => x != null).join(' '));
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

  const aUneIp = (e) => !!connexions[e.lotArticleImmobilistationId];
  // Hors ligne : déclaré par la surveillance automatique (plusieurs tests ratés d'affilée)
  const estHorsLigne = (e) => !!connexions[e.lotArticleImmobilistationId]?.horsLigneDepuis;
  const nbAvecIp = etatsUniques.filter(aUneIp).length;
  const nbHorsLigne = etatsUniques.filter(estHorsLigne).length;

  const etatsAffiches = etatsUniques
    .filter((e) => filtreEtat === 'TOUS' || e.etatActuel === filtreEtat)
    .filter((e) => filtreIp === 'TOUS'
      || (filtreIp === 'AVEC' && aUneIp(e))
      || (filtreIp === 'SANS' && !aUneIp(e))
      || (filtreIp === 'HORS_LIGNE' && estHorsLigne(e)))
    .filter(correspond);

  const compteurs = useMemo(() => {
    return etatsUniques.reduce((acc, e) => {
      acc[e.etatActuel] = (acc[e.etatActuel] || 0) + 1;
      return acc;
    }, {});
  }, [etatsUniques]);

  const total = etatsUniques.length;

  // Sélection de toutes les lignes visibles (impression des étiquettes)
  const tousCoches = etatsAffiches.length > 0 && etatsAffiches.every((e) => selection.has(e.lotArticleImmobilistationId));
  const basculerTout = () => setSelection((s) => {
    const n = new Map(s);
    if (tousCoches) etatsAffiches.forEach((e) => n.delete(e.lotArticleImmobilistationId));
    else etatsAffiches.forEach((e) => n.set(e.lotArticleImmobilistationId, e.cibleNom));
    return n;
  });

  const boutonRecalcul = (
    <button type="button" className="vl-btn vl-btn--primaire" onClick={recalculerTout} disabled={recalculant}>
      {recalculant ? <IconSpinner /> : <IconRefresh />}
      <span>{recalculant ? t("Recalcul en cours") : t("Recalculer tout")}</span>
    </button>
  );

  return (
    <VeillePage
      isModal={isModal}
      icone={Gauge}
      titre={t("Équipements")}
      description={t("État, fiche, historique des pannes, documents et étiquettes QR")}
      actions={(
        <>
          <button type="button" className="vl-btn" onClick={() => setSettingsOpen((v) => !v)}>
            <IconSettings />
            <span>{settingsOpen ? t("Fermer les paramètres") : t("Paramètres préventifs")}</span>
          </button>
          {boutonRecalcul}
        </>
      )}
    >
      {!isModal && settingsOpen && (
        <section>
          <EquipementMaintenanceTypesSettings />
        </section>
      )}

      {!loading && total > 0 && (
        <VeilleKpis
          label={t("Équipements par état")}
          items={[
            { cle: 'TOUS', label: t("Tous"), valeur: total, ton: 'marque', actif: filtreEtat === 'TOUS', onClick: () => setFiltreEtat('TOUS') },
            ...ETATS.map((et) => ({
              cle: et,
              label: t(ETAT_LABELS[et]),
              valeur: compteurs[et] || 0,
              ton: ETAT_TON[et],
              actif: filtreEtat === et,
              onClick: () => setFiltreEtat((v) => (v === et ? 'TOUS' : et)),
            })),
          ]}
        />
      )}

      <div className="vl-barre">
        <div className="vl-barre__gauche" style={{ flex: '1 1 320px' }}>
          <label className="vl-recherche">
            <IconSearch />
            <input
              type="search"
              placeholder={t("Rechercher un équipement...")}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label={t("Rechercher un équipement...")}
            />
          </label>
          <VeilleSegments
            label={t("Filtrer par adresse IP")}
            valeur={filtreIp}
            onChange={setFiltreIp}
            options={[
              { cle: 'TOUS', label: t('Tous'), n: etatsUniques.length },
              { cle: 'AVEC', label: t('Avec adresse IP'), n: nbAvecIp },
              { cle: 'SANS', label: t('Sans adresse IP'), n: etatsUniques.length - nbAvecIp },
              ...(nbHorsLigne > 0 || filtreIp === 'HORS_LIGNE' ? [{ cle: 'HORS_LIGNE', label: t('Hors ligne'), n: nbHorsLigne }] : []),
            ]}
          />
        </div>
        <div className="vl-barre__droite">
          {selection.size > 0 && (
            <>
              <Pastille ton="marque">{tp('étiquette sélectionnée', selection.size)}</Pastille>
              <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" onClick={() => setSelection(new Map())}>
                <IconClose /> {t('Vider')}
              </button>
              <button type="button" className="vl-btn" onClick={imprimerSelection} disabled={impression}>
                {impression ? <IconSpinner /> : <IconPrint />}
                <span>{impression ? t('Impression...') : tp('Imprimer les étiquettes', selection.size)}</span>
              </button>
            </>
          )}
          <button type="button" className="vl-btn" onClick={() => setScanner(true)}>
            <IconQr />
            <span>{t('Scanner un QR code')}</span>
          </button>
          {isModal && boutonRecalcul}
        </div>
      </div>

      {message && <VeilleMessage onFermer={() => setMessage(null)}>{t(message)}</VeilleMessage>}

      {loading ? (
        <div className="vl-chargement"><IconSpinner /> {t("Chargement...")}</div>
      ) : error ? (
        <VeilleMessage ton="danger">{error}</VeilleMessage>
      ) : etatsAffiches.length === 0 ? (
        <div className="vl-liste">
          <VeilleVide>
            {etats.length === 0
              ? t("Aucun état calculé pour le moment — clique sur \"Recalculer tout\" pour initialiser.")
              : t("Aucun équipement ne correspond à ce filtre.")}
          </VeilleVide>
        </div>
      ) : (
        <ul className="vl-liste vl-eq">
          <li className="vl-ligne vl-ligne--tete" aria-hidden="false">
            <label className="vl-eq__case" title={t('Tout sélectionner pour les étiquettes')}>
              <input type="checkbox" checked={tousCoches} onChange={basculerTout} aria-label={t('Tout sélectionner pour les étiquettes')} />
            </label>
            <span>{t("Équipement")}</span>
            <span>{t("Disponibilité")}</span>
            <span>{t("Risque")}</span>
            <span>{t("Criticité")}</span>
            <span />
          </li>
          {etatsAffiches.map((e) => {
            const id = e.lotArticleImmobilistationId;
            const isOpen = equipementOuvert === id;
            const jours = e.depuisLe ? joursDepuis(e.depuisLe) : null;
            const dispo = disponibilites[id];
            const niveauDispo = dispo ? dispoNiveau(dispo.tauxDisponibilitePct) : 'inconnu';
            const risque = risques[id];
            const tonRisque = risque ? RISQUE_TON[risque.niveauRisque] : 'neutre';
            const ton = ETAT_TON[e.etatActuel] || 'neutre';
            const EtatIcone = ETAT_ICONS[e.etatActuel];
            return (
              <li key={id} className={`vl-eq__item ${isOpen ? 'is-ouvert' : ''}`}>
                <div className="vl-ligne" data-ton={ton}>
                  <label className="vl-eq__case" title={t('Ajouter à l’impression des étiquettes')}>
                    <input
                      type="checkbox"
                      checked={selection.has(id)}
                      onChange={() => basculerSelection(id, e.cibleNom)}
                      aria-label={t('Sélectionner {nom}', { nom: e.cibleNom || `#${id}` })}
                    />
                  </label>

                  <div className="vl-ligne__principal">
                    <div className="vl-ligne__titre-ligne">
                      <button
                        type="button"
                        className="vl-ligne__titre"
                        onClick={() => ouvrirHistorique(id)}
                        aria-expanded={isOpen}
                        title={e.cibleNom}
                      >
                        {e.cibleNom}
                      </button>
                    </div>
                    <div className="vl-ligne__sous">
                      <Pastille ton={ton}>
                        {EtatIcone && <EtatIcone />}
                        {t(ETAT_LABELS[e.etatActuel] || e.etatActuel)}
                      </Pastille>
                      {jours !== null && <span><IconClock /> {tp('depuis jours', jours)}</span>}
                      {e.bonMaintenanceReferenceNum && (
                        <span><IconFile /> {t("Bon")} <strong>{e.bonMaintenanceReferenceNum}</strong></span>
                      )}
                      {connexions[id] && (() => {
                        const c = connexions[id];
                        const etatCnx = c.horsLigneDepuis ? t('Hors ligne depuis le {date}', { date: new Date(c.horsLigneDepuis).toLocaleString(locale()) })
                          : c.dernierResultat === 'EN_LIGNE' ? t('En ligne') : c.dernierResultat === 'HORS_LIGNE' ? t('Hors ligne') : t('Jamais testé');
                        const classe = c.horsLigneDepuis ? 'hors_ligne' : (c.dernierResultat || 'inconnu').toLowerCase();
                        return (
                          <span className={`vl-eq__ip vl-eq__ip--${classe}`} title={`${t('Adresse IP')} · ${etatCnx}`}>
                            <Network size={12} aria-hidden="true" />
                            <strong>{c.adresseIp}{c.port ? `:${c.port}` : ''}</strong>
                            <span className="vl-eq__ip-point" aria-label={etatCnx} />
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="vl-mesure" data-ton={DISPO_TON[niveauDispo]} title={t("Taux de disponibilité sur les 12 derniers mois")}>
                    {dispo ? (
                      <>
                        <span className="vl-mesure__valeur">{formatTaux(dispo.tauxDisponibilitePct)}</span>
                        <Jauge valeur={dispo.tauxDisponibilitePct} ton={DISPO_TON[niveauDispo]} label={t("Disponibilité")} />
                      </>
                    ) : <span className="vl-mesure__note">—</span>}
                  </div>

                  <div title={t("Score de risque de panne (0-100)")}>
                    {risque ? (
                      <span className="vl-eq__risque" data-ton={tonRisque}>
                        <span className="vl-score" data-ton={tonRisque} style={{ '--score': risque.scoreRisque }}>
                          <span>{risque.scoreRisque}</span>
                        </span>
                        <span className="vl-mesure__note">{t(RISQUE_NIVEAU_LABELS[risque.niveauRisque] || risque.niveauRisque)}</span>
                      </span>
                    ) : <span className="vl-mesure__note">—</span>}
                  </div>

                  <div className="vl-eq__criticite">
                    <span className="vl-eq__point" style={{ backgroundColor: criticiteHex(e.criticite) }} aria-hidden="true" />
                    <select
                      id={`criticite-${id}`}
                      value={e.criticite || CRITICITE_DEFAUT}
                      disabled={savingCriticite === id}
                      onChange={(ev) => changerCriticite(id, ev.target.value)}
                      aria-label={t('Criticité de {nom}', { nom: e.cibleNom || `#${id}` })}
                    >
                      {CRITICITE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{t(o.label)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="vl-actions">
                    <button type="button" className="vl-btn vl-btn--petit" onClick={() => navigate(`/equipement/${id}`)}>
                      {t("Fiche")} <IconArrowRight />
                    </button>
                    <button
                      type="button"
                      className={`vl-btn vl-btn--petit vl-btn--icone vl-eq__chevron ${isOpen ? 'is-ouvert' : ''}`}
                      onClick={() => ouvrirHistorique(id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? t("Masquer le détail") : t("Afficher le détail")}
                    >
                      <IconChevron />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="vl-eq__detail">
                    <div className="vl-eq__blocs">
                      <Panneau icone={Gauge} titre={t("Disponibilité (12 derniers mois)")} ton={DISPO_TON[niveauDispo]}>
                        {loadingDispo && !dispo ? (
                          <p className="vl-mesure__note">{t("Calcul en cours...")}</p>
                        ) : dispo ? (
                          <div className="vl-eq__chiffres">
                            <div><span>{t("Taux")}</span><strong data-ton={DISPO_TON[niveauDispo]}>{formatTaux(dispo.tauxDisponibilitePct)}</strong></div>
                            <div><span>{t("Pannes")}</span><strong>{dispo.nbPannes}</strong></div>
                            <div><span>{t("MTBF")}</span><strong>{formatDureeHeures(dispo.mtbfHeures)}</strong></div>
                            <div><span>{t("MTTR")}</span><strong>{formatDureeHeures(dispo.mttrHeures)}</strong></div>
                          </div>
                        ) : (
                          <p className="vl-mesure__note">{t("Disponibilité indisponible pour cet équipement.")}</p>
                        )}
                      </Panneau>

                      <Panneau icone={TriangleAlert} titre={t("Risque de panne (score prédictif)")} ton={tonRisque}>
                        {loadingRisque && !risque ? (
                          <p className="vl-mesure__note">{t("Calcul en cours...")}</p>
                        ) : risque ? (
                          <div className="vl-eq__chiffres">
                            <div><span>{t("Score")}</span><strong data-ton={tonRisque}>{risque.scoreRisque}<small>/100</small></strong></div>
                            <div><span>{t("Pannes / 12 mois")}</span><strong>{risque.nbPannes12Mois}</strong></div>
                            <div><span>{t("Tendance")}</span><strong>{t(RISQUE_TENDANCE_LABELS[risque.tendance] || risque.tendance)}</strong></div>
                            <div><span>{t("Garantie")}</span><strong>{risque.garantieExpiree === true ? t("Expirée") : risque.garantieExpiree === false ? t("Active") : '—'}</strong></div>
                          </div>
                        ) : (
                          <p className="vl-mesure__note">{t("Score de risque indisponible pour cet équipement.")}</p>
                        )}
                      </Panneau>
                    </div>

                    <div className="vl-eq__preventif" onClick={(ev) => ev.stopPropagation()}>
                      <EquipementMaintenancePanel
                        immobilisation={{ id, designation: e.cibleNom }}
                        onOpenBon={(bonId) => { window.location.href = `/bons-maintenance?id=${bonId}`; }}
                      />
                    </div>

                    <Panneau
                      icone={History}
                      titre={t("Historique des transitions")}
                      n={loadingHistorique ? null : historique.length}
                      actions={(
                        <button type="button" className="vl-btn vl-btn--petit" onClick={() => exporterHistoriquePDF(e, historique)} disabled={loadingHistorique}>
                          <IconDownload /> {t("Exporter en PDF")}
                        </button>
                      )}
                    >
                      {loadingHistorique ? (
                        <div className="vl-chargement"><IconSpinner /> {t("Chargement de l'historique...")}</div>
                      ) : historique.length === 0 ? (
                        <p className="vl-mesure__note">{t("Aucune transition enregistrée.")}</p>
                      ) : (
                        <ol className="vl-eq__frise">
                          {historique.map((tache) => (
                            <li key={tache.id} data-ton={ETAT_TON[tache.etatNouveau] || 'neutre'}>
                              <span className="vl-eq__frise-point" aria-hidden="true" />
                              <div>
                                <span className="vl-eq__frise-titre">
                                  {tache.etatPrecedent
                                    ? <>{t(ETAT_LABELS[tache.etatPrecedent] || tache.etatPrecedent)} <span className="rtl-miroir">→</span> </>
                                    : t("Première détection : ")}
                                  <strong>{t(ETAT_LABELS[tache.etatNouveau] || tache.etatNouveau)}</strong>
                                </span>
                                <span className="vl-ligne__sous">
                                  <span>{formatDateTime(tache.dateTransition)}</span>
                                  {tache.bonMaintenanceNum && <span>{t("Bon")} <strong>{tache.bonMaintenanceNum}</strong></span>}
                                  {tache.motif && <span>« {tache.motif} »</span>}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </Panneau>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {scanner && <ScannerQR onClose={fermerScanner} />}
    </VeillePage>
  );
}
