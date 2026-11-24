import { GraduationCap, Users, Wrench } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, ModaleFormulaire, PageListe } from '../../commun';
import formationService from '../../../services/formationService';
import equipementService from '../../../services/equipementService';
import { ICONES_MODULES } from '../../../constants/modules';
import ChampParticipants from './ChampParticipants';
import ChampCibles from './ChampCibles';
import {
  RESULTATS_FORMATION, STATUTS_FORMATION, TYPES_FORMATION, options, periodeFormation,
} from './formationLibelles';
import { obtenirEquipements } from '../../../store/referentiels';
import { t, locale } from '../../../i18n';
import './Formations.css';

const SECTIONS = [
  { cle: 'general', label: 'Formation', icone: GraduationCap, description: 'Le sujet de la formation, qui la donne et quand elle a lieu.' },
  { cle: 'cibles', label: 'Équipements visés', icone: Wrench, description: 'Les familles et équipements sur lesquels la formation habilite ceux qui la réussissent. Rien : formation générale.' },
  { cle: 'participants', label: 'Participants', icone: Users, description: 'Les techniciens inscrits et, une fois la formation réalisée, leur résultat.' },
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
    nom: 'familles', label: 'Familles d’équipements', type: 'personnalise', section: 'cibles', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampCibles id={id} mode="famille" valeur={valeur} changer={changer} chargerOptions={() => equipementService.familles()} />,
  },
  {
    nom: 'equipements', label: 'Équipements', type: 'personnalise', section: 'cibles', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampCibles id={id} mode="equipement" valeur={valeur} changer={changer} />,
  },
  { nom: 'commentaire', label: 'Commentaire', type: 'zone', largeur: 'pleine', lignes: 3 },
  {
    nom: 'participants', type: 'personnalise', section: 'participants', largeur: 'pleine', defaut: [],
    rendu: ({ valeur, changer, id }) => <ChampParticipants id={id} valeur={valeur} changer={changer} />,
  },
];

const initiales = (nom) => {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return ((mots[0][0] || '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
};

function CelluleParticipants({ participants, realisee }) {
  const ps = participants || [];
  if (!ps.length) return <span className="cl-tiret">—</span>;
  const MAX = 5;
  const visibles = ps.slice(0, MAX);
  const reste = ps.length - visibles.length;
  const reussis = ps.filter((p) => p.resultat === 'REUSSI').length;
  const bulle = ps.map((p) => `${p.personnelNom || `#${p.personnelId}`} · ${t(RESULTATS_FORMATION[p.resultat]?.label || '')}`).join('\n');
  return (
    <div className="fo-part" title={bulle} tabIndex={0} aria-label={bulle}>
      <span className="fo-part__pile">
        {visibles.map((p) => (
          <span key={p.personnelId} className={`fo-part__av fo-part__av--${RESULTATS_FORMATION[p.resultat]?.ton || 'gris'}`}>
            {initiales(p.personnelNom)}
          </span>
        ))}
        {reste > 0 && <span className="fo-part__av fo-part__av--plus">+{reste}</span>}
      </span>
      <span className="fo-part__texte">
        <span className="fo-part__nb"><b>{ps.length}</b> {ps.length > 1 ? t('participants') : t('participant')}</span>
        {realisee && (
          <span className="fo-part__reussite">
            <span className="fo-part__barre"><span style={{ width: `${Math.round((reussis / ps.length) * 100)}%` }} /></span>
            {t('{r}/{n} réussi(s)', { r: reussis, n: ps.length })}
          </span>
        )}
      </span>
    </div>
  );
}

function CelluleCibles({ familles, equipements, nomFamille, nomEquipement }) {
  const fs = familles || [];
  const es = equipements || [];
  if (!fs.length && !es.length) return <span className="fo-general">{t('Formation générale')}</span>;
  const premier = es.length ? nomEquipement(es[0]) : nomFamille(fs[0]);
  const autres = es.length + fs.length - 1;
  const resume = [
    es.length ? (es.length > 1 ? t('{n} équipements', { n: es.length }) : t('1 équipement')) : null,
    fs.length ? (fs.length > 1 ? t('{n} familles', { n: fs.length }) : t('1 famille')) : null,
  ].filter(Boolean).join(' · ');
  const bulle = [
    es.length ? `${t('Équipements')} :\n${es.map((c) => `• ${nomEquipement(c)}`).join('\n')}` : null,
    fs.length ? `${t('Familles')} :\n${fs.map((c) => `• ${nomFamille(c)}`).join('\n')}` : null,
  ].filter(Boolean).join('\n\n');
  return (
    <div className="fo-cib" title={bulle} tabIndex={0} aria-label={bulle}>
      <span className="fo-cib__ligne">
        <span className={`fo-cib__point ${es.length ? 'is-equipement' : 'is-famille'}`} aria-hidden="true" />
        <span className="fo-cib__nom">{premier}</span>
        {autres > 0 && <span className="fo-cib__plus">+{autres}</span>}
      </span>
      <small>{resume}</small>
    </div>
  );
}

const nombre = (v, d = 1) => (v == null ? '' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

export default function Formations() {
  const [formations, setFormations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
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

  const [equipementsParId, setEquipementsParId] = useState({});
  const [famillesParId, setFamillesParId] = useState({});
  useEffect(() => {
    obtenirEquipements()
      .then((l) => setEquipementsParId(Object.fromEntries((l || []).map((e) => [String(e.id), e]))))
      .catch(() => {});
    equipementService.familles()
      .then((l) => setFamillesParId(Object.fromEntries((l || []).map((f) => [String(f.id), f]))))
      .catch(() => {});
  }, []);
  const nomEquipement = (c) => {
    const e = equipementsParId[String(c.id)];
    return e?.designation || (c.nom && !/^#\d+$/.test(c.nom) ? c.nom : null) || t('Équipement #{id}', { id: c.id });
  };
  const nomFamille = (c) => famillesParId[String(c.id)]?.nom || (c.nom && !/^#\d+$/.test(c.nom) ? c.nom : null) || t('Famille #{id}', { id: c.id });

  const techniciens = useMemo(() => {
    const m = new Map();
    formations.forEach((f) => (f.participants || []).forEach((p) => m.set(String(p.personnelId), p.personnelNom || `#${p.personnelId}`)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], locale()));
  }, [formations]);

  const lignes = formations
    .filter((f) => !filtreTechnicien || (f.participants || []).some((p) => String(p.personnelId) === filtreTechnicien));


  const colonnes = [
    {
      cle: 'intitule', label: 'Intitulé', filtre: 'texte', valeur: (f) => f.intitule,
      rendu: (f) => (
        <span className="fo-intitule-bloc">
          <strong className="fo-intitule">{f.intitule}</strong>
          {(f.organisme || f.dureeHeures != null) && (
            <small>{[f.organisme, f.dureeHeures != null ? `${nombre(f.dureeHeures)} h` : null].filter(Boolean).join(' · ')}</small>
          )}
        </span>
      ),
    },
    {
      cle: 'type', label: 'Type', filtre: 'liste', valeur: (f) => t(TYPES_FORMATION[f.type]?.label || f.type || ''),
      rendu: (f) => (TYPES_FORMATION[f.type] ? <Badge ton={TYPES_FORMATION[f.type].ton}>{t(TYPES_FORMATION[f.type].label)}</Badge> : <span className="cl-tiret">—</span>),
    },
    {
      cle: 'cibles', label: 'Équipements visés', filtre: 'texte',
      valeur: (f) => [...(f.equipements || []).map(nomEquipement), ...(f.familles || []).map(nomFamille)].join(', ') || t('Formation générale'),
      rendu: (f) => <CelluleCibles familles={f.familles} equipements={f.equipements} nomFamille={nomFamille} nomEquipement={nomEquipement} />,
    },
    { cle: 'organisme', label: 'Organisme', visible: false, filtre: 'texte', valeur: (f) => f.organisme || '' },
    { cle: 'periode', label: 'Dates', valeur: (f) => f.dateDebut || f.dateFin || '', texte: periodeFormation },
    { cle: 'duree', label: 'Durée', visible: false, valeur: (f) => f.dureeHeures ?? null, texte: (f) => (f.dureeHeures == null ? '' : `${nombre(f.dureeHeures)} h`) },
    {
      cle: 'participants', label: 'Participants', valeur: (f) => (f.participants || []).length,
      texte: (f) => (f.participants || []).map((p) => `${p.personnelNom || `#${p.personnelId}`} (${t(RESULTATS_FORMATION[p.resultat]?.label || '')})`).join(', '),
      rendu: (f) => <CelluleParticipants participants={f.participants} realisee={f.statut === 'REALISEE'} />,
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
      sansEntete
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
        titres={{ creation: t('Nouvelle formation'), modification: t('Modifier la formation') }}
        sousTitre={fenetre.objet?.intitule || null}
        sections={SECTIONS.map((s) => ({ ...s, label: t(s.label), description: t(s.description) }))}
        champs={CHAMPS}
        objet={fenetre.objet}
        taille="lg"
        etapes
        libelleEnregistrer={fenetre.objet ? t('Mettre à jour') : t('Créer la formation')}
        onEnregistrer={enregistrer}
      />
    </PageListe>
  );
}
