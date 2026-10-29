import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, Loader2, Package, Plus, Search, ShoppingCart, Shuffle, X } from 'lucide-react';
import { Modale } from '../../commun';
import api from '../../../services/api';
import authService from '../../../services/Authservice';
import bonMaintenanceCommandeService from '../../../services/bonMaintenanceCommandeService';
import { obtenirArticles, obtenirPrestataires } from '../../../store/referentiels';
import { useAppDispatch } from '../../../store/hooks';
import { chargerDepots } from '../../../store/depotsSlice';
import pieceLigneService from '../../../services/pieceLigneService';
import { t, locale } from '../../../i18n';
import './PieceEditor.css';

/*
 * Éditeur de pièce d'un bon de maintenance, sur le modèle du PieceEditor de Cubix :
 *   entête (type, numéro de souche, date, dépôt, fournisseur, note),
 *   recherche d'articles, lignes (Disponible, Qté, Unité, PU, Remise, TVA, Montant, ✕), totaux,
 *   puis création d'UNE pièce avec toutes ses lignes, rattachée au bon (POST /api/piece-editor).
 *
 * type : 'DEMANDE' (demande de fourniture, .D_Fourniture) ou 'COMMANDE' (commande fournisseur).
 * Les lignes sont pré-remplies avec ce qui reste à demander / à commander pour le bon.
 */

const TYPES = {
  DEMANDE: { titre: 'Demande de fourniture', icone: Package, aide: 'Pièces à sortir du magasin pour ce bon' },
  COMMANDE: { titre: 'Commande fournisseur', icone: ShoppingCart, aide: 'Pièces à acheter chez un fournisseur pour ce bon' },
};
const CLE_DEPOT = 'gmao.pieceEditor.depot';

const nombre = (v, d = 3) => Number(v || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const nz = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
const aujourdhui = () => new Date().toISOString().slice(0, 10);
let compteurLigne = 0;
const nouvelleCle = () => `l${++compteurLigne}`;

/** Ligne de pièce à partir d'un article Cubix (comme NewPieceLigne). */
function ligneDepuisArticle(type, article, extra = {}) {
  return {
    cle: nouvelleCle(),
    prestataireArticlesId: article.id ?? article.prestataireArticlesId,
    designation: article.designation || t('Article #{id}', { id: article.id ?? article.prestataireArticlesId }),
    code: article.code || '',
    disponible: article.qteDisponible ?? null,
    qte: 1,
    unite: article.uniteStock || '',
    prixUnitaire: article.prixAchat ?? 0,
    remise: 0,
    tva: type === 'COMMANDE' ? (article.tva ?? 0) : 0,
    bonMaintenanceTacheId: null,
    sousTraitantId: null,
    besoin: false,
    ...extra,
  };
}

const montantLigne = (l) => {
  const net = nz(l.prixUnitaire) * (1 - nz(l.remise) / 100) * nz(l.qte);
  return { brut: nz(l.prixUnitaire) * nz(l.qte), net, tva: net * nz(l.tva) / 100 };
};

export default function PieceEditor({ ouvert, type = 'DEMANDE', bonMaintenance, onFermer, onCree }) {
  const def = TYPES[type] || TYPES.DEMANDE;
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [articles, setArticles] = useState([]);
  const [depots, setDepots] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [besoins, setBesoins] = useState([]);
  const [entete, setEntete] = useState({ date: aujourdhui(), depotId: '', cibleId: '', note: '' });
  const [numero, setNumero] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  // Commande : mode express (une commande par fournisseur) et petite confirmation intégrée
  const [express, setExpress] = useState(null);
  const [dialogue, setDialogue] = useState(null);
  const rechercheRef = useRef(null);
  const dispatch = useAppDispatch();

  // ─── Chargement : articles, dépôts, fournisseurs, besoins du bon ───
  useEffect(() => {
    if (!ouvert || !bonMaintenance?.id) return undefined;
    let annule = false;
    setChargement(true);
    setErreur(null);
    setResultat(null);
    setExpress(null);
    setDialogue(null);
    setRecherche('');
    let depotMemorise = '';
    try { depotMemorise = localStorage.getItem(CLE_DEPOT) || ''; } catch { /* stockage indisponible */ }
    (async () => {
      try {
        const [arts, deps, besoinsBon, presta] = await Promise.all([
          obtenirArticles().catch(() => []),
          dispatch(chargerDepots()).unwrap().catch(() => []),
          (type === 'COMMANDE'
            ? bonMaintenanceCommandeService.getArticlesDisponibles(bonMaintenance.id)
            : bonMaintenanceCommandeService.getArticlesADemander(bonMaintenance.id)).catch(() => []),
          type === 'COMMANDE' ? obtenirPrestataires().catch(() => []) : Promise.resolve([]),
        ]);
        if (annule) return;
        const listeDepots = Array.isArray(deps) ? deps : [];
        setArticles(Array.isArray(arts) ? arts : []);
        setDepots(listeDepots);
        setFournisseurs(Array.isArray(presta) ? presta : []);
        setBesoins(besoinsBon ?? []);
        const depotDefaut = listeDepots.some((d) => String(d.id) === depotMemorise) ? depotMemorise
          : String(listeDepots.find((d) => d.estPrincipal)?.id ?? listeDepots[0]?.id ?? '');
        const cibleDefaut = type === 'COMMANDE' ? String((besoinsBon ?? []).find((b) => b.sousTraitantId)?.sousTraitantId ?? '') : '';
        setEntete({ date: aujourdhui(), depotId: depotDefaut, cibleId: cibleDefaut, note: '' });
      } catch {
        if (!annule) setErreur(t('Impossible de préparer la pièce. Vérifie que le serveur est bien lancé.'));
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [ouvert, bonMaintenance?.id, type, dispatch]);

  const articleParId = useMemo(() => Object.fromEntries(articles.map((a) => [a.id, a])), [articles]);

  // Lignes pré-remplies avec les besoins du bon (pour une commande : ceux du fournisseur choisi)
  useEffect(() => {
    if (chargement) return;
    const retenus = type === 'COMMANDE'
      ? besoins.filter((b) => !entete.cibleId || String(b.sousTraitantId) === String(entete.cibleId))
      : besoins;
    setLignes((avant) => [
      ...retenus.map((b) => ligneDepuisArticle(type, articleParId[b.prestataireArticlesId] || { prestataireArticlesId: b.prestataireArticlesId, designation: b.designation }, {
        qte: b.qteRestante ?? 1,
        bonMaintenanceTacheId: b.bonMaintenanceTacheId ?? null,
        sousTraitantId: b.sousTraitantId ?? null,
        besoin: true,
        tache: b.designation,
      })),
      ...avant.filter((l) => !l.besoin), // les articles ajoutés à la main restent
    ]);
  }, [chargement, besoins, entete.cibleId, type, articleParId]);

  // Stock disponible des lignes qui ne l'ont pas encore
  useEffect(() => {
    const manquants = lignes.filter((l) => l.disponible == null && !l.dispoCharge);
    if (manquants.length === 0) return;
    setLignes((ls) => ls.map((l) => (manquants.some((m) => m.cle === l.cle) ? { ...l, dispoCharge: true } : l)));
    manquants.forEach((m) => {
      pieceLigneService.getQuantiteDisponible(m.prestataireArticlesId)
        .then((q) => setLignes((ls) => ls.map((l) => (l.cle === m.cle ? { ...l, disponible: q } : l))))
        .catch(() => {});
    });
  }, [lignes]);

  // Numéro de souche proposé (comme GetNewNum), recalculé si la date change
  useEffect(() => {
    if (!ouvert || chargement) return undefined;
    let annule = false;
    api.get('/piece-editor/numero', { params: { type, date: entete.date || undefined } })
      .then(({ data }) => { if (!annule) setNumero(data); })
      .catch(() => { if (!annule) setNumero(null); });
    return () => { annule = true; };
  }, [ouvert, chargement, type, entete.date]);

  const changerEntete = (champ, valeur) => {
    setEntete((e) => ({ ...e, [champ]: valeur }));
    if (champ === 'depotId') { try { localStorage.setItem(CLE_DEPOT, valeur); } catch { /* stockage indisponible */ } }
  };
  const changerLigne = (cle, champ, valeur) => setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));
  const retirerLigne = (cle) => setLignes((ls) => ls.filter((l) => l.cle !== cle));

  // Recherche d'articles (comme GetArticlesJson : 10 résultats)
  const suggestions = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 1) return [];
    return articles
      .filter((a) => [a.designation, a.code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .slice(0, 10);
  }, [recherche, articles]);
  const ajouterArticle = useCallback((a) => {
    setLignes((ls) => [...ls, ligneDepuisArticle(type, a)]);
    setRecherche('');
    setSuggestionsOuvertes(false);
    rechercheRef.current?.focus();
  }, [type]);

  const totaux = useMemo(() => lignes.reduce((t0, l) => {
    const m = montantLigne(l);
    return { brut: t0.brut + m.brut, net: t0.net + m.net, tva: t0.tva + m.tva };
  }, { brut: 0, net: 0, tva: 0 }), [lignes]);

  const problemes = [];
  if (lignes.length === 0) problemes.push(t('Ajoutez au moins un article.'));
  if (type === 'COMMANDE' && !entete.cibleId) problemes.push(t('Choisissez le fournisseur.'));
  if (lignes.some((l) => nz(l.qte) <= 0)) problemes.push(t('Chaque quantité doit être supérieure à zéro.'));

  /** Corps de la requête de création (une pièce = un fournisseur + ses lignes). */
  const charge = (lignesPiece, cibleId) => ({
    bonMaintenanceId: bonMaintenance.id,
    type,
    cibleId: cibleId ? Number(cibleId) : null,
    depotId: entete.depotId ? Number(entete.depotId) : null,
    date: entete.date || null,
    note: entete.note || null,
    personnelId: authService.getUserId?.() ?? null,
    personnelNom: authService.getCurrentUser?.()?.userNom ?? null,
    lignes: lignesPiece.map((l) => ({
      prestataireArticlesId: l.prestataireArticlesId,
      designation: l.designation,
      qte: nz(l.qte),
      prixUnitaire: nz(l.prixUnitaire),
      remise: nz(l.remise),
      tva: nz(l.tva),
      unite: l.unite || null,
      bonMaintenanceTacheId: l.bonMaintenanceTacheId,
    })),
  });

  // ─── Commande : calculer la pièce depuis le stock (comme CalculerPiece type 1 « Qté du vecteur ») ───
  // Articles dont le stock est sous le seuil : quantité proposée = seuil − stock disponible.
  const articlesSousSeuil = useMemo(() => articles
    .filter((a) => nz(a.seuil) > 0 && nz(a.qteDisponible) < nz(a.seuil))
    .map((a) => ligneDepuisArticle(type, a, { qte: Math.round((nz(a.seuil) - nz(a.qteDisponible)) * 1000) / 1000 })), [articles, type]);
  const calculerDepuisStock = () => {
    if (articlesSousSeuil.length === 0) {
      setDialogue({ texte: t('Aucun article n’est sous son seuil de stock.'), seulOk: true });
      return;
    }
    const remplacer = () => { setLignes(articlesSousSeuil.map((l) => ({ ...l, cle: nouvelleCle() }))); setDialogue(null); };
    if (lignes.length === 0) remplacer();
    else setDialogue({ texte: t('Remplacer les {n} ligne(s) actuelles par les {m} article(s) sous leur seuil de stock ?', { n: lignes.length, m: articlesSousSeuil.length }), onOk: remplacer });
  };

  // ─── Commande : mode express (comme PieceExpress : une commande par fournisseur) ───
  const nomCible = (id) => {
    if (!id) return null;
    const f = fournisseurs.find((x) => String(x.id) === String(id));
    const b = besoins.find((x) => String(x.sousTraitantId) === String(id));
    return f ? (f.raisonSociale || f.nom || f.nomPrenom) : (b?.sousTraitantNom || t('Prestataire #{id}', { id }));
  };
  const passerExpress = () => {
    // Toutes les lignes à commander pour le bon (tous fournisseurs) + les lignes ajoutées à la main
    const lignesBesoins = besoins.map((b) => ligneDepuisArticle(type, articleParId[b.prestataireArticlesId] || { prestataireArticlesId: b.prestataireArticlesId, designation: b.designation }, {
      qte: b.qteRestante ?? 1, bonMaintenanceTacheId: b.bonMaintenanceTacheId ?? null, sousTraitantId: b.sousTraitantId ?? null, besoin: true,
    }));
    const toutes = [...lignesBesoins, ...lignes.filter((l) => !l.besoin).map((l) => ({ ...l, sousTraitantId: l.sousTraitantId ?? (entete.cibleId || null) }))];
    const groupes = new Map();
    toutes.forEach((l) => {
      const cle = l.sousTraitantId ? String(l.sousTraitantId) : '';
      if (!groupes.has(cle)) groupes.set(cle, { cle: cle || 'aucun', cibleId: cle, lignes: [], statut: 'a_faire' });
      groupes.get(cle).lignes.push(l);
    });
    setExpress([...groupes.values()]);
    setDialogue(null);
  };
  const demanderExpress = () => setDialogue({ texte: t('Voulez-vous passer au mode express ? Une commande sera créée pour chaque fournisseur.'), onOk: passerExpress });
  const changerGroupe = (cle, champs) => setExpress((gs) => gs.map((g) => (g.cle === cle ? { ...g, ...champs } : g)));
  const creerGroupe = async (g) => {
    if (!g.cibleId || g.statut === 'fait' || g.statut === 'envoi') return;
    changerGroupe(g.cle, { statut: 'envoi', erreur: null });
    try {
      const { data } = await api.post('/piece-editor', charge(g.lignes, g.cibleId));
      changerGroupe(g.cle, { statut: 'fait', resultat: data });
      obtenirArticles({ forcer: true }).catch(() => {}); // le stock a pu bouger
      onCree?.(data);
    } catch (e) {
      changerGroupe(g.cle, { statut: 'erreur', erreur: e?.response?.data?.message || t('La pièce n’a pas pu être créée.') });
    }
  };
  const creerTout = async () => {
    for (const g of express || []) {
      if (g.cibleId && g.statut !== 'fait') await creerGroupe(g); // eslint-disable-line no-await-in-loop
    }
  };

  const enregistrer = async () => {
    if (problemes.length > 0 || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const { data } = await api.post('/piece-editor', charge(lignes, entete.cibleId));
      setResultat(data);
      obtenirArticles({ forcer: true }).catch(() => {}); // le stock a pu bouger
      onCree?.(data);
    } catch (e) {
      setErreur(e?.response?.data?.message || t('La pièce n’a pas pu être créée.'));
    } finally {
      setEnvoi(false);
    }
  };

  const Icone = def.icone;
  const nomFournisseur = (f) => f?.raisonSociale || f?.nom || f?.nomPrenom || t('Prestataire #{id}', { id: f?.id });
  const fournisseursProposes = useMemo(() => {
    const ids = new Set(besoins.map((b) => String(b.sousTraitantId)).filter((x) => x && x !== 'null'));
    const prioritaires = fournisseurs.filter((f) => ids.has(String(f.id)));
    const autres = fournisseurs.filter((f) => !ids.has(String(f.id)));
    // Sous-traitants du bon absents de la liste : on les ajoute quand même
    besoins.forEach((b) => {
      if (b.sousTraitantId && !fournisseurs.some((f) => String(f.id) === String(b.sousTraitantId))
        && !prioritaires.some((f) => String(f.id) === String(b.sousTraitantId))) {
        prioritaires.push({ id: b.sousTraitantId, raisonSociale: b.sousTraitantNom || t('Prestataire #{id}', { id: b.sousTraitantId }) });
      }
    });
    return { prioritaires, autres };
  }, [fournisseurs, besoins]);

  return (
    <Modale
      ouvert={ouvert}
      onFermer={() => { if (!envoi) onFermer(); }}
      taille="plein"
      icone={Icone}
      surtitre={t('Bon {num}', { num: bonMaintenance?.num || `#${bonMaintenance?.id}` })}
      titre={t(def.titre)}
      sousTitre={t(def.aide)}
      fermerSurFond={!envoi}
      className="pe-modale"
      pied={resultat ? (
        <button type="button" className="cm-btn cm-btn--principal" onClick={onFermer}>{t('Fermer')}</button>
      ) : express ? (
        <>
          <button type="button" className="cm-btn cm-btn--lien" onClick={() => setExpress(null)} disabled={express.some((g) => g.statut === 'envoi')}>
            <ArrowLeft size={16} /> {t('Retour à la pièce')}
          </button>
          {express.every((g) => g.statut === 'fait') ? (
            <button type="button" className="cm-btn cm-btn--principal" onClick={onFermer}>{t('Fermer')}</button>
          ) : (
            <button type="button" className="cm-btn cm-btn--principal" onClick={creerTout}
              disabled={express.some((g) => g.statut === 'envoi') || !express.some((g) => g.cibleId && g.statut !== 'fait')}>
              <ShoppingCart size={16} /> {t('Créer les commandes')}
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" className="cm-btn cm-btn--lien" onClick={onFermer} disabled={envoi}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={enregistrer} disabled={envoi || chargement || problemes.length > 0}
            title={problemes.join(' ')}>
            {envoi ? <Loader2 size={16} className="pe-tourne" /> : <FileText size={16} />} {t('Enregistrer la pièce')}
          </button>
        </>
      )}
    >
      {chargement ? (
        <div className="pe-chargement"><Loader2 size={20} className="pe-tourne" /> {t('Préparation de la pièce…')}</div>
      ) : express ? (
        <div className="pe">
          <p className="pe-express-intro"><Shuffle size={16} /> {t('Mode express : une commande par fournisseur. Choisissez le fournisseur des articles qui n’en ont pas, puis créez les commandes.')}</p>
          {express.map((g) => {
            const ht = g.lignes.reduce((s0, l) => s0 + montantLigne(l).net, 0);
            const ttc = g.lignes.reduce((s0, l) => { const m = montantLigne(l); return s0 + m.net + m.tva; }, 0);
            return (
              <section key={g.cle} className={`pe-groupe is-${g.statut}`}>
                <header className="pe-groupe__tete">
                  <div className="pe-groupe__titre">
                    {g.cibleId && g.cle !== 'aucun' ? <strong>{nomCible(g.cibleId)}</strong> : (
                      <select value={g.cibleId} onChange={(e) => changerGroupe(g.cle, { cibleId: e.target.value })} className={!g.cibleId ? 'pe-requis' : ''} disabled={g.statut === 'fait'}>
                        <option value="">{t('— Non défini : choisir le fournisseur —')}</option>
                        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{nomFournisseur(f)}</option>)}
                      </select>
                    )}
                    <span>{t('{n} article(s) · HT {ht} DT · TTC {ttc} DT', { n: g.lignes.length, ht: nombre(ht), ttc: nombre(ttc) })}</span>
                  </div>
                  {g.statut === 'fait' ? (
                    <span className="pe-groupe__ok"><CheckCircle2 size={16} /> {g.resultat?.numPiece}</span>
                  ) : (
                    <button type="button" className="cm-btn cm-btn--principal" onClick={() => creerGroupe(g)} disabled={!g.cibleId || g.statut === 'envoi'}>
                      {g.statut === 'envoi' ? <Loader2 size={15} className="pe-tourne" /> : <ShoppingCart size={15} />} {t('Créer la commande')}
                    </button>
                  )}
                </header>
                <ul className="pe-groupe__lignes">
                  {g.lignes.map((l) => (
                    <li key={l.cle}>
                      <span className="pe-groupe__nom">{l.designation}</span>
                      <span>{t('Qté {q}', { q: nombre(l.qte, 0) })}</span>
                      <span>{nombre(montantLigne(l).net)} DT</span>
                    </li>
                  ))}
                </ul>
                {g.erreur && <p className="pe-alerte"><AlertTriangle size={15} /> {g.erreur}</p>}
              </section>
            );
          })}
        </div>
      ) : resultat ? (
        <div className="pe-succes">
          <CheckCircle2 size={40} className="pe-succes__icone" />
          <h3>{t('{type} {num} créée', { type: t(resultat.description), num: resultat.numPiece })}</h3>
          <p>{t('{n} article(s) · HT {ht} DT · TVA {tva} DT · TTC {ttc} DT', { n: resultat.nbLignes, ht: nombre(resultat.tht), tva: nombre(resultat.ttva), ttc: nombre(resultat.ttc) })}</p>
          <p className="pe-succes__aide">{t('La pièce est rattachée au bon : retrouvez-la dans « Documents d’achat ».')}</p>
          {(resultat.avertissements || []).map((a) => (
            <p key={a} className="pe-alerte pe-alerte--attention"><AlertTriangle size={15} /> {a}</p>
          ))}
        </div>
      ) : (
        <div className="pe pe--deux">
          {/* ═════ Colonne principale : les articles ═════ */}
          <div className="pe-principal">
            {erreur && <p className="pe-alerte"><AlertTriangle size={15} /> {erreur}</p>}

            {/* Confirmation intégrée */}
            {dialogue && (
              <div className="pe-dialogue" role="alertdialog">
                <span>{dialogue.texte}</span>
                <div>
                  {!dialogue.seulOk && <button type="button" className="cm-btn cm-btn--lien" onClick={() => setDialogue(null)}>{t('Annuler')}</button>}
                  <button type="button" className="cm-btn cm-btn--principal" onClick={dialogue.onOk || (() => setDialogue(null))}>{t('OK')}</button>
                </div>
              </div>
            )}

            {/* Recherche d'articles (+ pour une commande : calculer depuis le stock, mode express) */}
            <div className="pe-barre-articles">
              <div className="pe-recherche">
                <Search size={16} className="pe-recherche__icone" />
                <input
                  ref={rechercheRef}
                  data-autofocus
                  type="text"
                  value={recherche}
                  onChange={(e) => { setRecherche(e.target.value); setSuggestionsOuvertes(true); }}
                  onFocus={() => setSuggestionsOuvertes(true)}
                  onBlur={() => setTimeout(() => setSuggestionsOuvertes(false), 150)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0]) ajouterArticle(suggestions[0]); } }}
                  placeholder={t('Ajouter un article : code ou désignation…')}
                  aria-label={t('Rechercher un article')}
                />
                {suggestionsOuvertes && recherche.trim() && (
                  <ul className="pe-suggestions" role="listbox">
                    {suggestions.length === 0 ? <li className="pe-suggestions__vide">{t('Aucun article trouvé.')}</li> : suggestions.map((a) => (
                      <li key={a.id}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ajouterArticle(a)}>
                          <Plus size={14} />
                          <span className="pe-suggestions__nom">{a.designation}</span>
                          {a.code && <span className="pe-suggestions__code">{a.code}</span>}
                          <span className="pe-suggestions__dispo">{t('Dispo {n}', { n: nombre(a.qteDisponible ?? 0, 0) })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {type === 'COMMANDE' && (
                <>
                  <button type="button" className="pe-outil" onClick={calculerDepuisStock}
                    title={t('Calculer la pièce : articles sous leur seuil de stock (quantité = seuil − stock)')}>
                    <Download size={16} /> <span>{t('Calculer')}</span>
                  </button>
                  <button type="button" className="pe-outil" onClick={demanderExpress}
                    title={t('Mode express : une commande par fournisseur')}>
                    <Shuffle size={16} /> <span>{t('Express')}</span>
                  </button>
                </>
              )}
            </div>

            {/* Lignes de la pièce : tableau */}
            {lignes.length === 0 ? (
              <div className="pe-vide">
                <Package size={22} />
                <p>{type === 'COMMANDE' && besoins.length > 0 && entete.cibleId
                  ? t('Rien à commander chez ce fournisseur pour ce bon. Ajoutez des articles avec la recherche.')
                  : t('Aucun article pour l’instant. Ajoutez-en avec la recherche ci-dessus.')}</p>
              </div>
            ) : (
              <div className="pe-tableau-cadre">
                <table className="pe-tableau">
                  <thead>
                    <tr>
                      <th className="pe-col-n">#</th>
                      <th>{t('Article')}</th>
                      <th className="pe-col-num">{t('Disponible')}</th>
                      <th className="pe-col-num">{t('Qté')}</th>
                      <th className="pe-col-unite">{t('Unité')}</th>
                      <th className="pe-col-num">{t('PU (DT)')}</th>
                      <th className="pe-col-pct">{t('Remise %')}</th>
                      <th className="pe-col-pct">{t('TVA %')}</th>
                      <th className="pe-col-num">{t('Montant HT')}</th>
                      <th className="pe-col-x" aria-label={t('Retirer la ligne')} />
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => {
                      const m = montantLigne(l);
                      const manque = l.disponible != null && nz(l.qte) > nz(l.disponible);
                      return (
                        <tr key={l.cle}>
                          <td className="pe-col-n">{i + 1}</td>
                          <td>
                            <div className="pe-article" title={l.tache ? t('Besoin : {t}', { t: l.tache }) : undefined}>
                              <span className="pe-article__nom">{l.designation}</span>
                              <span className="pe-article__sous">
                                {l.code && <span>{l.code}</span>}
                                <span className={`pe-origine ${l.besoin ? 'is-besoin' : ''}`}>{l.besoin ? t('besoin du bon') : t('ajouté')}</span>
                              </span>
                            </div>
                          </td>
                          <td className="pe-col-num">
                            <span className={`pe-dispo ${manque && type === 'DEMANDE' ? 'is-manque' : ''}`}>
                              {l.disponible == null ? '…' : nombre(l.disponible, 0)}
                            </span>
                          </td>
                          <td className="pe-col-num">
                            <input type="number" min="0" step="any" value={l.qte} aria-label={t('Qté')}
                              onChange={(e) => changerLigne(l.cle, 'qte', e.target.value)} className={nz(l.qte) <= 0 ? 'pe-requis' : ''} />
                          </td>
                          <td className="pe-col-unite">
                            <input type="text" value={l.unite} aria-label={t('Unité')} onChange={(e) => changerLigne(l.cle, 'unite', e.target.value)} />
                          </td>
                          <td className="pe-col-num">
                            <input type="number" min="0" step="any" value={l.prixUnitaire} aria-label={t('PU (DT)')} onChange={(e) => changerLigne(l.cle, 'prixUnitaire', e.target.value)} />
                          </td>
                          <td className="pe-col-pct">
                            <input type="number" min="0" max="100" step="any" value={l.remise} aria-label={t('Remise %')} onChange={(e) => changerLigne(l.cle, 'remise', e.target.value)} />
                          </td>
                          <td className="pe-col-pct">
                            <input type="number" min="0" step="any" value={l.tva} aria-label={t('TVA %')} onChange={(e) => changerLigne(l.cle, 'tva', e.target.value)} />
                          </td>
                          <td className="pe-col-num pe-montant">{nombre(m.net)}</td>
                          <td className="pe-col-x">
                            <button type="button" className="pe-retirer" onClick={() => retirerLigne(l.cle)} aria-label={t('Retirer la ligne')} title={t('Retirer la ligne')}>
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {type === 'DEMANDE' && lignes.some((l) => l.disponible != null && nz(l.qte) > nz(l.disponible)) && (
              <p className="pe-alerte pe-alerte--attention"><AlertTriangle size={15} /> {t('Certaines quantités dépassent le stock disponible : la demande sera enregistrée et le magasin sera prévenu.')}</p>
            )}
          </div>

          {/* ═════ Colonne latérale : la pièce et ses totaux ═════ */}
          <aside className="pe-cote">
            <section className="pe-carte">
              <span className="pe-carte__titre">{t('N° de pièce')}</span>
              <span className="pe-numero" title={t('Numéro proposé ; il est attribué définitivement à l’enregistrement')}>
                {numero?.numPiece || '—'}
              </span>
              <label className="pe-champ">
                <span className="pe-champ__titre">{t('Date')}</span>
                <input type="date" value={entete.date} onChange={(e) => changerEntete('date', e.target.value)} />
              </label>
              <label className="pe-champ">
                <span className="pe-champ__titre">{t('Dépôt')}</span>
                <select value={entete.depotId} onChange={(e) => changerEntete('depotId', e.target.value)}>
                  <option value="">{t('— Non précisé —')}</option>
                  {depots.map((d) => <option key={d.id} value={d.id}>{d.nom || d.codeDepots || `#${d.id}`}</option>)}
                </select>
              </label>
              {type === 'COMMANDE' && (
                <label className="pe-champ">
                  <span className="pe-champ__titre">{t('Fournisseur')} *</span>
                  <select value={entete.cibleId} onChange={(e) => changerEntete('cibleId', e.target.value)} className={!entete.cibleId ? 'pe-requis' : ''}>
                    <option value="">{t('— Choisir le fournisseur —')}</option>
                    {fournisseursProposes.prioritaires.length > 0 && (
                      <optgroup label={t('Sous-traitants du bon')}>
                        {fournisseursProposes.prioritaires.map((f) => <option key={f.id} value={f.id}>{nomFournisseur(f)}</option>)}
                      </optgroup>
                    )}
                    <optgroup label={t('Tous les prestataires')}>
                      {fournisseursProposes.autres.map((f) => <option key={f.id} value={f.id}>{nomFournisseur(f)}</option>)}
                    </optgroup>
                  </select>
                </label>
              )}
              <label className="pe-champ">
                <span className="pe-champ__titre">{t('Note')}</span>
                <textarea rows={2} value={entete.note} onChange={(e) => changerEntete('note', e.target.value)} placeholder={t('Ex. urgent, à livrer au service radiologie')} />
              </label>
            </section>

            <section className="pe-carte pe-totaux">
              <span className="pe-carte__titre">{t('Totaux')}</span>
              <dl>
                <div><dt>{t('Total brut')}</dt><dd>{nombre(totaux.brut)}</dd></div>
                <div><dt>{t('Remise')}</dt><dd>− {nombre(totaux.brut - totaux.net)}</dd></div>
                <div><dt>{t('Total HT')}</dt><dd>{nombre(totaux.net)}</dd></div>
                <div><dt>{t('TVA')}</dt><dd>{nombre(totaux.tva)}</dd></div>
              </dl>
              <div className="pe-totaux__ttc">
                <span>{t('Total TTC')}</span>
                <strong>{nombre(totaux.net + totaux.tva)} <small>DT</small></strong>
              </div>
              <span className="pe-totaux__nb">{t('{n} ligne(s)', { n: lignes.length })}</span>
            </section>
          </aside>
        </div>
      )}
    </Modale>
  );
}
