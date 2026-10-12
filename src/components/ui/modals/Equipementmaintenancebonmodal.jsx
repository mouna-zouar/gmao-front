import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import authService from '../../../services/Authservice';
import equipementMaintenanceService, {
  URGENCE_OPTIONS,
} from '../../../services/equipementMaintenanceService';
import {
  Wrench, X, Stethoscope, Calendar, AlertTriangle, Loader2, Save, Info,
} from 'lucide-react';
import './Modal.css';
import './Vehiculemaintenancebonmodal.css';

/**
 * Miroir de Vehiculemaintenancebonmodal.jsx, mais pour la demande de
 * maintenance préventive réglementaire d'un équipement médical (calibration,
 * contrôle qualité...), saisie depuis la fiche équipement.
 */
const NAV_SECTIONS = [
  { id: 'equipement', label: 'Équipement', Icon: Stethoscope },
  { id: 'demande', label: 'Demande', Icon: Wrench },
];

function toInputDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('fr-FR') : '—');

/**
 * @param immobilisation  { id, designation, marque, ... } — résumé de l'équipement
 * @param onCreated       callback(resultat) après création — resultat = { bon, declenchement, ... }
 */
export default function EquipementMaintenanceBonModal({ isOpen, onClose, immobilisation, onCreated }) {
  const [activeSection, setActiveSection] = useState('equipement');

  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [statuts, setStatuts] = useState([]);

  const [formData, setFormData] = useState({
    typeId: '',
    description: '',
    urgence: 2,
    dateDemande: '',
    reinitialiserEcheance: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Préremplissage à l'ouverture ───
  useEffect(() => {
    if (!isOpen || !immobilisation?.id) return;

    setError(null);
    setActiveSection('equipement');
    setFormData({
      typeId: '',
      description: '',
      urgence: 2,
      dateDemande: toInputDateTime(new Date()),
      reinitialiserEcheance: true,
    });

    let annule = false;

    (async () => {
      setLoadingTypes(true);
      try {
        const [t, s] = await Promise.all([
          equipementMaintenanceService.getTypesApplicables(immobilisation.id),
          equipementMaintenanceService.getStatuts(immobilisation.id).catch(() => []),
        ]);
        if (annule) return;
        setTypes((t ?? []).filter((x) => x.actif !== false));
        setStatuts(s ?? []);
      } catch (err) {
        if (!annule) {
          console.error('Erreur chargement des types de maintenance :', err);
          setTypes([]);
        }
      } finally {
        if (!annule) setLoadingTypes(false);
      }
    })();

    return () => { annule = true; };
  }, [isOpen, immobilisation?.id]);

  /** Situation préventive du type choisi : indique si une échéance est déjà atteinte. */
  const statutTypeChoisi = useMemo(
    () => statuts.find((s) => String(s.typeId) === String(formData.typeId)) ?? null,
    [statuts, formData.typeId]
  );

  const typeBloque =
    statutTypeChoisi?.statut === 'EN_COURS' && statutTypeChoisi?.bonMaintenanceId != null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    if (!formData.description.trim()) {
      setError('Le motif / la description de la demande est obligatoire.');
      setActiveSection('demande');
      return;
    }
    if (typeBloque) {
      setError(
        `Un bon est déjà en cours pour « ${statutTypeChoisi.typeLibelle} » sur cet équipement `
        + `(bon n°${statutTypeChoisi.bonMaintenanceId}). Clôturez-le ou choisissez un autre type.`
      );
      setActiveSection('demande');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = authService.getSession();
      const resultat = await equipementMaintenanceService.creerBonManuel(immobilisation.id, {
        typeId: formData.typeId === '' ? null : Number(formData.typeId),
        description: formData.description.trim(),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        dateDemande: formData.dateDemande || null,
        reinitialiserEcheance: formData.typeId === '' ? false : !!formData.reinitialiserEcheance,
        personnelDemandantNom: session?.login ?? null,
      });
      onCreated?.(resultat);
      onClose();
    } catch (err) {
      // 409 = un bon est déjà ouvert pour ce type, 400 = saisie invalide.
      setError(err.response?.data?.message || "Échec de la création du bon de maintenance.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !immobilisation) return null;

  const typeChoisi = types.find((t) => String(t.id) === String(formData.typeId));

  const sectionCounts = {
    equipement: 0,
    demande: [formData.typeId, formData.description, formData.urgence]
      .filter((v) => v !== '' && v != null).length,
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'equipement':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Équipement concerné</h3>
              <p>Informations reprises automatiquement de la fiche</p>
            </div>

            <div className="vmb-readonly-grid">
              <div className="vmb-readonly">
                <span className="vmb-readonly-label"><Stethoscope size={13} strokeWidth={2.5} /> Équipement</span>
                <span className="vmb-readonly-value vmb-readonly-strong">
                  {immobilisation.designation || `#${immobilisation.id}`}
                </span>
              </div>

              {immobilisation.marque && (
                <div className="vmb-readonly">
                  <span className="vmb-readonly-label">Marque / Modèle</span>
                  <span className="vmb-readonly-value">
                    {immobilisation.marque}
                    {immobilisation.modele ? ` ${immobilisation.modele}` : ''}
                  </span>
                </div>
              )}

              <div className="vmb-readonly">
                <span className="vmb-readonly-label"><Calendar size={13} strokeWidth={2.5} /> Mise en exploitation</span>
                <span className="vmb-readonly-value">
                  {fmtDate(immobilisation.dateExploitation)}
                </span>
              </div>
            </div>

            <p className="bmm-hint vmb-hint">
              <Info size={13} strokeWidth={2.5} />
              Ces champs ne sont pas modifiables ici. La date d'intervention sera
              enregistrée à la clôture du bon pour recalculer la prochaine échéance.
            </p>
          </div>
        );

      case 'demande':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Demande de maintenance</h3>
              <p>Opération, motif, urgence et date de demande</p>
            </div>

            <div className="bmm-grid">
              <div className="bmm-field bmm-field--full">
                <label htmlFor="emb-type">Type de maintenance</label>
                <select
                  id="emb-type"
                  name="typeId"
                  value={formData.typeId}
                  onChange={handleChange}
                  disabled={loadingTypes}
                >
                  <option value="">
                    {loadingTypes ? 'Chargement...' : '— Hors référentiel (demande ponctuelle) —'}
                  </option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.libelle} — tous les {Number(t.intervalleJours).toLocaleString('fr-FR')} jours
                    </option>
                  ))}
                </select>

                {!loadingTypes && types.length === 0 && (
                  <small className="bmm-field-hint">
                    Aucun type actif pour cet équipement. La demande sera créée hors référentiel.
                  </small>
                )}

                {statutTypeChoisi && !typeBloque && (
                  <small className="bmm-field-hint">
                    Prochaine échéance le {fmtDate(statutTypeChoisi.prochaineEcheance)} —{' '}
                    {statutTypeChoisi.joursRestants >= 0
                      ? `il reste ${statutTypeChoisi.joursRestants} jour(s) avant le déclenchement automatique.`
                      : `échéance dépassée de ${Math.abs(statutTypeChoisi.joursRestants)} jour(s).`}
                  </small>
                )}

                {typeBloque && (
                  <small className="bmm-field-error">
                    <AlertTriangle size={12} strokeWidth={2.5} />
                    Un bon est déjà en cours pour cette opération (n°{statutTypeChoisi.bonMaintenanceId}).
                  </small>
                )}
              </div>

              <div className="bmm-field bmm-field--full">
                <label htmlFor="emb-description">
                  Motif / Description <span className="bmm-required">*</span>
                </label>
                <textarea
                  id="emb-description"
                  name="description"
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Dérive constatée lors d'un contrôle, calibration anticipée avant une campagne, vérification suite incident..."
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="emb-urgence">Niveau d'urgence</label>
                <select
                  id="emb-urgence"
                  name="urgence"
                  value={formData.urgence}
                  onChange={handleChange}
                >
                  {URGENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="bmm-field">
                <label htmlFor="emb-date">Date de demande</label>
                <input
                  id="emb-date"
                  type="datetime-local"
                  name="dateDemande"
                  value={formData.dateDemande}
                  onChange={handleChange}
                />
              </div>

              {formData.typeId !== '' && (
                <div className="bmm-field bmm-field--full">
                  <label className="vmb-checkbox">
                    <input
                      type="checkbox"
                      name="reinitialiserEcheance"
                      checked={formData.reinitialiserEcheance}
                      onChange={handleChange}
                    />
                    <span>
                      Cette intervention compte comme une exécution de{' '}
                      <strong>{typeChoisi?.libelle ?? 'ce type'}</strong> : à la clôture du bon,
                      la prochaine échéance sera recalculée.
                    </span>
                  </label>
                  <small className="bmm-field-hint">
                    Décochez si la demande ne remplace pas le contrôle périodique
                    (le cycle préventif restera inchangé).
                  </small>
                </div>
              )}
            </div>

            <div className="bmm-summary">
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Équipement</span>
                <span className="bmm-summary-value">
                  {immobilisation.designation || `#${immobilisation.id}`}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Opération</span>
                <span className="bmm-summary-value">
                  {typeChoisi?.libelle ?? 'Demande ponctuelle'}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Urgence</span>
                <span className="bmm-summary-value">
                  {URGENCE_OPTIONS.find((o) => o.value === Number(formData.urgence))?.label ?? '—'}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bmm-modal bmm-modal--sm" onClick={(e) => e.stopPropagation()}>

        <div className="bmm-header">
          <div className="bmm-header-left">
            <div className="bmm-header-icon-wrap">
              <Wrench size={22} strokeWidth={2} />
            </div>
            <div>
              <span className="bmm-eyebrow">Maintenance préventive</span>
              <h2>Créer un bon de maintenance</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className="bmm-mode-badge">{immobilisation.designation || `#${immobilisation.id}`}</span>
            <button type="button" className="bmm-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <form className="bmm-layout" onSubmit={handleSubmit}>
          <aside className="bmm-nav">
            <div className="bmm-nav-title">Sections</div>
            <nav className="bmm-nav-list">
              {NAV_SECTIONS.map((s) => {
                const Icon = s.Icon;
                const count = sectionCounts[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`bmm-nav-item ${activeSection === s.id ? 'active' : ''}`}
                    onClick={() => { setError(null); setActiveSection(s.id); }}
                  >
                    <span className="bmm-nav-item-icon">
                      <Icon size={15} strokeWidth={2.3} />
                    </span>
                    <span className="bmm-nav-item-label">{s.label}</span>
                    {count > 0 && <span className="bmm-nav-item-count">{count}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="bmm-content">
            {renderContent()}

            {error && (
              <div className="bmm-error">
                <AlertTriangle size={16} strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        <div className="bmm-footer">
          <div className="bmm-footer-left">
            <span className="bmm-footer-step">
              {NAV_SECTIONS.findIndex((s) => s.id === activeSection) + 1} / {NAV_SECTIONS.length}
            </span>
          </div>
          <div className="bmm-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || typeBloque}
            >
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={2.5} className="bmm-spin" style={{ marginRight: 6 }} />
                  Création...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  Créer le bon
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}