import { useEffect, useMemo, useState } from 'react';
import bonMaintenanceService from '../../../services/bonMaintenanceService';
import slaService from '../../../services/slaService';
import { t } from '../../../i18n';
import { prioriteLabel } from '../../../constants/Priorite';
import {
  Classement, CourbeTendance, GrilleKpi, SectionIndicateurs, TuileKpi,
} from '../../ui/Indicateurs/Indicateurs';
import {
  JOUR, classement, dans, douzeMois, enMs, heuresEntre, liste, moyenne, periodes, pourcentage, serieMensuelle, somme,
} from '../../ui/Indicateurs/calculs';

/*
 * Indicateurs avancés du tableau de bord des bons :
 * 30 derniers jours comparés aux 30 jours précédents, délais (prise en charge, résolution),
 * taux de clôture, stock de bons ouverts, SLA, coûts, tendance 12 mois et classements.
 */

const OUVERTS = [1, 2, 3];
const EFFECTUE = 4;

const nomEquipement = (b) => b.lotArticleImmobilistation?.designation
  || b.immobilisation
  || (b.lotArticleImmobilistationId ? t('Équipement #{id}', { id: b.lotArticleImmobilistationId }) : null);

export default function IndicateursBons() {
  const [maintenant] = useState(() => Date.now()); // heure de référence des calculs
  const [bons, setBons] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [retardsSla, setRetardsSla] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    bonMaintenanceService.getAll(0, 2000)
      .then((r) => { if (actif) setBons(liste(r)); })
      .catch(() => { if (actif) { setBons([]); setErreur(t('Impossible de charger les bons pour les indicateurs.')); } });
    slaService.getBilan().then((b) => { if (actif) setBilan(b); }).catch(() => {});
    slaService.getDepassements().then((d) => { if (actif) setRetardsSla(liste(d)); }).catch(() => { if (actif) setRetardsSla([]); });
    return () => { actif = false; };
  }, []);

  const k = useMemo(() => {
    if (!bons) return null;
    const { courante, precedente } = periodes(30, maintenant);

    const calculer = (p) => {
      const crees = bons.filter((b) => dans(b.dateCreation, p));
      const clotures = bons.filter((b) => b.etat === EFFECTUE && dans(b.dateCloture, p));
      const priseEnCharge = bons.filter((b) => dans(b.dateIntervention, p))
        .map((b) => heuresEntre(b.dateCreation, b.dateIntervention));
      return {
        crees: crees.length,
        clotures: clotures.length,
        mtta: moyenne(priseEnCharge),
        mttr: moyenne(clotures.map((b) => heuresEntre(b.dateCreation, b.dateCloture))),
        tauxCloture: pourcentage(clotures.length, crees.length),
        cout: somme(clotures.map((b) => b.coutTotal)),
        coutMoyen: moyenne(clotures.map((b) => b.coutTotal).filter((c) => c != null)),
        arrets: crees.filter((b) => b.arretOblig).length,
      };
    };

    const ouverts = bons.filter((b) => OUVERTS.includes(b.etat));
    const ages = ouverts.map((b) => {
      const c = enMs(b.dateCreation);
      return c != null ? (maintenant - c) / JOUR : null;
    });
    const anciens = ages.filter((a) => a != null && a > 30).length;

    const mois = douzeMois();
    const debut12 = maintenant - 365 * JOUR;
    const recents = bons.filter((b) => (enMs(b.dateCreation) ?? 0) >= debut12);

    return {
      cur: calculer(courante),
      prev: calculer(precedente),
      ouverts: ouverts.length,
      ageMoyen: moyenne(ages),
      anciens,
      mois,
      serieCrees: serieMensuelle(bons, (b) => b.dateCreation, { mois }),
      serieClotures: serieMensuelle(bons.filter((b) => b.etat === EFFECTUE), (b) => b.dateCloture, { mois }),
      topEquipements: classement(recents, (b) => b.lotArticleImmobilistationId ?? b.immobilisation, nomEquipement),
      topServices: classement(recents, (b) => b.serviceId ?? b.serviceNom, (b) => b.serviceNom || b.service?.description || t('Service #{id}', { id: b.serviceId })),
      topCouts: classement(recents.filter((b) => b.coutTotal > 0), (b) => b.lotArticleImmobilistationId ?? b.immobilisation, nomEquipement, { valeurDe: (b) => b.coutTotal }),
      parPriorite: classement(ouverts, (b) => b.priorite || 'NC', (b) => (b.priorite ? `${b.priorite} · ${t(prioriteLabel(b.priorite))}` : t('Non calculée')), { n: 5 }),
    };
  }, [bons, maintenant]);

  const chargement = !k;
  const c = k?.cur || {};
  const p = k?.prev || {};

  // Tuiles affichées (et exportées en Excel). Une tuile à 0 ou sans valeur n'est pas affichée.
  const tuiles = [
    {
      libelle: t('Bons créés'),
      valeur: c.crees,
      precedent: p.crees,
      chargement: chargement,
      lien: '/bons-maintenance',
    },
    {
      libelle: t('Bons clôturés'),
      valeur: c.clotures,
      precedent: p.clotures,
      sens: 'hausse',
      chargement: chargement,
      ton: 'ok',
    },
    {
      libelle: t('Taux de clôture'),
      valeur: c.tauxCloture,
      precedent: p.tauxCloture,
      format: 'pct',
      sens: 'hausse',
      chargement: chargement,
      aide: t('Bons clôturés ÷ bons créés sur la période. Au-dessus de 100 %, le stock de bons ouverts diminue.'),
    },
    {
      libelle: t('Délai moyen de prise en charge'),
      valeur: c.mtta,
      precedent: p.mtta,
      format: 'duree',
      sens: 'baisse',
      chargement: chargement,
      aide: t('MTTA : temps moyen entre la création du bon et le début de l’intervention.'),
    },
    {
      libelle: t('Délai moyen de résolution'),
      valeur: c.mttr,
      precedent: p.mttr,
      format: 'duree',
      sens: 'baisse',
      chargement: chargement,
      aide: t('MTTR : temps moyen entre la création et la clôture des bons clôturés sur la période.'),
    },
    {
      libelle: t('Bons ouverts'),
      valeur: k?.ouverts,
      detail: k ? t('Âge moyen {age} · {n} de plus de 30 jours', { age: k.ageMoyen != null ? t('{n} j', { n: Math.round(k.ageMoyen) }) : '—', n: k.anciens }) : null,
      chargement: chargement,
      ton: k?.anciens > 0 ? 'attention' : undefined,
      lien: '/bons-maintenance',
    },
    {
      libelle: t('Bons en retard SLA'),
      valeur: retardsSla?.length,
      chargement: retardsSla == null,
      ton: retardsSla?.length ? 'alerte' : 'ok',
      lien: '/bons-maintenance?sla=retard',
      aide: t('Bons ouverts dont le délai de réponse ou de résolution SLA est dépassé.'),
    },
    {
      libelle: t('Respect SLA — réponse'),
      valeur: bilan?.tauxRespectReponsePct,
      format: 'pct',
      chargement: bilan == null,
      detail: bilan ? t('{n} bons analysés (3 mois)', { n: bilan.nbBonsAnalyses }) : null,
      lien: '/sla',
    },
    {
      libelle: t('Respect SLA — résolution'),
      valeur: bilan?.tauxRespectResolutionPct,
      format: 'pct',
      chargement: bilan == null,
      lien: '/sla',
    },
    {
      libelle: t('Coût des bons clôturés'),
      valeur: c.cout,
      precedent: p.cout,
      format: 'dt',
      sens: 'baisse',
      chargement: chargement,
      lien: '/cout',
    },
    {
      libelle: t('Coût moyen par bon'),
      valeur: c.coutMoyen,
      precedent: p.coutMoyen,
      format: 'dt',
      sens: 'baisse',
      chargement: chargement,
    },
    {
      libelle: t('Arrêts obligatoires déclarés'),
      valeur: c.arrets,
      precedent: p.arrets,
      sens: 'baisse',
      chargement: chargement,
    },
  ];

  const exportExcel = {
    fichier: 'indicateurs-bons',
    titre: t('Indicateurs — Bons de maintenance'),
    periode: t('30 derniers jours, comparés aux 30 jours précédents'),
    tuiles,
    courbes: k ? [
      { titre: t('Bons créés et clôturés'), mois: k.mois, series: [ { nom: t('Créés'), valeurs: k.serieCrees }, { nom: t('Clôturés'), valeurs: k.serieClotures }, ] },
    ] : [],
    classements: k ? [
      { titre: t('Équipements les plus en panne'), lignes: k.topEquipements },
      { titre: t('Services les plus demandeurs'), lignes: k.topServices },
      { titre: t('Équipements les plus coûteux'), lignes: k.topCouts, format: 'dt' },
      { titre: t('Bons ouverts par priorité'), lignes: k.parPriorite },
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
            titre={t('Bons créés et clôturés')}
            sousTitre={t('12 derniers mois')}
            mois={k.mois}
            series={[
              { nom: t('Créés'), valeurs: k.serieCrees },
              { nom: t('Clôturés'), valeurs: k.serieClotures },
            ]}
          />
          <Classement titre={t('Équipements les plus en panne')} sousTitre={t('Bons sur 12 mois')} lignes={k.topEquipements} />
          <Classement titre={t('Services les plus demandeurs')} sousTitre={t('Bons sur 12 mois')} lignes={k.topServices} />
          <Classement titre={t('Équipements les plus coûteux')} sousTitre={t('Coût des bons sur 12 mois')} lignes={k.topCouts} format="dt" />
          <Classement titre={t('Bons ouverts par priorité')} lignes={k.parPriorite} vide={t('Aucun bon ouvert.')} />
        </div>
      )}
    </SectionIndicateurs>
  );
}
