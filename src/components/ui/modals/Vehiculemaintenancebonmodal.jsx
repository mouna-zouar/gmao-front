import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import vehiculeService from '../../../services/vehiculeService';
import authService from '../../../services/Authservice';
import vehiculeMaintenanceService, {
  URGENCE_OPTIONS,
} from '../../../services/vehiculeMaintenanceService';
import {
  Wrench, X, Car, Gauge, Calendar, AlertTriangle, Loader2, Save, Info,
} from 'lucide-react';
import './Modal.css';
import './VehiculeMaintenanceBonModal.css';

const NAV_SECTIONS = [
  { id: 'vehicule', label: 'Véhicule', Icon: Car },
  { id: 'demande', label: 'Demande', Icon: Wrench },
];

function toInputDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fmtKm = (v) => (v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} km`);

/**
 * Demande de maintenance saisie depuis la fiche véhicule.
 *
 * Véhicule, immatriculation et kilométrage sont préremplis et non modifiables :
 * ce sont des données du parc, pas des saisies. Le kilométrage affiché vient du
 * compteur (table dédiée), et le serveur le relit de toute façon au moment de
 * créer le bon — l'affichage n'est ici qu'une information pour le demandeur.
 *
 * @param vehicule    véhicule sélectionné dans la fiche
 * @param onCreated   callback(resultat) après création — resultat = { bon, declenchement, ... }
 */
export default function VehiculeMaintenanceBonModal({ isOpen, onClose, vehicule, onCreated }) {
  const [activeSection, setActiveSection] = useState('vehicule');

  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [statuts, setStatuts] = useState([]);
  const [compteur, setCompteur] = useState(null);
  const [loadingCompteur, setLoadingCompteur] = useState(false);

  const [formData, setFormData] = useState({
    typeId: '',
    description: '',
    urgence: 2,
    dateDemande: '',
    reinitialiserSeuil: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Préremplissage à l'ouverture ───
  useEffect(() => {
    if (!isOpen || !vehicule?.id) return;

    setError(null);
    setActiveSection('vehicule');
    setFormData({
      typeId: '',
      description: '',
      urgence: 2,
      dateDemande: toInputDateTime(new Date()),
      reinitialiserSeuil: true,
    });

    let annule = false;

    (async () => {
      setLoadingTypes(true);
      try {
        const [t, s] = await Promise.all([
          vehiculeMaintenanceService.getTypesApplicables(vehicule.id),
          vehiculeMaintenanceService.getStatuts(vehicule.id).catch(() => []),
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

    (async () => {
      setLoadingCompteur(true);
      try {
        const c = await vehiculeService.getCompteur(vehicule.id);
        if (!annule) setCompteur(c);
      } catch (err) {
        // Le compteur n'est qu'un affichage : en cas d'échec on retombe sur le
        // cache porté par le véhicule, sans bloquer la demande.
        if (!annule) setCompteur(null);
        console.error('Erreur lecture compteur :', err);
      } finally {
        if (!annule) setLoadingCompteur(false);
      }
    })();

    return () => { annule = true; };
  }, [isOpen, vehicule?.id]);

  const kilometrage = compteur?.kilometrage ?? vehicule?.kilometrage ?? null;

  /** Situation préventive du type choisi : indique si un seuil est déjà atteint. */
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
        `Un bon est déjà en cours pour « ${statutTypeChoisi.typeLibelle} » sur ce véhicule `
        + `(bon n°${statutTypeChoisi.bonMaintenanceId}). Clôturez-le ou choisissez un autre type.`
      );
      setActiveSection('demande');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = authService.getSession();
      const resultat = await vehiculeMaintenanceService.creerBonManuel(vehicule.id, {
        typeId: formData.typeId === '' ? null : Number(formData.typeId),
        description: formData.description.trim(),
        urgence: formData.urgence === '' ? null : Number(formData.urgence),
        dateDemande: formData.dateDemande || null,
        reinitialiserSeuil: formData.typeId === '' ? false : !!formData.reinitialiserSeuil,
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

  if (!isOpen || !vehicule) return null;

  const typeChoisi = types.find((t) => String(t.id) === String(formData.typeId));

  const sectionCounts = {
    vehicule: 0,
    demande: [formData.typeId, formData.description, formData.urgence]
      .filter((v) => v !== '' && v != null).length,
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'vehicule':
        return (
          <div className="bmm-content-pane">
            <div className="bmm-pane-header">
              <h3>Véhicule concerné</h3>
              <p>Informations reprises automatiquement de la fiche</p>
            </div>

            <div className="vmb-readonly-grid">
              <div className="vmb-readonly">
                <span className="vmb-readonly-label"><Car size={13} strokeWidth={2.5} /> Véhicule</span>
                <span className="vmb-readonly-value">
                  {vehicule.marque || '—'}
                  {vehicule.numChassis ? ` · châssis ${vehicule.numChassis}` : ''}
                </span>
              </div>

              <div className="vmb-readonly">
                <span className="vmb-readonly-label">Immatriculation</span>
                <span className="vmb-readonly-value vmb-readonly-strong">
                  {vehicule.matricule || `#${vehicule.id}`}
                </span>
              </div>

              <div className="vmb-readonly">
                <span className="vmb-readonly-label"><Gauge size={13} strokeWidth={2.5} /> Kilométrage actuel</span>
                <span className="vmb-readonly-value vmb-readonly-strong">
                  {loadingCompteur ? 'Lecture du compteur...' : fmtKm(kilometrage)}
                </span>
              </div>

              <div className="vmb-readonly">
                <span className="vmb-readonly-label"><Calendar size={13} strokeWidth={2.5} /> Dernier relevé</span>
                <span className="vmb-readonly-value">
                  {compteur?.dateDernierReleve
                    ? new Date(compteur.dateDernierReleve).toLocaleString('fr-FR')
                    : '—'}
                </span>
              </div>
            </div>

            <p className="bmm-hint vmb-hint">
              <Info size={13} strokeWidth={2.5} />
              Ces champs ne sont pas modifiables ici. Le kilométrage est relu au moment
              de la création du bon : il se met à jour par les relevés (missions, bons
              carburant, saisie manuelle).
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
                <label htmlFor="vmb-type">Type de maintenance</label>
                <select
                  id="vmb-type"
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
                      {t.libelle} — tous les {Number(t.intervalleKm).toLocaleString('fr-FR')} km
                    </option>
                  ))}
                </select>

                {!loadingTypes && types.length === 0 && (
                  <small className="bmm-field-hint">
                    Aucun type actif pour ce véhicule. La demande sera créée hors référentiel.
                  </small>
                )}

                {statutTypeChoisi && !typeBloque && (
                  <small className="bmm-field-hint">
                    Prochain seuil à {fmtKm(statutTypeChoisi.prochainSeuilKm)} —{' '}
                    {statutTypeChoisi.kmRestants >= 0
                      ? `il reste ${fmtKm(statutTypeChoisi.kmRestants)} avant le déclenchement automatique.`
                      : `seuil dépassé de ${fmtKm(Math.abs(statutTypeChoisi.kmRestants))}.`}
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
                <label htmlFor="vmb-description">
                  Motif / Description <span className="bmm-required">*</span>
                </label>
                <textarea
                  id="vmb-description"
                  name="description"
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Bruit anormal au freinage, fuite constatée, révision anticipée avant mission longue..."
                />
              </div>

              <div className="bmm-field">
                <label htmlFor="vmb-urgence">Niveau d'urgence</label>
                <select
                  id="vmb-urgence"
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
                <label htmlFor="vmb-date">Date de demande</label>
                <input
                  id="vmb-date"
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
                      name="reinitialiserSeuil"
                      checked={formData.reinitialiserSeuil}
                      onChange={handleChange}
                    />
                    <span>
                      Cette intervention compte comme une exécution de{' '}
                      <strong>{typeChoisi?.libelle ?? 'ce type'}</strong> : à la clôture du bon,
                      le prochain seuil kilométrique sera recalculé.
                    </span>
                  </label>
                  <small className="bmm-field-hint">
                    Décochez si la demande ne remplace pas l'entretien périodique
                    (le cycle préventif restera inchangé).
                  </small>
                </div>
              )}
            </div>

            <div className="bmm-summary">
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Véhicule</span>
                <span className="bmm-summary-value">
                  {vehicule.matricule || `#${vehicule.id}`}
                  {vehicule.marque ? ` — ${vehicule.marque}` : ''}
                </span>
              </div>
              <div className="bmm-summary-row">
                <span className="bmm-summary-label">Kilométrage</span>
                <span className="bmm-summary-value">{fmtKm(kilometrage)}</span>
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
              <span className="bmm-eyebrow">Parc automobile</span>
              <h2>Créer un bon de maintenance</h2>
            </div>
          </div>
          <div className="bmm-header-right">
            <span className="bmm-mode-badge">{vehicule.matricule || `#${vehicule.id}`}</span>
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