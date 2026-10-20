import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Clock, Flame, LoaderCircle, RefreshCw, ShieldAlert, Sparkles, TrendingDown, TrendingUp, TriangleAlert, Minus } from 'lucide-react';
import risqueService from '../../../services/Risqueservice';
import anomalieService from '../../../services/Anomalieservice';
import rcaCapaService from '../../../services/rcaCapaService';
import { t, tp } from '../../../i18n';
import {
  VeillePage, VeilleKpis, VeilleVide, VeilleMessage, Panneau, Pastille, Jauge,
  dateCourte, dateHeure, ilYa,
} from '../../ui/Veille/Veille';

/* ---------- Config ---------- */
const TOP_RISQUE_LIMITE = 30;
// Parmi le top risque, combien d'équipements on croise avec le RCA (1 appel réseau
// par équipement croisé — on borne pour ne pas multiplier les appels sur un gros parc).
const NB_CROISEMENTS_RCA = 20;
const ACTIONS_CLOSES = new Set(['TERMINEE', 'VERIFIEE_EFFICACE', 'VERIFIEE_INEFFICACE']);

const NIVEAU = {
  CRITIQUE: { label: 'Critique', ton: 'danger' },
  ELEVE: { label: 'Élevé', ton: 'orange' },
  MODERE: { label: 'Modéré', ton: 'attention' },
  FAIBLE: { label: 'Faible', ton: 'succes' },
};
const SEVERITE = {
  CRITIQUE: { label: 'Critique', ton: 'danger' },
  ELEVEE: { label: 'Élevée', ton: 'orange' },
  MODEREE: { label: 'Modérée', ton: 'attention' },
};
const TYPE_ANOMALIE_LABELS = { EQUIPEMENT: 'Équipement', SERVICE: 'Service' };
const TENDANCE = {
  HAUSSE: { label: 'En hausse', icone: TrendingUp },
  BAISSE: { label: 'En baisse', icone: TrendingDown },
  STABLE: { label: 'Stable', icone: Minus },
};

function ScoreRond({ score, ton }) {
  return (
    <span className="vl-score" data-ton={ton} style={{ '--score': Math.max(0, Math.min(100, Number(score) || 0)) }}>
      <span>{score ?? '—'}</span>
    </span>
  );
}

const allerA = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Intelligence({ isModal = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [risques, setRisques] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [actionsEnRetard, setActionsEnRetard] = useState([]);
  const [pointsChauds, setPointsChauds] = useState([]);
  const [croisementEnCours, setCroisementEnCours] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPointsChauds([]);
    try {
      const [risquesData, anomaliesPage, retardData] = await Promise.all([
        risqueService.getRisques(TOP_RISQUE_LIMITE),
        anomalieService.getAll(0, 50),
        rcaCapaService.getActionsEnRetard(),
      ]);
      setRisques(risquesData ?? []);
      setAnomalies((anomaliesPage?.content ?? []).filter((a) => a.statut === 'NOUVELLE'));
      setActionsEnRetard(retardData ?? []);
    } catch (err) {
      console.error('Erreur chargement dashboard Intelligence :', err);
      setError(t("Impossible de charger le dashboard Intelligence."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Croisement risque × RCA : parmi les équipements les plus à risque, lesquels ont
  // aussi une analyse RCA avec au moins une action encore ouverte ?
  useEffect(() => {
    if (risques.length === 0) return undefined;
    let annule = false;
    const candidats = risques
      .filter((r) => r.niveauRisque === 'CRITIQUE' || r.niveauRisque === 'ELEVE')
      .slice(0, NB_CROISEMENTS_RCA);
    if (candidats.length === 0) return undefined;

    setCroisementEnCours(true);
    Promise.all(candidats.map((r) =>
      rcaCapaService.getParEquipement(r.lotArticleImmobilistationId)
        .then((analyses) => ({ risque: r, analyses: analyses ?? [] }))
        .catch(() => ({ risque: r, analyses: [] }))
    )).then((resultats) => {
      if (annule) return;
      const chauds = resultats
        .map(({ risque, analyses }) => {
          const actionsOuvertes = analyses.flatMap((a) => a.actions || []).filter((a) => !ACTIONS_CLOSES.has(a.statut));
          return { risque, nbAnalyses: analyses.length, nbActionsOuvertes: actionsOuvertes.length };
        })
        .filter((c) => c.nbActionsOuvertes > 0 || c.nbAnalyses > 0)
        .sort((a, b) => (b.risque.scoreRisque || 0) - (a.risque.scoreRisque || 0));
      setPointsChauds(chauds);
    }).finally(() => {
      if (!annule) setCroisementEnCours(false);
    });
    return () => { annule = true; };
  }, [risques]);

  const risquesCritiques = useMemo(
    () => risques.filter((r) => r.niveauRisque === 'CRITIQUE' || r.niveauRisque === 'ELEVE'),
    [risques]
  );

  const boutonRafraichir = (
    <button type="button" className="vl-btn" onClick={charger} disabled={loading}>
      {loading ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
      {loading ? t("Chargement") : t("Rafraîchir")}
    </button>
  );

  const chargementOuVide = (vide) => (loading
    ? <div className="vl-chargement"><LoaderCircle size={16} className="vl-tourne" aria-hidden="true" /> {t("Chargement...")}</div>
    : <VeilleVide icone={CircleCheck}>{vide}</VeilleVide>);

  return (
    <VeillePage
      isModal={isModal}
      icone={Sparkles}
      titre={t("Intelligence")}
      description={t("Croise les signaux des modules Risques, Anomalies et RCA/CAPA plutôt que de les laisser dans 3 endroits séparés — pour repérer les équipements qui cumulent plusieurs signaux d'alerte en même temps.")}
      actions={boutonRafraichir}
    >
      {isModal && (
        <div className="vl-barre">
          <span className="vl-barre__note">
            {t("Repère les équipements qui cumulent plusieurs signaux d'alerte : risque de panne, anomalies et actions correctives en retard.")}
          </span>
          {boutonRafraichir}
        </div>
      )}

      {error && <VeilleMessage ton="danger">{error}</VeilleMessage>}

      <VeilleKpis
        label={t("Résumé")}
        items={[
          { cle: 'chauds', label: t("Points chauds"), valeur: loading || croisementEnCours ? '…' : pointsChauds.length, ton: pointsChauds.length ? 'danger' : 'succes', aide: t("risque élevé + RCA ouverte"), onClick: () => allerA('vl-intel-chauds') },
          { cle: 'anomalies', label: t("Anomalies non traitées"), valeur: loading ? '…' : anomalies.length, ton: anomalies.length ? 'orange' : 'succes', onClick: () => allerA('vl-intel-anomalies') },
          { cle: 'capa', label: t("Actions CAPA en retard"), valeur: loading ? '…' : actionsEnRetard.length, ton: actionsEnRetard.length ? 'danger' : 'succes', onClick: () => allerA('vl-intel-capa') },
          { cle: 'risque', label: t("Équipements à risque élevé/critique"), valeur: loading ? '…' : risquesCritiques.length, ton: risquesCritiques.length ? 'orange' : 'succes', onClick: () => allerA('vl-intel-risques') },
        ]}
      />

      {/* ---------- Points chauds : le croisement, mis en avant ---------- */}
      <Panneau
        id="vl-intel-chauds"
        icone={Flame}
        ton="danger"
        titre={t("Points chauds")}
        n={croisementEnCours ? null : pointsChauds.length}
        aide={t("Équipements à risque élevé/critique qui ont aussi une analyse RCA en cours — un problème récurrent qui n'est pas encore vraiment résolu.")}
      >
        {croisementEnCours ? (
          <div className="vl-chargement"><LoaderCircle size={16} className="vl-tourne" aria-hidden="true" /> {t("Croisement en cours...")}</div>
        ) : pointsChauds.length === 0 ? (
          chargementOuVide(t("Aucun croisement pour le moment — bon signe."))
        ) : (
          <ul className="vl-liste" style={{ '--vl-colonnes': '40px minmax(0, 1fr) auto' }}>
            {pointsChauds.map((c) => {
              const niv = NIVEAU[c.risque.niveauRisque] || { label: c.risque.niveauRisque, ton: 'neutre' };
              return (
                <li key={c.risque.lotArticleImmobilistationId} className="vl-ligne" data-ton={niv.ton}>
                  <ScoreRond score={c.risque.scoreRisque} ton={niv.ton} />
                  <div className="vl-ligne__principal">
                    <h3 className="vl-ligne__titre">{c.risque.designation || t('Équipement #{id}', { id: c.risque.lotArticleImmobilistationId })}</h3>
                    <div className="vl-ligne__sous">
                      <span>{t('Risque {niveau}', { niveau: t(niv.label).toLowerCase() })}</span>
                      <span>{tp('panne sur 12 mois', c.risque.nbPannes12Mois ?? 0)}</span>
                    </div>
                  </div>
                  <div className="vl-actions">
                    <Pastille ton="info" point={false}>{tp('analyse RCA', c.nbAnalyses)}</Pastille>
                    {c.nbActionsOuvertes > 0 && <Pastille ton="danger">{tp('action CAPA ouverte', c.nbActionsOuvertes)}</Pastille>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      <div className="vl-grille">
        {/* ---------- Anomalies non traitées ---------- */}
        <Panneau id="vl-intel-anomalies" icone={TriangleAlert} ton="orange" titre={t("Anomalies non traitées")} n={loading ? null : anomalies.length}>
          {anomalies.length === 0 ? chargementOuVide(t("Aucune anomalie non traitée.")) : anomalies.slice(0, 8).map((a) => {
            const sev = SEVERITE[a.severite] || { label: a.severite, ton: 'neutre' };
            return (
              <div key={a.id} className="vl-mini" data-ton={sev.ton}>
                <div className="vl-mini__corps">
                  <span className="vl-mini__titre">{a.cibleNom || `${t(TYPE_ANOMALIE_LABELS[a.type] || a.type)} #${a.cibleId}`}</span>
                  <span className="vl-mini__sous">
                    {tp('réclamation récente', a.nombreReclamations ?? 0)} {t('(moyenne habituelle {m})', { m: a.moyenneHistorique?.toFixed?.(1) ?? '—' })}
                  </span>
                </div>
                <div className="vl-mini__fin">
                  <Pastille ton={sev.ton}>{t(sev.label)}</Pastille>
                  <span className="vl-mini__sous" title={dateHeure(a.dateDetection)}>{ilYa(a.dateDetection) || dateCourte(a.dateDetection)}</span>
                </div>
              </div>
            );
          })}
        </Panneau>

        {/* ---------- Actions CAPA en retard ---------- */}
        <Panneau id="vl-intel-capa" icone={Clock} ton="danger" titre={t("Actions CAPA en retard")} n={loading ? null : actionsEnRetard.length}>
          {actionsEnRetard.length === 0 ? chargementOuVide(t("Aucune action en retard.")) : actionsEnRetard.slice(0, 8).map((a) => (
            <div key={a.id} className="vl-mini" data-ton="danger">
              <div className="vl-mini__corps">
                <span className="vl-mini__titre" title={t(a.description)}>{t(a.description)}</span>
                <span className="vl-mini__sous">
                  {a.responsable ? `${a.responsable} · ` : ''}{t('Échéance dépassée : {date}', { date: dateCourte(a.dateEcheance) })}
                </span>
              </div>
              <div className="vl-mini__fin">
                <Pastille ton={a.type === 'PREVENTIVE' ? 'info' : 'neutre'} point={false}>
                  {a.type === 'PREVENTIVE' ? t("Préventive") : t("Corrective")}
                </Pastille>
                <span className="vl-mini__sous">{ilYa(a.dateEcheance)}</span>
              </div>
            </div>
          ))}
        </Panneau>

        {/* ---------- Top équipements à risque ---------- */}
        <Panneau id="vl-intel-risques" icone={ShieldAlert} ton="orange" titre={t("Équipements les plus à risque")} n={loading ? null : Math.min(risques.length, 10)}>
          {risques.length === 0 ? chargementOuVide(t("Aucune donnée de risque disponible.")) : risques.slice(0, 10).map((r) => {
            const niv = NIVEAU[r.niveauRisque] || { label: r.niveauRisque, ton: 'neutre' };
            const tendance = TENDANCE[r.tendance];
            const IconeTendance = tendance?.icone;
            return (
              <div key={r.lotArticleImmobilistationId} className="vl-mini" data-ton={niv.ton}>
                <div className="vl-mini__corps">
                  <span className="vl-mini__titre">{r.designation || t('Équipement #{id}', { id: r.lotArticleImmobilistationId })}</span>
                  <Jauge valeur={r.scoreRisque} ton={niv.ton} label={t('Score de risque {n} sur 100', { n: r.scoreRisque })} />
                  <span className="vl-mini__sous">
                    {tp('panne sur 12 mois', r.nbPannes12Mois ?? 0)}
                    {tendance && <> · {IconeTendance && <IconeTendance size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} />} {t(tendance.label)}</>}
                  </span>
                </div>
                <div className="vl-mini__fin">
                  <span className="vl-mesure__valeur" style={{ color: 'var(--ton-texte)' }}>{r.scoreRisque}<small className="vl-mesure__unite">/100</small></span>
                  <Pastille ton={niv.ton}>{t(niv.label)}</Pastille>
                </div>
              </div>
            );
          })}
        </Panneau>
      </div>
    </VeillePage>
  );
}
