import { useEffect, useState } from 'react';
import { ClipboardList, Package, Calendar, Activity, ListOrdered } from 'lucide-react';
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
  BmdDataTable,
  BmdDetailView,
  BmdFieldGrid,
  Pill,
  TexteOuVide,
  SearchableSelect,
  TACHE_ETAT_LABELS,
  formatDateTime,
  warnIfQuantiteInvalide,
  nomIntervenantAffiche,
  TempsPasse,
  totalTemps,
  formatTemps,
  tempsPasse,
  useMaintenant,
  TACHE_EN_COURS,
  dureeEntre,
  useConfirmModal,
  PanelHeader,
  EquipementDuBon,
} from '../BmdCommun';
import bonMaintenanceTacheService from '../../../../services/Bonmaintenancetacheservice';
import api from '../../../../services/api';
import bonMaintenanceIntervenantService from '../../../../services/bonMaintenanceIntervenantService';
import AssistantTaches from '../AssistantTaches';
import ChoixGamme from '../ChoixGamme';
import { obtenirArticles, obtenirPrestataires } from '../../../../store/referentiels';
import lotArticleImmobilistationService from '../../../../services/Lotarticleimmobilistationservice';
import bonMaintenanceServiceSimple from '../../../../services/Bonmaintenanceservice';
import parametreService from '../../../../services/parametreService';
import pieceLigneService from '../../../../services/PieceLigneService';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { t, tp } from '../../../../i18n';
import { Modale } from '../../../commun';

const TACHE_ETAT_TONE = { 1: 'blue', 2: 'amber', 3: 'teal', 4: 'green', 10: 'slate' };

const emptyTacheForm = {
  designation: '', nom: '', ordre: '', etat: '1',
  dateDebut: '', dateFin: '',
  dateDebutIntervention: '', dateFinIntervention: '',
  intervenantId: '', sousTraitantId: '',
  besoinArticle: 'false', prestataireArticlesId: '', qte: '',
};

export function TachesTab({ bonMaintenanceId, defaultLotArticleImmobilistationId = null, autoOpenForm = false }) {
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
  const maintenantT = useMaintenant(taches.some((x) => tempsPasse(x, TACHE_EN_COURS)?.enCours));
  const tempsTotalTaches = totalTemps(taches, TACHE_EN_COURS, maintenantT);

  const [tacheQteDisponible, setTacheQteDisponible] = useState(null);
  const [choixGamme, setChoixGamme] = useState(false);
  const [messageGamme, setMessageGamme] = useState(null);
  const [checkingTacheQte, setCheckingTacheQte] = useState(false);
  const [sansDepot, setSansDepot] = useState(false);
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const familles = await parametreService.famillesSansDepot();
        if (!familles.size) return;
        const bon = await bonMaintenanceServiceSimple.getById(bonMaintenanceId);
        if (!bon?.lotArticleImmobilistationId) return;
        const equipement = await lotArticleImmobilistationService.getById(bon.lotArticleImmobilistationId);
        const famille = equipement?.articleFamilleId ?? equipement?.familleId;
        if (!annule && famille != null && familles.has(String(famille))) setSansDepot(true);
      } catch (err) {
        console.error('[GMAO tâches] Famille de l’équipement :', err);
      }
    })();
    return () => { annule = true; };
  }, [bonMaintenanceId]);

  const [manques, setManques] = useState({ demander: new Set(), commander: new Set() });
  const chargerManques = () => api.get('/bon-maintenance/besoins-pieces', { params: { ids: bonMaintenanceId } })
    .then(({ data }) => {
      const b = (data || []).find((x) => String(x.bonId) === String(bonMaintenanceId)) || {};
      setManques({ demander: new Set((b.tachesADemander || []).map(String)), commander: new Set((b.tachesACommander || []).map(String)) });
    })
    .catch(() => setManques({ demander: new Set(), commander: new Set() }));
  useEffect(() => {
    const surEcriture = () => chargerManques();
    window.addEventListener('gmao:ecriture', surEcriture);
    return () => window.removeEventListener('gmao:ecriture', surEcriture);
  }, [bonMaintenanceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const manqueTache = (tache) => {
    const id = String(tache.id);
    const d = manques.demander.has(id);
    const cmd = manques.commander.has(id);
    if (d && cmd) return t('Article à demander ou à commander (stock insuffisant)');
    if (d) return t('Article à demander (stock insuffisant)');
    if (cmd) return t('Article à commander (stock insuffisant)');
    return null;
  };

  const load = async () => {
    setLoading(true);
    chargerManques();
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
      besoinArticle: tache.prestataireArticlesId != null ? 'true' : 'false',
      prestataireArticlesId: tache.prestataireArticlesId ?? '',
      qte: tache.qte ?? '',
    });
    setEditingId(tache.id);
    setSelectedId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.designation.trim()) return;
    const avecArticle = !sansDepot && form.besoinArticle === 'true';
    if (avecArticle) warnIfQuantiteInvalide(articles, form.prestataireArticlesId, form.qte, 'quantité');

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
        prestataireArticlesId: !avecArticle || form.prestataireArticlesId === '' ? null : Number(form.prestataireArticlesId),
        qte: !avecArticle || form.qte === '' ? null : Number(form.qte),
      };

      const idModifie = editingId;
      if (idModifie) {
        await bonMaintenanceTacheService.update(idModifie, payload);
      } else {
        await bonMaintenanceTacheService.create(payload);
      }
      resetForm();
      await load();
      if (idModifie) setSelectedId(idModifie);
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

  const selected = taches.find((tache) => tache.id === selectedId);
  const detailJsx = selected ? (() => {
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
            !sansDepot && tache.prestataireArticlesId != null && {
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
          ].filter(Boolean)}
        />
      </>
    );
  })() : null;


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
    !sansDepot && {
      key: 'article',
      label: t("Article"),
      render: (tache) => (tache.prestataireArticlesId != null
        ? `${findArticle(tache.prestataireArticlesId)?.designation || `#${tache.prestataireArticlesId}`}${tache.qte != null ? ` (×${tache.qte})` : ''}`
        : null),
    },
  ].filter(Boolean);

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
        actions={(
          <button type="button" className="bmd-add-btn bmd-add-btn--clair" onClick={() => { setMessageGamme(null); setChoixGamme(true); }}>
            <ListOrdered size={16} /> {t('Appliquer une gamme')}
          </button>
        )}
      />
      {messageGamme && <p className="bmd-gamme-message" role="status">{messageGamme}</p>}
      <ChoixGamme ouvert={choixGamme} bonMaintenanceId={bonMaintenanceId} onFermer={() => setChoixGamme(false)}
        onApplique={async (g, n) => {
          setChoixGamme(false);
          setMessageGamme(t('Gamme {code} appliquée : {n}', { code: `${g.code} v${g.version}`, n: tp('tâche ajoutée', n) }));
          await load();
        }} />

      <Modale ouvert={showForm} onFermer={resetForm} taille="lg" className="bmd-modale-sous" icone={ClipboardList}
        titre={editingId ? t("Modifier : tâche") : t("Ajouter : tâche")}>
      {showForm && (
        <BmfFormulaire
          titre={editingId ? t("Modifier la tâche") : t("Nouvelle tâche")}
          intro={t("Une tâche, c'est un travail précis à faire sur l'équipement.")}
          onSubmit={handleSubmit}
        >
          <EquipementDuBon id={defaultLotArticleImmobilistationId} />
          <BmfEtape numero={1} titre={t("La tâche")}>
            {!editingId && (
              <BmfChamp label={t("Assistant")} large>
                <AssistantTaches
                  key={taches.length}
                  bonMaintenanceId={bonMaintenanceId}
                  articles={articles}
                  sansArticle={sansDepot}
                  utilisee={form.designation}
                  onUtiliser={(s) => setForm((f) => ({
                    ...f,
                    designation: s.designation,
                    nom: f.nom || s.nom || '',
                    ...(!sansDepot && s.prestataireArticlesId
                      ? { besoinArticle: 'true', prestataireArticlesId: String(s.prestataireArticlesId), qte: s.qte != null ? String(s.qte) : f.qte }
                      : {}),
                  }))}
                />
              </BmfChamp>
            )}
            <BmfChamp label={t("Désignation")} requis large aide={t("Une phrase courte, par exemple « Remplacer le joint de la pompe »")} htmlFor="tache-desig">
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

            <BmfChamp label={t("État de la tâche")} large>
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

          <BmfEtape numero={3} titre={sansDepot ? t("Qui ?") : t("Qui, et avec quoi ?")}>
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

            {!sansDepot && (
            <BmfChamp label={t("Besoin d'un article ?")} large>
              <BmfChoix
                nom={t("Besoin d'un article ?")}
                effacable={false}
                value={form.besoinArticle}
                onChange={(v) => setForm({ ...form, besoinArticle: v, ...(v === 'true' ? {} : { prestataireArticlesId: '', qte: '' }) })}
                options={[{ value: 'false', label: t('Non'), ton: 'calme' }, { value: 'true', label: t('Oui'), ton: 'brand' }]}
              />
            </BmfChamp>
            )}
            {!sansDepot && form.besoinArticle === 'true' && (<>
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
            </>)}
          </BmfEtape>

          <BmfActions
            enregistrement={saving}
            label={editingId ? t("Enregistrer les modifications") : t("Ajouter la tâche")}
            onAnnuler={resetForm}
          />
        </BmfFormulaire>
      )}
      </Modale>

      <BmdDataTable
        columns={colonnes}
        rows={tachesTriees}
        loading={loading}
        getRowClassName={(tache) => (manqueTache(tache) ? 'bmd-ligne-manque' : '')}
        getRowTitle={(tache) => manqueTache(tache)}
        onRowClick={(tache) => setSelectedId(tache.id)}
        emptyMessage={t("Aucune tâche pour l'instant.")}
        searchPlaceholder={t("Filtrer par désignation, intervenant...")}
        getSearchText={(tache) => [tache.designation, tache.nom, nomIntervenantAffiche(findIntervenant(tache.intervenantId))].join(' ')}
      />
      <Modale ouvert={!!selected} onFermer={() => setSelectedId(null)} taille="lg" className="bmd-modale-sous bmd-modale-detail"
        icone={ClipboardList} titre={t("Détail : tâche")}>
        {detailJsx}
      </Modale>
      {modal}
    </div>
  );
}
