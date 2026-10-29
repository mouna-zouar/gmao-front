import { useEffect, useMemo, useState } from 'react';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import vehiculeBonCarburantService from '../../../../services/vehiculeBonCarburantService';
import vehiculeIncidentService from '../../../../services/vehiculeIncidentService';
import vehiculeMissionService from '../../../../services/vehiculeMissionService';
import vehiculeAmendeService from '../../../../services/vehiculeAmendeService';
import vehiculeCoutService from '../../../../services/vehiculeCoutService';
import { t } from '../../../../i18n';
import {
  Classement, CourbeTendance, GrilleKpi, SectionIndicateurs, TuileKpi,
} from '../../../ui/Indicateurs/Indicateurs';
import {
  JOUR, classement, dans, douzeMois, enMs, liste, moyenne, periodes, serieMensuelle, somme,
} from '../../../ui/Indicateurs/calculs';

/*
 * Indicateurs avancés du Dashboard Parc : carburant, kilomètres de mission, incidents,
 * amendes, coûts annuels du parc, tendance 12 mois et classements par véhicule.
 * Chaque source est chargée indépendamment : une source indisponible n'empêche pas les autres.
 */

const AMENDE_A_PAYER = [0, 1]; // À payer, Contestée
const NOMS_SOURCES = { carburant: 'Carburant', incidents: 'Incidents', missions: 'Missions', amendes: 'Amendes', couts: 'Coûts' };
const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function IndicateursParc() {
  const [maintenant] = useState(() => Date.now()); // heure de référence des calculs
  const [src, setSrc] = useState({});

  useEffect(() => {
    let actif = true;
    const charger = (cle, promesse) => promesse
      .then((r) => { if (actif) setSrc((s) => ({ ...s, [cle]: r })); })
      .catch(() => { if (actif) setSrc((s) => ({ ...s, [cle]: null, [`${cle}Erreur`]: true })); });
    const auj = new Date();
    charger('vehicules', obtenirVehicules().then(commePage).then(liste));
    charger('carburant', vehiculeBonCarburantService.getAll(0, 3000).then(liste));
    charger('incidents', vehiculeIncidentService.getAll(0, 2000).then(liste));
    charger('missions', vehiculeMissionService.getAll(0, 3000).then(liste));
    charger('amendes', vehiculeAmendeService.getAll(0, 1000).then(liste));
    charger('couts', vehiculeCoutService.parc(`${auj.getFullYear()}-01-01`, isoJour(auj)));
    return () => { actif = false; };
  }, []);

  const k = useMemo(() => {
    const { courante, precedente } = periodes(30, maintenant);
    const vehicules = src.vehicules || [];
    const matricule = (id) => vehicules.find((v) => v.id === id)?.matricule || t('Véhicule #{id}', { id });
    const carburant = src.carburant || [];
    const incidents = src.incidents || [];
    const missions = src.missions || [];
    const amendes = src.amendes || [];

    const kmMission = (m) => m.kilometrageParcouru
      ?? (m.kilometrageRetour != null && m.kilometrageDepart != null ? m.kilometrageRetour - m.kilometrageDepart : null);
    const dateMission = (m) => m.dateFinReel || m.dateFin || m.dateDebut;

    const calculer = (p) => {
      const pleins = carburant.filter((b) => dans(b.date, p));
      const litres = somme(pleins.map((b) => b.litres));
      const montant = somme(pleins.map((b) => b.montant));
      const inc = incidents.filter((i) => dans(i.dateIncident || i.dateCreation, p));
      const mis = missions.filter((m) => dans(dateMission(m), p));
      return {
        carburant: montant,
        litres,
        prixLitre: litres > 0 ? montant / litres : null,
        incidents: inc.length,
        coutIncidents: somme(inc.map((i) => i.cout)),
        missions: mis.length,
        km: somme(mis.map(kmMission).filter((x) => x != null && x >= 0)),
      };
    };

    const aPayer = amendes.filter((a) => AMENDE_A_PAYER.includes(Number(a.statut)));
    const echues = aPayer.filter((a) => (enMs(a.dateLimitePaiement) ?? Infinity) < maintenant);
    const mois = douzeMois();
    const debut12 = maintenant - 365 * JOUR;
    const couts = src.couts;

    return {
      cur: calculer(courante),
      prev: calculer(precedente),
      amendesNb: aPayer.length,
      amendesMontant: somme(aPayer.map((a) => a.montant)),
      amendesEchues: echues.length,
      coutTotal: couts?.totaux?.total ?? null,
      coutKm: couts?.coutParKm ?? null,
      coutMoyenVehicule: couts?.vehicules?.length ? moyenne(couts.vehicules.map((v) => v.postes?.total ?? 0)) : null,
      mois,
      serieCarburant: serieMensuelle(carburant, (b) => b.date, { mois, valeurDe: (b) => b.montant }),
      serieIncidents: serieMensuelle(incidents, (i) => i.dateIncident || i.dateCreation, { mois }),
      topCouts: (couts?.vehicules || [])
        .filter((v) => (v.postes?.total ?? 0) > 0)
        .map((v) => ({ cle: v.vehiculeId ?? v.id ?? v.matricule, libelle: v.matricule || matricule(v.vehiculeId), valeur: v.postes.total }))
        .sort((a, b) => b.valeur - a.valeur)
        .slice(0, 5),
      topIncidents: classement(incidents.filter((i) => (enMs(i.dateIncident || i.dateCreation) ?? 0) >= debut12), (i) => i.vehiculeId, (i) => matricule(i.vehiculeId)),
      topKm: classement(missions.filter((m) => (enMs(dateMission(m)) ?? 0) >= debut12), (m) => m.vehiculeId, (m) => matricule(m.vehiculeId), { valeurDe: (m) => Math.max(0, kmMission(m) ?? 0) }),
      topCarburant: classement(carburant.filter((b) => (enMs(b.date) ?? 0) >= debut12), (b) => b.vehiculeId, (b) => matricule(b.vehiculeId), { valeurDe: (b) => b.montant }),
    };
  }, [src, maintenant]);

  const pret = (cle) => cle in src;
  const c = k.cur;
  const p = k.prev;
  const erreurs = ['carburant', 'incidents', 'missions', 'amendes', 'couts'].filter((s) => src[`${s}Erreur`]);

  // Tuiles affichées (et exportées en Excel). Une tuile à 0 ou sans valeur n'est pas affichée.
  const tuiles = [
    {
      libelle: t('Dépenses carburant'),
      valeur: c.carburant,
      precedent: p.carburant,
      format: 'dt',
      sens: 'baisse',
      chargement: !pret('carburant'),
      lien: '/vehicule-bons-carburant',
    },
    {
      libelle: t('Litres consommés'),
      valeur: c.litres,
      precedent: p.litres,
      format: 'litres',
      sens: 'baisse',
      chargement: !pret('carburant'),
    },
    {
      libelle: t('Prix moyen du litre'),
      valeur: c.prixLitre,
      precedent: p.prixLitre,
      format: 'dt',
      sens: 'baisse',
      chargement: !pret('carburant'),
    },
    {
      libelle: t('Missions terminées'),
      valeur: c.missions,
      precedent: p.missions,
      chargement: !pret('missions'),
      lien: '/vehicule-missions',
    },
    {
      libelle: t('Kilomètres en mission'),
      valeur: c.km,
      precedent: p.km,
      format: 'km',
      chargement: !pret('missions'),
    },
    {
      libelle: t('Incidents déclarés'),
      valeur: c.incidents,
      precedent: p.incidents,
      sens: 'baisse',
      chargement: !pret('incidents'),
      lien: '/vehicule-incidents',
    },
    {
      libelle: t('Coût des incidents'),
      valeur: c.coutIncidents,
      precedent: p.coutIncidents,
      format: 'dt',
      sens: 'baisse',
      chargement: !pret('incidents'),
    },
    {
      libelle: t('Amendes à régler'),
      valeur: k.amendesMontant,
      format: 'dt',
      detail: t('Amendes : {n} · échues : {e}', { n: k.amendesNb, e: k.amendesEchues }),
      ton: k.amendesEchues > 0 ? 'alerte' : k.amendesNb > 0 ? 'attention' : 'ok',
      chargement: !pret('amendes'),
      lien: '/vehicule-amendes',
    },
    {
      libelle: t('Coût total du parc'),
      valeur: k.coutTotal,
      format: 'dt',
      chargement: !pret('couts'),
      lien: '/vehicules',
      detail: t('Depuis le 1er janvier'),
    },
    {
      libelle: t('Coût moyen au km'),
      valeur: k.coutKm,
      format: 'dt',
      chargement: !pret('couts'),
    },
    {
      libelle: t('Coût moyen par véhicule'),
      valeur: k.coutMoyenVehicule,
      format: 'dt',
      chargement: !pret('couts'),
    },
  ];

  const exportExcel = {
    fichier: 'indicateurs-parc',
    titre: t('Indicateurs — Parc'),
    periode: t('30 derniers jours, comparés aux 30 jours précédents'),
    tuiles,
    courbes: k ? [
      { titre: t('Dépenses carburant'), mois: k.mois, series: [{ nom: t('Carburant'), valeurs: k.serieCarburant }] },
      { titre: t('Incidents déclarés'), mois: k.mois, series: [{ nom: t('Incidents'), valeurs: k.serieIncidents }] },
    ] : [],
    classements: k ? [
      { titre: t('Véhicules les plus coûteux'), lignes: k.topCouts, format: 'dt' },
      { titre: t('Véhicules les plus accidentés'), lignes: k.topIncidents },
      { titre: t('Véhicules les plus utilisés'), lignes: k.topKm, format: 'km' },
      { titre: t('Plus grosses dépenses carburant'), lignes: k.topCarburant, format: 'dt' },
    ] : [],
  };

  return (
    <SectionIndicateurs
      exportExcel={exportExcel}
      titre={t('Indicateurs de performance')}
      sousTitre={t('30 derniers jours, comparés aux 30 jours précédents — coûts : depuis le 1er janvier')}
      erreur={erreurs.length ? t('Certaines données sont indisponibles : {liste}.', { liste: erreurs.map((e) => t(NOMS_SOURCES[e])).join(', ') }) : null}
    >
      <GrilleKpi>
        {tuiles.map((x) => <TuileKpi key={x.libelle} {...x} />)}
      </GrilleKpi>

      <div className="ind-rangee">
        <CourbeTendance
          titre={t('Dépenses carburant')}
          sousTitre={t('12 derniers mois, en DT')}
          mois={k.mois}
          series={[{ nom: t('Carburant'), valeurs: k.serieCarburant }]}
          format="dt"
          large={false}
        />
        <CourbeTendance
          titre={t('Incidents déclarés')}
          sousTitre={t('12 derniers mois')}
          mois={k.mois}
          series={[{ nom: t('Incidents'), valeurs: k.serieIncidents }]}
          large={false}
        />
        <Classement titre={t('Véhicules les plus coûteux')} sousTitre={t('Depuis le 1er janvier')} lignes={k.topCouts} format="dt" />
        <Classement titre={t('Véhicules les plus accidentés')} sousTitre={t('Incidents sur 12 mois')} lignes={k.topIncidents} />
        <Classement titre={t('Véhicules les plus utilisés')} sousTitre={t('Km en mission sur 12 mois')} lignes={k.topKm} format="km" />
        <Classement titre={t('Plus grosses dépenses carburant')} sousTitre={t('12 mois')} lignes={k.topCarburant} format="dt" />
      </div>
    </SectionIndicateurs>
  );
}
