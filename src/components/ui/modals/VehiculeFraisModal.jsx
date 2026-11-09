import { useMemo } from 'react';
import { CalendarRange, FileText, ShieldCheck, Wallet } from 'lucide-react';
import ModaleFormulaire from '../../commun/ModaleFormulaire';
import { commePage, obtenirVehicules } from '../../../store/referentiels';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import { TYPES_FRAIS, ltr } from '../../../constants/Coutlibelles';

/*
 * Saisie d'un frais fixe : assurance, vignette, visite technique ou autre (fenêtre décrite par ses champs).
 * La période couverte (facultative) permet de répartir le montant : une assurance annuelle
 * ne pèse que pour les mois de la période regardée.
 *
 * vehicules : liste donnée par la page appelante (sinon GET /api/vehicule) · vehiculeIdInitial : véhicule proposé à la création.
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

const trierVehicules = (l) => [...l].sort((a, b) => String(a.matricule || '').localeCompare(String(b.matricule || ''), locale(), { numeric: true }));
const nomVehicule = (v) => [ltr(v.matricule), v.marque].filter(Boolean).join(' · ') || t('Véhicule #{id}', { id: v.id });

const SECTIONS = [
  { cle: 'general', label: 'Frais', icone: Wallet, description: 'Assurance, vignette, visite technique… : ils entrent dans le coût total du véhicule.' },
  { cle: 'periode', label: 'Période couverte', icone: CalendarRange, description: 'Facultatif : avec une période, le montant est réparti jour par jour.' },
  { cle: 'references', label: 'Références', icone: FileText, description: 'Fournisseur, numéro de pièce et commentaire.' },
];

/** Début et fin : les deux ou aucun, et la fin après le début. */
const validerPeriode = (cote) => (v, valeurs) => {
  const { periodeDebut: debut, periodeFin: fin } = valeurs;
  if (!!debut !== !!fin) return (cote === 'debut' ? !debut : !fin) ? t('Indiquez le début et la fin, ou laissez les deux vides.') : null;
  if (cote === 'fin' && debut && fin && fin < debut) return t('La fin est avant le début.');
  return null;
};

function champs(vehicules) {
  return [
    {
      nom: 'vehiculeId', label: 'Véhicule', type: 'recherche', requis: true, section: 'general', largeur: 'pleine',
      messageRequis: t('Choisissez le véhicule.'), optionLabel: nomVehicule, placeholder: 'Rechercher un véhicule...',
      ...(vehicules.length
        ? { options: trierVehicules(vehicules) }
        : { chargerOptions: () => obtenirVehicules().then(commePage).then((p) => trierVehicules(p?.content ?? (Array.isArray(p) ? p : []))), cleOptions: 'frais-vehicules' }),
    },
    { nom: 'type', label: 'Type de frais', type: 'liste', requis: true, section: 'general', defaut: '1', traduireOptions: true,
      options: Object.entries(TYPES_FRAIS).map(([value, label]) => ({ value, label })) },
    { nom: 'montant', label: 'Montant', unite: 'DT', type: 'montant', requis: true, section: 'general', messageRequis: t('Indiquez un montant positif.'),
      valider: (v) => (Number(String(v).replace(',', '.')) > 0 ? null : t('Indiquez un montant positif.')) },
    { nom: 'dateFrais', label: 'Payé le', type: 'date', requis: true, section: 'general', defaut: aujourdhui(), messageRequis: t('Indiquez la date du paiement.') },
    // ── Période couverte ──
    { nom: 'periodeDebut', label: 'Du', type: 'date', section: 'periode', valider: validerPeriode('debut') },
    { nom: 'periodeFin', label: 'Au', type: 'date', section: 'periode', valider: validerPeriode('fin') },
    {
      nom: 'unAn', label: '', type: 'personnalise', section: 'periode', largeur: 'pleine', envoyer: false,
      rendu: ({ valeurs, changerChamp }) => (
        <div className="cf-bloc">
          <p className="cf-aide">{t('Avec une période, le montant est réparti jour par jour : une assurance annuelle de 1 200 DT compte pour 300 DT sur un trimestre. Sans période, il compte entier à la date du paiement.')}</p>
          <button type="button" className="cm-btn" onClick={() => {
            const debut = valeurs.periodeDebut || valeurs.dateFrais;
            changerChamp('periodeDebut', debut);
            changerChamp('periodeFin', unAnApres(debut));
          }}>
            <CalendarRange size={16} /> {t('Couvre un an')}
          </button>
        </div>
      ),
    },
    // ── Références ──
    { nom: 'fournisseur', label: 'Assureur, centre, fournisseur', section: 'references' },
    { nom: 'reference', label: 'N° de police, quittance ou facture', section: 'references' },
    { nom: 'commentaire', label: 'Commentaire', type: 'zone', lignes: 2, section: 'references', largeur: 'pleine' },
  ];
}

export default function VehiculeFraisModal({ frais, vehicules = [], vehiculeIdInitial, onClose, onSave }) {
  const liste = useMemo(() => champs(vehicules), [vehicules]);
  const initiales = useMemo(() => (vehiculeIdInitial ? { vehiculeId: vehiculeIdInitial } : null), [vehiculeIdInitial]);

  const enregistrer = (payload, { creation }) => {
    const ctx = authService.getContexteMetier();
    const user = authService.getCurrentUser?.();
    return onSave({
      ...payload,
      ...(creation ? { personnelCreationId: ctx.userId ?? null, personnelCreationNom: user?.userNom || ctx.user || null } : {}),
    });
  };

  return (
    <ModaleFormulaire
      ouvert
      onFermer={onClose}
      icone={ShieldCheck}
      titres={{ creation: t('Ajouter un frais'), modification: t('Modifier le frais') }}
      champs={liste}
      sections={SECTIONS}
      objet={frais || null}
      initiales={initiales}
      taille="lg"
      libelleEnregistrer={t('Enregistrer')}
      onEnregistrer={enregistrer}
    />
  );
}
