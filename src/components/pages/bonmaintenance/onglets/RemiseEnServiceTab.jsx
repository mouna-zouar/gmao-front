import { useEffect, useState } from 'react';
import { RotateCw, Building2, FileText, Activity, XCircle, Power, ShieldAlert } from 'lucide-react';
import {
  BmfFormulaire,
  BmfEtape,
  BmfChamp,
  BmfChoix,
  BmfTexte,
  BmfActions,
  BmdDataTable,
  BmdDetailView,
  BmdFieldGrid,
  Pill,
  TexteOuVide,
  SearchableSelect,
  ETAT_IMMOBILISATION_OPTIONS,
  formatDateTime,
  useConfirmModal,
  PanelHeader,
  FicheEquipement,
  EquipementDuBon,
} from '../BmdCommun';
import bonMaintenanceControleEquipementService from '../../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../../services/bonMaintenanceRemiseEnServiceService';
import authService from '../../../../services/Authservice';
import '../BmdRemise.css';
import { obtenirEquipements } from '../../../../store/referentiels';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { t } from '../../../../i18n';
import { Modale } from '../../../commun';

const libelleEtatImmo = (v) => ETAT_IMMOBILISATION_OPTIONS.find((o) => o.value === v)?.label ?? null;

const emptyRemiseForm = {
  lotArticleImmobilistationId: '', conforme: '', observations: '',
  etatAvant: '', etatApres: '',
};

function utilisateurConnecte() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    id: id != null && id !== '' ? Number(id) : null,
    nom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}

export function RemiseEnServiceTab({ bonMaintenanceId, defaultLotArticleImmobilistationId, onBonMaybeChanged, onCelebrer, autoOpenForm = false }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [immobilisations, setImmobilisations] = useState([]);
  const [form, setForm] = useState(emptyRemiseForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [demandeEnCours, setDemandeEnCours] = useState(false);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();
  const [controles, setControles] = useState(null);
  const chargerControles = () => bonMaintenanceControleEquipementService.getByBonMaintenance(bonMaintenanceId)
    .then((l) => setControles([...(l ?? [])].sort((x, y) => String(y.dateControle || '').localeCompare(String(x.dateControle || '')))))
    .catch(() => setControles([]));
  useEffect(() => {
    chargerControles();
    const surEcriture = () => chargerControles();
    window.addEventListener('gmao:ecriture', surEcriture);
    return () => window.removeEventListener('gmao:ecriture', surEcriture);
  }, [bonMaintenanceId]); 
  const controleFait = (controles?.length ?? 0) > 0;
  const dernierControleNonConforme = controleFait && controles[0].conforme === false;
  const messageServeur = (err) => err?.response?.data?.message || err?.response?.data?.error || null;

  const demande = decisions.find((d) => d.conforme == null) || null;
  const dejaAutorisee = decisions.some((d) => d.conforme === true);

  const demander = async () => {
    const moi = utilisateurConnecte();
    setDemandeEnCours(true);
    try {
      await bonMaintenanceRemiseEnServiceService.demander({
        bonMaintenanceId,
        lotArticleImmobilistationId: defaultLotArticleImmobilistationId ?? null,
        demandeParId: moi.id,
        demandeParNom: moi.nom,
      });
      await load();
      onBonMaybeChanged?.();
    } catch (err) {
      console.error('[GMAO remise en service] Demande :', err);
      alert(messageServeur(err) || t("La demande de remise en service n'a pas pu être enregistrée."));
    } finally {
      setDemandeEnCours(false);
    }
  };

  const openForm = () => {
    setForm({
      ...emptyRemiseForm,
      lotArticleImmobilistationId: defaultLotArticleImmobilistationId != null ? String(defaultLotArticleImmobilistationId) : '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const fermerForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (d) => {
    setForm({
      lotArticleImmobilistationId: d.lotArticleImmobilistationId != null ? String(d.lotArticleImmobilistationId) : '',
      conforme: d.conforme == null ? '' : String(d.conforme),
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
  useEffect(() => { if (autoOpenForm) openForm(); }, []); 

  useEffect(() => {
    obtenirEquipements().then(setImmobilisations).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (form.conforme === '') {
      alert(t("Merci de préciser si la remise en service est autorisée ou non."));
      return;
    }
    if (form.conforme === 'true' && !controleFait) {
      alert(t("Faites d'abord le contrôle de l'équipement (onglet Contrôle) : la remise en service n'est possible qu'après le contrôle."));
      return;
    }
    if (form.conforme === 'true' && dernierControleNonConforme) {
      alert(t("Le dernier contrôle de l'équipement n'est pas conforme : refaites un contrôle conforme avant d'autoriser la remise en service."));
      return;
    }
    setSaving(true);
    try {
      const moi = utilisateurConnecte();
      const payload = {
        bonMaintenanceId,
        lotArticleImmobilistationId: defaultLotArticleImmobilistationId ?? (form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId)),
        conforme: form.conforme === 'true',
        autoriseParId: moi.id,
        autoriseParNom: moi.nom,
        observations: form.observations.trim() || null,
        etatAvant: form.etatAvant === '' ? null : Number(form.etatAvant),
        etatApres: form.etatApres === '' ? null : Number(form.etatApres),
      };
      const idModifie = editingId;
      const existant = idModifie ? (decisions.find((x) => x.id === idModifie) || {}) : null;
      if (idModifie) {
        await bonMaintenanceRemiseEnServiceService.update(idModifie, { ...existant, ...payload });
      } else {
        await bonMaintenanceRemiseEnServiceService.create(payload);
      }
      const autorisee = form.conforme === 'true';
      const immo = immobilisations.find((i) => String(i.id) === String(form.lotArticleImmobilistationId));
      setForm(emptyRemiseForm);
      fermerForm();
      await load();
      if (idModifie) {
        setSelectedId(idModifie);
      } else {
        onCelebrer?.(autorisee ? 'remise-autorisee' : 'remise-refusee', immo?.designation || null);
      }
      onBonMaybeChanged?.();
    } catch (err) {
      console.error(err);
      alert(messageServeur(err) || (editingId ? t("Échec de la modification de la décision.") : t("Échec de l'enregistrement de la décision.")));
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
  const pillDecision = (conforme) => (conforme == null
    ? <Pill tone="amber">{t("Demandée")}</Pill>
    : conforme
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

  const selected = decisions.find((d) => d.id === selectedId);
  const detailJsx = selected ? (() => {
    const d = selected;
    return (
      <>
        <BmdDetailView
          onBack={() => setSelectedId(null)}
          backLabel={t("Retour aux décisions")}
          icon={RotateCw}
          surtitre={t('Décision #{id}', { id: d.id })}
          title={d.conforme == null ? t("Remise en service demandée") : d.conforme ? t("Remise en service autorisée") : t("Remise en service refusée")}
          onEdit={() => startEdit(d)}
          badges={pillDecision(d.conforme)}
          onDelete={() => handleDelete(d.id)}
          infos={[
            { label: t("Date"), value: formatDateTime(d.date) },
            { label: t("Autorisé par"), value: d.autoriseParNom },
            { label: t("Décision"), value: d.conforme == null ? t('En attente') : d.conforme ? t('Autorisée') : t('Refusée') },
            { label: t("Demandée par"), value: d.demandeParNom },
            { label: t("Date de la demande"), value: d.dateDemande ? formatDateTime(d.dateDemande) : null },
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
      </>
    );
  })() : null;


  const colonnes = [
    { key: 'date', label: t("Date"), render: (d) => <span className="bmd-cell-nowrap">{formatDateTime(d.date)}</span> },
    { key: 'decision', label: t("Décision"), render: (d) => pillDecision(d.conforme) },
    { key: 'demande', label: t("Demandée par"), render: (d) => d.demandeParNom || null },
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

      {!showForm && !loading && controles !== null && !dejaAutorisee && (!controleFait || dernierControleNonConforme) && (
        <div className="bmd-rs-bloque" role="note">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>
            {!controleFait
              ? t("Contrôle de l'équipement obligatoire : faites d'abord le contrôle (onglet Contrôle), la remise en service sera possible ensuite.")
              : t("Le dernier contrôle n'est pas conforme : refaites un contrôle conforme avant d'autoriser la remise en service.")}
          </span>
        </div>
      )}

      {!showForm && !loading && (demande ? (
        <div className="bmd-rs-demande">
          <span><Pill tone="amber">{t("Demandée")}</Pill> {[demande.demandeParNom, demande.dateDemande && formatDateTime(demande.dateDemande)].filter(Boolean).join(' · ')}</span>
          <button type="button" className="bmd-add-btn" onClick={openForm} disabled={!controleFait}
            title={!controleFait ? t("Faites d'abord le contrôle de l'équipement") : undefined}>
            <Power size={16} /> {t("Faire la remise en service")}
          </button>
        </div>
      ) : !dejaAutorisee && (
        <div className="bmd-rs-demande">
          <button type="button" className="bmd-add-btn" onClick={demander} disabled={demandeEnCours || !controleFait}
            title={!controleFait ? t("Faites d'abord le contrôle de l'équipement") : undefined}>
            <RotateCw size={16} /> {demandeEnCours ? t("Envoi…") : t("Demander la remise en service")}
          </button>
        </div>
      ))}

      <Modale ouvert={showForm} onFermer={fermerForm} taille="lg" className="bmd-modale-sous" icone={Power}
        titre={editingId ? t("Modifier : remise en service") : t("Remise en service")}>
      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier la décision") : t("Remise en service")}
          intro={t("Décidez si l'équipement peut retourner dans son service.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Votre décision")}>
            <BmfChamp label={t("Retour au service")} requis large>
              <BmfChoix
                nom={t("Décision de remise en service")}
                grand
                effacable={false}
                value={form.conforme}
                onChange={(v) => setForm({ ...form, conforme: v })}
                options={[
                  {
                    value: 'true', label: t("Autorisé"), icon: Power, ton: 'ok',
                    aide: !controleFait ? t("Impossible : contrôle de l'équipement pas encore fait")
                      : dernierControleNonConforme ? t("Impossible : le dernier contrôle n'est pas conforme")
                        : t("Il est conforme et retourne au service"),
                    disabled: !controleFait || dernierControleNonConforme,
                  },
                  { value: 'false', label: t("Pas encore"), aide: t("Il reste au service technique"), icon: XCircle, ton: 'alert' },
                ]}
              />
            </BmfChamp>
          </BmfEtape>

          <BmfEtape numero={2} titre={t("L'équipement")}>
            <BmfChamp label={t("Équipement concerné")} aide={t("Repris automatiquement du bon")} htmlFor="rs-immo">
              {defaultLotArticleImmobilistationId != null ? (
                <EquipementDuBon id={defaultLotArticleImmobilistationId} immobilisations={immobilisations} />
              ) : (
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
              )}
            </BmfChamp>
            <BmfChamp label={t("État de l'équipement après")} large>
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

          <BmfEtape numero={3} titre={t("Observations")}>
            <BmfChamp label={t("Observations")} large htmlFor="rs-obs">
              <BmfTexte id="rs-obs" multiligne value={form.observations} onChange={(v) => setForm({ ...form, observations: v })} />
            </BmfChamp>
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer la décision")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}
      </Modale>

      <BmdDataTable
        columns={colonnes}
        rows={decisions}
        loading={loading}
        onRowClick={(d) => setSelectedId(d.id)}
        emptyMessage={t("Aucune décision de remise en service pour l'instant.")}
        searchPlaceholder={t("Filtrer par personne, observation...")}
        getSearchText={(d) => [d.autoriseParNom, d.demandeParNom, d.observations, libelleImmo(d.lotArticleImmobilistationId), d.conforme == null ? 'demandée' : d.conforme ? 'autorisée' : 'refusée'].join(' ')}
      />
      <Modale ouvert={!!selected} onFermer={() => setSelectedId(null)} taille="lg" className="bmd-modale-sous bmd-modale-detail"
        icone={Power} titre={t("Détail : remise en service")}>
        {detailJsx}
      </Modale>
      {modal}
    </div>
  );
}
