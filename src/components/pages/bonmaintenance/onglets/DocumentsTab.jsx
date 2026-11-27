import { useEffect, useState } from 'react';
import {
  Trash2,
  Loader2,
  Printer,
  Send,
  CloudCheck,
  PackageSearch,
  FileCheck,
  Inbox,
  X,
  Check,
  AlertTriangle,
  History,
} from 'lucide-react';
import bonMaintenanceDocumentAchatService from '../../../../services/Bonmaintenancedocumentachatservice';
import Modale from '../../../commun/Modale';
import prestataireService from '../../../../services/prestataireService';
import { obtenirPrestataires, obtenirReferentiel } from '../../../../store/referentiels';
import depotCubixService from '../../../../services/depotCubixService';
import authService from '../../../../services/Authservice';
import { imprimerPiece } from '../../../../utils/imprimerPiece';
import articleService from '../../../../services/articleService';
import prestataireArticleService from '../../../../services/prestataireArticleService';
import pieceService from '../../../../services/Pieceservice';
import Button from '../../../ui/Button';
import ConfirmModal from '../../../ui/modals/ConfirmModal';
import { SearchableSelect } from '../BmdCommun';
import { t, locale } from '../../../../i18n';

const TYPES_PIECE = { '.COMMANDE_FOURNISSEUR': 'Commande fournisseur', '.D_Fourniture': 'Demande de fourniture' };

async function enteteImpression() {
  const params = await obtenirReferentiel('parametres').catch(() => []);
  const v = (cle) => (params || []).find((p) => p.cle === cle)?.valeur?.trim() || '';
  const contexte = authService.getContexteMetier() || {};
  let presta = null;
  if ((!v('impression.societe.nom') || !v('impression.societe.telephone')) && Number(contexte.prestataireId) > 0) {
    presta = await prestataireService.getById(contexte.prestataireId).catch(() => null);
  }
  const nomPresta = presta ? (presta.raisonSociale || `${presta.nom || ''} ${presta.prenom || ''}`.trim()) : '';
  return {
    nom: v('impression.societe.nom') || nomPresta || contexte.prestataireNom || '',
    adresse: v('impression.societe.adresse'),
    ville: v('impression.societe.ville'),
    codePostal: v('impression.societe.code_postal'),
    matriculeFiscal: v('impression.societe.matricule_fiscal'),
    telephone: v('impression.societe.telephone') || presta?.telephone || '',
  };
}

const CIRCUIT_ACHAT = [
  { cle: 'BROUILLON', label: 'Brouillon' },
  { cle: 'EN_ATTENTE_VALIDATION', label: 'En attente de validation' },
  { cle: 'VALIDE', label: 'Validé' },
  { cle: 'COMMANDE', label: 'Commandé', labelDemande: 'Transmis' },
  { cle: 'PARTIELLEMENT_RECEPTIONNE', label: 'Partiellement réceptionné' },
  { cle: 'RECEPTIONNE', label: 'Réceptionné' },
  { cle: 'CLOTURE', label: 'Clôturé' },
];

const statutAchat = (piece) => piece?.statutAchat || (piece?.cubixPieceId != null ? 'COMMANDE' : 'BROUILLON');

const libelleStatutAchat = (cle, piece) => {
  const e = CIRCUIT_ACHAT.find((x) => x.cle === cle);
  if (!e) return cle;
  return t(piece?.codePieceType === '.D_Fourniture' && e.labelDemande ? e.labelDemande : e.label);
};

const lireSuiviAchat = (piece) => {
  try { const v = JSON.parse(piece?.suiviAchat || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

function CircuitAchat({ piece }) {
  const [ouvert, setOuvert] = useState(false);
  const actuel = statutAchat(piece);
  const index = CIRCUIT_ACHAT.findIndex((e) => e.cle === actuel);
  const suivi = lireSuiviAchat(piece);
  const dernier = suivi[suivi.length - 1];
  const refus = actuel === 'BROUILLON' && dernier?.commentaire?.startsWith('Refusé');
  return (
    <div className="bmd-achat">
      <ol className="bmd-achat-etapes" aria-label={t("Circuit d'achat")}>
        {CIRCUIT_ACHAT.map((e, i) => (
          <li key={e.cle} className={`${i < index ? 'is-faite' : ''} ${i === index ? 'is-actuelle' : ''}`}
            title={libelleStatutAchat(e.cle, piece)}>
            <span className="bmd-achat-point">{i < index ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
            {i === index && <span className="bmd-achat-label">{libelleStatutAchat(e.cle, piece)}</span>}
          </li>
        ))}
      </ol>
      {suivi.length > 0 && (
        <button type="button" className="bmd-achat-suivi-btn" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
          <History size={12} /> {t('Suivi')} ({suivi.length})
        </button>
      )}
      {refus && <span className="bmd-achat-refus"><AlertTriangle size={12} /> {dernier.commentaire}</span>}
      {ouvert && (
        <ul className="bmd-achat-suivi">
          {suivi.map((s, i) => (
            <li key={i}>
              <strong>{libelleStatutAchat(s.statut, piece)}</strong>
              <span>{s.date ? new Date(s.date).toLocaleString(locale()) : ''}{s.parNom ? ` · ${s.parNom}` : ''}</span>
              {s.commentaire && <em>{s.commentaire}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocumentsTab({ bonMaintenanceId, bon }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pieceId, setPieceId] = useState('');
  const [piecesDisponibles, setPiecesDisponibles] = useState([]);
  const [articles, setArticles] = useState([]);
  const [prestataires, setPrestataires] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [impressionId, setImpressionId] = useState(null);
  const [transfertId, setTransfertId] = useState(null);
  const [messageCubix, setMessageCubix] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [refus, setRefus] = useState(null);
  const [reception, setReception] = useState(null);

  const auteur = () => {
    const u = authService.getCurrentUser() || {};
    return { personnelId: u.personnelId ?? u.userId ?? null, personnelNom: u.userNom || u.login || null };
  };

  const actionCircuit = async (d, action, corps = {}) => {
    setActionId(d.id);
    setMessageCubix(null);
    try {
      await bonMaintenanceDocumentAchatService.workflow(d.pieceId, action, { ...auteur(), ...corps });
      await load();
      return true;
    } catch (err) {
      setMessageCubix({ ok: false, texte: err?.response?.data?.message || t("L'action n'a pas pu être enregistrée.") });
      return false;
    } finally {
      setActionId(null);
    }
  };

  const confirmerEtape = (d, action, titre, message, texteBouton) => setConfirmModal({
    show: true, title: titre, type: 'info', confirmText: texteBouton, message,
    onConfirm: async () => { closeConfirmModal(); await actionCircuit(d, action); },
  });

  const ouvrirReception = async (d) => {
    setReception({ doc: d, lignes: [], saisies: {}, chargement: true });
    try {
      const lignes = await bonMaintenanceDocumentAchatService.lignesPiece(d.pieceId);
      setReception({ doc: d, lignes, saisies: Object.fromEntries(lignes.map((l) => [l.id, String(l.qteRecue ?? 0)])), chargement: false });
    } catch {
      setReception(null);
      setMessageCubix({ ok: false, texte: t('Les lignes de la pièce sont introuvables.') });
    }
  };

  const validerReception = async () => {
    const receptions = reception.lignes.map((l) => ({ ligneId: l.id, qteRecue: reception.saisies[l.id] }));
    if (await actionCircuit(reception.doc, 'receptionner', { receptions })) setReception(null);
  };
  const [articlesLignes, setArticlesLignes] = useState({});
  const articleDeLigne = (l) => articlesLignes[String(l.prestataireArticlesId)]
    || articles.find((a) => String(a.id) === String(l.prestataireArticlesId));

  const transfererCubix = (d) => {
    const piece = d.piece || {};
    const commande = piece.codePieceType === '.COMMANDE_FOURNISSEUR';
    setConfirmModal({
      show: true,
      title: t('Transférer à Cubix'),
      type: 'info',
      confirmText: t('Transférer'),
      message: commande
        ? t('Créer la commande fournisseur {num} dans Cubix ? Le stock du dépôt sera crédité.', { num: piece.numPiece || `#${d.pieceId}` })
        : t('Créer le bon de fourniture de la demande {num} dans Cubix ? Les articles sortiront du dépôt source et entreront dans le dépôt destinataire.', { num: piece.numPiece || `#${d.pieceId}` }),
      onConfirm: async () => {
        closeConfirmModal();
        setTransfertId(d.id);
        setMessageCubix(null);
        const u = authService.getCurrentUser() || {};
        const r = await bonMaintenanceDocumentAchatService.transfererCubix(d.pieceId, {
          id: u.personnelId ?? u.userId ?? null, nom: u.userNom || u.login || null,
        });
        setTransfertId(null);
        setMessageCubix({ ok: r?.succes === true, texte: r?.message || t('Cubix est injoignable pour le moment.') });
        if (r?.succes) await load();
      },
    });
  };

  const imprimerDocument = async (d) => {
    const piece = d.piece || {};
    setImpressionId(d.id);
    try {
      const commande = piece.codePieceType === '.COMMANDE_FOURNISSEUR';
      const [entete, depotCubix, depotDest, cible, artsLignes] = await Promise.all([
        enteteImpression(),
        piece.depotId ? depotCubixService.getById(piece.depotId).catch(() => null) : Promise.resolve(null),
        !commande && piece.depotDestinationId
          ? depotCubixService.getById(piece.depotDestinationId).catch(() => null) : Promise.resolve(null),
        piece.cibleId ? prestataireService.getById(piece.cibleId).catch(() => null) : Promise.resolve(null),
        prestataireArticleService.getParIds((d.lignes ?? []).map((l) => l.prestataireArticlesId)).catch(() => ({})),
      ]);
      const depotNom = depotCubix?.nom || depotCubix?.codeDepots || bon?.depotNom || bon?.depot?.codeDepots;
      const user = authService.getCurrentUser() || {};
      const titre = TYPES_PIECE[piece.codePieceType] || piece.description || t("Pièce");
      imprimerPiece({
        type: commande ? 'COMMANDE' : 'DEMANDE',
        entete,
        titre,
        numero: piece.numPiece || piece.num || `#${d.pieceId}`,
        date: piece.date || piece.dateCreation,
        dateLivraison: piece.dateLivraison,
        saisiePar: piece.personnelCreationNom || user.userNom || user.login || '',
        cubixNumPiece: piece.cubixNumPiece,
        objet: piece.description && piece.description !== titre ? piece.description : null,
        note: piece.note || piece.commentaire,
        devise: piece.devise,
        reference: {
          bonNum: bon?.num ? String(bon.num) : (bon?.id ? `#${bon.id}` : null),
          bonTitre: bon?.titre,
          demandeur: bon?.personnelDemandantNom,
        },
        depot: depotNom ? { nom: depotNom } : null,
        depotDestination: depotDest ? { nom: depotDest.nom || depotDest.codeDepots } : null,
        cible: cible ? { nom: cible.raisonSociale || `${cible.nom || ''} ${cible.prenom || ''}`.trim(), telephone: cible.telephone } : null,
        service: bon?.serviceNom || bon?.service?.description || null,
        totaux: { tht: piece.tht, tremise: piece.tRemise, ttva: piece.ttva, timbre: piece.timbre, ttc: piece.ttc },
        lignes: (d.lignes ?? []).map((l) => {
          const art = artsLignes[String(l.prestataireArticlesId)] || articleDeLigne(l);
          return {
            code: art?.code,
            designation: art?.designation || t('Article #{id}', { id: l.prestataireArticlesId }),
            unite: l.unite || art?.uniteStock,
            qte: l.qte,
            qteEmballage: l.qteColisee,
            prixUnitaire: l.prixUnitaire,
            remise: l.remise,
            tva: l.tva,
            montantHT: l.netHT ?? l.montantHT,
            gratuit: l.estGratuit === true,
          };
        }),
      });
    } catch (err) {
      console.error(err);
      alert(t("L'impression n'a pas pu être préparée."));
    } finally {
      setImpressionId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonMaintenanceId);
      setDocuments(data ?? []);
      const ids = (data ?? []).flatMap((doc) => (doc.lignes ?? []).map((l) => l.prestataireArticlesId));
      prestataireArticleService.getParIds(ids)
        .then((m) => setArticlesLignes((prev) => ({ ...prev, ...m })))
        .catch(console.error);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bonMaintenanceId]);

  useEffect(() => {
    pieceService.getAll(0, 200).then((p) => setPiecesDisponibles(p.content ?? [])).catch(console.error);
    articleService.getAll(0, 300).then((p) => setArticles(p.content ?? [])).catch(console.error);
    obtenirPrestataires().then(setPrestataires).catch(console.error);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!pieceId) return;
    setSaving(true);
    try {
      await bonMaintenanceDocumentAchatService.create({ bonMaintenanceId, pieceId: Number(pieceId) });
      setPieceId('');
      setShowForm(false);
      await load();
    } catch (err) {
      console.error(err);
      alert(t("Échec de l'ajout du document."));
    } finally {
      setSaving(false);
    }
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, show: false }));

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t("Retirer le document"),
      message: t("Retirer ce document ? Cette action est irréversible."),
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await bonMaintenanceDocumentAchatService.remove(id);
          setDocuments((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error(err);
          alert(t("Échec de la suppression."));
        }
      },
    });
  };

  return (
    <div>
      <div className="bmd-panel-header">
        <div className="bmd-panel-title">
          <h3>{t("Documents d'achat")}</h3>
          <span className="bmd-panel-count">{documents.length}</span>
        </div>
      </div>

      {messageCubix && (
        <p className={`bmd-cubix-message ${messageCubix.ok ? 'is-ok' : 'is-erreur'}`} role="status">
          {messageCubix.ok ? <CloudCheck size={15} /> : <AlertTriangle size={15} />}
          <span>{messageCubix.texte}</span>
          <button type="button" onClick={() => setMessageCubix(null)} aria-label={t('Fermer')}><X size={13} /></button>
        </p>
      )}

      {showForm && (
        <form className="bmd-inline-form" onSubmit={handleAdd}>
          <SearchableSelect
            name="pieceId"
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            options={piecesDisponibles}
            placeholder={t("Rechercher une pièce (MEDSYS)...")}
            emptyMessage={t("Aucune pièce ne correspond")}
            getValue={(p) => p.id}
            getLabel={(p) => `${p.numPiece || `#${p.id}`}${p.description ? ` — ${p.description}` : ''}`}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? t("Ajout...") : t("Ajouter")}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t("Chargement...")}</p>
      ) : loadError ? (
        <p className="bmd-empty" style={{ color: '#c0392b' }}>
          {t("Impossible de charger les documents d'achat :")} {loadError}
        </p>
      ) : documents.length === 0 ? (
        <p className="bmd-empty">
          <Inbox size={24} className="empty-icon" /> {t("Aucun document d'achat pour l'instant.")}
        </p>
      ) : (
        <ul className="bmd-list">
          {documents.map((d) => (
            <li key={d.id} className="bmd-list-item">
              <div>
                <span className="bmd-item-title">
                  {d.piece?.codePieceType === '.COMMANDE_FOURNISSEUR' ? t("Commande fournisseur")
                    : d.piece?.codePieceType === '.D_Fourniture' ? t("Demande de fourniture")
                    : (d.piece?.numPiece || t('Pièce #{id}', { id: d.pieceId }))}
                </span>
                <span className="bmd-item-sub">
                  {(d.lignes ?? []).map((l) => {
                    const article = articleDeLigne(l);
                    return `${article?.designation || t('Article #{id}', { id: l.prestataireArticlesId })} (${t('Qté')} ${l.qte})`;
                  }).join(', ')}
                  {d.piece?.cibleId != null
                    ? ` · ${prestataires.find((p) => String(p.id) === String(d.piece.cibleId))?.raisonSociale || t('Sous-traitant #{id}', { id: d.piece.cibleId })}`
                    : ''}
                  {d.piece?.description ? ` · ${d.piece.description}` : ''}
                </span>
                {d.piece?.cubixNumPiece && (
                  <span className="bmd-cubix-badge" title={d.piece.dateTransfertCubix ? new Date(d.piece.dateTransfertCubix).toLocaleString() : undefined}>
                    <CloudCheck size={13} /> {t('Cubix')} : {d.piece.cubixNumPiece}
                  </span>
                )}
                {['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && <CircuitAchat piece={d.piece} />}
              </div>
              <div className="bmd-doc-actions">
                {['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && (() => {
                  const s = statutAchat(d.piece);
                  const occupe = actionId === d.id;
                  const num = d.piece?.numPiece || `#${d.pieceId}`;
                  const bouton = (cle, Icone, texte, onClick, classe = '') => (
                    <button key={cle} type="button" className={`bmd-doc-imprimer bmd-doc-etape ${classe}`} onClick={onClick} disabled={occupe}>
                      {occupe ? <Loader2 size={14} className="spinner" /> : <Icone size={14} />}
                      <span>{texte}</span>
                    </button>
                  );
                  if (s === 'BROUILLON') return bouton('s', Send, t('Soumettre à validation'),
                    () => confirmerEtape(d, 'soumettre', t('Soumettre à validation'), t('Envoyer {num} au responsable pour validation ?', { num }), t('Soumettre')));
                  if (s === 'EN_ATTENTE_VALIDATION') return [
                    bouton('v', Check, t('Valider'), () => confirmerEtape(d, 'valider', t('Valider'), t('Valider {num} ? Elle pourra ensuite être transférée à Cubix.', { num }), t('Valider')), 'is-ok'),
                    bouton('r', X, t('Refuser'), () => setRefus({ doc: d, motif: '' }), 'is-refus'),
                  ];
                  if (s === 'COMMANDE' || s === 'PARTIELLEMENT_RECEPTIONNE') return bouton('rc', PackageSearch, t('Réceptionner'), () => ouvrirReception(d));
                  if (s === 'RECEPTIONNE') return bouton('c', FileCheck, t('Clôturer'),
                    () => confirmerEtape(d, 'cloturer', t('Clôturer'), t('Clôturer {num} ? Documents et mouvements de stock sont rapprochés.', { num }), t('Clôturer')));
                  return null;
                })()}
                {!d.piece?.cubixNumPiece && statutAchat(d.piece) === 'VALIDE' && ['.D_Fourniture', '.COMMANDE_FOURNISSEUR'].includes(d.piece?.codePieceType) && (
                  <button type="button" className="bmd-doc-imprimer bmd-doc-cubix" onClick={() => transfererCubix(d)} disabled={transfertId === d.id}
                    title={t('Transférer à Cubix')} aria-label={t('Transférer à Cubix')}>
                    {transfertId === d.id ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
                    <span>{t('Transférer à Cubix')}</span>
                  </button>
                )}
                <button type="button" className="bmd-doc-imprimer" onClick={() => imprimerDocument(d)} disabled={impressionId === d.id}
                  title={t("Imprimer ce document")} aria-label={t("Imprimer ce document")}>
                  {impressionId === d.id ? <Loader2 size={14} className="spinner" /> : <Printer size={14} />}
                  <span>{t("Imprimer")}</span>
                </button>
                <button className="bmd-delete-btn" onClick={() => handleDelete(d.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modale ouvert={!!refus} onFermer={() => setRefus(null)} icone={X} taille="sm" titre={t('Refuser')}
        sousTitre={refus?.doc?.piece?.numPiece}
        pied={<>
          <button type="button" className="cm-btn" onClick={() => setRefus(null)}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--danger" disabled={!refus?.motif?.trim() || actionId != null}
            onClick={async () => { if (await actionCircuit(refus.doc, 'refuser', { commentaire: refus.motif })) setRefus(null); }}>
            {t('Refuser')}
          </button>
        </>}>
        <label className="bmd-achat-champ">
          <span>{t('Motif')} *</span>
          <textarea rows={3} value={refus?.motif || ''} onChange={(e) => setRefus((r) => ({ ...r, motif: e.target.value }))} />
        </label>
      </Modale>

      <Modale ouvert={!!reception} onFermer={() => setReception(null)} icone={PackageSearch} taille="md" titre={t('Réceptionner')}
        sousTitre={reception?.doc?.piece?.numPiece}
        pied={<>
          <button type="button" className="cm-btn" onClick={() => setReception(null)}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" disabled={reception?.chargement || actionId != null} onClick={validerReception}>
            {t('Enregistrer')}
          </button>
        </>}>
        {reception?.chargement ? (
          <p className="bmd-empty"><Loader2 size={20} className="spinner" /></p>
        ) : (
          <table className="bmd-achat-reception">
            <thead><tr><th>{t('Article')}</th><th>{t('Commandé')}</th><th>{t('Reçu')}</th></tr></thead>
            <tbody>
              {(reception?.lignes ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{articles.find((a) => String(a.id) === String(l.prestataireArticlesId))?.designation || l.designation}</td>
                  <td>{l.qte}{l.unite ? ` ${l.unite}` : ''}</td>
                  <td>
                    <input type="number" min="0" max={l.qte} step="any" value={reception.saisies[l.id] ?? ''}
                      onChange={(e) => setReception((r) => ({ ...r, saisies: { ...r.saisies, [l.id]: e.target.value } }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modale>

      <ConfirmModal
        show={confirmModal.show}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type || 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || t("Retirer")}
      />
    </div>
  );
}
