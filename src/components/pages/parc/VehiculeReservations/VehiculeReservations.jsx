import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Ban, Calendar, Car, CheckCheck, CheckCircle2, Flag, Hourglass, User, XCircle } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeReservationService from '../../../../services/vehiculeReservationService';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeReservationModal from '../../../ui/modals/VehiculeReservationModal';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './VehiculeReservations.css';

/*
 * Réservations véhicule : page liste de la bibliothèque commune.
 * La fenêtre reste VehiculeReservationModal (conflits de réservation, trajet, projet).
 * Codes d'état (VehiculeReservation.java) : 0 En attente, 1 Acceptée, 2 Refusée, 3 Annulée, 4 Terminée.
 */

const ETAT_LABELS = { 0: 'En attente', 1: 'Acceptée', 2: 'Refusée', 3: 'Annulée', 4: 'Terminée' };
const ETAT_META = {
  0: { classe: 'pending', Icone: Hourglass },
  1: { classe: 'confirmed', Icone: CheckCircle2 },
  2: { classe: 'cancelled', Icone: XCircle },
  3: { classe: 'cancelled', Icone: XCircle },
  4: { classe: 'done', Icone: Activity },
};
/* Changements d'état rapides : actifs seulement depuis les états `depuis` */
const ETAT_ACTIONS = [
  { vers: 1, label: 'Accepter', icone: CheckCircle2, classe: 'cl-action--vert', depuis: [0] },
  { vers: 2, label: 'Refuser', icone: XCircle, classe: 'cl-action--rouge', depuis: [0] },
  { vers: 4, label: 'Terminer', icone: CheckCheck, classe: 'cl-action--gris', depuis: [1] },
  { vers: 3, label: 'Annuler', icone: Ban, classe: 'cl-action--orange', depuis: [0, 1] },
];

const etatLabel = (e) => (ETAT_LABELS[e] ? t(ETAT_LABELS[e]) : t('État {n}', { n: e }));
const dateHeure = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeReservations() {
  const [reservations, setReservations] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [erreurAction, setErreurAction] = useState('');
  const [filtreEtat, setFiltreEtat] = useState('all');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });
  const [changementEtat, setChangementEtat] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [page, veh, pers] = await Promise.all([
        vehiculeReservationService.getAll(0, 500), obtenirVehicules().then(commePage), personnelService.getAll(0, 500),
      ]);
      const liste = page.content ?? [];
      setReservations(liste);
      // La ligne sélectionnée suit la liste rechargée (son état a pu changer)
      setSelection((s) => (s ? liste.find((r) => r.id === s.id) || null : null));
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les réservations. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const changerEtat = async (r, vers) => {
    if (!r || changementEtat) return;
    setChangementEtat(true);
    setErreurAction('');
    try {
      await vehiculeReservationService.update(r.id, {
        vehiculeId: r.vehiculeId,
        personnelId: r.personnelId,
        personnelNom: r.personnelNom,
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        conducteurId: r.conducteurId,
        sourceId: r.sourceId,
        destinationId: r.destinationId,
        motif: r.motif,
        projetId: r.projetId,
        etat: vers,
        personnelCreationId: r.personnelCreationId,
        personnelCreationNom: r.personnelCreationNom,
        commentaire: r.commentaire,
      });
      await charger();
    } catch (err) {
      setErreurAction(err.response?.data?.message || t("Échec du changement d'état."));
    } finally {
      setChangementEtat(false);
    }
  };

  const colonnes = useMemo(() => [
    {
      cle: 'vehicule', label: 'Véhicule',
      valeur: (r) => { const v = vehicules[r.vehiculeId]; return [v?.matricule, v?.marque].filter(Boolean).join(' '); },
      rendu: (r) => { const v = vehicules[r.vehiculeId]; return (
        <div className="vrs-cell-vehicle">
          <div className="vrs-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vrs-cell-vehicle-text">
            <span className="vrs-cell-main">{v?.matricule || t('Véhicule #{id}', { id: r.vehiculeId })}</span>
            {v?.marque && <span className="vrs-cell-sub">{v.marque}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur',
      valeur: (r) => nomPersonne(personnels[r.personnelId] ?? { nom: r.personnelNom }),
      rendu: (r) => { const nom = nomPersonne(personnels[r.personnelId] ?? { nom: r.personnelNom }); return nom ? (
        <div className="vrs-cell-driver">
          <div className="vrs-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
          <span className="vrs-cell-main">{nom}</span>
        </div>
      ) : <span className="vrs-cell-empty">—</span>; },
    },
    {
      cle: 'periode', label: 'Période', recherche: false,
      valeur: (r) => (r.dateDebut ? new Date(r.dateDebut).getTime() : 0),
      texte: (r) => `${dateHeure(r.dateDebut)} → ${dateHeure(r.dateFin)}`,
      rendu: (r) => (
        <div className="vrs-cell-period">
          <span className="vrs-period-line"><Calendar size={12} strokeWidth={2.5} />{dateHeure(r.dateDebut)}</span>
          <span className="vrs-period-sep rtl-miroir">→</span>
          <span className="vrs-period-line end"><Flag size={12} strokeWidth={2.5} />{dateHeure(r.dateFin)}</span>
        </div>
      ),
    },
    { cle: 'motif', label: 'Motif', valeur: (r) => r.motif, rendu: (r) => <span className="vrs-cell-motif">{r.motif || '—'}</span> },
    {
      cle: 'etat', label: 'État', recherche: false, valeur: (r) => etatLabel(r.etat),
      rendu: (r) => { const m = ETAT_META[r.etat] ?? ETAT_META[0]; const Ic = m.Icone; return (
        <span className={`vrs-pill ${m.classe}`}><Ic size={12} strokeWidth={2.5} />{etatLabel(r.etat)}</span>
      ); },
    },
  ], [vehicules, personnels]);

  const lignes = filtreEtat === 'all' ? reservations : reservations.filter((r) => String(r.etat) === filtreEtat);
  const compte = (...etats) => reservations.filter((r) => etats.includes(r.etat)).length;
  const basculer = (v) => setFiltreEtat((f) => (f === v ? 'all' : v));

  const actions = ETAT_ACTIONS.map((a) => {
    const permis = Boolean(selection) && a.depuis.includes(selection.etat);
    return {
      label: t(a.label),
      icone: a.icone,
      classe: a.classe,
      besoinSelection: true,
      desactive: !permis || changementEtat,
      aide: !selection ? t('Sélectionne une réservation')
        : !permis ? t('Non disponible depuis « {etat} »', { etat: etatLabel(selection.etat) }) : t(a.label),
      onClick: (r) => changerEtat(r, a.vers),
    };
  });

  return (
    <PageListe
      icone={ICONES_MODULES.reservations}
      titre={t('Réservations véhicule')}
      sousTitre={t('Planning des réservations et affectations de véhicules')}
      stats={[
        { label: t('Total'), valeur: reservations.length, actif: filtreEtat === 'all', onClick: () => setFiltreEtat('all') },
        { label: t('En attente'), valeur: compte(0), ton: 'orange', icone: Hourglass, actif: filtreEtat === '0', onClick: () => basculer('0') },
        { label: t('Acceptées'), valeur: compte(1), ton: 'vert', icone: CheckCircle2, actif: filtreEtat === '1', onClick: () => basculer('1') },
        { label: t('Terminées'), valeur: compte(4), ton: 'bleu', icone: Activity, actif: filtreEtat === '4', onClick: () => basculer('4') },
        { label: t('Refusées / annulées'), valeur: compte(2, 3), ton: 'rouge', icone: XCircle },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={selection}
      onSelection={(r) => { setSelection(r); setErreurAction(''); }}
      actions={actions}
      avantTableau={erreurAction ? (
        <div className="cl-bandeau cl-bandeau--erreur" role="alert"><AlertTriangle size={16} />{erreurAction}</div>
      ) : null}
      filtres={(
        <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label={t('État')}>
          <option value="all">{t('Tous les états')}</option>
          {Object.entries(ETAT_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvelle réservation')}
      onModifier={(r) => setFenetre({ ouverte: true, objet: r })}
      onSupprimer={async (r) => { await vehiculeReservationService.remove(r.id); setSelection(null); await charger(); }}
      messageSuppression={() => t('Supprimer cette réservation ? Cette action est irréversible.')}
      cleStockage="vehicule-reservations"
      nomExport="reservations-vehicules"
      vide={{ aucun: t('Aucune réservation pour l’instant.'), aucunFiltre: t('Aucune réservation ne correspond à ces filtres.') }}
    >
      <VehiculeReservationModal
        isOpen={fenetre.ouverte}
        onClose={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        onSave={async (payload) => {
          if (fenetre.objet) await vehiculeReservationService.update(fenetre.objet.id, payload);
          else await vehiculeReservationService.create(payload);
          await charger();
        }}
        reservation={fenetre.objet}
        isEditing={Boolean(fenetre.objet)}
      />
    </PageListe>
  );
}
