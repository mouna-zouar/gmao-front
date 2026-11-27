import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarRange, Clock, Gauge, RefreshCw, Timer, Wrench } from 'lucide-react';
import FiltreLieu, { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import { Badge, PageListe } from '../../commun';
import { t, locale } from '../../../i18n';
import './IndicateursPerformance.css';
import { lireRequete } from '../../../store/referentiels';

const PERIODES = [
  { cle: '30', label: '30 derniers jours', jours: 30 },
  { cle: '90', label: '90 derniers jours', jours: 90 },
  { cle: '365', label: '12 derniers mois', jours: 365 },
  { cle: 'annee', label: 'Année en cours' },
  { cle: 'libre', label: 'Période libre' },
];
const GROUPES = { SERVICE: 'Service', FAMILLE: 'Famille', EQUIPEMENT: 'Équipement' };
const CLE_REGLAGES = 'gmao.indicateurs.reglages';

const jourIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const bornes = (periode, libre) => {
  const aujourdhui = new Date();
  if (periode === 'libre') return libre;
  if (periode === 'annee') return { debut: `${aujourdhui.getFullYear()}-01-01`, fin: jourIso(aujourdhui) };
  const jours = PERIODES.find((p) => p.cle === periode)?.jours || 90;
  const debut = new Date(aujourdhui);
  debut.setDate(debut.getDate() - (jours - 1));
  return { debut: jourIso(debut), fin: jourIso(aujourdhui) };
};

const nb = (v) => (v == null ? '' : Number(v).toLocaleString(locale(), { maximumFractionDigits: 1 }));
const pct = (v) => (v == null ? '—' : `${nb(v)} %`);
const duree = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${nb(h)} h`;
  return `${nb(h / 24)} j`;
};
const tonDispo = (v) => (v == null ? 'gris' : v >= 95 ? 'vert' : v >= 85 ? 'ambre' : 'rouge');
const tonPreventif = (v) => (v == null ? 'gris' : v >= 60 ? 'vert' : v >= 40 ? 'ambre' : 'rouge');

export default function IndicateursPerformance() {
  const memo = (() => { try { return JSON.parse(localStorage.getItem(CLE_REGLAGES) || '{}'); } catch { return {}; } })();
  const [periode, setPeriode] = useState(memo.periode || '90');
  const [libre, setLibre] = useState(memo.libre || bornes('90'));
  const [groupe, setGroupe] = useState(memo.groupe || 'SERVICE');
  const [lieuId, setLieuId] = useState('');
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const carteLieux = useCarteLieux();

  const { debut, fin } = useMemo(() => bornes(periode, libre), [periode, libre]);
  useEffect(() => {
    try { localStorage.setItem(CLE_REGLAGES, JSON.stringify({ periode, libre, groupe })); } catch {}
  }, [periode, libre, groupe]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setRapport(await lireRequete('indicateursPerformance', { debut, fin, groupe, lieuId }));
    } catch {
      setErreur(t('Impossible de calculer les indicateurs.'));
    } finally {
      setChargement(false);
    }
  }, [debut, fin, groupe, lieuId]);
  useEffect(() => { charger(); }, [charger]);

  const g = rapport?.global;
  const lignes = useMemo(() => (rapport?.lignes ?? []).map((l) => ({ ...l, id: l.cle })), [rapport]);

  const colonnes = [
    { cle: 'libelle', label: GROUPES[groupe], valeur: (l) => t(l.libelle), rendu: (l) => <strong dir="auto">{t(l.libelle)}</strong> },
    { cle: 'nbBons', label: 'Bons', alignement: 'droite', valeur: (l) => l.nbBons },
    { cle: 'nbPreventifs', label: 'Préventifs', alignement: 'droite', valeur: (l) => l.nbPreventifs, visible: false },
    { cle: 'nbCuratifs', label: 'Curatifs', alignement: 'droite', valeur: (l) => l.nbCuratifs, visible: false },
    {
      cle: 'partPreventifPct', label: 'Préventif / curatif', alignement: 'droite', valeur: (l) => l.partPreventifPct ?? -1,
      texte: (l) => (l.partPreventifPct == null ? '' : pct(l.partPreventifPct)),
      rendu: (l) => (l.partPreventifPct == null ? '—' : <Badge ton={tonPreventif(l.partPreventifPct)}>{pct(l.partPreventifPct)}</Badge>),
    },
    { cle: 'delaiInterventionHeures', label: 'Délai d’intervention', alignement: 'droite', valeur: (l) => l.delaiInterventionHeures ?? -1, texte: (l) => (l.delaiInterventionHeures == null ? '' : duree(l.delaiInterventionHeures)), rendu: (l) => duree(l.delaiInterventionHeures) },
    { cle: 'delaiResolutionHeures', label: 'Délai de résolution', alignement: 'droite', valeur: (l) => l.delaiResolutionHeures ?? -1, texte: (l) => (l.delaiResolutionHeures == null ? '' : duree(l.delaiResolutionHeures)), rendu: (l) => duree(l.delaiResolutionHeures) },
    { cle: 'nbEquipements', label: 'Équipements', alignement: 'droite', valeur: (l) => l.nbEquipements, visible: false },
    { cle: 'nbPannes', label: 'Pannes', alignement: 'droite', valeur: (l) => l.nbPannes },
    { cle: 'mtbfHeures', label: 'MTBF', alignement: 'droite', valeur: (l) => l.mtbfHeures ?? -1, texte: (l) => (l.mtbfHeures == null ? '' : duree(l.mtbfHeures)), rendu: (l) => duree(l.mtbfHeures) },
    { cle: 'mttrHeures', label: 'MTTR', alignement: 'droite', valeur: (l) => l.mttrHeures ?? -1, texte: (l) => (l.mttrHeures == null ? '' : duree(l.mttrHeures)), rendu: (l) => duree(l.mttrHeures) },
    {
      cle: 'disponibilitePct', label: 'Disponibilité', alignement: 'droite', valeur: (l) => l.disponibilitePct ?? -1,
      texte: (l) => (l.disponibilitePct == null ? '' : pct(l.disponibilitePct)),
      rendu: (l) => (l.disponibilitePct == null ? '—' : <Badge ton={tonDispo(l.disponibilitePct)}>{pct(l.disponibilitePct)}</Badge>),
    },
  ];

  const libellePeriode = (() => {
    const f = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
    return t('Du {debut} au {fin}', { debut: f(rapport?.debut || debut), fin: f(rapport?.fin || fin) });
  })();

  return (
    <PageListe
      key={groupe}
      titre={t('Indicateurs de performance')}
      sansEntete
      stats={g ? [
        { label: t('Bons'), valeur: nb(g.nbBons), icone: Wrench, ton: 'teal' },
        { label: t('Préventif / curatif'), valeur: pct(g.partPreventifPct), icone: CalendarRange, ton: g.partPreventifPct == null ? 'gris' : g.partPreventifPct >= 60 ? 'vert' : g.partPreventifPct >= 40 ? 'ambre' : 'rouge' },
        { label: t('Délai d’intervention'), valeur: duree(g.delaiInterventionHeures), icone: Clock, ton: 'bleu' },
        { label: t('Délai de résolution'), valeur: duree(g.delaiResolutionHeures), icone: Timer, ton: 'violet' },
        { label: t('MTBF'), valeur: duree(g.mtbfHeures), icone: Activity, ton: 'teal' },
        { label: t('MTTR'), valeur: duree(g.mttrHeures), icone: Wrench, ton: 'orange' },
        { label: t('Disponibilité'), valeur: pct(g.disponibilitePct), icone: Gauge, ton: g.disponibilitePct == null ? 'gris' : g.disponibilitePct >= 95 ? 'vert' : g.disponibilitePct >= 85 ? 'ambre' : 'rouge' },
      ] : []}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement && !rapport}
      erreur={erreur}
      actions={[
        { label: t('Actualiser'), icone: RefreshCw, classe: 'cl-action--teal', desactive: chargement, onClick: charger },
      ]}
      filtres={(
        <>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label={t('Période')}>
            {PERIODES.map((p) => <option key={p.cle} value={p.cle}>{t(p.label)}</option>)}
          </select>
          {periode === 'libre' && (
            <>
              <input type="date" className="ind-date" value={libre.debut} max={libre.fin} onChange={(e) => setLibre((x) => ({ ...x, debut: e.target.value }))} aria-label={t('Du')} />
              <input type="date" className="ind-date" value={libre.fin} min={libre.debut} onChange={(e) => setLibre((x) => ({ ...x, fin: e.target.value }))} aria-label={t('Au')} />
            </>
          )}
          <select value={groupe} onChange={(e) => setGroupe(e.target.value)} aria-label={t('Regrouper par')}>
            {Object.entries(GROUPES).map(([v, l]) => <option key={v} value={v}>{t('Par {x}', { x: t(l).toLowerCase() })}</option>)}
          </select>
          <FiltreLieu carte={carteLieux} valeur={lieuId} onChange={setLieuId} className="fl-select" />
        </>
      )}
      filtresImpression={[
        { label: t('Période'), valeur: libellePeriode },
        { label: t('Regrouper par'), valeur: t(GROUPES[groupe]) },
      ]}
      recherchePlaceholder={t('Rechercher...')}
      cleStockage={`indicateurs-${groupe.toLowerCase()}`}
      nomExport={`indicateurs-performance-${groupe.toLowerCase()}`}
      triInitial={{ cle: 'nbBons', sens: 'desc' }}
      vide={{ aucun: t('Aucune donnée sur cette période.'), aucunFiltre: t('Aucun élément ne correspond à ces filtres.') }}
    />
  );
}
