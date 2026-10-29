// Onglets Diagnostic / Tâches / Intervenants / Contrôle / Remise en service
// Affichage en tableau → clic sur une ligne → page de détail (en-tête + infos + cadre à onglets)
import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  ClipboardList,
  Users,
  FileCheck,
  RotateCw,
  Inbox,
  Loader2,
  Package,
  Building2,
  FileText,
  Calendar,
  Activity,
  Euro,
  Clock,
  Gauge,
  MessageSquare,
  CheckCircle,
  XCircle,
  Power,
  X,
} from 'lucide-react';
import {
  BmfFormulaire,
  BmfEtape,
  BmfChamp,
  BmfChoix,
  BmfNombre,
  BmfTexte,
  BmfDate,
  BmfStock,
  BmfActions,
} from './BmdCommun';

import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../services/Bonmaintenanceintervenanthistoriqueservice';
import bonMaintenancePieceImmoService from '../../../services/Bonmaintenancepieceimmoservice';
import bonMaintenanceDiagnosticService from '../../../services/Bonmaintenancediagnosticservice';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import personnelService from '../../../services/Personnelservice';
import { obtenirArticles, obtenirEquipements, obtenirPrestataires } from '../../../store/referentiels';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import lotArticleService from '../../../services/lotArticleService';
import pieceLigneService from '../../../services/PieceLigneService';
import Button from '../../ui/Button';
import ConfirmModal from '../../ui/modals/ConfirmModal';

import {
  BmdDataTable,
  BmdDetailView,
  BmdFieldGrid,
  Pill,
  TexteOuVide,
} from './BmdCommun';
import {
  SearchableSelect,
  INTERVENANT_ETAT_LABELS,
  TACHE_ETAT_LABELS,
  GRAVITE_LABELS,
  TYPE_CONTROLE_OPTIONS,
  ETAT_IMMOBILISATION_OPTIONS,
  formatDateTime,
  formatMontant,
  warnIfQuantiteInvalide,
  coutIntervenant,
  nomIntervenantAffiche,
  libelleActionHistoriqueIntervenant,
} from './BmdCommun';
import { t } from '../../../i18n';
import { TempsPasse, totalTemps, formatTemps, tempsPasse, useMaintenant, TACHE_EN_COURS, INTERVENANT_EN_COURS } from './BmdCommun';

// ------------------------------------------------------------
// Constantes d'affichage
// ------------------------------------------------------------
const GRAVITE_TONE = { 1: 'blue', 2: 'amber', 3: 'red' };
const TACHE_ETAT_TONE = { 1: 'blue', 2: 'amber', 3: 'teal', 4: 'green', 10: 'slate' };
const INTERVENANT_ETAT_TONE = { 0: 'blue', 1: 'teal', 2: 'green', 10: 'slate' };

const nomPersonnel = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : null);
const libelleEtatImmo = (v) => ETAT_IMMOBILISATION_OPTIONS.find((o) => o.value === v)?.label ?? null;

function dureeEntre(debut, fin) {
  if (!debut || !fin) return null;
  const h = (new Date(fin) - new Date(debut)) / 3600000;
  if (isNaN(h) || h < 0) return null;
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} j`;
}

function useConfirmModal() {
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const close = () => setConfirmModal((prev) => ({ ...prev, show: false }));
  return { confirmModal, setConfirmModal, close };
}

const PanelHeader = ({ titre, count, extra, showForm, onToggle, labelAjout }) => (
  <div className="bmd-panel-header">
    <div className="bmd-panel-title">
      <h3>{t(titre)}</h3>
      <span className="bmd-panel-count">{count}</span>
      {extra}
    </div>
    <button className="bmd-add-btn" onClick={onToggle}>
      {showForm ? <X size={16} /> : <Plus size={16} />}
      {showForm ? t("Annuler") : t(labelAjout)}
    </button>
  </div>
);

// Fiche équipement réutilisée dans plusieurs détails
const FicheEquipement = ({ immo, id }) => (
  immo ? (
    <BmdFieldGrid
      fields={[
        { label: t("Désignation"), value: immo.designation },
        { label: t("Code"), value: immo.code },
        { label: t("Marque"), value: immo.marque },
        { label: t("Modèle"), value: immo.modele },
        { label: t("N° pièce"), value: immo.numPiece },
        { label: t("Code-barre"), value: immo.codeBarre },
      ]}
    />
  ) : (
    <TexteOuVide vide={id != null ? t('Immobilisation #{id} (détails non chargés).', { id }) : t("Aucune immobilisation liée.")} />
  )
);

// ============================================================
// ONGLET DIAGNOSTIC
// ============================================================
const emptyDiagnosticForm = {
  personnelId: '', observations: '', besoinPiece: '',
  prestataireArticlesId: '', qteNecessaire: '', sousTraitantId: '',
  lotArticleImmobilistationId: '', bonMaintenancePieceImmoId: '',
  causeProbable: '', gravite: '', dureeEstimeeHeures: '',
};

export function DiagnosticTab({ bonMaintenanceId, defaultLotArticleImmobilistationId, autoOpenForm = false }) {
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [piecesImmo, setPiecesImmo] = useState([]);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState(emptyDiagnosticForm);
  const [lastPersonnelId, setLastPersonnelId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();

  const [immoQteDisponible, setImmoQteDisponible] = useState(null);
  const [checkingImmoQte, setCheckingImmoQte] = useState(false);
  const [articleQteDisponible, setArticleQteDisponible] = useState(null);
  const [checkingArticleQte, setCheckingArticleQte] = useState(false);

  const openForm = () => {
    setForm({
      ...emptyDiagnosticForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      personnelId: lastPersonnelId,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const fermerForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  // Modification : le formulaire s'ouvre au-dessus du tableau, pré-rempli
  const startEdit = (d) => {
    setForm({
      personnelId: d.personnelId ?? '',
      observations: d.observations || '',
      besoinPiece: d.besoinPiece == null ? '' : String(d.besoinPiece),
      prestataireArticlesId: d.prestataireArticlesId ?? '',
      qteNecessaire: d.qteNecessaire ?? '',
      sousTraitantId: d.sousTraitantId ?? '',
      lotArticleImmobilistationId: d.lotArticleImmobilistationId != null ? String(d.lotArticleImmobilistationId) : '',
      bonMaintenancePieceImmoId: d.bonMaintenancePieceImmoId ?? '',
      causeProbable: d.causeProbable || '',
      gravite: d.gravite != null ? String(d.gravite) : '',
      dureeEstimeeHeures: d.dureeEstimeeHeures ?? '',
    });
    setEditingId(d.id);
    setSelectedId(null);
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceDiagnosticService.getByBonMaintenance(bonMaintenanceId);
      setDiagnostics(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);
  // Ouverture directe du formulaire (bouton « À faire maintenant »)
  useEffect(() => { if (autoOpenForm) openForm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.lotArticleImmobilistationId) {
      setImmoQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingImmoQte(true);
    lotArticleImmobilistationService.getById(form.lotArticleImmobilistationId)
      .then((immo) => {
        if (cancelled) return null;
        if (!immo?.lotArticleId) {
          setImmoQteDisponible(null);
          return null;
        }
        return lotArticleService.getById(immo.lotArticleId);
      })
      .then((lotArticle) => {
        if (!cancelled && lotArticle) setImmoQteDisponible(lotArticle.qte ?? null);
      })
      .catch(() => { if (!cancelled) setImmoQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingImmoQte(false); });
    return () => { cancelled = true; };
  }, [form.lotArticleImmobilistationId]);

  useEffect(() => {
    if (!form.prestataireArticlesId) {
      setArticleQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingArticleQte(true);
    pieceLigneService.getQuantiteDisponible(form.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setArticleQteDisponible(qte); })
      .catch(() => { if (!cancelled) setArticleQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingArticleQte(false); });
    return () => { cancelled = true; };
  }, [form.prestataireArticlesId]);

  useEffect(() => {
    personnelService.getMaintenance(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error); // service maintenance (63)
    obtenirEquipements().then(setImmobilisations).catch(console.error);
    bonMaintenancePieceImmoService.findByBonMaintenanceId(bonMaintenanceId).then((data) => setPiecesImmo(data ?? [])).catch(console.error);
    // Articles du prestataire de catégorie 15 (id = prestataireArticlesId)
    obtenirArticles().then(setArticles).catch(console.error);
    obtenirPrestataires().then(setPrestataires).catch(console.error);
  }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (form.besoinPiece === 'true') {
      warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qteNecessaire, 'quantité nécessaire');
    }
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      const besoinPieceBool = form.besoinPiece === '' ? null : form.besoinPiece === 'true';
      const payload = {
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        personnelNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        observations: form.observations.trim() || null,
        besoinPiece: besoinPieceBool,
        prestataireArticlesId: besoinPieceBool && form.prestataireArticlesId !== '' ? Number(form.prestataireArticlesId) : null,
        qteNecessaire: besoinPieceBool && form.qteNecessaire !== '' ? Number(form.qteNecessaire) : null,
        sousTraitantId: besoinPieceBool && form.sousTraitantId !== '' ? Number(form.sousTraitantId) : null,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
        bonMaintenancePieceImmoId: form.bonMaintenancePieceImmoId === '' ? null : Number(form.bonMaintenancePieceImmoId),
        causeProbable: form.causeProbable.trim() || null,
        gravite: form.gravite === '' ? null : Number(form.gravite),
        dureeEstimeeHeures: form.dureeEstimeeHeures === '' ? null : Number(form.dureeEstimeeHeures),
      };
      const idModifie = editingId;
      if (idModifie) {
        // Le serveur remplace tout l'enregistrement : on repart de l'existant (date, champs non affichés)
        const existant = diagnostics.find((x) => x.id === idModifie) || {};
        if (!payload.personnelNom && payload.personnelId === existant.personnelId) payload.personnelNom = existant.personnelNom ?? null;
        await bonMaintenanceDiagnosticService.update(idModifie, { ...existant, ...payload });
      } else {
        await bonMaintenanceDiagnosticService.create(payload);
      }
      setLastPersonnelId(form.personnelId);
      setForm(emptyDiagnosticForm);
      fermerForm();
      await load();
      if (idModifie) setSelectedId(idModifie);
    } catch (err) {
      console.error(err);
      alert(editingId ? t("Échec de la modification du diagnostic.") : t("Échec de l'ajout du diagnostic."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer le diagnostic"),
      message: t("Supprimer ce diagnostic ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceDiagnosticService.remove(id);
          setDiagnostics((prev) => prev.filter((d) => d.id !== id));
          setSelectedId(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  const findImmo = (id) => immobilisations.find((i) => String(i.id) === String(id));
  const libelleImmo = (id) => {
    if (id == null) return null;
    const i = findImmo(id);
    return i ? (i.designation || `#${i.id}`) : `#${id}`;
  };
  const libellePieceImmo = (id) => {
    if (id == null) return null;
    const p = piecesImmo.find((x) => String(x.id) === String(id));
    return p ? (p.designation || p.nom || p.libelle || t('Pièce #{id}', { id: p.id })) : `#${id}`;
  };

  const modal = (
    <ConfirmModal
      show={confirmModal.show}
      onClose={closeConfirmModal}
      onConfirm={confirmModal.onConfirm}
      type="danger"
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={t("Supprimer")}
    />
  );

  // ---------- DÉTAIL ----------
  const selected = diagnostics.find((d) => d.id === selectedId);
  if (selected) {
    const d = selected;
    const immo = findImmo(d.lotArticleImmobilistationId);
    const article = articles.find((a) => String(a.id) === String(d.prestataireArticlesId));
    const sousTraitant = prestataires.find((p) => String(p.id) === String(d.sousTraitantId));

    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux diagnostics")}
          icon={Search}
          surtitre={t('Diagnostic #{id}', { id: d.id })}
          title={d.personnelNom || (d.personnelId != null ? t('Technicien #{id}', { id: d.personnelId }) : t("Technicien non renseigné"))}
          onEdit={() => startEdit(d)}
          badges={(
            <>
              {d.gravite != null && (
                <Pill tone={GRAVITE_TONE[d.gravite]}>{t("Gravité")} {GRAVITE_LABELS[d.gravite] || d.gravite}</Pill>
              )}
              {d.besoinPiece != null && (
                <Pill tone={d.besoinPiece ? 'amber' : 'green'}>
                  {d.besoinPiece ? t("Besoin de pièce") : t("Pas de pièce nécessaire")}
                </Pill>
              )}
            </>
          )}
          onDelete={() => handleDelete(d.id)}
          infos={[
            { label: t("Date du diagnostic"), value: formatDateTime(d.dateDiagnostic) },
            { label: t("Technicien"), value: d.personnelNom },
            { label: t("Gravité"), value: d.gravite != null ? (GRAVITE_LABELS[d.gravite] || d.gravite) : null },
            { label: t("Durée estimée"), value: d.dureeEstimeeHeures != null ? `${d.dureeEstimeeHeures} h` : null },
            { label: t("Immobilisation"), value: libelleImmo(d.lotArticleImmobilistationId) },
            { label: t("Pièce d'immobilisation"), value: libellePieceImmo(d.bonMaintenancePieceImmoId) },
            { label: t("Cause probable"), value: d.causeProbable, wide: true },
          ]}
          sections={[
            {
              key: 'observations',
              label: t("Observations"),
              icon: FileText,
              content: <TexteOuVide texte={d.observations} vide="Aucune observation saisie." />,
            },
            {
              key: 'piece',
              label: t("Besoin en pièces"),
              icon: Package,
              content: d.besoinPiece ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("Article"), value: article?.designation || (d.prestataireArticlesId != null ? t('Article #{id}', { id: d.prestataireArticlesId }) : null) },
                    { label: t("Code article"), value: article?.code },
                    { label: t("Quantité nécessaire"), value: d.qteNecessaire },
                    { label: t("Sous-traitant"), value: sousTraitant?.raisonSociale || (d.sousTraitantId != null ? `#${d.sousTraitantId}` : null) },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Aucune pièce nécessaire pour ce diagnostic." />
              ),
            },
            {
              key: 'equipement',
              label: t("Équipement"),
              icon: Building2,
              content: <FicheEquipement immo={immo} id={d.lotArticleImmobilistationId} />,
            },
          ]}
        />
        {modal}
      </>
    );
  }

  // ---------- TABLEAU ----------
  const colonnes = [
    { key: 'date', label: t("Date"), render: (d) => <span className="bmd-cell-nowrap">{formatDateTime(d.dateDiagnostic)}</span> },
    { key: 'tech', label: t("Technicien"), render: (d) => <span className="bmd-cell-main">{d.personnelNom}</span> },
    { key: 'immo', label: t("Immobilisation"), render: (d) => libelleImmo(d.lotArticleImmobilistationId) },
    {
      key: 'gravite',
      label: t("Gravité"),
      render: (d) => (d.gravite != null ? <Pill tone={GRAVITE_TONE[d.gravite]}>{GRAVITE_LABELS[d.gravite] || d.gravite}</Pill> : null),
    },
    {
      key: 'piece',
      label: t("Pièce"),
      render: (d) => (d.besoinPiece == null ? null : <Pill tone={d.besoinPiece ? 'amber' : 'slate'}>{d.besoinPiece ? t("Oui") : t("Non")}</Pill>),
    },
    {
      key: 'cause',
      label: t("Cause probable"),
      render: (d) => (d.causeProbable ? <span className="bmd-cell-truncate" title={d.causeProbable}>{d.causeProbable}</span> : null),
    },
    { key: 'duree', label: t("Durée est."), align: 'right', render: (d) => (d.dureeEstimeeHeures != null ? `${d.dureeEstimeeHeures} h` : null) },
  ];

  return (
    <div>
      <PanelHeader
        titre={t("Diagnostics")}
        count={diagnostics.length}
        showForm={showForm}
        onToggle={() => (showForm ? fermerForm() : openForm())}
        labelAjout="Ajouter un diagnostic"
      />

      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier le diagnostic") : t("Nouveau diagnostic")}
          intro={t("Décrivez la panne en trois étapes. Seuls les champs marqués « obligatoire » sont nécessaires.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Qui a examiné, et quoi ?")} aide={t("Le technicien et l'équipement concerné")}>
            <BmfChamp label={t("Technicien")} aide={t("La personne qui a examiné l'équipement")} htmlFor="diag-tech">
              <SearchableSelect
                id="diag-tech"
                name="personnelId"
                value={form.personnelId}
                onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
                options={personnels}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun technicien ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => nomPersonnel(p)}
                getOptionHint={(p) => (p.matricule ? t('Matricule {m}', { m: p.matricule }) : null)}
              />
            </BmfChamp>

            <BmfChamp label={t("Équipement examiné")} aide={t("Déjà rempli avec l'équipement du bon")} htmlFor="diag-immo">
              <SearchableSelect
                id="diag-immo"
                name="lotArticleImmobilistationId"
                value={form.lotArticleImmobilistationId}
                onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
                options={immobilisations}
                placeholder={t("Tapez un nom ou un code...")}
                emptyMessage={t("Aucun équipement ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(i) => i.id}
                getLabel={(i) => i.designation || `#${i.id}`}
                getOptionHint={(i) => (i.code ? t('Code {code}', { code: i.code }) : null)}
              />
              {form.lotArticleImmobilistationId && (
                <BmfStock verification={checkingImmoQte} quantite={immoQteDisponible} />
              )}
            </BmfChamp>

            <BmfChamp label={t("Pièce de l'équipement")} aide={t("Si la panne touche une pièce précise")} htmlFor="diag-piece">
              <SearchableSelect
                id="diag-piece"
                name="bonMaintenancePieceImmoId"
                value={form.bonMaintenancePieceImmoId}
                onChange={(e) => setForm({ ...form, bonMaintenancePieceImmoId: e.target.value })}
                options={piecesImmo}
                placeholder={t("Choisir une pièce...")}
                emptyMessage={t("Aucune pièce enregistrée sur ce bon")}
                allowEmpty
                emptyOptionLabel={t("Aucune")}
                getValue={(p) => p.id}
                getLabel={(p) => p.designation || p.nom || p.libelle || t('Pièce #{id}', { id: p.id })}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("Ce que vous avez constaté")}>
            <BmfChamp label={t("Gravité")} aide={t("À quel point la panne gêne le service")}>
              <BmfChoix
                nom={t("Gravité")}
                value={form.gravite}
                onChange={(v) => setForm({ ...form, gravite: v })}
                options={[
                  { value: '1', label: t("Faible"), ton: 'info' },
                  { value: '2', label: t("Moyenne"), ton: 'now' },
                  { value: '3', label: t("Élevée"), ton: 'alert' },
                ]}
              />
            </BmfChamp>

            <BmfChamp label={t("Temps de réparation estimé")} aide={t("Une estimation suffit")} htmlFor="diag-duree">
              <BmfNombre
                id="diag-duree"
                value={form.dureeEstimeeHeures}
                onChange={(v) => setForm({ ...form, dureeEstimeeHeures: v })}
                unite="h"
                step="0.5"
                min="0"
                placeholder={t("Ex. 2")}
              />
            </BmfChamp>

            <BmfChamp label={t("Cause probable")} large aide={t("En quelques mots, ce qui semble provoquer la panne")} htmlFor="diag-cause">
              <BmfTexte
                id="diag-cause"
                value={form.causeProbable}
                onChange={(v) => setForm({ ...form, causeProbable: v })}
                placeholder={t("Ex. joint usé, carte électronique grillée")}
              />
            </BmfChamp>

            <BmfChamp label={t("Observations")} large aide={t("Tout ce qui peut aider la personne qui va réparer")} htmlFor="diag-obs">
              <BmfTexte
                id="diag-obs"
                multiligne
                value={form.observations}
                onChange={(v) => setForm({ ...form, observations: v })}
                placeholder={t("Ex. l'alarme sonne au démarrage, l'écran reste noir")}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={3} titre={t("Faut-il changer une pièce ?")} aide={t("Si oui, indiquez laquelle pour pouvoir la commander")}>
            <BmfChamp label={t("Besoin d'une pièce")} large>
              <BmfChoix
                nom={t("Besoin d'une pièce")}
                grand
                value={form.besoinPiece}
                onChange={(v) => setForm({ ...form, besoinPiece: v })}
                options={[
                  { value: 'false', label: t("Non, pas de pièce"), aide: t("La réparation se fait sans rien changer"), icon: CheckCircle, ton: 'ok' },
                  { value: 'true', label: t("Oui, il faut une pièce"), aide: t("Vous choisirez l'article juste après"), icon: Package, ton: 'now' },
                ]}
              />
            </BmfChamp>

            {form.besoinPiece === 'true' && (
              <>
                <BmfChamp label={t("Article nécessaire")} aide={t("Tapez quelques lettres pour chercher")} htmlFor="diag-article">
                  <SearchableSelect
                    id="diag-article"
                    name="prestataireArticlesId"
                    value={form.prestataireArticlesId}
                    onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
                    options={articles}
                    placeholder={t("Tapez un nom ou un code...")}
                    emptyMessage={t("Aucun article ne correspond")}
                    allowEmpty
                    emptyOptionLabel={t("Aucun")}
                    getValue={(a) => a.id}
                    getLabel={(a) => a.designation || `#${a.id}`}
                    getOptionHint={(a) => (a.code ? t('Code {code}', { code: a.code }) : null)}
                  />
                  {form.prestataireArticlesId && (
                    <BmfStock verification={checkingArticleQte} quantite={articleQteDisponible} demande={form.qteNecessaire} />
                  )}
                </BmfChamp>

                <BmfChamp label={t("Quantité nécessaire")} htmlFor="diag-qte">
                  <BmfNombre
                    id="diag-qte"
                    value={form.qteNecessaire}
                    onChange={(v) => setForm({ ...form, qteNecessaire: v })}
                    min="0"
                    placeholder={t("Ex. 1")}
                    onBlur={() => warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qteNecessaire, 'quantité nécessaire')}
                  />
                </BmfChamp>

                <BmfChamp label={t("Fournisseur")} aide={t("Nécessaire pour pouvoir commander la pièce")} htmlFor="diag-st">
                  <SearchableSelect
                    id="diag-st"
                    name="sousTraitantId"
                    value={form.sousTraitantId}
                    onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
                    options={prestataires}
                    placeholder={t("Tapez un nom...")}
                    emptyMessage={t("Aucun fournisseur ne correspond")}
                    allowEmpty
                    emptyOptionLabel={t("Aucun")}
                    getValue={(p) => p.id}
                    getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || `#${p.id}`}
                    getOptionHint={(p) => (p.code ? t('Code {code}', { code: p.code }) : null)}
                  />
                </BmfChamp>
              </>
            )}
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer le diagnostic")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}

      <BmdDataTable
        columns={colonnes}
        rows={diagnostics}
        loading={loading}
        onRowClick={(d) => setSelectedId(d.id)}
        emptyMessage={t("Aucun diagnostic pour l'instant.")}
        searchPlaceholder={t("Filtrer par technicien, cause, équipement...")}
        getSearchText={(d) => [d.personnelNom, d.causeProbable, d.observations, libelleImmo(d.lotArticleImmobilistationId)].join(' ')}
      />
      {modal}
    </div>
  );
}

// ============================================================
// ONGLET TÂCHES
// ============================================================
const emptyTacheForm = {
  designation: '', nom: '', ordre: '', etat: '1',
  dateDebut: '', dateFin: '',
  dateDebutIntervention: '', dateFinIntervention: '',
  intervenantId: '', sousTraitantId: '',
  prestataireArticlesId: '', qte: '',
};

export function TachesTab({ bonMaintenanceId, autoOpenForm = false }) {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [intervenants, setIntervenants] = useState([]);
  const [form, setForm] = useState(emptyTacheForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();
  // Temps passé : rafraîchi toutes les 30 s tant qu'une tâche est en cours
  const maintenantT = useMaintenant(taches.some((x) => tempsPasse(x, TACHE_EN_COURS)?.enCours));
  const tempsTotalTaches = totalTemps(taches, TACHE_EN_COURS, maintenantT);

  const [tacheQteDisponible, setTacheQteDisponible] = useState(null);
  const [checkingTacheQte, setCheckingTacheQte] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceTacheService.getByBonMaintenance(bonMaintenanceId);
      setTaches(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);
  useEffect(() => { if (autoOpenForm) setShowForm(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Articles du prestataire de catégorie 15 (id = prestataireArticlesId)
    obtenirArticles().then(setArticles).catch(console.error);
    obtenirPrestataires().then(setPrestataires).catch(console.error);
    bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenanceId)
      .then((data) => setIntervenants(data ?? []))
      .catch(console.error);
  }, [bonMaintenanceId]);

  useEffect(() => {
    if (!form.prestataireArticlesId) {
      setTacheQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingTacheQte(true);
    pieceLigneService.getQuantiteDisponible(form.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setTacheQteDisponible(qte); })
      .catch(() => { if (!cancelled) setTacheQteDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingTacheQte(false); });
    return () => { cancelled = true; };
  }, [form.prestataireArticlesId]);

  const resetForm = () => {
    setForm(emptyTacheForm);
    setEditingId(null);
    setShowForm(false);
  };

  // Comme dans Cubix : le sous-traitant d'une tâche est choisi parmi les sous-traitants du bon
  // (onglet « Intervenants »). La valeur déjà enregistrée reste affichée même si elle n'y est plus.
  const sousTraitantsDuBon = prestataires.filter((p) =>
    intervenants.some((i) => i.sousTraitantId != null && String(i.sousTraitantId) === String(p.id))
    || (form.sousTraitantId !== '' && String(form.sousTraitantId) === String(p.id)));

  const startEdit = (tache) => {
    setForm({
      designation: tache.designation || '',
      nom: tache.nom || '',
      ordre: tache.ordre ?? '',
      etat: tache.etat != null ? String(tache.etat) : '1',
      dateDebut: tache.dateDebut ? tache.dateDebut.slice(0, 16) : '',
      dateFin: tache.dateFin ? tache.dateFin.slice(0, 16) : '',
      dateDebutIntervention: tache.dateDebutIntervention ? tache.dateDebutIntervention.slice(0, 16) : '',
      dateFinIntervention: tache.dateFinIntervention ? tache.dateFinIntervention.slice(0, 16) : '',
      intervenantId: tache.intervenantId ?? '',
      sousTraitantId: tache.sousTraitantId ?? '',
      prestataireArticlesId: tache.prestataireArticlesId ?? '',
      qte: tache.qte ?? '',
    });
    setEditingId(tache.id);
    setSelectedId(null); // retour à la liste, formulaire de modification ouvert au-dessus du tableau
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.designation.trim()) return;
    warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qte, 'quantité');

    setSaving(true);
    try {
      const payload = {
        bonMaintenanceId,
        designation: form.designation.trim(),
        nom: form.nom.trim() || null,
        ordre: form.ordre === '' ? null : Number(form.ordre),
        etat: form.etat === '' ? null : Number(form.etat),
        dateDebut: form.dateDebut || null,
        dateFin: form.dateFin || null,
        dateDebutIntervention: form.dateDebutIntervention || null,
        dateFinIntervention: form.dateFinIntervention || null,
        intervenantId: form.intervenantId === '' ? null : Number(form.intervenantId),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
        prestataireArticlesId: form.prestataireArticlesId === '' ? null : Number(form.prestataireArticlesId),
        qte: form.qte === '' ? null : Number(form.qte),
      };

      const idModifie = editingId;
      if (idModifie) {
        await bonMaintenanceTacheService.update(idModifie, payload);
      } else {
        await bonMaintenanceTacheService.create(payload);
      }
      resetForm();
      await load();
      if (idModifie) setSelectedId(idModifie); // on revient sur le détail de la tâche modifiée
    } catch (err) {
      console.error(err);
      alert(editingId ? 'Échec de la modification de la tâche.' : "Échec de l'ajout de la tâche.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer la tâche"),
      message: t("Supprimer cette tâche ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceTacheService.remove(id);
          setTaches((prev) => prev.filter((tache) => tache.id !== id));
          setSelectedId(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  const findIntervenant = (id) => intervenants.find((i) => String(i.id) === String(id));
  const findArticle = (id) => articles.find((a) => String(a.id) === String(id));
  const libelleSousTraitant = (tache) => {
    if (tache.sousTraitant?.raisonSociale) return tache.sousTraitant.raisonSociale;
    if (tache.sousTraitantId == null) return null;
    return prestataires.find((p) => String(p.id) === String(tache.sousTraitantId))?.raisonSociale || `#${tache.sousTraitantId}`;
  };

  const modal = (
    <ConfirmModal
      show={confirmModal.show}
      onClose={closeConfirmModal}
      onConfirm={confirmModal.onConfirm}
      type="danger"
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={t("Supprimer")}
    />
  );

  // ---------- DÉTAIL ----------
  const selected = taches.find((tache) => tache.id === selectedId);
  if (selected) {
    const tache = selected;
    const intervenant = findIntervenant(tache.intervenantId);
    const article = findArticle(tache.prestataireArticlesId);

    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux tâches")}
          icon={ClipboardList}
          surtitre={tache.ordre != null ? t('Tâche n° {n}', { n: tache.ordre }) : t('Tâche #{id}', { id: tache.id })}
          title={tache.designation}
          badges={tache.etat != null && (
            <Pill tone={TACHE_ETAT_TONE[tache.etat]}>{TACHE_ETAT_LABELS[tache.etat] || t('État {n}', { n: tache.etat })}</Pill>
          )}
          onEdit={() => startEdit(tache)}
          onDelete={() => handleDelete(tache.id)}
          infos={[
            { label: t("Désignation"), value: tache.designation },
            { label: t("Nom"), value: tache.nom },
            { label: t("Ordre"), value: tache.ordre },
            { label: t("État"), value: tache.etat != null ? (TACHE_ETAT_LABELS[tache.etat] || tache.etat) : null },
            { label: t("Intervenant"), value: tache.intervenantId != null ? (nomIntervenantAffiche(intervenant) || `#${tache.intervenantId}`) : null },
            { label: t("Sous-traitant"), value: libelleSousTraitant(tache) },
            { label: t("Temps passé"), value: <TempsPasse objet={tache} etatEnCours={TACHE_EN_COURS} maintenant={maintenantT} /> },
          ]}
          sections={[
            {
              key: 'planification',
              label: t("Planification"),
              icon: Calendar,
              content: (
                <BmdFieldGrid
                  fields={[
                    { label: t("Début prévu"), value: formatDateTime(tache.dateDebut) },
                    { label: t("Fin prévue"), value: formatDateTime(tache.dateFin) },
                    { label: t("Durée prévue"), value: dureeEntre(tache.dateDebut, tache.dateFin) },
                  ]}
                />
              ),
            },
            {
              key: 'intervention',
              label: t("Intervention réelle"),
              icon: Activity,
              content: (tache.dateDebutIntervention || tache.dateFinIntervention) ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("Début d'intervention"), value: formatDateTime(tache.dateDebutIntervention) },
                    { label: t("Fin d'intervention"), value: formatDateTime(tache.dateFinIntervention) },
                    { label: t("Durée réelle"), value: dureeEntre(tache.dateDebutIntervention, tache.dateFinIntervention) },
                    { label: t("Temps passé (pauses déduites)"), value: <TempsPasse objet={tache} etatEnCours={TACHE_EN_COURS} maintenant={maintenantT} /> },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Intervention pas encore démarrée." />
              ),
            },
            {
              key: 'article',
              label: t("Article"),
              icon: Package,
              content: tache.prestataireArticlesId != null ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("Article"), value: article?.designation || t('Article #{id}', { id: tache.prestataireArticlesId }) },
                    { label: t("Code"), value: article?.code },
                    { label: t("Quantité"), value: tache.qte },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Aucun article lié à cette tâche." />
              ),
            },
          ]}
        />
        {modal}
      </>
    );
  }

  // ---------- TABLEAU ----------
  const tachesTriees = [...taches].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

  const colonnes = [
    { key: 'ordre', label: t("N°"), width: 56, render: (tache) => tache.ordre },
    {
      key: 'designation',
      label: t("Désignation"),
      render: (tache) => (
        <>
          <span className="bmd-cell-main">{tache.designation}</span>
          {tache.nom && <span className="bmd-cell-sub">{tache.nom}</span>}
        </>
      ),
    },
    {
      key: 'etat',
      label: t("État"),
      render: (tache) => (tache.etat != null ? <Pill tone={TACHE_ETAT_TONE[tache.etat]}>{TACHE_ETAT_LABELS[tache.etat] || tache.etat}</Pill> : null),
    },
    {
      key: 'temps',
      label: t("Temps passé"),
      render: (tache) => <TempsPasse objet={tache} etatEnCours={TACHE_EN_COURS} maintenant={maintenantT} vide={null} />,
    },
    {
      key: 'planifie',
      label: t("Planifié"),
      render: (tache) => ((tache.dateDebut || tache.dateFin)
        ? <span className="bmd-cell-nowrap">{formatDateTime(tache.dateDebut)} → {formatDateTime(tache.dateFin)}</span>
        : null),
    },
    {
      key: 'intervenant',
      label: t("Intervenant"),
      render: (tache) => (tache.intervenantId != null ? (nomIntervenantAffiche(findIntervenant(tache.intervenantId)) || `#${tache.intervenantId}`) : null),
    },
    {
      key: 'article',
      label: t("Article"),
      render: (tache) => (tache.prestataireArticlesId != null
        ? `${findArticle(tache.prestataireArticlesId)?.designation || `#${tache.prestataireArticlesId}`}${tache.qte != null ? ` (×${tache.qte})` : ''}`
        : null),
    },
  ];

  return (
    <div>
      <PanelHeader
        titre={t("Tâches")}
        count={taches.length}
        extra={tempsTotalTaches && (
          <span className="bmd-panel-cout-total bmd-temps-total" title={t("Somme du temps passé sur toutes les tâches")}>
            {t("Temps passé :")} {formatTemps(tempsTotalTaches.secondes)}
          </span>
        )}
        showForm={showForm}
        onToggle={() => (showForm ? resetForm() : setShowForm(true))}
        labelAjout="Ajouter une tâche"
      />

      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier la tâche") : t("Nouvelle tâche")}
          intro={t("Une tâche, c'est un travail précis à faire sur l'équipement.")}
          onSubmit={handleSubmit}
        >
          <BmfEtape numero={1} titre={t("La tâche")}>
            <BmfChamp label={t("Ce qu'il faut faire")} requis large aide={t("Une phrase courte, par exemple « Remplacer le joint de la pompe »")} htmlFor="tache-desig">
              <BmfTexte
                id="tache-desig"
                requis
                autoFocus
                value={form.designation}
                onChange={(v) => setForm({ ...form, designation: v })}
                placeholder={t("Ex. Remplacer le joint de la pompe")}
              />
            </BmfChamp>

            <BmfChamp label={t("Précision")} aide={t("Un nom court ou une référence interne")} htmlFor="tache-nom">
              <BmfTexte id="tache-nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
            </BmfChamp>

            <BmfChamp label={t("Ordre")} aide={t("Pour ranger les tâches : 1 se fait en premier")} htmlFor="tache-ordre">
              <BmfNombre id="tache-ordre" value={form.ordre} onChange={(v) => setForm({ ...form, ordre: v })} step="1" min="0" placeholder={t("Ex. 1")} />
            </BmfChamp>

            <BmfChamp label={t("Où en est cette tâche ?")} large>
              <BmfChoix
                nom={t("État de la tâche")}
                effacable={false}
                value={form.etat}
                onChange={(v) => setForm({ ...form, etat: v })}
                options={Object.entries(TACHE_ETAT_LABELS).map(([val, label]) => ({
                  value: val, label, ton: { 1: 'info', 2: 'now', 3: 'brand', 4: 'ok', 10: 'calme' }[val],
                }))}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("Quand ?")} aide={t("Ce qui est prévu, puis ce qui s'est vraiment passé")}>
            <BmfChamp label={t("Début prévu")} htmlFor="tache-d1">
              <BmfDate id="tache-d1" value={form.dateDebut} onChange={(v) => setForm({ ...form, dateDebut: v })} />
            </BmfChamp>
            <BmfChamp label={t("Fin prévue")} htmlFor="tache-f1">
              <BmfDate id="tache-f1" value={form.dateFin} onChange={(v) => setForm({ ...form, dateFin: v })} />
            </BmfChamp>
            <BmfChamp label={t("Début réel")} aide={t("Quand le travail a vraiment commencé")} htmlFor="tache-d2">
              <BmfDate id="tache-d2" value={form.dateDebutIntervention} onChange={(v) => setForm({ ...form, dateDebutIntervention: v })} />
            </BmfChamp>
            <BmfChamp label={t("Fin réelle")} aide={t("Quand le travail a vraiment fini")} htmlFor="tache-f2">
              <BmfDate id="tache-f2" value={form.dateFinIntervention} onChange={(v) => setForm({ ...form, dateFinIntervention: v })} />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={3} titre={t("Qui, et avec quoi ?")}>
            <BmfChamp label={t("Intervenant")} aide={t("Seuls les intervenants déjà ajoutés au bon apparaissent")} htmlFor="tache-int">
              <SearchableSelect
                id="tache-int"
                name="intervenantId"
                value={form.intervenantId}
                onChange={(e) => setForm({ ...form, intervenantId: e.target.value })}
                options={intervenants}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun intervenant sur ce bon")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(i) => i.id}
                getLabel={(i) => nomIntervenantAffiche(i)}
              />
            </BmfChamp>

            <BmfChamp label={t("Sous-traitant")} htmlFor="tache-st">
              <SearchableSelect
                id="tache-st"
                name="sousTraitantId"
                value={form.sousTraitantId}
                onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
                options={sousTraitantsDuBon}
                placeholder={sousTraitantsDuBon.length ? t("Tapez un nom...") : t("Aucun sous-traitant sur ce bon")}
                emptyMessage={t("Ajoutez d'abord le sous-traitant dans l'onglet « Intervenants »")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || `#${p.id}`}
              />
            </BmfChamp>

            <BmfChamp label={t("Article utilisé")} htmlFor="tache-article">
              <SearchableSelect
                id="tache-article"
                name="prestataireArticlesId"
                value={form.prestataireArticlesId}
                onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
                options={articles}
                placeholder={t("Tapez un nom ou un code...")}
                emptyMessage={t("Aucun article ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(a) => a.id}
                getLabel={(a) => a.designation || `#${a.id}`}
                getOptionHint={(a) => (a.code ? t('Code {code}', { code: a.code }) : null)}
              />
              {form.prestataireArticlesId && (
                <BmfStock verification={checkingTacheQte} quantite={tacheQteDisponible} demande={form.qte} />
              )}
            </BmfChamp>

            <BmfChamp label={t("Quantité")} htmlFor="tache-qte">
              <BmfNombre
                id="tache-qte"
                value={form.qte}
                onChange={(v) => setForm({ ...form, qte: v })}
                min="0"
                placeholder={t("Ex. 1")}
                onBlur={() => warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qte, 'quantité')}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfActions
            enregistrement={saving}
            label={editingId ? t("Enregistrer les modifications") : t("Ajouter la tâche")}
            onAnnuler={resetForm}
          />
        </BmfFormulaire>
      )}

      <BmdDataTable
        columns={colonnes}
        rows={tachesTriees}
        loading={loading}
        onRowClick={(tache) => setSelectedId(tache.id)}
        emptyMessage={t("Aucune tâche pour l'instant.")}
        searchPlaceholder={t("Filtrer par désignation, intervenant...")}
        getSearchText={(tache) => [tache.designation, tache.nom, nomIntervenantAffiche(findIntervenant(tache.intervenantId))].join(' ')}
      />
      {modal}
    </div>
  );
}

// ============================================================
// ONGLET INTERVENANTS
// ============================================================
const emptyIntervenantForm = {
  personnelId: '', sousTraitantId: '', etat: '0',
  dateDebutIntervention: '', dateFinIntervention: '',
  nbrHeure: '', coutUnitaire: '', forfait: '', commentaire: '',
};

const typeIntervenant = (i) => {
  if (i.personnel || i.personnelId != null) return t("Interne");
  if (i.sousTraitant || i.sousTraitantId != null) return t("Sous-traitant");
  return null;
};

export function IntervenantsTab({ bonMaintenanceId, onBonMaybeChanged, onCelebrer, autoOpenForm = false }) {
  const [intervenants, setIntervenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState(emptyIntervenantForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [historiqueParIntervenant, setHistoriqueParIntervenant] = useState({});
  const [loadingHistoId, setLoadingHistoId] = useState(null);
  const [savingEtatId, setSavingEtatId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();
  // Temps passé : rafraîchi toutes les 30 s tant qu'un intervenant est en cours
  const maintenantI = useMaintenant(intervenants.some((x) => tempsPasse(x, INTERVENANT_EN_COURS)?.enCours));
  const tempsTotalIntervenants = totalTemps(intervenants, INTERVENANT_EN_COURS, maintenantI);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenanceId);
      setIntervenants(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);
  useEffect(() => { if (autoOpenForm) setShowForm(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showForm) return;
    personnelService.getMaintenance(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error); // service maintenance (63)
    obtenirPrestataires().then(setPrestataires).catch(console.error);
  }, [showForm]);

  const chargerHistorique = async (intervenantId) => {
    setLoadingHistoId(intervenantId);
    try {
      const data = await bonMaintenanceIntervenantHistoriqueService.findByIntervenantId(intervenantId);
      setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: data ?? [] }));
    } catch (err) {
      console.error(err);
      setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: [] }));
    } finally {
      setLoadingHistoId(null);
    }
  };

  const fermerForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyIntervenantForm);
  };

  // Modification : le formulaire s'ouvre au-dessus du tableau, pré-rempli
  const startEdit = (i) => {
    setForm({
      personnelId: i.personnelId ?? '',
      sousTraitantId: i.sousTraitantId ?? '',
      etat: i.etat != null ? String(i.etat) : '0',
      dateDebutIntervention: i.dateDebutIntervention ? i.dateDebutIntervention.slice(0, 16) : '',
      dateFinIntervention: i.dateFinIntervention ? i.dateFinIntervention.slice(0, 16) : '',
      nbrHeure: i.nbrHeure ?? '',
      coutUnitaire: i.coutUnitaire ?? '',
      forfait: i.forfait ?? '',
      commentaire: i.commentaire || '',
    });
    setEditingId(i.id);
    setSelectedId(null);
    setShowForm(true);
  };

  const ouvrirDetail = (i) => {
    setSelectedId(i.id);
    if (!historiqueParIntervenant[i.id]) chargerHistorique(i.id);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      const sousTraitant = prestataires.find((p) => String(p.id) === String(form.sousTraitantId));
      const intervenantNom = personnel
        ? `${personnel.nom} ${personnel.prenom}`
        : (sousTraitant ? (sousTraitant.raisonSociale || `${sousTraitant.nom ?? ''} ${sousTraitant.prenom ?? ''}`.trim()) : null);

      const payload = {
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
        intervenantNom: intervenantNom || null,
        etat: form.etat === '' ? null : Number(form.etat),
        dateDebutIntervention: form.dateDebutIntervention || null,
        dateFinIntervention: form.dateFinIntervention || null,
        nbrHeure: form.nbrHeure === '' ? null : Number(form.nbrHeure),
        coutUnitaire: form.coutUnitaire === '' ? null : Number(form.coutUnitaire),
        forfait: form.forfait === '' ? null : Number(form.forfait),
        commentaire: form.commentaire.trim() || null,
      };
      const idModifie = editingId;
      const existant = idModifie ? (intervenants.find((x) => x.id === idModifie) || {}) : null;
      // Sans changement de personne, on garde le nom déjà enregistré (listes chargées en arrière-plan)
      if (existant && !payload.intervenantNom) payload.intervenantNom = existant.intervenantNom ?? null;
      const resultat = idModifie
        ? await bonMaintenanceIntervenantService.update(idModifie, { ...existant, ...payload })
        : await bonMaintenanceIntervenantService.create(payload);
      const devientTermine = Number(form.etat) === 2 && (!existant || Number(existant.etat) !== 2);
      fermerForm();
      await load();
      if (idModifie) {
        setSelectedId(idModifie);
        chargerHistorique(idModifie);
      }
      if (devientTermine) onCelebrer?.('intervenant-termine', intervenantNom || existant?.intervenantNom);
      if (devientTermine || idModifie) onBonMaybeChanged?.();
      if (resultat?.conflitMessage) alert(t('Attention : {message}', { message: resultat.conflitMessage }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || (editingId ? t("Échec de la modification de l'intervenant.") : t("Échec de l'ajout de l'intervenant.")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer l'intervenant"),
      message: t("Supprimer cet intervenant ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceIntervenantService.remove(id);
          setIntervenants((prev) => prev.filter((i) => i.id !== id));
          setSelectedId(null);
          onBonMaybeChanged?.(); // le bon peut avoir été clôturé automatiquement
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  // Le backend remplace toute l'entité à l'update : on renvoie l'objet complet avec le nouvel état.
  const handleChangeEtat = async (intervenant, nouvelEtat) => {
    const etat = Number(nouvelEtat);
    if (etat === intervenant.etat) return;
    setSavingEtatId(intervenant.id);
    try {
      const updated = await bonMaintenanceIntervenantService.update(intervenant.id, { ...intervenant, etat });
      setIntervenants((prev) => prev.map((i) => (i.id === intervenant.id ? { ...i, ...updated } : i)));
      // Animation avant le rafraîchissement : si le bon se clôture, son animation suivra
      if (etat === 2) onCelebrer?.('intervenant-termine', nomIntervenantAffiche(intervenant));
      onBonMaybeChanged?.();
      await chargerHistorique(intervenant.id);
      if (updated?.conflitMessage) alert(t('Attention : {message}', { message: updated.conflitMessage }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Échec du changement d'état de l'intervenant.");
    } finally {
      setSavingEtatId(null);
    }
  };

  const coutTotal = intervenants.reduce((total, i) => total + (coutIntervenant(i) ?? 0), 0);

  const modal = (
    <ConfirmModal
      show={confirmModal.show}
      onClose={closeConfirmModal}
      onConfirm={confirmModal.onConfirm}
      type="danger"
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={t("Supprimer")}
    />
  );

  // ---------- DÉTAIL ----------
  const selected = intervenants.find((i) => i.id === selectedId);
  if (selected) {
    const i = selected;
    const historique = historiqueParIntervenant[i.id] ?? [];
    const total = coutIntervenant(i);
    const mainOeuvre = (i.coutUnitaire != null && i.nbrHeure != null)
      ? Number(i.coutUnitaire) * Number(i.nbrHeure)
      : null;

    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux intervenants")}
          icon={Users}
          surtitre={typeIntervenant(i) ? t('Intervenant {type}', { type: t(typeIntervenant(i)).toLowerCase() }) : t('Intervenant #{id}', { id: i.id })}
          title={nomIntervenantAffiche(i)}
          onEdit={() => startEdit(i)}
          badges={(
            <>
              {i.etat != null && (
                <Pill tone={INTERVENANT_ETAT_TONE[i.etat]}>{INTERVENANT_ETAT_LABELS[i.etat] || t('État {n}', { n: i.etat })}</Pill>
              )}
              {total != null && <Pill tone="teal">{formatMontant(total)}</Pill>}
            </>
          )}
          extraActions={(
            <select
              className="bmd-capa-statut-select bmd-detail-inline-select"
              value={i.etat ?? 0}
              disabled={savingEtatId === i.id}
              onChange={(e) => handleChangeEtat(i, e.target.value)}
              title={t("Changer l'état de l'intervenant")}
            >
              {Object.entries(INTERVENANT_ETAT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          )}
          onDelete={() => handleDelete(i.id)}
          infos={[
            { label: t("Type"), value: typeIntervenant(i) },
            { label: t("État"), value: i.etat != null ? (INTERVENANT_ETAT_LABELS[i.etat] || i.etat) : null },
            { label: t("Début"), value: formatDateTime(i.dateDebutIntervention) },
            { label: t("Fin"), value: formatDateTime(i.dateFinIntervention) },
            { label: t("Durée"), value: dureeEntre(i.dateDebutIntervention, i.dateFinIntervention) },
            { label: t("Heures saisies"), value: i.nbrHeure != null ? `${i.nbrHeure} h` : null },
            { label: t("Temps passé"), value: <TempsPasse objet={i} etatEnCours={INTERVENANT_EN_COURS} maintenant={maintenantI} /> },
          ]}
          sections={[
            {
              key: 'cout',
              label: t("Coûts"),
              icon: Euro,
              content: (
                <BmdFieldGrid
                  fields={[
                    { label: t("Nombre d'heures"), value: i.nbrHeure != null ? `${i.nbrHeure} h` : null },
                    { label: t("Coût unitaire"), value: i.coutUnitaire != null ? `${formatMontant(i.coutUnitaire)} / h` : null },
                    { label: t("Main d'œuvre"), value: mainOeuvre != null ? formatMontant(mainOeuvre) : null },
                    { label: t("Forfait"), value: i.forfait != null ? formatMontant(i.forfait) : null },
                    { label: t("Total"), value: total != null ? formatMontant(total) : null },
                  ]}
                />
              ),
            },
            {
              key: 'historique',
              label: t("Historique"),
              icon: Clock,
              wide: true,
              count: historiqueParIntervenant[i.id] ? historique.length : null,
              content: loadingHistoId === i.id ? (
                <p className="bmd-empty"><Loader2 size={20} className="spinner" /> {t("Chargement...")}</p>
              ) : historique.length === 0 ? (
                <TexteOuVide vide="Aucun historique pour cet intervenant." />
              ) : (
                <ul className="bmd-history-list">
                  {historique.map((h) => (
                    <li key={h.id} className="bmd-history-row">
                      <span className="bmd-history-action">{t(libelleActionHistoriqueIntervenant(h.action))}</span>
                      <span className="bmd-history-date">{formatDateTime(h.date)}</span>
                      <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'commentaire',
              label: t("Commentaire"),
              icon: MessageSquare,
              content: <TexteOuVide texte={i.commentaire} vide="Aucun commentaire." />,
            },
          ]}
        />
        {modal}
      </>
    );
  }

  // ---------- TABLEAU ----------
  const colonnes = [
    { key: 'nom', label: t("Intervenant"), render: (i) => <span className="bmd-cell-main">{nomIntervenantAffiche(i)}</span> },
    { key: 'type', label: t("Type"), render: (i) => typeIntervenant(i) },
    {
      key: 'etat',
      label: t("État"),
      render: (i) => (i.etat != null ? <Pill tone={INTERVENANT_ETAT_TONE[i.etat]}>{INTERVENANT_ETAT_LABELS[i.etat] || i.etat}</Pill> : null),
    },
    {
      key: 'periode',
      label: t("Période"),
      render: (i) => ((i.dateDebutIntervention || i.dateFinIntervention)
        ? <span className="bmd-cell-nowrap">{formatDateTime(i.dateDebutIntervention)} → {formatDateTime(i.dateFinIntervention)}</span>
        : null),
    },
    {
      key: 'temps',
      label: t("Temps passé"),
      render: (i) => <TempsPasse objet={i} etatEnCours={INTERVENANT_EN_COURS} maintenant={maintenantI} vide={null} />,
    },
    { key: 'heures', label: t("Heures saisies"), align: 'right', render: (i) => (i.nbrHeure != null ? `${i.nbrHeure} h` : null) },
    {
      key: 'cout',
      label: t("Coût total"),
      align: 'right',
      render: (i) => (coutIntervenant(i) != null ? <span className="bmd-cell-main bmd-cell-nowrap">{formatMontant(coutIntervenant(i))}</span> : null),
    },
  ];

  return (
    <div>
      <PanelHeader
        titre={t("Intervenants")}
        count={intervenants.length}
        extra={(coutTotal > 0 || tempsTotalIntervenants) && (
          <>
            {tempsTotalIntervenants && (
              <span className="bmd-panel-cout-total bmd-temps-total" title={t("Somme du temps passé par tous les intervenants")}>
                {t("Temps passé :")} {formatTemps(tempsTotalIntervenants.secondes)}
              </span>
            )}
            {coutTotal > 0 && <span className="bmd-panel-cout-total">{t("Total :")} {formatMontant(coutTotal)}</span>}
          </>
        )}
        showForm={showForm}
        onToggle={() => (showForm ? fermerForm() : (setForm(emptyIntervenantForm), setEditingId(null), setShowForm(true)))}
        labelAjout="Ajouter un intervenant"
      />

      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier l'intervenant") : t("Nouvel intervenant")}
          intro={t("Ajoutez la personne ou l'entreprise qui répare l'équipement.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Qui répare ?")} aide={t("Choisissez un technicien de l'équipe, ou un sous-traitant")}>
            <BmfChamp label={t("Technicien de l'équipe")} htmlFor="int-tech">
              <SearchableSelect
                id="int-tech"
                name="personnelId"
                value={form.personnelId}
                onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
                options={personnels}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun technicien ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => nomPersonnel(p)}
              />
            </BmfChamp>
            <BmfChamp label={t("Ou un sous-traitant")} htmlFor="int-st">
              <SearchableSelect
                id="int-st"
                name="sousTraitantId"
                value={form.sousTraitantId}
                onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
                options={prestataires}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun sous-traitant ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("Où en est le travail ?")}>
            <BmfChamp label={t("État")} large aide={t("Choisissez « Terminé » quand la réparation est finie")}>
              <BmfChoix
                nom={t("État de l'intervenant")}
                effacable={false}
                value={form.etat}
                onChange={(v) => setForm({ ...form, etat: v })}
                options={Object.entries(INTERVENANT_ETAT_LABELS).map(([val, label]) => ({
                  value: val, label, ton: { 0: 'info', 1: 'brand', 2: 'ok', 10: 'calme' }[val],
                }))}
              />
            </BmfChamp>
            <BmfChamp label={t("Début")} htmlFor="int-debut">
              <BmfDate id="int-debut" value={form.dateDebutIntervention} onChange={(v) => setForm({ ...form, dateDebutIntervention: v })} />
            </BmfChamp>
            <BmfChamp label={t("Fin")} htmlFor="int-fin">
              <BmfDate id="int-fin" value={form.dateFinIntervention} onChange={(v) => setForm({ ...form, dateFinIntervention: v })} />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={3} titre={t("Combien ça coûte ?")} aide={t("Le total se calcule tout seul")}>
            <BmfChamp label={t("Heures travaillées")} htmlFor="int-h">
              <BmfNombre id="int-h" value={form.nbrHeure} onChange={(v) => setForm({ ...form, nbrHeure: v })} unite="h" min="0" placeholder={t("Ex. 3")} />
            </BmfChamp>
            <BmfChamp label={t("Prix de l'heure")} htmlFor="int-cu">
              <BmfNombre id="int-cu" value={form.coutUnitaire} onChange={(v) => setForm({ ...form, coutUnitaire: v })} unite="DT/h" min="0" placeholder={t("Ex. 25")} />
            </BmfChamp>
            <BmfChamp label={t("Forfait")} aide={t("Un montant fixe en plus, par exemple le déplacement")} htmlFor="int-forfait">
              <BmfNombre id="int-forfait" value={form.forfait} onChange={(v) => setForm({ ...form, forfait: v })} unite="DT" min="0" placeholder={t("Ex. 40")} />
            </BmfChamp>
            <BmfChamp
              label={t("Commentaire")}
              large
              htmlFor="int-com"
              info={(form.nbrHeure || form.coutUnitaire || form.forfait)
                ? t('Total : {montant}', { montant: formatMontant((Number(form.nbrHeure) || 0) * (Number(form.coutUnitaire) || 0) + (Number(form.forfait) || 0)) })
                : null}
            >
              <BmfTexte id="int-com" value={form.commentaire} onChange={(v) => setForm({ ...form, commentaire: v })} placeholder={t("Ex. pièce à commander, retour prévu demain")} />
            </BmfChamp>
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Ajouter l'intervenant")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}

      <BmdDataTable
        columns={colonnes}
        rows={intervenants}
        loading={loading}
        onRowClick={ouvrirDetail}
        emptyMessage={t("Aucun intervenant pour l'instant.")}
        searchPlaceholder={t("Filtrer par nom, commentaire...")}
        getSearchText={(i) => [nomIntervenantAffiche(i), typeIntervenant(i), i.commentaire].join(' ')}
      />
      {modal}
    </div>
  );
}

// ============================================================
// ONGLET CONTRÔLE
// ============================================================
const emptyControleForm = {
  personnelId: '', typeControle: '', resultat: '', valeurMesuree: '', valeurAttendue: '',
  conforme: '', observations: '', lotArticleImmobilistationId: '',
};

const pillConformite = (conforme) => {
  if (conforme === true) return <Pill tone="green">{t("Conforme")}</Pill>;
  if (conforme === false) return <Pill tone="red">{t("Non conforme")}</Pill>;
  return <Pill tone="slate">{t("Non renseigné")}</Pill>;
};

export function ControleEquipementTab({ bonMaintenanceId, defaultLotArticleImmobilistationId, autoOpenForm = false }) {
  const [controles, setControles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [form, setForm] = useState(emptyControleForm);
  const [lastPersonnelId, setLastPersonnelId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();

  const openForm = () => {
    setForm({
      ...emptyControleForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      personnelId: lastPersonnelId,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const fermerForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  // Modification : le formulaire s'ouvre au-dessus du tableau, pré-rempli
  const startEdit = (c) => {
    setForm({
      personnelId: c.personnelId ?? '',
      typeControle: c.typeControle || '',
      resultat: c.resultat || '',
      valeurMesuree: c.valeurMesuree ?? '',
      valeurAttendue: c.valeurAttendue ?? '',
      conforme: c.conforme == null ? '' : String(c.conforme),
      observations: c.observations || '',
      lotArticleImmobilistationId: c.lotArticleImmobilistationId != null ? String(c.lotArticleImmobilistationId) : '',
    });
    setEditingId(c.id);
    setSelectedId(null);
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceControleEquipementService.getByBonMaintenance(bonMaintenanceId);
      setControles(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);
  useEffect(() => { if (autoOpenForm) openForm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    personnelService.getMaintenance(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error); // service maintenance (63)
    obtenirEquipements().then(setImmobilisations).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      const payload = {
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        personnelNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        typeControle: form.typeControle || null,
        resultat: form.resultat.trim() || null,
        valeurMesuree: form.valeurMesuree === '' ? null : Number(form.valeurMesuree),
        valeurAttendue: form.valeurAttendue === '' ? null : Number(form.valeurAttendue),
        conforme: form.conforme === '' ? null : form.conforme === 'true',
        observations: form.observations.trim() || null,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
      };
      const idModifie = editingId;
      if (idModifie) {
        const existant = controles.find((x) => x.id === idModifie) || {};
        if (!payload.personnelNom && payload.personnelId === existant.personnelId) payload.personnelNom = existant.personnelNom ?? null;
        await bonMaintenanceControleEquipementService.update(idModifie, { ...existant, ...payload });
      } else {
        await bonMaintenanceControleEquipementService.create(payload);
      }
      setLastPersonnelId(form.personnelId);
      setForm(emptyControleForm);
      fermerForm();
      await load();
      if (idModifie) setSelectedId(idModifie);
    } catch (err) {
      console.error(err);
      alert(editingId ? t("Échec de la modification du contrôle.") : t("Échec de l'ajout du contrôle."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer le contrôle"),
      message: t("Supprimer ce contrôle ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceControleEquipementService.remove(id);
          setControles((prev) => prev.filter((c) => c.id !== id));
          setSelectedId(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  const findImmo = (id) => immobilisations.find((i) => String(i.id) === String(id));
  const libelleImmo = (id) => (id == null ? null : (findImmo(id)?.designation || `#${id}`));

  const modal = (
    <ConfirmModal
      show={confirmModal.show}
      onClose={closeConfirmModal}
      onConfirm={confirmModal.onConfirm}
      type="danger"
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={t("Supprimer")}
    />
  );

  // ---------- DÉTAIL ----------
  const selected = controles.find((c) => c.id === selectedId);
  if (selected) {
    const c = selected;
    const aDesMesures = c.valeurMesuree != null || c.valeurAttendue != null;
    let ecart = null;
    if (c.valeurMesuree != null && c.valeurAttendue != null) {
      const diff = Number(c.valeurMesuree) - Number(c.valeurAttendue);
      const pct = Number(c.valeurAttendue) !== 0 ? ` (${((diff / Number(c.valeurAttendue)) * 100).toFixed(1)} %)` : '';
      ecart = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${pct}`;
    }

    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux contrôles")}
          icon={FileCheck}
          surtitre={t('Contrôle #{id}', { id: c.id })}
          title={c.typeControle || t("Contrôle équipement")}
          onEdit={() => startEdit(c)}
          badges={pillConformite(c.conforme)}
          onDelete={() => handleDelete(c.id)}
          infos={[
            { label: t("Date du contrôle"), value: formatDateTime(c.dateControle) },
            { label: t("Contrôleur"), value: c.personnelNom },
            { label: t("Type de contrôle"), value: c.typeControle },
            { label: t("Conformité"), value: c.conforme == null ? null : (c.conforme ? 'Conforme' : 'Non conforme') },
            { label: t("Immobilisation"), value: libelleImmo(c.lotArticleImmobilistationId), wide: true },
          ]}
          sections={[
            {
              key: 'mesures',
              label: t("Mesures"),
              icon: Gauge,
              content: aDesMesures ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("Valeur mesurée"), value: c.valeurMesuree },
                    { label: t("Valeur attendue"), value: c.valeurAttendue },
                    { label: t("Écart"), value: ecart },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Aucune mesure saisie pour ce contrôle." />
              ),
            },
            {
              key: 'resultat',
              label: t("Résultat & observations"),
              icon: FileText,
              content: (c.resultat || c.observations) ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("Résultat"), value: c.resultat, wide: true },
                    { label: t("Observations"), value: c.observations, wide: true },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Aucun résultat ni observation." />
              ),
            },
            {
              key: 'equipement',
              label: t("Équipement"),
              icon: Building2,
              content: <FicheEquipement immo={findImmo(c.lotArticleImmobilistationId)} id={c.lotArticleImmobilistationId} />,
            },
          ]}
        />
        {modal}
      </>
    );
  }

  // ---------- TABLEAU ----------
  const colonnes = [
    { key: 'date', label: t("Date"), render: (c) => <span className="bmd-cell-nowrap">{formatDateTime(c.dateControle)}</span> },
    { key: 'type', label: t("Type"), render: (c) => <span className="bmd-cell-main">{c.typeControle || t("Contrôle")}</span> },
    { key: 'controleur', label: t("Contrôleur"), render: (c) => c.personnelNom },
    { key: 'immo', label: t("Immobilisation"), render: (c) => libelleImmo(c.lotArticleImmobilistationId) },
    {
      key: 'mesure',
      label: t('Mesuré / attendu'),
      align: 'right',
      render: (c) => ((c.valeurMesuree != null || c.valeurAttendue != null)
        ? `${c.valeurMesuree ?? '—'} / ${c.valeurAttendue ?? '—'}`
        : null),
    },
    { key: 'conforme', label: t("Conformité"), render: (c) => pillConformite(c.conforme) },
  ];

  return (
    <div>
      <PanelHeader
        titre={t("Contrôles équipement")}
        count={controles.length}
        showForm={showForm}
        onToggle={() => (showForm ? fermerForm() : openForm())}
        labelAjout="Ajouter un contrôle"
      />

      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier le contrôle") : t("Nouveau contrôle")}
          intro={t("Testez l'équipement, puis dites simplement s'il fonctionne.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Le résultat")} aide={t("La réponse la plus importante")}>
            <BmfChamp label={t("L'équipement fonctionne-t-il ?")} large>
              <BmfChoix
                nom={t("Conformité")}
                grand
                value={form.conforme}
                onChange={(v) => setForm({ ...form, conforme: v })}
                options={[
                  { value: 'true', label: t("Oui, ça fonctionne"), aide: t("L'équipement a passé le test"), icon: CheckCircle, ton: 'ok' },
                  { value: 'false', label: t("Non, ça ne fonctionne pas"), aide: t("Une nouvelle réparation sera nécessaire"), icon: XCircle, ton: 'alert' },
                ]}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("Le test réalisé")}>
            <BmfChamp label={t("Type de contrôle")} large>
              <BmfChoix
                nom={t("Type de contrôle")}
                value={form.typeControle}
                onChange={(v) => setForm({ ...form, typeControle: v })}
                options={TYPE_CONTROLE_OPTIONS.map((tache) => ({ value: tache, label: tache }))}
              />
            </BmfChamp>
            <BmfChamp label={t("Valeur mesurée")} htmlFor="ctrl-mes">
              <BmfNombre id="ctrl-mes" value={form.valeurMesuree} onChange={(v) => setForm({ ...form, valeurMesuree: v })} placeholder={t("Ex. 12,5")} />
            </BmfChamp>
            <BmfChamp
              label={t("Valeur attendue")}
              htmlFor="ctrl-att"
              info={form.valeurMesuree !== '' && form.valeurAttendue !== ''
                ? t('Écart : {ecart}', { ecart: (Number(form.valeurMesuree) - Number(form.valeurAttendue)).toFixed(2) })
                : null}
            >
              <BmfNombre id="ctrl-att" value={form.valeurAttendue} onChange={(v) => setForm({ ...form, valeurAttendue: v })} placeholder={t("Ex. 12")} />
            </BmfChamp>
            <BmfChamp label={t("Résultat en une phrase")} large htmlFor="ctrl-res">
              <BmfTexte id="ctrl-res" value={form.resultat} onChange={(v) => setForm({ ...form, resultat: v })} placeholder={t("Ex. débit stable pendant 10 minutes")} />
            </BmfChamp>
            <BmfChamp label={t("Observations")} large htmlFor="ctrl-obs">
              <BmfTexte id="ctrl-obs" multiligne value={form.observations} onChange={(v) => setForm({ ...form, observations: v })} />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={3} titre={t("Qui, et sur quel équipement ?")}>
            <BmfChamp label={t("Contrôleur")} htmlFor="ctrl-tech">
              <SearchableSelect
                id="ctrl-tech"
                name="personnelId"
                value={form.personnelId}
                onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
                options={personnels}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun technicien ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => nomPersonnel(p)}
                getOptionHint={(p) => (p.matricule ? t('Matricule {m}', { m: p.matricule }) : null)}
              />
            </BmfChamp>
            <BmfChamp label={t("Équipement contrôlé")} aide={t("Déjà rempli avec l'équipement du bon")} htmlFor="ctrl-immo">
              <SearchableSelect
                id="ctrl-immo"
                name="lotArticleImmobilistationId"
                value={form.lotArticleImmobilistationId}
                onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
                options={immobilisations}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun équipement ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(i) => i.id}
                getLabel={(i) => i.designation || `#${i.id}`}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer le contrôle")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}

      <BmdDataTable
        columns={colonnes}
        rows={controles}
        loading={loading}
        onRowClick={(c) => setSelectedId(c.id)}
        emptyMessage={t("Aucun contrôle pour l'instant.")}
        searchPlaceholder={t("Filtrer par type, contrôleur, résultat...")}
        getSearchText={(c) => [c.typeControle, c.personnelNom, c.resultat, c.observations, libelleImmo(c.lotArticleImmobilistationId)].join(' ')}
      />
      {modal}
    </div>
  );
}

// ============================================================
// ONGLET REMISE EN SERVICE
// ============================================================
const emptyRemiseForm = {
  lotArticleImmobilistationId: '', conforme: '', autoriseParId: '', observations: '',
  etatAvant: '', etatApres: '',
};

export function RemiseEnServiceTab({ bonMaintenanceId, defaultLotArticleImmobilistationId, onBonMaybeChanged, onCelebrer, autoOpenForm = false }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [form, setForm] = useState(emptyRemiseForm);
  const [lastAutoriseParId, setLastAutoriseParId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();

  const openForm = () => {
    setForm({
      ...emptyRemiseForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
      autoriseParId: lastAutoriseParId,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const fermerForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  // Modification : le formulaire s'ouvre au-dessus du tableau, pré-rempli
  const startEdit = (d) => {
    setForm({
      lotArticleImmobilistationId: d.lotArticleImmobilistationId != null ? String(d.lotArticleImmobilistationId) : '',
      conforme: d.conforme == null ? '' : String(d.conforme),
      autoriseParId: d.autoriseParId ?? '',
      observations: d.observations || '',
      etatAvant: d.etatAvant != null ? String(d.etatAvant) : '',
      etatApres: d.etatApres != null ? String(d.etatApres) : '',
    });
    setEditingId(d.id);
    setSelectedId(null);
    setShowForm(true);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bonMaintenanceId);
      setDecisions(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);
  useEffect(() => { if (autoOpenForm) openForm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    personnelService.getMaintenance(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error); // service maintenance (63)
    obtenirEquipements().then(setImmobilisations).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (form.conforme === '') {
      alert(t("Merci de préciser si la remise en service est autorisée ou non."));
      return;
    }
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.autoriseParId));
      const payload = {
        bonMaintenanceId,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId),
        conforme: form.conforme === 'true',
        autoriseParId: form.autoriseParId === '' ? null : Number(form.autoriseParId),
        autoriseParNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        observations: form.observations.trim() || null,
        etatAvant: form.etatAvant === '' ? null : Number(form.etatAvant),
        etatApres: form.etatApres === '' ? null : Number(form.etatApres),
      };
      const idModifie = editingId;
      const existant = idModifie ? (decisions.find((x) => x.id === idModifie) || {}) : null;
      if (idModifie) {
        if (!payload.autoriseParNom && payload.autoriseParId === existant.autoriseParId) payload.autoriseParNom = existant.autoriseParNom ?? null;
        await bonMaintenanceRemiseEnServiceService.update(idModifie, { ...existant, ...payload });
      } else {
        await bonMaintenanceRemiseEnServiceService.create(payload);
      }
      const autorisee = form.conforme === 'true';
      const immo = immobilisations.find((i) => String(i.id) === String(form.lotArticleImmobilistationId));
      setLastAutoriseParId(form.autoriseParId);
      setForm(emptyRemiseForm);
      fermerForm();
      await load();
      if (idModifie) {
        setSelectedId(idModifie);
      } else {
        onCelebrer?.(autorisee ? 'remise-autorisee' : 'remise-refusee', immo?.designation || null);
      }
      onBonMaybeChanged?.(); // une remise en service conforme peut déclencher la clôture automatique
    } catch (err) {
      console.error(err);
      alert(editingId ? t("Échec de la modification de la décision.") : t("Échec de l'enregistrement de la décision."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Supprimer la décision"),
      message: t("Supprimer cette décision de remise en service ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceRemiseEnServiceService.remove(id);
          setDecisions((prev) => prev.filter((d) => d.id !== id));
          setSelectedId(null);
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  const findImmo = (id) => immobilisations.find((i) => String(i.id) === String(id));
  const libelleImmo = (id) => (id == null ? null : (findImmo(id)?.designation || `#${id}`));
  const pillDecision = (conforme) => (conforme
    ? <Pill tone="green">{t("Autorisée")}</Pill>
    : <Pill tone="red">{t("Refusée")}</Pill>);

  const modal = (
    <ConfirmModal
      show={confirmModal.show}
      onClose={closeConfirmModal}
      onConfirm={confirmModal.onConfirm}
      type="danger"
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={t("Supprimer")}
    />
  );

  // ---------- DÉTAIL ----------
  const selected = decisions.find((d) => d.id === selectedId);
  if (selected) {
    const d = selected;
    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux décisions")}
          icon={RotateCw}
          surtitre={t('Décision #{id}', { id: d.id })}
          title={d.conforme ? t("Remise en service autorisée") : t("Remise en service refusée")}
          onEdit={() => startEdit(d)}
          badges={pillDecision(d.conforme)}
          onDelete={() => handleDelete(d.id)}
          infos={[
            { label: t("Date"), value: formatDateTime(d.date) },
            { label: t("Autorisé par"), value: d.autoriseParNom },
            { label: t("Décision"), value: d.conforme ? 'Autorisée' : 'Refusée' },
            { label: t("Immobilisation"), value: libelleImmo(d.lotArticleImmobilistationId) },
          ]}
          sections={[
            {
              key: 'etat',
              label: t("État de l'immobilisation"),
              icon: Activity,
              content: (d.etatAvant != null || d.etatApres != null) ? (
                <BmdFieldGrid
                  fields={[
                    { label: t("État avant"), value: libelleEtatImmo(d.etatAvant) },
                    { label: t("État après"), value: libelleEtatImmo(d.etatApres) },
                  ]}
                />
              ) : (
                <TexteOuVide vide="Aucun état renseigné." />
              ),
            },
            {
              key: 'observations',
              label: t("Observations"),
              icon: FileText,
              content: <TexteOuVide texte={d.observations} vide="Aucune observation." />,
            },
            {
              key: 'equipement',
              label: t("Équipement"),
              icon: Building2,
              content: <FicheEquipement immo={findImmo(d.lotArticleImmobilistationId)} id={d.lotArticleImmobilistationId} />,
            },
          ]}
        />
        {modal}
      </>
    );
  }

  // ---------- TABLEAU ----------
  const colonnes = [
    { key: 'date', label: t("Date"), render: (d) => <span className="bmd-cell-nowrap">{formatDateTime(d.date)}</span> },
    { key: 'decision', label: t("Décision"), render: (d) => pillDecision(d.conforme) },
    { key: 'par', label: t("Autorisé par"), render: (d) => (d.autoriseParNom ? <span className="bmd-cell-main">{d.autoriseParNom}</span> : null) },
    { key: 'immo', label: t("Immobilisation"), render: (d) => libelleImmo(d.lotArticleImmobilistationId) },
    { key: 'etatApres', label: t("État après"), render: (d) => libelleEtatImmo(d.etatApres) },
  ];

  return (
    <div>
      <PanelHeader
        titre={t("Remise en service")}
        count={decisions.length}
        showForm={showForm}
        onToggle={() => (showForm ? fermerForm() : openForm())}
        labelAjout="Ajouter une décision"
      />

      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier la décision") : t("Remise en service")}
          intro={t("Décidez si l'équipement peut retourner dans son service.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Votre décision")}>
            <BmfChamp label={t("L'équipement peut-il repartir ?")} requis large>
              <BmfChoix
                nom={t("Décision de remise en service")}
                grand
                effacable={false}
                value={form.conforme}
                onChange={(v) => setForm({ ...form, conforme: v })}
                options={[
                  { value: 'true', label: t("Oui, il peut repartir"), aide: t("Il est conforme et retourne au service"), icon: Power, ton: 'ok' },
                  { value: 'false', label: t("Non, pas encore"), aide: t("Il reste au service technique"), icon: XCircle, ton: 'alert' },
                ]}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("L'équipement")}>
            <BmfChamp label={t("Équipement concerné")} aide={t("Déjà rempli avec l'équipement du bon")} htmlFor="rs-immo">
              <SearchableSelect
                id="rs-immo"
                name="lotArticleImmobilistationId"
                value={form.lotArticleImmobilistationId}
                onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
                options={immobilisations}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucun équipement ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(i) => i.id}
                getLabel={(i) => i.designation || `#${i.id}`}
              />
            </BmfChamp>
            <BmfChamp label={t("Dans quel état repart-il ?")} large>
              <BmfChoix
                nom={t("État de l'équipement après")}
                value={form.etatApres}
                onChange={(v) => setForm({ ...form, etatApres: v })}
                options={ETAT_IMMOBILISATION_OPTIONS.map((o) => ({
                  value: String(o.value), label: o.label, ton: { 1: 'now', 2: 'alert', 3: 'now', 4: 'calme' }[o.value],
                }))}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={3} titre={t("Qui autorise ?")}>
            <BmfChamp label={t("Autorisé par")} htmlFor="rs-par">
              <SearchableSelect
                id="rs-par"
                name="autoriseParId"
                value={form.autoriseParId}
                onChange={(e) => setForm({ ...form, autoriseParId: e.target.value })}
                options={personnels}
                placeholder={t("Tapez un nom...")}
                emptyMessage={t("Aucune personne ne correspond")}
                allowEmpty
                emptyOptionLabel={t("Aucun")}
                getValue={(p) => p.id}
                getLabel={(p) => nomPersonnel(p)}
              />
            </BmfChamp>
            <BmfChamp label={t("Observations")} large htmlFor="rs-obs">
              <BmfTexte id="rs-obs" multiligne value={form.observations} onChange={(v) => setForm({ ...form, observations: v })} />
            </BmfChamp>
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer la décision")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}

      <BmdDataTable
        columns={colonnes}
        rows={decisions}
        loading={loading}
        onRowClick={(d) => setSelectedId(d.id)}
        emptyMessage={t("Aucune décision de remise en service pour l'instant.")}
        searchPlaceholder={t("Filtrer par personne, observation...")}
        getSearchText={(d) => [d.autoriseParNom, d.observations, libelleImmo(d.lotArticleImmobilistationId), d.conforme ? 'autorisée' : 'refusée'].join(' ')}
      />
      {modal}
    </div>
  );
}