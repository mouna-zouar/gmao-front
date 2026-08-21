import React, { useState, useEffect, useCallback, useMemo } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../services/bonMaintenanceIntervenantHistoriqueService';
import bonMaintenancePieceService from '../../../services/bonMaintenancePieceService';
import bonMaintenancePieceImmoService from '../../../services/bonMaintenancePieceImmoService';
import bonMaintenanceDocumentAchatService from '../../../services/bonMaintenanceDocumentAchatService';
import bonMaintenanceCommentaireService from '../../../services/bonMaintenanceCommentaireService';
import bonMaintenanceHistoriqueService from '../../../services/bonMaintenanceHistoriqueService';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import pieceService from '../../../services/pieceService';
import articleService from '../../../services/articleService';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import ChildEntityFormModal from '../../ui/modals/ChildEntityFormModal';
import ChildEntityViewModal from '../../ui/modals/ChildEntityViewModal';
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
  const [pieces, setPieces] = useState([]);
  const [articles, setArticles] = useState([]);

  const [confirmModal, setConfirmModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: () => {} });
  const [motifModal, setMotifModal] = useState({ show: false, motif: '' });
  const [etatModal, setEtatModal] = useState({ show: false, etat: '' });

  const [expandedSections, setExpandedSections] = useState({
    infos: true,
    taches: false,
    intervenants: false,
    pieces: false,
    piecesImmo: false,
    documentsAchat: false,
    commentaires: false,
    historique: false,
  });

  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const currentBonId = bon?.id ?? bonMaintenanceId ?? null;

  useEffect(() => {
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(() => setPrestataires([]));
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(() => setImmobilisations([]));
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(() => setPersonnels([]));
    pieceService.getAll(0, 200).then((p) => setPieces(p.content ?? [])).catch(() => setPieces([]));
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(() => setArticles([]));
  }, []);

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
              <div className="input-group"><label>Type</label><input type="number" name="type" value={formData.type} onChange={handleChange} /></div>
              <div className="input-group"><label>Urgence</label><input type="number" name="urgence" value={formData.urgence} onChange={handleChange} /></div>
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
                <div className="input-group"><label>Créé par</label><input type="text" value={bon.personnelCreationNom || '—'} disabled /></div>
                <div className="input-group"><label>Demandé par</label><input type="text" value={bon.personnelDemandantNom || '—'} disabled /></div>
                <div className="input-group"><label>Coût total</label><input type="text" value={bon.coutTotal != null ? `${bon.coutTotal} DT` : '—'} disabled /></div>
              </div>
            )}
          </div></div>
        </section>

        <>
            <TableChildSection
              sectionKey="taches" title="Tâches" icon={<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />}
              expanded={expandedSections.taches} onToggle={() => toggleSection('taches')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenanceTacheService}
              columns={[
                { key: 'ordre', label: 'Ordre' },
                { key: 'designation', label: 'Désignation' },
                { key: 'etat', label: 'État' },
                { key: 'dateDebut', label: 'Début', format: formatDateTime },
                { key: 'dateFin', label: 'Fin', format: formatDateTime },
                { key: 'prestataireArticlesId', label: 'Article', format: (v) => articles.find((a) => a.id === v)?.designation || (v != null ? `#${v}` : '—') },
                { key: 'qte', label: 'Quantité' },
                {
                  key: 'sousTraitantId',
                  label: 'Sous-traitant',
                  format: (v, item) => item.sousTraitant?.raisonSociale
                    || prestataires.find((p) => p.id === v)?.raisonSociale
                    || (v != null ? `#${v}` : '—'),
                },
              ]}
              fields={[
                { name: 'ordre', label: 'Ordre', type: 'number' },
                { name: 'designation', label: 'Désignation', type: 'text', full: true },
                { name: 'etat', label: 'État', type: 'number' },
                { name: 'dateDebut', label: 'Date début', type: 'datetime-local' },
                { name: 'dateFin', label: 'Date fin', type: 'datetime-local' },
                { name: 'prestataireArticlesId', label: 'Article', type: 'select', options: articles.map((a) => ({ value: a.id, label: a.designation || `#${a.id}` })) },
                { name: 'qte', label: 'Quantité', type: 'number' },
                { name: 'sousTraitantId', label: 'Sous-traitant (requis pour Commander)', type: 'select', options: prestataires.map((p) => ({ value: p.id, label: prestataireLabel(p) })) },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                ordre: vals.ordre === '' ? null : Number(vals.ordre),
                designation: vals.designation || null,
                etat: vals.etat === '' ? null : Number(vals.etat),
                dateDebut: vals.dateDebut ? new Date(vals.dateDebut).toISOString() : null,
                dateFin: vals.dateFin ? new Date(vals.dateFin).toISOString() : null,
                prestataireArticlesId: vals.prestataireArticlesId === '' ? null : Number(vals.prestataireArticlesId),
                qte: vals.qte === '' ? null : Number(vals.qte),
                sousTraitantId: vals.sousTraitantId === '' ? null : Number(vals.sousTraitantId),
              })}
            />

            <TableChildSection
              sectionKey="intervenants" title="Intervenants" icon={<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7a4 4 0 11-8 0 4 4 0 018 0zM20 8v6M23 11h-6" />}
              expanded={expandedSections.intervenants} onToggle={() => toggleSection('intervenants')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenanceIntervenantService}
              columns={[
                {
                  key: 'intervenantNom',
                  label: 'Nom',
                  format: (v, item) => {
                    const personnel = personnels.find((p) => p.id === item.personnelId);
                    if (personnel) return personnelLabel(personnel);
                    const sousTraitant = prestataires.find((p) => p.id === item.sousTraitantId);
                    if (sousTraitant) return prestataireLabel(sousTraitant);
                    return v || (item.id != null ? `Intervenant #${item.id}` : '—');
                  },
                },
                { key: 'etat', label: 'État' },
                { key: 'nbrHeure', label: 'Heures' },
                { key: 'coutTotal', label: 'Coût total', format: (v) => (v != null ? `${v} DT` : '—') },
                { key: 'dateDebutIntervention', label: 'Début', format: formatDateTime },
                { key: 'dateFinIntervention', label: 'Fin', format: formatDateTime },
              ]}
              fields={[
                { name: 'personnelId', label: 'Personnel', type: 'select', options: personnels.map((p) => ({ value: p.id, label: personnelLabel(p) })) },
                { name: 'intervenantNom', label: 'Nom intervenant', type: 'text' },
                { name: 'sousTraitantId', label: 'Sous-traitant', type: 'select', options: prestataires.map((p) => ({ value: p.id, label: prestataireLabel(p) })) },
                { name: 'dateDebutIntervention', label: 'Début intervention', type: 'datetime-local' },
                { name: 'dateFinIntervention', label: 'Fin intervention', type: 'datetime-local' },
                { name: 'coutUnitaire', label: 'Coût unitaire', type: 'number' },
                { name: 'nbrHeure', label: 'Nb heures', type: 'number' },
                { name: 'forfait', label: 'Forfait', type: 'number' },
                { name: 'etat', label: 'État', type: 'number' },
                { name: 'commentaire', label: 'Commentaire', type: 'text', full: true },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                personnelId: vals.personnelId === '' ? null : Number(vals.personnelId),
                intervenantNom: vals.intervenantNom || null,
                sousTraitantId: vals.sousTraitantId === '' ? null : Number(vals.sousTraitantId),
                dateDebutIntervention: vals.dateDebutIntervention ? new Date(vals.dateDebutIntervention).toISOString() : null,
                dateFinIntervention: vals.dateFinIntervention ? new Date(vals.dateFinIntervention).toISOString() : null,
                coutUnitaire: vals.coutUnitaire === '' ? null : Number(vals.coutUnitaire),
                nbrHeure: vals.nbrHeure === '' ? null : Number(vals.nbrHeure),
                forfait: vals.forfait === '' ? null : Number(vals.forfait),
                etat: vals.etat === '' ? null : Number(vals.etat),
                commentaire: vals.commentaire || null,
              })}
              historyService={bonMaintenanceIntervenantHistoriqueService}
              historyColumns={[
                { key: 'action', label: 'Action' },
                { key: 'date', label: 'Date', format: formatDateTime },
                { key: 'personnelCreationNom', label: 'Par' },
              ]}
            />

            <TableChildSection
              sectionKey="pieces" title="Pièces (main d'œuvre / stock)" icon={<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
              expanded={expandedSections.pieces} onToggle={() => toggleSection('pieces')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenancePieceService}
              columns={[
                { key: 'prestataireArticlesId', label: 'Article', format: (v) => articles.find((a) => a.id === v)?.designation || (v != null ? `#${v}` : '—') },
                { key: 'modeStock', label: 'Mode stock' },
                { key: 'qte', label: 'Quantité' },
              ]}
              fields={[
                { name: 'prestataireArticlesId', label: 'Article', type: 'select', options: articles.map((a) => ({ value: a.id, label: a.designation || `#${a.id}` })) },
                { name: 'modeStock', label: 'Mode stock', type: 'number' },
                { name: 'qte', label: 'Quantité', type: 'number' },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                prestataireArticlesId: vals.prestataireArticlesId === '' ? null : Number(vals.prestataireArticlesId),
                modeStock: vals.modeStock === '' ? null : Number(vals.modeStock),
                qte: vals.qte === '' ? null : Number(vals.qte),
              })}
            />

            <TableChildSection
              sectionKey="piecesImmo" title="Lots d'articles immobilisés liés" icon={<path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />}
              expanded={expandedSections.piecesImmo} onToggle={() => toggleSection('piecesImmo')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenancePieceImmoService}
              columns={[
                {
                  key: 'lotArticleImmobilistationId',
                  label: 'Immobilisation',
                  format: (v, item) => item.lotArticleImmobilistation?.designation
                    || immobilisations.find((i) => i.id === v)?.designation
                    || (v != null ? `#${v}` : '—'),
                },
                { key: 'bonMaintenancePieceId', label: 'Pièce liée (ID)' },
              ]}
              fields={[
                { name: 'lotArticleImmobilistationId', label: 'Immobilisation', type: 'select', options: immobilisations.map((i) => ({ value: i.id, label: i.designation || `#${i.id}` })) },
                { name: 'bonMaintenancePieceId', label: 'Pièce liée (optionnel)', type: 'number' },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                lotArticleImmobilistationId: vals.lotArticleImmobilistationId === '' ? null : Number(vals.lotArticleImmobilistationId),
                bonMaintenancePieceId: vals.bonMaintenancePieceId === '' ? null : Number(vals.bonMaintenancePieceId),
              })}
            />

            <TableChildSection
              sectionKey="documentsAchat" title="Documents d'achat" icon={<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
              expanded={expandedSections.documentsAchat} onToggle={() => toggleSection('documentsAchat')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenanceDocumentAchatService}
              noUpdate
              columns={[
                {
                  key: 'pieceId',
                  label: 'Pièce',
                  format: (v, item) => item.piece?.numPiece || pieces.find((p) => p.id === v)?.numPiece || (v != null ? `#${v}` : '—'),
                },
                { key: 'codePieceType', label: 'Type' },
                { key: 'prestataireArticlesId', label: 'Article', format: (v) => articles.find((a) => a.id === v)?.designation || (v != null ? `#${v}` : '—') },
                { key: 'qte', label: 'Quantité' },
                {
                  key: 'cibleId',
                  label: 'Sous-traitant',
                  format: (v) => prestataires.find((p) => p.id === v)?.raisonSociale || (v != null ? `#${v}` : '—'),
                },
                {
                  key: 'description',
                  label: 'Description',
                  format: (v, item) => item.piece?.description || v || '—',
                },
              ]}
              fields={[
                { name: 'pieceId', label: 'Pièce', type: 'select', options: pieces.map((p) => ({ value: p.id, label: p.numPiece || p.description || `#${p.id}` })) },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                pieceId: vals.pieceId === '' ? null : Number(vals.pieceId),
              })}
            />

            <TableChildSection
              sectionKey="commentaires" title="Commentaires" icon={<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
              expanded={expandedSections.commentaires} onToggle={() => toggleSection('commentaires')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenanceCommentaireService}
              columns={[
                { key: 'commentaire', label: 'Commentaire' },
                { key: 'date', label: 'Date', format: formatDateTime },
                {
                  key: 'personnelCreationNom',
                  label: 'Auteur',
                  format: (v, item) => (item.personnelCreation ? personnelLabel(item.personnelCreation) : (v || '—')),
                },
              ]}
              fields={[
                { name: 'commentaire', label: 'Commentaire', type: 'text', full: true },
                { name: 'personnelCreationId', label: 'Auteur', type: 'select', options: personnels.map((p) => ({ value: p.id, label: personnelLabel(p) })) },
              ]}
              buildPayload={(vals) => ({
                bonMaintenanceId: currentBonId,
                commentaire: vals.commentaire || null,
                personnelCreationId: vals.personnelCreationId === '' ? null : Number(vals.personnelCreationId),
              })}
            />

            <ReadOnlyChildSection
              sectionKey="historique" title="Historique" icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
              expanded={expandedSections.historique} onToggle={() => toggleSection('historique')}
              bonMaintenanceId={currentBonId}
              service={bonMaintenanceHistoriqueService}
              columns={[
                { key: 'action', label: 'Action' },
                { key: 'date', label: 'Date', format: formatDateTime },
                { key: 'personnelCreationNom', label: 'Par' },
              ]}
            />
          </>
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


function TableChildSection({
  sectionKey, title, icon, expanded, onToggle, bonMaintenanceId, service, columns, fields, buildPayload, noUpdate,
  historyService, historyColumns, historyLabel = 'Historique',
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formModal, setFormModal] = useState({ show: false, item: null });
  const [viewModal, setViewModal] = useState({ show: false, item: null });

  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [historyDataById, setHistoryDataById] = useState({});
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);

  const load = useCallback(async () => {
    if (!bonMaintenanceId) return;
    setLoading(true);
    try {
      const data = await loadByBonMaintenance(service, bonMaintenanceId);
      setItems(data ?? []);
    } catch (err) {
      console.error(`Erreur chargement ${title} :`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [service, bonMaintenanceId, title]);

  useEffect(() => { if (expanded && bonMaintenanceId) load(); }, [expanded, bonMaintenanceId, load]);

  const openAdd = () => setFormModal({ show: true, item: null });

  const openEdit = (item) => {
    const vals = {};
    fields.forEach((f) => {
      vals[f.name] = item[f.name] != null ? (f.type === 'datetime-local' ? toDateTimeLocalInput(item[f.name]) : item[f.name]) : '';
    });
    setFormModal({ show: true, item: { ...item, __formValues: vals } });
  };

  const openView = (item) => setViewModal({ show: true, item });

  const handleSave = async (vals) => {
    setSaving(true);
    try {
      const payload = buildPayload(vals);
      if (formModal.item && !noUpdate) {
        await service.update(formModal.item.id, payload);
      } else {
        await service.create(payload);
      }
      setFormModal({ show: false, item: null });
      await load();
    } catch (err) {
      console.error(`Erreur enregistrement ${title} :`, err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet élément ?')) return;
    try {
      await service.remove(id);
      await load();
    } catch (err) {
      console.error(`Erreur suppression ${title} :`, err);
    }
  };

  const toggleHistory = async (itemId) => {
    if (expandedHistoryId === itemId) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(itemId);
    if (!historyDataById[itemId]) {
      setLoadingHistoryId(itemId);
      try {
        const candidates = ['getByIntervenant', 'findByBonMaintenanceIntervenantId', 'getByBonMaintenanceIntervenant', 'findByIntervenantId'];
        const methodName = candidates.find((name) => typeof historyService[name] === 'function');
        if (!methodName) {
          throw new Error("Aucune méthode de récupération d'historique trouvée sur ce service.");
        }
        const data = await historyService[methodName](itemId);
        setHistoryDataById((prev) => ({ ...prev, [itemId]: data ?? [] }));
      } catch (err) {
        console.error(`Erreur chargement ${historyLabel} :`, err);
        setHistoryDataById((prev) => ({ ...prev, [itemId]: [] }));
      } finally {
        setLoadingHistoryId(null);
      }
    }
  };

  return (
    <section className={`form-section full-width ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header" onClick={onToggle}>
        <div className="section-icon"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{icon}</svg></div>
        <h3>{title}</h3>
        <div className="section-toggle"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="chevron-icon"><path d="M19 9l-7 7-7-7" /></svg></div>
      </div>
      <div className="section-content"><div className="section-content-inner">
        {!bonMaintenanceId ? (
          <div className="fbm-pending-notice">
            Enregistrez d'abord le bon de maintenance (bouton en bas à droite) pour pouvoir ajouter des éléments dans « {title} ».
          </div>
        ) : (
        <div className="table-container">
          <table className="form-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th style={{ width: historyService ? 170 : 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Chargement...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Aucun élément.</td></tr>
              ) : (
                items.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr>
                      {columns.map((c) => (
                        <td key={c.key}>{c.format ? c.format(item[c.key], item) : (item[c.key] ?? '—')}</td>
                      ))}
                      <td>
                        <div className="table-actions">
                          <button type="button" className="action-btn view" title="Visualiser" onClick={() => openView(item)}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {!noUpdate && (
                            <button type="button" className="action-btn edit" title="Modifier" onClick={() => openEdit(item)}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {historyService && (
                            <button type="button" className="action-btn history" title={historyLabel} onClick={() => toggleHistory(item.id)}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                          )}
                          <button type="button" className="action-btn delete" title="Supprimer" onClick={() => handleDelete(item.id)}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {historyService && expandedHistoryId === item.id && (
                      <tr className="fbm-history-row-wrapper">
                        <td colSpan={columns.length + 1} style={{ padding: 0, background: '#f8fafc' }}>
                          <div style={{ padding: '10px 16px' }}>
                            {loadingHistoryId === item.id ? (
                              <p style={{ color: '#94a3b8', margin: 0 }}>Chargement de l'historique...</p>
                            ) : (historyDataById[item.id] ?? []).length === 0 ? (
                              <p style={{ color: '#94a3b8', margin: 0 }}>Aucun historique pour cet élément.</p>
                            ) : (
                              <table className="form-table" style={{ margin: 0 }}>
                                <thead>
                                  <tr>{historyColumns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                                </thead>
                                <tbody>
                                  {historyDataById[item.id].map((h) => (
                                    <tr key={h.id}>
                                      {historyColumns.map((c) => (
                                        <td key={c.key}>{c.format ? c.format(h[c.key], h) : (h[c.key] ?? '—')}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          <button type="button" className="add-row-btn" onClick={openAdd}>+ Ajouter</button>
        </div>
        )}
      </div></div>

      <ChildEntityFormModal
        show={formModal.show}
        onClose={() => setFormModal({ show: false, item: null })}
        title={title}
        fields={fields}
        initialValues={formModal.item?.__formValues}
        isEdit={!!formModal.item}
        saving={saving}
        onSave={handleSave}
      />

      <ChildEntityViewModal
        show={viewModal.show}
        onClose={() => setViewModal({ show: false, item: null })}
        title={title}
        columns={columns}
        item={viewModal.item}
      />
    </section>
  );
}

function ReadOnlyChildSection({ sectionKey, title, icon, expanded, onToggle, bonMaintenanceId, service, columns }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!bonMaintenanceId) return;
    setLoading(true);
    try {
      const data = await loadByBonMaintenance(service, bonMaintenanceId);
      setItems(data ?? []);
    } catch (err) {
      console.error(`Erreur chargement ${title} :`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [service, bonMaintenanceId, title]);

  useEffect(() => { if (expanded && bonMaintenanceId) load(); }, [expanded, bonMaintenanceId, load]);

  return (
    <section className={`form-section full-width ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header" onClick={onToggle}>
        <div className="section-icon"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{icon}</svg></div>
        <h3>{title}</h3>
        <div className="section-toggle"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="chevron-icon"><path d="M19 9l-7 7-7-7" /></svg></div>
      </div>
      <div className="section-content"><div className="section-content-inner">
        {!bonMaintenanceId ? (
          <div className="fbm-pending-notice">
            L'historique sera disponible une fois le bon de maintenance enregistré.
          </div>
        ) : (
        <div className="table-container">
          <table className="form-table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Chargement...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Aucun historique.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    {columns.map((c) => <td key={c.key}>{c.format ? c.format(item[c.key], item) : (item[c.key] ?? '—')}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div></div>
    </section>
  );
}