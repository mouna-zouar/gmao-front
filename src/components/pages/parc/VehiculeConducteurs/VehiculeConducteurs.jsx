import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Car, Settings2, User } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeConducteurService from '../../../../services/vehiculeConducteurService';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeConducteurModal from '../../../ui/modals/VehiculeConducteurModal';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './VehiculeConducteurs.css';

/*
 * Affectations véhicule / conducteur : page liste de la bibliothèque commune.
 * La fenêtre reste VehiculeConducteurModal (contrôle du permis du conducteur selon la catégorie du véhicule).
 */

const MODES = { 0: 'Principal', 1: 'Secondaire', 2: 'Temporaire', 3: 'Remplacement' };
const CLASSES_MODE = { 0: 'principal', 1: 'secondary', 2: 'temporary', 3: 'replacement' };
const modeLabel = (m) => (MODES[m] ? t(MODES[m]) : t('Mode {n}', { n: m }));
const dateHeure = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeConducteurs() {
  const [affectations, setAffectations] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreMode, setFiltreMode] = useState('all');
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [page, veh, pers] = await Promise.all([
        vehiculeConducteurService.getAll(0, 500), obtenirVehicules().then(commePage), personnelService.getAll(0, 500),
      ]);
      setAffectations(page.content ?? []);
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les affectations. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo(() => [
    {
      cle: 'vehicule', label: 'Véhicule',
      valeur: (a) => { const v = vehicules[a.vehiculeId]; return [v?.matricule, v?.marque, v?.numChassis].filter(Boolean).join(' '); },
      rendu: (a) => { const v = vehicules[a.vehiculeId]; return (
        <div className="vcd-cell-vehicle">
          <div className="vcd-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vcd-cell-vehicle-text">
            <span className="vcd-cell-main">{v?.matricule || t('Véhicule #{id}', { id: a.vehiculeId })}</span>
            {v?.marque && <span className="vcd-cell-sub">{v.marque}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur',
      valeur: (a) => { const p = personnels[a.personnelId]; return [p?.nom, p?.prenom, p?.matricule].filter(Boolean).join(' '); },
      rendu: (a) => { const p = personnels[a.personnelId]; return p ? (
        <div className="vcd-cell-driver">
          <div className="vcd-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
          <div className="vcd-cell-driver-text">
            <span className="vcd-cell-main">{nomPersonne(p)}</span>
            {p.matricule && <span className="vcd-cell-sub">{p.matricule}</span>}
          </div>
        </div>
      ) : <span className="vcd-cell-empty">—</span>; },
    },
    {
      cle: 'date', label: "Date d'affectation", recherche: false,
      valeur: (a) => (a.dateAffectation ? new Date(a.dateAffectation).getTime() : 0),
      texte: (a) => dateHeure(a.dateAffectation),
      rendu: (a) => <span className="vcd-date-badge"><Calendar size={11} strokeWidth={2.5} />{dateHeure(a.dateAffectation)}</span>,
    },
    {
      cle: 'mode', label: 'Mode', recherche: false, valeur: (a) => modeLabel(a.modeAffectation),
      rendu: (a) => <span className={`vcd-pill ${CLASSES_MODE[Number(a.modeAffectation)] || 'replacement'}`}><Settings2 size={11} strokeWidth={2.5} />{modeLabel(a.modeAffectation)}</span>,
    },
  ], [vehicules, personnels]);

  const lignes = filtreMode === 'all' ? affectations : affectations.filter((a) => String(a.modeAffectation) === filtreMode);
  const compte = (m) => affectations.filter((a) => a.modeAffectation === m).length;
  const basculer = (v) => setFiltreMode((f) => (f === v ? 'all' : v));

  return (
    <PageListe
      icone={ICONES_MODULES.conducteurs}
      titre={t('Véhicules / Conducteurs')}
      sousTitre={t('Historique des affectations de conducteurs aux véhicules')}
      stats={[
        { label: t('Total'), valeur: affectations.length, actif: filtreMode === 'all', onClick: () => setFiltreMode('all') },
        { label: t('Principaux'), valeur: compte(0), ton: 'vert', actif: filtreMode === '0', onClick: () => basculer('0') },
        { label: t('Temporaires'), valeur: compte(2), ton: 'bleu', actif: filtreMode === '2', onClick: () => basculer('2') },
        { label: t('Remplacements'), valeur: compte(3), ton: 'orange', actif: filtreMode === '3', onClick: () => basculer('3') },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      filtres={(
        <select value={filtreMode} onChange={(e) => setFiltreMode(e.target.value)} aria-label={t('Mode')}>
          <option value="all">{t('Tous les modes')}</option>
          {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvelle affectation')}
      onModifier={(a) => setFenetre({ ouverte: true, objet: a })}
      onSupprimer={async (a) => { await vehiculeConducteurService.remove(a.id); await charger(); }}
      messageSuppression={() => t('Supprimer cette affectation véhicule / conducteur ? Cette action est irréversible.')}
      cleStockage="vehicule-conducteurs"
      nomExport="affectations-conducteurs"
      vide={{ aucun: t('Aucune affectation pour l’instant.'), aucunFiltre: t('Aucune affectation ne correspond à ces filtres.') }}
    >
      <VehiculeConducteurModal
        isOpen={fenetre.ouverte}
        onClose={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        onSave={async (payload) => {
          if (fenetre.objet) await vehiculeConducteurService.update(fenetre.objet.id, payload);
          else await vehiculeConducteurService.create(payload);
          await charger();
        }}
        vehiculeConducteur={fenetre.objet}
        isEditing={Boolean(fenetre.objet)}
      />
    </PageListe>
  );
}
