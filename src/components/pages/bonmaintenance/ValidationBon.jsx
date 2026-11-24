import { useEffect, useState } from 'react';
import { Archive, ClipboardCheck, Loader2, Undo2, X } from 'lucide-react';
import validationBonService from '../../../services/validationBonService';
import personnelService from '../../../services/Personnelservice';
import SearchableSelect from '../../commun/ListeRecherche';
import Modale from '../../commun/Modale';
import { t, locale } from '../../../i18n';
import './ValidationBon.css';

const dateHeure = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function useDroitsValidation(bon) {
  const [droits, setDroits] = useState(null);
  const statut = bon?.validationStatut;
  useEffect(() => {
    let annule = false;
    if (statut !== 'A_VALIDER' || !bon?.id) { setDroits(null); return undefined; }
    validationBonService.droits(bon.id)
      .then((d) => { if (!annule) setDroits(d); })
      .catch(() => { if (!annule) setDroits({ peutValider: false, raison: 'ERREUR' }); });
    return () => { annule = true; };
  }, [bon?.id, statut]);
  return droits;
}

const texteRaison = (droits) => {
  if (!droits || droits.peutValider) return null;
  return droits.raison === 'ERREUR'
    ? t('Impossible de vérifier vos droits : le serveur ne répond pas ou n’est pas à jour (redémarrez le backend).')
    : t(droits.raison || 'Réservé aux validateurs de ce bon');
};

export function BoutonsDecision({ bon, onMaj, compact = false }) {
  const droits = useDroitsValidation(bon);
  const [fenetre, setFenetre] = useState(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const statut = bon?.validationStatut;

  if (statut !== 'A_VALIDER') return null;

  const peut = !!droits?.peutValider;
  const raison = texteRaison(droits) || undefined;

  const decider = async () => {
    if (fenetre === 'REFUSER' && !texte.trim()) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const maj = fenetre === 'VALIDER'
        ? await validationBonService.valider(bon.id, texte.trim())
        : await validationBonService.refuser(bon.id, texte.trim());
      setFenetre(null);
      setTexte('');
      onMaj?.(maj);
    } catch (err) {
      setErreur(err?.response?.data?.message || t('L’action n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrir = (mode) => { setFenetre(mode); setTexte(''); setErreur(null); };

  return (
    <>
      <div className={`vbn-actions${compact ? ' vbn-actions--compact' : ''}`}>
        <button type="button" className="vbn-btn vbn-btn--refuser" disabled={!peut} title={raison} onClick={() => ouvrir('REFUSER')}>
          <Undo2 size={15} /> {t('Refuser')}
        </button>
        <button type="button" className="vbn-btn vbn-btn--valider" disabled={!peut} title={raison} onClick={() => ouvrir('VALIDER')}>
          <ClipboardCheck size={15} /> {t('Valider')}
        </button>
      </div>

      {fenetre && (
        <Modale
          ouvert
          onFermer={() => setFenetre(null)}
          icone={fenetre === 'VALIDER' ? ClipboardCheck : Undo2}
          surtitre={bon.num || t('Bon #{id}', { id: bon.id })}
          titre={fenetre === 'VALIDER' ? t('Valider le bon') : t('Refuser le bon')}
          taille="sm"
          className="vbn-modale"
          infoPied={erreur ? <span className="vbn-erreur" role="alert">{erreur}</span> : null}
          pied={(
            <>
              <button type="button" className="cm-btn" onClick={() => setFenetre(null)}>{t('Annuler')}</button>
              <button type="button" className="cm-btn cm-btn--principal" onClick={decider} disabled={envoi || (fenetre === 'REFUSER' && !texte.trim())}>
                {envoi ? <Loader2 size={16} className="cf-tourne" /> : (fenetre === 'VALIDER' ? <ClipboardCheck size={16} /> : <Undo2 size={16} />)}
                {fenetre === 'VALIDER' ? t('Valider et archiver') : t('Refuser')}
              </button>
            </>
          )}
        >
          <div className="cf-grille">
            <div className="cf-champ cf-champ--pleine">
              <label htmlFor="vbn-texte" className="cf-label">{fenetre === 'VALIDER' ? t('Commentaire') : `${t('Motif')} *`}</label>
              <textarea id="vbn-texte" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} />
            </div>
          </div>
        </Modale>
      )}
    </>
  );
}

export function BandeauValidation({ bon }) {
  const statut = bon?.validationStatut;
  const droits = useDroitsValidation(bon);

  if (!statut || (statut === 'REFUSE' && Number(bon.etat) === 4)) return null;

  return (
    <div className={`vbn-bandeau vbn-bandeau--${statut.toLowerCase()}`} role="status">
      <span className="vbn-icone" aria-hidden="true">
        {statut === 'VALIDE' ? <Archive size={18} /> : statut === 'REFUSE' ? <Undo2 size={18} /> : <ClipboardCheck size={18} />}
      </span>
      <div className="vbn-texte">
        {statut === 'A_VALIDER' && <strong>{t('Bon effectué : en attente de validation')}</strong>}
        {statut === 'A_VALIDER' && texteRaison(droits) && <span>{texteRaison(droits)}</span>}
        {statut === 'VALIDE' && (
          <>
            <strong>{t('Validé et archivé')}</strong>
            <span>{[bon.validationParNom && t('Par {nom}', { nom: bon.validationParNom }), dateHeure(bon.dateValidation)].filter(Boolean).join(' · ')}</span>
          </>
        )}
        {statut === 'REFUSE' && (
          <>
            <strong>{t('Refusé à la validation : bon à reprendre')}</strong>
            <span>{[bon.validationParNom && t('Par {nom}', { nom: bon.validationParNom }), dateHeure(bon.dateValidation)].filter(Boolean).join(' · ')}</span>
          </>
        )}
        {bon.validationCommentaire && statut !== 'A_VALIDER' && <span className="vbn-motif" dir="auto">« {bon.validationCommentaire} »</span>}
      </div>
    </div>
  );
}

const nomCourt = (p) => `${p.nom || ''} ${p.prenom || ''}`.trim() || `#${p.id}`;
const nomPersonnel = (p) => nomCourt(p) + (p.matricule ? ` (${p.matricule})` : '');

export function FenetreValidateurs({ onClose, onEnregistre }) {
  const [r, setR] = useState(null);
  const [personnels, setPersonnels] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    Promise.all([
      validationBonService.reglages().catch(() => null),
      personnelService.getMaintenance(0, 200).then((p) => p?.content ?? []).catch(() => []),
    ]).then(([reglages, liste]) => {
      if (annule) return;
      setR(reglages || { actif: true, validateurs: [] });
      setPersonnels(liste);
    }).finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, []);

  const ajouter = (id) => {
    const p = personnels.find((x) => String(x.id) === String(id));
    if (p && !r.validateurs.some((m) => String(m.id) === String(p.id))) {
      setR((x) => ({ ...x, validateurs: [...x.validateurs, { id: Number(p.id), nom: nomCourt(p) }] }));
    }
  };

  const valider = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const enreg = await validationBonService.enregistrerReglages({ actif: !!r.actif, validateurs: r.validateurs });
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
      icone={ClipboardCheck}
      surtitre={t('Bons de maintenance')}
      titre={t('Validation des bons')}
      taille="md"
      className="vbn-modale"
      infoPied={erreur ? <span className="vbn-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onClose}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={valider} disabled={!r || envoi}>
            {envoi ? <Loader2 size={16} className="cf-tourne" /> : <ClipboardCheck size={16} />}
            {t('Enregistrer')}
          </button>
        </>
      )}
    >
      {chargement || !r ? (
        <p className="vbn-vide"><Loader2 size={15} className="cf-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="cf-grille">
          <label className="vbn-case cf-champ--pleine">
            <input type="checkbox" checked={!!r.actif} onChange={(e) => setR((x) => ({ ...x, actif: e.target.checked }))} />
            {t('Validation par le manager active')}
          </label>
          <div className="cf-champ cf-champ--pleine">
            <label htmlFor="vbn-validateurs" className="cf-label">{t('Validateurs')}</label>
            <SearchableSelect
              id="vbn-validateurs"
              name="validateurs"
              value=""
              onChange={(e) => ajouter(e.target.value)}
              options={personnels.filter((p) => !r.validateurs.some((m) => String(m.id) === String(p.id)))}
              placeholder={t('Ajouter un personnel de maintenance...')}
              emptyMessage={t('Aucun personnel ne correspond')}
              getValue={(p) => p.id}
              getLabel={nomPersonnel}
              getOptionHint={(p) => (p.fonction || null)}
            />
            {r.validateurs.length > 0 && (
              <ul className="vbn-membres">
                {r.validateurs.map((m) => (
                  <li key={m.id}>
                    <span>{m.nom}</span>
                    <button type="button" onClick={() => setR((x) => ({ ...x, validateurs: x.validateurs.filter((v) => v.id !== m.id) }))}
                      aria-label={t('Retirer {nom}', { nom: m.nom })} title={t('Retirer {nom}', { nom: m.nom })}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modale>
  );
}
