import {
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
  Hash,
  Inbox,
} from 'lucide-react';
import './VehiculeMissionDetailsContent.css';

const ETAT_LABELS = {
  0: 'Planifiée',
  1: 'En cours',
  2: 'Terminée',
  3: 'Annulée',
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

export default function VehiculeMissionDetailsContent({
  mission,
  vehicule,
  conducteur,
}) {
  if (!mission) {
    return (
      <div className="vm-details-empty">
        <Inbox size={36} strokeWidth={1.6} />
        <p>Aucune mission à afficher</p>
        <span>Sélectionne une mission dans la liste pour voir ses détails.</span>
      </div>
    );
  }

  const hasCoords = mission.latitude != null && mission.longitude != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${mission.latitude},${mission.longitude}`
    : null;

  const nomConducteur = conducteur
    ? `${conducteur.nom || ''} ${conducteur.prenom || ''}`.trim()
    : mission.conducteurNom || mission.personnelNom || null;

  const missionRef = mission.num || mission.numero || `#${mission.id}`;

  return (
    <div className="vm-details-content">
      {/* Bandeau principal : véhicule + conducteur */}
      <section className="vm-details-hero">
        <div className="vm-details-hero-card">
          <div className="vm-details-hero-icon vm-details-hero-icon--vehicle">
            <Car size={20} strokeWidth={2.2} />
          </div>
          <div className="vm-details-hero-text">
            <span className="vm-details-hero-label">Véhicule</span>
            <span className="vm-details-hero-value">
              {vehicule?.nom || vehicule?.matricule || `Véhicule #${mission.vehiculeId || '—'}`}
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

      {/* Trajet */}
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
                  Ouvrir dans Google Maps
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Planification */}
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

      {/* Détails complémentaires */}
      {(mission.description ||
        mission.motif ||
        mission.kilometrageDepart != null ||
        mission.kilometrageRetour != null ||
        mission.kilometrageFin != null) && (
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

            {(mission.kilometrageRetour != null || mission.kilometrageFin != null) && (
              <div className="vm-details-field">
                <span className="vm-details-field-label">
                  <Gauge size={11} strokeWidth={2.5} />
                  Kilométrage retour
                </span>
                <span className="vm-details-field-value">
                  {mission.kilometrageRetour ?? mission.kilometrageFin} km
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

      {/* Métadonnées */}
      <section className="vm-details-section vm-details-section--meta">
        <div className="vm-details-meta">
          <span className="vm-details-meta-item">
            <Hash size={11} strokeWidth={2.5} />
            Réf. {missionRef}
          </span>
          <span className="vm-details-meta-item">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            {etatLabel(mission.etat)}
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
  );
}