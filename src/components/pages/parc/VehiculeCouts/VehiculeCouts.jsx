import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Car, Plus, Download, Printer, AlertTriangle, Loader2, Info,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronRight,
} from 'lucide-react';
import vehiculeCoutService from '../../../../services/vehiculeCoutService';
import VehiculeCoutDetail from './VehiculeCoutDetail';
import VehiculeFraisModal from '../../../ui/modals/VehiculeFraisModal';
import { BarreRepartition, MiniBarre, ChoixPeriode } from './CoutGraphiques';
import { POSTES, montantPoste, formatDT, bornesPeriode } from '../../../../constants/Coutlibelles';
import { t, locale } from '../../../../i18n';
import { imprimerListe } from '../../../../utils/imprimerListe';
import '../VehiculeIncident/VehiculeIncidents.css';
import './VehiculeCouts.css';

/*
 * Coût total par véhicule sur une période : carburant, entretien, incidents, amendes payées
 * par l'établissement et frais fixes (assurance, vignette, visite technique), avec le coût
 * au kilomètre. Un clic sur un véhicule ouvre son détail (mois par mois, dépenses, frais).
 * isModal : affichée dans la fenêtre « Coût par véhicule » de la page Véhicules (le titre est
 * alors porté par la fenêtre).
 */

const COLONNES = [
  { cle: 'vehicule', libelle: 'Véhicule' },
  { cle: 'km', libelle: 'Km parcourus', num: true },
  ...POSTES.map((p) => ({ cle: p.cle, libelle: p.libelle, num: true, couleur: p.couleur })),
  { cle: 'total', libelle: 'Coût total', num: true },
  { cle: 'parKm', libelle: 'Coût / km', num: true },
];

const nombre = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }));

export default function VehiculeCouts({ isModal = false }) {
  const [periode, setPeriodeEtat] = useState(() => ({ cle: 'annee', perso: bornesPeriode('annee') }));
  const { debut, fin } = bornesPeriode(periode.cle, periode.perso) || {};
  const persoValide = !!(debut && fin && debut <= fin);

  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0);
  const [tri, setTri] = useState({ cle: 'total', sens: 'desc' });
  const [ouvert, setOuvert] = useState(null);
  const [nouveauFrais, setNouveauFrais] = useState(false);

  // Chargement à chaque changement de période (ou après une saisie de frais)
  useEffect(() => {
    if (!persoValide) return undefined;
    let actif = true;
    vehiculeCoutService.parc(debut, fin)
      .then((d) => { if (actif) { setDonnees(d); setErreur(''); } })
      .catch((err) => { if (actif) setErreur(err?.response?.data?.message || t('Impossible de calculer les coûts. Vérifie que le serveur est bien lancé.')); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [debut, fin, persoValide, version]);

  const changerPeriode = (valeur) => {
    setChargement(true);
    setPeriodeEtat(valeur);
  };
  const recharger = () => setVersion((v) => v + 1);

  const vehicules = useMemo(() => donnees?.vehicules ?? [], [donnees]);
  const listeVehicules = useMemo(() => vehicules.map((v) => ({ id: v.vehiculeId, matricule: v.matricule, marque: v.marque })), [vehicules]);
  const maxTotal = Math.max(0, ...vehicules.map((v) => v.postes.total));

  const valeur = (v, cle) => {
    switch (cle) {
      case 'vehicule': return v.matricule || '';
      case 'km': return v.kmParcourus ?? -1;
      case 'total': return v.postes.total;
      case 'parKm': return v.coutParKm ?? -1;
      default: return montantPoste(v.postes, cle);
    }
  };
  const triees = useMemo(() => {
    const l = [...vehicules].sort((a, b) => {
      const x = valeur(a, tri.cle), y = valeur(b, tri.cle);
      return typeof x === 'string' ? x.localeCompare(y, locale(), { numeric: true }) : x - y;
    });
    return tri.sens === 'desc' ? l.reverse() : l;
     
  }, [vehicules, tri]);

  const trier = (cle) => setTri((p) => (p.cle === cle ? { cle, sens: p.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: cle === 'vehicule' ? 'asc' : 'desc' }));
  const iconeTri = (cle) => (tri.cle !== cle ? <ArrowUpDown size={13} className="vin-sort-icon" />
    : tri.sens === 'asc' ? <ArrowUp size={13} className="vin-sort-icon active" /> : <ArrowDown size={13} className="vin-sort-icon active" />);

  const plusCher = vehicules.reduce((m, v) => (!m || v.postes.total > m.postes.total ? v : m), null);
  const totaux = donnees?.totaux;

  // ─── Export / impression ───
  const tableau = () => {
    const entetes = ['Véhicule', 'Km parcourus', ...POSTES.map((p) => p.libelle), 'Coût total', 'Coût / km'].map((e) => t(e));
    const lignes = triees.map((v) => [
      [v.matricule, v.marque].filter(Boolean).join(' · '),
      nombre(v.kmParcourus),
      ...POSTES.map((p) => nombre(montantPoste(v.postes, p.cle), 3)),
      nombre(v.postes.total, 3),
      nombre(v.coutParKm, 3),
    ]);
    return { entetes, lignes };
  };
  const exporterCsv = () => {
    const { entetes, lignes } = tableau();
    const csv = [entetes, ...lignes].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cout-vehicules-${debut}-${fin}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const imprimer = () => {
    const { entetes, lignes } = tableau();
    imprimerListe({
      titre: t('Coût par véhicule'),
      sousTitre: t('Du {debut} au {fin}', { debut: new Date(debut).toLocaleDateString(locale()), fin: new Date(fin).toLocaleDateString(locale()) }),
      colonnes: entetes,
      lignes,
    });
  };

  return (
    <div className={`vin-container vco-page ${isModal ? 'vco-page--modale' : ''}`}>
      {/* EN-TÊTE (dans la fenêtre de la page Véhicules, seul le choix de période reste) */}
      <div className={`vin-header-card ${isModal ? 'vco-entete-modale' : ''}`}>
        {!isModal && (
          <div className="vin-header-left">
            <div className="vin-header-icon-wrap"><Wallet size={24} strokeWidth={2} /></div>
            <div>
              <h2>{t('Coût par véhicule')}</h2>
              <p className="vin-header-subtitle">{t('Carburant, entretien, incidents, amendes et frais fixes, avec le coût au kilomètre')}</p>
            </div>
          </div>
        )}
        <ChoixPeriode valeur={periode} onChange={changerPeriode} />
      </div>

      {erreur && <div className="vin-error-banner" role="alert"><AlertTriangle size={18} strokeWidth={2.5} /><span>{erreur}</span></div>}

      {/* CHIFFRES CLÉS + RÉPARTITION */}
      <div className="vco-synthese">
        <div className="vco-chiffres">
          <div className="vco-chiffre vco-chiffre--principal">
            <span className="vco-chiffre-val">{totaux ? formatDT(totaux.total) : '—'}</span>
            <span className="vco-chiffre-nom">{t('Coût total du parc')}</span>
          </div>
          <div className="vco-chiffre">
            <span className="vco-chiffre-val">{donnees?.coutParKm != null ? formatDT(donnees.coutParKm) : '—'}</span>
            <span className="vco-chiffre-nom">{t('Coût moyen au km')}</span>
          </div>
          <div className="vco-chiffre">
            <span className="vco-chiffre-val">{donnees?.kmParcourus != null ? t('{n} km', { n: nombre(donnees.kmParcourus) }) : '—'}</span>
            <span className="vco-chiffre-nom">{t('Km parcourus')}</span>
          </div>
          <div className="vco-chiffre">
            <span className="vco-chiffre-val"><bdi dir="ltr">{plusCher && plusCher.postes.total > 0 ? plusCher.matricule : '—'}</bdi></span>
            <span className="vco-chiffre-nom">{plusCher && plusCher.postes.total > 0 ? t('Le plus coûteux · {m}', { m: formatDT(plusCher.postes.total, 0) }) : t('Le plus coûteux')}</span>
          </div>
        </div>
        <BarreRepartition postes={totaux} titre={t('Où va l’argent')} />
      </div>

      {/* ACTIONS */}
      <div className="vin-actions-bar">
        <button type="button" className="vin-action-btn ajouter" onClick={() => setNouveauFrais(true)}>
          <Plus size={18} strokeWidth={2.5} /><span>{t('Ajouter un frais')}</span>
        </button>
        <span className="vco-astuce"><Info size={14} aria-hidden="true" /> {t('Assurance, vignette, visite technique : saisissez-les pour un coût complet.')}</span>
        <div className="vin-export-stack vco-exports">
          <button type="button" className="vin-export-btn excel" onClick={exporterCsv} title={t('Export CSV')} aria-label={t('Export CSV')} disabled={!vehicules.length}><Download size={16} strokeWidth={2.5} /></button>
          <button type="button" className="vin-export-btn print" onClick={imprimer} title={t('Imprimer')} aria-label={t('Imprimer')} disabled={!vehicules.length}><Printer size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="vin-table-wrap">
        <table className="vin-table vco-table">
          <thead>
            <tr>
              {COLONNES.map((c) => (
                <th key={c.cle} className={`vin-th-sortable ${c.num ? 'vco-num' : ''} ${tri.cle === c.cle ? 'is-sorted' : ''}`}
                  aria-sort={tri.cle === c.cle ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="vco-th-bouton" onClick={() => trier(c.cle)}>
                    {c.couleur && <span className="vco-pastille" style={{ background: c.couleur }} aria-hidden="true" />}
                    <span>{t(c.libelle)}</span>{iconeTri(c.cle)}
                  </button>
                </th>
              ))}
              <th aria-label={t('Détail')} />
            </tr>
          </thead>
          <tbody>
            {chargement && !donnees ? (
              <tr><td colSpan={COLONNES.length + 1} className="vin-table-empty">
                <div className="vin-empty-state"><Loader2 size={26} className="vin-spin" /><span>{t('Calcul des coûts…')}</span></div>
              </td></tr>
            ) : triees.length === 0 ? (
              <tr><td colSpan={COLONNES.length + 1} className="vin-table-empty">
                <div className="vin-empty-state"><Car size={32} strokeWidth={1.6} /><span>{t('Aucun véhicule dans le parc.')}</span></div>
              </td></tr>
            ) : triees.map((v) => (
              <tr key={v.vehiculeId} className={`vin-row ${chargement ? 'vco-maj' : ''}`} tabIndex={0}
                onClick={() => setOuvert(v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOuvert(v); } }}
                aria-label={t('Voir le détail de {m}', { m: v.matricule || '' })}>
                <td>
                  <div className="vin-cell-vehicle">
                    <div className="vin-cell-vehicle-icon"><Car size={14} strokeWidth={2.2} /></div>
                    <div className="vin-cell-vehicle-text">
                      <bdi className="vin-cell-main" dir="ltr">{v.matricule || t('Véhicule #{id}', { id: v.vehiculeId })}</bdi>
                      {v.marque && <span className="vin-cell-sub">{v.marque}</span>}
                    </div>
                  </div>
                </td>
                <td className="vco-num">
                  {v.kmParcourus != null ? nombre(v.kmParcourus) : <span className="vco-inconnu" title={t('Pas assez de relevés de compteur sur la période')}>{t('inconnu')}</span>}
                  {v.consommation != null && <span className="vin-cell-sub">{t('{n} L/100 km', { n: nombre(v.consommation, 1) })}</span>}
                </td>
                {POSTES.map((p) => {
                  const m = montantPoste(v.postes, p.cle);
                  return <td key={p.cle} className={`vco-num ${m ? '' : 'vco-zero'}`}>{m ? nombre(m, 3) : '—'}</td>;
                })}
                <td className="vco-num vco-total">
                  <strong>{formatDT(v.postes.total)}</strong>
                  <MiniBarre postes={v.postes} max={maxTotal} />
                </td>
                <td className="vco-num">{v.coutParKm != null ? formatDT(v.coutParKm) : '—'}</td>
                <td className="vco-chevron"><ChevronRight size={16} className="rtl-miroir" aria-hidden="true" /></td>
              </tr>
            ))}
          </tbody>
          {totaux && triees.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row">{t('Total du parc')}</th>
                <td className="vco-num">{donnees.kmParcourus != null ? nombre(donnees.kmParcourus) : '—'}</td>
                {POSTES.map((p) => <td key={p.cle} className="vco-num">{nombre(montantPoste(totaux, p.cle), 3)}</td>)}
                <td className="vco-num vco-total"><strong>{formatDT(totaux.total)}</strong></td>
                <td className="vco-num">{donnees.coutParKm != null ? formatDT(donnees.coutParKm) : '—'}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="vco-legende-bas">
        {t('Montants en DT. Entretien = bons de maintenance du véhicule (main-d’œuvre, pièces, achats). Amendes = seulement celles payées par l’établissement. Frais fixes répartis sur leur période.')}
      </p>

      {ouvert && (
        <VehiculeCoutDetail
          vehicule={ouvert}
          debut={debut}
          fin={fin}
          vehicules={listeVehicules}
          onClose={() => setOuvert(null)}
          onFraisChange={recharger}
        />
      )}
      {nouveauFrais && (
        <VehiculeFraisModal
          vehicules={listeVehicules}
          onClose={() => setNouveauFrais(false)}
          onSave={async (payload) => { await vehiculeCoutService.creerFrais(payload); recharger(); }}
        />
      )}
    </div>
  );
}