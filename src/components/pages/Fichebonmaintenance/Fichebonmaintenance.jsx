import React, { useState, useEffect, useCallback } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import lotArticleService from '../../../services/lotArticleService';
import serviceService from '../../../services/Serviceservice';
import cliniqueService from '../../../services/cliniqueService';
import prestataireDepotService from '../../../services/Prestatairedepotservice';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import './FicheBonMaintenance.css';

const ETAT_OPTIONS = [
  { value: 1, label: 'Nouveau' },
  { value: 2, label: 'Suspendu' },
  { value: 3, label: 'En cours' },
  { value: 4, label: 'Effectué' },
  { value: 10, label: 'Annulé' },
];

const ETAT_BADGE_CLASS = {
  1: 'fbm-badge--nouveau',
  2: 'fbm-badge--suspendu',
  3: 'fbm-badge--encours',
  4: 'fbm-badge--effectue',
  10: 'fbm-badge--annule',
};

function etatLabel(etat) {
  return ETAT_OPTIONS.find((o) => o.value === etat)?.label ?? `État ${etat}`;
}

const TYPE_OPTIONS = [
  { value: 1, label: 'Curatif' },
  { value: 2, label: 'Correctif' },
  { value: 3, label: 'Préventif' },
  { value: 4, label: 'Installation' },
  { value: 5, label: 'Autre' },
];

const NIVEAU_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];


function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDateTimeLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadByBonMaintenance(service, bonMaintenanceId) {
  const candidates = ['getByBonMaintenance', 'getByBonMaintenanceId', 'findByBonMaintenanceId', 'findByBonMaintenance'];
  const methodName = candidates.find((name) => typeof service[name] === 'function');
  if (!methodName) {
    throw new Error("Aucune méthode de récupération par bon de maintenance trouvée sur ce service (attendu : getByBonMaintenance, getByBonMaintenanceId, findByBonMaintenanceId ou findByBonMaintenance).");
  }
  return service[methodName](bonMaintenanceId);
}

function personnelLabel(p) {
  return `${p.nom || ''} ${p.prenom || ''}`.trim() || `#${p.id}`;
}

function prestataireLabel(p) {
  return p.raisonSociale || `${p.nom || ''} ${p.prenom || ''}`.trim() || `#${p.id}`;
}

const emptyBonForm = {
  num: '',
  n: '',
  titre: '',
  description: '',
  prestataireId: '',
  lotArticleImmobilistationId: '',
  type: '',
  urgence: '',
  effet: '',
  cause: '',
  remede: '',
  commentaire: '',
  arretOblig: false,
  dateIntervention: '',
  serviceId: '',
  depotId: '',
  cliniqueId: '',
};

export default function FicheBonMaintenance({ bonMaintenanceId, onClose, onBack, startInEditMode = false }) {
  const isNew = !bonMaintenanceId;

  const [bon, setBon] = useState(null);
  const [formData, setFormData] = useState(emptyBonForm);
  const [isEditMode, setIsEditMode] = useState(isNew || startInEditMode);
  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);

  const [prestataires, setPrestataires] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [personnels, setPersonnels] = useState([]);
  const [services, setServices] = useState([]);
  const [cliniques, setCliniques] = useState([]);
  const [depots, setDepots] = useState([]);
  const [depotIdsDuService, setDepotIdsDuService] = useState(null);

  const [confirmModal, setConfirmModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: () => {} });
  const [motifModal, setMotifModal] = useState({ show: false, motif: '' });
  const [etatModal, setEtatModal] = useState({ show: false, etat: '' });

  // Quantité disponible de l'article lié à l'immobilisation sélectionnée (section Informations générales)
  const [immoQteDisponible, setImmoQteDisponible] = useState(null);
  const [checkingImmoQte, setCheckingImmoQte] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    infos: true,
  });

  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const currentBonId = bon?.id ?? bonMaintenanceId ?? null;

  useEffect(() => {
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(() => setPrestataires([]));
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(() => setImmobilisations([]));
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(() => setPersonnels([]));
    serviceService.getAll(0, 200).then((p) => setServices(p.content ?? [])).catch(() => setServices([]));
    cliniqueService.getAll(0, 200).then((p) => setCliniques(p.content ?? [])).catch(() => setCliniques([]));
    prestataireDepotService.getAll(0, 200).then((p) => setDepots(p.content ?? [])).catch(() => setDepots([]));
  }, []);

  // Quand le service change, on récupère la liste des dépôts qui lui sont réellement associés
  useEffect(() => {
    if (!formData.serviceId) {
      setDepotIdsDuService(null);
      return;
    }
    let annule = false;
    prestataireDepotService.getDepotIdsByServiceId(formData.serviceId)
      .then((ids) => { if (!annule) setDepotIdsDuService(ids ?? []); })
      .catch(() => { if (!annule) setDepotIdsDuService([]); });
    return () => { annule = true; };
  }, [formData.serviceId]);

  const depotsDisponibles = depotIdsDuService === null
    ? depots
    : depots.filter((d) => depotIdsDuService.includes(d.id));

  // Services filtrés par la clinique choisie (Service.CliniqueID)
  const servicesDisponibles = !formData.cliniqueId
    ? services
    : services.filter((s) => String(s.cliniqueId) === String(formData.cliniqueId));

  useEffect(() => {
    if (!formData.serviceId) return;
    const toujoursValide = servicesDisponibles.some((s) => String(s.id) === String(formData.serviceId));
    if (!toujoursValide) {
      setFormData((prev) => ({ ...prev, serviceId: '', depotId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.cliniqueId, services]);

  const loadBon = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const data = await bonMaintenanceService.getById(bonMaintenanceId);
      setBon(data);
      setFormData({
        num: data.num || '',
        n: data.n ?? '',
        titre: data.titre || '',
        description: data.description || '',
        prestataireId: data.prestataireId ?? '',
        lotArticleImmobilistationId: data.lotArticleImmobilistationId ?? '',
        type: data.type ?? '',
        urgence: data.urgence ?? '',
        effet: data.effet || '',
        cause: data.cause || '',
        remede: data.remede || '',
        commentaire: data.commentaire || '',
        arretOblig: !!data.arretOblig,
        dateIntervention: toDateTimeLocalInput(data.dateIntervention),
        serviceId: data.serviceId ?? '',
        depotId: data.depotId ?? '',
        cliniqueId: data.cliniqueId ?? '',
      });
    } catch (err) {
      console.error('Erreur chargement bon de maintenance :', err);
    } finally {
      setLoading(false);
    }
  }, [bonMaintenanceId, isNew]);

  useEffect(() => { loadBon(); }, [loadBon]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ─── Quantité disponible de l'article lié à l'immobilisation choisie ───
  useEffect(() => {
    if (!formData.lotArticleImmobilistationId) {
      setImmoQteDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingImmoQte(true);
    lotArticleImmobilistationService.getById(formData.lotArticleImmobilistationId)
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
  }, [formData.lotArticleImmobilistationId]);

  const handleSaveBon = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        num: formData.num.trim() || null,
        n: formData.n === '' ? null : Number(formData.n),
        titre: formData.titre.trim() || null,
        description: formData.description.trim() || null,
        prestataireId: formData.prestataireId === '' ? null : Number(formData.prestataireId),
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId === '' ? null : Number(formData.lotArticleImmobilistationId),
        type: formData.type === '' ? null : Number(formData.type),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        effet: formData.effet || null,
        cause: formData.cause || null,
        remede: formData.remede || null,
        commentaire: formData.commentaire || null,
        arretOblig: formData.arretOblig,
        dateIntervention: formData.dateIntervention ? new Date(formData.dateIntervention).toISOString() : null,
        serviceId: formData.serviceId === '' ? null : Number(formData.serviceId),
        serviceNom: formData.serviceId === ''
          ? null
          : services.find((s) => String(s.id) === String(formData.serviceId))?.description || null,
        depotId: formData.depotId === '' ? null : Number(formData.depotId),
        depotNom: formData.depotId === ''
          ? null
          : (() => {
              const d = depots.find((d) => String(d.id) === String(formData.depotId));
              return d ? (d.nom || d.codeDepots) : null;
            })(),
        cliniqueId: formData.cliniqueId === '' ? null : Number(formData.cliniqueId),
        cliniqueNom: formData.cliniqueId === ''
          ? null
          : cliniques.find((c) => String(c.id) === String(formData.cliniqueId))?.nom || null,
      };

      let saved;
      if (isNew) {
        saved = await bonMaintenanceService.create(payload);
      } else {
        saved = await bonMaintenanceService.update(bonMaintenanceId, payload);
      }
      setBon(saved);
      setIsEditMode(false);
      if (isNew && onClose) {
      }
    } catch (err) {
      console.error('Erreur enregistrement bon de maintenance :', err);
      setConfirmModal({
        show: true, type: 'danger', title: 'Erreur',
        message: "Impossible d'enregistrer le bon de maintenance.",
        confirmText: 'Fermer', onConfirm: () => setConfirmModal((p) => ({ ...p, show: false })),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const doTransition = async (label, action) => {
    setConfirmModal({
      show: true, type: 'info', title: label,
      message: `Confirmer l'action « ${label} » sur ce bon de maintenance ?`,
      confirmText: 'Confirmer', cancelText: 'Annuler',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, show: false }));
        try {
          const updated = await action();
          setBon(updated);
        } catch (err) {
          console.error(`Erreur transition ${label} :`, err);
          setConfirmModal({
            show: true, type: 'danger', title: 'Erreur',
            message: `Échec de l'action « ${label} ».`,
            confirmText: 'Fermer', onConfirm: () => setConfirmModal((p) => ({ ...p, show: false })),
          });
        }
      },
    });
  };

  const handlePasserEnCours = () => doTransition('Passer en cours', () => bonMaintenanceService.passerEnCours(bonMaintenanceId));
  const handleAnnuler = () => doTransition('Annuler', () => bonMaintenanceService.annuler(bonMaintenanceId));

  const handleMarquerEffectue = () => setEtatModal({ show: true, etat: '' });

  const confirmMarquerEffectue = async () => {
    const saisie = etatModal.etat.trim();
    if (saisie !== '' && Number.isNaN(Number(saisie))) return;
    const etat = saisie === '' ? null : Number(saisie);
    try {
      const updated = await bonMaintenanceService.marquerEffectue(bonMaintenanceId, etat);
      setBon(updated);
      setEtatModal({ show: false, etat: '' });
    } catch (err) {
      console.error('Erreur marquage Effectué :', err);
      setEtatModal({ show: false, etat: '' });
      setConfirmModal({
        show: true, type: 'danger', title: 'Erreur',
        message: "Échec du marquage « Effectué ».",
        confirmText: 'Fermer', onConfirm: () => setConfirmModal((p) => ({ ...p, show: false })),
      });
    }
  };

  const handleSuspendre = () => setMotifModal({ show: true, motif: '' });

  const confirmSuspendre = async () => {
    if (!motifModal.motif.trim()) return;
    try {
      const updated = await bonMaintenanceService.suspendre(bonMaintenanceId, motifModal.motif.trim());
      setBon(updated);
      setMotifModal({ show: false, motif: '' });
    } catch (err) {
      console.error('Erreur suspension :', err);
      setMotifModal({ show: false, motif: '' });
      setConfirmModal({
        show: true, type: 'danger', title: 'Erreur',
        message: "Échec de la suspension du bon de maintenance.",
        confirmText: 'Fermer', onConfirm: () => setConfirmModal((p) => ({ ...p, show: false })),
      });
    }
  };

  if (loading) {
    return <div className="fiche-employeur-wrapper"><p style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Chargement...</p></div>;
  }

  return (
    <div className="fiche-employeur-wrapper">
      <div className="planning-header-card">
        <div className="header-left">
          <div className="header-title-box">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="header-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
            <h2>{bon?.titre || bon?.num || (isNew ? 'Nouveau bon de maintenance' : 'Bon de maintenance')}</h2>
          </div>
        </div>
        <div className="header-right">
          {bon && <span className={`fbm-etat-badge ${ETAT_BADGE_CLASS[bon.etat] || ''}`}>{etatLabel(bon.etat)}</span>}
        </div>
      </div>

      <div className="actions-bar-card">
        {onBack && (
          <button type="button" className="action-bar-btn retour-liste" onClick={onBack}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="btn-label">Retour à la liste</span>
          </button>
        )}
        {!isEditMode && !isNew && (
          <button type="button" className="action-bar-btn modifier" onClick={() => setIsEditMode(true)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            <span className="btn-label">Modifier</span>
          </button>
        )}
        {isEditMode && !isNew && (
          <button type="button" className="action-bar-btn annuler" onClick={() => { setIsEditMode(false); loadBon(); }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="btn-label">Annuler</span>
          </button>
        )}

        {!isNew && bon && (
          <>
            {bon.etat === 1 && (
              <button type="button" className="action-bar-btn fbm-wf-encours" onClick={handlePasserEnCours}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="btn-label">Passer en cours</span>
              </button>
            )}
            {(bon.etat === 1 || bon.etat === 3) && (
              <button type="button" className="action-bar-btn fbm-wf-suspendre" onClick={handleSuspendre}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="btn-label">Suspendre</span>
              </button>
            )}
            {bon.etat === 3 && (
              <button type="button" className="action-bar-btn fbm-wf-effectuer" onClick={handleMarquerEffectue}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="btn-label">Marquer effectué</span>
              </button>
            )}
            {bon.etat !== 10 && bon.etat !== 4 && (
              <button type="button" className="action-bar-btn fbm-wf-annuler" onClick={handleAnnuler}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                <span className="btn-label">Annuler le bon</span>
              </button>
            )}
          </>
        )}

        {onClose && (
          <div className="actions-bar-right">
            <button type="button" className="action-bar-btn fermer-view" onClick={onClose}>
              <span className="btn-label">← Retourner à la liste</span>
            </button>
          </div>
        )}
      </div>

      {(isEditMode || isNew) && (
        <button className={`save-btn ${isSaving ? 'loading' : ''}`} onClick={handleSaveBon} disabled={isSaving}>
          {isSaving ? (
            <>
              <span className="spinner"></span>
              <span className="save-btn-text">Enregistrement...</span>
            </>
          ) : (
            <>
              <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="save-btn-text">{isNew ? 'Créer le bon' : 'Enregistrer les modifications'}</span>
            </>
          )}
        </button>
      )}

      <form className={`fiche-form-grid ${!isEditMode ? 'readonly-form' : ''}`} onSubmit={handleSaveBon}>
        <section className={`form-section full-width rh-identite ${expandedSections.infos ? 'expanded' : 'collapsed'}`}>
          <div className="section-header" onClick={() => toggleSection('infos')}>
            <div className="section-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3>Informations générales</h3>
            <div className="section-toggle"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="chevron-icon"><path d="M19 9l-7 7-7-7" /></svg></div>
          </div>
          <div className="section-content"><div className="section-content-inner">
            <div className="form-group-row">
              <div className="input-group"><label>Numéro</label><input type="text" name="num" value={formData.num} onChange={handleChange} /></div>
              <div className="input-group"><label>N° interne</label><input type="number" name="n" value={formData.n} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <div className="input-group full"><label>Titre</label><input type="text" name="titre" value={formData.titre} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <div className="input-group full"><label>Description</label><textarea name="description" rows={3} value={formData.description} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <div className="input-group">
                <label>Immobilisation</label>
                <select name="lotArticleImmobilistationId" value={formData.lotArticleImmobilistationId} onChange={handleChange}>
                  <option value="">—</option>
                  {immobilisations.map((i) => <option key={i.id} value={i.id}>{i.designation || `#${i.id}`}</option>)}
                </select>
                {formData.lotArticleImmobilistationId && (
                  <p className="cem-hint">
                    {checkingImmoQte
                      ? 'Vérification du stock...'
                      : (immoQteDisponible != null ? `Quantité disponible : ${immoQteDisponible}` : 'Quantité disponible inconnue')}
                  </p>
                )}
                {!checkingImmoQte && formData.lotArticleImmobilistationId && immoQteDisponible != null && Number(immoQteDisponible) <= 0 && (
                  <p className="cem-warning">⚠ Quantité non disponible pour cette immobilisation.</p>
                )}
              </div>
              <div className="input-group">
                <label>Prestataire</label>
                <select name="prestataireId" value={formData.prestataireId} onChange={handleChange}>
                  <option value="">—</option>
                  {prestataires.map((p) => <option key={p.id} value={p.id}>{prestataireLabel(p)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group-row">
              <div className="input-group">
                <label>Clinique</label>
                <select name="cliniqueId" value={formData.cliniqueId} onChange={handleChange}>
                  <option value="">—</option>
                  {cliniques.map((c) => <option key={c.id} value={c.id}>{c.nom || `#${c.id}`}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Service</label>
                <select name="serviceId" value={formData.serviceId} onChange={handleChange}>
                  <option value="">—</option>
                  {servicesDisponibles.map((s) => <option key={s.id} value={s.id}>{s.description || s.code || `#${s.id}`}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Dépôt</label>
                <select name="depotId" value={formData.depotId} onChange={handleChange}>
                  <option value="">—</option>
                  {depotsDisponibles.map((d) => <option key={d.id} value={d.id}>{d.nom || d.codeDepots || `#${d.id}`}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group-row">
              <div className="input-group">
                <label>Type</label>
                <select name="type" value={formData.type} onChange={handleChange}>
                  <option value="">—</option>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Urgence</label>
                <select name="urgence" value={formData.urgence} onChange={handleChange}>
                  <option value="">—</option>
                  {NIVEAU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group"><label>Date d'intervention</label><input type="datetime-local" name="dateIntervention" value={formData.dateIntervention} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <div className="input-group"><label>Effet</label><input type="text" name="effet" value={formData.effet} onChange={handleChange} /></div>
              <div className="input-group"><label>Cause</label><input type="text" name="cause" value={formData.cause} onChange={handleChange} /></div>
              <div className="input-group"><label>Remède</label><input type="text" name="remede" value={formData.remede} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <div className="input-group full"><label>Commentaire</label><textarea name="commentaire" rows={2} value={formData.commentaire} onChange={handleChange} /></div>
            </div>
            <div className="form-group-row">
              <label className="checkbox-label">
                <input type="checkbox" name="arretOblig" checked={formData.arretOblig} onChange={handleChange} disabled={!isEditMode} />
                Arrêt obligatoire
              </label>
            </div>
            {bon && (
              <div className="form-group-row">
                <div className="input-group"><label>Créé par</label><input type="text" value={bon.personnelCreationNom || (bon.personnelCreation ? personnelLabel(bon.personnelCreation) : '—')} disabled /></div>
                <div className="input-group"><label>Demandé par</label><input type="text" value={bon.personnelDemandantNom || (bon.personnelDemandant ? personnelLabel(bon.personnelDemandant) : '—')} disabled /></div>
                <div className="input-group"><label>Coût total</label><input type="text" value={bon.coutTotal != null ? `${bon.coutTotal} DT` : '—'} disabled /></div>
              </div>
            )}
          </div></div>
        </section>

      </form>

      <ConfirmModal
        show={confirmModal.show} type={confirmModal.type} title={confirmModal.title} message={confirmModal.message}
        confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText} onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((p) => ({ ...p, show: false }))}
      />

      {motifModal.show && (
        <div className="fbm-motif-overlay" onClick={() => setMotifModal({ show: false, motif: '' })}>
          <div className="fbm-motif-box" onClick={(e) => e.stopPropagation()}>
            <h3>Motif de suspension</h3>
            <textarea
              rows={3}
              value={motifModal.motif}
              onChange={(e) => setMotifModal((p) => ({ ...p, motif: e.target.value }))}
              placeholder="Indiquer le motif de la suspension..."
              autoFocus
            />
            <div className="fbm-motif-actions">
              <button type="button" className="fbm-motif-cancel" onClick={() => setMotifModal({ show: false, motif: '' })}>Annuler</button>
              <button type="button" className="fbm-motif-confirm" onClick={confirmSuspendre} disabled={!motifModal.motif.trim()}>Suspendre</button>
            </div>
          </div>
        </div>
      )}

      {etatModal.show && (
        <div className="fbm-motif-overlay" onClick={() => setEtatModal({ show: false, etat: '' })}>
          <div className="fbm-motif-box" onClick={(e) => e.stopPropagation()}>
            <h3>État final de l'immobilisation</h3>
            <input
              type="number"
              value={etatModal.etat}
              onChange={(e) => setEtatModal((p) => ({ ...p, etat: e.target.value }))}
              placeholder="Laisser vide si non applicable"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box',
              }}
            />
            <div className="fbm-motif-actions">
              <button type="button" className="fbm-motif-cancel" onClick={() => setEtatModal({ show: false, etat: '' })}>Annuler</button>
              <button type="button" className="fbm-motif-confirm" onClick={confirmMarquerEffectue}>Marquer effectué</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}