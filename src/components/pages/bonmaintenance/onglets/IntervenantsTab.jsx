import { useEffect, useState } from 'react';
import { Users, Loader2, Euro, Clock, MessageSquare } from 'lucide-react';
import {
  BmfFormulaire,
  BmfEtape,
  BmfChamp,
  BmfChoix,
  BmfNombre,
  BmfTexte,
  BmfDate,
  BmfActions,
  BmdDataTable,
  BmdDetailView,
  BmdFieldGrid,
  Pill,
  TexteOuVide,
  SearchableSelect,
  INTERVENANT_ETAT_LABELS,
  formatDateTime,
  formatMontant,
  coutIntervenant,
  nomIntervenantAffiche,
  libelleActionHistoriqueIntervenant,
  TempsPasse,
  totalTemps,
  formatTemps,
  tempsPasse,
  useMaintenant,
  INTERVENANT_EN_COURS,
  nomPersonnel,
  dureeEntre,
  useConfirmModal,
  PanelHeader,
  EquipementDuBon,
} from '../BmdCommun';
import bonMaintenanceIntervenantService from '../../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../../services/Bonmaintenanceintervenanthistoriqueservice';
import AlerteFormation from '../../Formations/AlerteFormation';
import AssistantIntervenants from '../../Formations/AssistantIntervenants';
import { commePage, obtenirPersonnelsMaintenance, obtenirPrestataires } from '../../../../store/referentiels';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { t } from '../../../../i18n';
import { Modale } from '../../../commun';

const INTERVENANT_ETAT_TONE = { 0: 'blue', 1: 'teal', 2: 'green', 10: 'slate' };

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

export function IntervenantsTab({ bonMaintenanceId, defaultLotArticleImmobilistationId = null, onBonMaybeChanged, onCelebrer, autoOpenForm = false }) {
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
  useEffect(() => { if (autoOpenForm) setShowForm(true); }, []); 

  useEffect(() => {
    if (!showForm) return;
    obtenirPersonnelsMaintenance().then(commePage).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
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
          onBonMaybeChanged?.();
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  const handleChangeEtat = async (intervenant, nouvelEtat) => {
    const etat = Number(nouvelEtat);
    if (etat === intervenant.etat) return;
    setSavingEtatId(intervenant.id);
    try {
      const updated = await bonMaintenanceIntervenantService.update(intervenant.id, { ...intervenant, etat });
      setIntervenants((prev) => prev.map((i) => (i.id === intervenant.id ? { ...i, ...updated } : i)));
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

  const selected = intervenants.find((i) => i.id === selectedId);
  const detailJsx = selected ? (() => {
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
      </>
    );
  })() : null;


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

      <Modale ouvert={showForm} onFermer={fermerForm} taille="lg" className="bmd-modale-sous" icone={Users}
        titre={editingId ? t("Modifier : intervenant") : t("Ajouter : intervenant")}>
      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier l'intervenant") : t("Nouvel intervenant")}
          intro={t("Ajoutez la personne ou l'entreprise qui répare l'équipement.")}
          onSubmit={handleAdd}
        >
          <EquipementDuBon id={defaultLotArticleImmobilistationId} />
          <BmfEtape numero={1} titre={t("Qui répare ?")} aide={t("Choisissez un technicien de l'équipe, ou un sous-traitant")}>
            {!editingId && (
              <BmfChamp label={t("Assistant")} large>
                <AssistantIntervenants bonMaintenanceId={bonMaintenanceId} choisi={form.personnelId} personnels={personnels}
                  onChoisir={(id) => setForm((f) => ({ ...f, personnelId: String(id) }))} />
              </BmfChamp>
            )}
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
              <AlerteFormation personnelId={form.personnelId} bonMaintenanceId={bonMaintenanceId} />
            </BmfChamp>
            <BmfChamp label={t("Sous-traitant")} htmlFor="int-st">
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
      </Modale>

      <BmdDataTable
        columns={colonnes}
        rows={intervenants}
        loading={loading}
        onRowClick={ouvrirDetail}
        emptyMessage={t("Aucun intervenant pour l'instant.")}
        searchPlaceholder={t("Filtrer par nom, commentaire...")}
        getSearchText={(i) => [nomIntervenantAffiche(i), typeIntervenant(i), i.commentaire].join(' ')}
      />
      <Modale ouvert={!!selected} onFermer={() => setSelectedId(null)} taille="lg" className="bmd-modale-sous bmd-modale-detail"
        icone={Users} titre={t("Détail : intervenant")}>
        {detailJsx}
      </Modale>
      {modal}
    </div>
  );
}
