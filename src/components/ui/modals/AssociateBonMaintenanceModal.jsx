import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link as LinkIcon,
  X,
  Search,
  Wrench,
  Check,
  Loader2,
  Unlink,
  Sparkles,
  Inbox,
} from 'lucide-react';
import reclamationBonMaintenanceService from '../../../services/Reclamationbonmaintenanceservice';
import bonMaintenanceService from '../../../services/Bonmaintenanceservice';
import { t, locale } from '../../../i18n';
import './AssociateBonMaintenanceModal.css';

const BON_ETAT = {
  1: { texte: 'Nouveau', ton: 'info' },
  2: { texte: 'En pause', ton: 'attention' },
  3: { texte: 'En cours', ton: 'action' },
  4: { texte: 'Terminé', ton: 'ok' },
  10: { texte: 'Annulé', ton: 'neutre' },
};

const FILTRES = [
  { key: 'actifs', label: 'À traiter', test: (b) => b.etat !== 4 && b.etat !== 10 },
  { key: 'tous', label: 'Tous', test: () => true },
  { key: 'termines', label: 'Terminés', test: (b) => b.etat === 4 },
];

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EtatBon({ etat }) {
  const e = BON_ETAT[etat];
  if (!e) return null;
  return <span className={`asb-pastille asb-ton--${e.ton}`}>{t(e.texte)}</span>;
}

const AssociateBonMaintenanceModal = ({ isOpen, onClose, reclamation }) => {
  const [linkedBons, setLinkedBons] = useState([]);
  const [loadingLinkedBons, setLoadingLinkedBons] = useState(false);
  const [allBons, setAllBons] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [bonToLink, setBonToLink] = useState(null);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const [confirmRetraitId, setConfirmRetraitId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('actifs');
  const [justeAjouteId, setJusteAjouteId] = useState(null);
  const rechercheRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingAll(true);
    bonMaintenanceService.getAll(0, 200)
      .then((page) => setAllBons(page.content ?? []))
      .catch((err) => {
        console.error('Erreur chargement bons de maintenance :', err);
        setAllBons([]);
      })
      .finally(() => setLoadingAll(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !reclamation) {
      setLinkedBons([]);
      return;
    }
    setLoadingLinkedBons(true);
    reclamationBonMaintenanceService.getBonMaintenancesByReclamation(reclamation.id)
      .then((bons) => setLinkedBons(bons ?? []))
      .catch((err) => {
        console.error('Erreur chargement bons liés :', err);
        setLinkedBons([]);
      })
      .finally(() => setLoadingLinkedBons(false));

    setBonToLink(null);
    setRecherche('');
    setFiltre('actifs');
    setConfirmRetraitId(null);
    setJusteAjouteId(null);
  }, [isOpen, reclamation]);

  // Échap pour fermer, focus sur la recherche à l'ouverture
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const tache = setTimeout(() => rechercheRef.current?.focus(), 120);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(tache);
    };
  }, [isOpen, onClose]);

  const linkedIds = useMemo(() => new Set(linkedBons.map((b) => b.id)), [linkedBons]);

  // Bons proposés : on retire ceux déjà liés, on filtre, et on met en tête ceux du même équipement
  const proposes = useMemo(() => {
    const f = FILTRES.find((x) => x.key === filtre) ?? FILTRES[0];
    const terme = recherche.trim().toLowerCase();
    const equipementId = reclamation?.lotArticleImmobilistationId;

    return allBons
      .filter((b) => !linkedIds.has(b.id))
      .filter(f.test)
      .filter((b) => !terme
        || `${b.num ?? ''} ${b.titre ?? ''} ${b.description ?? ''}`.toLowerCase().includes(terme))
      .map((b) => ({
        ...b,
        memeEquipement: equipementId != null && String(b.lotArticleImmobilistationId) === String(equipementId),
      }))
      .sort((a, b) => {
        if (a.memeEquipement !== b.memeEquipement) return a.memeEquipement ? -1 : 1;
        return new Date(b.date ?? 0) - new Date(a.date ?? 0);
      });
  }, [allBons, linkedIds, filtre, recherche, reclamation?.lotArticleImmobilistationId]);

  const compteParFiltre = useMemo(() => {
    const libres = allBons.filter((b) => !linkedIds.has(b.id));
    return Object.fromEntries(FILTRES.map((f) => [f.key, libres.filter(f.test).length]));
  }, [allBons, linkedIds]);

  const handleLinkBon = async () => {
    if (!bonToLink || !reclamation) return;
    setLinking(true);
    try {
      await reclamationBonMaintenanceService.link(reclamation.id, bonToLink.id);
      const bons = await reclamationBonMaintenanceService.getBonMaintenancesByReclamation(reclamation.id);
      setLinkedBons(bons ?? []);
      setJusteAjouteId(bonToLink.id);
      setBonToLink(null);
    } catch (err) {
      console.error(err);
      alert(t("L'association a échoué. Vérifiez la connexion puis réessayez."));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkBon = async (bonId) => {
    if (!reclamation) return;
    setUnlinkingId(bonId);
    try {
      await reclamationBonMaintenanceService.unlink(reclamation.id, bonId);
      setLinkedBons((prev) => prev.filter((b) => b.id !== bonId));
      setConfirmRetraitId(null);
    } catch (err) {
      console.error(err);
      alert(t("Le retrait a échoué. Vérifiez la connexion puis réessayez."));
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!isOpen) return null;

  const nomReclamation = reclamation?.num || t('Réclamation #{id}', { id: reclamation?.id ?? '' });

  return (
    <div className="asb-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside className="asb-panneau" role="dialog" aria-modal="true" aria-labelledby="asb-titre">
        {/* ===== En-tête ===== */}
        <header className="asb-entete">
          <span className="asb-entete-icone"><LinkIcon size={20} /></span>
          <div className="asb-entete-textes">
            <h2 id="asb-titre">{t("Associer un bon de maintenance")}</h2>
            <p>{t("Pour la réclamation")} {nomReclamation}</p>
          </div>
          <button type="button" className="asb-fermer" onClick={onClose} aria-label={t("Fermer")}>
            <X size={20} />
          </button>
        </header>

        <div className="asb-corps">
          {/* ===== Déjà associés ===== */}
          <section className="asb-section" aria-labelledby="asb-lies">
            <h3 id="asb-lies">
              {t("Déjà associés")}
              {!loadingLinkedBons && <span className="asb-compte">{linkedBons.length}</span>}
            </h3>

            {loadingLinkedBons ? (
              <p className="asb-info"><Loader2 size={16} className="asb-tourne" /> {t("Chargement…")}</p>
            ) : linkedBons.length === 0 ? (
              <p className="asb-vide">{t("Aucun bon n’est encore associé. Choisissez-en un dans la liste ci-dessous.")}</p>
            ) : (
              <ul className="asb-liste">
                {linkedBons.map((bon) => {
                  const confirme = confirmRetraitId === bon.id;
                  return (
                    <li
                      key={bon.id}
                      className={`asb-carte asb-carte--liee ${justeAjouteId === bon.id ? 'is-nouveau' : ''}`}
                    >
                      <span className="asb-carte-icone"><Check size={18} strokeWidth={2.6} /></span>
                      <span className="asb-carte-texte">
                        <span className="asb-carte-num">{bon.num || t('Bon #{id}', { id: bon.id })}</span>
                        {bon.titre && <span className="asb-carte-titre">{t(bon.titre)}</span>}
                      </span>
                      <EtatBon etat={bon.etat} />

                      {confirme ? (
                        <span className="asb-confirm" role="group" aria-label={t("Confirmer le retrait")}>
                          <span>{t("Retirer ?")}</span>
                          <button
                            type="button"
                            className="asb-mini asb-mini--danger"
                            onClick={() => handleUnlinkBon(bon.id)}
                            disabled={unlinkingId === bon.id}
                          >
                            {unlinkingId === bon.id ? <Loader2 size={14} className="asb-tourne" /> : t("Oui")}
                          </button>
                          <button type="button" className="asb-mini" onClick={() => setConfirmRetraitId(null)}>
                            {t("Non")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="asb-retirer"
                          onClick={() => setConfirmRetraitId(bon.id)}
                          title={t("Retirer ce bon de la réclamation")}
                        >
                          <Unlink size={15} /> {t("Retirer")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ===== Choisir un bon ===== */}
          <section className="asb-section" aria-labelledby="asb-choisir">
            <h3 id="asb-choisir">{t("Choisir un bon à associer")}</h3>
            <p className="asb-aide">{t("Cliquez sur un bon pour le sélectionner, puis validez en bas.")}</p>

            <label className="asb-recherche">
              <Search size={18} />
              <input
                ref={rechercheRef}
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t("Numéro ou titre du bon, par exemple BM-0012")}
              />
              {recherche && (
                <button type="button" className="asb-recherche-effacer" onClick={() => setRecherche('')} aria-label={t("Effacer la recherche")}>
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="asb-filtres" role="tablist" aria-label={t("Filtrer les bons")}>
              {FILTRES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filtre === f.key}
                  className={`asb-filtre ${filtre === f.key ? 'is-actif' : ''}`}
                  onClick={() => setFiltre(f.key)}
                >
                  {t(f.label)}
                  <span>{compteParFiltre[f.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {loadingAll ? (
              <p className="asb-info"><Loader2 size={16} className="asb-tourne" /> {t("Chargement des bons…")}</p>
            ) : proposes.length === 0 ? (
              <div className="asb-vide asb-vide--grand">
                <Inbox size={22} />
                <p>
                  {recherche
                    ? t('Aucun bon ne correspond à « {q} ».', { q: recherche })
                    : t("Aucun bon disponible dans cette catégorie.")}
                </p>
                {filtre !== 'tous' && (
                  <button type="button" className="asb-lien" onClick={() => setFiltre('tous')}>
                    {t("Voir tous les bons")}
                  </button>
                )}
              </div>
            ) : (
              <ul className="asb-liste" role="listbox" aria-label={t("Bons disponibles")}>
                {proposes.map((b) => {
                  const choisi = bonToLink?.id === b.id;
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={choisi}
                        className={`asb-carte asb-carte--choix ${choisi ? 'is-choisi' : ''}`}
                        onClick={() => setBonToLink(choisi ? null : b)}
                      >
                        <span className="asb-radio" aria-hidden="true">{choisi && <Check size={14} strokeWidth={3} />}</span>
                        <span className="asb-carte-icone asb-carte-icone--neutre"><Wrench size={18} /></span>
                        <span className="asb-carte-texte">
                          <span className="asb-carte-num">
                            {b.num || t('Bon #{id}', { id: b.id })}
                            {b.memeEquipement && (
                              <span className="asb-suggestion"><Sparkles size={12} /> {t("Même équipement")}</span>
                            )}
                          </span>
                          <span className="asb-carte-titre">
                            {b.titre || t("Sans titre")}
                            {formatDate(b.date) ? `, du ${formatDate(b.date)}` : ''}
                          </span>
                        </span>
                        <EtatBon etat={b.etat} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ===== Pied ===== */}
        <footer className="asb-pied">
          <p className="asb-pied-texte">
            {bonToLink
              ? <>{t("Bon choisi :")} <strong>{bonToLink.num || `#${bonToLink.id}`}</strong></>
              : t("Aucun bon choisi")}
          </p>
          <div className="asb-pied-boutons">
            <button type="button" className="asb-btn asb-btn--clair" onClick={onClose}>
              {t("Fermer")}
            </button>
            <button
              type="button"
              className="asb-btn asb-btn--principal"
              onClick={handleLinkBon}
              disabled={!bonToLink || linking}
            >
              {linking ? <Loader2 size={17} className="asb-tourne" /> : <LinkIcon size={17} />}
              {linking
                ? t("Association…")
                : bonToLink ? t('Associer {num}', { num: bonToLink.num || t('le bon #{id}', { id: bonToLink.id }) }) : t("Associer")}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
};

export default AssociateBonMaintenanceModal;