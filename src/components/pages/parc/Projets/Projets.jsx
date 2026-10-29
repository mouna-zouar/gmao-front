import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Building2, Calendar, CheckCircle2, FileText, Hourglass, MapPin, XCircle } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import projetService from '../../../../services/projetService';
import { commePage, obtenirEmplacements, obtenirPrestataires } from '../../../../store/referentiels';
import { ModaleFormulaire, PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import './Projets.css';

/* Projets : page liste et fenêtre de la bibliothèque commune (src/components/commun). */

const ETATS = [
  { value: 0, label: 'Planifié', classe: 'planned', Icone: Hourglass },
  { value: 1, label: 'En cours', classe: 'running', Icone: Activity },
  { value: 2, label: 'Terminé', classe: 'done', Icone: CheckCircle2 },
  { value: 3, label: 'Annulé', classe: 'cancelled', Icone: XCircle },
];
const etatDe = (v) => ETATS.find((e) => e.value === Number(v)) || ETATS[0];

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const nomPrestataire = (p) => (p ? (p.raisonSociale || p.nom || '') : '');

const SECTIONS = [
  { cle: 'identification', label: 'Identification', icone: FileText, description: 'Code, nom et description du projet' },
  { cle: 'affectation', label: 'Affectation', icone: Building2, description: 'Prestataire et emplacement concernés' },
  { cle: 'periode', label: 'Période & état', icone: Calendar, description: 'Dates prévues et avancement' },
];

const CHAMPS = [
  { nom: 'code', label: 'Code', type: 'texte', placeholder: 'Ex : PRJ-2026-001', longueurMax: 50, section: 'identification' },
  { nom: 'nom', label: 'Nom', type: 'texte', requis: true, longueurMax: 200, section: 'identification', autoFocus: true },
  { nom: 'description', label: 'Description', type: 'zone', largeur: 'pleine', section: 'identification' },
  {
    nom: 'prestataireId', label: 'Prestataire', type: 'liste', section: 'affectation', largeur: 'pleine', cleOptions: 'prestataires',
    chargerOptions: () => obtenirPrestataires(), optionValeur: 'id', optionLabel: nomPrestataire,
    optionVide: '— Aucun prestataire —',
  },
  {
    nom: 'emplacementId', label: 'Emplacement', type: 'liste', section: 'affectation', largeur: 'pleine', cleOptions: 'emplacements', sansCache: true,
    chargerOptions: () => obtenirEmplacements(), optionValeur: 'id', optionLabel: (e) => e.nom || e.adresse,
    optionVide: '— Aucun emplacement —',
  },
  { nom: 'dateDebut', label: 'Début', type: 'dateheure', section: 'periode' },
  {
    nom: 'dateFin', label: 'Fin', type: 'dateheure', section: 'periode',
    valider: (v, tout) => (v && tout.dateDebut && v < tout.dateDebut ? t('La date de fin ne peut pas être antérieure à la date de début.') : null),
  },
  { nom: 'etat', label: 'État du projet', type: 'liste', section: 'periode', defaut: '0', requis: true, traduireOptions: true, options: ETATS },
];

export default function Projets() {
  const [projets, setProjets] = useState([]);
  const [prestataires, setPrestataires] = useState({});
  const [emplacements, setEmplacements] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreEtat, setFiltreEtat] = useState('all');
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [page, presta, empl] = await Promise.all([
        projetService.getAll(0, 500), obtenirPrestataires(), obtenirEmplacements().then(commePage),
      ]);
      setProjets(page.content ?? []);
      setPrestataires(Object.fromEntries((presta ?? []).map((p) => [p.id, p])));
      setEmplacements(Object.fromEntries((empl.content ?? []).map((e) => [e.id, e])));
    } catch {
      setErreur(t('Impossible de charger les projets. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo(() => [
    { cle: 'code', label: 'Code', valeur: (p) => p.code, rendu: (p) => <span className="prj-cell-code">{p.code || '—'}</span> },
    {
      cle: 'nom', label: 'Nom', valeur: (p) => [p.nom, p.description].filter(Boolean).join(' '),
      rendu: (p) => (
        <div className="prj-cell-project">
          <div className="prj-cell-project-icon"><FileText size={14} strokeWidth={2.2} /></div>
          <div className="prj-cell-project-text">
            <span className="prj-cell-main">{p.nom || '—'}</span>
            {p.description && <span className="prj-cell-sub">{p.description}</span>}
          </div>
        </div>
      ),
    },
    {
      cle: 'prestataire', label: 'Prestataire', valeur: (p) => nomPrestataire(prestataires[p.prestataireId]),
      rendu: (p) => (prestataires[p.prestataireId]
        ? <div className="prj-cell-presta"><Building2 size={14} strokeWidth={2.2} /><span>{nomPrestataire(prestataires[p.prestataireId])}</span></div>
        : <span className="prj-cell-empty">—</span>),
    },
    {
      cle: 'emplacement', label: 'Emplacement', valeur: (p) => { const e = emplacements[p.emplacementId]; return e ? (e.nom || e.adresse) : ''; },
      rendu: (p) => { const e = emplacements[p.emplacementId]; return e
        ? <div className="prj-cell-emplacement"><MapPin size={14} strokeWidth={2.2} /><span>{e.nom || e.adresse}</span></div>
        : <span className="prj-cell-empty">—</span>; },
    },
    {
      cle: 'periode', label: 'Période', recherche: false, valeur: (p) => (p.dateDebut ? new Date(p.dateDebut).getTime() : 0),
      texte: (p) => `${formatDate(p.dateDebut)} → ${formatDate(p.dateFin)}`,
      rendu: (p) => (
        <div className="prj-cell-period">
          <span className="prj-period-badge start"><Calendar size={11} strokeWidth={2.5} />{formatDate(p.dateDebut)}</span>
          <span className="prj-period-sep rtl-miroir">→</span>
          <span className="prj-period-badge end"><Calendar size={11} strokeWidth={2.5} />{formatDate(p.dateFin)}</span>
        </div>
      ),
    },
    {
      cle: 'etat', label: 'État', recherche: false, valeur: (p) => t(etatDe(p.etat).label),
      rendu: (p) => { const e = etatDe(p.etat); const Ic = e.Icone; return (
        <span className={`prj-pill ${e.classe}`}><Ic size={12} strokeWidth={2.5} className={p.etat === 1 ? 'prj-spin' : ''} />{t(e.label)}</span>
      ); },
    },
  ], [prestataires, emplacements]);

  const lignes = filtreEtat === 'all' ? projets : projets.filter((p) => String(p.etat) === filtreEtat);
  const compte = (v) => projets.filter((p) => p.etat === v).length;
  const basculer = (v) => setFiltreEtat((f) => (f === v ? 'all' : v));

  const enregistrer = async (payload, { creation }) => {
    if (creation) await projetService.create(payload);
    else await projetService.update(fenetre.objet.id, payload);
    await charger();
  };

  return (
    <PageListe
      icone={ICONES_MODULES.projets}
      titre={t('Projets')}
      sousTitre={t('Gestion des projets et leur affectation')}
      stats={[
        { label: t('Total'), valeur: projets.length, actif: filtreEtat === 'all', onClick: () => setFiltreEtat('all') },
        { label: t('Planifiés'), valeur: compte(0), ton: 'orange', icone: Hourglass, actif: filtreEtat === '0', onClick: () => basculer('0') },
        { label: t('En cours'), valeur: compte(1), ton: 'bleu', icone: Activity, actif: filtreEtat === '1', onClick: () => basculer('1') },
        { label: t('Terminés'), valeur: compte(2), ton: 'vert', icone: CheckCircle2, actif: filtreEtat === '2', onClick: () => basculer('2') },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      filtres={(
        <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label={t('État')}>
          <option value="all">{t('Tous les états')}</option>
          {ETATS.map((e) => <option key={e.value} value={e.value}>{t(e.label)}</option>)}
        </select>
      )}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Nouveau projet')}
      onModifier={(p) => setFenetre({ ouverte: true, objet: p })}
      onSupprimer={async (p) => { await projetService.remove(p.id); await charger(); }}
      messageSuppression={(p) => t('Supprimer le projet « {nom} » ? Cette action est irréversible.', { nom: p.nom || p.code })}
      cleStockage="projets"
      nomExport="projets"
      vide={{ aucun: t('Aucun projet pour l’instant.'), aucunFiltre: t('Aucun projet ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.projets}
        surtitres={{ creation: t('Nouveau projet'), modification: t('Modification') }}
        titres={{ creation: t('Créer un projet'), modification: t('Modifier le projet') }}
        sections={SECTIONS}
        champs={CHAMPS}
        objet={fenetre.objet}
        onEnregistrer={enregistrer}
      />
    </PageListe>
  );
}
