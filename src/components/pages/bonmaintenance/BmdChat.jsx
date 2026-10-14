import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDown, Loader2, LogIn, Lock, MessageCircle, RefreshCw, SendHorizontal, UserX,
} from 'lucide-react';
import chatBonService, { typeErreurChat } from '../../../services/chatBonService';
import authService from '../../../services/Authservice';
import { t, tp, locale } from '../../../i18n';
import './BmdChat.css';

/*
 * Chat en direct d'un bon de maintenance.
 * Réservé aux personnes qui travaillent sur le bon : intervenants, contrôleur, responsable
 * de la remise en service, créateur et demandeur (le serveur vérifie).
 */

const LONGUEUR_MAX = 2000;
const ECART_GROUPE_MS = 5 * 60 * 1000;

const ROLES_CHAT = {
  CREATEUR: 'Créateur',
  DEMANDEUR: 'Demandeur',
  INTERVENANT: 'Intervenant',
  DIAGNOSTIC: 'Diagnostic',
  CONTROLEUR: 'Contrôle',
  REMISE_EN_SERVICE: 'Remise en service',
  ADMIN: 'Administrateur',
};

const TEINTES = ['#0794a4', '#e8962e', '#1f9d74', '#7b61c9', '#d9434b', '#2f6fd1', '#b5577e', '#6b8e23'];
const teinte = (id) => TEINTES[Math.abs(Number(id) || 0) % TEINTES.length];

const initiales = (nom) => {
  const mots = String(nom || '?').trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] || '?') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
};

const versDate = (v) => (v ? new Date(v) : null);
const memeJour = (a, b) => a && b && a.toDateString() === b.toDateString();

const heure = (d) => (d ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '');

const libelleJour = (d) => {
  if (!d) return '';
  const aujourdhui = new Date();
  const hier = new Date();
  hier.setDate(aujourdhui.getDate() - 1);
  if (memeJour(d, aujourdhui)) return t("Aujourd'hui");
  if (memeJour(d, hier)) return t('Hier');
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Ajoute des messages sans doublon (même id), triés par id. */
const fusionner = (actuels, nouveaux) => {
  if (!nouveaux || nouveaux.length === 0) return actuels;
  const parId = new Map(actuels.map((m) => [m.id, m]));
  nouveaux.forEach((m) => parId.set(m.id, m));
  return [...parId.values()].sort((a, b) => a.id - b.id);
};

function Avatar({ id, nom, enLigne, taille = 'normal' }) {
  return (
    <span className={`bch-avatar bch-avatar--${taille}`} style={{ background: teinte(id) }} aria-hidden="true">
      {initiales(nom)}
      {enLigne != null && <span className={`bch-point ${enLigne ? 'bch-point--on' : ''}`} />}
    </span>
  );
}

export default function BmdChat({ bonId, onNonLusChange, onDernierMessage }) {
  const [statut, setStatut] = useState('chargement'); // chargement | pret | session | acces | reseau
  const [participants, setParticipants] = useState([]);
  const [moi, setMoi] = useState(null);
  const [messages, setMessages] = useState([]);
  const [plusAnciens, setPlusAnciens] = useState(false);
  const [chargementAnciens, setChargementAnciens] = useState(false);
  const [enLigne, setEnLigne] = useState(() => new Set());
  const [connecte, setConnecte] = useState(null);
  const [texte, setTexte] = useState('');
  const [enAttente, setEnAttente] = useState([]); // { cle, contenu, etat: 'envoi' | 'echec' }
  const [separateurId, setSeparateurId] = useState(null);
  const [nouveauxEnBas, setNouveauxEnBas] = useState(0);
  const [tentative, setTentative] = useState(0);

  const listeRef = useRef(null);
  const saisieRef = useRef(null);
  const collerEnBas = useRef(true);
  const hauteurAvantAnciens = useRef(null);
  const dernierIdRef = useRef(0);
  const dernierLuEnvoye = useRef(0);
  const nbMessagesPrec = useRef(0);

  const dernierId = messages.length ? messages[messages.length - 1].id : 0;
  useEffect(() => { dernierIdRef.current = dernierId; }, [dernierId]);

  // Prévient le parent du dernier message (aperçu dans la liste des discussions de Mon espace)
  const dernierMessage = messages.length ? messages[messages.length - 1] : null;
  useEffect(() => {
    if (dernierMessage) onDernierMessage?.(dernierMessage);
  }, [dernierMessage, onDernierMessage]);

  // ---------- Chargement initial + flux temps réel ----------
  useEffect(() => {
    // Le panneau est recréé pour chaque bon : pas d'état à remettre à zéro ici
    let actif = true;
    let fermerFlux = null;
    collerEnBas.current = true;

    chatBonService.getConversation(bonId)
      .then((conv) => {
        if (!actif) return;
        setParticipants(conv.participants || []);
        setMoi(conv.moiPersonnelId);
        setMessages(conv.messages || []);
        setPlusAnciens(!!conv.plusAnciens);
        setEnLigne(new Set((conv.participants || []).filter((p) => p.enLigne).map((p) => p.personnelId)));
        dernierLuEnvoye.current = conv.dernierMessageLuId || 0;
        // Ligne « Nouveaux messages » : seulement s'il y a des messages des autres après le dernier lu
        const premierNonLu = (conv.messages || []).find(
          (m) => m.id > (conv.dernierMessageLuId || 0) && m.personnelId !== conv.moiPersonnelId,
        );
        setSeparateurId(premierNonLu ? premierNonLu.id : null);
        setStatut('pret');

        fermerFlux = chatBonService.ouvrirFlux(bonId, {
          onMessage: (m) => setMessages((prev) => fusionner(prev, [m])),
          onPresence: (ids) => setEnLigne(new Set(ids || [])),
          onConnecte: () => {
            setConnecte(true);
            // Rattrape ce qui a pu arriver pendant la coupure
            if (dernierIdRef.current) {
              chatBonService.getMessagesApres(bonId, dernierIdRef.current)
                .then((manques) => setMessages((prev) => fusionner(prev, manques)))
                .catch(() => {});
            }
          },
          onDeconnecte: () => setConnecte(false),
          onErreurFatale: (type) => setStatut(type),
        });
      })
      .catch((err) => { if (actif) setStatut(typeErreurChat(err)); });

    return () => {
      actif = false;
      fermerFlux?.();
    };
  }, [bonId, tentative]);

  // ---------- Marquer comme lu (onglet visible uniquement) ----------
  useEffect(() => {
    if (statut !== 'pret' || !dernierId) return undefined;
    const marquer = () => {
      if (document.visibilityState !== 'visible' || dernierId <= dernierLuEnvoye.current) return;
      dernierLuEnvoye.current = dernierId;
      chatBonService.marquerLu(bonId, dernierId)
        .then(() => onNonLusChange?.(0))
        .catch(() => { dernierLuEnvoye.current = 0; });
    };
    const minuterie = setTimeout(marquer, 400);
    document.addEventListener('visibilitychange', marquer);
    return () => {
      clearTimeout(minuterie);
      document.removeEventListener('visibilitychange', marquer);
    };
  }, [bonId, dernierId, statut, onNonLusChange]);

  // ---------- Défilement ----------
  useLayoutEffect(() => {
    const liste = listeRef.current;
    if (!liste) return;
    if (hauteurAvantAnciens.current != null) {
      // Messages plus anciens ajoutés en haut : on garde la position de lecture
      liste.scrollTop += liste.scrollHeight - hauteurAvantAnciens.current;
      hauteurAvantAnciens.current = null;
    } else if (collerEnBas.current) {
      liste.scrollTop = liste.scrollHeight;
    } else if (messages.length > nbMessagesPrec.current) {
      const ajoutes = messages.slice(nbMessagesPrec.current).filter((m) => m.personnelId !== moi).length;
      if (ajoutes > 0) setNouveauxEnBas((n) => n + ajoutes);
    }
    nbMessagesPrec.current = messages.length;
  }, [messages, enAttente, moi, statut]);

  const seReconnecter = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const reessayer = () => {
    setStatut('chargement');
    setTentative((n) => n + 1);
  };

  const surDefilement = () => {
    const liste = listeRef.current;
    if (!liste) return;
    const enBas = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 60;
    collerEnBas.current = enBas;
    if (enBas) setNouveauxEnBas(0);
  };

  const allerEnBas = () => {
    collerEnBas.current = true;
    setNouveauxEnBas(0);
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: 'smooth' });
  };

  const chargerAnciens = async () => {
    if (chargementAnciens || messages.length === 0) return;
    setChargementAnciens(true);
    try {
      const anciens = await chatBonService.getMessagesAvant(bonId, messages[0].id);
      hauteurAvantAnciens.current = listeRef.current?.scrollHeight ?? null;
      setMessages((prev) => fusionner(prev, anciens));
      setPlusAnciens(anciens.length >= 50);
    } catch {
      /* on laisse le bouton pour réessayer */
    } finally {
      setChargementAnciens(false);
    }
  };

  // ---------- Envoi ----------
  const envoyerContenu = useCallback(async (contenu, cle) => {
    setEnAttente((prev) => [...prev.filter((p) => p.cle !== cle), { cle, contenu, etat: 'envoi' }]);
    collerEnBas.current = true;
    try {
      const message = await chatBonService.envoyer(bonId, contenu);
      setMessages((prev) => fusionner(prev, [message]));
      setEnAttente((prev) => prev.filter((p) => p.cle !== cle));
      dernierLuEnvoye.current = Math.max(dernierLuEnvoye.current, message.id);
      setSeparateurId(null);
    } catch (err) {
      const type = typeErreurChat(err);
      if (type === 'session' || type === 'acces') setStatut(type);
      setEnAttente((prev) => prev.map((p) => (p.cle === cle ? { ...p, etat: 'echec' } : p)));
    }
  }, [bonId]);

  const envoyer = (e) => {
    e?.preventDefault();
    const contenu = texte.trim();
    if (!contenu || contenu.length > LONGUEUR_MAX) return;
    setTexte('');
    envoyerContenu(contenu, `${Date.now()}-${Math.random()}`);
    saisieRef.current?.focus();
  };

  const surTouche = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      envoyer();
    }
  };

  // Zone de saisie qui grandit avec le texte (jusqu'à ~6 lignes)
  useLayoutEffect(() => {
    const el = saisieRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [texte]);

  // ---------- Mise en forme de la liste ----------
  const parId = useMemo(() => new Map(participants.map((p) => [p.personnelId, p])), [participants]);

  const elements = useMemo(() => {
    const liste = [];
    let prec = null;
    messages.forEach((m) => {
      const d = versDate(m.dateEnvoi);
      const dPrec = prec ? versDate(prec.dateEnvoi) : null;
      if (!dPrec || !memeJour(d, dPrec)) liste.push({ type: 'jour', cle: `j-${m.id}`, libelle: libelleJour(d) });
      if (m.id === separateurId) liste.push({ type: 'nouveaux', cle: 'nouveaux' });
      const debutGroupe = !prec
        || prec.personnelId !== m.personnelId
        || !memeJour(d, dPrec)
        || d - dPrec > ECART_GROUPE_MS
        || m.id === separateurId;
      liste.push({ type: 'message', cle: m.id, message: m, date: d, debutGroupe });
      prec = m;
    });
    return liste;
  }, [messages, separateurId]);

  const nbEnLigne = participants.filter((p) => enLigne.has(p.personnelId)).length;

  // ---------- Affichage ----------
  if (statut === 'chargement') {
    return (
      <div className="bch bch--etat">
        <Loader2 size={28} className="bmx-tourne" />
        <p>{t('Ouverture de la conversation…')}</p>
      </div>
    );
  }

  if (['session', 'compte', 'acces', 'reseau'].includes(statut)) {
    const def = {
      session: {
        icone: LogIn,
        titre: t('Reconnectez-vous pour discuter'),
        texte: t("Le serveur ne reconnaît plus votre session (il a peut-être redémarré). Déconnectez-vous puis reconnectez-vous pour utiliser le chat."),
      },
      compte: {
        icone: UserX,
        titre: t('Compte non relié au personnel'),
        texte: t('Votre identifiant de connexion n’a pas de fiche dans la liste du personnel (MEDSYS) : le chat ne peut pas savoir qui écrit. Demandez à l’administrateur de relier votre compte.'),
      },
      acces: {
        icone: Lock,
        titre: t('Chat réservé à l’équipe du bon'),
        texte: t('Seules les personnes qui travaillent sur ce bon peuvent lire et écrire ici : intervenants, auteurs du diagnostic, contrôleur, responsable de la remise en service, créateur et demandeur.'),
      },
      reseau: {
        icone: AlertCircle,
        titre: t('Chat indisponible'),
        texte: t('Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.'),
      },
    }[statut];
    const Icone = def.icone;
    return (
      <div className="bch bch--etat" role="alert">
        <span className="bch-etat-icone"><Icone size={26} /></span>
        <h3>{def.titre}</h3>
        <p>{def.texte}</p>
        {statut === 'session' && (
          <button type="button" className="bmx-btn bmx-btn--clair" onClick={seReconnecter}>
            <LogIn size={16} /> {t('Se reconnecter')}
          </button>
        )}
        {statut === 'reseau' && (
          <button type="button" className="bmx-btn bmx-btn--clair" onClick={reessayer}>
            <RefreshCw size={16} /> {t('Réessayer')}
          </button>
        )}
      </div>
    );
  }

  const tropLong = texte.length > LONGUEUR_MAX;

  return (
    <div className="bch">
      {/* ---- Qui est dans la conversation ---- */}
      <header className="bch-entete">
        <div className="bch-entete-ligne">
          <span className="bch-entete-titre">{t('Participants')}</span>
          <span className={`bch-direct ${connecte ? '' : 'bch-direct--coupe'}`} role="status">
            <span className="bch-direct-point" />
            {connecte === true ? t('En direct') : connecte === false ? t('Reconnexion…') : t('Connexion…')}
            <span className="bch-direct-sep">·</span>
            {tp('en ligne', nbEnLigne)}
          </span>
        </div>
        <ul className="bch-participants">
          {participants.map((p) => {
            const estEnLigne = enLigne.has(p.personnelId);
            return (
              <li key={p.personnelId} className="bch-participant" title={estEnLigne ? t('En ligne') : t('Hors ligne')}>
                <Avatar id={p.personnelId} nom={p.nom} enLigne={estEnLigne} taille="petit" />
                <span className="bch-participant-texte">
                  <span className="bch-participant-nom">
                    {p.nom || t('Personnel #{id}', { id: p.personnelId })}
                    {p.personnelId === moi && <span className="bch-moi"> ({t('vous')})</span>}
                  </span>
                  <span className="bch-participant-role">
                    {(p.roles || []).map((r) => t(ROLES_CHAT[r] || r)).join(' · ')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </header>

      {/* ---- Messages ---- */}
      <div className="bch-fil-cadre">
        <div
          className="bch-fil"
          ref={listeRef}
          onScroll={surDefilement}
          role="log"
          aria-live="polite"
          aria-label={t('Messages du chat')}
        >
          {plusAnciens && (
            <div className="bch-anciens">
              <button type="button" onClick={chargerAnciens} disabled={chargementAnciens}>
                {chargementAnciens ? <Loader2 size={14} className="bmx-tourne" /> : null}
                {t('Charger les messages précédents')}
              </button>
            </div>
          )}

          {messages.length === 0 && enAttente.length === 0 && (
            <div className="bch-vide">
              <span className="bch-vide-icone"><MessageCircle size={26} /></span>
              <p className="bch-vide-titre">{t('Aucun message pour l’instant')}</p>
              <p>{t('Écrivez le premier : toutes les personnes du bon le verront aussitôt.')}</p>
            </div>
          )}

          {elements.map((el) => {
            if (el.type === 'jour') {
              return <div key={el.cle} className="bch-jour"><span>{el.libelle}</span></div>;
            }
            if (el.type === 'nouveaux') {
              return <div key={el.cle} className="bch-nouveaux"><span>{t('Nouveaux messages')}</span></div>;
            }
            const m = el.message;
            const deMoi = m.personnelId === moi;
            const auteur = parId.get(m.personnelId);
            const nom = m.personnelNom || auteur?.nom || t('Personnel #{id}', { id: m.personnelId });
            return (
              <div
                key={el.cle}
                className={`bch-ligne ${deMoi ? 'bch-ligne--moi' : ''} ${el.debutGroupe ? 'bch-ligne--debut' : ''}`}
              >
                {!deMoi && (
                  el.debutGroupe
                    ? <Avatar id={m.personnelId} nom={nom} />
                    : <span className="bch-avatar-espace" aria-hidden="true" />
                )}
                <div className="bch-bulle-bloc">
                  {el.debutGroupe && !deMoi && (
                    <span className="bch-auteur" style={{ color: teinte(m.personnelId) }}>{nom}</span>
                  )}
                  <div className="bch-bulle">
                    <p dir="auto">{m.contenu}</p>
                    <time dateTime={m.dateEnvoi} title={el.date?.toLocaleString(locale())}>{heure(el.date)}</time>
                  </div>
                </div>
              </div>
            );
          })}

          {enAttente.map((p) => (
            <div key={p.cle} className="bch-ligne bch-ligne--moi bch-ligne--debut">
              <div className="bch-bulle-bloc">
                <div className={`bch-bulle ${p.etat === 'echec' ? 'bch-bulle--echec' : 'bch-bulle--envoi'}`}>
                  <p dir="auto">{p.contenu}</p>
                  <time>{p.etat === 'envoi' ? t('Envoi…') : ''}</time>
                </div>
                {p.etat === 'echec' && (
                  <span className="bch-echec">
                    <AlertCircle size={13} /> {t('Non envoyé.')}
                    <button type="button" onClick={() => envoyerContenu(p.contenu, p.cle)}>{t('Réessayer')}</button>
                    <button type="button" onClick={() => setEnAttente((prev) => prev.filter((x) => x.cle !== p.cle))}>
                      {t('Supprimer')}
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {nouveauxEnBas > 0 && (
          <button type="button" className="bch-aller-bas" onClick={allerEnBas}>
            <ArrowDown size={15} /> {tp('nouveau message', nouveauxEnBas)}
          </button>
        )}
      </div>

      {/* ---- Saisie ---- */}
      <form className="bch-saisie" onSubmit={envoyer}>
        <textarea
          ref={saisieRef}
          rows={1}
          dir="auto"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={surTouche}
          placeholder={t('Écrire un message…')}
          aria-label={t('Écrire un message…')}
          aria-describedby="bch-aide"
        />
        <button
          type="submit"
          className="bch-envoyer"
          disabled={!texte.trim() || tropLong}
          aria-label={t('Envoyer')}
          title={t('Envoyer')}
        >
          <SendHorizontal size={20} className="rtl-miroir" />
        </button>
      </form>
      <p id="bch-aide" className={`bch-aide ${tropLong ? 'bch-aide--erreur' : ''}`}>
        {texte.length > LONGUEUR_MAX - 200
          ? t('{n} / {max} caractères', { n: texte.length, max: LONGUEUR_MAX })
          : t('Entrée pour envoyer · Maj + Entrée pour aller à la ligne')}
      </p>
    </div>
  );
}