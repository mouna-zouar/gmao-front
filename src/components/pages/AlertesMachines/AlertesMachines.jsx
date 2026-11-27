import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ban, BellOff, CheckCheck, CircleCheck, ClipboardPlus, FileText, Globe, History, LoaderCircle, MessageSquare, Plug, RadioTower,
  RefreshCw, RotateCcw, ScrollText, Server, ServerCog, Siren, Trash2, TrendingUp, Wrench,
} from 'lucide-react';
import { FenetreActionAlerte, FenetreEscalade, JournalAlerte } from './AlerteActions';
import alerteMachineService from '../../../services/alerteMachineService';
import liaisonAgentService from '../../../services/liaisonAgentService';
import { ETATS_LIAISON, libelleType, resumeLiaison } from '../Equipements/EquipementLiaisonAgent';
import ReclamationModal from '../../ui/modals/Reclamationmodal';
import ReclamationCreeeModal from '../../ui/modals/ReclamationCreeeModal';
import { t } from '../../../i18n';
import {
  VeillePage, VeilleKpis, VeilleSegments, VeilleVide, VeilleMessage, VeillePagination, Pastille,
  dateHeure, ilYa,
} from '../../ui/Veille/Veille';
import { useExecuter } from '../../../store/hooks';
import { reclamations as moduleReclamations } from '../../../store/modules/reclamations';
import { lireRequete } from '../../../store/referentiels';

const NIVEAU = {
  CRITIQUE: { label: 'Critique', ton: 'danger', rang: 3 },
  ALERTE: { label: 'Alerte', ton: 'orange', rang: 2 },
  INFO: { label: 'Information', ton: 'info', rang: 1 },
};
const STATUT = {
  NOUVELLE: { label: 'À acquitter', ton: 'info' },
  VUE: { label: 'Acquittée', ton: 'neutre' },
  SOURDINE: { label: 'En sourdine', ton: 'neutre' },
  IGNOREE: { label: 'Ignorée', ton: 'neutre' },
  RESOLUE: { label: 'Résolue', ton: 'succes' },
  EN_MAINTENANCE: { label: 'En maintenance', ton: 'neutre' },
};
const SOURCE = {
  SNMP: { label: 'SNMP', icone: RadioTower },
  SYSLOG: { label: 'Syslog', icone: ScrollText },
  HTTP: { label: 'HTTP', icone: Globe },
  SURVEILLANCE: { label: 'Surveillance réseau', icone: Plug },
  AGENT: { label: 'Agent de terrain', icone: ServerCog },
};

const LIBELLE_MODULE = {
  RESEAU: 'Réseau', USB: 'USB / RS232', RS485: 'RS485', ALARMES: 'Alarmes Modbus', ZIGBEE: 'Zigbee',
};

function BandeauAgents({ agents, liaisons, onSupprimer, onOuvrir }) {
  if (agents === null) return null;
  if (agents.length === 0) {
    return (
      <div className="vl-agents vl-agents--vide">
        <ServerCog size={16} aria-hidden="true" />
        <span>{t('Aucun agent de terrain relié. Lancez agent-gmao sur le PC placé près des machines pour surveiller le réseau, l’USB, le RS485 ou le Zigbee.')}</span>
      </div>
    );
  }
  return (
    <section className="vl-agents" aria-label={t('Agents de terrain')}>
      {agents.map((ag) => {
        const arrete = ag.etat === 'ARRETE';
        return (
          <article key={ag.id} className={`vl-agent ${arrete ? 'is-arrete' : ''}`}>
            <span className="vl-agent__icone" aria-hidden="true"><ServerCog size={18} /></span>
            <div className="vl-agent__corps">
              <div className="vl-agent__ligne">
                <strong className="vl-agent__nom">{ag.nom}</strong>
                <Pastille ton={arrete ? 'danger' : 'succes'}>{arrete ? t('Arrêté') : t('En ligne')}</Pastille>
              </div>
              <div className="vl-agent__sous">
                <span title={dateHeure(ag.derniereActivite)}>
                  {arrete
                    ? t('Aucun signal depuis {quand}', { quand: ilYa(ag.derniereActivite) || '—' })
                    : t('Signal {quand}', { quand: ilYa(ag.derniereActivite) || '—' })}
                </span>
                {(ag.hote || ag.adresse) && <span>{[ag.hote, ag.adresse].filter(Boolean).join(' · ')}</span>}
                {ag.equipementsSurveilles != null && <span>{t('{n} équipement(s) testé(s)', { n: ag.equipementsSurveilles })}</span>}
              </div>
              {ag.modules?.length > 0 && (
                <div className="vl-agent__modules">
                  {ag.modules.map((m) => <span key={m} className="vl-agent__module">{t(LIBELLE_MODULE[m] || m)}</span>)}
                </div>
              )}
              {(() => {
                const siennes = (liaisons || []).filter((l) => l.agentNom?.toLowerCase() === ag.nom.toLowerCase() && l.actif !== false);
                if (siennes.length === 0) return null;
                return (
                  <ul className="vl-agent__liaisons" aria-label={t('Liaisons de l’agent')}>
                    {siennes.slice(0, 6).map((l) => {
                      const et = ETATS_LIAISON[l.dernierEtat] || { ton: 'neutre', label: 'Pas encore lue' };
                      const ton = et.ton === 'ok' ? 'succes' : et.ton === 'alerte' ? 'danger' : et.ton === 'attention' ? 'attention' : et.ton === 'info' ? 'info' : 'neutre';
                      return (
                        <li key={l.id}>
                          <button type="button" className="vl-agent__liaison" onClick={() => onOuvrir(l.lotArticleImmobilistationId)}
                            title={[t(libelleType(l.type)), resumeLiaison(l)].filter(Boolean).join(' · ')}>
                            <span className="vl-agent__liaison-nom">{l.equipementNom || `#${l.lotArticleImmobilistationId}`}</span>
                            <span className="vl-agent__liaison-msg">{l.dernierMessage || t(libelleType(l.type))}</span>
                          </button>
                          <Pastille ton={ton}>{t(et.label)}</Pastille>
                        </li>
                      );
                    })}
                    {siennes.length > 6 && <li className="vl-agent__plus">{t('+ {n} autre(s)', { n: siennes.length - 6 })}</li>}
                  </ul>
                );
              })()}
            </div>
            {arrete && (
              <button
                type="button"
                className="vl-btn vl-btn--petit vl-btn--discret vl-btn--icone"
                onClick={() => onSupprimer(ag)}
                title={t('Retirer cet agent (ancien PC ou agent renommé)')}
                aria-label={t('Retirer cet agent (ancien PC ou agent renommé)')}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}

function valeursDepuisAlerte(a) {
  const src = SOURCE[a.source]?.label || a.source;
  const equipement = a.equipementNom || (a.lotArticleImmobilistationId ? `#${a.lotArticleImmobilistationId}` : null);
  const niveau = a.niveau === 'CRITIQUE' ? 3 : a.niveau === 'ALERTE' ? 2 : 1;
  const lignes = [
    `${t('Alerte machine')} : ${a.message}`,
    equipement ? `${t('Équipement')} : ${equipement}${a.adresseSource ? ` (${a.adresseSource})` : ''}` : `${t('Adresse')} : ${a.adresseSource || '—'}`,
    `${t('Source')} : ${t(src)} · ${t('reçue le {date}', { date: dateHeure(a.dateReception) })}${(a.occurrences ?? 1) > 1 ? ` · ${t('{n} fois', { n: a.occurrences })}` : ''}`,
    a.code ? `${t('Code')} : ${a.code}` : null,
  ].filter(Boolean);
  return {
    lotArticleImmobilistationId: a.lotArticleImmobilistationId ?? undefined,
    immobilisation: a.lotArticleImmobilistationId ? { id: a.lotArticleImmobilistationId, designation: equipement } : undefined,
    description: lignes.join('\n'),
    criticite: niveau,
    urgence: niveau,
    type: 1,
    sourceInformation: 4,
  };
}

export default function AlertesMachines({ isModal = false }) {
  const executer = useExecuter();
  const navigate = useNavigate();
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('OUVERTES');
  const [filtreNiveau, setFiltreNiveau] = useState(null);
  const [filtreInconnues, setFiltreInconnues] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [detail, setDetail] = useState(null);
  const [alerteReclamation, setAlerteReclamation] = useState(null);
  const [agents, setAgents] = useState(null);
  const [liaisons, setLiaisons] = useState([]);
  const [filtreSource, setFiltreSource] = useState('');
  const [message, setMessage] = useState(null);
  const [reclamationCreee, setReclamationCreee] = useState(null);
  const [indic, setIndic] = useState(null);
  const [action, setAction] = useState(null);
  const [journal, setJournal] = useState(null);
  const [selection, setSelection] = useState([]);
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(10);
  const [filtreEscalade, setFiltreEscalade] = useState(false);
  const [escaladeOuverte, setEscaladeOuverte] = useState(false);
  const valeursReclamation = useMemo(() => (alerteReclamation ? valeursDepuisAlerte(alerteReclamation) : null), [alerteReclamation]);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, listeAgents, listeLiaisons, indicateurs] = await Promise.all([
        lireRequete('alertesMachines', { statut: '', page: 0, taille: 300 }),
        lireRequete('agentsMachines').catch(() => null),
        liaisonAgentService.liste().catch(() => []),
        lireRequete('indicateursAlertes').catch(() => null),
      ]);
      setAlertes(page?.content ?? []);
      setIndic(indicateurs);
      setAgents(listeAgents);
      setLiaisons(listeLiaisons);
    } catch (err) {
      console.error('Erreur chargement alertes machines :', err);
      setError(t('Impossible de charger les alertes des machines.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const minuterie = setInterval(() => { if (!document.hidden) charger(); }, 30000);
    return () => clearInterval(minuterie);
  }, [charger]);

  const appliquer = (majs) => {
    const parId = new Map((majs || []).map((m) => [m.id, m]));
    setAlertes((prev) => prev.map((a) => (parId.has(a.id) ? { ...a, ...parId.get(a.id) } : a)));
    setSelection((s) => s.filter((id) => !parId.has(id)));
    lireRequete('indicateursAlertes').then(setIndic).catch(() => {});
  };

  const acquitterVite = async (a) => {
    setEnCours(a.id);
    try {
      appliquer([await alerteMachineService.acquitter(a.id)]);
    } catch (err) {
      console.error('Erreur acquittement alerte machine :', err);
    } finally {
      setEnCours(null);
    }
  };
  const ouvrirAction = (type, liste) => setAction({ type, alertes: liste });
  const basculerSelection = (id) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const enregistrerReclamation = async (payload) => {
    const alerte = alerteReclamation;
    const creee = await executer(moduleReclamations.actions.creer(payload));
    setAlerteReclamation(null);
    const id = creee?.id ?? creee?.reclamation?.id;
    if (alerte && id) {
      try {
        appliquer([await alerteMachineService.lierReclamation(alerte.id, id)]);
      } catch (err) {
        console.error('Erreur liaison alerte / réclamation :', err);
      }
    }
    setReclamationCreee(creee || {});
  };

  const estOuverte = (a) => a.statut === 'NOUVELLE' || a.statut === 'VUE' || a.statut === 'SOURDINE';

  const agentDe = (a) => {
    if (a.source === 'AGENT') return (a.adresseSource || '').replace(/^agent:/, '');
    const m = /^\[([^\]]+)\]\s/.exec(a.message || '');
    if (!m) return null;
    return (agents || []).some((ag) => ag.nom.toLowerCase() === m[1].toLowerCase()) ? m[1] : null;
  };
  const sourceAffichee = (a) => (agentDe(a) ? 'AGENT' : a.source);

  const supprimerAgent = async (ag) => {
    if (!window.confirm(t('Retirer l’agent « {nom} » de la liste ? Il réapparaîtra s’il envoie de nouveau son signal.', { nom: ag.nom }))) return;
    try {
      await alerteMachineService.supprimerAgent(ag.id);
      setAgents((l) => (l || []).filter((x) => x.id !== ag.id));
      charger();
    } catch (err) {
      console.error('Erreur suppression agent :', err);
    }
  };

  const compte = useMemo(() => {
    const c = { total: alertes.length, ouvertes: 0, NOUVELLE: 0, VUE: 0, SOURDINE: 0, IGNOREE: 0, RESOLUE: 0, EN_MAINTENANCE: 0, CRITIQUE: 0, ALERTE: 0, inconnues: 0, escaladees: 0 };
    alertes.forEach((a) => {
      c[a.statut] = (c[a.statut] || 0) + 1;
      if (a.statut === 'NOUVELLE' && (a.niveauEscalade ?? 0) > 0) c.escaladees += 1;
      if (estOuverte(a)) {
        c.ouvertes += 1;
        c[a.niveau] = (c[a.niveau] || 0) + 1;
        if (!a.lotArticleImmobilistationId && a.source !== 'AGENT') c.inconnues += 1;
      }
    });
    return c;
  }, [alertes]);

  const affichees = useMemo(() => alertes
    .filter((a) => (filtreStatut === 'TOUTES' ? true : filtreStatut === 'OUVERTES' ? estOuverte(a) : a.statut === filtreStatut))
    .filter((a) => !filtreNiveau || a.niveau === filtreNiveau)
    .filter((a) => !filtreInconnues || (!a.lotArticleImmobilistationId && a.source !== 'AGENT'))
    .filter((a) => !filtreSource || sourceAffichee(a) === filtreSource)
    .filter((a) => !filtreEscalade || (a.statut === 'NOUVELLE' && (a.niveauEscalade ?? 0) > 0))
    .sort((x, y) => (Number(y.statut === 'NOUVELLE') - Number(x.statut === 'NOUVELLE'))
      || ((y.niveauEscalade ?? 0) - (x.niveauEscalade ?? 0))
      || ((NIVEAU[y.niveau]?.rang ?? 0) - (NIVEAU[x.niveau]?.rang ?? 0))
      || String(y.derniereReception || '').localeCompare(String(x.derniereReception || ''))),
  [alertes, filtreStatut, filtreNiveau, filtreInconnues, filtreSource, filtreEscalade, agents]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [filtreStatut, filtreNiveau, filtreInconnues, filtreSource, filtreEscalade]);
  const nbPages = Math.max(1, Math.ceil(affichees.length / taille));
  const pageCourante = Math.min(page, nbPages - 1);
  const pageAlertes = affichees.slice(pageCourante * taille, pageCourante * taille + taille);
  const aAcquitterAffichees = pageAlertes.filter((a) => a.statut === 'NOUVELLE');
  const selectionnees = alertes.filter((a) => selection.includes(a.id) && a.statut === 'NOUVELLE');
  const delaiMoyen = indic?.delaiMoyenAcquittementMinutes;
  const texteDelai = delaiMoyen == null ? '—' : delaiMoyen < 60 ? `${delaiMoyen} min` : `${Math.floor(delaiMoyen / 60)} h ${String(delaiMoyen % 60).padStart(2, '0')}`;

  const sources = useMemo(() => {
    const m = new Map();
    alertes.forEach((a) => { const s = sourceAffichee(a); m.set(s, (m.get(s) || 0) + 1); });
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [alertes, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  const basculerNiveau = (n) => { setFiltreInconnues(false); setFiltreNiveau((v) => (v === n ? null : n)); };

  const boutonRafraichir = (
    <button type="button" className="vl-btn" onClick={charger} disabled={loading}>
      {loading ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
      {t('Rafraîchir')}
    </button>
  );
  const actionsEntete = (
    <>
      <button type="button" className="vl-btn" onClick={() => setEscaladeOuverte(true)}>
        <Siren size={15} aria-hidden="true" /> {t('Escalade')}
      </button>
      {boutonRafraichir}
    </>
  );

  return (
    <VeillePage
      isModal={isModal}
      icone={RadioTower}
      titre={t('Alertes machines')}
      description={t('Warnings envoyés par les machines (SNMP, Syslog) et coupures détectées par la surveillance réseau.')}
      actions={actionsEntete}
    >
      {!error && <BandeauAgents agents={agents} liaisons={liaisons} onSupprimer={supprimerAgent} onOuvrir={(id) => navigate(`/equipement/${id}`)} />}

      {!error && (
        <VeilleKpis
          label={t('Résumé des alertes machines')}
          items={[
            { cle: 'nouvelles', label: t('À acquitter'), valeur: compte.NOUVELLE, ton: 'info', actif: filtreStatut === 'NOUVELLE', onClick: () => setFiltreStatut((v) => (v === 'NOUVELLE' ? 'OUVERTES' : 'NOUVELLE')) },
            { cle: 'escaladees', label: t('Escaladées'), valeur: compte.escaladees, ton: 'danger', actif: filtreEscalade, onClick: () => setFiltreEscalade((v) => !v) },
            { cle: 'critiques', label: t('Critiques'), valeur: compte.CRITIQUE, ton: 'danger', actif: filtreNiveau === 'CRITIQUE', onClick: () => basculerNiveau('CRITIQUE') },
            { cle: 'alertes', label: t('Alertes'), valeur: compte.ALERTE, ton: 'orange', actif: filtreNiveau === 'ALERTE', onClick: () => basculerNiveau('ALERTE') },
            { cle: 'delai', label: t('Délai moyen d’acquittement'), valeur: texteDelai, ton: 'marque', aide: t('30 derniers jours') },
            { cle: 'inconnues', label: t('Adresse inconnue'), valeur: compte.inconnues, ton: 'neutre', aide: t('aucun équipement n’a cette IP'), actif: filtreInconnues, onClick: () => { setFiltreNiveau(null); setFiltreInconnues((v) => !v); } },
          ]}
        />
      )}

      <div className="vl-barre">
        <VeilleSegments
          label={t('Filtrer par statut')}
          valeur={filtreStatut}
          onChange={setFiltreStatut}
          options={[
            { cle: 'OUVERTES', label: t('En cours'), n: compte.ouvertes },
            { cle: 'NOUVELLE', label: t('À acquitter'), n: compte.NOUVELLE },
            { cle: 'VUE', label: t('Acquittées'), n: compte.VUE },
            ...(compte.SOURDINE > 0 ? [{ cle: 'SOURDINE', label: t('En sourdine'), n: compte.SOURDINE }] : []),
            ...(compte.EN_MAINTENANCE > 0 ? [{ cle: 'EN_MAINTENANCE', label: t('En maintenance'), n: compte.EN_MAINTENANCE }] : []),
            { cle: 'RESOLUE', label: t('Résolues'), n: compte.RESOLUE },
            { cle: 'IGNOREE', label: t('Ignorées'), n: compte.IGNOREE },
            { cle: 'TOUTES', label: t('Toutes'), n: compte.total },
          ]}
        />
        {sources.length > 1 && (
          <label className="vl-select" title={t('Filtrer par source')}>
            <span className="vl-sr">{t('Filtrer par source')}</span>
            <select value={filtreSource} onChange={(e) => setFiltreSource(e.target.value)} aria-label={t('Filtrer par source')}>
              <option value="">{t('Toutes les sources')}</option>
              {sources.map(([s, n]) => <option key={s} value={s}>{t(SOURCE[s]?.label || s)} ({n})</option>)}
            </select>
          </label>
        )}
        <div className="vl-barre__droite">
          <span className="vl-barre__note">{t('Mise à jour automatique toutes les 30 secondes')}</span>
          {isModal && actionsEntete}
        </div>
      </div>

      {message && <VeilleMessage ton="succes" onFermer={() => setMessage(null)}>{message}</VeilleMessage>}

      {(selectionnees.length > 0 || aAcquitterAffichees.length > 1) && (
        <div className={`am-barre-selection${selectionnees.length === 0 ? ' am-barre-selection--calme' : ''}`}>
          {selectionnees.length > 0 ? (
            <>
              <span>{t('{n} sélectionnée(s)', { n: selectionnees.length })}</span>
              <button type="button" className="vl-btn vl-btn--petit vl-btn--primaire" onClick={() => ouvrirAction('ACQUITTER', selectionnees)}>
                <CheckCheck size={14} aria-hidden="true" /> {t('Acquitter la sélection')}
              </button>
              <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" onClick={() => setSelection([])}>{t('Désélectionner')}</button>
            </>
          ) : (
            <button type="button" className="vl-btn vl-btn--petit" onClick={() => setSelection(aAcquitterAffichees.map((a) => a.id))}>
              <CheckCheck size={14} aria-hidden="true" /> {t('Sélectionner les {n} à acquitter', { n: aAcquitterAffichees.length })}
            </button>
          )}
        </div>
      )}

      {loading && alertes.length === 0 ? (
        <div className="vl-chargement"><LoaderCircle size={18} className="vl-tourne" aria-hidden="true" /> {t('Chargement...')}</div>
      ) : error ? (
        <VeilleMessage ton="danger">{error}</VeilleMessage>
      ) : affichees.length === 0 ? (
        <div className="vl-liste">
          <VeilleVide icone={CircleCheck}>
            {alertes.length === 0
              ? t('Aucune alerte reçue pour le moment. Réglez vos machines pour envoyer leurs traps SNMP ou leur syslog vers le serveur GMAO.')
              : t('Aucune alerte pour ce filtre.')}
          </VeilleVide>
        </div>
      ) : (
        <>
        <ul className="vl-liste" style={{ '--vl-colonnes': '40px minmax(0, 1fr) 120px 150px 200px' }}>
          {pageAlertes.map((a) => {
            const niv = NIVEAU[a.niveau] || { label: a.niveau, ton: 'neutre' };
            const st = STATUT[a.statut] || { label: a.statut, ton: 'neutre' };
            const src = SOURCE[sourceAffichee(a)] || { label: a.source, icone: Server };
            const nomAgent = agentDe(a);
            const IconeSource = src.icone;
            const nom = a.equipementNom || (a.lotArticleImmobilistationId ? t('Équipement #{id}', { id: a.lotArticleImmobilistationId }) : null);
            return (
              <li key={a.id} className={`vl-ligne ${!estOuverte(a) ? 'is-calme' : ''}`} data-ton={niv.ton}>
                <span className="vl-ligne__icone" title={t(src.label)}><IconeSource size={18} aria-hidden="true" /></span>

                <div className="vl-ligne__principal">
                  <div className="vl-ligne__titre-ligne">
                    {a.statut === 'NOUVELLE' && (
                      <input type="checkbox" className="am-selection" checked={selection.includes(a.id)} onChange={() => basculerSelection(a.id)}
                        aria-label={t('Sélectionner')} title={t('Sélectionner')} />
                    )}
                    {nom ? (
                      <button type="button" className="vl-ligne__titre" onClick={() => navigate(`/equipement/${a.lotArticleImmobilistationId}`)} title={t('Ouvrir la fiche')}>
                        {nom}
                      </button>
                    ) : (
                      a.source === 'AGENT'
                        ? <h3 className="vl-ligne__titre">{t('Agent « {nom} »', { nom: nomAgent || a.adresseSource })}</h3>
                        : <h3 className="vl-ligne__titre">{t('Adresse inconnue')} <span className="vl-eq__ip"><strong>{a.adresseSource}</strong></span></h3>
                    )}
                    <Pastille ton={niv.ton}>{t(niv.label)}</Pastille>
                  </div>
                  <div className="vl-ligne__sous">
                    <span title={a.message} style={{ color: 'var(--g-texte-2)' }}>
                      {nomAgent ? String(a.message || '').replace(/^\[[^\]]+\]\s*/, '') : a.message}
                    </span>
                  </div>
                  <div className="vl-ligne__sous">
                    <span>{t(src.label)}{nomAgent ? ` · ${nomAgent}` : ''}</span>
                    {nom && a.adresseSource && <span className="vl-eq__ip"><strong>{a.adresseSource}</strong></span>}
                    <span title={dateHeure(a.dateReception)}>{t('Reçue')} {ilYa(a.dateReception) || dateHeure(a.dateReception)}</span>
                    <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" style={{ height: 22, padding: '0 6px' }} onClick={() => setJournal(journal === a.id ? null : a.id)}>
                      <History size={12} aria-hidden="true" /> {journal === a.id ? t('Masquer le journal') : t('Journal')}
                    </button>
                    {a.brut && (
                      <button type="button" className="vl-btn vl-btn--petit vl-btn--discret" style={{ height: 22, padding: '0 6px' }} onClick={() => setDetail(detail === a.id ? null : a.id)}>
                        <FileText size={12} aria-hidden="true" /> {detail === a.id ? t('Masquer le message reçu') : t('Message reçu')}
                      </button>
                    )}
                  </div>
                  {detail === a.id && <pre className="vl-alerte-brut">{a.brut}</pre>}
                  {journal === a.id && <div className="am-journal-bloc"><JournalAlerte historique={a.historique} /></div>}
                </div>

                <div className="vl-mesure" data-ton={niv.ton}>
                  <div className="vl-mesure__haut">
                    <span className="vl-mesure__valeur">× {a.occurrences ?? 1}</span>
                    <span className="vl-mesure__unite">{(a.occurrences ?? 1) > 1 ? t('fois') : t('fois (unique)')}</span>
                  </div>
                  <span className="vl-mesure__note" title={dateHeure(a.derniereReception)}>
                    {t('Dernière : {quand}', { quand: ilYa(a.derniereReception) || '—' })}
                  </span>
                </div>

                <div className="vl-alerte-statut">
                  <Pastille ton={st.ton}>{t(st.label)}</Pastille>
                  {a.statut === 'NOUVELLE' && (a.niveauEscalade ?? 0) > 0 && (
                    <span className="am-escalade" title={dateHeure(a.dateDerniereEscalade)}>
                      <TrendingUp size={11} aria-hidden="true" /> {t('Escalade niveau {n}', { n: a.niveauEscalade })}
                    </span>
                  )}
                  {a.statut === 'NOUVELLE' && (
                    <span className="am-qui" title={dateHeure(a.dateActivation)}>{t('Depuis {quand}', { quand: ilYa(a.dateActivation) || dateHeure(a.dateActivation) })}</span>
                  )}
                  {a.statut === 'VUE' && a.acquitteParNom && (
                    <span className="am-qui" title={dateHeure(a.dateAcquittement)}>{t('Par {nom}', { nom: a.acquitteParNom })} · {ilYa(a.dateAcquittement)}</span>
                  )}
                  {a.statut === 'SOURDINE' && a.sourdineJusqua && (
                    <span className="am-qui">{t('Jusqu’au {date}', { date: dateHeure(a.sourdineJusqua) })}</span>
                  )}
                  {(a.statut === 'RESOLUE' || a.statut === 'IGNOREE') && a.traiteParNom && (
                    <span className="am-qui" title={dateHeure(a.dateTraitement)}>{t('Par {nom}', { nom: a.traiteParNom })}</span>
                  )}
                  {a.statut === 'EN_MAINTENANCE' && a.maintenanceBonId && (
                    <button type="button" className="vl-alerte-bon" onClick={() => navigate(`/bons-maintenance?id=${a.maintenanceBonId}`)}
                      title={t('Alerte reçue pendant ce bon : sans notification. Elle redevient « À traiter » à la fin du bon si elle est toujours active.')}>
                      <Wrench size={12} aria-hidden="true" /> {a.maintenanceBonNum || `#${a.maintenanceBonId}`}
                    </button>
                  )}
                </div>

                <div className="am-actions">
                  {a.statut === 'NOUVELLE' ? (
                    <button type="button" className="am-principal am-principal--acquitter" data-ton={niv.ton} onClick={() => acquitterVite(a)} disabled={enCours === a.id}>
                      {enCours === a.id ? <LoaderCircle size={15} className="vl-tourne" aria-hidden="true" /> : <CheckCheck size={15} aria-hidden="true" />}
                      {t('Acquitter')}
                    </button>
                  ) : (estOuverte(a) || a.statut === 'EN_MAINTENANCE') ? (
                    <button type="button" className="am-principal am-principal--resoudre" onClick={() => ouvrirAction('RESOLUE', [a])} disabled={enCours === a.id}>
                      <CircleCheck size={15} aria-hidden="true" /> {t('Résolue')}
                    </button>
                  ) : (
                    <button type="button" className="am-principal am-principal--calme" onClick={() => ouvrirAction('NOUVELLE', [a])}>
                      <RotateCcw size={15} aria-hidden="true" /> {t('Rouvrir')}
                    </button>
                  )}

                  <div className="am-outils" role="group" aria-label={t('Actions')}>
                    {!a.reclamationId && estOuverte(a) && a.source !== 'AGENT' && (
                      <button type="button" className="am-outil" data-role="reclamation" onClick={() => setAlerteReclamation(a)}
                        title={t('Créer une réclamation')} aria-label={t('Créer une réclamation')}>
                        <ClipboardPlus size={15} aria-hidden="true" />
                      </button>
                    )}
                    {a.statut === 'NOUVELLE' && (
                      <button type="button" className="am-outil" data-role="resoudre" onClick={() => ouvrirAction('RESOLUE', [a])}
                        title={t('Résolue')} aria-label={t('Résolue')}>
                        <CircleCheck size={15} aria-hidden="true" />
                      </button>
                    )}
                    {(a.statut === 'NOUVELLE' || a.statut === 'VUE') && (
                      <button type="button" className="am-outil" data-role="sourdine" onClick={() => ouvrirAction('SOURDINE', [a])}
                        title={t('Mettre en sourdine')} aria-label={t('Mettre en sourdine')}>
                        <BellOff size={15} aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" className="am-outil" data-role="commentaire" onClick={() => ouvrirAction('COMMENTER', [a])}
                      title={t('Ajouter un commentaire')} aria-label={t('Ajouter un commentaire')}>
                      <MessageSquare size={15} aria-hidden="true" />
                    </button>
                    {estOuverte(a) && (
                      <button type="button" className="am-outil" data-role="ignorer" onClick={() => ouvrirAction('IGNOREE', [a])}
                        title={t('Ignorer')} aria-label={t('Ignorer')}>
                        <Ban size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {a.reclamationId && (
                    <button type="button" className="am-recl" onClick={() => navigate(`/reclamations?id=${a.reclamationId}`)} title={t('Ouvrir la réclamation')}>
                      <ClipboardPlus size={13} aria-hidden="true" />
                      {a.reclamationNum ? t('Réclamation {num}', { num: a.reclamationNum }) : t('Réclamation créée')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <VeillePagination page={pageCourante} taille={taille} total={affichees.length} onPage={setPage}
          onTaille={(v) => { setTaille(v); setPage(0); }} />
        </>
      )}

      {action && (
        <FenetreActionAlerte action={action.type} alertes={action.alertes} onClose={() => setAction(null)}
          onFait={(majs) => { appliquer(majs); setAction(null); }} />
      )}
      {escaladeOuverte && <FenetreEscalade onClose={() => setEscaladeOuverte(false)} onEnregistre={() => setMessage(t('Règles d’escalade enregistrées.'))} />}

      <ReclamationCreeeModal reclamation={reclamationCreee} onClose={() => setReclamationCreee(null)} />

      <ReclamationModal
        isOpen={!!alerteReclamation}
        onClose={() => setAlerteReclamation(null)}
        onSave={enregistrerReclamation}
        reclamation={null}
        isEditing={false}
        valeursInitiales={valeursReclamation}
      />
    </VeillePage>
  );
}
