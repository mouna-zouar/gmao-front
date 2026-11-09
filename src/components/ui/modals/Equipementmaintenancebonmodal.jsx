import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Info, Stethoscope, Wrench } from 'lucide-react';
import ModaleFormulaire from '../../commun/ModaleFormulaire';
import authService from '../../../services/Authservice';
import equipementMaintenanceService, { URGENCE_OPTIONS } from '../../../services/equipementMaintenanceService';
import { t, locale } from '../../../i18n';

/*
 * Demande de maintenance préventive réglementaire d'un équipement médical (calibration,
 * contrôle qualité...), saisie depuis la fiche équipement. Fenêtre décrite par ses champs.
 *
 * immobilisation : { id, designation, marque, modele, dateExploitation }
 * onCreated(resultat) après création — resultat = { bon, declenchement, ... }
 */

function versDateHeure(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(locale()) : '—');

const SECTIONS = [
  { cle: 'equipement', label: 'Équipement', icone: Stethoscope, description: 'Informations reprises automatiquement de la fiche' },
  { cle: 'demande', label: 'Demande', icone: Wrench, description: 'Opération, motif, urgence et date de demande' },
];

/** Bon déjà en cours pour le type choisi : on ne peut pas en créer un second. */
const bonEnCours = (statut) => statut?.statut === 'EN_COURS' && statut?.bonMaintenanceId != null;

function champs(immobilisation, types, statuts, chargement) {
  const statutDe = (typeId) => statuts.find((s) => String(s.typeId) === String(typeId)) ?? null;
  const typeDe = (typeId) => types.find((x) => String(x.id) === String(typeId));
  const nom = immobilisation.designation || `#${immobilisation.id}`;
  return [
    // ── Équipement : lecture seule ──
    {
      nom: 'fiche', label: '', type: 'personnalise', section: 'equipement', largeur: 'pleine', envoyer: false,
      rendu: () => (
        <>
          <dl className="cf-lecture">
            <div><dt><Stethoscope size={13} /> {t('Équipement')}</dt><dd><strong>{nom}</strong></dd></div>
            {immobilisation.marque && <div><dt>{t('Marque / Modèle')}</dt><dd>{[immobilisation.marque, immobilisation.modele].filter(Boolean).join(' ')}</dd></div>}
            <div><dt><Calendar size={13} /> {t('Mise en exploitation')}</dt><dd>{fmtDate(immobilisation.dateExploitation)}</dd></div>
          </dl>
          <p className="cf-note"><Info size={14} aria-hidden="true" /> {t("Ces champs ne sont pas modifiables ici. La date d'intervention sera enregistrée à la clôture du bon pour recalculer la prochaine échéance.")}</p>
        </>
      ),
    },
    // ── Demande ──
    {
      nom: 'typeId', label: 'Type de maintenance', type: 'liste', section: 'demande', largeur: 'pleine', desactive: chargement,
      optionVide: chargement ? 'Chargement...' : '— Hors référentiel (demande ponctuelle) —',
      options: types, optionLabel: (x) => t('{libelle} — tous les {n} jours', { libelle: x.libelle, n: Number(x.intervalleJours).toLocaleString(locale()) }),
      valider: (v) => (bonEnCours(statutDe(v))
        ? t('Un bon est déjà en cours pour « {type} » sur cet équipement (bon n°{bon}). Clôturez-le ou choisissez un autre type.', { type: statutDe(v).typeLibelle, bon: statutDe(v).bonMaintenanceId })
        : null),
    },
    {
      nom: 'situation', label: '', type: 'personnalise', section: 'demande', largeur: 'pleine', envoyer: false,
      visible: (v) => (!chargement && types.length === 0) || !!statutDe(v.typeId),
      rendu: ({ valeurs }) => {
        const s = statutDe(valeurs.typeId);
        if (!s) return <p className="cf-aide">{t('Aucun type actif pour cet équipement. La demande sera créée hors référentiel.')}</p>;
        if (bonEnCours(s)) return <p className="cf-erreur"><AlertTriangle size={13} aria-hidden="true" /> {t('Un bon est déjà en cours pour cette opération (n°{bon}).', { bon: s.bonMaintenanceId })}</p>;
        return (
          <p className="cf-aide">
            {t('Prochaine échéance le {date}', { date: fmtDate(s.prochaineEcheance) })} —{' '}
            {s.joursRestants >= 0
              ? t('il reste {n} jour(s) avant le déclenchement automatique.', { n: s.joursRestants })
              : t('échéance dépassée de {n} jour(s).', { n: Math.abs(s.joursRestants) })}
          </p>
        );
      },
    },
    {
      nom: 'description', label: 'Motif / Description', type: 'zone', requis: true, section: 'demande', largeur: 'pleine', lignes: 5,
      messageRequis: t('Le motif / la description de la demande est obligatoire.'),
      placeholder: "Dérive constatée lors d'un contrôle, calibration anticipée avant une campagne, vérification suite incident...",
    },
    { nom: 'urgence', label: "Niveau d'urgence", type: 'liste', section: 'demande', defaut: '2', options: URGENCE_OPTIONS, traduireOptions: true, optionVide: '— Non renseigné —' },
    { nom: 'dateDemande', label: 'Date de demande', type: 'dateheure', section: 'demande', defaut: versDateHeure(new Date()) },
    {
      nom: 'reinitialiserEcheance', label: '', type: 'case', section: 'demande', largeur: 'pleine', defaut: true,
      visible: (v) => v.typeId !== '' && v.typeId != null,
      texteCase: 'Cette intervention compte comme une exécution de ce type : à la clôture du bon, la prochaine échéance sera recalculée.',
      aide: 'Décochez si la demande ne remplace pas le contrôle périodique (le cycle préventif restera inchangé).',
      transformer: (v, valeurs) => (valeurs.typeId === '' || valeurs.typeId == null ? false : !!v),
    },
    {
      nom: 'recap', label: '', type: 'personnalise', section: 'demande', largeur: 'pleine', envoyer: false,
      rendu: ({ valeurs }) => (
        <dl className="cf-recap">
          <div><dt>{t('Équipement')}</dt><dd>{nom}</dd></div>
          <div><dt>{t('Opération')}</dt><dd>{typeDe(valeurs.typeId)?.libelle ?? t('Demande ponctuelle')}</dd></div>
          <div><dt>{t('Urgence')}</dt><dd>{t(URGENCE_OPTIONS.find((o) => String(o.value) === String(valeurs.urgence))?.label ?? '—')}</dd></div>
        </dl>
      ),
    },
  ];
}

export default function EquipementMaintenanceBonModal({ isOpen, onClose, immobilisation, onCreated }) {
  const [types, setTypes] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [chargement, setChargement] = useState(false);

  // Types de maintenance applicables et situation préventive de l'équipement, à chaque ouverture
  useEffect(() => {
    if (!isOpen || !immobilisation?.id) return undefined;
    let annule = false;
    setChargement(true);
    Promise.all([
      equipementMaintenanceService.getTypesApplicables(immobilisation.id),
      equipementMaintenanceService.getStatuts(immobilisation.id).catch(() => []),
    ])
      .then(([ty, st]) => { if (!annule) { setTypes((ty ?? []).filter((x) => x.actif !== false)); setStatuts(st ?? []); } })
      .catch((err) => { console.error('Erreur chargement des types de maintenance :', err); if (!annule) setTypes([]); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [isOpen, immobilisation?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liste = useMemo(() => (immobilisation ? champs(immobilisation, types, statuts, chargement) : []), [immobilisation, types, statuts, chargement, isOpen]);

  if (!isOpen || !immobilisation) return null;

  const enregistrer = async (payload) => {
    const resultat = await equipementMaintenanceService.creerBonManuel(immobilisation.id, {
      ...payload,
      personnelDemandantNom: authService.getSession()?.login ?? null,
    });
    onCreated?.(resultat);
  };

  return (
    <ModaleFormulaire
      ouvert={isOpen}
      onFermer={onClose}
      icone={Wrench}
      surtitres={{ creation: t('Maintenance préventive') }}
      titres={{ creation: t('Créer un bon de maintenance') }}
      sousTitre={immobilisation.designation || `#${immobilisation.id}`}
      champs={liste}
      sections={SECTIONS}
      objet={null}
      libelleEnregistrer={t('Créer le bon')}
      onEnregistrer={enregistrer}
    />
  );
}
