import React, { useEffect, useState, useCallback, useMemo } from 'react';
import bonMaintenanceDiagnosticService from '../../../services/bonMaintenanceDiagnosticService';
import bonMaintenanceTacheService from '../../../services/bonMaintenanceTacheService';
import bonMaintenanceIntervenantService from '../../../services/bonMaintenanceIntervenantService';
import bonMaintenanceControleEquipementService from '../../../services/bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from '../../../services/bonMaintenanceRemiseEnServiceService';
import './BonTimeline.css';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function nomPersonnel(id, nomDenormalise, personnels) {
  if (nomDenormalise) return nomDenormalise;
  const p = personnels.find((x) => x.id === id);
  if (!p) return id != null ? `#${id}` : null;
  return `${p.nom || ''} ${p.prenom || ''}`.trim();
}

function nomPrestataire(id, prestataires) {
  const p = prestataires.find((x) => x.id === id);
  return p ? (p.raisonSociale || `${p.nom ?? ''} ${p.prenom ?? ''}`.trim()) : (id != null ? `#${id}` : null);
}

/**
 * Construit la liste unifiée d'événements (un par entité), triée chronologiquement.
 * Chaque événement : { key, date, icon, tone, titre, detail }.
 */
function construireEvenements({ bon, diagnostics, taches, intervenants, controles, remises, personnels, prestataires }) {
  const evenements = [];

  if (bon?.dateCreation) {
    evenements.push({
      key: 'bon-cree', date: bon.dateCreation, icon: '📄', tone: 'neutre',
      titre: 'Bon de maintenance créé',
      detail: bon.titre || null,
    });
  }

  diagnostics.forEach((d) => {
    evenements.push({
      key: `diag-${d.id}`, date: d.dateDiagnostic, icon: '🩺', tone: 'diagnostic',
      titre: `Diagnostic — ${nomPersonnel(d.personnelId, d.personnelNom, personnels) || 'technicien non renseigné'}`,
      detail: [d.causeProbable, d.observations].filter(Boolean).join(' — ') || null,
      badges: [
        d.besoinPiece ? { label: 'Besoin de pièce', tone: 'amber' } : null,
        d.dureeEstimeeHeures ? { label: `Estimé : ${d.dureeEstimeeHeures}h`, tone: 'muted' } : null,
      ].filter(Boolean),
    });
  });

  taches.forEach((t) => {
    evenements.push({
      key: `tache-${t.id}`, date: t.dateDebut || t.dateDebutIntervention, icon: '📋', tone: 'tache',
      titre: `Tâche — ${t.designation || `#${t.id}`}`,
      detail: t.sousTraitant?.raisonSociale || (t.sousTraitantId ? nomPrestataire(t.sousTraitantId, prestataires) : null),
    });
  });

  intervenants.forEach((i) => {
    const nom = i.personnel ? `${i.personnel.nom || ''} ${i.personnel.prenom || ''}`.trim()
      : (i.intervenantNom || nomPersonnel(i.personnelId, null, personnels) || i.sousTraitant?.raisonSociale
        || (i.sousTraitantId ? nomPrestataire(i.sousTraitantId, prestataires) : 'intervenant'));
    evenements.push({
      key: `interv-${i.id}`, date: i.dateDebutIntervention, icon: '🧑‍🔧', tone: 'intervenant',
      titre: `Intervenant affecté — ${nom}`,
      detail: [
        i.nbrHeure ? `${i.nbrHeure} h` : null,
        i.coutTotal != null ? `${i.coutTotal} DT` : null,
        i.dateFinIntervention ? `jusqu'au ${formatDateTime(i.dateFinIntervention)}` : null,
      ].filter(Boolean).join(' · ') || null,
    });
  });

  controles.forEach((c) => {
    evenements.push({
      key: `controle-${c.id}`, date: c.dateControle, icon: '✅', tone: c.conforme === false ? 'danger' : 'controle',
      titre: `Contrôle — ${c.typeControle || 'équipement'}`,
      detail: [
        c.valeurMesuree != null && c.valeurAttendue != null ? `Mesuré ${c.valeurMesuree} / attendu ${c.valeurAttendue}` : null,
        c.resultat,
      ].filter(Boolean).join(' — ') || null,
      badges: c.conforme == null ? [] : [{ label: c.conforme ? 'Conforme' : 'Non conforme', tone: c.conforme ? 'green' : 'red' }],
    });
  });

  remises.forEach((r) => {
    evenements.push({
      key: `remise-${r.id}`, date: r.date, icon: r.conforme ? '🟢' : '🔴', tone: r.conforme ? 'succes' : 'danger',
      titre: `Remise en service — ${r.conforme ? 'Autorisée' : 'Refusée'}`,
      detail: [
        `par ${nomPersonnel(r.autoriseParId, r.autoriseParNom, personnels) || 'responsable non renseigné'}`,
        r.observations,
      ].filter(Boolean).join(' — '),
      badges: [{ label: r.conforme ? 'Conforme' : 'Non conforme', tone: r.conforme ? 'green' : 'red' }],
    });
  });

  if (bon?.dateCloture) {
    evenements.push({
      key: 'bon-cloture', date: bon.dateCloture, icon: '🏁', tone: 'neutre',
      titre: 'Bon clôturé',
      detail: null,
    });
  }

  return evenements
    .filter((e) => e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export default function BonTimeline({ bonMaintenanceId, bon, refreshTrigger, personnels = [], prestataires = [] }) {
  // Données brutes des 5 entités — chargées une seule fois par bon/refreshTrigger,
  // jamais recalculées à cause de personnels/prestataires (voir useMemo plus bas).
  const [donnees, setDonnees] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const charger = useCallback(async () => {
    if (!bonMaintenanceId) return;
    setLoading(true);
    setError(null);
    try {
      const [diagnostics, taches, intervenants, controles, remises] = await Promise.all([
        bonMaintenanceDiagnosticService.getByBonMaintenance(bonMaintenanceId).catch(() => []),
        bonMaintenanceTacheService.getByBonMaintenance(bonMaintenanceId).catch(() => []),
        bonMaintenanceIntervenantService.getByBonMaintenance(bonMaintenanceId).catch(() => []),
        bonMaintenanceControleEquipementService.getByBonMaintenance(bonMaintenanceId).catch(() => []),
        bonMaintenanceRemiseEnServiceService.getByBonMaintenance(bonMaintenanceId).catch(() => []),
      ]);
      setDonnees({
        diagnostics: diagnostics ?? [],
        taches: taches ?? [],
        intervenants: intervenants ?? [],
        controles: controles ?? [],
        remises: remises ?? [],
      });
    } catch (err) {
      console.error('Erreur chargement timeline du bon :', err);
      setError('Impossible de charger la chronologie.');
    } finally {
      setLoading(false);
    }
    // Volontairement limité à bonMaintenanceId : personnels/prestataires ne doivent
    // jamais redéclencher un appel réseau (voir useMemo ci-dessous), et `bon` n'est
    // utilisé que pour ses dates de création/clôture, résolues au moment de l'affichage.
  }, [bonMaintenanceId]);

  useEffect(() => {
    charger();
  }, [charger, refreshTrigger]);

  // Le calcul d'affichage, lui, peut dépendre de bon/personnels/prestataires sans risque :
  // useMemo ne fait aucun appel réseau ni setState, donc pas de boucle possible même si
  // ces props sont recréées à chaque rendu (ex: valeurs par défaut [] côté appelant).
  const evenements = useMemo(() => {
    if (!donnees) return [];
    return construireEvenements({ bon, ...donnees, personnels, prestataires });
  }, [donnees, bon, personnels, prestataires]);

  if (!bonMaintenanceId) return null;

  return (
    <section className="bon-timeline">
      <div className="bon-timeline__header">
        <h3>🕒 Chronologie</h3>
        <span className="bon-timeline__hint">Vue d'ensemble en lecture seule — modifie chaque étape dans sa section ci-dessous</span>
      </div>

      {loading ? (
        <p className="bon-timeline__empty">Chargement...</p>
      ) : error ? (
        <p className="bon-timeline__error">{error}</p>
      ) : evenements.length === 0 ? (
        <p className="bon-timeline__empty">Aucun événement enregistré pour le moment.</p>
      ) : (
        <ol className="bon-timeline__list">
          {evenements.map((e) => (
            <li key={e.key} className={`bon-timeline__item bon-timeline__item--${e.tone}`}>
              <span className="bon-timeline__dot">{e.icon}</span>
              <div className="bon-timeline__content">
                <div className="bon-timeline__top">
                  <span className="bon-timeline__titre">{e.titre}</span>
                  <span className="bon-timeline__date">{formatDateTime(e.date)}</span>
                </div>
                {e.detail && <p className="bon-timeline__detail">{e.detail}</p>}
                {e.badges?.length > 0 && (
                  <div className="bon-timeline__badges">
                    {e.badges.map((b, idx) => (
                      <span key={idx} className={`bon-timeline__badge bon-timeline__badge--${b.tone}`}>{b.label}</span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}