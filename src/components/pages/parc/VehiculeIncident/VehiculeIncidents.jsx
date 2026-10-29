import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Calendar, Car, Coins, User, XCircle } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeIncidentService from '../../../../services/vehiculeIncidentService';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeIncidentModal from '../../../ui/modals/VehiculeIncidentModal';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './VehiculeIncidents.css';

/*
 * Incidents véhicule : page liste de la bibliothèque commune.
 * La fenêtre reste VehiculeIncidentModal (kilométrage, emplacement, lien GMAO).
 */

const TYPE_LABELS = { 1: 'Accident', 2: 'Panne', 3: 'Vol', 4: 'Dégradation', 5: 'Autre' };
const GRAVITE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Grave' };
const ETAT_LABELS = { 0: 'Ouvert', 1: 'En cours', 2: 'Clôturé' };
const ETAT_META = {
  0: { classe: 'declared', Icone: AlertTriangle, couleur: 'ambre' },
  1: { classe: 'inprogress', Icone: Activity, couleur: 'bleu' },
  2: { classe: 'closed', Icone: XCircle, couleur: 'gris' },
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatMontant = (v) => (v == null ? '—' : t('{montant} DT', {
  montant: Number(v).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}));
const typeLabel = (v) => (TYPE_LABELS[v] ? t(TYPE_LABELS[v]) : t('Type {n}', { n: v }));
const graviteLabel = (g) => (GRAVITE_LABELS[g] ? t(GRAVITE_LABELS[g]) : t('Gravité {niveau}', { niveau: g }));
const etatLabel = (e) => (ETAT_LABELS[e] ? t(ETAT_LABELS[e]) : t('État {n}', { n: e }));
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [erreurAction, setErreurAction] = useState('');
  const [filtreEtat, setFiltreEtat] = useState('all');
  const [filtreGravite, setFiltreGravite] = useState('all');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });
  const [changementEtat, setChangementEtat] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [page, veh, pers] = await Promise.all([
        vehiculeIncidentService.getAll(0, 500), obtenirVehicules().then(commePage), personnelService.getAll(0, 500),
      ]);
      const liste = page.content ?? [];
      setIncidents(liste);
      setSelection((s) => (s ? liste.find((i) => i.id === s.id) || null : null));
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les incidents. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const changerEtat = async (i, vers) => {
    if (!i || changementEtat || Number(i.etat) === Number(vers)) return;
    setChangementEtat(true);
    setErreurAction('');
    try {
      await vehiculeIncidentService.update(i.id, {
        vehiculeId: i.vehiculeId,
        type: i.type,
        dateIncident: i.dateIncident,
        emplacementId: i.emplacementId,
        conducteurId: i.conducteurId,
        description: i.description,
        gravite: i.gravite,
        etat: Number(vers),
        kilometrage: i.kilometrage,
        cout: i.cout,
        gmaoId: i.gmaoId,
        personnelCreationId: i.personnelCreationId,
        commentaire: i.commentaire,
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
      valeur: (i) => { const v = vehicules[i.vehiculeId]; return [v?.matricule, v?.marque].filter(Boolean).join(' '); },
      rendu: (i) => { const v = vehicules[i.vehiculeId]; return (
        <div className="vin-cell-vehicle">
          <div className="vin-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vin-cell-vehicle-text">
            <span className="vin-cell-main">{v?.matricule || t('Véhicule #{id}', { id: i.vehiculeId })}</span>
            {v?.marque && <span className="vin-cell-sub">{v.marque}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur', valeur: (i) => nomPersonne(personnels[i.conducteurId]),
      rendu: (i) => { const p = personnels[i.conducteurId]; return p ? (
        <div className="vin-cell-driver">
          <div className="vin-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
          <span className="vin-cell-main">{nomPersonne(p)}</span>
        </div>
      ) : <span className="vin-cell-empty">—</span>; },
    },
    { cle: 'type', label: 'Type', valeur: (i) => typeLabel(i.type), rendu: (i) => <span className="vin-tag">{typeLabel(i.type)}</span> },
    {
      cle: 'date', label: 'Date', recherche: false, valeur: (i) => (i.dateIncident ? new Date(i.dateIncident).getTime() : 0), texte: (i) => formatDate(i.dateIncident),
      rendu: (i) => <span className="vin-cell-date"><Calendar size={12} strokeWidth={2.5} />{formatDate(i.dateIncident)}</span>,
    },
    {
      cle: 'gravite', label: 'Gravité', recherche: false, valeur: (i) => Number(i.gravite ?? 0), texte: (i) => graviteLabel(i.gravite),
      rendu: (i) => <span className={`vin-gravite gravite-${i.gravite}`}>{graviteLabel(i.gravite)}</span>,
    },
    {
      cle: 'cout', label: 'Coût', recherche: false, alignement: 'droite', valeur: (i) => Number(i.cout ?? 0), texte: (i) => formatMontant(i.cout),
      rendu: (i) => <span className="vin-cell-amount"><Coins size={13} strokeWidth={2.5} />{formatMontant(i.cout)}</span>,
    },
    {
      cle: 'etat', label: 'État', recherche: false, valeur: (i) => etatLabel(i.etat),
      rendu: (i) => { const m = ETAT_META[i.etat] ?? ETAT_META[0]; const Ic = m.Icone; return (
        <span className={`vin-pill ${m.classe}`}><Ic size={12} strokeWidth={2.5} className={i.etat === 1 ? 'vin-spin' : ''} />{etatLabel(i.etat)}</span>
      ); },
    },
  ], [vehicules, personnels]);

  const lignes = incidents.filter((i) => (filtreEtat === 'all' || String(i.etat) === filtreEtat)
    && (filtreGravite === 'all' || String(i.gravite) === filtreGravite));
  const compte = (...etats) => incidents.filter((i) => etats.includes(i.etat)).length;
  const basculer = (v) => setFiltreEtat((f) => (f === v ? 'all' : v));
  const coutTotal = incidents.reduce((s, i) => s + (Number(i.cout) || 0), 0);

  /* Passage rapide vers un autre état, proposé quand un incident est sélectionné */
  const actions = selection
    ? Object.keys(ETAT_META).map(Number).filter((k) => k !== Number(selection.etat)).map((cible) => ({
      label: etatLabel(cible),
      icone: ETAT_META[cible].Icone,
      classe: `cl-action--${ETAT_META[cible].couleur}`,
      besoinSelection: true,
      desactive: changementEtat,
      aide: t('Passer à : {etat}', { etat: etatLabel(cible) }),
      onClick: (i) => changerEtat(i, cible),
    }))
    : [];

  return (
    <PageListe
      icone={ICONES_MODULES.incidents}
      titre={t('Incidents véhicule')}
      sousTitre={t('Suivi des accidents, pannes et événements sur le parc')}
      stats={[
        { label: t('Total'), valeur: incidents.length, actif: filtreEtat === 'all', onClick: () => setFiltreEtat('all') },
        { label: t('Déclarés'), valeur: compte(0), ton: 'ambre', icone: AlertTriangle, actif: filtreEtat === '0', onClick: () => basculer('0') },
        { label: t('En cours'), valeur: compte(1), ton: 'bleu', icone: Activity, actif: filtreEtat === '1', onClick: () => basculer('1') },
        { label: t('Résolus'), valeur: compte(2, 3), ton: 'vert', icone: XCircle, actif: filtreEtat === '2', onClick: () => basculer('2') },
        { label: t('Coût'), valeur: formatMontant(coutTotal), ton: 'rouge' },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={selection}
      onSelection={(i) => { setSelection(i); setErreurAction(''); }}
      actions={actions}
      avantTableau={erreurAction ? (
        <div className="cl-bandeau cl-bandeau--erreur" role="alert"><AlertTriangle size={16} />{erreurAction}</div>
      ) : null}
      filtres={(
        <>
          <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label={t('État')}>
            <option value="all">{t('Tous les états')}</option>
            {Object.entries(ETAT_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
          <select value={filtreGravite} onChange={(e) => setFiltreGravite(e.target.value)} aria-label={t('Gravité')}>
            <option value="all">{t('Toutes les gravités')}</option>
            {Object.entries(GRAVITE_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
        </>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvel incident')}
      onModifier={(i) => setFenetre({ ouverte: true, objet: i })}
      onSupprimer={async (i) => { await vehiculeIncidentService.remove(i.id); setSelection(null); await charger(); }}
      messageSuppression={() => t('Supprimer cet incident ? Cette action est irréversible.')}
      cleStockage="vehicule-incidents"
      nomExport="incidents-vehicules"
      vide={{ aucun: t('Aucun incident pour l’instant.'), aucunFiltre: t('Aucun incident ne correspond à ces filtres.') }}
    >
      <VehiculeIncidentModal
        isOpen={fenetre.ouverte}
        onClose={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        onSave={async (payload) => {
          if (fenetre.objet) await vehiculeIncidentService.update(fenetre.objet.id, payload);
          else await vehiculeIncidentService.create(payload);
          await charger();
        }}
        incident={fenetre.objet}
        isEditing={Boolean(fenetre.objet)}
      />
    </PageListe>
  );
}
