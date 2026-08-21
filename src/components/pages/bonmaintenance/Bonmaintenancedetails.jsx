import { useEffect, useState } from 'react';
import bonMaintenanceTacheService from '../../../services/Bonmaintenancetacheservice';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceIntervenantHistoriqueService from '../../../services/Bonmaintenanceintervenanthistoriqueservice';
import bonMaintenanceCommentaireService from '../../../services/Bonmaintenancecommentaireservice';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import bonMaintenancePieceService from '../../../services/Bonmaintenancepieceservice';
import bonMaintenancePieceImmoService from '../../../services/Bonmaintenancepieceimmoservice';
import bonMaintenanceHistoriqueService from '../../../services/Bonmaintenancehistoriqueservice';
import personnelService from '../../../services/personnelService';
import prestataireService from '../../../services/prestataireService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import articleService from '../../../services/articleService';
import pieceService from '../../../services/pieceService';
import Button from '../../ui/Button';
import './BonMaintenanceDetails.css';

const TABS = [
  { key: 'taches', label: 'Tâches' },
  { key: 'intervenants', label: 'Intervenants' },
  { key: 'pieces', label: 'Pièces' },
  { key: 'piecesImmo', label: 'Pièces immo' },
  { key: 'commentaires', label: 'Commentaires' },
  { key: 'documents', label: "Documents d'achat" },
  { key: 'historique', label: 'Historique' },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BonMaintenanceDetails({ bonMaintenance, onBack }) {
  const [activeTab, setActiveTab] = useState('taches');

  return (
    <div className="bmd-container">
      <div className="bmd-header">
        <div>
          <h2>{bonMaintenance.num || `Bon #${bonMaintenance.id}`}</h2>
          <p>{bonMaintenance.titre}</p>
        </div>
        <button className="bmd-back-btn" onClick={onBack}>← Retour à la liste</button>
      </div>

      <div className="bmd-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`bmd-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bmd-panel">
        {activeTab === 'taches' && <TachesTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'intervenants' && <IntervenantsTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'pieces' && <PiecesTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'piecesImmo' && <PiecesImmoTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'commentaires' && <CommentairesTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'documents' && <DocumentsTab bonMaintenanceId={bonMaintenance.id} />}
        {activeTab === 'historique' && <HistoriqueTab bonMaintenanceId={bonMaintenance.id} />}
      </div>
    </div>
  );
}


const emptyTacheForm = {
  designation: '', ordre: '', dateDebut: '', dateFin: '',
  prestataireArticlesId: '', qte: '', sousTraitantId: '',
};

function TachesTab({ bonMaintenanceId }) {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState(emptyTacheForm);
  const [editingId, setEditingId] = useState(null);

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

  useEffect(() => {
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, []);

  const resetForm = () => {
    setForm(emptyTacheForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t) => {
    setForm({
      designation: t.designation || '',
      ordre: t.ordre ?? '',
      dateDebut: t.dateDebut ? t.dateDebut.slice(0, 16) : '',
      dateFin: t.dateFin ? t.dateFin.slice(0, 16) : '',
      prestataireArticlesId: t.prestataireArticlesId ?? '',
      qte: t.qte ?? '',
      sousTraitantId: t.sousTraitantId ?? '',
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.designation.trim()) return;
    setSaving(true);
    try {
      const payload = {
        bonMaintenanceId,
        designation: form.designation.trim(),
        ordre: form.ordre === '' ? null : Number(form.ordre),
        dateDebut: form.dateDebut || null,
        dateFin: form.dateFin || null,
        prestataireArticlesId: form.prestataireArticlesId === '' ? null : Number(form.prestataireArticlesId),
        qte: form.qte === '' ? null : Number(form.qte),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
      };

      if (editingId) {
        await bonMaintenanceTacheService.update(editingId, payload);
      } else {
        await bonMaintenanceTacheService.create(payload);
      }

      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      alert(editingId ? "Échec de la modification de la tâche." : "Échec de l'ajout de la tâche.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await bonMaintenanceTacheService.remove(id);
      setTaches((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{taches.length} tâche{taches.length > 1 ? 's' : ''}</span>
        <button className="bmd-add-btn" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Annuler' : '+ Ajouter une tâche'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form bmd-inline-form--wrap" onSubmit={handleSubmit}>
          <input
            type="text" placeholder="Désignation *" value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })} required autoFocus
          />
          <input
            type="number" placeholder="Ordre" value={form.ordre}
            onChange={(e) => setForm({ ...form, ordre: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateDebut}
            onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateFin}
            onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
          />
          <select
            value={form.prestataireArticlesId}
            onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
          >
            <option value="">— Article lié (optionnel) —</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.designation || `#${a.id}`}</option>
            ))}
          </select>
          <input
            type="number" placeholder="Quantité" value={form.qte}
            onChange={(e) => setForm({ ...form, qte: e.target.value })}
          />
          <select
            value={form.sousTraitantId}
            onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}
          >
            <option value="">— Sous-traitant (optionnel, requis pour Commander) —</option>
            {prestataires.map((p) => (
              <option key={p.id} value={p.id}>{p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim() || `#${p.id}`}</option>
            ))}
          </select>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Enregistrement...' : (editingId ? 'Mettre à jour' : 'Ajouter')}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : taches.length === 0 ? (
        <p className="bmd-empty">Aucune tâche pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {taches.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((t) => (
            <li key={t.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">{t.ordre != null ? `${t.ordre}. ` : ''}{t.designation}</span>
                <span className="bmd-item-sub">
                  {formatDateTime(t.dateDebut)} → {formatDateTime(t.dateFin)}
                  {t.prestataireArticlesId != null ? ` · Article #${t.prestataireArticlesId}` : ''}
                  {t.qte != null ? ` · Qté ${t.qte}` : ''}
                  {t.sousTraitant?.raisonSociale ? ` · ${t.sousTraitant.raisonSociale}` : (t.sousTraitantId != null ? ` · Sous-traitant #${t.sousTraitantId}` : '')}
                </span>
              </div>
              <div className="bmd-item-actions">
                <button className="bmd-history-toggle" onClick={() => startEdit(t)}>Modifier</button>
                <button className="bmd-delete-btn" onClick={() => handleDelete(t.id)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function IntervenantsTab({ bonMaintenanceId }) {
  const [intervenants, setIntervenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnels, setPersonnels] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [form, setForm] = useState({
    personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '',
    nbrHeure: '', coutUnitaire: '', commentaire: '',
  });

  const [expandedHistoId, setExpandedHistoId] = useState(null);
  const [historiqueParIntervenant, setHistoriqueParIntervenant] = useState({});
  const [loadingHistoId, setLoadingHistoId] = useState(null);

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

  useEffect(() => {
    if (!showForm) return;
    personnelService.getAll(0, 200).then((p) => setPersonnels(p.content ?? [])).catch(console.error);
    prestataireService.getAll(0, 200).then((p) => setPrestataires(p.content ?? [])).catch(console.error);
  }, [showForm]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bonMaintenanceIntervenantService.create({
        bonMaintenanceId,
        personnelId: form.personnelId === '' ? null : Number(form.personnelId),
        sousTraitantId: form.sousTraitantId === '' ? null : Number(form.sousTraitantId),
        dateDebutIntervention: form.dateDebutIntervention || null,
        dateFinIntervention: form.dateFinIntervention || null,
        nbrHeure: form.nbrHeure === '' ? null : Number(form.nbrHeure),
        coutUnitaire: form.coutUnitaire === '' ? null : Number(form.coutUnitaire),
        commentaire: form.commentaire.trim() || null,
      });
      setForm({ personnelId: '', sousTraitantId: '', dateDebutIntervention: '', dateFinIntervention: '', nbrHeure: '', coutUnitaire: '', commentaire: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout de l'intervenant.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet intervenant ?')) return;
    try {
      await bonMaintenanceIntervenantService.remove(id);
      setIntervenants((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  const toggleHistorique = async (intervenantId) => {
    if (expandedHistoId === intervenantId) {
      setExpandedHistoId(null);
      return;
    }
    setExpandedHistoId(intervenantId);
    if (!historiqueParIntervenant[intervenantId]) {
      setLoadingHistoId(intervenantId);
      try {
        const data = await bonMaintenanceIntervenantHistoriqueService.getByIntervenant(intervenantId);
        setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: data ?? [] }));
      } catch (err) {
        console.error(err);
        setHistoriqueParIntervenant((prev) => ({ ...prev, [intervenantId]: [] }));
      } finally {
        setLoadingHistoId(null);
      }
    }
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{intervenants.length} intervenant{intervenants.length > 1 ? 's' : ''}</span>
        <button className="bmd-add-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Ajouter un intervenant'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form bmd-inline-form--wrap" onSubmit={handleAdd}>
          <select value={form.personnelId} onChange={(e) => setForm({ ...form, personnelId: e.target.value })}>
            <option value="">— Technicien interne —</option>
            {personnels.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
            ))}
          </select>
          <select value={form.sousTraitantId} onChange={(e) => setForm({ ...form, sousTraitantId: e.target.value })}>
            <option value="">— Sous-traitant —</option>
            {prestataires.map((p) => (
              <option key={p.id} value={p.id}>{p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()}</option>
            ))}
          </select>
          <input
            type="datetime-local" value={form.dateDebutIntervention}
            onChange={(e) => setForm({ ...form, dateDebutIntervention: e.target.value })}
          />
          <input
            type="datetime-local" value={form.dateFinIntervention}
            onChange={(e) => setForm({ ...form, dateFinIntervention: e.target.value })}
          />
          <input
            type="number" placeholder="Nb heures" value={form.nbrHeure}
            onChange={(e) => setForm({ ...form, nbrHeure: e.target.value })}
          />
          <input
            type="number" placeholder="Coût unitaire" value={form.coutUnitaire}
            onChange={(e) => setForm({ ...form, coutUnitaire: e.target.value })}
          />
          <input
            type="text" placeholder="Commentaire" value={form.commentaire}
            onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
            style={{ gridColumn: '1 / -1' }}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : intervenants.length === 0 ? (
        <p className="bmd-empty">Aucun intervenant pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {intervenants.map((i) => (
            <li key={i.id} className="bmd-list-item bmd-list-item--stacked">
              <div className="bmd-list-item-row">
                <div>
                  <span className="bmd-item-title">
                    {i.personnel ? `${i.personnel.nom} ${i.personnel.prenom}` : (i.sousTraitant?.raisonSociale || i.intervenantNom || `Intervenant #${i.id}`)}
                  </span>
                  <span className="bmd-item-sub">
                    {formatDateTime(i.dateDebutIntervention)} → {formatDateTime(i.dateFinIntervention)}
                    {i.nbrHeure != null ? ` · ${i.nbrHeure}h` : ''}
                  </span>
                </div>
                <div className="bmd-item-actions">
                  <button className="bmd-history-toggle" onClick={() => toggleHistorique(i.id)}>
                    {expandedHistoId === i.id ? 'Masquer historique' : 'Historique'}
                  </button>
                  <button className="bmd-delete-btn" onClick={() => handleDelete(i.id)}>Supprimer</button>
                </div>
              </div>

              {expandedHistoId === i.id && (
                <div className="bmd-history-panel">
                  {loadingHistoId === i.id ? (
                    <p className="bmd-empty">Chargement...</p>
                  ) : (historiqueParIntervenant[i.id] ?? []).length === 0 ? (
                    <p className="bmd-empty">Aucun historique pour cet intervenant.</p>
                  ) : (
                    <ul className="bmd-history-list">
                      {historiqueParIntervenant[i.id].map((h) => (
                        <li key={h.id} className="bmd-history-row">
                          <span className="bmd-history-action">{h.action}</span>
                          <span className="bmd-history-date">{formatDateTime(h.date)}</span>
                          <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function PiecesTab({ bonMaintenanceId }) {
  const [pieces, setPieces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState({ prestataireArticlesId: '', modeStock: '', qte: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenancePieceService.getByBonMaintenance(bonMaintenanceId);
      setPieces(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bonMaintenancePieceService.create({
        bonMaintenanceId,
        prestataireArticlesId: form.prestataireArticlesId === '' ? null : Number(form.prestataireArticlesId),
        modeStock: form.modeStock === '' ? null : Number(form.modeStock),
        qte: form.qte === '' ? null : Number(form.qte),
      });
      setForm({ prestataireArticlesId: '', modeStock: '', qte: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout de la pièce.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette pièce ?')) return;
    try {
      await bonMaintenancePieceService.remove(id);
      setPieces((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{pieces.length} pièce{pieces.length > 1 ? 's' : ''}</span>
        <button className="bmd-add-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Ajouter une pièce'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <select
            value={form.prestataireArticlesId}
            onChange={(e) => setForm({ ...form, prestataireArticlesId: e.target.value })}
            autoFocus
          >
            <option value="">— Sélectionner un article —</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.designation || `#${a.id}`}</option>
            ))}
          </select>
          <input
            type="number" placeholder="Mode stock" value={form.modeStock}
            onChange={(e) => setForm({ ...form, modeStock: e.target.value })}
          />
          <input
            type="number" placeholder="Quantité" value={form.qte}
            onChange={(e) => setForm({ ...form, qte: e.target.value })}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : pieces.length === 0 ? (
        <p className="bmd-empty">Aucune pièce pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {pieces.map((p) => (
            <li key={p.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {articles.find((a) => a.id === p.prestataireArticlesId)?.designation
                    || (p.prestataireArticlesId != null ? `Article #${p.prestataireArticlesId}` : 'Article non spécifié')}
                </span>
                <span className="bmd-item-sub">
                  {p.modeStock != null ? `Mode stock ${p.modeStock}` : ''} {p.qte != null ? `· Qté ${p.qte}` : ''}
                </span>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(p.id)}>Supprimer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function PiecesImmoTab({ bonMaintenanceId }) {
  const [piecesImmo, setPiecesImmo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [immobilisations, setImmobilisations] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [form, setForm] = useState({ lotArticleImmobilistationId: '', bonMaintenancePieceId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenancePieceImmoService.getByBonMaintenance(bonMaintenanceId);
      setPiecesImmo(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    if (!showForm) return;
    lotArticleImmobilistationService.getAll(0, 200).then((p) => setImmobilisations(p.content ?? [])).catch(console.error);
    bonMaintenancePieceService.getByBonMaintenance(bonMaintenanceId).then((data) => setPieces(data ?? [])).catch(console.error);
  }, [showForm, bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.lotArticleImmobilistationId) return;
    setSaving(true);
    try {
      await bonMaintenancePieceImmoService.create({
        bonMaintenanceId,
        lotArticleImmobilistationId: Number(form.lotArticleImmobilistationId),
        bonMaintenancePieceId: form.bonMaintenancePieceId === '' ? null : Number(form.bonMaintenancePieceId),
      });
      setForm({ lotArticleImmobilistationId: '', bonMaintenancePieceId: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout de la pièce immobilisée.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Retirer cette immobilisation ?')) return;
    try {
      await bonMaintenancePieceImmoService.remove(id);
      setPiecesImmo((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{piecesImmo.length} immobilisation{piecesImmo.length > 1 ? 's' : ''} liée{piecesImmo.length > 1 ? 's' : ''}</span>
        <button className="bmd-add-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Ajouter une immobilisation'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form bmd-inline-form--wrap" onSubmit={handleAdd}>
          <select
            value={form.lotArticleImmobilistationId}
            onChange={(e) => setForm({ ...form, lotArticleImmobilistationId: e.target.value })}
            required
          >
            <option value="">Sélectionner une immobilisation *</option>
            {immobilisations.map((i) => (
              <option key={i.id} value={i.id}>{i.designation || `#${i.id}`}</option>
            ))}
          </select>
          <select
            value={form.bonMaintenancePieceId}
            onChange={(e) => setForm({ ...form, bonMaintenancePieceId: e.target.value })}
          >
            <option value="">— Pièce liée (optionnel) —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>Article #{p.prestataireArticlesId ?? p.id}</option>
            ))}
          </select>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : piecesImmo.length === 0 ? (
        <p className="bmd-empty">Aucune immobilisation liée pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {piecesImmo.map((p) => (
            <li key={p.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {p.lotArticleImmobilistation?.designation || `Immobilisation #${p.lotArticleImmobilistationId}`}
                </span>
                {p.bonMaintenancePieceId && (
                  <span className="bmd-item-sub">Pièce liée #{p.bonMaintenancePieceId}</span>
                )}
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(p.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function CommentairesTab({ bonMaintenanceId }) {
  const [commentaires, setCommentaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceCommentaireService.getByBonMaintenance(bonMaintenanceId);
      setCommentaires(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await bonMaintenanceCommentaireService.create({ bonMaintenanceId, commentaire: text.trim() });
      setText('');
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du commentaire.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await bonMaintenanceCommentaireService.remove(id);
      setCommentaires((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  return (
    <div>
      <form className="bmd-comment-form" onSubmit={handleAdd}>
        <textarea
          placeholder="Ajouter un commentaire..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <Button type="submit" variant="primary" disabled={saving || !text.trim()}>
          {saving ? 'Envoi...' : 'Publier'}
        </Button>
      </form>

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : commentaires.length === 0 ? (
        <p className="bmd-empty">Aucun commentaire pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {commentaires.map((c) => (
            <li key={c.id} className="bmd-list-item bmd-comment-item">
              <div>
                <span className="bmd-item-title">{c.personnelCreation ? `${c.personnelCreation.nom} ${c.personnelCreation.prenom}` : (c.personnelCreationNom || 'Anonyme')}</span>
                <span className="bmd-item-sub">{formatDateTime(c.date)}</span>
                <p className="bmd-comment-text">{c.commentaire}</p>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(c.id)}>Supprimer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function DocumentsTab({ bonMaintenanceId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pieceId, setPieceId] = useState('');
  const [piecesDisponibles, setPiecesDisponibles] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceDocumentAchatService.getByBonMaintenanceId(bonMaintenanceId);
      setDocuments(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    pieceService.getAll(0, 200).then((p) => setPiecesDisponibles(p.content ?? [])).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!pieceId) return;
    setSaving(true);
    try {
      await bonMaintenanceDocumentAchatService.create({ bonMaintenanceId, pieceId: Number(pieceId) });
      setPieceId('');
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert("Échec de l'ajout du document.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Retirer ce document ?')) return;
    try {
      await bonMaintenanceDocumentAchatService.remove(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
      alert('Échec de la suppression.');
    }
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{documents.length} document{documents.length > 1 ? 's' : ''}</span>
        <button className="bmd-add-btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Ajouter un document'}
        </button>
      </div>

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <select
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            required
            autoFocus
          >
            <option value="">Sélectionner une pièce (MEDSYS) *</option>
            {piecesDisponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.numPiece || `#${p.id}`}{p.description ? ` — ${p.description}` : ''}
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : documents.length === 0 ? (
        <p className="bmd-empty">Aucun document d'achat pour l'instant.</p>
      ) : (
        <ul className="bmd-list">
          {documents.map((d) => (
            <li key={d.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {d.codePieceType ? `${d.codePieceType}` : (d.piece?.numPiece || `Pièce #${d.pieceId}`)}
                </span>
                <span className="bmd-item-sub">
                  {d.prestataireArticlesId != null ? `Article #${d.prestataireArticlesId}` : ''}
                  {d.qte != null ? ` · Qté ${d.qte}` : ''}
                  {d.cibleId != null ? ` · Sous-traitant #${d.cibleId}` : ''}
                  {d.piece?.description ? ` · ${d.piece.description}` : ''}
                </span>
              </div>
              <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function HistoriqueTab({ bonMaintenanceId }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bonMaintenanceHistoriqueService.getByBonMaintenance(bonMaintenanceId);
      setHistorique(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  return (
    <div>
      <div className="bmd-panel-header">
        <span className="bmd-panel-count">{historique.length} événement{historique.length > 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <p className="bmd-empty">Chargement...</p>
      ) : historique.length === 0 ? (
        <p className="bmd-empty">Aucun historique pour l'instant.</p>
      ) : (
        <ul className="bmd-history-list">
          {historique.map((h) => (
            <li key={h.id} className="bmd-history-row">
              <span className="bmd-history-action">{h.action}</span>
              <span className="bmd-history-date">{formatDateTime(h.date)}</span>
              <span className="bmd-history-author">{h.personnelCreationNom || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}