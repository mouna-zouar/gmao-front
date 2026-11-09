// Cycle de vie d'une réclamation, sur le modèle des demandes de service IBM Maximo :
// Nouveau → En file (affectée à un groupe / un technicien) → En cours (prise en charge, bon créé)
// → Résolue → Clôturée ; Annulée à tout moment avant la clôture, avec un motif obligatoire.
import { useEffect, useState } from 'react';
import { Loader2, UserCheck, XCircle, RotateCcw, CheckCircle2 } from 'lucide-react';
import reclamationService from '../../../services/Reclamationservice';
import personnelService from '../../../services/personnelService';
import AlerteFormation from '../Formations/AlerteFormation';
import serviceService from '../../../services/Serviceservice';
import authService from '../../../services/Authservice';
import SearchableSelect from '../../commun/ListeRecherche';
import { t } from '../../../i18n';
import './ReclamationActions.css';

export const ETAT_REC = { NOUVEAU: 0, EN_COURS: 1, CLOTUREE: 2, RESOLUE: 3, ANNULEE: 4, EN_FILE: 5 };

/** Actions possibles selon l'état de la réclamation. */
export function actionsPossibles(reclamation) {
  if (!reclamation) return {};
  const e = reclamation.etat ?? ETAT_REC.NOUVEAU;
  const active = e === ETAT_REC.NOUVEAU || e === ETAT_REC.EN_FILE || e === ETAT_REC.EN_COURS;
  return {
    affecter: active,
    prendre: e === ETAT_REC.NOUVEAU || e === ETAT_REC.EN_FILE,
    resoudre: active,
    cloturer: e === ETAT_REC.RESOLUE,
    rouvrir: e === ETAT_REC.RESOLUE,
    annuler: e !== ETAT_REC.CLOTUREE && e !== ETAT_REC.ANNULEE,
  };
}

export const estAffectee = (r) => r?.groupeId != null || r?.personnelAffecteId != null;

export const nomTechnicien = (r) => (r?.personnelAffecte
  ? `${r.personnelAffecte.nom ?? ''} ${r.personnelAffecte.prenom ?? ''}`.trim()
  : (r?.personnelAffecteNom || ''));

export const nomGroupe = (r) => r?.groupeNom || '';

/** Qui fait l'action : l'utilisateur connecté. */
function auteur() {
  const u = authService.getCurrentUser();
  const id = u?.personnelId ?? u?.personnel?.id ?? u?.userId ?? null;
  return {
    auteurId: id != null ? Number(id) : null,
    auteurNom: u?.userNom || [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.login || null,
  };
}

const nomPersonnel = (p) => `${p.nom || ''} ${p.prenom || ''}`.trim() + (p.matricule ? ` (${p.matricule})` : '');

/* ---------- Fenêtre « Affecter / Réaffecter » : groupe (service) + technicien ---------- */
function FenetreAffecter({ reclamation, onClose, onValider }) {
  const [groupeId, setGroupeId] = useState(reclamation.groupeId != null ? String(reclamation.groupeId) : '');
  const [technicienId, setTechnicienId] = useState(reclamation.personnelAffecteId != null ? String(reclamation.personnelAffecteId) : '');
  const [commentaire, setCommentaire] = useState('');
  const [groupes, setGroupes] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const reaffecter = estAffectee(reclamation);

  useEffect(() => {
    let annule = false;
    Promise.allSettled([serviceService.getAll(0, 200), personnelService.getMaintenance(0, 200)]).then(([g, p]) => {
      if (annule) return;
      setGroupes(g.status === 'fulfilled' ? (g.value?.content ?? []) : []);
      setTechniciens(p.status === 'fulfilled' ? (p.value?.content ?? []) : []);
      setChargement(false);
    });
    return () => { annule = true; };
  }, []);

  const inchange = String(reclamation.groupeId ?? '') === groupeId && String(reclamation.personnelAffecteId ?? '') === technicienId;
  const vide = !groupeId && !technicienId;

  const valider = async () => {
    if (vide || inchange || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const groupe = groupes.find((g) => String(g.id) === groupeId);
    const technicien = techniciens.find((p) => String(p.id) === technicienId);
    try {
      await onValider({
        groupeId: groupeId ? Number(groupeId) : null,
        groupeNom: groupe ? (groupe.description || groupe.code || null) : (groupeId ? reclamation.groupeNom : null),
        personnelAffecteId: technicienId ? Number(technicienId) : null,
        personnelAffecteNom: technicien ? `${technicien.nom || ''} ${technicien.prenom || ''}`.trim() : (technicienId ? reclamation.personnelAffecteNom : null),
        motif: commentaire.trim() || null,
      });
    } catch (err) {
      setErreur(err.response?.data?.message || t('L’affectation n’a pas pu être enregistrée.'));
      setEnvoi(false);
    }
  };

  return (
    <div className="modal-overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-modal-container rec-fenetre rec-affecter" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rec-affecter-titre">
        <div className="confirm-modal-content">
          <div className="confirm-modal-icon-wrapper">
            <UserCheck className="modal-confirm-icon info" size={44} strokeWidth={2} />
          </div>
          <div className="confirm-modal-text">
            <h3 id="rec-affecter-titre">{reaffecter ? t('Réaffecter la réclamation') : t('Affecter la réclamation')}</h3>
            <p>{t('Choisissez le groupe responsable et/ou le technicien. Chaque affectation est gardée dans l’historique.')}</p>
            <div className="rec-affecter-champs">
              <label htmlFor="rec-groupe">{t('Groupe responsable')}</label>
              <SearchableSelect
                id="rec-groupe"
                name="groupeId"
                value={groupeId}
                onChange={(e) => setGroupeId(e.target.value)}
                options={groupes}
                loading={chargement}
                placeholder={t('Rechercher un service...')}
                emptyMessage={t('Aucun service ne correspond')}
                allowEmpty
                emptyOptionLabel={t('— Aucun groupe —')}
                getValue={(s) => s.id}
                getLabel={(s) => s.description || s.code || `Service #${s.id}`}
                getOptionHint={(s) => (s.code && s.description ? `Code : ${s.code}` : null)}
              />
              <label htmlFor="rec-technicien">{t('Technicien')}</label>
              <SearchableSelect
                id="rec-technicien"
                name="personnelAffecteId"
                value={technicienId}
                onChange={(e) => setTechnicienId(e.target.value)}
                options={techniciens}
                loading={chargement}
                placeholder={t('Rechercher un technicien...')}
                emptyMessage={t('Aucun personnel ne correspond')}
                allowEmpty
                emptyOptionLabel={t('— Aucun technicien —')}
                getValue={(p) => p.id}
                getLabel={nomPersonnel}
                getOptionHint={(p) => (p.fonction || null)}
              />
              <AlerteFormation personnelId={technicienId} lotArticleImmobilistationId={reclamation.lotArticleImmobilistationId} />
              <label htmlFor="rec-affecter-commentaire">{t('Commentaire (facultatif)')}</label>
              <textarea
                id="rec-affecter-commentaire"
                className="confirm-modal-input"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder={reaffecter ? t('Pourquoi cette réaffectation ?') : t('Consigne pour le technicien...')}
                rows={2}
              />
            </div>
            {erreur && <p className="rec-affecter-erreur" role="alert">{erreur}</p>}
          </div>
        </div>
        <div className="confirm-modal-footer">
          <button type="button" className="confirm-btn primary" onClick={valider} disabled={vide || inchange || envoi}>
            {envoi && <Loader2 size={15} className="rcx-tourne" />}
            {reaffecter ? t('Réaffecter') : t('Affecter')}
          </button>
          <button type="button" className="confirm-btn secondary" onClick={onClose}>{t('Fermer')}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Fenêtre motif / commentaire (annuler, rouvrir, résoudre) ---------- */
const FENETRES_MOTIF = {
  annuler: {
    Icone: XCircle, ton: 'danger', titre: 'Annuler la réclamation', bouton: 'Annuler la réclamation',
    texte: 'Indiquez pourquoi la réclamation est annulée. Le demandeur sera prévenu.', placeholder: "Motif d'annulation...", obligatoire: true,
  },
  rouvrir: {
    Icone: RotateCcw, ton: 'warning', titre: 'Rouvrir la réclamation', bouton: 'Rouvrir',
    texte: 'Le problème n’est pas réglé : la réclamation repasse « En cours ». Indiquez pourquoi.', placeholder: 'Motif de réouverture...', obligatoire: true,
  },
  resoudre: {
    Icone: CheckCircle2, ton: 'success', titre: 'Marquer la réclamation résolue', bouton: 'Marquer résolue',
    texte: 'Le problème est réglé. La réclamation attendra ensuite sa clôture.', placeholder: 'Ce qui a été fait (facultatif)...', obligatoire: false,
  },
};

function FenetreMotif({ type, onClose, onValider }) {
  const def = FENETRES_MOTIF[type];
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const bloque = (def.obligatoire && !motif.trim()) || envoi;
  const valider = async () => {
    if (bloque) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await onValider({ motif: motif.trim() || null });
    } catch (err) {
      setErreur(err.response?.data?.message || t('L’action n’a pas pu être enregistrée.'));
      setEnvoi(false);
    }
  };
  const Icone = def.Icone;
  return (
    <div className="modal-overlay confirm-overlay" onClick={onClose}>
      <div className="confirm-modal-container rec-fenetre" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rec-motif-titre">
        <div className="confirm-modal-content">
          <div className="confirm-modal-icon-wrapper">
            <Icone className={`modal-confirm-icon ${def.ton}`} size={44} strokeWidth={2} />
          </div>
          <div className="confirm-modal-text">
            <h3 id="rec-motif-titre">{t(def.titre)}</h3>
            <p>{t(def.texte)}</p>
            <textarea
              className="confirm-modal-input"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t(def.placeholder)}
              rows={3}
              autoFocus
              aria-required={def.obligatoire}
            />
            {erreur && <p className="rec-affecter-erreur" role="alert">{erreur}</p>}
          </div>
        </div>
        <div className="confirm-modal-footer">
          <button type="button" className={`confirm-btn primary ${def.ton === 'danger' ? 'danger' : ''}`} onClick={valider} disabled={bloque}>
            {envoi && <Loader2 size={15} className="rcx-tourne" />}
            {t(def.bouton)}
          </button>
          <button type="button" className="confirm-btn secondary" onClick={onClose}>{t('Fermer')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Actions du cycle de vie, partagées par la liste, la page de détail et Mon espace.
 *   const { lancer, fenetres, enCours } = useActionsReclamation(apresAction);
 *   lancer('affecter' | 'prendre' | 'resoudre' | 'cloturer' | 'rouvrir' | 'annuler', reclamation)
 * apresAction(resultat, nomAction) est appelée après chaque action réussie.
 */
export function useActionsReclamation(apresAction) {
  const [fenetre, setFenetre] = useState(null); // { type, reclamation }
  const [enCours, setEnCours] = useState(false);

  const executer = async (nom, reclamation, corps = {}) => {
    const appel = {
      affecter: reclamationService.affecter,
      prendre: reclamationService.prendreEnCharge,
      resoudre: reclamationService.resoudre,
      cloturer: reclamationService.cloturer,
      rouvrir: reclamationService.rouvrir,
      annuler: reclamationService.annuler,
    }[nom];
    const resultat = await appel(reclamation.id, { ...corps, ...auteur() });
    setFenetre(null);
    await apresAction?.(resultat, nom);
    return resultat;
  };

  // Actions directes (sans fenêtre) : une erreur est affichée en alerte
  const directe = async (nom, reclamation) => {
    if (enCours) return;
    setEnCours(true);
    try {
      await executer(nom, reclamation);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('L’action n’a pas pu être enregistrée.'));
    } finally {
      setEnCours(false);
    }
  };

  const lancer = (nom, reclamation) => {
    if (!reclamation) return;
    if (nom === 'prendre' || nom === 'cloturer') directe(nom, reclamation);
    else setFenetre({ type: nom, reclamation });
  };

  const fermer = () => setFenetre(null);
  let fenetres = null;
  if (fenetre?.type === 'affecter') {
    fenetres = <FenetreAffecter reclamation={fenetre.reclamation} onClose={fermer} onValider={(c) => executer('affecter', fenetre.reclamation, c)} />;
  } else if (fenetre && FENETRES_MOTIF[fenetre.type]) {
    fenetres = <FenetreMotif type={fenetre.type} onClose={fermer} onValider={(c) => executer(fenetre.type, fenetre.reclamation, c)} />;
  }

  return { lancer, fenetres, enCours };
}

/* ---------- Historique des affectations et des changements d'état ---------- */
export const TYPES_HISTORIQUE = {
  CREATION: 'Réclamation créée',
  AFFECTATION: 'Affectée',
  REAFFECTATION: 'Réaffectée',
  DESAFFECTATION: 'Affectation retirée',
  PRISE_EN_CHARGE: 'Prise en charge',
  RESOLUTION: 'Résolue',
  CLOTURE: 'Clôturée',
  REOUVERTURE: 'Rouverte',
  ANNULATION: 'Annulée',
  LECTURE: 'Lue par le technicien',
};
