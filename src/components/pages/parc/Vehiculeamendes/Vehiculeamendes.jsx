import { useEffect, useMemo, useState } from 'react';
import {
  Receipt, Plus, Pencil, Trash2, Search, Filter, RotateCcw, Download, Printer, Loader2,
  Car, User, Calendar, Coins, AlertTriangle, CheckCircle2, Scale, Ban, Undo2, Clock,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import vehiculeAmendeService from '../../../../services/Vehiculeamendeservice';
import vehiculeService from '../../../../services/vehiculeService';
import personnelService from '../../../../services/personnelService';
import VehiculeAmendeModal, { PaiementAmendeModal } from '../../../ui/modals/VehiculeAmendeModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../../../ui/modals/ColumnSettingsModal';
import { TYPES_INFRACTION, STATUTS, ORIGINE, ltr } from '../../../../constants/Amendelibelles';
import { t, tp, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import '../VehiculeIncident/VehiculeIncidents.css';
import './VehiculeAmendes.css';

/*
 * Amendes (contraventions) des véhicules : saisie du PV, conducteur responsable retrouvé
 * d'après la mission en cours à la date de l'infraction, suivi du paiement.
 */

const A_PAYER = 0, CONTESTEE = 1, PAYEE = 2, ANNULEE = 3;

const STATUT_META = {
  [A_PAYER]: { cls: 'a-payer', Icon: Clock },
  [CONTESTEE]: { cls: 'contestee', Icon: Scale },
  [PAYEE]: { cls: 'payee', Icon: CheckCircle2 },
  [ANNULEE]: { cls: 'annulee', Icon: Ban },
};

const COLONNES_DEFAUT = [
  { key: 'num', label: 'N°', visible: true, searchable: true },
  { key: 'vehicule', label: 'Véhicule', visible: true, searchable: true },
  { key: 'conducteur', label: 'Conducteur', visible: true, searchable: true },
  { key: 'infraction', label: 'Infraction', visible: true, searchable: true },
  { key: 'date', label: 'Date', visible: true, searchable: false },
  { key: 'montant', label: 'Montant', visible: true, searchable: false },
  { key: 'echeance', label: 'À payer avant', visible: true, searchable: false },
  { key: 'statut', label: 'Statut', visible: true, searchable: false },
];

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
const nomPersonnel = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function VehiculeAmendes() {
  const [amendes, setAmendes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [filtreType, setFiltreType] = useState('all');
  const [tri, setTri] = useState({ colonne: 'date', sens: 'desc' });

  const [colonnes, setColonnes] = useState(COLONNES_DEFAUT);
  const [reglagesColonnes, setReglagesColonnes] = useState(false);

  const [vehicules, setVehicules] = useState([]);
  const [personnels, setPersonnels] = useState([]);

  const [selection, setSelection] = useState(null);
  const [formulaire, setFormulaire] = useState(null); // null | 'nouvelle' | 'modifier'
  const [paiement, setPaiement] = useState(false);
  const [action, setAction] = useState(false);
  const [confirmation, setConfirmation] = useState({ show: false });

  const vehiculesParId = useMemo(() => Object.fromEntries(vehicules.map((v) => [v.id, v])), [vehicules]);
  const personnelsParId = useMemo(() => Object.fromEntries(personnels.map((p) => [p.id, p])), [personnels]);

  // Amendes, véhicules et personnel (le personnel est facultatif : sans lui, on affiche l'identifiant)
  const lireDonnees = () => Promise.all([
    vehiculeAmendeService.getAll(0, 500),
    vehiculeService.getAll(0, 500),
    personnelService.getAll(0, 500).catch(() => ({ content: [] })),
  ]);
  const appliquer = ([page, veh, pers]) => {
    setAmendes(page.content ?? []);
    setVehicules(veh.content ?? []);
    setPersonnels(pers.content ?? []);
  };
  const echec = (err) => {
    console.error(err);
    setErreur(t('Impossible de charger les amendes. Vérifie que le serveur est bien lancé.'));
  };

  // Rechargement après une action : le tableau reste affiché pendant la mise à jour
  const charger = async () => {
    setErreur('');
    try { appliquer(await lireDonnees()); } catch (err) { echec(err); }
  };

  // Premier chargement (l'indicateur est déjà affiché)
  useEffect(() => {
    let actif = true;
    lireDonnees()
      .then((d) => { if (actif) appliquer(d); })
      .catch((err) => { if (actif) echec(err); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, []);

  // La sélection suit la liste rechargée
  const selectionAJour = selection ? amendes.find((a) => a.id === selection.id) ?? null : null;

  const stats = useMemo(() => {
    const ouvertes = amendes.filter((a) => a.statut === A_PAYER || a.statut === CONTESTEE);
    return {
      total: amendes.length,
      aPayer: amendes.filter((a) => a.statut === A_PAYER).length,
      enRetard: amendes.filter((a) => a.enRetard).length,
      contestees: amendes.filter((a) => a.statut === CONTESTEE).length,
      reste: ouvertes.reduce((s, a) => s + (Number(a.montant) || 0), 0),
      paye: amendes.filter((a) => a.statut === PAYEE).reduce((s, a) => s + (Number(a.montantPaye ?? a.montant) || 0), 0),
    };
  }, [amendes]);

  const conducteurTexte = (a) => {
    const p = personnelsParId[a.conducteurId];
    return p ? nomPersonnel(p) : (a.conducteurId != null ? t('Personnel #{id}', { id: a.conducteurId }) : '');
  };

  const valeurRecherche = (a, cle) => {
    const v = vehiculesParId[a.vehiculeId];
    switch (cle) {
      case 'num': return [a.num, a.referencePv].filter(Boolean).join(' ');
      case 'vehicule': return [v?.matricule, v?.marque].filter(Boolean).join(' ');
      case 'conducteur': return conducteurTexte(a);
      case 'infraction': return [typeLabel(a.type), a.lieu, a.commentaire].filter(Boolean).join(' ');
      default: return '';
    }
  };

  const valeurTri = (a, cle) => {
    switch (cle) {
      case 'num': return a.num || '';
      case 'vehicule': return vehiculesParId[a.vehiculeId]?.matricule || '';
      case 'conducteur': return conducteurTexte(a);
      case 'infraction': return typeLabel(a.type);
      case 'date': return a.dateInfraction ? new Date(a.dateInfraction).getTime() : 0;
      case 'montant': return Number(a.montant ?? -1);
      case 'echeance': return a.dateLimitePaiement ? new Date(a.dateLimitePaiement).getTime() : Number.MAX_SAFE_INTEGER;
      case 'statut': return Number(a.statut ?? -1);
      default: return '';
    }
  };

  const filtrees = useMemo(() => {
    const cherchables = colonnes.filter((c) => c.searchable).map((c) => c.key);
    const terme = recherche.trim().toLowerCase();
    const liste = amendes.filter((a) => {
      const okRecherche = !terme || cherchables.some((k) => valeurRecherche(a, k).toLowerCase().includes(terme));
      const okStatut = filtreStatut === 'all' || (filtreStatut === 'retard' ? a.enRetard : String(a.statut) === filtreStatut);
      const okType = filtreType === 'all' || String(a.type) === filtreType;
      return okRecherche && okStatut && okType;
    });
    const triee = [...liste].sort((x, y) => {
      const vx = valeurTri(x, tri.colonne), vy = valeurTri(y, tri.colonne);
      return typeof vx === 'string' ? vx.localeCompare(vy, locale(), { sensitivity: 'base', numeric: true }) : vx - vy;
    });
    return tri.sens === 'desc' ? triee.reverse() : triee;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendes, recherche, filtreStatut, filtreType, colonnes, tri, vehiculesParId, personnelsParId]);

  const trier = (colonne) => setTri((t0) => (t0.colonne === colonne
    ? { colonne, sens: t0.sens === 'asc' ? 'desc' : 'asc' }
    : { colonne, sens: 'asc' }));

  const iconeTri = (colonne) => {
    if (tri.colonne !== colonne) return <ArrowUpDown size={13} className="vin-sort-icon" />;
    return tri.sens === 'asc' ? <ArrowUp size={13} className="vin-sort-icon active" /> : <ArrowDown size={13} className="vin-sort-icon active" />;
  };

  // ─── Actions ───

  const enregistrer = async (payload) => {
    const resultat = formulaire === 'modifier' && selectionAJour
      ? await vehiculeAmendeService.update(selectionAJour.id, payload)
      : await vehiculeAmendeService.create(payload);
    setSelection(resultat);
    setMessage(formulaire === 'modifier'
      ? t('Amende {num} enregistrée.', { num: resultat.num || '' })
      : t('Amende {num} créée.', { num: resultat.num || '' }));
    await charger();
  };

  const executer = async (fn, succes) => {
    if (action) return;
    setAction(true);
    setErreur('');
    try {
      const r = await fn();
      if (r) setSelection(r);
      setMessage(succes);
      await charger();
    } catch (err) {
      setErreur(err?.response?.data?.message || t("L'action a échoué."));
    } finally {
      setAction(false);
    }
  };

  const changerStatut = (statut, succes) => {
    if (!selectionAJour) return;
    executer(() => vehiculeAmendeService.changerStatut(selectionAJour.id, statut), succes);
  };

  const supprimer = () => {
    if (!selectionAJour) return;
    setConfirmation({
      show: true,
      type: 'danger',
      title: t("Supprimer l'amende"),
      message: t('Supprimer l’amende {num} ? Cette action est irréversible.', { num: selectionAJour.num || '' }),
      confirmText: t('Supprimer'),
      onConfirm: async () => {
        setConfirmation({ show: false });
        await executer(async () => { await vehiculeAmendeService.remove(selectionAJour.id); setSelection(null); return null; }, t('Amende supprimée.'));
      },
    });
  };

  const annulerAmende = () => {
    if (!selectionAJour) return;
    setConfirmation({
      show: true,
      type: 'warning',
      title: t("Annuler l'amende"),
      message: t('Classer l’amende {num} sans suite (contestation acceptée, erreur de PV…) ?', { num: selectionAJour.num || '' }),
      confirmText: t("Annuler l'amende"),
      onConfirm: () => { setConfirmation({ show: false }); changerStatut(ANNULEE, t('Amende annulée.')); },
    });
  };

  // ─── Export / impression ───

  const donneesTableau = () => {
    const entetes = ['N°', 'Véhicule', 'Conducteur', 'Infraction', 'Lieu', 'Date', 'N° du procès-verbal', 'Montant (DT)', 'À payer avant', 'Statut', 'Payée le']
      .map((e) => t(e));
    const lignes = filtrees.map((a) => [
      a.num || '—',
      vehiculesParId[a.vehiculeId]?.matricule || '—',
      conducteurTexte(a) || '—',
      typeLabel(a.type),
      a.lieu || '—',
      formatDate(a.dateInfraction, true),
      a.referencePv || '—',
      a.montant ?? '—',
      formatDate(a.dateLimitePaiement),
      a.enRetard ? `${statutLabel(a.statut)} (${t('en retard')})` : statutLabel(a.statut),
      formatDate(a.datePaiement),
    ]);
    return { entetes, lignes };
  };

  const exporterCsv = () => {
    const { entetes, lignes } = donneesTableau();
    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `amendes-vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const imprimer = () => {
    const { entetes, lignes } = donneesTableau();
    imprimerListe({
      titre: t('Amendes véhicules'),
      colonnes: entetes,
      lignes,
      filtres: [
        { label: t('Recherche'), valeur: recherche.trim() },
        { label: t('Statut'), valeur: filtreStatut === 'retard' ? t('En retard') : filtreStatut !== 'all' ? statutLabel(Number(filtreStatut)) : '' },
        { label: t("Type d'infraction"), valeur: filtreType !== 'all' ? typeLabel(Number(filtreType)) : '' },
      ],
    });
  };

  // ─── Cellules ───

  const cellule = (cle, a) => {
    const v = vehiculesParId[a.vehiculeId];
    switch (cle) {
      case 'num':
        return (
          <td key="num">
            <span className="vin-cell-main vam-num">{a.num || '—'}</span>
            {a.referencePv && <span className="vin-cell-sub">{t('PV {ref}', { ref: ltr(a.referencePv) })}</span>}
          </td>
        );
      case 'vehicule':
        return (
          <td key="vehicule">
            <div className="vin-cell-vehicle">
              <div className="vin-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
              <div className="vin-cell-vehicle-text">
                <bdi className="vin-cell-main" dir="ltr">{v?.matricule || t('Véhicule #{id}', { id: a.vehiculeId })}</bdi>
                {v?.marque && <span className="vin-cell-sub">{v.marque}</span>}
              </div>
            </div>
          </td>
        );
      case 'conducteur': {
        const nom = conducteurTexte(a);
        const origine = a.origineConducteur === ORIGINE.MISSION
          ? (a.missionNum ? t('mission {num}', { num: ltr(a.missionNum) }) : t('mission à cette date'))
          : a.origineConducteur === ORIGINE.AFFECTATION ? t('dernier affecté') : t('saisi à la main');
        return (
          <td key="conducteur">
            {nom ? (
              <div className="vin-cell-driver">
                <div className="vin-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
                <div className="vin-cell-vehicle-text">
                  <span className="vin-cell-main">{nom}</span>
                  <span className="vin-cell-sub">{origine}</span>
                </div>
              </div>
            ) : (
              <span className="vam-a-identifier">{t('À identifier')}</span>
            )}
          </td>
        );
      }
      case 'infraction':
        return (
          <td key="infraction">
            <span className="vin-tag">{typeLabel(a.type)}</span>
            {a.lieu && <span className="vin-cell-sub vam-lieu">{a.lieu}</span>}
          </td>
        );
      case 'date':
        return (
          <td key="date">
            <span className="vin-cell-date"><Calendar size={12} strokeWidth={2.5} />{formatDate(a.dateInfraction, true)}</span>
          </td>
        );
      case 'montant':
        return (
          <td key="montant">
            <span className="vin-cell-amount"><Coins size={13} strokeWidth={2.5} />{formatMontant(a.montant)}</span>
          </td>
        );
      case 'echeance':
        return (
          <td key="echeance">
            {a.dateLimitePaiement ? (
              <span className={`vam-echeance ${a.enRetard ? 'is-retard' : ''}`}>
                {a.enRetard && <AlertTriangle size={12} strokeWidth={2.5} aria-hidden="true" />}
                {formatDate(a.dateLimitePaiement)}
                {a.enRetard && <span className="vam-retard">{t('En retard')}</span>}
              </span>
            ) : <span className="vin-cell-empty">—</span>}
          </td>
        );
      case 'statut': {
        const meta = STATUT_META[a.statut] ?? STATUT_META[A_PAYER];
        const Icone = meta.Icon;
        return (
          <td key="statut">
            <span className={`vam-statut vam-statut--${meta.cls}`}><Icone size={12} strokeWidth={2.5} aria-hidden="true" />{statutLabel(a.statut)}</span>
            {a.statut === PAYEE && a.datePaiement && <span className="vin-cell-sub">{t('le {date}', { date: formatDate(a.datePaiement) })}</span>}
          </td>
        );
      }
      default:
        return null;
    }
  };

  const visibles = colonnes.filter((c) => c.visible);
  const s = selectionAJour;
  const ouverte = s && (s.statut === A_PAYER || s.statut === CONTESTEE);

  return (
    <div className="vin-container vam-page">
      {/* EN-TÊTE */}
      <div className="vin-header-card">
        <div className="vin-header-left">
          <button type="button" className="vin-header-icon-wrap vin-header-icon-btn" onClick={() => setReglagesColonnes(true)}
            title={t('Paramètres des colonnes')} aria-label={t('Paramètres des colonnes')}>
            <ICONES_MODULES.amendes size={24} strokeWidth={2} />
          </button>
          <div>
            <h2>{t('Amendes véhicules')}</h2>
            <p className="vin-header-subtitle">{t('Contraventions du parc : qui conduisait, et suivi du paiement')}</p>
          </div>
        </div>
        <div className="vin-stats">
          <div className="vin-stat"><span className="vin-stat-value">{stats.total}</span><span className="vin-stat-label">{t('Total')}</span></div>
          <div className="vin-stat stat-declared"><span className="vin-stat-value">{stats.aPayer}</span><span className="vin-stat-label">{t('À payer')}</span></div>
          <div className="vin-stat vam-stat-retard"><span className="vin-stat-value">{stats.enRetard}</span><span className="vin-stat-label">{t('En retard')}</span></div>
          <div className="vin-stat stat-progress"><span className="vin-stat-value">{stats.contestees}</span><span className="vin-stat-label">{t('Contestées')}</span></div>
          <div className="vin-stat stat-cost"><span className="vin-stat-value">{formatMontant(stats.reste)}</span><span className="vin-stat-label">{t('Reste à régler')}</span></div>
          <div className="vin-stat stat-resolved"><span className="vin-stat-value">{formatMontant(stats.paye)}</span><span className="vin-stat-label">{t('Payé')}</span></div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="vin-actions-bar">
        <button type="button" className="vin-action-btn ajouter" onClick={() => { setSelection(null); setFormulaire('nouvelle'); }}>
          <Plus size={18} strokeWidth={2.5} /><span>{t('Nouvelle amende')}</span>
        </button>
        <button type="button" className={`vin-action-btn modifier ${!s ? 'disabled' : ''}`} disabled={!s} onClick={() => setFormulaire('modifier')}>
          <Pencil size={18} strokeWidth={2.2} /><span>{t('Modifier')}</span>
        </button>
        <button type="button" className={`vin-action-btn supprimer ${!s || action ? 'disabled' : ''}`} disabled={!s || action} onClick={supprimer}>
          <Trash2 size={18} strokeWidth={2.2} /><span>{t('Supprimer')}</span>
        </button>

        {s && (
          <>
            <span className="vin-actions-sep" aria-hidden="true" />
            {ouverte && (
              <button type="button" className="vin-action-btn vam-action vam-action--payer" disabled={action} onClick={() => setPaiement(true)}>
                <CheckCircle2 size={16} strokeWidth={2.4} /><span>{t('Payer')}</span>
              </button>
            )}
            {s.statut === A_PAYER && (
              <button type="button" className="vin-action-btn vam-action vam-action--contester" disabled={action}
                onClick={() => changerStatut(CONTESTEE, t('Amende marquée comme contestée.'))}>
                <Scale size={16} strokeWidth={2.4} /><span>{t('Contester')}</span>
              </button>
            )}
            {ouverte && (
              <button type="button" className="vin-action-btn vam-action vam-action--annuler" disabled={action} onClick={annulerAmende}>
                <Ban size={16} strokeWidth={2.4} /><span>{t("Annuler l'amende")}</span>
              </button>
            )}
            {s.statut !== A_PAYER && (
              <button type="button" className="vin-action-btn vam-action" disabled={action}
                onClick={() => changerStatut(A_PAYER, t('Amende remise à payer.'))}>
                {action ? <Loader2 size={16} className="vin-spin" /> : <Undo2 size={16} strokeWidth={2.4} />}<span>{t('Remettre à payer')}</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* FILTRES */}
      <div className="vin-filter-panel">
        <div className="vin-filter-group">
          <label className="vin-filter-label" htmlFor="vam-recherche"><Search size={14} strokeWidth={2.5} />{t('Recherche')}</label>
          <div className="vin-filter-input-wrap">
            <Search size={16} strokeWidth={2.2} className="vin-filter-icon" />
            <input id="vam-recherche" type="text" placeholder={t('N°, PV, véhicule, conducteur, lieu…')} value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
        </div>
        <div className="vin-filter-group">
          <label className="vin-filter-label" htmlFor="vam-filtre-statut"><Filter size={14} strokeWidth={2.5} />{t('Statut')}</label>
          <div className="vin-filter-input-wrap">
            <select id="vam-filtre-statut" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
              <option value="all">{t('Tous les statuts')}</option>
              <option value="retard">{t('En retard de paiement')}</option>
              {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </div>
        </div>
        <div className="vin-filter-group">
          <label className="vin-filter-label" htmlFor="vam-filtre-type"><Receipt size={14} strokeWidth={2.5} />{t("Type d'infraction")}</label>
          <div className="vin-filter-input-wrap">
            <select id="vam-filtre-type" value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
              <option value="all">{t('Tous les types')}</option>
              {Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </div>
        </div>
        <button type="button" className="vin-filter-reset" onClick={() => { setRecherche(''); setFiltreStatut('all'); setFiltreType('all'); }}>
          <RotateCcw size={14} strokeWidth={2.5} />{t('Réinitialiser')}
        </button>
        <div className="vin-export-stack">
          <button type="button" className="vin-export-btn excel" onClick={exporterCsv} title={t('Export CSV')} aria-label={t('Export CSV')}><Download size={16} strokeWidth={2.5} /></button>
          <button type="button" className="vin-export-btn print" onClick={imprimer} title={t('Imprimer')} aria-label={t('Imprimer')}><Printer size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

      {erreur && (
        <div className="vin-error-banner" role="alert"><AlertTriangle size={18} strokeWidth={2.5} /><span>{erreur}</span></div>
      )}
      {message && !erreur && (
        <div className="vam-message" role="status">
          <CheckCircle2 size={18} strokeWidth={2.5} /><span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label={t('Fermer')}>×</button>
        </div>
      )}

      {/* TABLEAU */}
      <div className="vin-table-wrap">
        <table className="vin-table">
          <thead>
            <tr>
              {visibles.map((c) => (
                <th key={c.key} className={`vin-th-sortable ${tri.colonne === c.key ? 'is-sorted' : ''}`}
                  aria-sort={tri.colonne === c.key ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="vam-th-bouton" onClick={() => trier(c.key)} title={t('Trier par {colonne}', { colonne: t(c.label) })}>
                    <span>{t(c.label)}</span>{iconeTri(c.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr><td colSpan={visibles.length || 1} className="vin-table-empty">
                <div className="vin-empty-state"><Loader2 size={26} strokeWidth={2} className="vin-spin" /><span>{t('Chargement des amendes…')}</span></div>
              </td></tr>
            ) : filtrees.length === 0 ? (
              <tr><td colSpan={visibles.length || 1} className="vin-table-empty">
                <div className="vin-empty-state"><Receipt size={32} strokeWidth={1.6} />
                  <span>{amendes.length === 0 ? t('Aucune amende enregistrée.') : t('Aucune amende ne correspond à ces filtres.')}</span>
                </div>
              </td></tr>
            ) : (
              filtrees.map((a) => (
                <tr key={a.id}
                  className={`vin-row ${s?.id === a.id ? 'selected' : ''} ${a.enRetard ? 'vam-ligne-retard' : ''}`}
                  onClick={() => setSelection((p) => (p?.id === a.id ? null : a))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection((p) => (p?.id === a.id ? null : a)); } }}
                  tabIndex={0}
                  aria-selected={s?.id === a.id}>
                  {visibles.map((c) => cellule(c.key, a))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!chargement && filtrees.length > 0 && (
        <p className="vam-compte">{tp('amende affichée', filtrees.length)}</p>
      )}

      {/* FENÊTRES */}
      <VehiculeAmendeModal
        isOpen={!!formulaire}
        onClose={() => setFormulaire(null)}
        onSave={enregistrer}
        amende={formulaire === 'modifier' ? s : null}
        vehicules={vehicules}
        personnels={personnels}
      />
      {paiement && s && (
        <PaiementAmendeModal
          amende={s}
          vehicule={vehiculesParId[s.vehiculeId]}
          onClose={() => setPaiement(false)}
          onPayer={async (p) => {
            const r = await vehiculeAmendeService.payer(s.id, p);
            setSelection(r);
            setMessage(t('Paiement de l’amende {num} enregistré.', { num: r.num || '' }));
            await charger();
          }}
        />
      )}
      <ColumnSettingsModal
        show={reglagesColonnes}
        onClose={() => setReglagesColonnes(false)}
        type="amende"
        columns={colonnes}
        onToggleVisibility={(k) => setColonnes((p) => p.map((c) => (c.key === k ? { ...c, visible: !c.visible } : c)))}
        onToggleSearch={(k) => setColonnes((p) => p.map((c) => (c.key === k ? { ...c, searchable: !c.searchable } : c)))}
      />
      <ConfirmModal
        show={confirmation.show}
        onClose={() => setConfirmation({ show: false })}
        onConfirm={confirmation.onConfirm}
        type={confirmation.type}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
      />
    </div>
  );
}