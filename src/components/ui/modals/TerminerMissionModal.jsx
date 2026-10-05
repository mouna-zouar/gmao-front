import { useState, useEffect } from 'react';
import { X, Gauge, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './TerminerMissionModal.css';

/**
 * Clôture d'une mission : saisie du kilométrage de retour.
 *
 * La validation affichée ici est un confort utilisateur. La règle métier fait
 * autorité côté backend (kmRetour >= kmDepart ET >= Vehicule.kilometrage) :
 * un 409 remonté par l'API est affiché tel quel.
 */
export default function TerminerMissionModal({
  isOpen,
  onClose,
  mission,
  vehicule,
  onConfirm,
}) {
  const [kmRetour, setKmRetour] = useState('');
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const kmDepart = mission?.kilometrageDepart ?? vehicule?.kilometrage ?? null;
  const kmVehicule = vehicule?.kilometrage ?? null;
  const plancher = Math.max(kmDepart ?? 0, kmVehicule ?? 0);

  useEffect(() => {
    if (isOpen) {
      setKmRetour('');
      setMotif('');
      setError(null);
    }
  }, [isOpen, mission?.id]);

  if (!isOpen) return null;

  const valeur = kmRetour === '' ? null : Number(kmRetour);
  const parcourus =
    valeur != null && kmDepart != null ? Math.max(0, valeur - kmDepart) : null;
  const invalide = valeur != null && valeur < plancher;

  const handleConfirm = async () => {
    if (invalide) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(valeur, motif.trim() || null);
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Échec de la clôture de la mission.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v) => (v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} km`);

  return (
    <div className="tmm-overlay" onClick={onClose}>
      <div className="tmm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="tmm-header">
          <h3>Clôturer la mission {mission?.num ?? ''}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        <div className="tmm-body">
          <div className="tmm-km-row">
            <div className="tmm-km-card readonly">
              <span className="tmm-km-label">Départ</span>
              <strong>{fmt(kmDepart)}</strong>
            </div>

            <ArrowRight size={18} className="tmm-arrow" />

            <div className="tmm-km-card">
              <span className="tmm-km-label">Retour</span>
              <input
                type="number"
                min={plancher}
                step="1"
                value={kmRetour}
                onChange={(e) => setKmRetour(e.target.value)}
                placeholder={String(plancher)}
                autoFocus
              />
              <span className="tmm-km-unit">km</span>
            </div>
          </div>

          {parcourus != null && !invalide && (
            <div className="tmm-info success">
              <CheckCircle2 size={16} />
              <span>
                Distance parcourue : <strong>{parcourus.toLocaleString('fr-FR')} km</strong>
              </span>
            </div>
          )}

          {invalide && (
            <div className="tmm-info error">
              <AlertTriangle size={16} />
              <span>
                Le kilométrage de retour ne peut pas être inférieur à{' '}
                <strong>{fmt(plancher)}</strong> (compteur actuel du véhicule).
                Un compteur ne recule jamais.
              </span>
            </div>
          )}

          <div className="tmm-info neutral">
            <Gauge size={16} />
            <span>
              Ce relevé met à jour le kilométrage du véhicule et déclenche
              automatiquement le contrôle des maintenances préventives.
            </span>
          </div>

          <label className="tmm-field">
            <span>Motif d'exécution (optionnel)</span>
            <textarea
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Observations de fin de mission…"
            />
          </label>

          {error && (
            <div className="tmm-info error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="tmm-footer">
          <button
            type="button"
            className="tmm-btn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            className="tmm-btn primary"
            onClick={handleConfirm}
            disabled={loading || invalide}
          >
            {loading ? 'Clôture…' : 'Clôturer la mission'}
          </button>
        </footer>
      </div>
    </div>
  );
}