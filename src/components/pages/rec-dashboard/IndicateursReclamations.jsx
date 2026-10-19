import { useEffect, useMemo, useState } from 'react';
import reclamationService from '../../../services/reclamationService';
import { t } from '../../../i18n';
import {
  Classement, CourbeTendance, GrilleKpi, SectionIndicateurs, TuileKpi,
} from '../../ui/Indicateurs/Indicateurs';
import {
  JOUR, classement, dans, douzeMois, enMs, heuresEntre, liste, moyenne, periodes, pourcentage, serieMensuelle,
} from '../../ui/Indicateurs/calculs';

/*
 * Indicateurs avancés du tableau de bord des réclamations :
 * volume, délai de traitement, conversion en bon, rejets, réclamations sans responsable,
 * ancienneté des réclamations ouvertes, tendance 12 mois et classements.
 */

const ACTIVES = [0, 1, 3];
const CLOTUREE = 2;
const REJETEE = 4;

// Date de fin de traitement : validation si elle existe, sinon dernière modification
const dateFin = (r) => r.dateValidation || r.dateModification;

export default function IndicateursReclamations() {
  const [maintenant] = useState(() => Date.now()); // heure de référence des calculs
  const [recs, setRecs] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    reclamationService.getAll(0, 2000)
      .then((r) => { if (actif) setRecs(liste(r)); })
      .catch(() => { if (actif) { setRecs([]); setErreur(t('Impossible de charger les réclamations pour les indicateurs.')); } });
    return () => { actif = false; };
  }, []);

  const k = useMemo(() => {
    if (!recs) return null;
    const { courante, precedente } = periodes(30, maintenant);

    const calculer = (p) => {
      const recues = recs.filter((r) => dans(r.date, p));
      const traitees = recs.filter((r) => [CLOTUREE, REJETEE].includes(r.etat) && dans(dateFin(r), p));
      return {
        recues: recues.length,
        cloturees: traitees.filter((r) => r.etat === CLOTUREE).length,
        delai: moyenne(traitees.filter((r) => r.etat === CLOTUREE).map((r) => heuresEntre(r.date, dateFin(r)))),
        conversion: pourcentage(recues.filter((r) => r.bonMaintenanceId != null).length, recues.length),
        rejet: pourcentage(traitees.filter((r) => r.etat === REJETEE).length, traitees.length),
        critiques: recues.filter((r) => Number(r.criticite) === 3).length,
      };
    };

    const actives = recs.filter((r) => ACTIVES.includes(r.etat));
    const ages = actives.map((r) => {
      const d = enMs(r.date);
      return d != null ? (maintenant - d) / JOUR : null;
    });
    const mois = douzeMois();
    const debut12 = maintenant - 365 * JOUR;
    const recentes = recs.filter((r) => (enMs(r.date) ?? 0) >= debut12);

    return {
      cur: calculer(courante),
      prev: calculer(precedente),
      actives: actives.length,
      ageMoyen: moyenne(ages),
      anciennes: ages.filter((a) => a != null && a > 7).length,
      sansResponsable: actives.filter((r) => r.personnelAffecteId == null).length,
      critiquesOuvertes: actives.filter((r) => Number(r.criticite) === 3).length,
      attenteValidation: recs.filter((r) => r.etat === 3).length,
      mois,
      serieRecues: serieMensuelle(recs, (r) => r.date, { mois }),
      serieCloturees: serieMensuelle(recs.filter((r) => r.etat === CLOTUREE), dateFin, { mois }),
      topServices: classement(recentes, (r) => r.serviceId ?? r.serviceNom, (r) => r.serviceNom || r.service?.description || t('Service #{id}', { id: r.serviceId })),
      chargeResponsables: classement(actives, (r) => r.personnelAffecteId, (r) => r.personnelAffecteNom || t('Personnel #{id}', { id: r.personnelAffecteId })),
      topDemandeurs: classement(recentes, (r) => r.personnelCreationId, (r) => r.personnelCreationNom || t('Personnel #{id}', { id: r.personnelCreationId })),
    };
  }, [recs, maintenant]);

  const chargement = !k;
  const c = k?.cur || {};
  const p = k?.prev || {};

  // Tuiles affichées (et exportées en Excel). Une tuile à 0 ou sans valeur n'est pas affichée.
  const tuiles = [
    {
      libelle: t('Réclamations reçues'),
      valeur: c.recues,
      precedent: p.recues,
      sens: 'baisse',
      chargement: chargement,
      lien: '/reclamations',
    },
    {
      libelle: t('Réclamations clôturées'),
      valeur: c.cloturees,
      precedent: p.cloturees,
      sens: 'hausse',
      chargement: chargement,
      ton: 'ok',
    },
    {
      libelle: t('Délai moyen de traitement'),
      valeur: c.delai,
      precedent: p.delai,
      format: 'duree',
      sens: 'baisse',
      chargement: chargement,
      aide: t('Temps moyen entre la réception et la clôture (validation) des réclamations clôturées sur la période.'),
    },
    {
      libelle: t('Converties en bon'),
      valeur: c.conversion,
      precedent: p.conversion,
      format: 'pct',
      chargement: chargement,
      aide: t('Part des réclamations reçues qui ont donné lieu à un bon de maintenance.'),
    },
    {
      libelle: t('Taux de rejet'),
      valeur: c.rejet,
      precedent: p.rejet,
      format: 'pct',
      sens: 'baisse',
      chargement: chargement,
    },
    {
      libelle: t('Criticité élevée reçues'),
      valeur: c.critiques,
      precedent: p.critiques,
      sens: 'baisse',
      chargement: chargement,
    },
    {
      libelle: t('Réclamations à traiter'),
      valeur: k?.actives,
      detail: k ? t('Âge moyen {age} · {n} de plus de 7 jours', { age: k.ageMoyen != null ? t('{n} j', { n: Math.round(k.ageMoyen) }) : '—', n: k.anciennes }) : null,
      ton: k?.anciennes > 0 ? 'attention' : undefined,
      chargement: chargement,
      lien: '/reclamations',
    },
    {
      libelle: t('Sans responsable'),
      valeur: k?.sansResponsable,
      ton: k?.sansResponsable > 0 ? 'alerte' : 'ok',
      chargement: chargement,
      aide: t('Réclamations ouvertes qui ne sont affectées à personne.'),
      lien: '/reclamations',
    },
    {
      libelle: t('Critiques non clôturées'),
      valeur: k?.critiquesOuvertes,
      ton: k?.critiquesOuvertes > 0 ? 'alerte' : undefined,
      chargement: chargement,
      lien: '/reclamations',
    },
 
  ];

  const exportExcel = {
    fichier: 'indicateurs-reclamations',
    titre: t('Indicateurs — Réclamations'),
    periode: t('30 derniers jours, comparés aux 30 jours précédents'),
    tuiles,
    courbes: k ? [
      { titre: t('Réclamations reçues et clôturées'), mois: k.mois, series: [ { nom: t('Reçues'), valeurs: k.serieRecues }, { nom: t('Clôturées'), valeurs: k.serieCloturees }, ] },
    ] : [],
    classements: k ? [
      { titre: t('Services les plus concernés'), lignes: k.topServices },
      { titre: t('Charge par responsable'), lignes: k.chargeResponsables },
      { titre: t('Principaux demandeurs'), lignes: k.topDemandeurs },
    ] : [],
  };

  return (
    <SectionIndicateurs
      titre={t('Indicateurs de performance')}
      sousTitre={t('30 derniers jours, comparés aux 30 jours précédents')}
      chargement={chargement}
      erreur={erreur}
      exportExcel={exportExcel}
    >
      <GrilleKpi>
        {tuiles.map((x) => <TuileKpi key={x.libelle} {...x} />)}
      </GrilleKpi>

      {k && (
        <div className="ind-rangee">
          <CourbeTendance
            titre={t('Réclamations reçues et clôturées')}
            sousTitre={t('12 derniers mois')}
            mois={k.mois}
            series={[
              { nom: t('Reçues'), valeurs: k.serieRecues },
              { nom: t('Clôturées'), valeurs: k.serieCloturees },
            ]}
          />
          <Classement titre={t('Services les plus concernés')} sousTitre={t('Réclamations sur 12 mois')} lignes={k.topServices} />
          <Classement titre={t('Charge par responsable')} sousTitre={t('Réclamations ouvertes')} lignes={k.chargeResponsables} vide={t('Aucune réclamation ouverte affectée.')} />
          <Classement titre={t('Principaux demandeurs')} sousTitre={t('Réclamations sur 12 mois')} lignes={k.topDemandeurs} />
        </div>
      )}
    </SectionIndicateurs>
  );
}
