import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Check, History, ExternalLink, Clock, Lightbulb, RefreshCw } from 'lucide-react';
import codePanneService from '../../../services/codePanneService';
import './SuggestionCodePanne.css';

/*
 * Sous la description d'une réclamation : le code panne (liste) + ce que propose l'IA
 * pendant la saisie (codes probables) et les pannes semblables déjà résolues.
 * La suggestion part 1,2 s après la dernière frappe, dès 12 caractères.
 */
const MIN_CARACTERES = 12;
const DELAI_MS = 1200;

const SOURCES = {
  IA: 'Proposé par l’IA',
  MOTS_CLES: 'Proposé (mots-clés)',
  MANUEL: 'Choisi à la main',
};

const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString('fr-FR');
};

const fmtDuree = (h) => {
  if (h == null) return null;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} j`;
};

const ton = (c) => (c >= 70 ? 'fort' : c >= 40 ? 'moyen' : 'faible');

const SuggestionCodePanne = ({
  description, lotArticleImmobilistationId, reclamationId,
  codePanneId, codePanneSource, libelleActuel, onChoisir,
}) => {
  const [codes, setCodes] = useState([]);
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [relance, setRelance] = useState(0);
  const derniereDemande = useRef('');

  useEffect(() => {
    codePanneService.liste().then(setCodes).catch(() => setCodes([]));
  }, []);

  const texte = (description || '').trim();
  const assezLong = texte.length >= MIN_CARACTERES;

  useEffect(() => {
    if (!assezLong) { setResultat(null); setErreur(null); setChargement(false); return undefined; }
    const cle = `${texte}|${lotArticleImmobilistationId || ''}|${relance}`;
    if (cle === derniereDemande.current) return undefined;
    const ctrl = new AbortController();
    const minuteur = setTimeout(async () => {
      derniereDemande.current = cle;
      setChargement(true);
      setErreur(null);
      try {
        const r = await codePanneService.suggestion({
          description: texte,
          lotArticleImmobilistationId: lotArticleImmobilistationId ? Number(lotArticleImmobilistationId) : null,
          reclamationId: reclamationId ?? null,
        }, ctrl.signal);
        setResultat(r);
      } catch (e) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
        derniereDemande.current = '';
        setErreur('Suggestion indisponible pour le moment.');
      } finally {
        if (!ctrl.signal.aborted) setChargement(false);
      }
    }, DELAI_MS);
    return () => { clearTimeout(minuteur); ctrl.abort(); };
  }, [texte, assezLong, lotArticleImmobilistationId, reclamationId, relance]);

  const propositions = resultat?.codes || [];
  const semblables = resultat?.semblables || [];
  const options = codes;

  const parCategorie = options.reduce((acc, c) => {
    const k = c.categorie || 'Autre';
    (acc[k] = acc[k] || []).push(c);
    return acc;
  }, {});

  const sourceProposition = resultat?.source === 'IA' ? 'IA' : 'MOTS_CLES';

  const ouvrirBon = (id) => window.open(`/bons-maintenance?id=${id}`, '_blank', 'noopener');

  return (
    <div className="scp">
      <div className="scp-ligne">
        <div className="rm-field scp-champ">
          <label htmlFor="rcm-code-panne">Code panne</label>
          <select
            id="rcm-code-panne"
            value={codePanneId ?? ''}
            onChange={(e) => onChoisir(e.target.value, e.target.value ? 'MANUEL' : '')}
          >
            <option value="">— Aucun —</option>
            {codePanneId && !codes.some((c) => String(c.id) === String(codePanneId)) && (
              <option value={codePanneId}>{libelleActuel || `Code #${codePanneId}`}</option>
            )}
            {Object.entries(parCategorie).map(([cat, liste]) => (
              <optgroup key={cat} label={cat}>
                {liste.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.libelle}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {codePanneId && codePanneSource && SOURCES[codePanneSource] && (
            <p className="rm-hint">{SOURCES[codePanneSource]}</p>
          )}
        </div>
      </div>

      <div className={`scp-panneau${assezLong ? '' : ' scp-panneau--attente'}`} aria-live="polite">
        <div className="scp-entete">
          <Sparkles size={15} />
          <span>Assistant</span>
          {chargement && <Loader2 size={14} className="scp-tourne" />}
          {resultat && !chargement && (
            <span className={`scp-badge scp-badge--${resultat.source === 'IA' ? 'ia' : 'mc'}`}>
              {resultat.source === 'IA' ? 'IA' : resultat.source === 'MOTS_CLES' ? 'Mots-clés' : '—'}
            </span>
          )}
          {assezLong && !chargement && (
            <button type="button" className="scp-relancer" onClick={() => setRelance((n) => n + 1)} title="Relancer la suggestion">
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {!assezLong && (
          <p className="scp-vide">Continue la description : l’assistant proposera un code panne et les pannes semblables déjà résolues.</p>
        )}
        {erreur && <p className="scp-vide">{erreur}</p>}
        {assezLong && chargement && !resultat && <p className="scp-vide">Analyse de la description…</p>}

        {resultat && (
          <>
            {propositions.length > 0 ? (
              <div className="scp-codes">
                {propositions.map((p) => {
                  const actif = String(p.id) === String(codePanneId);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`scp-code${actif ? ' scp-code--actif' : ''}`}
                      onClick={() => onChoisir(actif ? '' : String(p.id), actif ? '' : sourceProposition)}
                      title={p.raison || ''}
                      aria-pressed={actif}
                    >
                      {actif ? <Check size={13} /> : null}
                      <strong>{p.code}</strong>
                      <span className="scp-code-lib">{p.libelle}</span>
                      {p.confiance != null && (
                        <span className={`scp-conf scp-conf--${ton(p.confiance)}`}>{Math.round(p.confiance)} %</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="scp-vide">{resultat.message || 'Aucun code évident : choisis-le dans la liste si besoin.'}</p>
            )}
            {propositions[0]?.raison && <p className="scp-raison">{propositions[0].raison}</p>}

            {resultat.piste && (
              <div className="scp-piste">
                <Lightbulb size={14} />
                <span><strong>Piste : </strong>{resultat.piste}</span>
              </div>
            )}

            <div className="scp-sous-titre">
              <History size={14} />
              <span>Pannes semblables déjà résolues</span>
              <span className="scp-compte">{semblables.length}</span>
            </div>
            {semblables.length === 0 ? (
              <p className="scp-vide">Aucune panne semblable résolue sur les 3 dernières années.</p>
            ) : (
              <ul className="scp-semblables">
                {semblables.map((s) => (
                  <li key={s.reclamationId} className="scp-semblable">
                    <div className="scp-s-haut">
                      <span className="scp-s-pct" title="Ressemblance">{Math.round(s.ressemblancePct)} %</span>
                      <span className="scp-s-eq" dir="auto">{s.equipementNom || 'Équipement ?'}</span>
                      {s.memeEquipement && <span className="scp-s-meme">Même équipement</span>}
                      {s.codePanne && <span className="scp-s-code">{s.codePanne}</span>}
                      <span className="scp-s-date">{fmtDate(s.date)}</span>
                    </div>
                    <p className="scp-s-desc" dir="auto">{s.description}</p>
                    {s.solution && (
                      <p className="scp-s-sol" dir="auto"><strong>Solution : </strong>{s.solution}</p>
                    )}
                    <div className="scp-s-bas">
                      {fmtDuree(s.dureeHeures) && (
                        <span><Clock size={12} /> {fmtDuree(s.dureeHeures)}</span>
                      )}
                      {s.bonId && (
                        <button type="button" className="scp-lien" onClick={() => ouvrirBon(s.bonId)}>
                          Bon {s.bonNum || `#${s.bonId}`} <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuggestionCodePanne;
