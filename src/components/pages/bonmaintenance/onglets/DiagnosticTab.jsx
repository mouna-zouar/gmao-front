import { useEffect, useState } from 'react';
import { Search, Building2, FileText, Stethoscope } from 'lucide-react';
import {
  BmfFormulaire,
  BmfEtape,
  BmfChamp,
  BmfChoix,
  BmfNombre,
  BmfTexte,
  BmfStock,
  BmfActions,
  BmdDataTable,
  BmdDetailView,
  Pill,
  TexteOuVide,
  SearchableSelect,
  GRAVITE_LABELS,
  formatDateTime,
  nomPersonnel,
  useConfirmModal,
  PanelHeader,
  FicheEquipement,
  EquipementDuBon,
} from '../BmdCommun';
import bonMaintenanceIntervenantService from '../../../../services/bonMaintenanceIntervenantService';
import bonMaintenancePieceImmoService from '../../../../services/Bonmaintenancepieceimmoservice';
import bonMaintenanceDiagnosticService from '../../../../services/Bonmaintenancediagnosticservice';
import AlerteFormation from '../../Formations/AlerteFormation';
import { commePage, obtenirEquipements, obtenirPersonnelsMaintenance } from '../../../../store/referentiels';
import lotArticleImmobilistationService from '../../../../services/Lotarticleimmobilistationservice';
import lotArticleService from '../../../../services/lotArticleService';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { t } from '../../../../i18n';
import { Modale } from '../../../commun';

const GRAVITE_TONE = { 1: 'blue', 2: 'amber', 3: 'red' };

const emptyDiagnosticForm = {
  personnelId: '', observations: '',
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
  const [form, setForm] = useState(emptyDiagnosticForm);
  const [lastPersonnelId, setLastPersonnelId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const { confirmModal, setConfirmModal, close: closeConfirmModal } = useConfirmModal();

  const [immoQteDisponible, setImmoQteDisponible] = useState(null);
  const [checkingImmoQte, setCheckingImmoQte] = useState(false);

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

  const startEdit = (d) => {
    setForm({
      personnelId: d.personnelId ?? '',
      observations: d.observations || '',
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
  useEffect(() => { if (autoOpenForm) openForm(); }, []); 

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
    obtenirPersonnelsMaintenance().then(commePage).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    obtenirEquipements().then(setImmobilisations).catch(console.error);
    bonMaintenancePieceImmoService.findByBonMaintenanceId(bonMaintenanceId).then((data) => setPiecesImmo(data ?? [])).catch(console.error);
  }, [bonMaintenanceId]);

  const affecterTechnicien = async (personnelId, personnelNom) => {
    if (!personnelId) return;
    try {
      const intervenants = await bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenanceId);
      if ((intervenants ?? []).some((i) => String(i.personnelId) === String(personnelId))) return;
      await bonMaintenanceIntervenantService.create({ bonMaintenanceId, personnelId: Number(personnelId), intervenantNom: personnelNom || null, etat: 0 });
      console.info('[GMAO diagnostic] Technicien affecté au bon', bonMaintenanceId, personnelId);
    } catch (err) {
      console.error('[GMAO diagnostic] Affectation du technicien :', err);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const personnel = personnels.find((p) => String(p.id) === String(form.personnelId));
      const payload = {
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        personnelNom: personnel ? `${personnel.nom} ${personnel.prenom}` : null,
        observations: form.observations.trim() || null,
        lotArticleImmobilistationId: defaultLotArticleImmobilistationId ?? (form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId)),
        bonMaintenancePieceImmoId: form.bonMaintenancePieceImmoId === '' ? null : Number(form.bonMaintenancePieceImmoId),
        causeProbable: form.causeProbable.trim() || null,
        gravite: form.gravite === '' ? null : Number(form.gravite),
        dureeEstimeeHeures: form.dureeEstimeeHeures === '' ? null : Number(form.dureeEstimeeHeures),
      };
      const idModifie = editingId;
      if (idModifie) {
        const existant = diagnostics.find((x) => x.id === idModifie) || {};
        if (!payload.personnelNom && payload.personnelId === existant.personnelId) payload.personnelNom = existant.personnelNom ?? null;
        await bonMaintenanceDiagnosticService.update(idModifie, { ...existant, ...payload });
      } else {
        await bonMaintenanceDiagnosticService.create(payload);
      }
      await affecterTechnicien(payload.personnelId, payload.personnelNom);
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

  const selected = diagnostics.find((d) => d.id === selectedId);
  const detailJsx = selected ? (() => {
    const d = selected;
    const immo = findImmo(d.lotArticleImmobilistationId);

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
              key: 'equipement',
              label: t("Équipement"),
              icon: Building2,
              content: <FicheEquipement immo={immo} id={d.lotArticleImmobilistationId} />,
            },
          ]}
        />
      </>
    );
  })() : null;


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

      <Modale ouvert={showForm} onFermer={fermerForm} taille="lg" className="bmd-modale-sous" icone={Stethoscope}
        titre={editingId ? t("Modifier : diagnostic") : t("Ajouter : diagnostic")}>
      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier le diagnostic") : t("Nouveau diagnostic")}
          intro={t("Décrivez la panne en deux étapes. Seuls les champs marqués « obligatoire » sont nécessaires.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Technicien affecté et équipement")}>
            <BmfChamp label={t("Technicien affecté")} aide={t("Ajouté aux intervenants du bon")} htmlFor="diag-tech">
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
              <AlerteFormation personnelId={form.personnelId} bonMaintenanceId={bonMaintenanceId} />
            </BmfChamp>

            <BmfChamp label={t("Équipement examiné")} aide={t("Repris automatiquement du bon")} htmlFor="diag-immo">
              {defaultLotArticleImmobilistationId != null ? (
                <EquipementDuBon id={defaultLotArticleImmobilistationId} immobilisations={immobilisations} />
              ) : (
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
              )}
              {form.lotArticleImmobilistationId && (
                <BmfStock verification={checkingImmoQte} quantite={immoQteDisponible} />
              )}
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

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer le diagnostic")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}
      </Modale>

      <BmdDataTable
        columns={colonnes}
        rows={diagnostics}
        loading={loading}
        onRowClick={(d) => setSelectedId(d.id)}
        emptyMessage={t("Aucun diagnostic pour l'instant.")}
        searchPlaceholder={t("Filtrer par technicien, cause, équipement...")}
        getSearchText={(d) => [d.personnelNom, d.causeProbable, d.observations, libelleImmo(d.lotArticleImmobilistationId)].join(' ')}
      />
      <Modale ouvert={!!selected} onFermer={() => setSelectedId(null)} taille="lg" className="bmd-modale-sous bmd-modale-detail"
        icone={Stethoscope} titre={t("Détail : diagnostic")}>
        {detailJsx}
      </Modale>
      {modal}
    </div>
  );
}
