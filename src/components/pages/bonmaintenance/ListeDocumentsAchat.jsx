import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, CloudCheck, Loader2, PackageSearch, ShoppingCart } from 'lucide-react';
import { Modale } from '../../commun';
import bonMaintenanceDocumentAchatService from '../../../services/Bonmaintenancedocumentachatservice';
import prestataireArticleService from '../../../services/prestataireArticleService';
import authService from '../../../services/Authservice';
import { t, tp } from '../../../i18n';
import './ListeDocumentsAchat.css';

const CODES = { DEMANDE: '.D_Fourniture', COMMANDE: '.COMMANDE_FOURNISSEUR' };
const LIBELLES = {
  BROUILLON: 'Brouillon', EN_ATTENTE_VALIDATION: 'En attente de validation', VALIDE: 'Validé',
  COMMANDE: 'Commandé', PARTIELLEMENT_RECEPTIONNE: 'Partiellement réceptionné', RECEPTIONNE: 'Réceptionné', CLOTURE: 'Clôturé',
};
const statutDe = (p) => p?.statutAchat || (p?.cubixPieceId != null ? 'COMMANDE' : 'BROUILLON');
const libelleStatut = (s, demande) => t(s === 'COMMANDE' && demande ? 'Transmis' : (LIBELLES[s] || s));
const acceptable = (p) => !p?.cubixNumPiece && ['BROUILLON', 'EN_ATTENTE_VALIDATION', 'VALIDE'].includes(statutDe(p));
const dateCourte = (d) => (d ? new Date(d).toLocaleDateString() : '—');

/**
 * Liste des demandes de fourniture (type DEMANDE) ou des commandes fournisseur (type COMMANDE) d'un bon.
 * « Accepter » valide la pièce puis l'envoie à Cubix (bon de fourniture / commande fournisseur).
 */
export default function ListeDocumentsAchat({ ouvert, type, bonMaintenance, onFermer, onChange, enfants }) {
  const demande = type === 'DEMANDE';
  const [documents, setDocuments] = useState([]);
  const [articles, setArticles] = useState({});
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(null);
  const [message, setMessage] = useState(null);

  const charger = useCallback(async () => {
    if (!bonMaintenance?.id) return;
    setChargement(true);
    try {
      const tous = await bonMaintenanceDocumentAchatService.findByBonMaintenanceId(bonMaintenance.id);
      const liste = (tous ?? []).filter((d) => d.piece?.codePieceType === CODES[type]);
      setDocuments(liste);
      const ids = liste.flatMap((d) => (d.lignes ?? []).map((l) => l.prestataireArticlesId));
      prestataireArticleService.getParIds(ids).then(setArticles).catch(() => {});
    } catch {
      setMessage({ ok: false, texte: t('Impossible de charger les documents d’achat.') });
    } finally {
      setChargement(false);
    }
  }, [bonMaintenance?.id, type]);

  useEffect(() => { if (ouvert) { setMessage(null); charger(); } }, [ouvert, charger]);

  const accepter = async (d) => {
    setOccupe(d.id);
    setMessage(null);
    const u = authService.getCurrentUser() || {};
    const r = await bonMaintenanceDocumentAchatService.accepter(d.pieceId, {
      id: u.personnelId ?? u.userId ?? null, nom: u.userNom || u.login || null,
    });
    setOccupe(null);
    setMessage({ ok: r?.succes === true, texte: r?.message || t('Cubix est injoignable pour le moment.') });
    await charger();
    onChange?.();
  };

  const nomLigne = (l) => articles[String(l.prestataireArticlesId)]?.designation || l.nomTech
    || t('Article #{id}', { id: l.prestataireArticlesId });

  return (
    <Modale ouvert={ouvert} onFermer={() => { if (!occupe) onFermer(); }} icone={demande ? PackageSearch : ShoppingCart} taille="xl"
      titre={demande
        ? t('Demandes — {bon}', { bon: bonMaintenance?.num || bonMaintenance?.titre || `#${bonMaintenance?.id}` })
        : t('Commandes — {bon}', { bon: bonMaintenance?.num || bonMaintenance?.titre || `#${bonMaintenance?.id}` })}>
      {message && (
        <p className={`lda-message ${message.ok ? 'is-ok' : 'is-erreur'}`}>
          {message.ok ? <CloudCheck size={16} /> : <AlertTriangle size={16} />} {message.texte}
        </p>
      )}
      {chargement && documents.length === 0 ? (
        <p className="lda-vide"><Loader2 size={20} className="lda-tourne" /> {t('Chargement…')}</p>
      ) : documents.length === 0 ? (
        <p className="lda-vide">{demande ? t('Aucune demande de fourniture pour ce bon.') : t('Aucune commande fournisseur pour ce bon.')}</p>
      ) : (
        <div className="lda-table-wrap">
          <table className="lda-table">
            <thead>
              <tr>
                <th>{t('N°')}</th>
                <th>{t('Date')}</th>
                <th>{t('Articles')}</th>
                <th>{t('État')}</th>
                <th aria-label={t('Actions')} />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const s = statutDe(d.piece);
                return (
                  <tr key={d.id}>
                    <td className="lda-num">{d.piece?.numPiece || `#${d.pieceId}`}</td>
                    <td>{dateCourte(d.piece?.date || d.piece?.dateCreation)}</td>
                    <td>
                      <ul className="lda-lignes">
                        {(d.lignes ?? []).map((l) => (
                          <li key={l.id}><span>{nomLigne(l)}</span> <strong>× {l.qte ?? '—'}</strong></li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <span className={`lda-statut lda-statut--${s.toLowerCase()}`}>{libelleStatut(s, demande)}</span>
                      {d.piece?.cubixNumPiece && <span className="lda-cubix"><CloudCheck size={12} /> {d.piece.cubixNumPiece}</span>}
                    </td>
                    <td className="lda-actions">
                      {acceptable(d.piece) && (
                        <button type="button" className="cm-btn cm-btn--principal" onClick={() => accepter(d)} disabled={occupe != null}>
                          {occupe === d.id ? <Loader2 size={15} className="lda-tourne" /> : <Check size={15} />} {t('Accepter')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="lda-compte">{tp(demande ? 'demande' : 'commande', documents.length)}</p>
        </div>
      )}
      {enfants}
    </Modale>
  );
}
