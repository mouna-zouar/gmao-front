import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CircleCheck, Eye, FileText, LoaderCircle, Search, Timer } from 'lucide-react';
import blocageImmobilisationService from '../../../services/Blocageimmobilisationservice';
import { t, tp } from '../../../i18n';
import {
  VeillePage, VeilleKpis, VeilleSegments, VeilleVide, VeilleMessage, Pastille, Jauge,
  dateCourte, ilYa,
} from '../../ui/Veille/Veille';

/* ---------- Libellés et couleurs ---------- */
const STATUT = {
  NOUVELLE: { label: 'Nouveau', ton: 'info' },
  VUE: { label: 'Vu', ton: 'neutre' },
  RESOLU: { label: 'Résolu', ton: 'succes' },
  IGNOREE: { label: 'Ignoré', ton: 'neutre' },
};
const SEUIL_LONG = 30; // au-delà, le blocage est considéré comme long
const JOURS_JAUGE = 60; // la jauge est pleine à 60 jours

const estActif = (b) => b.statut === 'NOUVELLE' || b.statut === 'VUE';
const tonJours = (b) => {
  if (!estActif(b)) return b.statut === 'RESOLU' ? 'succes' : 'neutre';
  return (b.joursBlocage ?? 0) >= SEUIL_LONG ? 'danger' : 'attention';
};

export default function BlocagesImmobilisation({ isModal = false }) {
  const [blocages, setBlocages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseMessage, setAnalyseMessage] = useState(null);
  const [filtre, setFiltre] = useState('ACTIFS');
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await blocageImmobilisationService.getAll(0, 50);
      setBlocages(page.content ?? []);
    } catch (err) {
      console.error('Erreur chargement blocages :', err);
      setError(t("Impossible de charger les blocages."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const lancerAnalyse = async () => {
    setAnalysing(true);
    setAnalyseMessage(null);
    try {
      const nouveaux = await blocageImmobilisationService.analyserMaintenant();
      setAnalyseMessage(
        nouveaux.length === 0
          ? t("Analyse terminée : aucun nouveau blocage détecté.")
          : t('Analyse terminée : {resultat}.', { resultat: tp('nouveau blocage', nouveaux.length) })
      );
      await charger();
    } catch (err) {
      console.error('Erreur analyse blocages :', err);
      setAnalyseMessage(t("Échec de l'analyse. Réessaie plus tard."));
    } finally {
      setAnalysing(false);
    }
  };

  const changerStatut = async (id, statut) => {
    setEnCours(id);
    try {
      const updated = await blocageImmobilisationService.changerStatut(id, statut);
      setBlocages((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      console.error('Erreur changement statut blocage :', err);
    } finally {
      setEnCours(null);
    }
  };

  const compte = useMemo(() => {
    const c = { total: blocages.length, actifs: 0, longs: 0, NOUVELLE: 0, VUE: 0, RESOLU: 0, IGNOREE: 0 };
    blocages.forEach((b) => {
      c[b.statut] = (c[b.statut] || 0) + 1;
      if (estActif(b)) {
        c.actifs += 1;
        if ((b.joursBlocage ?? 0) >= SEUIL_LONG) c.longs += 1;
      }
    });
    return c;
  }, [blocages]);

  // Les blocages actifs les plus anciens d'abord
  const affiches = useMemo(() => blocages
    .filter((b) => {
      if (filtre === 'TOUS') return true;
      if (filtre === 'ACTIFS') return estActif(b);
      if (filtre === 'LONGS') return estActif(b) && (b.joursBlocage ?? 0) >= SEUIL_LONG;
      return b.statut === filtre;
    })
    .sort((x, y) => (Number(estActif(y)) - Number(estActif(x))) || ((y.joursBlocage ?? 0) - (x.joursBlocage ?? 0))),
  [blocages, filtre]);

  const basculer = (cle) => setFiltre((v) => (v === cle ? 'ACTIFS' : cle));

  const boutonAnalyse = (
    <button type="button" className="vl-btn vl-btn--primaire" onClick={lancerAnalyse} disabled={analysing}>
      {analysing ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
      {analysing ? t("Analyse en cours") : t("Lancer l'analyse")}
    </button>
  );

  return (
    <VeillePage
      isModal={isModal}
      icone={Ban}
      titre={t("Blocages d'équipement")}
      description={t("Équipements dont le dernier arrêt obligatoire est resté sans suite — pas de bon rouvert, pas de remise en service conforme — depuis au moins 15 jours.")}
      actions={boutonAnalyse}
    >
      {!error && (
        <VeilleKpis
          label={t("Résumé des blocages")}
          items={[
            { cle: 'actifs', label: t("Actifs"), valeur: compte.actifs, ton: 'attention', actif: filtre === 'ACTIFS', onClick: () => setFiltre('ACTIFS') },
            { cle: 'longs', label: t('Plus de {n} jours', { n: SEUIL_LONG }), valeur: compte.longs, ton: 'danger', actif: filtre === 'LONGS', onClick: () => basculer('LONGS') },
            { cle: 'nouveaux', label: t("Nouveaux"), valeur: compte.NOUVELLE, ton: 'info', actif: filtre === 'NOUVELLE', onClick: () => basculer('NOUVELLE') },
            { cle: 'resolus', label: t("Résolus"), valeur: compte.RESOLU, ton: 'succes', actif: filtre === 'RESOLU', onClick: () => basculer('RESOLU') },
          ]}
        />
      )}

      <div className="vl-barre">
        <VeilleSegments
          label={t("Filtrer par statut")}
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { cle: 'ACTIFS', label: t("Actifs"), n: compte.actifs },
            { cle: 'NOUVELLE', label: t("Nouveaux"), n: compte.NOUVELLE },
            { cle: 'VUE', label: t("Vus"), n: compte.VUE },
            { cle: 'RESOLU', label: t("Résolus"), n: compte.RESOLU },
            { cle: 'IGNOREE', label: t("Ignorés"), n: compte.IGNOREE },
            { cle: 'TOUS', label: t("Tous"), n: compte.total },
          ]}
        />
        <div className="vl-barre__droite">
          <span className="vl-barre__note">{t("Résolus automatiquement dès qu'un bon est rouvert ou qu'une remise en service est enregistrée")}</span>
          {isModal && boutonAnalyse}
        </div>
      </div>

      {analyseMessage && <VeilleMessage onFermer={() => setAnalyseMessage(null)}>{analyseMessage}</VeilleMessage>}

      {loading ? (
        <div className="vl-chargement"><LoaderCircle size={18} className="vl-tourne" aria-hidden="true" /> {t("Chargement...")}</div>
      ) : error ? (
        <VeilleMessage ton="danger">{error}</VeilleMessage>
      ) : affiches.length === 0 ? (
        <div className="vl-liste">
          <VeilleVide icone={filtre === 'ACTIFS' ? CircleCheck : undefined}>
            {filtre === 'ACTIFS' ? t("Aucun équipement bloqué : tous les arrêts ont eu une suite.") : t("Aucun blocage pour ce filtre.")}
          </VeilleVide>
        </div>
      ) : (
        <ul className="vl-liste" style={{ '--vl-colonnes': '40px minmax(0, 1fr) 180px 90px 180px' }}>
          {affiches.map((b) => {
            const statut = STATUT[b.statut] || { label: b.statut, ton: 'neutre' };
            const ton = tonJours(b);
            const auto = b.statut === 'RESOLU' && b.personnelTraitantNom === 'Résolution automatique';
            return (
              <li key={b.id} className={`vl-ligne ${!estActif(b) ? 'is-calme' : ''}`} data-ton={ton}>
                <span className="vl-ligne__icone">
                  {b.statut === 'RESOLU' ? <CircleCheck size={18} aria-hidden="true" /> : <Ban size={18} aria-hidden="true" />}
                </span>

                <div className="vl-ligne__principal">
                  <div className="vl-ligne__titre-ligne">
                    <h3 className="vl-ligne__titre" title={b.cibleNom}>{b.cibleNom}</h3>
                  </div>
                  <div className="vl-ligne__sous">
                    <span>{t("Arrêté le")} <strong>{dateCourte(b.dateArret)}</strong></span>
                    {b.bonMaintenanceArretNum && (
                      <span><FileText size={12} aria-hidden="true" /> {t("Bon d'arrêt")} <strong>{b.bonMaintenanceArretNum}</strong></span>
                    )}
                    <span>{t("Détecté")} {ilYa(b.dateDetection) || dateCourte(b.dateDetection)}</span>
                    {auto && <span>{t("Résolu automatiquement — bon rouvert ou remise en service enregistrée.")}</span>}
                  </div>
                </div>

                <div className="vl-mesure" data-ton={ton}>
                  <div className="vl-mesure__haut">
                    <Timer size={14} aria-hidden="true" style={{ color: 'var(--ton)', alignSelf: 'center' }} />
                    <span className="vl-mesure__valeur">{b.joursBlocage ?? 0}</span>
                    <span className="vl-mesure__unite">{t("jours sans suite")}</span>
                  </div>
                  <Jauge valeur={((b.joursBlocage ?? 0) / JOURS_JAUGE) * 100} ton={ton} label={tp('jours sans suite', b.joursBlocage ?? 0)} />
                </div>

                <Pastille ton={statut.ton}>{t(statut.label)}</Pastille>

                <div className="vl-actions">
                  {b.statut === 'NOUVELLE' && (
                    <button type="button" className="vl-btn vl-btn--petit" onClick={() => changerStatut(b.id, 'VUE')} disabled={enCours === b.id}>
                      <Eye size={14} aria-hidden="true" /> {t("Vu")}
                    </button>
                  )}
                  {estActif(b) && (
                    <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" onClick={() => changerStatut(b.id, 'IGNOREE')} disabled={enCours === b.id}>
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
