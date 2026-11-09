import { useEffect } from 'react';
import {
  Route,
  Car,
  User,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  FileText,
  Gauge,
  Phone,
  Hash,
  X,
  Printer,
} from 'lucide-react';
import './VehiculeMissionDetailsModal.css';

const ETAT_LABELS = {
  0: 'Planifiée',
  1: 'En cours',
  2: 'Terminée',
  3: 'Annulée',
};

const ETAT_META = {
  0: { class: 'planned', Icon: Clock },
  1: { class: 'running', Icon: Loader2 },
  2: { class: 'done', Icon: CheckCircle2 },
  3: { class: 'cancelled', Icon: XCircle },
};

function etatLabel(etat) {
  return ETAT_LABELS[etat] ?? `Code ${etat}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VehiculeMissionDetailsModal({
  isOpen,
  onClose,
  mission,
  vehicule,
  conducteur,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mission) return null;

  const meta = ETAT_META[mission.etat] ?? ETAT_META[0];
  const EtatIcon = meta.Icon;
  const hasCoords = mission.latitude != null && mission.longitude != null;
  const mapsUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${mission.latitude}&mlon=${mission.longitude}#map=16/${mission.latitude}/${mission.longitude}`
    : null;

  const nomConducteur = conducteur
    ? `${conducteur.nom || ''} ${conducteur.prenom || ''}`.trim()
    : mission.conducteurNom || mission.personnelNom || null;

  const missionRef = mission.num || mission.numero || `#${mission.id}`;

  return (
    <div
      className="vm-details-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="vm-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════ HEADER ═══════════ */}
        <header className="vm-details-header">
          <div className="vm-details-header-left">
            <div className="vm-details-header-icon">
              <Route size={22} strokeWidth={2.2} />
            </div>
            <div>
              <span className="vm-details-eyebrow">Mission véhicule</span>
              <h2 className="vm-details-title">{missionRef}</h2>
            </div>
          </div>

          <div className="vm-details-header-right">
            <span className={`vm-details-pill ${meta.class}`}>
              <EtatIcon
                size={13}
                strokeWidth={2.5}
                className={mission.etat === 1 ? 'vm-details-spin' : ''}
              />
              {etatLabel(mission.etat)}
            </span>

            <button
              type="button"
              className="vm-details-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </header>

        {/* ═══════════ BODY ═══════════ */}
        <div className="vm-details-body">

          {/* ── Bandeau principal : véhicule + conducteur ── */}
          <section className="vm-details-hero">
            <div className="vm-details-hero-card">
              <div className="vm-details-hero-icon vm-details-hero-icon--vehicle">
                <Car size={20} strokeWidth={2.2} />
              </div>
              <div className="vm-details-hero-text">
                <span className="vm-details-hero-label">Véhicule</span>
                <span className="vm-details-hero-value">
                  {vehicule?.nom || `Véhicule #${mission.vehiculeId || '—'}`}
                </span>
                {vehicule?.immatriculation && (
                  <span className="vm-details-hero-sub">
                    {vehicule.immatriculation}
                  </span>
                )}
              </div>
            </div>

            <div className="vm-details-hero-card">
              <div className="vm-details-hero-icon vm-details-hero-icon--driver">
                <User size={20} strokeWidth={2.2} />
              </div>
              <div className="vm-details-hero-text">
                <span className="vm-details-hero-label">Conducteur</span>
                <span className="vm-details-hero-value">
                  {nomConducteur || '—'}
                </span>
                {conducteur?.matricule && (
                  <span className="vm-details-hero-sub">
                    Matricule {conducteur.matricule}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ── Section : Trajet ── */}
          <section className="vm-details-section">
            <h3 className="vm-details-section-title">
              <MapPin size={15} strokeWidth={2.5} />
              Trajet
            </h3>

            <div className="vm-details-grid">
              <div className="vm-details-field">
                <span className="vm-details-field-label">Destination</span>
                <span className="vm-details-field-value">
                  {mission.destination || mission.lieu || '—'}
                </span>
              </div>

              <div className="vm-details-field">
                <span className="vm-details-field-label">Localisation</span>
                <span className="vm-details-field-value">
                  {mission.localisation || '—'}
                </span>
              </div>

              {hasCoords && (
                <div className="vm-details-field vm-details-field--full">
                  <span className="vm-details-field-label">Coordonnées GPS</span>
                  <div className="vm-details-coords">
                    <span className="vm-details-field-value">
                      {mission.latitude}, {mission.longitude}
                    </span>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vm-details-map-btn"
                    >
                      <ExternalLink size={13} strokeWidth={2.5} />
                      Ouvrir dans OpenStreetMap
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section : Planification ── */}
          <section className="vm-details-section">
            <h3 className="vm-details-section-title">
              <Calendar size={15} strokeWidth={2.5} />
              Planification
            </h3>

            <div className="vm-details-grid">
              <div className="vm-details-field">
                <span className="vm-details-field-label">Date de départ</span>
                <span className="vm-details-field-value">
                  {formatDateTime(mission.dateDepart || mission.dateDebut)}
                </span>
              </div>

              <div className="vm-details-field">
                <span className="vm-details-field-label">Date de retour</span>
                <span className="vm-details-field-value">
                  {formatDateTime(mission.dateRetour || mission.dateFin)}
                </span>
              </div>
            </div>
          </section>

          {/* ── Section : Détails ── */}
          {(mission.description ||
            mission.motif ||
            mission.kilometrageDepart != null ||
            mission.kilometrageRetour != null ||
            mission.kilometrageParcouru != null) && (
            <section className="vm-details-section">
              <h3 className="vm-details-section-title">
                <FileText size={15} strokeWidth={2.5} />
                Détails
              </h3>

              <div className="vm-details-grid">
                {mission.kilometrageDepart != null && (
                  <div className="vm-details-field">
                    <span className="vm-details-field-label">
                      <Gauge size={11} strokeWidth={2.5} />
                      Kilométrage départ
                    </span>
                    <span className="vm-details-field-value">
                      {mission.kilometrageDepart} km
                    </span>
                  </div>
                )}

                {mission.kilometrageRetour != null && (
                  <div className="vm-details-field">
                    <span className="vm-details-field-label">
                      <Gauge size={11} strokeWidth={2.5} />
                      Kilométrage retour
                    </span>
                    <span className="vm-details-field-value">
                      {mission.kilometrageRetour} km
                    </span>
                  </div>
                )}

                {mission.kilometrageParcouru != null && (
                  <div className="vm-details-field">
                    <span className="vm-details-field-label">
                      <Gauge size={11} strokeWidth={2.5} />
                      Kilomètres parcourus
                    </span>
                    <span className="vm-details-field-value">
                      {mission.kilometrageParcouru} km
                    </span>
                  </div>
                )}

                {mission.description && (
                  <div className="vm-details-field vm-details-field--full">
                    <span className="vm-details-field-label">Description</span>
                    <p className="vm-details-text">{mission.description}</p>
                  </div>
                )}

                {mission.motif && (
                  <div className="vm-details-field vm-details-field--full">
                    <span className="vm-details-field-label">Motif</span>
                    <p className="vm-details-text">{mission.motif}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Section : Métadonnées ── */}
          <section className="vm-details-section vm-details-section--meta">
            <div className="vm-details-meta">
              <span className="vm-details-meta-item">
                <Hash size={11} strokeWidth={2.5} />
                ID #{mission.id}
              </span>
              {mission.createdAt && (
                <span className="vm-details-meta-item">
                  <Calendar size={11} strokeWidth={2.5} />
                  Créée le {formatDate(mission.createdAt)}
                </span>
              )}
              {mission.updatedAt && (
                <span className="vm-details-meta-item">
                  <Clock size={11} strokeWidth={2.5} />
                  Modifiée le {formatDate(mission.updatedAt)}
                </span>
              )}
            </div>
          </section>
        </div>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="vm-details-footer">
          <button
            type="button"
            className="vm-details-btn vm-details-btn--ghost"
            onClick={onClose}
          >
            Fermer
          </button>

          <button
            type="button"
            className="vm-details-btn vm-details-btn--primary"
            onClick={() => window.print()}
          >
            <Printer size={15} strokeWidth={2.5} />
            Imprimer
          </button>
        </footer>
      </div>
    </div>
  );
}