import { useEffect, useState } from 'react';
import {
  BellOff, CheckCheck, CircleCheck, Ban, Loader2, MessageSquare, Plus, RotateCcw, Siren, X,
} from 'lucide-react';
import alerteMachineService from '../../../services/alerteMachineService';
import personnelService from '../../../services/Personnelservice';
import SearchableSelect from '../../commun/ListeRecherche';
import Modale from '../../commun/Modale';
import { t } from '../../../i18n';
import { dateHeure } from '../../ui/Veille/Veille';
import './AlerteActions.css';

export const DUREES_SOURDINE = [
  { minutes: 30, label: '30 min' },
  { minutes: 120, label: '2 h' },
  { minutes: 480, label: '8 h' },
  { minutes: 1440, label: '24 h' },
  { minutes: 4320, label: '3 jours' },
  { minutes: 10080, label: '7 jours' },
];

const ACTIONS = {
  ACQUITTER: { titre: 'Acquitter', icone: CheckCheck, champ: 'Commentaire', bouton: 'Acquitter' },
  SOURDINE: { titre: 'Mettre en sourdine', icone: BellOff, champ: 'Motif', bouton: 'Mettre en sourdine' },
  RESOLUE: { titre: 'Marquer résolue', icone: CircleCheck, champ: 'Commentaire', bouton: 'Résolue' },
  IGNOREE: { titre: 'Ignorer l’alerte', icone: Ban, champ: 'Motif', bouton: 'Ignorer', motifObligatoire: true },
  NOUVELLE: { titre: 'Rouvrir l’alerte', icone: RotateCcw, champ: 'Motif', bouton: 'Rouvrir' },
  COMMENTER: { titre: 'Ajouter un commentaire', icone: MessageSquare, champ: 'Commentaire', bouton: 'Ajouter', motifObligatoire: true },
};

export function FenetreActionAlerte({ action, alertes, onClose, onFait }) {
  const def = ACTIONS[action];
  const [texte, setTexte] = useState('');
  const [minutes, setMinutes] = useState(120);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  if (!def) return null;
  const plusieurs = alertes.length > 1;
  const manque = def.motifObligatoire && !texte.trim();

  const valider = async () => {
    if (manque || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const tx = texte.trim();
    try {
      let maj;
      if (action === 'ACQUITTER') {
        maj = plusieurs
          ? await alerteMachineService.acquitterPlusieurs(alertes.map((a) => a.id), tx)
          : [await alerteMachineService.acquitter(alertes[0].id, tx)];
      } else if (action === 'SOURDINE') {
        maj = [await alerteMachineService.sourdine(alertes[0].id, Number(minutes), tx)];
      } else if (action === 'COMMENTER') {
        maj = [await alerteMachineService.commenter(alertes[0].id, tx)];
      } else {
        maj = await Promise.all(alertes.map((a) => alerteMachineService.changerStatut(a.id, action, tx)));
      }
      onFait(maj.filter(Boolean));
    } catch (err) {
      setErreur(err?.response?.data?.message || t('L’action n’a pas pu être enregistrée.'));
      setEnvoi(false);
    }
  };

  const Icone = def.icone;
  return (
    <Modale
      ouvert
      onFermer={onClose}
      icone={Icone}
      surtitre={plusieurs ? t('{n} alertes', { n: alertes.length }) : (alertes[0]?.equipementNom || t('Alerte machine'))}
      titre={t(def.titre)}
      taille="sm"
      className="am-modale"
      infoPied={erreur ? <span className="am-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onClose}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={valider} disabled={manque || envoi}>
            {envoi ? <Loader2 size={16} className="cf-tourne" /> : <Icone size={16} />}
            {t(def.bouton)}
          </button>
        </>
      )}
    >
      <div className="cf-grille">
        {!plusieurs && alertes[0]?.message && (
          <p className="am-rappel cf-champ--pleine" dir="auto">{alertes[0].message}</p>
        )}
        {action === 'SOURDINE' && (
          <div className="cf-champ cf-champ--pleine">
            <span className="cf-label">{t('Durée')}</span>
            <div className="am-durees" role="radiogroup" aria-label={t('Durée')}>
              {DUREES_SOURDINE.map((d) => (
                <button key={d.minutes} type="button" role="radio" aria-checked={minutes === d.minutes}
                  className={`am-duree ${minutes === d.minutes ? 'is-actif' : ''}`} onClick={() => setMinutes(d.minutes)}>
                  {t(d.label)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="cf-champ cf-champ--pleine">
          <label htmlFor="am-texte" className="cf-label">{t(def.champ)}{def.motifObligatoire ? ' *' : ''}</label>
          <textarea id="am-texte" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} />
        </div>
      </div>
    </Modale>
  );
}

const LIBELLES_JOURNAL = {
  RECUE: 'Reçue',
  ACQUITTEE: 'Acquittée',
  ESCALADE: 'Escaladée',
  SOURDINE: 'Mise en sourdine',
  FIN_SOURDINE: 'Fin de la sourdine',
  EN_MAINTENANCE: 'En maintenance',
  FIN_MAINTENANCE: 'Fin de la maintenance',
  RESOLUE: 'Résolue',
  IGNOREE: 'Ignorée',
  ROUVERTE: 'Rouverte',
  COMMENTAIRE: 'Commentaire',
  RECLAMATION: 'Réclamation créée',
};
const TON_JOURNAL = {
  RECUE: 'info', ACQUITTEE: 'succes', ESCALADE: 'danger', SOURDINE: 'neutre', RESOLUE: 'succes', IGNOREE: 'neutre', ROUVERTE: 'orange',
};

export function JournalAlerte({ historique }) {
  const lignes = [...(historique || [])].reverse();
  if (lignes.length === 0) return <p className="am-journal-vide">{t('Aucun événement enregistré.')}</p>;
  return (
    <ol className="am-journal">
      {lignes.map((l, i) => (
        <li key={`${l.date}-${i}`} data-ton={TON_JOURNAL[l.action] || 'neutre'}>
          <span className="am-journal__date">{dateHeure(l.date)}</span>
          <span className="am-journal__quoi">
            <strong>{t(LIBELLES_JOURNAL[l.action] || l.action)}</strong>
            {l.auteur && <span className="am-journal__qui">{l.auteur}</span>}
          </span>
          {l.detail && <span className="am-journal__detail" dir="auto">{l.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

const nomCourt = (p) => `${p.nom || ''} ${p.prenom || ''}`.trim() || `#${p.id}`;
const nomPersonnel = (p) => nomCourt(p) + (p.matricule ? ` (${p.matricule})` : '');

export function FenetreEscalade({ onClose, onEnregistre }) {
  const [r, setR] = useState(null);
  const [personnels, setPersonnels] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    Promise.all([
      alerteMachineService.escalade().catch(() => null),
      personnelService.getMaintenance(0, 200).then((p) => p?.content ?? []).catch(() => []),
    ]).then(([reglages, liste]) => {
      if (annule) return;
      setR(reglages || { actif: true, delaiCritique: 15, delaiAlerte: 60, niveaux: [{ personnels: [] }] });
      setPersonnels(liste);
    }).finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const majNiveau = (i, personnelsNiveau) => setR((x) => ({ ...x, niveaux: x.niveaux.map((n, j) => (j === i ? { personnels: personnelsNiveau } : n)) }));
  const ajouter = (i, id) => {
    const p = personnels.find((x) => String(x.id) === String(id));
    const n = r.niveaux[i];
    if (p && !n.personnels.some((m) => String(m.id) === String(p.id))) majNiveau(i, [...n.personnels, { id: Number(p.id), nom: nomCourt(p) }]);
  };

  const valider = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const enreg = await alerteMachineService.enregistrerEscalade({
        actif: !!r.actif, delaiCritique: Number(r.delaiCritique) || 15, delaiAlerte: Number(r.delaiAlerte) || 60, niveaux: r.niveaux,
      });
      onEnregistre?.(enreg);
      onClose();
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Enregistrement impossible.'));
      setEnvoi(false);
    }
  };

  return (
    <Modale
      ouvert
      onFermer={onClose}
      icone={Siren}
      surtitre={t('Alertes machines')}
      titre={t('Règles d’escalade')}
      taille="md"
      className="am-modale"
      infoPied={erreur ? <span className="am-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onClose}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={valider} disabled={!r || envoi}>
            {envoi ? <Loader2 size={16} className="cf-tourne" /> : <CheckCheck size={16} />}
            {t('Enregistrer')}
          </button>
        </>
      )}
    >
      {chargement || !r ? (
        <p className="am-journal-vide"><Loader2 size={15} className="cf-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="cf-grille">
          <label className="am-case cf-champ--pleine">
            <input type="checkbox" checked={!!r.actif} onChange={(e) => setR((x) => ({ ...x, actif: e.target.checked }))} />
            {t('Escalade active')}
          </label>
          <div className="cf-champ">
            <label htmlFor="am-delai-critique" className="cf-label">{t('Critique : délai par niveau (min)')}</label>
            <input id="am-delai-critique" type="number" min="1" value={r.delaiCritique} onChange={(e) => setR((x) => ({ ...x, delaiCritique: e.target.value }))} />
          </div>
          <div className="cf-champ">
            <label htmlFor="am-delai-alerte" className="cf-label">{t('Alerte : délai par niveau (min)')}</label>
            <input id="am-delai-alerte" type="number" min="1" value={r.delaiAlerte} onChange={(e) => setR((x) => ({ ...x, delaiAlerte: e.target.value }))} />
          </div>
          {r.niveaux.map((n, i) => (
            <div key={i} className="cf-champ cf-champ--pleine am-niveau">
              <div className="am-niveau__tete">
                <span className="cf-label">{t('Niveau {n}', { n: i + 1 })}</span>
                {r.niveaux.length > 1 && (
                  <button type="button" className="am-lien" onClick={() => setR((x) => ({ ...x, niveaux: x.niveaux.filter((_, j) => j !== i) }))}>
                    <X size={13} /> {t('Retirer')}
                  </button>
                )}
              </div>
              <SearchableSelect
                id={`am-niveau-${i}`}
                name={`niveau-${i}`}
                value=""
                onChange={(e) => ajouter(i, e.target.value)}
                options={personnels.filter((p) => !n.personnels.some((m) => String(m.id) === String(p.id)))}
                placeholder={t('Ajouter un personnel de maintenance...')}
                emptyMessage={t('Aucun personnel ne correspond')}
                getValue={(p) => p.id}
                getLabel={nomPersonnel}
                getOptionHint={(p) => (p.fonction || null)}
              />
              {n.personnels.length > 0 && (
                <ul className="am-membres">
                  {n.personnels.map((m) => (
                    <li key={m.id}>
                      <span>{m.nom}</span>
                      <button type="button" onClick={() => majNiveau(i, n.personnels.filter((x) => x.id !== m.id))}
                        aria-label={t('Retirer {nom}', { nom: m.nom })} title={t('Retirer {nom}', { nom: m.nom })}>
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {r.niveaux.length < 5 && (
            <button type="button" className="am-lien cf-champ--pleine" onClick={() => setR((x) => ({ ...x, niveaux: [...x.niveaux, { personnels: [] }] }))}>
              <Plus size={14} /> {t('Ajouter un niveau')}
            </button>
          )}
        </div>
      )}
    </Modale>
  );
}
