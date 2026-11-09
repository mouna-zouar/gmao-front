import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, CircleCheck } from 'lucide-react';
import { Badge, ModaleFormulaire, PageListe } from '../../commun';
import formationService from '../../../services/formationService';
import equipementService from '../../../services/equipementService';
import { ICONES_MODULES } from '../../../constants/modules';
import ChampParticipants from './ChampParticipants';
import ChampCibles from './ChampCibles';
import {
  RESULTATS_FORMATION, STATUTS_FORMATION, TYPES_FORMATION, libelleCibles, options, periodeFormation,
} from './formationLibelles';
import { t, locale } from '../../../i18n';
import './Formations.css';

/*
 * Formations des techniciens : une session, plusieurs participants (chacun avec son résultat).
 * Les familles et équipements visés (plusieurs) indiquent sur quels appareils la formation habilite ceux qui l'ont réussie.
 */

const SECTIONS = [
  { cle: 'general', label: 'Formation' },
  { cle: 'participants', label: 'Participants' },
];

const CHAMPS = [
  { nom: 'intitule', label: 'Intitulé', requis: true, longueurMax: 255, largeur: 'pleine', autoFocus: true },
  { nom: 'type', label: 'Type', type: 'liste', options: options(TYPES_FORMATION), traduireOptions: true, defaut: 'INTERNE', numerique: false, requis: true },
  { nom: 'statut', label: 'Statut', type: 'liste', options: options(STATUTS_FORMATION), traduireOptions: true, defaut: 'PLANIFIEE', numerique: false, requis: true },
  { nom: 'organisme', label: 'Organisme', longueurMax: 255 },
  { nom: 'dateDebut', label: 'Date de début', type: 'date' },
  {
    nom: 'dateFin', label: 'Date de fin', type: 'date',
    valider: (v, vs) => (v && vs.dateDebut && v < vs.dateDebut ? t('La date de fin est avant la date de début.') : null),
  },
  { nom: 'dureeHeures', label: 'Durée', type: 'nombre', unite: 'h', min: 0, pas: '0.5' },
  { nom: 'cout', label: 'Coût', type: 'montant', unite: 'DT', min: 0 },
  {
    nom: 'familles', label: 'Familles d’équipements', type: 'personnalise', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampCibles id={id} mode="famille" valeur={valeur} changer={changer} chargerOptions={() => equipementService.familles()} />,
  },
  {
    nom: 'equipements', label: 'Équipements', type: 'personnalise', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampCibles id={id} mode="equipement" valeur={valeur} changer={changer} />,
  },
  { nom: 'commentaire', label: 'Commentaire', type: 'zone', largeur: 'pleine', lignes: 3 },
  {
    nom: 'participants', type: 'personnalise', section: 'participants', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampParticipants id={id} valeur={valeur} changer={changer} />,
  },
];

const nombre = (v, d = 1) => (v == null ? '' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

export default function Formations() {
  const [formations, setFormations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreTechnicien, setFiltreTechnicien] = useState('');
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setFormations(await formationService.getAll());
    } catch (e) {
      console.error('[GMAO formations] Chargement :', e);
      setErreur(t('Impossible de charger les formations.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  /* Techniciens présents dans au moins une formation (filtre) */
  const techniciens = useMemo(() => {
    const m = new Map();
    formations.forEach((f) => (f.participants || []).forEach((p) => m.set(String(p.personnelId), p.personnelNom || `#${p.personnelId}`)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], locale()));
  }, [formations]);

  const lignes = formations
    .filter((f) => !filtreStatut || f.statut === filtreStatut)
    .filter((f) => !filtreTechnicien || (f.participants || []).some((p) => String(p.personnelId) === filtreTechnicien));

  const compte = (s) => formations.filter((f) => f.statut === s).length;
  const heures = formations.filter((f) => f.statut === 'REALISEE')
    .reduce((n, f) => n + (f.dureeHeures || 0) * (f.participants || []).filter((p) => p.resultat !== 'ABSENT').length, 0);
  const basculer = (s) => setFiltreStatut((v) => (v === s ? '' : s));

  const colonnes = [
    { cle: 'intitule', label: 'Intitulé', filtre: 'texte', valeur: (f) => f.intitule, rendu: (f) => <strong className="fo-intitule">{f.intitule}</strong> },
    {
      cle: 'type', label: 'Type', filtre: 'liste', valeur: (f) => t(TYPES_FORMATION[f.type]?.label || f.type || ''),
      rendu: (f) => (TYPES_FORMATION[f.type] ? <Badge ton={TYPES_FORMATION[f.type].ton}>{t(TYPES_FORMATION[f.type].label)}</Badge> : <span className="cl-tiret">—</span>),
    },
    {
      cle: 'cibles', label: 'Familles et équipements', filtre: 'texte', valeur: (f) => libelleCibles(f),
      rendu: (f) => {
        const cibles = [...(f.familles || []), ...(f.equipements || [])];
        if (!cibles.length) return <span className="fo-general">{t('Formation générale')}</span>;
        return (
          <span className="fo-cellule-cibles" title={libelleCibles(f)}>
            {(f.familles || []).map((c) => <Badge key={`f${c.id}`} ton="teal">{c.nom || `#${c.id}`}</Badge>)}
            {(f.equipements || []).map((c) => <Badge key={`e${c.id}`} ton="bleu">{c.nom || `#${c.id}`}</Badge>)}
          </span>
        );
      },
    },
    { cle: 'organisme', label: 'Organisme', filtre: 'texte', valeur: (f) => f.organisme || '' },
    { cle: 'periode', label: 'Dates', valeur: (f) => f.dateDebut || f.dateFin || '', texte: periodeFormation },
    { cle: 'duree', label: 'Durée', valeur: (f) => f.dureeHeures ?? null, texte: (f) => (f.dureeHeures == null ? '' : `${nombre(f.dureeHeures)} h`) },
    {
      cle: 'participants', label: 'Participants', valeur: (f) => (f.participants || []).length,
      texte: (f) => (f.participants || []).map((p) => p.personnelNom).filter(Boolean).join(', '),
      rendu: (f) => {
        const ps = f.participants || [];
        if (!ps.length) return <span className="cl-tiret">—</span>;
        const reussis = ps.filter((p) => p.resultat === 'REUSSI').length;
        return (
          <span className="fo-cellule-participants" title={ps.map((p) => `${p.personnelNom || `#${p.personnelId}`} · ${t(RESULTATS_FORMATION[p.resultat]?.label || '')}`).join('\n')}>
            <b>{ps.length}</b>
            {f.statut === 'REALISEE' && <Badge ton={reussis === ps.length ? 'vert' : 'ambre'}>{t('{n} réussi(s)', { n: reussis })}</Badge>}
          </span>
        );
      },
    },
    {
      cle: 'statut', label: 'Statut', filtre: 'liste', valeur: (f) => t(STATUTS_FORMATION[f.statut]?.label || f.statut || ''),
      rendu: (f) => (STATUTS_FORMATION[f.statut] ? <Badge ton={STATUTS_FORMATION[f.statut].ton}>{t(STATUTS_FORMATION[f.statut].label)}</Badge> : <span className="cl-tiret">—</span>),
    },
    { cle: 'cout', label: 'Coût', visible: false, valeur: (f) => f.cout ?? null, texte: (f) => (f.cout == null ? '' : `${nombre(f.cout, 3)} DT`) },
  ];

  const enregistrer = async (payload, { creation }) => {
    if (creation) await formationService.create(payload);
    else await formationService.update(fenetre.objet.id, payload);
    await charger();
  };

  return (
    <PageListe
      classe="fo-page"
      icone={ICONES_MODULES.formations}
      titre={t('Formations des techniciens')}
      stats={[
        { label: t('Toutes'), valeur: formations.length, actif: !filtreStatut, onClick: () => setFiltreStatut('') },
        { label: t('Planifiées'), valeur: compte('PLANIFIEE'), ton: 'ambre', icone: CalendarClock, actif: filtreStatut === 'PLANIFIEE', onClick: () => basculer('PLANIFIEE') },
        { label: t('Réalisées'), valeur: compte('REALISEE'), ton: 'vert', icone: CircleCheck, actif: filtreStatut === 'REALISEE', onClick: () => basculer('REALISEE') },
        { label: t('Annulées'), valeur: compte('ANNULEE'), ton: 'gris', icone: Ban, actif: filtreStatut === 'ANNULEE', onClick: () => basculer('ANNULEE') },
        { label: t('Heures de formation'), valeur: `${nombre(heures)} h`, ton: 'teal' },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      filtres={techniciens.length > 0 && (
        <select value={filtreTechnicien} onChange={(e) => setFiltreTechnicien(e.target.value)} aria-label={t('Technicien')}>
          <option value="">{t('Tous les techniciens')}</option>
          {techniciens.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouvelle formation')}
      onModifier={(f) => setFenetre({ ouverte: true, objet: f })}
      onSupprimer={async (f) => { await formationService.remove(f.id); await charger(); }}
      messageSuppression={(f) => t('Supprimer la formation « {nom} » et ses participants ? Cette action est irréversible.', { nom: f.intitule })}
      recherchePlaceholder={t('Rechercher une formation...')}
      cleStockage="formations"
      nomExport="formations"
      triInitial={{ cle: 'periode', sens: 'desc' }}
      vide={{ aucun: t('Aucune formation pour l’instant.'), aucunFiltre: t('Aucune formation ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.formations}
        surtitres={{ creation: t('Nouvelle formation'), modification: t('Modification') }}
        titres={{ creation: t('Créer une formation'), modification: fenetre.objet?.intitule || t('Modifier la formation') }}
        sections={SECTIONS.map((s) => ({ ...s, label: t(s.label) }))}
        champs={CHAMPS}
        objet={fenetre.objet}
        taille="lg"
        onEnregistrer={enregistrer}
      />
    </PageListe>
  );
}
