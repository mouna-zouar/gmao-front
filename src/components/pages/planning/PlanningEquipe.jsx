import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, GripVertical, Inbox, LoaderCircle, Lock, MapPin, RefreshCw, Search, Users,
} from 'lucide-react';
import planningService from '../../../services/planningService';
import { t, locale } from '../../../i18n';
import './PlanningEquipe.css';

const CAPACITE_JOUR = 8;
const HEURE_DEBUT = 8;
const RAFRAICHISSEMENT_MS = 60000;
const ETATS_BON = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const TONS_LIEU = 6;
// Intervention terminée (2) ou bon effectué (4) : n'apparaît plus dans le planning
const estTermine = (c) => c.type !== 'RECLAMATION' && (Number(c.etatIntervenant) === 2 || Number(c.etatBon) === 4);

const pad = (n) => String(n).padStart(2, '0');
const cleJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lundi = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return x; };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const enDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const heure = (d) => (d ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '');
const normaliser = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString(locale());
const tonLieu = (lieu) => {
  if (!lieu) return 0;
  let s = 0;
  for (let i = 0; i < lieu.length; i += 1) s = (s * 31 + lieu.charCodeAt(i)) % 9973;
  return (s % TONS_LIEU) + 1;
};
const niveauCharge = (h) => (h <= 0 ? 'libre' : h <= CAPACITE_JOUR * 0.75 ? 'ok' : h <= CAPACITE_JOUR ? 'plein' : 'surcharge');

export default function PlanningEquipe() {
  const navigate = useNavigate();
  const [debutSemaine, setDebutSemaine] = useState(() => lundi(new Date()));
  const [donnees, setDonnees] = useState({ techniciens: [], aPlanifier: [] });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [lieu, setLieu] = useState('');
  const [parLieu, setParLieu] = useState(true);
  const [glisse, setGlisse] = useState(null);
  const [survol, setSurvol] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const glisseRef = useRef(null);

  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => plusJours(debutSemaine, i)), [debutSemaine]);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    setErreur(null);
    try {
      const fin = plusJours(debutSemaine, 7);
      fin.setMilliseconds(-1);
      const d = await planningService.equipe(debutSemaine, fin);
      setDonnees({ techniciens: d?.techniciens ?? [], aPlanifier: d?.aPlanifier ?? [] });
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Impossible de charger le planning de l’équipe.'));
    } finally {
      setChargement(false);
    }
  }, [debutSemaine]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (!document.hidden && !glisseRef.current) charger(true);
    }, RAFRAICHISSEMENT_MS);
    return () => clearInterval(minuterie);
  }, [charger]);
  useEffect(() => { if (!message) return undefined; const m = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(m); }, [message]);

  const grille = useMemo(() => {
    const g = new Map();
    donnees.techniciens.forEach((tech) => {
      const parJour = new Map();
      (tech.creneaux || []).forEach((c) => {
        if (estTermine(c)) return;
        const d = enDate(c.debut);
        if (!d) return;
        const k = cleJour(d);
        if (!parJour.has(k)) parJour.set(k, []);
        parJour.get(k).push(c);
      });
      parJour.forEach((l) => l.sort((a, b) => (parLieu ? String(a.lieu || '~').localeCompare(String(b.lieu || '~')) : 0)
        || String(a.debut).localeCompare(String(b.debut))));
      g.set(tech.personnelId, parJour);
    });
    return g;
  }, [donnees.techniciens, parLieu]);

  const lieux = useMemo(() => {
    const s = new Set();
    donnees.techniciens.forEach((tech) => (tech.creneaux || []).forEach((c) => c.lieu && s.add(c.lieu)));
    donnees.aPlanifier.forEach((b) => b.lieu && s.add(b.lieu));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [donnees]);

  const chargeJour = (personnelId, k) => (grille.get(personnelId)?.get(k) || []).reduce((s, c) => s + (Number(c.heures) || 0), 0);
  const chargeSemaine = (personnelId) => jours.reduce((s, j) => s + chargeJour(personnelId, cleJour(j)), 0);

  const techniciens = useMemo(() => {
    const q = normaliser(recherche);
    return donnees.techniciens.filter((tech) => !q || normaliser(tech.nom).includes(q));
  }, [donnees.techniciens, recherche]);

  const aPlanifier = useMemo(() => {
    const l = donnees.aPlanifier.filter((b) => !lieu || b.lieu === lieu);
    return parLieu ? [...l].sort((a, b) => String(a.lieu || '~').localeCompare(String(b.lieu || '~'))) : l;
  }, [donnees.aPlanifier, lieu, parLieu]);

  const visible = (c) => !lieu || c.lieu === lieu;

  const commencer = (e, type, item) => {
    const g = { type, item };
    glisseRef.current = g;
    setGlisse(g);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', `${type}:${type === 'creneau' ? item.intervenantId : item.bonId}`); } catch {}
  };
  const terminer = () => { glisseRef.current = null; setGlisse(null); setSurvol(null); };

  const deposer = async (tech, jour) => {
    const g = glisseRef.current;
    terminer();
    if (!g || enCours) return;
    const k = cleJour(jour);
    setEnCours(true);
    try {
      if (g.type === 'creneau') {
        const c = g.item;
        const ancien = enDate(c.debut);
        if (ancien && cleJour(ancien) === k && tech.personnelId === c.personnelId) return;
        const debut = new Date(jour);
        if (ancien) debut.setHours(ancien.getHours(), ancien.getMinutes(), 0, 0); else debut.setHours(HEURE_DEBUT, 0, 0, 0);
        await planningService.deplacer(c.intervenantId, tech.personnelId, tech.nom, debut);
        setMessage(t('{bon} déplacé vers {nom}, {jour}', { bon: c.bonNum, nom: tech.nom, jour: jour.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }) }));
      } else {
        const deja = chargeJour(tech.personnelId, k);
        const debut = new Date(jour);
        const h = Math.min(HEURE_DEBUT + deja, 17);
        debut.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
        await planningService.affecter(g.item.bonId, tech.personnelId, tech.nom, debut, g.item.heures);
        setMessage(t('{bon} affecté à {nom}, {jour}', { bon: g.item.bonNum, nom: tech.nom, jour: jour.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }) }));
      }
      await charger(true);
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Le déplacement n’a pas pu être enregistré.'));
    } finally {
      setEnCours(false);
    }
  };

  const tonDepot = (tech, k) => {
    if (!glisse) return null;
    const h = glisse.type === 'creneau' ? (Number(glisse.item.heures) || 0) : (Number(glisse.item.heures) || 2);
    const deja = chargeJour(tech.personnelId, k) - (glisse.type === 'creneau' && glisse.item.personnelId === tech.personnelId
      && cleJour(enDate(glisse.item.debut) || new Date(0)) === k ? h : 0);
    return niveauCharge(deja + h);
  };

  const libelleSemaine = `${jours[0].toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – ${jours[6].toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const aujourdHui = cleJour(new Date());

  const carte = (c, tech) => {
    const d = enDate(c.debut);
    const ton = tonLieu(c.lieu);
    if (c.type === 'RECLAMATION') {
      return (
        <li key={`r-${c.reclamationId}`} className="peq-carte peq-carte--fixe peq-carte--reclamation" data-lieu={ton}
          title={[c.reclamationNum, c.equipementNom, c.lieu, c.titre].filter(Boolean).join(' · ')}>
          <button type="button" className="peq-carte__corps" onClick={() => navigate(`/reclamations?id=${c.reclamationId}`)}>
            <strong className="peq-carte__num">{c.reclamationNum}</strong>
            <span className="peq-carte__heure">{t('Réclamation')}{Number(c.urgence) === 3 ? ` · ${t('Urgent')}` : ''}</span>
            <span className="peq-carte__eq" dir="auto">{c.equipementNom || c.titre || '—'}</span>
            {c.lieu && <span className="peq-carte__lieu"><MapPin size={11} aria-hidden="true" /> {c.lieu}</span>}
          </button>
        </li>
      );
    }
    return (
      <li key={c.intervenantId} className={`peq-carte${c.deplacable ? '' : ' peq-carte--fixe'}${glisse?.item === c ? ' is-glisse' : ''}`}
        data-lieu={ton} draggable={c.deplacable && !enCours}
        onDragStart={(e) => commencer(e, 'creneau', { ...c, personnelId: tech.personnelId })} onDragEnd={terminer}
        title={[c.bonNum, c.equipementNom, c.lieu, ETATS_BON[c.etatBon] && t(ETATS_BON[c.etatBon])].filter(Boolean).join(' · ')}>
        <button type="button" className="peq-carte__corps" onClick={() => navigate(`/bons-maintenance?id=${c.bonId}`)}>
          <strong className="peq-carte__num">{c.bonNum}</strong>
          <span className="peq-carte__heure">{heure(d)} · {fmtH(Number(c.heures) || 0)} h</span>
          <span className="peq-carte__eq" dir="auto">{c.equipementNom || c.titre || '—'}</span>
          {c.lieu && <span className="peq-carte__lieu"><MapPin size={11} aria-hidden="true" /> {c.lieu}</span>}
        </button>
        {!c.deplacable && <Lock size={12} className="peq-carte__poignee" aria-label={t('Terminé')} />}
      </li>
    );
  };

  return (
    <div className="peq-page">
      <div className="peq-barre">
        <div className="peq-nav">
          <button type="button" className="peq-btn peq-btn--icone" onClick={() => setDebutSemaine((d) => plusJours(d, -7))} aria-label={t('Semaine précédente')} title={t('Semaine précédente')}><ChevronLeft size={16} /></button>
          <span className="peq-nav__semaine">{libelleSemaine}</span>
          <button type="button" className="peq-btn peq-btn--icone" onClick={() => setDebutSemaine((d) => plusJours(d, 7))} aria-label={t('Semaine suivante')} title={t('Semaine suivante')}><ChevronRight size={16} /></button>
          <button type="button" className="peq-btn" onClick={() => setDebutSemaine(lundi(new Date()))}>{t('Cette semaine')}</button>
          <button type="button" className="peq-btn peq-btn--icone" onClick={() => charger()} disabled={chargement} aria-label={t('Rafraîchir')} title={t('Rafraîchir')}>
            {chargement ? <LoaderCircle size={16} className="peq-tourne" /> : <RefreshCw size={16} />}
          </button>
        </div>
        <label className="peq-recherche">
          <Search size={15} aria-hidden="true" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('Rechercher un technicien…')} aria-label={t('Rechercher un technicien…')} />
        </label>
        {lieux.length > 0 && (
          <select className="peq-select" value={lieu} onChange={(e) => setLieu(e.target.value)} aria-label={t('Lieu')}>
            <option value="">{t('Tous les lieux')}</option>
            {lieux.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <label className="peq-case">
          <input type="checkbox" checked={parLieu} onChange={(e) => setParLieu(e.target.checked)} />
          {t('Regrouper par lieu')}
        </label>
        <div className="peq-legende" aria-label={t('Charge de la journée')}>
          <span data-niveau="ok">{t('Disponible')}</span>
          <span data-niveau="plein">{t('Presque plein')}</span>
          <span data-niveau="surcharge">{t('Surchargé')}</span>
          <span data-niveau="reclamation">{t('Réclamation')}</span>
        </div>
      </div>

      {erreur && <div className="peq-message peq-message--erreur" role="alert">{erreur}<button type="button" onClick={() => setErreur(null)} aria-label={t('Fermer')}>×</button></div>}
      {message && <div className="peq-message" role="status">{message}</div>}

      <div className="peq-corps">
        <div className="peq-grille" style={{ '--peq-jours': 7 }}>
          <div className="peq-ligne peq-ligne--tete">
            <div className="peq-tech peq-tech--tete"><Users size={14} aria-hidden="true" /> {t('Technicien')}</div>
            {jours.map((j) => {
              const k = cleJour(j);
              const weekend = j.getDay() === 0 || j.getDay() === 6;
              return (
                <div key={k} className={`peq-jour-tete${k === aujourdHui ? ' is-aujourdhui' : ''}${weekend ? ' is-weekend' : ''}`}>
                  <span>{j.toLocaleDateString(locale(), { weekday: 'short' })}</span>
                  <strong>{j.getDate()}</strong>
                </div>
              );
            })}
          </div>

          {chargement && donnees.techniciens.length === 0 ? (
            <div className="peq-vide"><LoaderCircle size={18} className="peq-tourne" /> {t('Chargement…')}</div>
          ) : techniciens.length === 0 ? (
            <div className="peq-vide">{t('Aucun technicien affecté cette semaine.')}</div>
          ) : techniciens.map((tech) => {
            const semaine = chargeSemaine(tech.personnelId);
            const capaciteSemaine = CAPACITE_JOUR * 5;
            return (
              <div key={tech.personnelId} className="peq-ligne">
                <div className="peq-tech">
                  <span className="peq-tech__nom" title={tech.nom}>{tech.nom || `#${tech.personnelId}`}</span>
                  <span className="peq-tech__charge" data-niveau={niveauCharge(semaine / 5)}>
                    <span className="peq-jauge"><span style={{ width: `${Math.min(100, (semaine / capaciteSemaine) * 100)}%` }} /></span>
                    {fmtH(semaine)} / {capaciteSemaine} h
                  </span>
                </div>
                {jours.map((j) => {
                  const k = cleJour(j);
                  const liste = (grille.get(tech.personnelId)?.get(k) || []).filter(visible);
                  const h = chargeJour(tech.personnelId, k);
                  const cle = `${tech.personnelId}|${k}`;
                  const ton = tonDepot(tech, k);
                  const weekend = j.getDay() === 0 || j.getDay() === 6;
                  return (
                    <div key={k}
                      className={`peq-case-jour${k === aujourdHui ? ' is-aujourdhui' : ''}${weekend ? ' is-weekend' : ''}${survol === cle ? ' is-survol' : ''}`}
                      data-depot={ton || undefined}
                      onDragOver={(e) => { if (glisseRef.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (survol !== cle) setSurvol(cle); } }}
                      onDragLeave={() => { if (survol === cle) setSurvol(null); }}
                      onDrop={(e) => { e.preventDefault(); deposer(tech, j); }}>
                      {h > 0 && (
                        <span className="peq-case-jour__charge" data-niveau={niveauCharge(h)} title={t('{h} h prévues sur {c} h', { h: fmtH(h), c: CAPACITE_JOUR })}>
                          {fmtH(h)} h
                        </span>
                      )}
                      <ul className="peq-cartes">{liste.map((c) => carte(c, tech))}</ul>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <aside className="peq-attente" aria-label={t('Bons à planifier')}>
          <div className="peq-attente__tete">
            <Inbox size={15} aria-hidden="true" />
            <strong>{t('À planifier')}</strong>
            <span className="peq-compte">{aPlanifier.length}</span>
          </div>
          {aPlanifier.length === 0 ? (
            <p className="peq-attente__vide">{t('Tous les bons ouverts ont un technicien.')}</p>
          ) : (
            <ul className="peq-cartes peq-cartes--attente">
              {aPlanifier.map((b, i) => {
                const titreLieu = parLieu && (i === 0 || aPlanifier[i - 1].lieu !== b.lieu);
                return (
                  <li key={b.bonId} className="peq-attente__item">
                    {titreLieu && <span className="peq-attente__lieu"><MapPin size={11} aria-hidden="true" /> {b.lieu || t('Sans lieu')}</span>}
                    <div className={`peq-carte peq-carte--attente${glisse?.item === b ? ' is-glisse' : ''}`} data-lieu={tonLieu(b.lieu)}
                      draggable={!enCours} onDragStart={(e) => commencer(e, 'bon', b)} onDragEnd={terminer}
                      title={[b.bonNum, b.equipementNom, b.lieu].filter(Boolean).join(' · ')}>
                      <button type="button" className="peq-carte__corps" onClick={() => navigate(`/bons-maintenance?id=${b.bonId}`)}>
                        <span className="peq-carte__haut">
                          <strong>{b.bonNum}</strong>
                          <span className="peq-carte__heure">{fmtH(Number(b.heures) || 0)} h{Number(b.urgence) === 3 ? ` · ${t('Urgent')}` : ''}</span>
                        </span>
                        <span className="peq-carte__eq" dir="auto">{b.equipementNom || b.titre || '—'}</span>
                      </button>
                      <GripVertical size={14} className="peq-carte__poignee" aria-hidden="true" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
