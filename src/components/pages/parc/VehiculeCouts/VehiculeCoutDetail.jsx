import { useEffect, useState } from 'react';
import { Car, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Fenetre } from '../../../ui/modals/VehiculeAmendeModal';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import vehiculeCoutService from '../../../../services/vehiculeCoutService';
import VehiculeFraisModal from '../../../ui/modals/VehiculeFraisModal';
import { BarreRepartition, GraphiqueMensuel, ChoixPeriode } from './CoutGraphiques';
import { POSTES_DEPENSE, TYPES_FRAIS, couleurPoste, formatDT, ltr, bornesPeriode } from '../../../../constants/Coutlibelles';
import { t, locale } from '../../../../i18n';
import './VehiculeCouts.css';

/*
 * Coût d'un véhicule sur une période : chiffres clés, répartition, coût par mois,
 * frais fixes (saisie) et liste de toutes les dépenses comptées.
 *   - VehiculeCoutContenu : le contenu seul (réutilisé partout)
 *   - VehiculeCoutOnglet  : onglet « Coût » de la fiche véhicule, avec son choix de période
 *   - VehiculeCoutDetail  : fenêtre ouverte depuis le tableau « Coût par véhicule »
 */

const date = (iso) => (iso ? new Date(iso).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const nombre = (v, d = 0) => Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

export function VehiculeCoutContenu({ vehiculeId, debut, fin, vehicules, onFraisChange, className = '' }) {
  const [detail, setDetail] = useState(null);
  const [frais, setFrais] = useState([]);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0);
  const [fraisOuvert, setFraisOuvert] = useState(null); // null | 'nouveau' | frais
  const [aSupprimer, setASupprimer] = useState(null);

  useEffect(() => {
    let actif = true;
    Promise.all([
      vehiculeCoutService.vehicule(vehiculeId, debut, fin),
      vehiculeCoutService.frais(vehiculeId),
    ])
      .then(([d, f]) => { if (actif) { setDetail(d); setFrais(f ?? []); setErreur(''); } })
      .catch((err) => { if (actif) setErreur(err?.response?.data?.message || t('Impossible de charger le détail du véhicule.')); });
    return () => { actif = false; };
  }, [vehiculeId, debut, fin, version]);

  const apresModification = () => { setVersion((v) => v + 1); onFraisChange?.(); };

  const enregistrerFrais = async (payload) => {
    if (fraisOuvert && fraisOuvert !== 'nouveau') await vehiculeCoutService.modifierFrais(fraisOuvert.id, payload);
    else await vehiculeCoutService.creerFrais(payload);
    apresModification();
  };

  const r = detail?.resume;

  return (
    <>
      <div className={`vco-detail ${className}`}>
        {erreur && <p className="vam-alerte" role="alert">{erreur}</p>}
        {!detail && !erreur && (
          <p className="vco-chargement"><Loader2 size={18} className="vam-tourne" /> {t('Chargement…')}</p>
        )}
        {detail && (
          <>
            <div className="vco-chiffres">
              <div className="vco-chiffre vco-chiffre--principal">
                <span className="vco-chiffre-val">{formatDT(r.postes.total)}</span>
                <span className="vco-chiffre-nom">{t('Coût total')}</span>
              </div>
              <div className="vco-chiffre">
                <span className="vco-chiffre-val">{r.coutParKm != null ? formatDT(r.coutParKm) : '—'}</span>
                <span className="vco-chiffre-nom">{t('par km')}</span>
              </div>
              <div className="vco-chiffre">
                <span className="vco-chiffre-val">{r.kmParcourus != null ? t('{n} km', { n: nombre(r.kmParcourus) }) : '—'}</span>
                <span className="vco-chiffre-nom">{t('parcourus')}</span>
              </div>
              <div className="vco-chiffre">
                <span className="vco-chiffre-val">{r.consommation != null ? t('{n} L/100 km', { n: nombre(r.consommation, 1) }) : '—'}</span>
                <span className="vco-chiffre-nom">{t('consommation')}</span>
              </div>
            </div>
            {r.kmParcourus == null && (
              <p className="vco-note">{t('Kilomètres inconnus sur la période : il faut au moins deux relevés (bons carburant, missions ou relevés de compteur) pour calculer le coût au kilomètre.')}</p>
            )}

            <BarreRepartition postes={r.postes} titre={t('Répartition')} />
            <GraphiqueMensuel parMois={detail.parMois} />

            {/* Frais fixes */}
            <section className="vco-section">
              <header className="vco-section-entete">
                <h3>{t('Frais fixes')}</h3>
                <button type="button" className="vam-bouton vam-bouton--clair" onClick={() => setFraisOuvert('nouveau')}>
                  <Plus size={16} /> {t('Ajouter un frais')}
                </button>
              </header>
              {frais.length === 0 ? (
                <p className="vco-vide">{t('Aucun frais saisi : ajoutez l’assurance, la vignette et la visite technique pour un coût complet.')}</p>
              ) : (
                <ul className="vco-frais">
                  {frais.map((f) => (
                    <li key={f.id}>
                      <span className="vco-frais-type">{t(TYPES_FRAIS[f.type] || 'Autre frais')}</span>
                      <span className="vco-frais-info">
                        <b>{formatDT(f.montant)}</b>
                        {' · '}
                        {f.periodeDebut ? t('du {d} au {f}', { d: date(f.periodeDebut), f: date(f.periodeFin) }) : t('payé le {d}', { d: date(f.dateFrais) })}
                        {f.fournisseur && <> · {f.fournisseur}</>}
                        {f.reference && <> · {ltr(f.reference)}</>}
                      </span>
                      <span className="vco-frais-actions">
                        <button type="button" className="vco-icone" onClick={() => setFraisOuvert(f)} aria-label={t('Modifier')} title={t('Modifier')}><Pencil size={15} /></button>
                        <button type="button" className="vco-icone vco-icone--danger" onClick={() => setASupprimer(f)} aria-label={t('Supprimer')} title={t('Supprimer')}><Trash2 size={15} /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Dépenses comptées */}
            <section className="vco-section">
              <header className="vco-section-entete"><h3>{t('Dépenses de la période')}</h3></header>
              {detail.depenses.length === 0 ? (
                <p className="vco-vide">{t('Aucune dépense sur cette période.')}</p>
              ) : (
                <div className="vco-table-wrap">
                  <table className="vco-depenses">
                    <thead>
                      <tr><th>{t('Date')}</th><th>{t('Poste')}</th><th>{t('Détail')}</th><th>{t('Référence')}</th><th className="vco-num">{t('Montant')}</th></tr>
                    </thead>
                    <tbody>
                      {detail.depenses.map((d) => {
                        const poste = POSTES_DEPENSE[d.poste] || { libelle: d.poste, groupe: '' };
                        return (
                          <tr key={`${d.poste}-${d.sourceId}-${d.date}`}>
                            <td>{date(d.date)}</td>
                            <td><span className="vco-poste"><span className="vco-pastille" style={{ background: couleurPoste(poste.groupe) }} aria-hidden="true" />{t(poste.libelle)}</span></td>
                            <td>{d.libelle || '—'}</td>
                            <td><bdi dir="ltr">{d.reference || '—'}</bdi></td>
                            <td className="vco-num">
                              {formatDT(d.montant)}
                              {d.montantTotal != null && <span className="vco-sous">{t('sur {m}', { m: formatDT(d.montantTotal) })}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {fraisOuvert && (
        <VehiculeFraisModal
          frais={fraisOuvert === 'nouveau' ? null : fraisOuvert}
          vehicules={vehicules}
          vehiculeIdInitial={vehiculeId}
          onClose={() => setFraisOuvert(null)}
          onSave={enregistrerFrais}
        />
      )}
      <ConfirmModal
        show={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={async () => {
          const f = aSupprimer;
          setASupprimer(null);
          try { await vehiculeCoutService.supprimerFrais(f.id); apresModification(); } catch (err) {
            setErreur(err?.response?.data?.message || t("L'action a échoué."));
          }
        }}
        type="danger"
        title={t('Supprimer le frais')}
        message={t('Supprimer ce frais ({m}) ? Le coût du véhicule sera recalculé.', { m: aSupprimer ? formatDT(aSupprimer.montant) : '' })}
        confirmText={t('Supprimer')}
      />
    </>
  );
}

/* ─── Fenêtre ouverte depuis le tableau du parc ─── */
export default function VehiculeCoutDetail({ vehicule, debut, fin, vehicules, onClose, onFraisChange }) {
  const titre = [ltr(vehicule.matricule), vehicule.marque].filter(Boolean).join(' · ');
  return (
    <Fenetre
      titre={titre || t('Véhicule #{id}', { id: vehicule.vehiculeId })}
      sousTitre={t('Coût du {debut} au {fin}', { debut: date(debut), fin: date(fin) })}
      Icone={Car}
      onClose={onClose}
      largeur={1000}
    >
      <VehiculeCoutContenu
        className="vam-corps"
        vehiculeId={vehicule.vehiculeId}
        debut={debut}
        fin={fin}
        vehicules={vehicules}
        onFraisChange={onFraisChange}
      />
    </Fenetre>
  );
}

/* ─── Onglet « Coût » de la fiche d'un véhicule (page Véhicules) ─── */
export function VehiculeCoutOnglet({ vehicule }) {
  const [periode, setPeriode] = useState(() => ({ cle: 'annee', perso: bornesPeriode('annee') }));
  const bornes = bornesPeriode(periode.cle, periode.perso);
  const valide = bornes?.debut && bornes?.fin && bornes.debut <= bornes.fin;
  // Le formulaire de frais est prérempli avec ce véhicule
  const vehicules = [{ id: vehicule.id, matricule: vehicule.matricule, marque: vehicule.marque }];
  return (
    <div className="vco-onglet">
      <div className="vco-onglet-entete">
        <p className="vco-onglet-intro">{t('Carburant, entretien, incidents, amendes et frais fixes, avec le coût au kilomètre')}</p>
        <ChoixPeriode valeur={periode} onChange={setPeriode} />
      </div>
      {valide && (
        <VehiculeCoutContenu vehiculeId={vehicule.id} debut={bornes.debut} fin={bornes.fin} vehicules={vehicules} />
      )}
    </div>
  );
}