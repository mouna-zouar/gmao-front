import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Car, Coins, Gauge, User } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeBonCarburantService from '../../../../services/vehiculeBonCarburantService';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeBonCarburantModal from '../../../ui/modals/VehiculeBonCarburantModal';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './VehiculeBonsCarburant.css';

/*
 * Bons carburant : page liste de la bibliothèque commune.
 * La fenêtre reste VehiculeBonCarburantModal (contrôles du kilométrage et du montant).
 */

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatMontant = (m) => (m == null ? '—' : t('{montant} DT', {
  montant: Number(m).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}));
const formatKm = (k) => (k == null ? '—' : t('{n} km', { n: Number(k).toLocaleString(locale()) }));
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeBonsCarburant() {
  const [bons, setBons] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreVehicule, setFiltreVehicule] = useState('all');
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [page, veh, pers] = await Promise.all([
        vehiculeBonCarburantService.getAll(0, 500), obtenirVehicules().then(commePage), personnelService.getAll(0, 500),
      ]);
      setBons(page.content ?? []);
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les bons carburant. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo(() => [
    {
      cle: 'vehicule', label: 'Véhicule',
      valeur: (b) => { const v = vehicules[b.vehiculeId]; return [v?.matricule, v?.marque].filter(Boolean).join(' '); },
      rendu: (b) => { const v = vehicules[b.vehiculeId]; return (
        <div className="vbc-cell-vehicle">
          <div className="vbc-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vbc-cell-vehicle-text">
            <span className="vbc-cell-main">{v?.matricule || t('Véhicule #{id}', { id: b.vehiculeId })}</span>
            {v?.marque && <span className="vbc-cell-sub">{v.marque}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur',
      valeur: (b) => { const p = personnels[b.personnelId]; return [p?.nom, p?.prenom, p?.matricule].filter(Boolean).join(' '); },
      rendu: (b) => { const p = personnels[b.personnelId]; return p ? (
        <div className="vbc-cell-driver">
          <div className="vbc-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
          <div className="vbc-cell-driver-text">
            <span className="vbc-cell-main">{nomPersonne(p)}</span>
            {p.matricule && <span className="vbc-cell-sub">{p.matricule}</span>}
          </div>
        </div>
      ) : <span className="vbc-cell-empty">—</span>; },
    },
    {
      cle: 'date', label: 'Date', recherche: false,
      valeur: (b) => (b.date ? new Date(b.date).getTime() : 0), texte: (b) => formatDate(b.date),
      rendu: (b) => <span className="vbc-cell-date"><Calendar size={12} strokeWidth={2.5} />{formatDate(b.date)}</span>,
    },
    {
      cle: 'montant', label: 'Montant', recherche: false, alignement: 'droite', valeur: (b) => Number(b.montant ?? 0), texte: (b) => formatMontant(b.montant),
      rendu: (b) => <span className="vbc-cell-amount"><Coins size={13} strokeWidth={2.5} />{formatMontant(b.montant)}</span>,
    },
    {
      cle: 'kilometrage', label: 'Kilométrage', recherche: false, alignement: 'droite', valeur: (b) => Number(b.kilometrage ?? 0), texte: (b) => formatKm(b.kilometrage),
      rendu: (b) => <span className="vbc-cell-km"><Gauge size={13} strokeWidth={2.5} />{formatKm(b.kilometrage)}</span>,
    },
  ], [vehicules, personnels]);

  const lignes = filtreVehicule === 'all' ? bons : bons.filter((b) => String(b.vehiculeId) === filtreVehicule);

  const stats = useMemo(() => {
    const maintenant = new Date();
    const duMois = (b) => { const d = new Date(b.date); return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear(); };
    const somme = (liste, cle) => liste.reduce((s, b) => s + (Number(b[cle]) || 0), 0);
    return {
      montantTotal: somme(bons, 'montant'),
      montantMois: somme(bons.filter(duMois), 'montant'),
      kmTotal: somme(bons, 'kilometrage'),
    };
  }, [bons]);

  const vehiculesTries = Object.values(vehicules).sort((a, b) => String(a.matricule || '').localeCompare(String(b.matricule || '')));

  return (
    <PageListe
      icone={ICONES_MODULES.carburant}
      titre={t('Bons carburant')}
      sousTitre={t('Suivi des pleins de carburant par véhicule et conducteur')}
      stats={[
        { label: t('Total'), valeur: bons.length },
        { label: t('Montant'), valeur: formatMontant(stats.montantTotal), ton: 'bleu' },
        { label: t('Ce mois'), valeur: formatMontant(stats.montantMois), ton: 'vert' },
        { label: t('km cumulés'), valeur: Number(stats.kmTotal).toLocaleString(locale()), ton: 'orange' },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      filtres={(
        <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} aria-label={t('Véhicule')}>
          <option value="all">{t('Tous les véhicules')}</option>
          {vehiculesTries.map((v) => <option key={v.id} value={v.id}>{v.matricule || t('Véhicule #{id}', { id: v.id })}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouveau bon')}
      onModifier={(b) => setFenetre({ ouverte: true, objet: b })}
      onSupprimer={async (b) => { await vehiculeBonCarburantService.remove(b.id); await charger(); }}
      messageSuppression={() => t('Supprimer ce bon carburant ? Cette action est irréversible.')}
      cleStockage="vehicule-bons-carburant"
      nomExport="bons-carburant"
      vide={{ aucun: t('Aucun bon carburant pour l’instant.'), aucunFiltre: t('Aucun bon carburant ne correspond à ces filtres.') }}
    >
      <VehiculeBonCarburantModal
        isOpen={fenetre.ouverte}
        onClose={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        onSave={async (payload) => {
          if (fenetre.objet) await vehiculeBonCarburantService.update(fenetre.objet.id, payload);
          else await vehiculeBonCarburantService.create(payload);
          await charger();
        }}
        bonCarburant={fenetre.objet}
        isEditing={Boolean(fenetre.objet)}
      />
    </PageListe>
  );
}
