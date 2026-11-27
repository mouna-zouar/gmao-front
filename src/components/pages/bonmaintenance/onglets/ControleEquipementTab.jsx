import { useEffect, useState } from 'react';
import { FileCheck, Building2, FileText, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
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
  TYPE_CONTROLE_OPTIONS,
  formatDateTime,
  nomPersonnel,
  useConfirmModal,
  PanelHeader,
  FicheEquipement,
  EquipementDuBon,
} from '../BmdCommun';
import bonMaintenanceControleEquipementService from '../../../../services/bonMaintenanceControleEquipementService';
import { commePage, obtenirEquipements, obtenirPersonnelsMaintenance } from '../../../../store/referentiels';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { t } from '../../../../i18n';
import { Modale } from '../../../commun';

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
    obtenirPersonnelsMaintenance().then(commePage).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
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
        lotArticleImmobilistationId: defaultLotArticleImmobilistationId ?? (form.lotArticleImmobilistationId === '' ? null : Number(form.lotArticleImmobilistationId)),
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

  const selected = controles.find((c) => c.id === selectedId);
  const detailJsx = selected ? (() => {
    const c = selected;
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
      </>
    );
  })() : null;


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

      <Modale ouvert={showForm} onFermer={fermerForm} taille="lg" className="bmd-modale-sous" icone={ShieldCheck}
        titre={editingId ? t("Modifier : contrôle") : t("Ajouter : contrôle")}>
      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier le contrôle") : t("Nouveau contrôle")}
          intro={t("Testez l'équipement, puis dites simplement s'il fonctionne.")}
          onSubmit={handleAdd}
        >
          <BmfEtape numero={1} titre={t("Le résultat")} aide={t("La réponse la plus importante")}>
            <BmfChamp label={t("Fonctionnement")} large>
              <BmfChoix
                nom={t("Conformité")}
                grand
                value={form.conforme}
                onChange={(v) => setForm({ ...form, conforme: v })}
                options={[
                  { value: 'true', label: t("Fonctionne"), aide: t("L'équipement a passé le test"), icon: CheckCircle, ton: 'ok' },
                  { value: 'false', label: t("Ne fonctionne pas"), aide: t("Une nouvelle réparation sera nécessaire"), icon: XCircle, ton: 'alert' },
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
            
            <BmfChamp label={t("Résultat")} large htmlFor="ctrl-res">
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
            <BmfChamp label={t("Équipement contrôlé")} aide={t("Repris automatiquement du bon")} htmlFor="ctrl-immo">
              {defaultLotArticleImmobilistationId != null ? (
                <EquipementDuBon id={defaultLotArticleImmobilistationId} immobilisations={immobilisations} />
              ) : (
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
              )}
            </BmfChamp>
          </BmfEtape>

          <BmfActions enregistrement={saving} label={editingId ? t("Enregistrer les modifications") : t("Enregistrer le contrôle")} onAnnuler={fermerForm} />
        </BmfFormulaire>
      )}
      </Modale>

      <BmdDataTable
        columns={colonnes}
        rows={controles}
        loading={loading}
        onRowClick={(c) => setSelectedId(c.id)}
        emptyMessage={t("Aucun contrôle pour l'instant.")}
        searchPlaceholder={t("Filtrer par type, contrôleur, résultat...")}
        getSearchText={(c) => [c.typeControle, c.personnelNom, c.resultat, c.observations, libelleImmo(c.lotArticleImmobilistationId)].join(' ')}
      />
      <Modale ouvert={!!selected} onFermer={() => setSelectedId(null)} taille="lg" className="bmd-modale-sous bmd-modale-detail"
        icone={ShieldCheck} titre={t("Détail : contrôle")}>
        {detailJsx}
      </Modale>
      {modal}
    </div>
  );
}
