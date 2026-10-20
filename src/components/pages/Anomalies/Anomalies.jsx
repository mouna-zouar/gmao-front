import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Cpu, Eye, LoaderCircle, Search, TriangleAlert, Users } from 'lucide-react';
import anomalieService from '../../../services/Anomalieservice';
import { t, tp } from '../../../i18n';
import {
  VeillePage, VeilleKpis, VeilleSegments, VeilleVide, VeilleMessage, Pastille, Jauge,
  dateCourte, dateHeure, ilYa,
} from '../../ui/Veille/Veille';

/* ---------- Libellés et couleurs ---------- */
const SEVERITE = {
  CRITIQUE: { label: 'Critique', ton: 'danger', rang: 3 },
  ELEVEE: { label: 'Élevée', ton: 'orange', rang: 2 },
  MODEREE: { label: 'Modérée', ton: 'attention', rang: 1 },
};
const STATUT = {
  NOUVELLE: { label: 'À traiter', ton: 'info' },
  VUE: { label: 'Vue', ton: 'neutre' },
  IGNOREE: { label: 'Ignorée', ton: 'neutre' },
};
const TYPE = {
  EQUIPEMENT: { label: 'Équipement', icone: Cpu },
  SERVICE: { label: 'Service', icone: Users },
};

/** Combien de fois la normale (7 réclamations pour 1,2 habituellement → × 5,8). */
function multipleNormale(a) {
  const moyenne = Number(a.moyenneHistorique);
  if (!moyenne || moyenne <= 0) return null;
  return Number(a.nombreReclamations || 0) / moyenne;
}

export default function Anomalies({ isModal = false }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseMessage, setAnalyseMessage] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('TOUTES');
  const [filtreSeverite, setFiltreSeverite] = useState(null);
  const [enCours, setEnCours] = useState(null);

  const chargerAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await anomalieService.getAll(0, 50);
      setAnomalies(page.content ?? []);
    } catch (err) {
      console.error('Erreur chargement anomalies :', err);
      setError(t("Impossible de charger les anomalies."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { chargerAnomalies(); }, [chargerAnomalies]);

  const lancerAnalyse = async () => {
    setAnalysing(true);
    setAnalyseMessage(null);
    try {
      const nouvelles = await anomalieService.analyserMaintenant();
      setAnalyseMessage(
        nouvelles.length === 0
          ? t("Analyse terminée : aucune nouvelle anomalie détectée.")
          : t('Analyse terminée : {resultat}.', { resultat: tp('nouvelle anomalie', nouvelles.length) })
      );
      await chargerAnomalies();
    } catch (err) {
      console.error('Erreur analyse anomalies :', err);
      setAnalyseMessage(t("Échec de l'analyse. Réessaie plus tard."));
    } finally {
      setAnalysing(false);
    }
  };

  const changerStatut = async (id, statut) => {
    setEnCours(id);
    try {
      const updated = await anomalieService.changerStatut(id, statut);
      setAnomalies((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      console.error('Erreur changement statut anomalie :', err);
    } finally {
      setEnCours(null);
    }
  };

  const compte = useMemo(() => {
    const c = { total: anomalies.length, NOUVELLE: 0, VUE: 0, IGNOREE: 0, CRITIQUE: 0, ELEVEE: 0, MODEREE: 0 };
    anomalies.forEach((a) => {
      c[a.statut] = (c[a.statut] || 0) + 1;
      c[a.severite] = (c[a.severite] || 0) + 1;
    });
    return c;
  }, [anomalies]);

  // À traiter d'abord, puis les plus graves, puis les plus récentes
  const affichees = useMemo(() => anomalies
    .filter((a) => filtreStatut === 'TOUTES' || a.statut === filtreStatut)
    .filter((a) => !filtreSeverite || a.severite === filtreSeverite)
    .sort((x, y) => (Number(y.statut === 'NOUVELLE') - Number(x.statut === 'NOUVELLE'))
      || ((SEVERITE[y.severite]?.rang ?? 0) - (SEVERITE[x.severite]?.rang ?? 0))
      || String(y.dateDetection || '').localeCompare(String(x.dateDetection || ''))),
  [anomalies, filtreStatut, filtreSeverite]);

  const multipleMax = Math.max(2, ...affichees.map((a) => multipleNormale(a) ?? 0));
  const basculerSeverite = (s) => setFiltreSeverite((v) => (v === s ? null : s));

  const boutonAnalyse = (
    <button type="button" className="vl-btn vl-btn--primaire" onClick={lancerAnalyse} disabled={analysing}>
      {analysing ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
      {analysing ? t("Analyse en cours") : t("Lancer l'analyse")}
    </button>
  );

  return (
    <VeillePage
      isModal={isModal}
      icone={TriangleAlert}
      titre={t("Détection d'anomalies")}
      description={t("Pics anormaux de réclamations par équipement ou par service, détectés automatiquement chaque jour à 6h.")}
      actions={boutonAnalyse}
    >
      {!error && (
        <VeilleKpis
          label={t("Résumé des anomalies")}
          items={[
            { cle: 'nouvelles', label: t("À traiter"), valeur: compte.NOUVELLE, ton: 'info', actif: filtreStatut === 'NOUVELLE', onClick: () => setFiltreStatut((v) => (v === 'NOUVELLE' ? 'TOUTES' : 'NOUVELLE')) },
            { cle: 'critique', label: t("Critiques"), valeur: compte.CRITIQUE, ton: 'danger', actif: filtreSeverite === 'CRITIQUE', onClick: () => basculerSeverite('CRITIQUE') },
            { cle: 'elevee', label: t("Élevées"), valeur: compte.ELEVEE, ton: 'orange', actif: filtreSeverite === 'ELEVEE', onClick: () => basculerSeverite('ELEVEE') },
            { cle: 'moderee', label: t("Modérées"), valeur: compte.MODEREE, ton: 'attention', actif: filtreSeverite === 'MODEREE', onClick: () => basculerSeverite('MODEREE') },
            { cle: 'total', label: t("Total"), valeur: compte.total, ton: 'neutre', aide: t("sur les 50 dernières") },
          ]}
        />
      )}

      <div className="vl-barre">
        <VeilleSegments
          label={t("Filtrer par statut")}
          valeur={filtreStatut}
          onChange={setFiltreStatut}
          options={[
            { cle: 'TOUTES', label: t("Toutes"), n: compte.total },
            { cle: 'NOUVELLE', label: t("À traiter"), n: compte.NOUVELLE },
            { cle: 'VUE', label: t("Vues"), n: compte.VUE },
            { cle: 'IGNOREE', label: t("Ignorées"), n: compte.IGNOREE },
          ]}
        />
        <div className="vl-barre__droite">
          {filtreSeverite && (
            <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" onClick={() => setFiltreSeverite(null)}>
              {t("Toutes les gravités")}
            </button>
          )}
          <span className="vl-barre__note">{t("Analyse automatique chaque jour à 6h")}</span>
          {isModal && boutonAnalyse}
        </div>
      </div>

      {analyseMessage && <VeilleMessage onFermer={() => setAnalyseMessage(null)}>{analyseMessage}</VeilleMessage>}

      {loading ? (
        <div className="vl-chargement"><LoaderCircle size={18} className="vl-tourne" aria-hidden="true" /> {t("Chargement...")}</div>
      ) : error ? (
        <VeilleMessage ton="danger">{error}</VeilleMessage>
      ) : affichees.length === 0 ? (
        <div className="vl-liste">
          <VeilleVide>
            {filtreStatut !== 'TOUTES' || filtreSeverite
              ? t("Aucune anomalie pour ce filtre.")
              : t('Aucune anomalie détectée pour le moment.')}
          </VeilleVide>
        </div>
      ) : (
        <ul className="vl-liste" style={{ '--vl-colonnes': '40px minmax(0, 1fr) 200px 100px 180px' }}>
          {affichees.map((a) => {
            const sev = SEVERITE[a.severite] || { label: a.severite, ton: 'neutre' };
            const statut = STATUT[a.statut] || { label: a.statut, ton: 'neutre' };
            const type = TYPE[a.type] || { label: a.type, icone: Cpu };
            const TypeIcone = type.icone;
            const multiple = multipleNormale(a);
            return (
              <li key={a.id} className={`vl-ligne ${a.statut !== 'NOUVELLE' ? 'is-calme' : ''}`} data-ton={sev.ton}>
                <span className="vl-ligne__icone" title={t(type.label)}><TypeIcone size={18} aria-hidden="true" /></span>

                <div className="vl-ligne__principal">
                  <div className="vl-ligne__titre-ligne">
                    <h3 className="vl-ligne__titre" title={a.cibleNom}>{a.cibleNom}</h3>
                    <Pastille ton={sev.ton}>{t(sev.label)}</Pastille>
                  </div>
                  <div className="vl-ligne__sous">
                    <span>{t(type.label)}</span>
                    <span title={dateHeure(a.dateDetection)}>{t("Détectée")} {ilYa(a.dateDetection) || dateCourte(a.dateDetection)}</span>
                    <span>{t("Période")} {dateCourte(a.periodeDebut)} <span className="rtl-miroir">→</span> {dateCourte(a.periodeFin)}</span>
                  </div>
                </div>

                <div className="vl-mesure" data-ton={sev.ton}>
                  <div className="vl-mesure__haut">
                    <span className="vl-mesure__valeur">{a.nombreReclamations}</span>
                    <span className="vl-mesure__unite">{t("réclamations en 7 jours")}</span>
                  </div>
                  <Jauge valeur={multiple ? (multiple / multipleMax) * 100 : 0} ton={sev.ton} label={t("Écart à la normale")} />
                  <span className="vl-mesure__note">
                    {multiple
                      ? t('× {n} la normale ({m} / semaine)', { n: multiple.toFixed(1), m: a.moyenneHistorique ?? 0 })
                      : t('Normale : {m} / semaine', { m: a.moyenneHistorique ?? 0 })}
                  </span>
                </div>

                <Pastille ton={statut.ton}>{t(statut.label)}</Pastille>

                <div className="vl-actions">
                  {a.statut === 'NOUVELLE' && (
                    <button type="button" className="vl-btn vl-btn--petit" onClick={() => changerStatut(a.id, 'VUE')} disabled={enCours === a.id}>
                      <Eye size={14} aria-hidden="true" /> {t("Vue")}
                    </button>
                  )}
                  {(a.statut === 'NOUVELLE' || a.statut === 'VUE') && (
                    <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" onClick={() => changerStatut(a.id, 'IGNOREE')} disabled={enCours === a.id}>
                      <Ban size={14} aria-hidden="true" /> {t("Ignorer")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </VeillePage>
  );
}
