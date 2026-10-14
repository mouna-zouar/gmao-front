import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Fenetre, Champ } from './VehiculeAmendeModal';
import vehiculeService from '../../../services/vehiculeService';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import { TYPES_FRAIS, ltr } from '../../../constants/Coutlibelles';
import'../modals/Vehiculeamendemodal.css';

/*
 * Saisie d'un frais fixe : assurance, vignette, visite technique ou autre.
 * La période couverte (facultative) permet de répartir le montant : une assurance annuelle
 * ne pèse que pour les mois de la période regardée.
 */

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** 2026-03-01 → 2027-02-28 : un an moins un jour */
const unAnApres = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function VehiculeFraisModal({ frais, vehicules = [], vehiculeIdInitial, onClose, onSave }) {
  const enModification = !!frais;

  // Liste des véhicules : celle donnée par la page appelante, sinon GET /api/vehicule
  const [vehiculesCharges, setVehiculesCharges] = useState([]);
  const [chargementVehicules, setChargementVehicules] = useState(vehicules.length === 0);
  const [erreurVehicules, setErreurVehicules] = useState('');
  const aDesVehicules = vehicules.length > 0;
  useEffect(() => {
    if (aDesVehicules) return undefined;
    let actif = true;
    vehiculeService.getAll(0, 1000)
      .then((page) => { if (actif) setVehiculesCharges(page?.content ?? (Array.isArray(page) ? page : [])); })
      .catch(() => { if (actif) setErreurVehicules(t('Impossible de charger la liste des véhicules.')); })
      .finally(() => { if (actif) setChargementVehicules(false); });
    return () => { actif = false; };
  }, [aDesVehicules]);
  const listeVehicules = aDesVehicules ? vehicules : vehiculesCharges;
  const [form, setForm] = useState(() => ({
    vehiculeId: String(frais?.vehiculeId ?? vehiculeIdInitial ?? ''),
    type: String(frais?.type ?? '1'),
    montant: frais?.montant ?? '',
    dateFrais: frais?.dateFrais ?? aujourdhui(),
    periodeDebut: frais?.periodeDebut ?? '',
    periodeFin: frais?.periodeFin ?? '',
    fournisseur: frais?.fournisseur ?? '',
    reference: frais?.reference ?? '',
    commentaire: frais?.commentaire ?? '',
  }));
  const [erreurs, setErreurs] = useState({});
  const [erreurServeur, setErreurServeur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const vehiculesTries = useMemo(
    () => [...listeVehicules].sort((a, b) => String(a.matricule || '').localeCompare(String(b.matricule || ''), locale(), { numeric: true })),
    [listeVehicules],
  );

  const maj = (champ, valeur) => {
    setForm((f) => ({ ...f, [champ]: valeur }));
    setErreurs((e) => (e[champ] ? { ...e, [champ]: undefined } : e));
  };

  const couvrirUnAn = () => {
    const debut = form.periodeDebut || form.dateFrais;
    setForm((f) => ({ ...f, periodeDebut: debut, periodeFin: unAnApres(debut) }));
    setErreurs((e) => ({ ...e, periodeDebut: undefined, periodeFin: undefined }));
  };

  const valider = () => {
    const e = {};
    if (!form.vehiculeId) e.vehiculeId = t('Choisissez le véhicule.');
    if (form.montant === '' || !(Number(form.montant) > 0)) e.montant = t('Indiquez un montant positif.');
    if (!form.dateFrais) e.dateFrais = t('Indiquez la date du paiement.');
    if (!!form.periodeDebut !== !!form.periodeFin) {
      e[form.periodeDebut ? 'periodeFin' : 'periodeDebut'] = t('Indiquez le début et la fin, ou laissez les deux vides.');
    } else if (form.periodeDebut && form.periodeFin < form.periodeDebut) {
      e.periodeFin = t('La fin est avant le début.');
    }
    return e;
  };

  const enregistrer = async (ev) => {
    ev.preventDefault();
    const e = valider();
    setErreurs(e);
    const premier = Object.keys(e)[0];
    if (premier) {
      document.getElementById(`vfr-${premier}`)?.focus();
      return;
    }
    const ctx = authService.getContexteMetier();
    const user = authService.getCurrentUser?.();
    setEnvoi(true);
    setErreurServeur('');
    try {
      await onSave({
        vehiculeId: Number(form.vehiculeId),
        type: Number(form.type),
        montant: Number(form.montant),
        dateFrais: form.dateFrais,
        periodeDebut: form.periodeDebut || null,
        periodeFin: form.periodeFin || null,
        fournisseur: form.fournisseur,
        reference: form.reference,
        commentaire: form.commentaire,
        ...(enModification ? {} : { personnelCreationId: ctx.userId ?? null, personnelCreationNom: user?.userNom || ctx.user || null }),
      });
      onClose();
    } catch (err) {
      setErreurServeur(err?.response?.data?.message || t("Échec de l'enregistrement."));
    } finally {
      setEnvoi(false);
    }
  };

  const aria = (champ) => ({ 'aria-invalid': !!erreurs[champ], 'aria-describedby': erreurs[champ] ? `vfr-${champ}-erreur` : undefined });

  return (
    <Fenetre
      titre={enModification ? t('Modifier le frais') : t('Ajouter un frais')}
      sousTitre={t('Assurance, vignette, visite technique… : ils entrent dans le coût total du véhicule.')}
      Icone={ShieldCheck}
      onClose={onClose}
      largeur={640}
      pied={(
        <>
          <button type="button" className="vam-bouton vam-bouton--clair" onClick={onClose} disabled={envoi}>{t('Annuler')}</button>
          <button type="submit" form="vfr-formulaire" className="vam-bouton" disabled={envoi}>
            {envoi ? <Loader2 size={16} className="vam-tourne" /> : <CheckCircle2 size={16} />}
            {t('Enregistrer')}
          </button>
        </>
      )}
    >
      <form id="vfr-formulaire" className="vam-corps" onSubmit={enregistrer} noValidate>
        {erreurServeur && <p className="vam-alerte" role="alert">{erreurServeur}</p>}
        <div className="vam-grille">
          <Champ id="vfr-vehiculeId" label={t('Véhicule')} requis erreur={erreurs.vehiculeId || erreurVehicules}>
            <select id="vfr-vehiculeId" value={form.vehiculeId} onChange={(e) => maj('vehiculeId', e.target.value)} disabled={chargementVehicules} {...aria('vehiculeId')}>
              <option value="">{chargementVehicules ? t('Chargement…') : t('— Choisir —')}</option>
              {vehiculesTries.map((v) => (
                <option key={v.id} value={v.id}>{[ltr(v.matricule), v.marque].filter(Boolean).join(' · ') || t('Véhicule #{id}', { id: v.id })}</option>
              ))}
            </select>
          </Champ>
          <Champ id="vfr-type" label={t('Type de frais')} requis>
            <select id="vfr-type" value={form.type} onChange={(e) => maj('type', e.target.value)}>
              {Object.entries(TYPES_FRAIS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </Champ>
          <Champ id="vfr-montant" label={t('Montant (DT)')} requis erreur={erreurs.montant}>
            <input id="vfr-montant" type="number" min="0" step="0.001" inputMode="decimal" value={form.montant} onChange={(e) => maj('montant', e.target.value)} {...aria('montant')} />
          </Champ>
          <Champ id="vfr-dateFrais" label={t('Payé le')} requis erreur={erreurs.dateFrais}>
            <input id="vfr-dateFrais" type="date" value={form.dateFrais} onChange={(e) => maj('dateFrais', e.target.value)} {...aria('dateFrais')} />
          </Champ>
        </div>

        <fieldset className="vam-groupe">
          <legend>{t('Période couverte (facultatif)')}</legend>
          <p className="vam-aide vfr-aide">{t('Avec une période, le montant est réparti jour par jour : une assurance annuelle de 1 200 DT compte pour 300 DT sur un trimestre. Sans période, il compte entier à la date du paiement.')}</p>
          <div className="vam-grille">
            <Champ id="vfr-periodeDebut" label={t('Du')} erreur={erreurs.periodeDebut}>
              <input id="vfr-periodeDebut" type="date" value={form.periodeDebut} onChange={(e) => maj('periodeDebut', e.target.value)} {...aria('periodeDebut')} />
            </Champ>
            <Champ id="vfr-periodeFin" label={t('Au')} erreur={erreurs.periodeFin}>
              <input id="vfr-periodeFin" type="date" value={form.periodeFin} onChange={(e) => maj('periodeFin', e.target.value)} {...aria('periodeFin')} />
            </Champ>
          </div>
          <button type="button" className="vam-bouton vam-bouton--clair vfr-un-an" onClick={couvrirUnAn}>{t('Couvre un an')}</button>
        </fieldset>

        <div className="vam-grille">
          <Champ id="vfr-fournisseur" label={t('Assureur, centre, fournisseur')}>
            <input id="vfr-fournisseur" type="text" value={form.fournisseur} onChange={(e) => maj('fournisseur', e.target.value)} />
          </Champ>
          <Champ id="vfr-reference" label={t('N° de police, quittance ou facture')}>
            <input id="vfr-reference" type="text" value={form.reference} onChange={(e) => maj('reference', e.target.value)} />
          </Champ>
          <Champ id="vfr-commentaire" label={t('Commentaire')} large>
            <textarea id="vfr-commentaire" rows={2} value={form.commentaire} onChange={(e) => maj('commentaire', e.target.value)} />
          </Champ>
        </div>
      </form>
    </Fenetre>
  );
}