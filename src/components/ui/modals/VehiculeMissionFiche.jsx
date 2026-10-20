import { useEffect, useMemo, useState } from 'react';
import {
  Route, Car, User, MapPin, Calendar, Gauge, Fuel, Receipt, FileText,
  Clock, CheckCircle2, XCircle, Loader2, ArrowRight, AlertTriangle, Inbox,
} from 'lucide-react';
import PageModal from './PageModal';
import vehiculeBonCarburantService from '../../../services/vehiculeBonCarburantService';
import vehiculeAmendeService from '../../../services/vehiculeAmendeService';
import { carburantTypeLabel } from '../../../constants/carburantType';
import { TYPES_INFRACTION, STATUTS as STATUTS_AMENDE, ltr } from '../../../constants/Amendelibelles';
import { t, locale } from '../../../i18n';
import './VehiculeMissionFiche.css';

const ETATS = {
  0: { label: 'Planifiée', cls: 'planifiee', Icon: Clock },
  1: { label: 'En cours', cls: 'encours', Icon: Loader2 },
  2: { label: 'Terminée', cls: 'terminee', Icon: CheckCircle2 },
  3: { label: 'Annulée', cls: 'annulee', Icon: XCircle },
};
const STATUT_AMENDE_CLS = { 0: 'apayer', 1: 'contestee', 2: 'payee', 3: 'annulee' };

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

function Champ({ label, children, large }) {
  return (
    <div className={'vmf-champ' + (large ? ' vmf-champ--large' : '')}>
      <span className="vmf-champ-label">{label}</span>
      <span className="vmf-champ-valeur">{children ?? '—'}</span>
    </div>
  );
}

export default function VehiculeMissionFiche({ isOpen, onClose, mission, vehicule, conducteur, source, destination }) {
  const [bons, setBons] = useState([]);
  const [amendes, setAmendes] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!isOpen || !mission?.id) return;
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
  }, [isOpen, mission?.id]);

  const totaux = useMemo(() => {
    const litres = bons.reduce((s, b) => s + (Number(b.litres) || 0), 0);
    const carburant = bons.reduce((s, b) => s + (Number(b.montant) || 0), 0);
    const montantAmendes = amendes.reduce((s, a) => s + (Number(a.montant) || 0), 0);
    const aRegler = amendes.filter((a) => a.statut === 0 || a.statut === 1).length;
    return { litres, carburant, montantAmendes, aRegler };
  }, [bons, amendes]);

  if (!isOpen || !mission) return null;

  const etat = ETATS[mission.etat] ?? { label: String(mission.etat ?? '—'), cls: 'planifiee', Icon: Clock };
  const EtatIcon = etat.Icon;
  const parcouru = mission.kilometrageParcouru
    ?? (mission.kilometrageRetour != null && mission.kilometrageDepart != null ? mission.kilometrageRetour - mission.kilometrageDepart : null);
  const conso = parcouru > 0 && totaux.litres > 0 ? (totaux.litres / parcouru) * 100 : null;
  const debut = mission.dateDebutReel || mission.dateDebut;
  const fin = mission.dateFinReel || mission.dateFin;
  const nomConducteur = nomPersonne(conducteur) || mission.conducteurNom || null;

  return (
    <PageModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Mission {num}', { num: ltr(mission.num || '#' + mission.id) })}
      subtitle={mission.description || t('Détails de la mission')}
      icon={Route}
      accent="#0794a4"
      size="xl"
    >
      <div className="vmf">
        {/* Bandeau */}
        <div className="vmf-bandeau">
          <span className={`vmf-etat vmf-etat--${etat.cls}`}>
            <EtatIcon size={14} strokeWidth={2.5} /> {t(etat.label)}
          </span>
          <div className="vmf-trajet">
            <MapPin size={15} />
            <strong>{source?.nom || '—'}</strong>
            <ArrowRight size={15} className="vmf-fleche" />
            <strong>{destination?.nom || '—'}</strong>
          </div>
          <span className="vmf-periode">
            <Calendar size={14} /> {dateHeure(debut)} <ArrowRight size={13} className="vmf-fleche" /> {dateHeure(fin)}
            {duree(debut, fin) && <em>{duree(debut, fin)}</em>}
          </span>
        </div>

        {/* Indicateurs */}
        <div className="vmf-kpis">
          <div className="vmf-kpi">
            <span className="vmf-kpi-icone"><Gauge size={18} /></span>
            <div><span>{t('Distance parcourue')}</span><strong>{parcouru != null ? nombre(parcouru) : '—'} <small>{t('km')}</small></strong></div>
          </div>
          <div className="vmf-kpi">
            <span className="vmf-kpi-icone vmf-kpi-icone--carburant"><Fuel size={18} /></span>
            <div><span>{t('Carburant')}</span><strong>{nombre(totaux.carburant, 2)} <small>{t('DT')}</small></strong>
              <em>{t('{n} plein(s)', { n: bons.length })}{totaux.litres ? ' · ' + nombre(totaux.litres, 1) + ' ' + t('L') : ''}</em></div>
          </div>
          <div className="vmf-kpi">
            <span className="vmf-kpi-icone vmf-kpi-icone--conso"><Gauge size={18} /></span>
            <div><span>{t('Consommation')}</span><strong>{conso != null ? nombre(conso, 1) : '—'} <small>{t('L/100 km')}</small></strong></div>
          </div>
          <div className="vmf-kpi">
            <span className="vmf-kpi-icone vmf-kpi-icone--amende"><Receipt size={18} /></span>
            <div><span>{t('Amendes')}</span><strong>{nombre(totaux.montantAmendes, 3)} <small>{t('DT')}</small></strong>
              <em>{t('{n} amende(s)', { n: amendes.length })}{totaux.aRegler ? ' · ' + t('{n} à régler', { n: totaux.aRegler }) : ''}</em></div>
          </div>
        </div>

        {erreur && <p className="vmf-erreur"><AlertTriangle size={15} /> {erreur}</p>}

        {/* Informations */}
        <div className="vmf-grille">
          <section className="vmf-carte">
            <h4><Car size={15} /> {t('Véhicule & conducteur')}</h4>
            <div className="vmf-champs">
              <Champ label={t('Véhicule')}>{vehicule ? ltr(vehicule.matricule || '#' + vehicule.id) : (mission.vehiculeId ? '#' + mission.vehiculeId : null)}</Champ>
              <Champ label={t('Marque / modèle')}>{vehicule ? [vehicule.marque, vehicule.modele].filter(Boolean).join(' · ') || null : null}</Champ>
              <Champ label={t('Conducteur')}>{nomConducteur}</Champ>
              <Champ label={t('Matricule')}>{conducteur?.matricule || null}</Champ>
            </div>
          </section>

          <section className="vmf-carte">
            <h4><Calendar size={15} /> {t('Période')}</h4>
            <div className="vmf-champs">
              <Champ label={t('Départ prévu')}>{dateHeure(mission.dateDebut)}</Champ>
              <Champ label={t('Retour prévu')}>{dateHeure(mission.dateFin)}</Champ>
              <Champ label={t('Départ réel')}>{dateHeure(mission.dateDebutReel)}</Champ>
              <Champ label={t('Retour réel')}>{dateHeure(mission.dateFinReel)}</Champ>
            </div>
          </section>

          <section className="vmf-carte">
            <h4><Gauge size={15} /> {t('Kilométrage')}</h4>
            <div className="vmf-champs">
              <Champ label={t('Départ')}>{mission.kilometrageDepart != null ? nombre(mission.kilometrageDepart) + ' ' + t('km') : null}</Champ>
              <Champ label={t('Retour')}>{mission.kilometrageRetour != null ? nombre(mission.kilometrageRetour) + ' ' + t('km') : null}</Champ>
              <Champ label={t('Distance parcourue')}>{parcouru != null ? nombre(parcouru) + ' ' + t('km') : null}</Champ>
              <Champ label={t('Consommation')}>{conso != null ? nombre(conso, 1) + ' ' + t('L/100 km') : null}</Champ>
            </div>
          </section>

          <section className="vmf-carte">
            <h4><FileText size={15} /> {t('Informations')}</h4>
            <div className="vmf-champs">
              <Champ label={t('Créée le')}>{dateHeure(mission.dateCreation)}</Champ>
              <Champ label={t('Créée par')}>{mission.personnelCreationNom || null}</Champ>
              {mission.motif && <Champ label={t('Motif')} large>{mission.motif}</Champ>}
              {mission.motifExecution && <Champ label={t("Motif d'exécution")} large>{mission.motifExecution}</Champ>}
              <Champ label={t('Observations')} large>{mission.commentaire || null}</Champ>
            </div>
          </section>
        </div>

        {/* Carburant */}
        <section className="vmf-section">
          <h4><Fuel size={15} /> {t('Bons de carburant')} <span className="vmf-compte">{bons.length}</span></h4>
          {chargement ? (
            <div className="vmf-vide"><Loader2 size={18} className="vmf-tourne" /> {t('Chargement...')}</div>
          ) : bons.length === 0 ? (
            <div className="vmf-vide"><Inbox size={18} /> {t('Aucun plein pour cette mission.')}</div>
          ) : (
            <div className="vmf-table-wrap">
              <table className="vmf-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th><th>{t('Station')}</th><th>{t('Carburant')}</th>
                    <th className="vmf-num">{t('Litres')}</th><th className="vmf-num">{t('Kilométrage')}</th><th className="vmf-num">{t('Montant')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bons.map((b) => (
                    <tr key={b.id}>
                      <td>{dateHeure(b.date)}</td>
                      <td>{b.station || '—'}</td>
                      <td>{b.typeCarburant != null ? t(carburantTypeLabel(b.typeCarburant)) : '—'}</td>
                      <td className="vmf-num">{b.litres != null ? nombre(b.litres, 2) : '—'}</td>
                      <td className="vmf-num">{b.kilometrage != null ? nombre(b.kilometrage) : '—'}</td>
                      <td className="vmf-num"><strong>{nombre(b.montant, 2)} {t('DT')}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t('Total')}</td>
                    <td className="vmf-num">{nombre(totaux.litres, 2)}</td>
                    <td />
                    <td className="vmf-num"><strong>{nombre(totaux.carburant, 2)} {t('DT')}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Amendes */}
        <section className="vmf-section">
          <h4><Receipt size={15} /> {t('Amendes')} <span className="vmf-compte">{amendes.length}</span></h4>
          {chargement ? (
            <div className="vmf-vide"><Loader2 size={18} className="vmf-tourne" /> {t('Chargement...')}</div>
          ) : amendes.length === 0 ? (
            <div className="vmf-vide"><Inbox size={18} /> {t('Aucune amende pour cette mission.')}</div>
          ) : (
            <div className="vmf-table-wrap">
              <table className="vmf-table">
                <thead>
                  <tr>
                    <th>{t('N°')}</th><th>{t("Date de l'infraction")}</th><th>{t('Type')}</th><th>{t('Lieu')}</th>
                    <th>{t('Statut')}</th><th>{t('Date limite')}</th><th className="vmf-num">{t('Montant')}</th>
                  </tr>
                </thead>
                <tbody>
                  {amendes.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{ltr(a.num) || '—'}</strong>{a.referencePv && <small className="vmf-sous">{t('PV')} {ltr(a.referencePv)}</small>}</td>
                      <td>{dateHeure(a.dateInfraction)}</td>
                      <td>{t(TYPES_INFRACTION[a.type] ?? '—')}</td>
                      <td>{a.lieu || '—'}</td>
                      <td>
                        <span className={`vmf-statut vmf-statut--${STATUT_AMENDE_CLS[a.statut] ?? 'annulee'}`}>{t(STATUTS_AMENDE[a.statut] ?? '—')}</span>
                        {a.enRetard && <span className="vmf-statut vmf-statut--retard">{t('En retard')}</span>}
                      </td>
                      <td>{dateSeule(a.dateLimitePaiement)}</td>
                      <td className="vmf-num"><strong>{nombre(a.montant, 3)} {t('DT')}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>{t('Total')}</td>
                    <td className="vmf-num"><strong>{nombre(totaux.montantAmendes, 3)} {t('DT')}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageModal>
  );
}
