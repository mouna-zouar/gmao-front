import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, MessageCircle, Search } from 'lucide-react';
import BmdChat from '../bonmaintenance/BmdChat';
import chatBonService from '../../../services/chatBonService';
import { t, locale } from '../../../i18n';
import { refBon, versDate } from './espacePlanning';

/*
 * Discussions de Mon espace : à gauche, le chat de chaque bon sur lequel je travaille
 * (dernier message, non-lus) ; à droite, la conversation choisie, en direct.
 */

const ACTUALISATION_MS = 20000;

const heureOuDate = (v) => {
  const d = versDate(v);
  if (!d) return '';
  const aujourdhui = new Date();
  return d.toDateString() === aujourdhui.toDateString()
    ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};

export default function EspaceDiscussions({ bons, personnelId, bonInitial, onOuvrirBon, onNonLusChange }) {
  const [resumes, setResumes] = useState({});
  const [choisi, setChoisi] = useState(bonInitial ?? null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState(false);

  const ids = useMemo(() => bons.map((b) => b.id).filter((id) => id != null), [bons]);
  const cleIds = ids.join(',');

  // Dernier message et non-lus de chaque bon ; rafraîchi toutes les 20 s quand la page est visible
  const charger = useCallback(() => {
    if (!cleIds) return;
    chatBonService.getResumes(cleIds.split(',').map(Number))
      .then((liste) => {
        setResumes(Object.fromEntries(liste.map((r) => [r.bonMaintenanceId, r])));
        setErreur(false);
      })
      .catch(() => setErreur(true));
  }, [cleIds]);

  useEffect(() => {
    charger();
    const minuterie = setInterval(() => {
      if (document.visibilityState === 'visible') charger();
    }, ACTUALISATION_MS);
    return () => clearInterval(minuterie);
  }, [charger]);

  // Total des non-lus, pour la carte « Discussions » et le tableau des bons
  useEffect(() => {
    onNonLusChange?.(Object.fromEntries(Object.values(resumes).map((r) => [r.bonMaintenanceId, r.nonLus])));
  }, [resumes, onNonLusChange]);

  // Conversations : d'abord celles qui ont des non-lus, puis par dernier message, puis les bons sans message
  const conversations = useMemo(() => {
    const filtre = recherche.trim().toLowerCase();
    return bons
      .filter((b) => !filtre || [b.num, b.titre].filter(Boolean).join(' ').toLowerCase().includes(filtre))
      .map((b) => ({ bon: b, resume: resumes[b.id] }))
      .sort((a, b) => {
        const na = a.resume?.nonLus || 0;
        const nb = b.resume?.nonLus || 0;
        if ((na > 0) !== (nb > 0)) return na > 0 ? -1 : 1;
        const da = a.resume?.dernierMessage?.id ?? 0;
        const db = b.resume?.dernierMessage?.id ?? 0;
        if (da !== db) return db - da;
        return (versDate(b.bon.dateCreation)?.getTime() ?? 0) - (versDate(a.bon.dateCreation)?.getTime() ?? 0);
      });
  }, [bons, resumes, recherche]);

  const bonChoisi = bons.find((b) => b.id === choisi) || null;

  // Conversation ouverte : ses messages sont lus, et son aperçu suit le dernier message
  const surNonLus = useCallback((n) => {
    if (choisi == null) return;
    setResumes((r) => (r[choisi] && r[choisi].nonLus !== n ? { ...r, [choisi]: { ...r[choisi], nonLus: n } } : r));
  }, [choisi]);

  const surDernierMessage = useCallback((m) => {
    setResumes((r) => {
      const actuel = r[m.bonMaintenanceId];
      if (actuel?.dernierMessage?.id === m.id) return r;
      return { ...r, [m.bonMaintenanceId]: { bonMaintenanceId: m.bonMaintenanceId, nonLus: 0, ...actuel, dernierMessage: m } };
    });
  }, []);

  if (bons.length === 0) {
    return (
      <div className="ep-empty">
        <MessageCircle size={18} />
        <span>{t('Aucun bon de maintenance ne vous est associé.')}</span>
      </div>
    );
  }

  return (
    <div className={`ep-discussions ${bonChoisi ? 'a-conversation' : ''}`}>
      {/* ---- Liste des conversations ---- */}
      <aside className="ep-disc-liste" aria-label={t('Conversations')}>
        <label className="ep-disc-recherche">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher un bon…')}
            aria-label={t('Rechercher un bon…')}
          />
        </label>

        {erreur && <p className="ep-disc-erreur">{t('Impossible de charger les discussions.')}</p>}

        <ul>
          {conversations.map(({ bon, resume }) => {
            const m = resume?.dernierMessage;
            const deMoi = m && String(m.personnelId) === String(personnelId);
            const nonLus = resume?.nonLus || 0;
            return (
              <li key={bon.id}>
                <button
                  type="button"
                  className={`ep-disc-item ${choisi === bon.id ? 'is-choisi' : ''} ${nonLus ? 'a-non-lus' : ''}`}
                  onClick={() => setChoisi(bon.id)}
                  aria-current={choisi === bon.id ? 'true' : undefined}
                >
                  <span className="ep-disc-pastille" aria-hidden="true"><MessageCircle size={16} /></span>
                  <span className="ep-disc-texte">
                    <span className="ep-disc-ligne">
                      <strong className="ep-disc-num">{refBon(bon, bon.id)}</strong>
                      {m && <time className="ep-disc-heure">{heureOuDate(m.dateEnvoi)}</time>}
                    </span>
                    <span className="ep-disc-titre">{bon.titre || '—'}</span>
                    <span className="ep-disc-ligne">
                      <span className="ep-disc-apercu">
                        {m
                          ? `${deMoi ? t('Vous') : (m.personnelNom || t('Un participant'))} : ${m.contenu}`
                          : t('Aucun message pour l’instant')}
                      </span>
                      {nonLus > 0 && <span className="ep-disc-nb">{nonLus}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {conversations.length === 0 && <li className="ep-disc-vide">{t('Aucun bon ne correspond.')}</li>}
        </ul>
      </aside>

      {/* ---- Conversation ---- */}
      <section className="ep-disc-conversation" aria-label={t('Conversation')}>
        {bonChoisi ? (
          <>
            <header className="ep-disc-entete">
              <button type="button" className="ep-disc-retour" onClick={() => setChoisi(null)} aria-label={t('Retour aux conversations')}>
                <ArrowLeft size={18} className="rtl-miroir" />
              </button>
              <div className="ep-disc-entete-texte">
                <strong>{refBon(bonChoisi, bonChoisi.id)}</strong>
                <span>{bonChoisi.titre || ''}</span>
              </div>
              <button type="button" className="ep-open-button ep-open-button--plein" onClick={() => onOuvrirBon(bonChoisi)}>
                <ExternalLink size={15} /> {t('Ouvrir le bon')}
              </button>
            </header>
            <div className="ep-disc-chat">
              <BmdChat
                key={bonChoisi.id}
                bonId={bonChoisi.id}
                onNonLusChange={surNonLus}
                onDernierMessage={surDernierMessage}
              />
            </div>
          </>
        ) : (
          <div className="ep-disc-accueil">
            <span className="ep-disc-accueil-icone"><MessageCircle size={28} /></span>
            <p>{t('Choisissez un bon à gauche pour discuter avec son équipe.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}