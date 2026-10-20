import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Edit, Printer, Navigation, Car, User, MapPin, Calendar, Gauge, Fuel,
  Receipt, FileText, Clock, Play, CheckCircle2, XCircle, Check, Flag, Loader2, AlertCircle,
  AlertTriangle, Timer,
} from 'lucide-react';
import vehiculeBonCarburantService from '../../../../services/vehiculeBonCarburantService';
import vehiculeAmendeService from '../../../../services/vehiculeAmendeService';
import { carburantTypeLabel } from '../../../../constants/carburantType';
import { TYPES_INFRACTION, STATUTS as STATUTS_AMENDE, ltr } from '../../../../constants/Amendelibelles';
import { imprimerFiche } from '../../../../utils/imprimerListe';
import { t, locale } from '../../../../i18n';
import '../../Reclamations/Reclamationdetails.css';
import './VehiculeMissionDetails.css';

// 0 = Planifiée, 1 = En cours, 2 = Terminée, 3 = Annulée
const ETAT_EN_CLAIR = {
  0: { texte: 'Planifiée', ton: 'action' },
  1: { texte: 'En cours', ton: 'attention' },
  2: { texte: 'Terminée', ton: 'ok' },
  3: { texte: 'Annulée', ton: 'alerte' },
};
const STATUT_AMENDE_TON = { 0: 'attention', 1: 'info', 2: 'ok', 3: 'neutre' };

const nombre = (v, dec = 0) =>
  v == null || v === '' || isNaN(Number(v)) ? '—' : Number(v).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
const dateHeure = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const dateSeule = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
};
function duree(debut, fin) {
  if (!debut || !fin) return null;
  const ms = new Date(fin) - new Date(debut);
  if (!(ms > 0)) return null;
  const h = ms / 3600000;
  return h < 24 ? t('{n} h', { n: h.toFixed(1) }) : t('{n} j', { n: (h / 24).toFixed(1) });
}
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : null);

/** Étapes de la mission : planifiée → démarrée → terminée (ou annulée). */
function construireParcours(m) {
  const annulee = m.etat === 3;
  const demarree = m.etat >= 1 && m.etat !== 3 || !!m.dateDebutReel;
  const terminee = m.etat === 2;
  const etapes = [
    { key: 'planifiee', label: 'Planifiée', icon: Calendar, statut: 'fait', detail: m.dateCreation ? t('Créée le {d}', { d: dateSeule(m.dateCreation) }) : t('Mission enregistrée') },
    {
      key: 'demarree', label: 'Démarrée', icon: Play,
      statut: demarree ? (m.etat === 1 ? 'actuel' : 'fait') : annulee ? 'barre' : 'actuel',
      detail: m.dateDebutReel ? dateHeure(m.dateDebutReel) : t('Départ prévu {d}', { d: dateHeure(m.dateDebut) }),
    },
    {
      key: 'terminee', label: 'Terminée', icon: Flag,
      statut: terminee ? 'fait' : annulee ? 'barre' : 'avenir',
      detail: m.dateFinReel ? dateHeure(m.dateFinReel) : t('Retour prévu {d}', { d: dateHeure(m.dateFin) }),
    },
  ];
  if (annulee) etapes.push({ key: 'annulee', label: 'Annulée', icon: XCircle, statut: 'probleme', detail: m.motifExecution || t('Mission annulée') });
  // Planifiée seulement : l'étape actuelle est « Démarrée » (à faire)
  if (m.etat === 0) etapes[0].statut = 'fait';
  return etapes;
}

function prochaineAction(m, parcouru) {
  switch (m.etat) {
    case 0: return { ton: 'action', icon: Play, titre: 'Démarrer la mission', texte: 'Le véhicule part : démarrez la mission pour relever le kilométrage de départ.', bouton: { label: 'Démarrer', action: 'demarrer' } };
    case 1: return { ton: 'action', icon: Flag, titre: 'Terminer la mission', texte: 'Au retour du véhicule, saisissez le kilométrage de retour pour clôturer la mission.', bouton: { label: 'Terminer', action: 'terminer' } };
    case 2: return { ton: 'fini', icon: CheckCircle2, titre: 'Mission terminée', texte: parcouru != null ? t('{km} km parcourus. Les pleins et les amendes restent modifiables depuis la mission.', { km: nombre(parcouru) }) : 'Les pleins et les amendes restent modifiables depuis la mission.' };
    case 3: return { ton: 'neutre', icon: XCircle, titre: 'Mission annulée', texte: m.motifExecution || 'Cette mission a été annulée.' };
    default: return null;
  }
}

export default function VehiculeMissionDetails({
  mission, vehicule, conducteur, source, destination, version = 0,
  onBack, onModifier, onDemarrer, onTerminer, onTracage,
}) {
  const [bons, setBons] = useState([]);
  const [amendes, setAmendes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const titreRef = useRef(null);

  useEffect(() => {
    if (!mission?.id) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    Promise.allSettled([
      vehiculeBonCarburantService.getByMission(mission.id),
      vehiculeAmendeService.getByMission(mission.id),
    ]).then(([b, a]) => {
      if (annule) return;
      setBons(b.status === 'fulfilled' ? b.value : []);
      setAmendes(a.status === 'fulfilled' ? a.value : []);
      if (b.status === 'rejected' || a.status === 'rejected') setErreur(t('Une partie des informations n’a pas pu être chargée.'));
    }).finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [mission?.id, version]);

  useEffect(() => { titreRef.current?.focus(); }, [mission?.id]);

  const totaux = useMemo(() => ({
    litres: bons.reduce((s, b) => s + (Number(b.litres) || 0), 0),
    carburant: bons.reduce((s, b) => s + (Number(b.montant) || 0), 0),
    montantAmendes: amendes.reduce((s, a) => s + (Number(a.montant) || 0), 0),
    aRegler: amendes.filter((a) => a.statut === 0 || a.statut === 1).length,
  }), [bons, amendes]);

  if (!mission) {
    return (
      <div className="rcx-page">
        <div className="rcx-erreur">
          <AlertCircle size={36} />
          <p>{t('Cette mission est introuvable. Elle a peut-être été supprimée.')}</p>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={onBack}>
            <ArrowLeft size={18} /> {t('Revenir à la liste')}
          </button>
        </div>
      </div>
    );
  }

  const etat = ETAT_EN_CLAIR[mission.etat] || { texte: 'Inconnu', ton: 'neutre' };
  const ref = mission.num || t('Mission #{id}', { id: mission.id });
  const titre = mission.description || t('Mission {num}', { num: ref });
  const parcouru = mission.kilometrageParcouru
    ?? (mission.kilometrageRetour != null && mission.kilometrageDepart != null ? mission.kilometrageRetour - mission.kilometrageDepart : null);
  const conso = parcouru > 0 && totaux.litres > 0 ? (totaux.litres / parcouru) * 100 : null;
  const debut = mission.dateDebutReel || mission.dateDebut;
  const fin = mission.dateFinReel || mission.dateFin;
  const nomConducteur = nomPersonne(conducteur) || mission.conducteurNom || null;
  const nomVehicule = vehicule ? [vehicule.matricule, vehicule.marque, vehicule.modele].filter(Boolean).join(' · ') : null;
  const etapes = construireParcours(mission);
  const action = prochaineAction(mission, parcouru);
  const ActionIcon = action?.icon;

  const executer = (a) => {
    if (a?.action === 'demarrer') onDemarrer?.();
    if (a?.action === 'terminer') onTerminer?.();
  };

  const vitaux = [
    { key: 'etat', icon: FileText, label: 'État', valeur: t(etat.texte), ton: etat.ton },
    { key: 'duree', icon: Timer, label: 'Durée', valeur: duree(debut, fin) || '—', ton: 'neutre' },
    { key: 'km', icon: Gauge, label: 'Distance parcourue', valeur: parcouru != null ? `${nombre(parcouru)} ${t('km')}` : '—', ton: parcouru != null ? 'action' : 'neutre' },
    { key: 'carburant', icon: Fuel, label: 'Carburant', valeur: `${nombre(totaux.carburant, 2)} ${t('DT')}`, ton: bons.length ? 'attention' : 'neutre' },
    { key: 'conso', icon: Gauge, label: 'Consommation', valeur: conso != null ? `${nombre(conso, 1)} ${t('L/100 km')}` : '—', ton: 'neutre' },
    { key: 'amendes', icon: Receipt, label: 'Amendes', valeur: amendes.length ? `${nombre(totaux.montantAmendes, 3)} ${t('DT')}` : t('Aucune'), ton: totaux.aRegler ? 'alerte' : amendes.length ? 'ok' : 'neutre' },
  ];

  const imprimer = () => {
    imprimerFiche({
      titre,
      sousTitre: t('Mission véhicule'),
      reference: ref,
      statut: t(etat.texte),
      sections: [
        {
          titre: t('Informations générales'),
          champs: [
            { label: t('Véhicule'), valeur: nomVehicule },
            { label: t('Conducteur'), valeur: nomConducteur },
            { label: t('Emplacement de départ'), valeur: source?.nom },
            { label: t('Emplacement de destination'), valeur: destination?.nom },
            { label: t('Départ prévu'), valeur: dateHeure(mission.dateDebut) },
            { label: t('Retour prévu'), valeur: dateHeure(mission.dateFin) },
            { label: t('Départ réel'), valeur: mission.dateDebutReel ? dateHeure(mission.dateDebutReel) : null },
            { label: t('Retour réel'), valeur: mission.dateFinReel ? dateHeure(mission.dateFinReel) : null },
            { label: t('Kilométrage'), valeur: mission.kilometrageDepart != null ? `${nombre(mission.kilometrageDepart)} → ${nombre(mission.kilometrageRetour)} ${t('km')}` : null },
            { label: t('Distance parcourue'), valeur: parcouru != null ? `${nombre(parcouru)} ${t('km')}` : null },
            { label: t('Consommation'), valeur: conso != null ? `${nombre(conso, 1)} ${t('L/100 km')}` : null },
          ],
        },
        { titre: t('Observations'), texte: mission.commentaire || '' },
        {
          titre: t('Bons de carburant'),
          colonnes: [t('Date'), t('Station'), t('Carburant'), { label: t('Litres'), align: 'end' }, { label: t('Kilométrage'), align: 'end' }, { label: t('Montant'), align: 'end' }],
          lignes: [
            ...bons.map((b) => [dateHeure(b.date), b.station || '', b.typeCarburant != null ? t(carburantTypeLabel(b.typeCarburant)) : '', b.litres != null ? nombre(b.litres, 2) : '', b.kilometrage != null ? nombre(b.kilometrage) : '', `${nombre(b.montant, 2)} ${t('DT')}`]),
            ...(bons.length ? [[t('Total'), '', '', nombre(totaux.litres, 2), '', `${nombre(totaux.carburant, 2)} ${t('DT')}`]] : []),
          ],
          vide: t('Aucun plein pour cette mission.'),
        },
        {
          titre: t('Amendes'),
          colonnes: [t('N°'), t("Date de l'infraction"), t('Type'), t('Lieu'), t('Statut'), { label: t('Montant'), align: 'end' }],
          lignes: [
            ...amendes.map((a) => [a.num || '', dateHeure(a.dateInfraction), t(TYPES_INFRACTION[a.type] ?? ''), a.lieu || '', t(STATUTS_AMENDE[a.statut] ?? ''), `${nombre(a.montant, 3)} ${t('DT')}`]),
            ...(amendes.length ? [[t('Total'), '', '', '', '', `${nombre(totaux.montantAmendes, 3)} ${t('DT')}`]] : []),
          ],
          vide: t('Aucune amende pour cette mission.'),
        },
      ],
      signatures: [t('Conducteur'), t('Responsable du parc')],
    });
  };

  return (
    <div className="rcx-page vmd-page">
      {/* ===== Barre du haut ===== */}
      <div className="rcx-barre">
        <button type="button" className="rcx-btn rcx-btn--clair" onClick={onBack}>
          <ArrowLeft size={18} className="vmd-retour" /> {t('Toutes les missions')}
        </button>
        <div className="rcx-barre-droite">
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={onModifier}>
            <Edit size={17} /> {t('Modifier')}
          </button>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={onTracage}>
            <Navigation size={17} /> {t('Traçage')}
          </button>
          <button type="button" className="rcx-btn rcx-btn--clair" onClick={imprimer} disabled={chargement}>
            <Printer size={17} /> {t('Imprimer la fiche')}
          </button>
        </div>
      </div>

      {/* ===== La mission, en clair ===== */}
      <section className="rcx-identite" aria-label={t('Informations générales de la mission')}>
        <div className={`rcx-bracelet rcx-ton--${etat.ton}`}>
          <span className="rcx-bracelet-etat">{t(etat.texte)}</span>
          <span className="rcx-bracelet-num">{ltr(ref)}</span>
          <span className="rcx-bracelet-trou" aria-hidden="true" />
        </div>

        <h1 className="rcx-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
        <p className="rcx-resume vmd-trajet">
          <MapPin size={17} /> <strong>{source?.nom || '—'}</strong>
          <ArrowRight size={16} className="vmd-fleche" /> <strong>{destination?.nom || '—'}</strong>
          <span className="vmd-periode">{dateHeure(debut)} <ArrowRight size={13} className="vmd-fleche" /> {dateHeure(fin)}</span>
        </p>

        {mission.commentaire && (
          <figure className="rcx-citation">
            <figcaption>{t('Observations')}</figcaption>
            <blockquote>{mission.commentaire}</blockquote>
          </figure>
        )}

        <dl className="rcx-fiche">
          <div><dt><Car size={15} /> {t('Véhicule')}</dt><dd>{vehicule ? <bdi>{nomVehicule}</bdi> : '—'}</dd></div>
          <div><dt><User size={15} /> {t('Conducteur')}</dt><dd>{nomConducteur || '—'}{conducteur?.matricule ? <small className="vmd-sous"> · {conducteur.matricule}</small> : null}</dd></div>
          <div><dt><Calendar size={15} /> {t('Créée le')}</dt><dd>{dateSeule(mission.dateCreation)}{mission.personnelCreationNom ? <small className="vmd-sous"> · {mission.personnelCreationNom}</small> : null}</dd></div>
        </dl>
      </section>

      <div className="rcx-grille">
        <div className="rcx-col-principale">
          {/* ===== Parcours ===== */}
          <section className="rcx-parcours" aria-label={t('Parcours de la mission')}>
            <div className="rcx-parcours-entete">
              <h2>{t('Parcours de la mission')}</h2>
              <span className="rcx-parcours-compte">
                {mission.etat === 2 ? t('Terminé') : mission.etat === 3 ? t('Annulée') : t('Étape {n} sur {total}', { n: mission.etat === 1 ? 2 : 1, total: 3 })}
              </span>
            </div>
            <ol className="rcx-ligne" style={{ '--rcx-p': mission.etat === 2 ? 1 : mission.etat === 1 ? 0.5 : 0 }}>
              {etapes.map((e) => {
                const Icon = e.statut === 'fait' ? Check : e.statut === 'probleme' ? XCircle : e.icon;
                return (
                  <li key={e.key} className={`rcx-station is-${e.statut}`}>
                    <span className="rcx-station-point" aria-hidden="true"><Icon size={18} strokeWidth={2.4} /></span>
                    <span className="rcx-station-nom">{t(e.label)}</span>
                    <span className="rcx-station-aide">{e.detail}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ===== À faire maintenant ===== */}
          {action && (
            <div className="rcx-duo rcx-duo--seul">
              <section className={`rcx-maintenant rcx-maintenant--${action.ton}`} aria-label={t('À faire maintenant')}>
                <span className="rcx-maintenant-icone"><ActionIcon size={26} /></span>
                <p className="rcx-maintenant-sur">{mission.etat <= 1 ? t('À faire maintenant') : t('Situation')}</p>
                <h2 className="rcx-maintenant-titre">{t(action.titre)}</h2>
                <p className="rcx-maintenant-texte">{t(action.texte)}</p>
                {action.bouton && (
                  <div className="rcx-maintenant-actions">
                    <button type="button" className="rcx-btn rcx-btn--principal" onClick={() => executer(action.bouton)}>
                      {t(action.bouton.label)}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {erreur && <p className="vmd-erreur"><AlertTriangle size={16} /> {erreur}</p>}

          {/* ===== Bons de carburant ===== */}
          <section className="rcx-bons" aria-label={t('Bons de carburant')}>
            <div className="rcx-bons-entete">
              <h2><Fuel size={19} className="vmd-icone-titre" /> {t('Bons de carburant')} <span className="vmd-compte">{bons.length}</span></h2>
              <button type="button" className="rcx-btn rcx-btn--fantome" onClick={onModifier}>
                <Edit size={16} /> {t('Gérer les pleins')}
              </button>
            </div>
            {chargement ? (
              <div className="rcx-vide"><p><Loader2 size={18} className="rcx-tourne" /> {t('Chargement...')}</p></div>
            ) : bons.length === 0 ? (
              <div className="rcx-vide"><p>{t('Aucun plein pour cette mission.')}</p></div>
            ) : (
              <div className="vmd-table-wrap">
                <table className="vmd-table">
                  <thead>
                    <tr>
                      <th>{t('Date')}</th><th>{t('Station')}</th><th>{t('Carburant')}</th>
                      <th className="vmd-num">{t('Litres')}</th><th className="vmd-num">{t('Kilométrage')}</th><th className="vmd-num">{t('Montant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bons.map((b) => (
                      <tr key={b.id}>
                        <td>{dateHeure(b.date)}</td>
                        <td>{b.station || '—'}</td>
                        <td>{b.typeCarburant != null ? t(carburantTypeLabel(b.typeCarburant)) : '—'}</td>
                        <td className="vmd-num">{b.litres != null ? nombre(b.litres, 2) : '—'}</td>
                        <td className="vmd-num">{b.kilometrage != null ? nombre(b.kilometrage) : '—'}</td>
                        <td className="vmd-num"><strong>{nombre(b.montant, 2)} {t('DT')}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>{t('Total')}</td>
                      <td className="vmd-num">{nombre(totaux.litres, 2)}</td>
                      <td />
                      <td className="vmd-num">{nombre(totaux.carburant, 2)} {t('DT')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* ===== Amendes ===== */}
          <section className="rcx-bons" aria-label={t('Amendes')}>
            <div className="rcx-bons-entete">
              <h2><Receipt size={19} className="vmd-icone-titre" /> {t('Amendes')} <span className="vmd-compte">{amendes.length}</span></h2>
              <button type="button" className="rcx-btn rcx-btn--fantome" onClick={onModifier}>
                <Edit size={16} /> {t('Gérer les amendes')}
              </button>
            </div>
            {chargement ? (
              <div className="rcx-vide"><p><Loader2 size={18} className="rcx-tourne" /> {t('Chargement...')}</p></div>
            ) : amendes.length === 0 ? (
              <div className="rcx-vide"><p>{t('Aucune amende pour cette mission.')}</p></div>
            ) : (
              <div className="vmd-table-wrap">
                <table className="vmd-table">
                  <thead>
                    <tr>
                      <th>{t('N°')}</th><th>{t("Date de l'infraction")}</th><th>{t('Type')}</th><th>{t('Lieu')}</th>
                      <th>{t('Statut')}</th><th>{t('Date limite')}</th><th className="vmd-num">{t('Montant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendes.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{ltr(a.num) || '—'}</strong>{a.referencePv && <small className="vmd-sous vmd-bloc">{t('PV')} {ltr(a.referencePv)}</small>}</td>
                        <td>{dateHeure(a.dateInfraction)}</td>
                        <td>{t(TYPES_INFRACTION[a.type] ?? '—')}</td>
                        <td>{a.lieu || '—'}</td>
                        <td>
                          <span className={`rcx-pastille rcx-ton--${STATUT_AMENDE_TON[a.statut] ?? 'neutre'}`}>{t(STATUTS_AMENDE[a.statut] ?? '—')}</span>
                          {a.enRetard && <span className="rcx-pastille rcx-ton--alerte vmd-pastille">{t('En retard')}</span>}
                        </td>
                        <td>{dateSeule(a.dateLimitePaiement)}</td>
                        <td className="vmd-num"><strong>{nombre(a.montant, 3)} {t('DT')}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6}>{t('Total')}</td>
                      <td className="vmd-num">{nombre(totaux.montantAmendes, 3)} {t('DT')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="rcx-col-cote">
          <section className="rcx-vitaux" aria-label={t("En un coup d'œil")}>
            <h2>{t("En un coup d'œil")}</h2>
            <ul>
              {vitaux.map((v) => {
                const Icon = v.icon;
                return (
                  <li key={v.key}>
                    <div className="rcx-vital">
                      <span className="rcx-vital-icone"><Icon size={17} /></span>
                      <span className="rcx-vital-label">{t(v.label)}</span>
                      <span className={`rcx-vital-valeur rcx-ton--${v.ton}`}>{v.valeur}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rcx-vitaux vmd-carte" aria-label={t('Période et kilométrage')}>
            <h2>{t('Période et kilométrage')}</h2>
            <dl className="vmd-champs">
              <div><dt><Clock size={14} /> {t('Départ prévu')}</dt><dd>{dateHeure(mission.dateDebut)}</dd></div>
              <div><dt><Clock size={14} /> {t('Retour prévu')}</dt><dd>{dateHeure(mission.dateFin)}</dd></div>
              <div><dt><Play size={14} /> {t('Départ réel')}</dt><dd>{dateHeure(mission.dateDebutReel)}</dd></div>
              <div><dt><Flag size={14} /> {t('Retour réel')}</dt><dd>{dateHeure(mission.dateFinReel)}</dd></div>
              <div><dt><Gauge size={14} /> {t('Kilométrage départ')}</dt><dd>{mission.kilometrageDepart != null ? `${nombre(mission.kilometrageDepart)} ${t('km')}` : '—'}</dd></div>
              <div><dt><Gauge size={14} /> {t('Kilométrage retour')}</dt><dd>{mission.kilometrageRetour != null ? `${nombre(mission.kilometrageRetour)} ${t('km')}` : '—'}</dd></div>
              {mission.motif && <div className="vmd-large"><dt><FileText size={14} /> {t('Motif')}</dt><dd>{mission.motif}</dd></div>}
              {mission.motifExecution && <div className="vmd-large"><dt><FileText size={14} /> {t("Motif d'exécution")}</dt><dd>{mission.motifExecution}</dd></div>}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
