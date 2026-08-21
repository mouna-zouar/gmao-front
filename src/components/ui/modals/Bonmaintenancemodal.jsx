import React, { useState, useEffect } from 'react';
import Button from '../Button';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import articleService from '../../../services/articleService';
import pieceLigneService from '../../../services/pieceLigneService';
import './Modal.css';

const NIVEAU_OPTIONS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Élevée' },
];

const emptyForm = {
  num: '',
  n: '',
  titre: '',
  description: '',
  type: '',
  urgence: '',
  prestataireId: '',
  lotArticleImmobilistationId: '',
  personnelDemandantId: '',
  date: '',
  dateFinIntervention: '',
  effet: '',
  cause: '',
  remede: '',
  commentaire: '',
  arretOblig: false,
};

function toInputDateTime(iso) {
  if (!iso) return '';
  return iso.slice(0, 16);
}

const STEP_LABELS = [
  'Informations générales',
  'Affectation & planning',
  'Tâches',
  'Intervenants',
  'Commentaires',
  'Détails',
];

const emptyTache = {
  designation: '', ordre: '', dateDebut: '', dateFin: '',
  prestataireArticlesId: '', qte: '', sousTraitantId: '',
};
const emptyIntervenant = { personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '', nbrHeure: '', coutUnitaire: '', commentaire: '' };

const BonMaintenanceModal = ({ isOpen, onClose, onSave, bonMaintenance, isEditing }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [personnels, setPersonnels] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [immobilisations, setImmobilisations] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Enfants collectés localement (création à la validation finale, uniquement en mode création)
  const [taches, setTaches] = useState([]);
  const [tacheForm, setTacheForm] = useState(emptyTache);
  const [tacheDisponible, setTacheDisponible] = useState(null);
  const [checkingTacheDisponible, setCheckingTacheDisponible] = useState(false);

  const [intervenants, setIntervenants] = useState([]);
  const [intervenantForm, setIntervenantForm] = useState(emptyIntervenant);

  const [commentaires, setCommentaires] = useState([]);
  const [commentaireText, setCommentaireText] = useState('');

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchLists = async () => {
      setLoadingLists(true);
      try {
        const [persPage, prestPage, immoPage, articlesPage] = await Promise.all([
          personnelService.getAll(0, 200),
          prestataireService.getAll(0, 200),
          lotArticleImmobilistationService.getAll(0, 200),
          articleService.getAll(0, 300),
        ]);
        setPersonnels(persPage.content ?? []);
        setPrestataires(prestPage.content ?? []);
        setImmobilisations(immoPage.content ?? []);
        setArticles(articlesPage.content ?? []);
      } catch (err) {
        console.error('Erreur chargement des listes :', err);
      } finally {
        setLoadingLists(false);
      }
    };

    fetchLists();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && bonMaintenance && isEditing) {
      setFormData({
        num: bonMaintenance.num || '',
        n: bonMaintenance.n ?? '',
        titre: bonMaintenance.titre || '',
        description: bonMaintenance.description || '',
        type: bonMaintenance.type ?? '',
        urgence: bonMaintenance.urgence ?? '',
        prestataireId: bonMaintenance.prestataireId ?? '',
        lotArticleImmobilistationId: bonMaintenance.lotArticleImmobilistationId ?? '',
        personnelDemandantId: bonMaintenance.personnelDemandantId ?? '',
        date: toInputDateTime(bonMaintenance.date),
        dateFinIntervention: toInputDateTime(bonMaintenance.dateFinIntervention),
        effet: bonMaintenance.effet || '',
        cause: bonMaintenance.cause || '',
        remede: bonMaintenance.remede || '',
        commentaire: bonMaintenance.commentaire || '',
        arretOblig: !!bonMaintenance.arretOblig,
      });
    } else if (isOpen) {
      setFormData(emptyForm);
    }
    setTaches([]);
    setTacheForm(emptyTache);
    setIntervenants([]);
    setIntervenantForm(emptyIntervenant);
    setCommentaires([]);
    setCommentaireText('');
    setError(null);
  }, [isOpen, bonMaintenance, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const goToNext = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (step === 0 && !formData.titre.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }
    setError(null);
    if (step < STEP_LABELS.length - 1) setStep(step + 1);
  };

  const goToPrevious = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (step > 0) setStep(step - 1);
  };

  // ─── Gestion locale des tâches ───
  useEffect(() => {
    if (!tacheForm.prestataireArticlesId) {
      setTacheDisponible(null);
      return;
    }
    let cancelled = false;
    setCheckingTacheDisponible(true);
    pieceLigneService.getQuantiteDisponible(tacheForm.prestataireArticlesId)
      .then((qte) => { if (!cancelled) setTacheDisponible(qte); })
      .catch(() => { if (!cancelled) setTacheDisponible(null); })
      .finally(() => { if (!cancelled) setCheckingTacheDisponible(false); });
    return () => { cancelled = true; };
  }, [tacheForm.prestataireArticlesId]);

  const addTache = () => {
    if (!tacheForm.designation.trim()) {
      alert('La désignation de la tâche est obligatoire pour l\'ajouter.');
      return;
    }
    if (
      tacheForm.qte !== '' && tacheDisponible != null && Number(tacheForm.qte) > tacheDisponible
    ) {
      alert(
        `Quantité demandée (${tacheForm.qte}) supérieure à la quantité disponible (${tacheDisponible}).`
      );
      // Non bloquant : on continue quand même l'ajout de la tâche.
    }
    setTaches((prev) => [...prev, { ...tacheForm, _localId: Date.now() }]);
    setTacheForm(emptyTache);
  };
  const removeTache = (localId) => setTaches((prev) => prev.filter((t) => t._localId !== localId));

  // ─── Gestion locale des intervenants ───
  const addIntervenant = () => {
    if (!intervenantForm.personnelId && !intervenantForm.sousTraitantId) {
      alert('Sélectionne un technicien interne ou un sous-traitant pour ajouter cet intervenant.');
      return;
    }
    setIntervenants((prev) => [...prev, { ...intervenantForm, _localId: Date.now() }]);
    setIntervenantForm(emptyIntervenant);
  };
  const removeIntervenant = (localId) => setIntervenants((prev) => prev.filter((i) => i._localId !== localId));

  // ─── Gestion locale des commentaires ───
  const addCommentaire = () => {
    if (!commentaireText.trim()) {
      alert('Le texte du commentaire est vide.');
      return;
    }
    setCommentaires((prev) => [...prev, { commentaire: commentaireText.trim(), _localId: Date.now() }]);
    setCommentaireText('');
  };
  const removeCommentaire = (localId) => setCommentaires((prev) => prev.filter((c) => c._localId !== localId));

  const stripLocalId = (arr) => arr.map(({ _localId, ...rest }) => rest);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== STEP_LABELS.length - 1) return;

    if (!formData.titre.trim()) {
      setError('Le titre est obligatoire.');
      setStep(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        num: formData.num.trim() || null,
        n: formData.n === '' ? null : Number(formData.n),
        titre: formData.titre.trim(),
        description: formData.description.trim() || null,
        type: formData.type === '' ? null : Number(formData.type),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        prestataireId: formData.prestataireId === '' ? null : Number(formData.prestataireId),
        lotArticleImmobilistationId: formData.lotArticleImmobilistationId === '' ? null : Number(formData.lotArticleImmobilistationId),
        personnelDemandantId: formData.personnelDemandantId === '' ? null : Number(formData.personnelDemandantId),
        date: formData.date || null,
        dateFinIntervention: formData.dateFinIntervention || null,
        effet: formData.effet.trim() || null,
        cause: formData.cause.trim() || null,
        remede: formData.remede.trim() || null,
        commentaire: formData.commentaire.trim() || null,
        arretOblig: formData.arretOblig,
      };

      const children = isEditing ? null : {
        taches: stripLocalId(taches).map((t) => ({
          designation: t.designation.trim(),
          ordre: t.ordre === '' ? null : Number(t.ordre),
          dateDebut: t.dateDebut || null,
          dateFin: t.dateFin || null,
          prestataireArticlesId: t.prestataireArticlesId === '' ? null : Number(t.prestataireArticlesId),
          qte: t.qte === '' ? null : Number(t.qte),
          sousTraitantId: t.sousTraitantId === '' ? null : Number(t.sousTraitantId),
        })),
        intervenants: stripLocalId(intervenants).map((i) => ({
          personnelId: i.personnelId === '' ? null : Number(i.personnelId),
          sousTraitantId: i.sousTraitantId === '' ? null : Number(i.sousTraitantId),
          dateDebutIntervention: i.dateDebutIntervention || null,
          dateFinIntervention: i.dateFinIntervention || null,
          nbrHeure: i.nbrHeure === '' ? null : Number(i.nbrHeure),
          coutUnitaire: i.coutUnitaire === '' ? null : Number(i.coutUnitaire),
          commentaire: i.commentaire.trim() || null,
        })),
        commentaires: stripLocalId(commentaires),
      };

      await onSave(payload, children);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Échec de l'enregistrement.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStep0 = () => (
    <div className="step-content">
      <div className="form-grid">
        <div className="form-group">
          <label>Numéro</label>
          <input type="text" name="num" value={formData.num} onChange={handleChange} placeholder="Ex : BM-2026-014" />
        </div>
        <div className="form-group">
          <label>N° interne</label>
          <input type="number" name="n" value={formData.n} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Titre *</label>
          <input type="text" name="titre" value={formData.titre} onChange={handleChange}
            placeholder="Ex : Remplacement filtre climatisation bloc B" autoFocus required />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div className="form-group">
          <label>Urgence</label>
          <select name="urgence" value={formData.urgence} onChange={handleChange}>
            <option value="">—</option>
            {NIVEAU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Type (code)</label>
          <input type="number" name="type" value={formData.type} onChange={handleChange} />
        </div>
        <div className="form-group checkbox-group" style={{ gridColumn: '1 / -1' }}>
          <label className="checkbox-label">
            <input type="checkbox" name="arretOblig" checked={formData.arretOblig} onChange={handleChange} />
            Arrêt obligatoire de l'équipement
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="step-content">
      <div className="form-grid">
        <div className="form-group">
          <label>Prestataire</label>
          <select name="prestataireId" value={formData.prestataireId} onChange={handleChange} disabled={loadingLists}>
            <option value="">— Aucun —</option>
            {prestataires.map((p) => (
              <option key={p.id} value={p.id}>{p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Immobilisation</label>
          <select name="lotArticleImmobilistationId" value={formData.lotArticleImmobilistationId} onChange={handleChange} disabled={loadingLists}>
            <option value="">— Aucune —</option>
            {immobilisations.map((i) => <option key={i.id} value={i.id}>{i.designation || `Immobilisation #${i.id}`}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Personnel demandeur</label>
          <select name="personnelDemandantId" value={formData.personnelDemandantId} onChange={handleChange} disabled={loadingLists}>
            <option value="">— Aucun —</option>
            {personnels.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} {p.prenom}{p.matricule ? ` (${p.matricule})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Date début planifiée</label>
          <input type="datetime-local" name="date" value={formData.date} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Date fin planifiée</label>
          <input type="datetime-local" name="dateFinIntervention" value={formData.dateFinIntervention} onChange={handleChange} />
        </div>
      </div>
    </div>
  );

  const renderStepTaches = () => (
    <div className="step-content">
      {isEditing ? (
        <p className="bmd-notice">Gère les tâches depuis "Détails" une fois le bon enregistré.</p>
      ) : (
        <>
          <div className="bmd-inline-form bmd-inline-form--wrap">
            <input type="text" placeholder="Désignation" value={tacheForm.designation}
              onChange={(e) => setTacheForm({ ...tacheForm, designation: e.target.value })} />
            <input type="number" placeholder="Ordre" value={tacheForm.ordre}
              onChange={(e) => setTacheForm({ ...tacheForm, ordre: e.target.value })} />
            <input type="datetime-local" value={tacheForm.dateDebut}
              onChange={(e) => setTacheForm({ ...tacheForm, dateDebut: e.target.value })} />
            <input type="datetime-local" value={tacheForm.dateFin}
              onChange={(e) => setTacheForm({ ...tacheForm, dateFin: e.target.value })} />
            <select value={tacheForm.prestataireArticlesId} onChange={(e) => setTacheForm({ ...tacheForm, prestataireArticlesId: e.target.value })}>
              <option value="">— Article lié (optionnel) —</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.designation || `#${a.id}`}</option>)}
            </select>
            <input type="number" placeholder="Quantité" value={tacheForm.qte}
              onChange={(e) => setTacheForm({ ...tacheForm, qte: e.target.value })} />
            <select value={tacheForm.sousTraitantId} onChange={(e) => setTacheForm({ ...tacheForm, sousTraitantId: e.target.value })}>
              <option value="">— Sous-traitant (optionnel, requis pour Commander) —</option>
              {prestataires.map((p) => <option key={p.id} value={p.id}>{p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={addTache}>+ Ajouter</Button>
          </div>

          {tacheForm.prestataireArticlesId && (
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 6px' }}>
              {checkingTacheDisponible
                ? 'Vérification du stock...'
                : (tacheDisponible != null ? `Quantité disponible : ${tacheDisponible}` : 'Quantité disponible inconnue')}
            </p>
          )}
          {tacheForm.qte !== '' && tacheDisponible != null && Number(tacheForm.qte) > tacheDisponible && (
            <p style={{
              fontSize: '0.75rem', fontWeight: 600, color: '#b45309', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 8px', margin: '0 0 10px',
            }}>
              ⚠ Quantité demandée ({tacheForm.qte}) supérieure à la quantité disponible ({tacheDisponible}).
            </p>
          )}

          <p style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 600, marginBottom: '10px' }}>
            {taches.length} tâche{taches.length > 1 ? 's' : ''} ajoutée{taches.length > 1 ? 's' : ''} à ce bon
          </p>
          {taches.length === 0 ? (
            <p className="bmd-empty">Aucune tâche ajoutée pour l'instant.</p>
          ) : (
            <ul className="bmd-list">
              {taches.map((t) => {
                const article = articles.find((a) => String(a.id) === String(t.prestataireArticlesId));
                return (
                  <li key={t._localId} className="bmd-list-item">
                    <span className="bmd-item-title">
                      {t.designation}
                      {article ? ` · ${article.designation}` : ''}
                      {t.qte ? ` (Qté ${t.qte})` : ''}
                    </span>
                    <button type="button" className="bmd-delete-btn" onClick={() => removeTache(t._localId)}>Retirer</button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const renderStepIntervenants = () => (
    <div className="step-content">
      {isEditing ? (
        <p className="bmd-notice">Gère les intervenants depuis "Détails" une fois le bon enregistré.</p>
      ) : (
        <>
          <div className="bmd-inline-form bmd-inline-form--wrap">
            <select value={intervenantForm.personnelId} onChange={(e) => setIntervenantForm({ ...intervenantForm, personnelId: e.target.value })}>
              <option value="">— Technicien interne —</option>
              {personnels.map((p) => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
            </select>
            <select value={intervenantForm.sousTraitantId} onChange={(e) => setIntervenantForm({ ...intervenantForm, sousTraitantId: e.target.value })}>
              <option value="">— Sous-traitant —</option>
              {prestataires.map((p) => <option key={p.id} value={p.id}>{p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}</option>)}
            </select>
            <input type="datetime-local" value={intervenantForm.dateDebutIntervention}
              onChange={(e) => setIntervenantForm({ ...intervenantForm, dateDebutIntervention: e.target.value })} />
            <input type="datetime-local" value={intervenantForm.dateFinIntervention}
              onChange={(e) => setIntervenantForm({ ...intervenantForm, dateFinIntervention: e.target.value })} />
            <input type="number" placeholder="Nb heures" value={intervenantForm.nbrHeure}
              onChange={(e) => setIntervenantForm({ ...intervenantForm, nbrHeure: e.target.value })} />
            <input type="number" placeholder="Coût unitaire" value={intervenantForm.coutUnitaire}
              onChange={(e) => setIntervenantForm({ ...intervenantForm, coutUnitaire: e.target.value })} />
            <input type="text" placeholder="Commentaire" value={intervenantForm.commentaire}
              onChange={(e) => setIntervenantForm({ ...intervenantForm, commentaire: e.target.value })}
              style={{ gridColumn: '1 / -1' }} />
            <Button type="button" variant="secondary" onClick={addIntervenant}>+ Ajouter</Button>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: 600, marginBottom: '10px' }}>
            {intervenants.length} intervenant{intervenants.length > 1 ? 's' : ''} ajouté{intervenants.length > 1 ? 's' : ''} à ce bon
          </p>
          {intervenants.length === 0 ? (
            <p className="bmd-empty">Aucun intervenant ajouté pour l'instant.</p>
          ) : (
            <ul className="bmd-list">
              {intervenants.map((i) => {
                const personnel = personnels.find((p) => String(p.id) === String(i.personnelId));
                const prest = prestataires.find((p) => String(p.id) === String(i.sousTraitantId));
                return (
                  <li key={i._localId} className="bmd-list-item">
                    <span className="bmd-item-title">
                      {personnel ? `${personnel.nom} ${personnel.prenom}` : (prest?.raisonSociale || '—')}
                    </span>
                    <button type="button" className="bmd-delete-btn" onClick={() => removeIntervenant(i._localId)}>Retirer</button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const renderStepCommentaires = () => (
    <div className="step-content">
      {isEditing ? (
        <p className="bmd-notice">Gère les commentaires depuis "Détails" une fois le bon enregistré.</p>
      ) : (
        <>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '6px' }}>Commentaires</label>
          <div className="bmd-inline-form">
            <input type="text" placeholder="Ajouter un commentaire..." value={commentaireText}
              onChange={(e) => setCommentaireText(e.target.value)} style={{ gridColumn: '1 / 3' }} />
            <Button type="button" variant="secondary" onClick={addCommentaire}>+ Ajouter</Button>
          </div>
          {commentaires.length > 0 && (
            <ul className="bmd-list">
              {commentaires.map((c) => (
                <li key={c._localId} className="bmd-list-item">
                  <span className="bmd-item-title">{c.commentaire}</span>
                  <button type="button" className="bmd-delete-btn" onClick={() => removeCommentaire(c._localId)}>Retirer</button>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '14px' }}>
            Les documents d'achat (Demander/Commander) se gèrent depuis la fiche, une fois le bon créé —
            ils nécessitent un bon déjà enregistré.
          </p>
        </>
      )}
    </div>
  );

  const renderStepDetails = () => (
    <div className="step-content">
      <div className="form-grid">
        <div className="form-group">
          <label>Cause</label>
          <input type="text" name="cause" value={formData.cause} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Effet</label>
          <input type="text" name="effet" value={formData.effet} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Remède</label>
          <input type="text" name="remede" value={formData.remede} onChange={handleChange} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Commentaire général</label>
          <textarea name="commentaire" value={formData.commentaire} onChange={handleChange} rows={2}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStepTaches();
      case 3: return renderStepIntervenants();
      case 4: return renderStepCommentaires();
      case 5: return renderStepDetails();
      default: return null;
    }
  };

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container bon-maintenance-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px' }}>
        <div className="modal-header">
          <h2>{isEditing ? 'Modifier le bon de maintenance' : 'Nouveau bon de maintenance'}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="progress-indicator">
          <div className="step-dots">
            {STEP_LABELS.map((_, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className={`line ${step >= idx ? 'filled' : ''}`}></span>}
                <span className={`dot ${step === idx ? 'active' : step > idx ? 'done' : ''}`}>{idx + 1}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="step-label">{STEP_LABELS[step]}</div>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {renderStepContent()}

          <div className="navigation-footer">
            <div className="nav-buttons">
              <Button type="button" variant="secondary" onClick={goToPrevious} disabled={step === 0}>
                Précédent
              </Button>
              {!isLastStep ? (
                <Button type="button" variant="primary" onClick={goToNext}>
                  Suivant
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer tout'}
                </Button>
              )}
            </div>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BonMaintenanceModal;