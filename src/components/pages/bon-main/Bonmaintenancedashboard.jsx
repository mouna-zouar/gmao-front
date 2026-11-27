import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlarmClock, CircleCheck, CircleDollarSign, FilePlus2, OctagonAlert, Timer, TrendingUp, Wrench } from 'lucide-react';
import { selectUtilisateur } from '../../../store/authSlice';
import { Badge, Barres, Carte, Liste, Repartition, Stat, Vide } from '../../commun/TableauBord';
import { ZonePerso } from '../../commun/tableauPerso/BlocsPerso';
import { EntetePerso } from '../../commun/tableauPerso/PagePerso';
import { ColonnesGroupees, ColonnesMois, CourbePerso } from '../../commun/tableauPerso/GraphiquesPerso';
import { PERIODES, dt, evolution, heures, nb, pct, useTableauPerso } from '../../commun/tableauPerso/outilsPerso';
import { PROFIL_BONS, useDispositionBons } from './profilBons';
import { ICONES_MODULES } from '../../../constants/modules';
import { ilYa } from '../../ui/Veille/Veille';
import { t } from '../../../i18n';
import '../Supervision/Supervision.css';
import { lireRequete } from '../../../store/referentiels';

const CHARGER_TABLEAU_BONS = (jours, recalculer, lieuId) => lireRequete('tableauBons', { jours, lieuId }, { forcer: recalculer });

/*
 * Tableau de bord des bons de maintenance, personnalisable par utilisateur
 * (cartes chiffrées déplaçables, cartes créées, largeur des graphiques).
 */

const SERIES_ACTIVITE = [
  { cle: 'bonsCrees', label: 'Bons créés', couleur: '#287da8' },
  { cle: 'bonsClotures', label: 'Bons clôturés', couleur: '#1f9d74' },
];
const SERIES_CREES_CLOTURES = [
  { cle: 'crees', label: 'Créés', couleur: '#0794a4' },
  { cle: 'clotures', label: 'Clôturés', couleur: '#2e3f5a' },
];
const ETATS = [
  { cle: 1, label: 'Nouveau', ton: 'bleu' },
  { cle: 3, label: 'En cours', ton: 'vert' },
  { cle: 2, label: 'Suspendu', ton: 'ambre' },
  { cle: 4, label: 'Effectué', ton: 'teal' },
  { cle: 10, label: 'Annulé', ton: 'gris' },
];
const URGENCES = [
  { cle: 3, label: 'Élevée', ton: 'rouge' },
  { cle: 2, label: 'Moyenne', ton: 'ambre' },
  { cle: 1, label: 'Faible', ton: 'vert' },
];
const PRIORITES = [
  { cle: 'P1', label: 'P1 · Immédiate', ton: 'rouge' },
  { cle: 'P2', label: 'P2 · Urgente', ton: 'orange' },
  { cle: 'P3', label: 'P3 · Normale', ton: 'bleu' },
  { cle: 'P4', label: 'P4 · Planifiable', ton: 'gris' },
];
const PRIORITE_TON = Object.fromEntries(PRIORITES.map((p) => [p.cle, p.ton]));
const TYPES = [
  { cle: 'CURATIF', label: 'Curatif', ton: 'orange' },
  { cle: 'PREVENTIF', label: 'Préventif', ton: 'teal' },
  { cle: 'INSTALLATION', label: 'Nouvelle installation', ton: 'violet' },
  { cle: 'AUTRE', label: 'Autre', ton: 'gris' },
];
const ANCIENNETE = [
  { label: 'Moins de 2 jours', ton: 'vert' },
  { label: '2 à 7 jours', ton: 'ambre' },
  { label: '1 à 4 semaines', ton: 'orange' },
  { label: 'Plus d’un mois', ton: 'rouge' },
];
const PARTIES = { activite: 'activité', bons: 'bons', sla: 'délais SLA', couts: 'coûts', detail: 'répartitions' };
const tonTaux = (v) => (v == null ? 'neutre' : v >= 90 ? 'vert' : v >= 75 ? 'ambre' : 'rouge');
const aDesValeurs = (objet, cles) => cles.some((c) => Number(objet?.[c]) > 0);

export default function BonMaintenanceDashboard() {
  const navigate = useNavigate();
  const utilisateur = useSelector(selectUtilisateur);
  const [disposition, actions] = useDispositionBons(utilisateur?.personnelId ?? utilisateur?.userId ?? utilisateur?.username);
  const [edition, setEdition] = useState(false);
  const etat = useTableauPerso(CHARGER_TABLEAU_BONS, 'gmao.tableau-bons.periode');
  const { donnees, jours } = etat;

  const d = donnees || {};
  const { bons, sla, couts, detail } = d;
  const pas = d.periode?.pas;
  const libellePeriode = t(PERIODES.find((p) => p.cle === jours)?.label || '');
  const indisponibles = useMemo(() => (d.indisponibles || []).map((k) => t(PARTIES[k] || k)), [d.indisponibles]);
  const indispo = (cle) => <Vide>{t('Données « {n} » indisponibles pour le moment.', { n: t(PARTIES[cle]) })}</Vide>;
  const ouvrirBon = (id) => id && navigate(`/bons-maintenance?id=${id}`);
  const ouvrirEquipement = (id) => id && navigate(`/equipement/${id}`);
  const evolCrees = bons ? evolution(bons.creesPeriode, bons.creesPeriodePrecedente) : null;
  const evolCout = couts ? evolution(couts.total, couts.totalPrecedent) : null;

  const statsRendus = {
    ouverts: (
      <Stat featured lien="/bons-maintenance?vue=a-traiter" icone={Wrench} ton="teal" valeur={nb(bons?.ouverts)} label={t('Bons ouverts')}
        badge={sla?.enRetard ? <Badge ton="rouge">{t('{n} en retard', { n: sla.enRetard })}</Badge> : null}
        sous={bons ? t('{a} créés · {b} clôturés', { a: nb(bons.creesPeriode), b: nb(bons.cloturesPeriode) }) : null} />
    ),
    crees: (
      <Stat lien="/bons-maintenance?vue=tous" icone={FilePlus2} ton="bleu" valeur={nb(bons?.creesPeriode)} label={t('Bons créés')}
        sous={evolCrees ? t('{e} vs période précédente', { e: evolCrees }) : libellePeriode} />
    ),
    clotures: (
      <Stat lien="/bons-maintenance?etat=4" icone={CircleCheck} ton="vert" valeur={nb(bons?.cloturesPeriode)} label={t('Bons clôturés')}
        sous={bons?.preventifsEffectues ? t('{n} préventif(s) effectué(s)', { n: nb(bons.preventifsEffectues) }) : libellePeriode} />
    ),
    retards: (
      <Stat lien="/sla" icone={AlarmClock} ton={sla?.enRetard ? 'rouge' : 'vert'} valeur={nb(sla?.enRetard)} label={t('Bons en retard (SLA)')}
        sous={sla ? t('résolution respectée : {p}', { p: pct(sla.respectResolutionPct) }) : null} />
    ),
    arrets: (
      <Stat lien="/bons-maintenance?vue=a-traiter" icone={OctagonAlert} ton={bons?.arretsObligatoires ? 'rouge' : 'neutre'}
        valeur={nb(bons?.arretsObligatoires)} label={t('Arrêts obligatoires en cours')} />
    ),
    delai: (
      <Stat icone={Timer} ton="violet" valeur={heures(bons?.delaiMoyenClotureHeures)} label={t('Délai moyen de clôture')}
        sous={bons?.cloturesPeriode ? t('sur {n} bons clôturés', { n: nb(bons.cloturesPeriode) }) : null} />
    ),
    sla: (
      <Stat lien="/sla" icone={Timer} ton={tonTaux(sla?.respectResolutionPct)} valeur={pct(sla?.respectResolutionPct)} label={t('Délais SLA respectés')}
        sous={sla ? t('réponse : {p}', { p: pct(sla.respectReponsePct) }) : null} />
    ),
    cout: (
      <Stat lien="/cout" icone={CircleDollarSign} ton="neutre" valeur={dt(couts?.total, true)} label={t('Coût de maintenance')}
        sous={couts ? (evolCout ? t('{e} vs période précédente', { e: evolCout }) : t('{n} bons', { n: nb(couts.bons) })) : null} />
    ),
    preventif: (
      <Stat icone={TrendingUp} ton="teal" valeur={pct(bons?.partPreventifPct)} label={t('Part de préventif')}
        sous={bons?.preventifsPeriode ? t('{a} sur {b} effectué(s)', { a: nb(bons.preventifsEffectues), b: nb(bons.preventifsPeriode) }) : null} />
    ),
  };

  const cartesRendues = {
    activite: (
      <Carte titre={t('Bons créés et clôturés')} pastille={pas === 'MOIS' ? t('par mois') : pas === 'SEMAINE' ? t('par semaine') : t('par jour')}>
        {d.activite ? <CourbePerso tranches={d.activite} pas={pas} series={SERIES_ACTIVITE} /> : indispo('activite')}
      </Carte>
    ),
    etats: (
      <Carte titre={t('Bons par état')} pastille={libellePeriode}>
        {detail ? (aDesValeurs(detail.parEtatPeriode, ETATS.map((e) => e.cle)) ? (
          <>
            <div className="tb-sous-titre">{t('Bons créés sur la période')}</div>
            <Repartition label={t('Bons créés par état')}
              items={ETATS.map((e) => ({ ...e, valeur: detail.parEtatPeriode?.[e.cle] || 0, onOuvrir: () => navigate(`/bons-maintenance?etat=${e.cle}`) }))
                .filter((e) => e.valeur > 0)} />
            {bons?.anciennete?.some((v) => v > 0) && (
              <>
                <div className="tb-sous-titre">{t('Bons ouverts depuis')}</div>
                <Barres lignes={ANCIENNETE.map((a, i) => ({ cle: a.label, nom: t(a.label), valeur: bons.anciennete[i] || 0, ton: a.ton }))} />
              </>
            )}
          </>
        ) : <Vide>{t('Aucune donnée sur la période.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    retards: (
      <Carte className="tb-carte--liste" titre={t('Bons en retard (SLA)')}
        pastille={sla ? t('{n} en retard', { n: nb(sla.enRetard) }) : null} pastilleTon={sla?.enRetard ? 'rouge' : null}>
        {sla ? (sla.retards?.length ? (
          <Liste lignes={sla.retards.map((b) => ({
            cle: b.id, ton: PRIORITE_TON[b.priorite], badge: b.priorite || '—',
            titre: `${b.num || `#${b.id}`} · ${b.titre || t('Sans titre')}`,
            sous: b.echeance ? t('échéance dépassée {d}', { d: ilYa(b.echeance) }) : null,
            onOuvrir: () => ouvrirBon(b.id),
          }))} />
        ) : <Vide>{t('Aucun bon en retard.')}</Vide>) : indispo('sla')}
      </Carte>
    ),
    plusAnciens: (
      <Carte className="tb-carte--liste" titre={t('Bons ouverts depuis le plus longtemps')} pastille={bons ? t('{n} ouverts', { n: nb(bons.ouverts) }) : null}>
        {bons ? (bons.plusAnciens?.length ? (
          <Liste lignes={bons.plusAnciens.map((b) => {
            const e = ETATS.find((x) => x.cle === b.etat);
            return {
              cle: b.id, ton: e?.ton, badge: t(e?.label || '—'),
              titre: `${b.num || `#${b.id}`} · ${b.titre || t('Sans titre')}`,
              sous: [b.equipement, t('ouvert {d}', { d: ilYa(b.dateCreation) })].filter(Boolean).join(' · '),
              onOuvrir: () => ouvrirBon(b.id),
            };
          })} />
        ) : <Vide>{t('Aucun bon ouvert.')}</Vide>) : indispo('bons')}
      </Carte>
    ),
    techniciens: (
      <Carte titre={t('Bons par technicien')} pastille={libellePeriode}>
        {detail ? (
          <ColonnesGroupees series={SERIES_CREES_CLOTURES}
            lignes={(detail.parTechnicien || []).map((x) => ({
              cle: x.nom, nom: x.nom, crees: x.crees, clotures: x.clotures,
              bulle: Number(x.heures) > 0 ? [[t('Temps passé'), heures(x.heures)]] : [],
            }))} />
        ) : indispo('detail')}
      </Carte>
    ),
    services: (
      <Carte titre={t('Bons par service')} pastille={libellePeriode}>
        {detail ? (
          <ColonnesGroupees series={SERIES_CREES_CLOTURES}
            lignes={(detail.parService || []).map((x) => ({ cle: x.nom, nom: x.nom, crees: x.crees, clotures: x.clotures }))} />
        ) : indispo('detail')}
      </Carte>
    ),
    urgence: (
      <Carte titre={t('Urgence et priorité')} pastille={libellePeriode}>
        {detail || bons ? (aDesValeurs(detail?.parUrgence, [1, 2, 3]) || aDesValeurs(bons?.parPriorite, ['P1', 'P2', 'P3', 'P4']) ? (
          <>
            {aDesValeurs(detail?.parUrgence, [1, 2, 3]) && (
              <>
                <div className="tb-sous-titre">{t('Urgence des bons créés')}</div>
                <Repartition label={t('Bons par urgence')} items={URGENCES.map((u) => ({ ...u, valeur: detail.parUrgence?.[u.cle] || 0 })).filter((u) => u.valeur > 0)} />
              </>
            )}
            {aDesValeurs(bons?.parPriorite, ['P1', 'P2', 'P3', 'P4']) && (
              <>
                <div className="tb-sous-titre">{t('Priorité des bons ouverts')}</div>
                <Barres lignes={PRIORITES.map((p) => ({ cle: p.cle, nom: t(p.label), valeur: bons.parPriorite?.[p.cle] || 0, ton: p.ton }))} />
              </>
            )}
          </>
        ) : <Vide>{t('Aucune donnée sur la période.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    preventif: (
      <Carte titre={t('Préventif et curatif')} pastille={bons?.partPreventifPct != null ? t('{p} préventif', { p: pct(bons.partPreventifPct) }) : null}>
        {bons ? (aDesValeurs(bons.parType, TYPES.map((x) => x.cle)) ? (
          <>
            <Repartition label={t('Bons créés par type')} items={TYPES.map((x) => ({ ...x, valeur: bons.parType?.[x.cle] || 0 })).filter((x) => x.valeur > 0)} />
            {bons.preventifsPeriode > 0 && (
              <p className="tb-note">{t('{a} préventif(s) sur {b} déjà effectué(s).', { a: nb(bons.preventifsEffectues), b: nb(bons.preventifsPeriode) })}</p>
            )}
          </>
        ) : <Vide>{t('Aucune donnée sur la période.')}</Vide>) : indispo('bons')}
      </Carte>
    ),
    pannes: (
      <Carte titre={t('Équipements les plus en panne')} pastille={libellePeriode}>
        {detail ? (
          <Barres lignes={(detail.plusEnPanne || []).map((e, i) => ({
            cle: e.id ?? i, nom: e.nom, valeur: e.bons, ton: 'orange', sous: t('bons'), onOuvrir: e.id ? () => ouvrirEquipement(e.id) : undefined,
          }))} />
        ) : indispo('detail')}
      </Carte>
    ),
    couts: (
      <Carte titre={t('Coûts de maintenance par mois')} pastille={t('12 derniers mois')}>
        {couts ? (
          <>
            <ColonnesMois parMois={couts.parMois} format={(v) => dt(v, true)} />
            <ul className="tb-legende">
              {[['total', 'Sur la période'], ['mainOeuvre', 'Main-d’œuvre'], ['pieces', 'Pièces'], ['achats', 'Achats']]
                .filter(([cle]) => Number(couts[cle]) > 0).map(([cle, label]) => (
                  <li key={cle}>{t(label)} <b>{dt(couts[cle], true)}</b></li>
                ))}
            </ul>
          </>
        ) : indispo('couts')}
      </Carte>
    ),
    plusCouteux: (
      <Carte titre={t('Équipements les plus coûteux')} pastille={libellePeriode}>
        {couts ? (
          <Barres format={(v) => dt(v, true)}
            lignes={(couts.topEquipements || []).map((e, i) => ({
              cle: e.id ?? i, nom: e.nom || `#${e.id}`, valeur: e.cout, ton: 'teal',
              sous: t('{n} bons', { n: e.bons }), onOuvrir: () => ouvrirEquipement(e.id),
            }))} />
        ) : indispo('couts')}
      </Carte>
    ),
  };

  return (
    <div className={`tb-container ${edition ? 'tb-container--edition' : ''}`}>
      <EntetePerso icone={ICONES_MODULES.bonsMaintenance || Wrench} titre={t('Tableau de bord des bons de maintenance')}
        etat={etat} edition={edition} setEdition={setEdition} indisponibles={indisponibles} />
      {donnees && (
        <ZonePerso profil={PROFIL_BONS} disposition={disposition} actions={actions} edition={edition} onTerminer={() => setEdition(false)}
          donnees={d} statsRendus={statsRendus} cartesRendues={cartesRendues} surtitre={t('Tableau de bord des bons')} />
      )}
    </div>
  );
}
