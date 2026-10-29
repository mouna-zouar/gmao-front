import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Car, CheckCircle2, Clock, ExternalLink, Eye, Loader2, MapPin, Navigation, Play, User, XCircle } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeMissionService from '../../../../services/vehiculeMissionService';
import { commePage, obtenirEmplacements, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeMissionModal from '../../../ui/modals/VehiculeMissionModal';
import TerminerMissionModal from '../../../ui/modals/TerminerMissionModal';
import PageModal from '../../../ui/modals/PageModal';
import VehiculeMissionDetails from './VehiculeMissionDetails';
import VehiculeTracage from './VehiculeTracage';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './VehiculeMissions.css';

/*
 * Missions véhicules : page liste de la bibliothèque commune.
 * Gardés tels quels : la fenêtre VehiculeMissionModal (kilométrage, bons de carburant liés),
 * la clôture TerminerMissionModal, le traçage et la vue détaillée VehiculeMissionDetails.
 */

const ETAT_LABELS = { 0: 'Planifiée', 1: 'En cours', 2: 'Terminée', 3: 'Annulée' };
const ETAT_META = {
  0: { classe: 'planned', Icone: Clock },
  1: { classe: 'running', Icone: Loader2 },
  2: { classe: 'done', Icone: CheckCircle2 },
  3: { classe: 'cancelled', Icone: XCircle },
};
const etatLabel = (e) => (ETAT_LABELS[e] ? t(ETAT_LABELS[e]) : t('Code {code}', { code: e }));
const dateHeure = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const temps = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');
const km = (n) => t('{n} km', { n: Number(n).toLocaleString(locale()) });

export default function VehiculeMissions() {
  const [missions, setMissions] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [emplacements, setEmplacements] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [erreurAction, setErreurAction] = useState('');
  const [filtreEtat, setFiltreEtat] = useState('all');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState(false);
  const [tracageOuvert, setTracageOuvert] = useState(false);
  const [terminerOuvert, setTerminerOuvert] = useState(false);
  const [detailsId, setDetailsId] = useState(null);
  const [detailsVersion, setDetailsVersion] = useState(0);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const [page, veh, pers, empl] = await Promise.all([
        vehiculeMissionService.getAll(0, 500),
        obtenirVehicules().then(commePage),
        personnelService.getAll(0, 500),
        obtenirEmplacements().then(commePage).catch(() => ({ content: [] })),
      ]);
      const liste = page.content ?? [];
      setMissions(liste);
      setSelection((s) => (s ? liste.find((m) => m.id === s.id) || null : null));
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
      setEmplacements(Object.fromEntries((empl.content ?? empl ?? []).map((e) => [e.id, e])));
    } catch {
      setErreur(t('Impossible de charger les missions. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const destination = useCallback((m) => emplacements[m.destinationId]?.nom || m.destination || m.lieu || '', [emplacements]);
  const conducteurDe = useCallback((m) => personnels[m.conducteurId ?? m.personnelId], [personnels]);

  const colonnes = useMemo(() => [
    {
      cle: 'num', label: 'N°', valeur: (m) => String(m.num || m.numero || ''),
      texte: (m) => [m.num || m.numero, m.libelle, m.description].filter(Boolean).join(' '),
      rendu: (m) => <span className="vms-cell-num">{m.num || m.numero || `#${m.id}`}</span>,
    },
    {
      cle: 'vehicule', label: 'Véhicule', valeur: (m) => vehicules[m.vehiculeId]?.nom || '',
      texte: (m) => { const v = vehicules[m.vehiculeId]; return [v?.nom, v?.immatriculation].filter(Boolean).join(' '); },
      rendu: (m) => { const v = vehicules[m.vehiculeId]; return (
        <div className="vms-cell-vehicle">
          <div className="vms-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vms-cell-vehicle-text">
            <span className="vms-cell-main">{v?.nom || t('Véhicule #{id}', { id: m.vehiculeId })}</span>
            {v?.immatriculation && <span className="vms-cell-sub">{v.immatriculation}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur', valeur: (m) => nomPersonne(conducteurDe(m)),
      texte: (m) => { const p = conducteurDe(m); return [p?.nom, p?.prenom, p?.matricule].filter(Boolean).join(' '); },
      rendu: (m) => { const p = conducteurDe(m); return p ? (
        <div className="vms-cell-driver"><User size={14} strokeWidth={2.2} className="vms-cell-driver-icon" /><span>{nomPersonne(p)}</span></div>
      ) : <span className="vms-cell-empty">—</span>; },
    },
    {
      cle: 'depart', label: 'Départ', recherche: false, valeur: (m) => temps(m.dateDepart || m.dateDebut),
      texte: (m) => dateHeure(m.dateDepart || m.dateDebut), rendu: (m) => <span className="vms-cell-date">{dateHeure(m.dateDepart || m.dateDebut)}</span>,
    },
    {
      cle: 'retour', label: 'Retour', recherche: false, valeur: (m) => temps(m.dateRetour || m.dateFin),
      texte: (m) => dateHeure(m.dateRetour || m.dateFin), rendu: (m) => <span className="vms-cell-date">{dateHeure(m.dateRetour || m.dateFin)}</span>,
    },
    {
      cle: 'destination', label: 'Destination', valeur: destination,
      texte: (m) => [destination(m), m.localisation].filter(Boolean).join(' '),
      rendu: (m) => (
        <div className="vms-cell-destination">
          <span>{destination(m) || '—'}</span>
          {m.latitude != null && m.longitude != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=16/${m.latitude}/${m.longitude}`}
              target="_blank" rel="noopener noreferrer" className="vms-cell-map-link"
              title={t('Voir sur OpenStreetMap')} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
            >
              <MapPin size={13} strokeWidth={2.5} /><ExternalLink size={11} strokeWidth={2.5} />
            </a>
          )}
        </div>
      ),
    },
    {
      cle: 'parcourus', label: 'Parcourus', recherche: false, alignement: 'droite',
      valeur: (m) => Number(m.kilometrageParcouru ?? m.kilometrageDepart ?? -1),
      texte: (m) => (m.kilometrageParcouru != null ? km(m.kilometrageParcouru) : ''),
      rendu: (m) => (m.kilometrageParcouru != null ? km(m.kilometrageParcouru)
        : m.kilometrageDepart != null ? <>{km(m.kilometrageDepart)} <span className="rtl-miroir">→</span></> : '—'),
    },
    {
      cle: 'etat', label: 'État', recherche: false, valeur: (m) => Number(m.etat ?? -1), texte: (m) => etatLabel(m.etat),
      rendu: (m) => { const e = ETAT_META[m.etat] ?? ETAT_META[0]; const Ic = e.Icone; return (
        <span className={`vms-pill ${e.classe}`}><Ic size={12} strokeWidth={2.5} className={m.etat === 1 ? 'vms-spin' : ''} />{etatLabel(m.etat)}</span>
      ); },
    },
  ], [vehicules, conducteurDe, destination]);

  /* L'export et l'impression gardent les colonnes détaillées de l'écran d'origine */
  const colonnesExport = useMemo(() => [
    { label: 'N°', texte: (m) => m.num || m.numero },
    { label: 'Véhicule', texte: (m) => vehicules[m.vehiculeId]?.nom },
    { label: 'Immatriculation', texte: (m) => vehicules[m.vehiculeId]?.immatriculation },
    { label: 'Conducteur', texte: (m) => nomPersonne(conducteurDe(m)) },
    { label: 'Départ', texte: (m) => dateHeure(m.dateDepart || m.dateDebut) },
    { label: 'Retour', texte: (m) => dateHeure(m.dateRetour || m.dateFin) },
    { label: 'Destination', texte: destination },
    { label: 'Localisation', texte: (m) => m.localisation },
    { label: 'Km parcourus', texte: (m) => (m.kilometrageParcouru != null ? String(m.kilometrageParcouru) : '') },
    { label: 'État', texte: (m) => etatLabel(m.etat) },
  ], [vehicules, conducteurDe, destination]);

  const etatsPresents = useMemo(() => [...new Set(missions.map((m) => m.etat).filter((e) => e != null))].sort((a, b) => a - b), [missions]);
  const lignes = filtreEtat === 'all' ? missions : missions.filter((m) => String(m.etat) === filtreEtat);
  const compte = (e) => missions.filter((m) => m.etat === e).length;
  const basculer = (v) => setFiltreEtat((f) => (f === v ? 'all' : v));

  const demarrer = async (m) => {
    setErreurAction('');
    try {
      await vehiculeMissionService.demarrer(m.id);
      await charger();
      setDetailsVersion((v) => v + 1);
    } catch (err) {
      setErreurAction(err.response?.data?.message || t('Échec du démarrage de la mission.'));
    }
  };
  /* Appelé par TerminerMissionModal ; les erreurs 409 remontent à la fenêtre */
  const confirmerTerminer = async (kmRetour, motif) => {
    await vehiculeMissionService.terminer(selection.id, kmRetour, motif);
    await charger();
    setDetailsVersion((v) => v + 1);
  };
  /* Renvoie la mission enregistrée : la fenêtre s'en sert pour lier les bons de carburant ajoutés à la création */
  const enregistrer = async (payload) => {
    const enregistree = selection
      ? await vehiculeMissionService.update(selection.id, payload)
      : await vehiculeMissionService.create(payload);
    await charger();
    setDetailsVersion((v) => v + 1);
    return enregistree;
  };

  const s = selection;
  const actions = [
    { label: t('Détails'), icone: Eye, classe: 'cl-action--teal', besoinSelection: true,
      aide: t('Voir tous les détails de la mission, avec ses bons de carburant et ses amendes'), onClick: (m) => setDetailsId(m.id) },
    { label: t('Traçage'), icone: Navigation, classe: 'cl-action--teal', besoinSelection: true,
      aide: t('Ouvrir le traçage et les détails de la mission'), onClick: () => setTracageOuvert(true) },
    { label: t('Démarrer'), icone: Play, classe: 'cl-action--bleu', besoinSelection: true, desactive: s?.etat !== 0,
      aide: t('Démarrer la mission sélectionnée'), onClick: demarrer },
    { label: t('Terminer'), icone: CheckCircle2, classe: 'cl-action--violet', besoinSelection: true, desactive: s?.etat !== 1,
      aide: t('Terminer la mission sélectionnée'), onClick: () => setTerminerOuvert(true) },
  ];

  const missionDetails = detailsId != null ? (missions.find((m) => m.id === detailsId) ?? null) : null;
  const depuisDetails = (fn) => () => { if (missionDetails) { setSelection(missionDetails); fn(missionDetails); } };

  return (
    <>
      {detailsId != null ? (
        <VehiculeMissionDetails
          mission={missionDetails}
          vehicule={missionDetails ? vehicules[missionDetails.vehiculeId] : null}
          conducteur={missionDetails ? personnels[missionDetails.conducteurId] : null}
          source={missionDetails ? emplacements[missionDetails.sourceId] : null}
          destination={missionDetails ? emplacements[missionDetails.destinationId] : null}
          version={detailsVersion}
          onBack={() => setDetailsId(null)}
          onModifier={depuisDetails(() => setFenetre(true))}
          onDemarrer={depuisDetails(demarrer)}
          onTerminer={depuisDetails(() => setTerminerOuvert(true))}
          onTracage={depuisDetails(() => setTracageOuvert(true))}
        />
      ) : (
        <PageListe
          icone={ICONES_MODULES.missions}
          titre={t('Missions véhicules')}
          sousTitre={t('Déplacements, affectations et suivi des missions par véhicule')}
          stats={[
            { label: t('Total'), valeur: missions.length, actif: filtreEtat === 'all', onClick: () => setFiltreEtat('all') },
            { label: t('Planifiées'), valeur: compte(0), ton: 'gris', icone: Clock, actif: filtreEtat === '0', onClick: () => basculer('0') },
            { label: t('En cours'), valeur: compte(1), ton: 'bleu', icone: Loader2, actif: filtreEtat === '1', onClick: () => basculer('1') },
            { label: t('Terminées'), valeur: compte(2), ton: 'vert', icone: CheckCircle2, actif: filtreEtat === '2', onClick: () => basculer('2') },
          ]}
          colonnes={colonnes}
          lignes={lignes}
          chargement={chargement}
          erreur={erreur}
          selection={selection}
          onSelection={(m) => { setSelection(m); setErreurAction(''); }}
          actions={actions}
          avantTableau={erreurAction ? <div className="cl-bandeau cl-bandeau--erreur" role="alert"><AlertTriangle size={16} />{erreurAction}</div> : null}
          filtres={(
            <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label={t('État')}>
              <option value="all">{t('Tous les états')}</option>
              {etatsPresents.map((e) => <option key={e} value={e}>{etatLabel(e)}</option>)}
            </select>
          )}
          colonnesExport={colonnesExport}
          filtresImpression={[{ label: t('État'), valeur: filtreEtat !== 'all' ? etatLabel(Number(filtreEtat)) : '' }]}
          onAjouter={() => { setSelection(null); setFenetre(true); }}
          libelleAjouter={t('Nouvelle mission')}
          onModifier={(m) => { setSelection(m); setFenetre(true); }}
          onOuvrir={(m) => { setSelection(m); setDetailsId(m.id); }}
          onSupprimer={async (m) => { await vehiculeMissionService.remove(m.id); setSelection(null); await charger(); }}
          messageSuppression={(m) => t('Supprimer la mission « {num} » ? Cette action est irréversible.', { num: m.num || m.numero || m.id })}
          cleStockage="vehicule-missions"
          nomExport="vehicule-missions"
          vide={{ aucun: t('Aucune mission pour l’instant.'), aucunFiltre: t('Aucune mission ne correspond à ces filtres.') }}
        />
      )}

      <VehiculeMissionModal
        isOpen={fenetre}
        onClose={() => { setFenetre(false); setDetailsVersion((v) => v + 1); }}
        onSave={enregistrer}
        vehiculeMission={selection}
        isEditing={Boolean(selection)}
      />
      <PageModal
        isOpen={tracageOuvert}
        onClose={() => setTracageOuvert(false)}
        title={t('Traçage véhicule')}
        subtitle={t('Suivi en temps réel, historique et détails de la mission')}
        icon={Navigation}
        accent="#0d9488"
        size="full"
      >
        <VehiculeTracage isModal initialVehiculeId={selection?.vehiculeId ?? null} initialMission={selection ?? null} />
      </PageModal>
      <TerminerMissionModal
        isOpen={terminerOuvert}
        onClose={() => setTerminerOuvert(false)}
        mission={selection}
        vehicule={selection ? vehicules[selection.vehiculeId] : null}
        onConfirm={confirmerTerminer}
      />
    </>
  );
}
