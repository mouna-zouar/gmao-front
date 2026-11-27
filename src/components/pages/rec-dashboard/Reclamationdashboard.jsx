import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CircleCheck, Clock, Hourglass, Inbox, ListOrdered, MessageSquareWarning, ShieldCheck, Timer, UserX, Wrench } from 'lucide-react';
import { selectUtilisateur } from '../../../store/authSlice';
import { Badge, Barres, Carte, Liste, Repartition, Stat, Vide } from '../../commun/TableauBord';
import { ZonePerso } from '../../commun/tableauPerso/BlocsPerso';
import { EntetePerso } from '../../commun/tableauPerso/PagePerso';
import { ColonnesGroupees, CourbePerso } from '../../commun/tableauPerso/GraphiquesPerso';
import { PERIODES, evolution, heures, joursFmt, nb, useTableauPerso } from '../../commun/tableauPerso/outilsPerso';
import { PROFIL_RECLAMATIONS, useDispositionReclamations } from './profilReclamations';
import { ICONES_MODULES } from '../../../constants/modules';
import { ilYa } from '../../ui/Veille/Veille';
import { t } from '../../../i18n';
import '../Supervision/Supervision.css';
import { lireRequete } from '../../../store/referentiels';

const CHARGER_TABLEAU_RECLAMATIONS = (jours, recalculer, lieuId) => lireRequete('tableauReclamations', { jours, lieuId }, { forcer: recalculer });

/*
 * Tableau de bord des réclamations, personnalisable par utilisateur
 * (cartes chiffrées déplaçables, cartes créées, largeur des graphiques).
 */

const SERIES_ACTIVITE = [
  { cle: 'recues', label: 'Réclamations reçues', couleur: '#287da8' },
  { cle: 'cloturees', label: 'Réclamations clôturées', couleur: '#1f9d74' },
];
const SERIES_RECUES_CLOTUREES = [
  { cle: 'recues', label: 'Reçues', couleur: '#0794a4' },
  { cle: 'cloturees', label: 'Clôturées', couleur: '#2e3f5a' },
];
const ETATS = [
  { cle: 0, label: 'Nouveau', ton: 'bleu' },
  { cle: 5, label: 'En file', ton: 'violet' },
  { cle: 1, label: 'En cours', ton: 'teal' },
  { cle: 3, label: 'Résolue', ton: 'ambre' },
  { cle: 2, label: 'Clôturée', ton: 'vert' },
  { cle: 4, label: 'Annulée', ton: 'gris' },
];
const ETAT = Object.fromEntries(ETATS.map((e) => [e.cle, e]));
const NIVEAUX = [
  { cle: 3, label: 'Élevée', ton: 'rouge' },
  { cle: 2, label: 'Moyenne', ton: 'ambre' },
  { cle: 1, label: 'Faible', ton: 'vert' },
];
const ANCIENNETE = [
  { label: 'Moins de 2 jours', ton: 'vert' },
  { label: '2 à 7 jours', ton: 'ambre' },
  { label: '1 à 4 semaines', ton: 'orange' },
  { label: 'Plus d’un mois', ton: 'rouge' },
];
const PARTIES = { reclamations: 'réclamations', detail: 'répartitions' };
const aDesValeurs = (objet, cles) => cles.some((c) => Number(objet?.[c]) > 0);
const extrait = (texte, n = 70) => {
  const s = String(texte || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export default function ReclamationDashboard() {
  const navigate = useNavigate();
  const utilisateur = useSelector(selectUtilisateur);
  const [disposition, actions] = useDispositionReclamations(utilisateur?.personnelId ?? utilisateur?.userId ?? utilisateur?.username);
  const [edition, setEdition] = useState(false);
  const etat = useTableauPerso(CHARGER_TABLEAU_RECLAMATIONS, 'gmao.tableau-reclamations.periode');
  const { donnees, jours } = etat;

  const d = donnees || {};
  const rec = d.reclamations;
  const det = d.detail;
  const pas = d.periode?.pas;
  const libellePeriode = t(PERIODES.find((p) => p.cle === jours)?.label || '');
  const indisponibles = useMemo(() => (d.indisponibles || []).map((k) => t(PARTIES[k] || k)), [d.indisponibles]);
  const indispo = (cle) => <Vide>{t('Données « {n} » indisponibles pour le moment.', { n: t(PARTIES[cle]) })}</Vide>;
  const ouvrir = (id) => id && navigate(`/reclamations?id=${id}`);
  const evolRecues = det && rec ? evolution(det.recuesPeriode, rec.recuesPeriodePrecedente) : null;
  const evolCloturees = det ? evolution(det.clotureesPeriode, det.clotureesPeriodePrecedente) : null;

  const ligneReclamation = (r) => {
    const e = ETAT[r.etat];
    return {
      cle: r.id, ton: e?.ton, badge: t(e?.label || '—'),
      titre: `${r.num || `#${r.id}`} · ${extrait(r.description) || t('Sans description')}`,
      sous: [r.service, r.responsable, r.date ? t('reçue {d}', { d: ilYa(r.date) }) : null].filter(Boolean).join(' · '),
      onOuvrir: () => ouvrir(r.id),
    };
  };

  const statsRendus = {
    recues: (
      <Stat featured lien="/reclamations" icone={MessageSquareWarning} ton="teal" valeur={nb(det?.recuesPeriode)} label={t('Réclamations reçues')}
        badge={rec?.nonAffectees ? <Badge ton="orange">{t('{n} non affectée(s)', { n: rec.nonAffectees })}</Badge> : null}
        sous={det ? (evolRecues ? t('{e} vs période précédente', { e: evolRecues }) : t('{a} reçues · {b} clôturées', { a: nb(det.recuesPeriode), b: nb(det.clotureesPeriode) })) : null} />
    ),
    nouvelles: (
      <Stat lien="/reclamations?vue=a-traiter" icone={Inbox} ton="bleu" valeur={nb(rec?.ouvertes)} label={t('Nouvelles')} />
    ),
    enFile: (
      <Stat lien="/reclamations?vue=a-traiter" icone={ListOrdered} ton="violet" valeur={nb(rec?.enFile)} label={t('En file')} />
    ),
    enCours: (
      <Stat lien="/reclamations" icone={Wrench} ton="teal" valeur={nb(rec?.enCours)} label={t('En cours')} />
    ),
    aValider: (
      <Stat lien="/reclamations" icone={ShieldCheck} ton={rec?.enAttenteValidation ? 'ambre' : 'neutre'} valeur={nb(rec?.enAttenteValidation)} label={t('En attente de validation')} />
    ),
    nonAffectees: (
      <Stat lien="/reclamations?vue=a-traiter" icone={UserX} ton={rec?.nonAffectees ? 'orange' : 'vert'} valeur={nb(rec?.nonAffectees)} label={t('Non affectées')}
        badge={rec && !rec.nonAffectees ? <Badge ton="vert">{t('Toutes affectées')}</Badge> : null} />
    ),
    cloturees: (
      <Stat lien="/reclamations" icone={CircleCheck} ton="vert" valeur={nb(det?.clotureesPeriode)} label={t('Réclamations clôturées')}
        sous={evolCloturees ? t('{e} vs période précédente', { e: evolCloturees }) : libellePeriode} />
    ),
    delai: (
      <Stat icone={Timer} ton="violet" valeur={joursFmt(rec?.delaiMoyenResolutionJours)} label={t('Délai moyen de résolution')} />
    ),
    priseEnCharge: (
      <Stat icone={Clock} ton="bleu" valeur={heures(det?.delaiPriseEnChargeHeures)} label={t('Délai de prise en charge')} />
    ),
  };

  const cartesRendues = {
    activite: (
      <Carte titre={t('Réclamations reçues et clôturées')} pastille={pas === 'MOIS' ? t('par mois') : pas === 'SEMAINE' ? t('par semaine') : t('par jour')}>
        {det ? <CourbePerso tranches={det.activite} pas={pas} series={SERIES_ACTIVITE} /> : indispo('detail')}
      </Carte>
    ),
    etats: (
      <Carte titre={t('Réclamations par état')} pastille={libellePeriode}>
        {det ? (aDesValeurs(det.parEtatPeriode, ETATS.map((e) => e.cle)) ? (
          <>
            <div className="tb-sous-titre">{t('Réclamations reçues sur la période')}</div>
            <Repartition label={t('Réclamations reçues par état')}
              items={ETATS.map((e) => ({ ...e, valeur: det.parEtatPeriode?.[e.cle] || 0 })).filter((e) => e.valeur > 0)} />
            {det.anciennete?.some((v) => v > 0) && (
              <>
                <div className="tb-sous-titre">{t('Réclamations actives depuis')}</div>
                <Barres lignes={ANCIENNETE.map((a, i) => ({ cle: a.label, nom: t(a.label), valeur: det.anciennete[i] || 0, ton: a.ton }))} />
              </>
            )}
          </>
        ) : <Vide>{t('Aucune donnée sur la période.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    plusAnciennes: (
      <Carte className="tb-carte--liste" titre={t('Réclamations actives les plus anciennes')} pastille={det ? t('{n} actives', { n: nb(det.actives) }) : null}>
        {det ? (det.plusAnciennes?.length
          ? <Liste lignes={det.plusAnciennes.map(ligneReclamation)} />
          : <Vide>{t('Aucune réclamation active.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    nonAffectees: (
      <Carte className="tb-carte--liste" titre={t('Réclamations non affectées')}
        pastille={rec ? t('{n} à affecter', { n: nb(rec.nonAffectees) }) : null} pastilleTon={rec?.nonAffectees ? 'orange' : null}>
        {det ? (det.nonAffectees?.length
          ? <Liste lignes={det.nonAffectees.map(ligneReclamation)} />
          : <Vide>{t('Toutes les réclamations actives sont affectées.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    responsables: (
      <Carte titre={t('Réclamations par responsable')} pastille={libellePeriode}>
        {det ? (
          <ColonnesGroupees series={SERIES_RECUES_CLOTUREES}
            lignes={(det.parResponsable || []).map((x) => ({ cle: x.nom, nom: x.nom, recues: x.recues, cloturees: x.cloturees }))} />
        ) : indispo('detail')}
      </Carte>
    ),
    services: (
      <Carte titre={t('Réclamations par service')} pastille={libellePeriode}>
        {det ? (
          <ColonnesGroupees series={SERIES_RECUES_CLOTUREES}
            lignes={(det.parService || []).map((x) => ({ cle: x.nom, nom: x.nom, recues: x.recues, cloturees: x.cloturees }))} />
        ) : indispo('detail')}
      </Carte>
    ),
    niveaux: (
      <Carte titre={t('Criticité et urgence')} pastille={libellePeriode}>
        {det ? (aDesValeurs(det.parCriticite, [1, 2, 3]) || aDesValeurs(det.parUrgence, [1, 2, 3]) ? (
          <>
            {aDesValeurs(det.parCriticite, [1, 2, 3]) && (
              <>
                <div className="tb-sous-titre">{t('Criticité')}</div>
                <Repartition label={t('Réclamations par criticité')} items={NIVEAUX.map((n) => ({ ...n, valeur: det.parCriticite?.[n.cle] || 0 })).filter((n) => n.valeur > 0)} />
              </>
            )}
            {aDesValeurs(det.parUrgence, [1, 2, 3]) && (
              <>
                <div className="tb-sous-titre">{t('Urgence')}</div>
                <Repartition label={t('Réclamations par urgence')} items={NIVEAUX.map((n) => ({ ...n, valeur: det.parUrgence?.[n.cle] || 0 })).filter((n) => n.valeur > 0)} />
              </>
            )}
          </>
        ) : <Vide>{t('Aucune donnée sur la période.')}</Vide>) : indispo('detail')}
      </Carte>
    ),
    demandeurs: (
      <Carte titre={t('Principaux demandeurs')} pastille={libellePeriode}>
        {det ? <Barres lignes={(det.topDemandeurs || []).map((x) => ({ cle: x.nom, nom: x.nom, valeur: x.recues, ton: 'bleu' }))} /> : indispo('detail')}
      </Carte>
    ),
    codesPanne: (
      <Carte titre={t('Codes de panne les plus fréquents')} pastille={rec?.avecCodePanne ? t('{n} codées', { n: nb(rec.avecCodePanne) }) : libellePeriode}>
        {rec ? (
          <Barres lignes={(rec.codesPanne || []).map((c) => ({ cle: c.code, nom: c.libelle ? `${c.code} · ${c.libelle}` : c.code, valeur: c.nombre, ton: 'orange' }))} />
        ) : indispo('reclamations')}
      </Carte>
    ),
  };

  return (
    <div className={`tb-container ${edition ? 'tb-container--edition' : ''}`}>
      <EntetePerso icone={ICONES_MODULES.reclamations || Hourglass} titre={t('Tableau de bord des réclamations')}
        etat={etat} edition={edition} setEdition={setEdition} indisponibles={indisponibles} />
      {donnees && (
        <ZonePerso profil={PROFIL_RECLAMATIONS} disposition={disposition} actions={actions} edition={edition} onTerminer={() => setEdition(false)}
          donnees={d} statsRendus={statsRendus} cartesRendues={cartesRendues} surtitre={t('Tableau de bord des réclamations')} />
      )}
    </div>
  );
}
