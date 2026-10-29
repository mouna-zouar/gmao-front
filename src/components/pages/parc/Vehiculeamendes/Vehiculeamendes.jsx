import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Calendar, Car, CheckCircle2, Clock, Coins, Loader2, Scale, Undo2, User } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeAmendeService from '../../../../services/Vehiculeamendeservice';
import { commePage, obtenirVehicules } from '../../../../store/referentiels';
import personnelService from '../../../../services/personnelService';
import VehiculeAmendeModal, { PaiementAmendeModal } from '../../../ui/modals/VehiculeAmendeModal';
import { ConfirmModal, PageListe } from '../../../commun';
import { TYPES_INFRACTION, STATUTS, ORIGINE, ltr } from '../../../../constants/Amendelibelles';
import { t, locale } from '../../../../i18n';
import '../VehiculeIncident/VehiculeIncidents.css';
import './Vehiculeamendes.css';

/*
 * Amendes (contraventions) des véhicules : page liste de la bibliothèque commune.
 * Le conducteur responsable est retrouvé d'après la mission en cours à la date de l'infraction.
 * Les fenêtres restent VehiculeAmendeModal (saisie du PV) et PaiementAmendeModal (paiement).
 */

const A_PAYER = 0, CONTESTEE = 1, PAYEE = 2, ANNULEE = 3;
const STATUT_META = {
  [A_PAYER]: { cls: 'a-payer', Icone: Clock },
  [CONTESTEE]: { cls: 'contestee', Icone: Scale },
  [PAYEE]: { cls: 'payee', Icone: CheckCircle2 },
  [ANNULEE]: { cls: 'annulee', Icone: Ban },
};

const formatDate = (iso, avecHeure = false) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};
const formatMontant = (v) => (v == null ? '—'
  : t('{montant} DT', { montant: Number(v).toLocaleString(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 }) }));
const typeLabel = (v) => (TYPES_INFRACTION[v] ? t(TYPES_INFRACTION[v]) : t('Type {n}', { n: v }));
const statutLabel = (v) => (STATUTS[v] ? t(STATUTS[v]) : t('Statut {n}', { n: v }));
const statutTexte = (a) => (a.enRetard ? `${statutLabel(a.statut)} (${t('en retard')})` : statutLabel(a.statut));
const nomPersonnel = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeAmendes() {
  const [amendes, setAmendes] = useState([]);
  const [vehicules, setVehicules] = useState({});
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [erreurAction, setErreurAction] = useState('');
  const [message, setMessage] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [filtreType, setFiltreType] = useState('all');
  const [selection, setSelection] = useState(null);
  const [formulaire, setFormulaire] = useState(null); // null | 'nouvelle' | 'modifier'
  const [paiement, setPaiement] = useState(false);
  const [action, setAction] = useState(false);
  const [confirmation, setConfirmation] = useState({ show: false });

  /* Le premier chargement affiche l'indicateur ; ensuite le tableau reste affiché pendant la mise à jour */
  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const [page, veh, pers] = await Promise.all([
        vehiculeAmendeService.getAll(0, 500),
        obtenirVehicules().then(commePage),
        personnelService.getAll(0, 500).catch(() => ({ content: [] })), // facultatif : sans lui, on affiche l'identifiant
      ]);
      const liste = page.content ?? [];
      setAmendes(liste);
      setSelection((s) => (s ? liste.find((a) => a.id === s.id) || null : null));
      setVehicules(Object.fromEntries((veh.content ?? []).map((v) => [v.id, v])));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les amendes. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const conducteurTexte = useCallback((a) => {
    const p = personnels[a.conducteurId];
    return p ? nomPersonnel(p) : (a.conducteurId != null ? t('Personnel #{id}', { id: a.conducteurId }) : '');
  }, [personnels]);

  const stats = useMemo(() => {
    const ouvertes = amendes.filter((a) => a.statut === A_PAYER || a.statut === CONTESTEE);
    return {
      aPayer: amendes.filter((a) => a.statut === A_PAYER).length,
      enRetard: amendes.filter((a) => a.enRetard).length,
      contestees: amendes.filter((a) => a.statut === CONTESTEE).length,
      reste: ouvertes.reduce((s, a) => s + (Number(a.montant) || 0), 0),
      paye: amendes.filter((a) => a.statut === PAYEE).reduce((s, a) => s + (Number(a.montantPaye ?? a.montant) || 0), 0),
    };
  }, [amendes]);

  const colonnes = useMemo(() => [
    {
      cle: 'num', label: 'N°', valeur: (a) => a.num || '', texte: (a) => [a.num, a.referencePv].filter(Boolean).join(' '),
      rendu: (a) => (
        <>
          <span className="vin-cell-main vam-num">{a.num || '—'}</span>
          {a.referencePv && <span className="vin-cell-sub">{t('PV {ref}', { ref: ltr(a.referencePv) })}</span>}
        </>
      ),
    },
    {
      cle: 'vehicule', label: 'Véhicule', valeur: (a) => vehicules[a.vehiculeId]?.matricule || '',
      texte: (a) => { const v = vehicules[a.vehiculeId]; return [v?.matricule, v?.marque].filter(Boolean).join(' '); },
      rendu: (a) => { const v = vehicules[a.vehiculeId]; return (
        <div className="vin-cell-vehicle">
          <div className="vin-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
          <div className="vin-cell-vehicle-text">
            <bdi className="vin-cell-main" dir="ltr">{v?.matricule || t('Véhicule #{id}', { id: a.vehiculeId })}</bdi>
            {v?.marque && <span className="vin-cell-sub">{v.marque}</span>}
          </div>
        </div>
      ); },
    },
    {
      cle: 'conducteur', label: 'Conducteur', valeur: conducteurTexte,
      rendu: (a) => {
        const nom = conducteurTexte(a);
        if (!nom) return <span className="vam-a-identifier">{t('À identifier')}</span>;
        const origine = a.origineConducteur === ORIGINE.MISSION
          ? (a.missionNum ? t('mission {num}', { num: ltr(a.missionNum) }) : t('mission à cette date'))
          : a.origineConducteur === ORIGINE.AFFECTATION ? t('dernier affecté') : t('saisi à la main');
        return (
          <div className="vin-cell-driver">
            <div className="vin-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
            <div className="vin-cell-vehicle-text">
              <span className="vin-cell-main">{nom}</span>
              <span className="vin-cell-sub">{origine}</span>
            </div>
          </div>
        );
      },
    },
    {
      cle: 'infraction', label: 'Infraction', valeur: (a) => typeLabel(a.type),
      texte: (a) => [typeLabel(a.type), a.lieu, a.commentaire].filter(Boolean).join(' '),
      rendu: (a) => (
        <>
          <span className="vin-tag">{typeLabel(a.type)}</span>
          {a.lieu && <span className="vin-cell-sub vam-lieu">{a.lieu}</span>}
        </>
      ),
    },
    {
      cle: 'date', label: 'Date', recherche: false,
      valeur: (a) => (a.dateInfraction ? new Date(a.dateInfraction).getTime() : 0), texte: (a) => formatDate(a.dateInfraction, true),
      rendu: (a) => <span className="vin-cell-date"><Calendar size={12} strokeWidth={2.5} />{formatDate(a.dateInfraction, true)}</span>,
    },
    {
      cle: 'montant', label: 'Montant', recherche: false, alignement: 'droite',
      valeur: (a) => Number(a.montant ?? -1), texte: (a) => formatMontant(a.montant),
      rendu: (a) => <span className="vin-cell-amount"><Coins size={13} strokeWidth={2.5} />{formatMontant(a.montant)}</span>,
    },
    {
      cle: 'echeance', label: 'À payer avant', recherche: false,
      valeur: (a) => (a.dateLimitePaiement ? new Date(a.dateLimitePaiement).getTime() : Number.MAX_SAFE_INTEGER),
      texte: (a) => formatDate(a.dateLimitePaiement),
      rendu: (a) => (a.dateLimitePaiement ? (
        <span className={`vam-echeance ${a.enRetard ? 'is-retard' : ''}`}>
          {a.enRetard && <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" />}
          {formatDate(a.dateLimitePaiement)}
          {a.enRetard && <span className="vam-retard">{t('En retard')}</span>}
        </span>
      ) : <span className="vin-cell-empty">—</span>),
    },
    {
      cle: 'statut', label: 'Statut', recherche: false, valeur: (a) => Number(a.statut ?? -1), texte: statutTexte,
      rendu: (a) => { const m = STATUT_META[a.statut] ?? STATUT_META[A_PAYER]; const Ic = m.Icone; return (
        <>
          <span className={`vam-statut vam-statut--${m.cls}`}><Ic size={12} strokeWidth={2.5} aria-hidden="true" />{statutLabel(a.statut)}</span>
          {a.statut === PAYEE && a.datePaiement && <span className="vin-cell-sub">{t('le {date}', { date: formatDate(a.datePaiement) })}</span>}
        </>
      ); },
    },
  ], [vehicules, conducteurTexte]);

  /* L'export et l'impression gardent les colonnes détaillées de l'écran d'origine */
  const colonnesExport = useMemo(() => [
    { label: 'N°', texte: (a) => a.num },
    { label: 'Véhicule', texte: (a) => vehicules[a.vehiculeId]?.matricule },
    { label: 'Conducteur', texte: conducteurTexte },
    { label: 'Infraction', texte: (a) => typeLabel(a.type) },
    { label: 'Lieu', texte: (a) => a.lieu },
    { label: 'Date', texte: (a) => formatDate(a.dateInfraction, true) },
    { label: 'N° du procès-verbal', texte: (a) => a.referencePv },
    { label: 'Montant (DT)', texte: (a) => a.montant },
    { label: 'À payer avant', texte: (a) => formatDate(a.dateLimitePaiement) },
    { label: 'Statut', texte: statutTexte },
    { label: 'Payée le', texte: (a) => formatDate(a.datePaiement) },
  ], [vehicules, conducteurTexte]);

  const basculer = (v) => setFiltreStatut((f) => (f === v ? 'all' : v));
  const lignes = amendes.filter((a) => (filtreStatut === 'all' || (filtreStatut === 'retard' ? a.enRetard : String(a.statut) === filtreStatut))
    && (filtreType === 'all' || String(a.type) === filtreType));

  /* ─── Actions ─── */
  const executer = async (fn, succes) => {
    if (action) return;
    setAction(true);
    setErreurAction('');
    setMessage('');
    try {
      const r = await fn();
      if (r) setSelection(r);
      setMessage(succes);
      await charger();
    } catch (err) {
      setErreurAction(err?.response?.data?.message || t("L'action a échoué."));
    } finally {
      setAction(false);
    }
  };
  const changerStatut = (a, statut, succes) => executer(() => vehiculeAmendeService.changerStatut(a.id, statut), succes);
  const annulerAmende = (a) => setConfirmation({
    show: true,
    type: 'warning',
    title: t("Annuler l'amende"),
    message: t('Classer l’amende {num} sans suite (contestation acceptée, erreur de PV…) ?', { num: a.num || '' }),
    confirmText: t("Annuler l'amende"),
    onConfirm: () => { setConfirmation({ show: false }); changerStatut(a, ANNULEE, t('Amende annulée.')); },
  });

  const listeVehicules = useMemo(() => Object.values(vehicules), [vehicules]);
  const listePersonnels = useMemo(() => Object.values(personnels), [personnels]);
  const s = selection;
  const ouverte = s && (s.statut === A_PAYER || s.statut === CONTESTEE);
  const actions = s ? [
    ouverte && { label: t('Payer'), icone: CheckCircle2, classe: 'cl-action--vert', besoinSelection: true, desactive: action, onClick: () => setPaiement(true) },
    s.statut === A_PAYER && {
      label: t('Contester'), icone: Scale, classe: 'cl-action--bleu', besoinSelection: true, desactive: action,
      onClick: (a) => changerStatut(a, CONTESTEE, t('Amende marquée comme contestée.')),
    },
    ouverte && { label: t("Annuler l'amende"), icone: Ban, classe: 'cl-action--orange', besoinSelection: true, desactive: action, onClick: annulerAmende },
    s.statut !== A_PAYER && {
      label: t('Remettre à payer'), icone: action ? Loader2 : Undo2, besoinSelection: true, desactive: action,
      onClick: (a) => changerStatut(a, A_PAYER, t('Amende remise à payer.')),
    },
  ].filter(Boolean) : [];

  const enregistrer = async (payload) => {
    const modification = formulaire === 'modifier' && s;
    const r = modification ? await vehiculeAmendeService.update(s.id, payload) : await vehiculeAmendeService.create(payload);
    setSelection(r);
    setMessage(modification ? t('Amende {num} enregistrée.', { num: r.num || '' }) : t('Amende {num} créée.', { num: r.num || '' }));
    await charger();
  };

  return (
    <PageListe
      classe="vam-page"
      icone={ICONES_MODULES.amendes}
      titre={t('Amendes véhicules')}
      sousTitre={t('Contraventions du parc : qui conduisait, et suivi du paiement')}
      stats={[
        { label: t('Total'), valeur: amendes.length, actif: filtreStatut === 'all', onClick: () => setFiltreStatut('all') },
        { label: t('À payer'), valeur: stats.aPayer, ton: 'ambre', icone: Clock, actif: filtreStatut === '0', onClick: () => basculer('0') },
        { label: t('En retard'), valeur: stats.enRetard, ton: 'rouge', icone: AlertTriangle, alerte: stats.enRetard > 0, actif: filtreStatut === 'retard', onClick: () => basculer('retard') },
        { label: t('Contestées'), valeur: stats.contestees, ton: 'bleu', icone: Scale, actif: filtreStatut === '1', onClick: () => basculer('1') },
        { label: t('Reste à régler'), valeur: formatMontant(stats.reste), ton: 'orange' },
        { label: t('Payé'), valeur: formatMontant(stats.paye), ton: 'vert' },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      triInitial={{ cle: 'date', sens: 'desc' }}
      selection={selection}
      onSelection={(a) => { setSelection(a); setErreurAction(''); }}
      actions={actions}
      recherchePlaceholder={t('N°, PV, véhicule, conducteur, lieu…')}
      avantTableau={(erreurAction || message) ? (erreurAction
        ? <div className="cl-bandeau cl-bandeau--erreur" role="alert"><AlertTriangle size={16} />{erreurAction}</div>
        : <div className="cl-bandeau cl-bandeau--succes" role="status"><CheckCircle2 size={18} strokeWidth={2.5} /><span>{message}</span></div>
      ) : null}
      filtres={(
        <>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label={t('Statut')}>
            <option value="all">{t('Tous les statuts')}</option>
            <option value="retard">{t('En retard de paiement')}</option>
            {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} aria-label={t("Type d'infraction")}>
            <option value="all">{t('Tous les types')}</option>
            {Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </select>
        </>
      )}
      colonnesExport={colonnesExport}
      filtresImpression={[
        { label: t('Statut'), valeur: filtreStatut === 'retard' ? t('En retard') : filtreStatut !== 'all' ? statutLabel(Number(filtreStatut)) : '' },
        { label: t("Type d'infraction"), valeur: filtreType !== 'all' ? typeLabel(Number(filtreType)) : '' },
      ]}
      onAjouter={() => { setSelection(null); setFormulaire('nouvelle'); }}
      libelleAjouter={t('Nouvelle amende')}
      onModifier={(a) => { setSelection(a); setFormulaire('modifier'); }}
      onSupprimer={async (a) => {
        await vehiculeAmendeService.remove(a.id);
        setSelection(null);
        setMessage(t('Amende supprimée.'));
        await charger();
      }}
      messageSuppression={(a) => t('Supprimer l’amende {num} ? Cette action est irréversible.', { num: a.num || '' })}
      cleStockage="vehicule-amendes"
      nomExport="amendes-vehicules"
      vide={{ aucun: t('Aucune amende pour l’instant.'), aucunFiltre: t('Aucune amende ne correspond à ces filtres.') }}
    >
      <VehiculeAmendeModal
        isOpen={Boolean(formulaire)}
        onClose={() => setFormulaire(null)}
        onSave={enregistrer}
        amende={formulaire === 'modifier' ? s : null}
        vehicules={listeVehicules}
        personnels={listePersonnels}
      />
      {paiement && s && (
        <PaiementAmendeModal
          amende={s}
          vehicule={vehicules[s.vehiculeId]}
          onClose={() => setPaiement(false)}
          onPayer={async (p) => {
            const r = await vehiculeAmendeService.payer(s.id, p);
            setSelection(r);
            setMessage(t('Paiement de l’amende {num} enregistré.', { num: r.num || '' }));
            await charger();
          }}
        />
      )}
      <ConfirmModal
        show={confirmation.show}
        onClose={() => setConfirmation({ show: false })}
        onConfirm={confirmation.onConfirm}
        type={confirmation.type}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
      />
    </PageListe>
  );
}
