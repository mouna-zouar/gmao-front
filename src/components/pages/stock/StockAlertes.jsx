import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, Loader2, RefreshCw, ShoppingCart, SlidersHorizontal, X,
} from 'lucide-react';
import stockAlerteService from '../../../services/stockAlerteService';
import { commePage, lireRequete, obtenirPersonnelsMaintenance, obtenirPrestataires } from '../../../store/referentiels';
import { useAppDispatch } from '../../../store/hooks';
import { chargerDepots } from '../../../store/depotsSlice';
import PieceEditor from '../../ui/PieceEditor/PieceEditor';
import SearchableSelect from '../../commun/ListeRecherche';
import { Badge, Modale, PageListe } from '../../commun';
import { t, locale } from '../../../i18n';
import './StockAlertes.css';
import PrevisionStock from '../../commun/decision/PrevisionStock';

const NIVEAUX = {
  RUPTURE: { label: 'Rupture', ton: 'rouge' },
  SOUS_SEUIL: { label: 'Sous le seuil', ton: 'ambre' },
  APPROCHE: { label: 'Proche du seuil', ton: 'bleu' },
};
const STATUTS_COMMANDE = {
  BROUILLON: 'gris', EN_ATTENTE_VALIDATION: 'ambre', VALIDE: 'bleu', COMMANDE: 'teal',
  PARTIELLEMENT_RECEPTIONNE: 'orange', RECEPTIONNE: 'vert', CLOTURE: 'vert',
};

const nombre = (v) => Number(v || 0).toLocaleString(locale(), { maximumFractionDigits: 3 });
const montant = (v) => Number(v || 0).toLocaleString(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const date = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const qteACommander = (a, approchePct = 0) => (a.quantiteProposee > 0 ? a.quantiteProposee
  : Math.max(1, Math.ceil(a.seuil * (1 + approchePct / 100) - a.disponible)));

export default function StockAlertes() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState('');
  const [selection, setSelection] = useState(null);
  const [editeur, setEditeur] = useState(null);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [fournisseurs, setFournisseurs] = useState({});
  const [depots, setDepots] = useState({});
  const dispatch = useAppDispatch();

  const charger = useCallback(async (forcer = false) => {
    setChargement(true);
    setErreur(null);
    try {
      setDonnees(await lireRequete('alertesStock', {}, { forcer }));
    } catch {
      setErreur(t('Impossible de charger les alertes de stock.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    obtenirPrestataires()
      .then((liste) => setFournisseurs(Object.fromEntries((liste || []).map((p) => [String(p.id), p.nom || p.raisonSociale || `#${p.id}`]))))
      .catch(() => {});
    dispatch(chargerDepots()).unwrap()
      .then((liste) => setDepots(Object.fromEntries((liste || []).map((d) => [String(d.id), d.nom || d.codeDepots || `#${d.id}`]))))
      .catch(() => {});
  }, [dispatch]);
  useEffect(() => { setSelection(null); }, [vue]);

  const approchePct = donnees?.approchePct ?? 0;
  const alertes = useMemo(() => (donnees?.alertes ?? []).map((a) => ({ ...a, id: `${a.prestataireArticlesId}@${a.depotId ?? ''}` })), [donnees]);
  const commandes = useMemo(() => (donnees?.commandes ?? []).map((c) => ({ ...c, id: c.pieceId })), [donnees]);
  const compte = (n) => alertes.filter((a) => a.niveau === n).length;
  const vueCommandes = vue === 'COMMANDES';
  const lignes = vueCommandes ? commandes : (vue ? alertes.filter((a) => a.niveau === vue) : alertes);
  const aCommander = lignes.filter((a) => !vueCommandes && a.quantiteProposee > 0);

  const nomDepot = (id) => (id != null ? (depots[String(id)] || `#${id}`) : '');
  const ouvrirCommande = (liste) => {
    const ls = liste.map((a) => ({
      prestataireArticlesId: a.prestataireArticlesId, designation: a.designation, qte: qteACommander(a, approchePct),
      prixAchat: a.prixAchat, tva: a.tva, unite: a.unite, depotId: a.depotId,
    }));
    if (ls.length) setEditeur(ls);
  };

  const colonnesAlertes = [
    { cle: 'designation', label: 'Article', valeur: (a) => a.designation || `#${a.prestataireArticlesId}`, rendu: (a) => <strong dir="auto">{a.designation || `#${a.prestataireArticlesId}`}</strong> },
    { cle: 'code', label: 'Code', valeur: (a) => a.code || '' },
    { cle: 'depot', label: 'Dépôt', filtre: 'liste', valeur: (a) => nomDepot(a.depotId) },
    {
      cle: 'niveau', label: 'Niveau', filtre: 'liste', valeur: (a) => t(NIVEAUX[a.niveau]?.label || a.niveau),
      rendu: (a) => <Badge ton={NIVEAUX[a.niveau]?.ton || 'gris'}>{t(NIVEAUX[a.niveau]?.label || a.niveau)}</Badge>,
    },
    {
      cle: 'disponible', label: 'Disponible', alignement: 'droite', valeur: (a) => a.disponible,
      texte: (a) => `${nombre(a.disponible)} ${a.unite || ''}`.trim(), rendu: (a) => `${nombre(a.disponible)} ${a.unite || ''}`.trim(),
    },
    { cle: 'seuil', label: 'Seuil', alignement: 'droite', valeur: (a) => a.seuil, texte: (a) => nombre(a.seuil), rendu: (a) => nombre(a.seuil) },
    { cle: 'enCommande', label: 'En commande', alignement: 'droite', valeur: (a) => a.enCommande, texte: (a) => (a.enCommande > 0 ? nombre(a.enCommande) : ''), rendu: (a) => (a.enCommande > 0 ? nombre(a.enCommande) : '—') },
    {
      cle: 'proposee', label: 'À commander', alignement: 'droite', valeur: (a) => a.quantiteProposee,
      texte: (a) => (a.quantiteProposee > 0 ? nombre(a.quantiteProposee) : ''),
      rendu: (a) => (a.quantiteProposee > 0 ? <strong>{nombre(a.quantiteProposee)}</strong> : a.enCommande > 0 ? t('Déjà commandé') : '—'),
    },
  ];
  const colonnesCommandes = [
    { cle: 'numPiece', label: 'Numéro', valeur: (c) => c.numPiece || `#${c.pieceId}`, rendu: (c) => <strong>{c.numPiece || `#${c.pieceId}`}</strong> },
    { cle: 'date', label: 'Date', valeur: (c) => c.date || '', texte: (c) => date(c.date), rendu: (c) => date(c.date) },
    { cle: 'fournisseur', label: 'Fournisseur', filtre: 'liste', valeur: (c) => fournisseurs[String(c.fournisseurId)] || (c.fournisseurId ? `#${c.fournisseurId}` : '') },
    { cle: 'nbLignes', label: 'Articles', alignement: 'droite', valeur: (c) => c.nbLignes },
    { cle: 'ttc', label: 'TTC', alignement: 'droite', valeur: (c) => c.ttc, texte: (c) => `${montant(c.ttc)} DT`, rendu: (c) => `${montant(c.ttc)} DT` },
    {
      cle: 'statut', label: 'Statut', filtre: 'liste', valeur: (c) => t(c.statutLibelle || c.statut || ''),
      rendu: (c) => <Badge ton={STATUTS_COMMANDE[c.statut] || 'gris'}>{t(c.statutLibelle || c.statut)}</Badge>,
    },
  ];

  const videAucun = vueCommandes ? t('Aucune commande de réapprovisionnement.')
    : donnees && !donnees.cubixJoignable ? t('Cubix ne répond pas : les seuils ne peuvent pas être lus.')
      : donnees && (donnees.articlesAvecSeuil ?? 0) === 0
        ? t('Aucun article n’a de seuil dans Cubix ({n} articles de maintenance lus). Renseignez le seuil des articles dans Cubix.', { n: donnees.articlesLus ?? 0 })
        : t('Aucun article sous son seuil ni proche du seuil.');

  return (
    <PageListe
      key={vueCommandes ? 'commandes' : 'alertes'}
      titre={t('Alertes de stock')}
      sansEntete
      filtres={(
        <select value={vue} onChange={(e) => setVue(e.target.value)} aria-label={t('Vue')}>
          <option value="">{`${t('Alertes')} (${alertes.length})`}</option>
          <option value="RUPTURE">{`${t('Rupture')} (${compte('RUPTURE')})`}</option>
          <option value="SOUS_SEUIL">{`${t('Sous le seuil')} (${compte('SOUS_SEUIL')})`}</option>
          <option value="APPROCHE">{`${t('Proche du seuil')} (${compte('APPROCHE')})`}</option>
          <option value="COMMANDES">{`${t('Commandes')} (${commandes.length})`}</option>
        </select>
      )}
      colonnes={vueCommandes ? colonnesCommandes : colonnesAlertes}
      lignes={lignes}
      chargement={chargement && !donnees}
      erreur={erreur}
      selection={selection}
      onSelection={setSelection}
      actions={[
        ...(vueCommandes ? [] : [
          { label: t('Commander'), icone: ShoppingCart, classe: 'cl-action--teal', besoinSelection: true, onClick: (a) => ouvrirCommande([a]) },
          {
            label: aCommander.length ? t('Tout commander ({n})', { n: aCommander.length }) : t('Tout commander'),
            icone: ShoppingCart, classe: 'cl-action--bleu', desactive: aCommander.length === 0, onClick: () => ouvrirCommande(aCommander),
          },
        ]),
        { label: t('Réglages'), icone: SlidersHorizontal, classe: 'cl-action--gris', onClick: () => setReglagesOuverts(true) },
        { label: t('Actualiser'), icone: RefreshCw, classe: 'cl-action--gris', desactive: chargement, onClick: () => charger(true) },
      ]}
      avantTableau={vueCommandes ? null : <PrevisionStock onCommander={(ls) => setEditeur(ls)} />}
      recherchePlaceholder={vueCommandes ? t('Rechercher une commande...') : t('Article, code ou dépôt')}
      cleStockage={vueCommandes ? 'stock-commandes' : 'stock-alertes'}
      nomExport={vueCommandes ? 'commandes-reapprovisionnement' : 'alertes-stock'}
      vide={{ aucun: videAucun, aucunFiltre: t('Aucun élément ne correspond à ces filtres.') }}
    >
      <PieceEditor
        ouvert={editeur != null}
        type="COMMANDE"
        bonMaintenance={null}
        lignesInitiales={editeur || []}
        onFermer={() => setEditeur(null)}
        onCree={() => { setSelection(null); charger(true); }}
      />
      {reglagesOuverts && <FenetreReglages onClose={() => setReglagesOuverts(false)} onEnregistre={() => charger(true)} />}
    </PageListe>
  );
}

const nomCourt = (p) => `${p.nom || ''} ${p.prenom || ''}`.trim() || `#${p.id}`;
const nomPersonnel = (p) => nomCourt(p) + (p.matricule ? ` (${p.matricule})` : '');

function FenetreReglages({ onClose, onEnregistre }) {
  const [r, setR] = useState(null);
  const [personnels, setPersonnels] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    Promise.all([
      lireRequete('reglagesStock').catch(() => null),
      obtenirPersonnelsMaintenance().then(commePage).then((p) => p?.content ?? []).catch(() => []),
    ]).then(([reglages, liste]) => {
      if (annule) return;
      setR(reglages || { actif: true, destinataires: [], approchePct: 20 });
      setPersonnels(liste);
    });
    return () => { annule = true; };
  }, []);

  const ajouter = (id) => {
    const p = personnels.find((x) => String(x.id) === String(id));
    if (p && !r.destinataires.some((m) => String(m.id) === String(p.id))) {
      setR((x) => ({ ...x, destinataires: [...x.destinataires, { id: Number(p.id), nom: nomCourt(p) }] }));
    }
  };

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await stockAlerteService.enregistrerReglages({
        actif: !!r.actif, destinataires: r.destinataires, approchePct: Math.max(0, Math.round(Number(r.approchePct) || 0)),
      });
      onEnregistre?.();
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
      icone={SlidersHorizontal}
      surtitre={t('Alertes de stock')}
      titre={t('Réglages')}
      taille="md"
      infoPied={erreur ? <span className="stk-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onClose}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={enregistrer} disabled={!r || envoi}>
            {envoi ? <Loader2 size={16} className="stk-tourne" /> : <Bell size={16} />} {t('Enregistrer')}
          </button>
        </>
      )}
    >
      {!r ? (
        <p className="stk-vide"><Loader2 size={15} className="stk-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="cf-grille">
          <div className="cf-champ cf-champ--pleine">
            <label htmlFor="stk-approche" className="cf-label">{t('Approche du seuil (%)')}</label>
            <input id="stk-approche" type="number" min="0" max="200" step="1" className="stk-champ-nombre"
              value={r.approchePct ?? 0} onChange={(e) => setR((x) => ({ ...x, approchePct: e.target.value }))} />
          </div>
          <label className="stk-case cf-champ--pleine">
            <input type="checkbox" checked={!!r.actif} onChange={(e) => setR((x) => ({ ...x, actif: e.target.checked }))} />
            {t('Notifications actives')}
          </label>
          <div className="cf-champ cf-champ--pleine">
            <label htmlFor="stk-destinataires" className="cf-label">{t('Personnes prévenues')}</label>
            <SearchableSelect
              id="stk-destinataires"
              name="destinataires"
              value=""
              onChange={(e) => ajouter(e.target.value)}
              options={personnels.filter((p) => !r.destinataires.some((m) => String(m.id) === String(p.id)))}
              placeholder={t('Tout le monde')}
              emptyMessage={t('Aucun personnel ne correspond')}
              getValue={(p) => p.id}
              getLabel={nomPersonnel}
            />
            {r.destinataires.length > 0 && (
              <ul className="stk-membres">
                {r.destinataires.map((m) => (
                  <li key={m.id}>
                    {m.nom}
                    <button type="button" onClick={() => setR((x) => ({ ...x, destinataires: x.destinataires.filter((d) => d.id !== m.id) }))} aria-label={t('Retirer {nom}', { nom: m.nom })}><X size={12} /></button>
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
