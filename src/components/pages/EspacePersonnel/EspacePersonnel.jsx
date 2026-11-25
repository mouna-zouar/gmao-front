import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  Wrench,
  RefreshCw,
  X,
  CheckCircle2,
  MessageCircle,
  Undo2,
  Hourglass,
  GraduationCap,
  Sun,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import authService from '../../../services/Authservice';
import espacePersonnelService from '../../../services/espacePersonnelService';
import chatBonService from '../../../services/chatBonService';
import suiviDemandeService from '../../../services/suiviDemandeService';
import MesDemandes from '../MesDemandes/MesDemandes';
import '../../ui/modals/ConfirmModal.css';
import '../Reclamations/Reclamations.css';
import BonMaintenanceDetails from '../bonmaintenance/Bonmaintenancedetails';
import { t, tp, locale } from '../../../i18n';
import EspaceKanban from './EspaceKanban';
import MesFormations from '../Formations/MesFormations';
import formationService from '../../../services/formationService';
import { MiniCalendrier, ASurveiller } from './EspaceAgenda';
import EspaceAujourdhui from './EspaceAujourdhui';
import { COLONNES_KANBAN, construireTravaux } from './espacePlanning';
import './EspacePersonnel.css';
import { EspaceReclamation } from './EspaceReclamation';
import { TableauBons } from './TableauBons';
import { EspaceDiscussions } from './EspaceDiscussions';
import { DetailModal } from './EspaceDetails';

const DEMANDES_TERMINEES = ['REPAREE', 'REFUSEE', 'ANNULEE', 'ANNULEE_DEMANDEUR'];

const ACTIVE_STATES = {
  bons: [1, 2, 3],
  reclamations: [0, 5, 1, 3],
  taches: [1, 2, 3]
};

const FILTRES_ROLE = [
  { id: 'tous', label: 'Tous', roles: null },
  { id: 'intervenant', label: 'Intervenant', roles: ['INTERVENANT'] },
  { id: 'diagnostic', label: 'Diagnostic', roles: ['DIAGNOSTIQUEUR'] },
  { id: 'controle', label: 'Contrôle', roles: ['CONTROLEUR'] },
  { id: 'remise', label: 'Remise en service', roles: ['REMISE_EN_SERVICE'] },
  { id: 'demandes', label: 'Créés / demandés', roles: ['CREATEUR', 'DEMANDEUR'] },
];

const aRole = (ligne, roles) => !roles || roles.some((r) => ligne.roles.includes(r));

const versLigneBon = (bon, personnelId) => ({
  ...bon,
  roles: [
    String(bon.personnelCreationId) === String(personnelId) && 'CREATEUR',
    String(bon.personnelDemandantId) === String(personnelId) && 'DEMANDEUR',
  ].filter(Boolean),
  intervention: null,
  diagnostic: null,
  controle: null,
  remiseEnService: null,
});

const aplatir = (m) => ({
  ...(m.bon ?? {}),
  roles: m.roles ?? [],
  intervention: m.intervention ?? null,
  diagnostic: m.diagnostic ?? null,
  controle: m.controle ?? null,
  remiseEnService: m.remiseEnService ?? null,
});

const salutation = () => {
  const h = new Date().getHours();
  if (h < 12) return t('Bonjour');
  if (h < 18) return t('Bon après-midi');
  return t('Bonsoir');
};

const initialesDe = (nom) => {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return ((mots[0][0] || '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase();
};

export default function EspacePersonnel() {
  const user = authService.getCurrentUser();

  const personnelId =
    user?.personnelId ?? user?.personnel?.id ?? user?.userId;

  const displayName =
    user?.userNom ||
    [user?.prenom, user?.nom].filter(Boolean).join(' ') ||
    user?.username ||
    user?.login ||
    user?.email ||
    '';

  const [searchParams] = useSearchParams();
  const ongletUrl = searchParams.get('onglet');
  const [activeTab, setActiveTab] = useState(ongletUrl || 'aujourdhui');
  const [demandeSignalement, setDemandeSignalement] = useState(0);
  useEffect(() => { if (ongletUrl) setActiveTab(ongletUrl); }, [ongletUrl, searchParams]);
  const [filtreRole, setFiltreRole] = useState('tous');
  const [data, setData] = useState({ bons: [], taches: [], reclamations: [], demandes: [], formations: [] });
  const [chargementFormations, setChargementFormations] = useState(true);
  useEffect(() => {
    if (personnelId == null || personnelId === '') { setChargementFormations(false); return; }
    formationService.duPersonnel(personnelId)
      .then((formations) => setData((d) => ({ ...d, formations })))
      .catch((e) => console.error('[GMAO formations] Mes formations :', e))
      .finally(() => setChargementFormations(false));
  }, [personnelId]);
  const [nonLusChat, setNonLusChat] = useState({});
  const [chatInitial, setChatInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [bonOuvert, setBonOuvert] = useState(null);
  const [reclamationOuverte, setReclamationOuverte] = useState(null);
  const [tachesEnCours, setTachesEnCours] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const minuterieToast = useRef(null);

  const load = useCallback(async () => {
    if (personnelId === null || personnelId === undefined || personnelId === '') {
      setError(
        t("Votre compte n'est pas associé à un identifiant personnel. Contactez l'administrateur.")
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const chargerBons = espacePersonnelService.getMesBonsAvecRoles(personnelId)
        .then((liste) => (Array.isArray(liste) ? liste.map(aplatir) : []))
        .catch(() => espacePersonnelService.getMesBons(personnelId)
          .then((liste) => (Array.isArray(liste) ? liste.map((b) => versLigneBon(b, personnelId)) : [])));

      const [bons, taches] = await Promise.all([
        chargerBons,
        espacePersonnelService.getMesTaches(personnelId)
      ]);

      setData((d) => ({
        ...d,
        bons,
        taches: Array.isArray(taches) ? taches : []
      }));

      suiviDemandeService.getMesDemandes(personnelId)
        .then((demandes) => setData((d) => ({ ...d, demandes })))
        .catch(() => {});

      chatBonService.getNonLus(bons.map((b) => b.id))
        .then(setNonLusChat)
        .catch(() => setNonLusChat({}));
    } catch (e) {
      console.error('Erreur chargement espace personnel', e);
      setError(
        t("Impossible de charger vos données. Vérifiez les API de l'espace personnel et le backend GMAO.")
      );
    } finally {
      setLoading(false);
    }
  }, [personnelId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = (item, type) => {
    setSelectedItem(item);
    setSelectedType(type);
  };

  const closeDetails = useCallback(() => {
    setSelectedItem(null);
    setSelectedType(null);
  }, []);

  const ouvrirBon = (bon) => {
    closeDetails();
    setReclamationOuverte(null);
    setBonOuvert(bon);
  };

  const ouvrirReclamation = (id) => {
    if (id == null) return;
    closeDetails();
    setReclamationOuverte(id);
  };

  const travaux = useMemo(() => construireTravaux(data), [data]);
  const bonsParId = useMemo(() => new Map(data.bons.map((b) => [b.id, b])), [data.bons]);

  const ouvrirTravail = (travail) => {
    if (travail.type === 'tache') openDetails(travail.source, 'taches');
    else ouvrirBon(travail.source);
  };

  const afficherToast = useCallback((contenu) => {
    clearTimeout(minuterieToast.current);
    setToast(contenu);
    minuterieToast.current = setTimeout(() => setToast(null), contenu.erreur ? 7000 : 6000);
  }, []);

  useEffect(() => () => clearTimeout(minuterieToast.current), []);

  const remplacerTache = useCallback((id, maj) => setData((d) => ({
    ...d,
    taches: d.taches.map((x) => (x.id === id ? { ...x, ...maj } : x)),
  })), []);

  const deplacerTache = useCallback(async (tache, nouvelEtat, { annulable = true } = {}) => {
    const ancienEtat = tache.etat;
    if (ancienEtat === nouvelEtat || tachesEnCours.has(tache.id)) return;

    remplacerTache(tache.id, { etat: nouvelEtat });
    setTachesEnCours((s) => new Set(s).add(tache.id));
    const libelle = (etat) => t(COLONNES_KANBAN.find((c) => c.etat === etat)?.label || String(etat));

    try {
      const maj = await espacePersonnelService.changerEtatTache(personnelId, tache.id, nouvelEtat);
      if (maj) remplacerTache(tache.id, maj);
      afficherToast({
        texte: t('« {nom} » → {etat}', { nom: tache.designation || t('Tâche sans nom'), etat: libelle(nouvelEtat) }),
        annuler: annulable ? { tache: { ...tache, ...(maj || {}), etat: nouvelEtat }, etat: ancienEtat } : null,
      });
    } catch (err) {
      remplacerTache(tache.id, { etat: ancienEtat });
      const status = err?.response?.status;
      afficherToast({
        erreur: true,
        texte: status === 403
          ? t('Cette tâche ne vous est pas affectée : son état ne peut pas être changé ici.')
          : t("L'état de la tâche n'a pas pu être enregistré. Réessayez."),
      });
    } finally {
      setTachesEnCours((s) => { const n = new Set(s); n.delete(tache.id); return n; });
    }
  }, [personnelId, tachesEnCours, afficherToast, remplacerTache]);

  const tabs = useMemo(
    () => [
      {
        id: 'bons',
        label: t('Bons de maintenance'),
        icon: Wrench,
        items: data.bons,
        activeStates: ACTIVE_STATES.bons
      },
      {
        id: 'taches',
        label: t('Mes tâches'),
        icon: ClipboardList,
        items: data.taches,
        activeStates: ACTIVE_STATES.taches
      },
      {
        id: 'demandes',
        label: t('Mes demandes'),
        icon: Hourglass,
        items: data.demandes,
        activeStates: []
      },
      {
        id: 'discussions',
        label: t('Discussions'),
        icon: MessageCircle,
        items: data.bons,
        activeStates: []
      },
      {
        id: 'formations',
        label: t('Formations'),
        icon: GraduationCap,
        items: data.formations,
        activeStates: []
      }
    ],
    [data]
  );

  const totalNonLus = Object.values(nonLusChat).reduce((somme, n) => somme + (n || 0), 0);

  const ouvrirDiscussion = (bonId) => {
    setChatInitial(bonId);
    setActiveTab('discussions');
  };

  const compteRoles = useMemo(() => {
    const c = {};
    FILTRES_ROLE.forEach((f) => { c[f.id] = data.bons.filter((b) => aRole(b, f.roles)).length; });
    return c;
  }, [data.bons]);

  const bonsFiltres = useMemo(() => {
    const filtre = FILTRES_ROLE.find((f) => f.id === filtreRole) ?? FILTRES_ROLE[0];
    return data.bons.filter((b) => aRole(b, filtre.roles));
  }, [data.bons, filtreRole]);



  if (reclamationOuverte != null) {
    return (
      <EspaceReclamation
        reclamationId={reclamationOuverte}
        onBack={() => { setReclamationOuverte(null); load(); }}
        onOuvrirBon={ouvrirBon}
      />
    );
  }

  if (bonOuvert) {
    return (
      <BonMaintenanceDetails
        bonMaintenance={bonOuvert}
        onBack={() => { setBonOuvert(null); load(); }}
      />
    );
  }


  const tachesAFaire = data.taches.filter((x) => ACTIVE_STATES.taches.includes(x.etat)).length;
  const enRetard = travaux.filter((tr) => tr.statut?.niveau === 'retard').length;
  const syntheses = [
    tachesAFaire > 0 && { cle: 'taches', texte: tp('tâche à faire', tachesAFaire), onglet: 'taches' },
    enRetard > 0 && { cle: 'retard', texte: tp('travail en retard', enRetard), onglet: 'taches', alerte: true },
    totalNonLus > 0 && { cle: 'messages', texte: tp('message non lu', totalNonLus), onglet: 'discussions', alerte: true },
  ].filter(Boolean);

  const compteOnglet = (tab) => {
    if (tab.id === 'discussions') return totalNonLus;
    if (tab.id === 'demandes') return tab.items.filter((x) => !DEMANDES_TERMINEES.includes(x.etape)).length;
    if (tab.id === 'formations') return tab.items.filter((x) => x.formation?.statut === 'PLANIFIEE').length;
    return tab.items.filter((x) => tab.activeStates.includes(x.etat)).length;
  };

  const aideOnglet = {
    bons: t('Groupés par état : ce qui est en cours d’abord'),
    taches: t('Glissez les cartes d’une colonne à l’autre'),
    demandes: t('Où en sont les pannes que vous avez signalées, jusqu\'à la réparation'),
    discussions: t('Les messages arrivent en direct'),
    formations: t('Vos formations et leurs résultats'),
  }[activeTab];

  const aller = (onglet) => { if (onglet === 'discussions') setChatInitial(null); setActiveTab(onglet); };
  const signaler = () => { setActiveTab('demandes'); setDemandeSignalement((n) => n + 1); };
  const compteurs = {
    bons: data.bons.filter((b) => ACTIVE_STATES.bons.includes(b.etat)).length,
    taches: tachesAFaire,
    retard: enRetard,
    proches: travaux.filter((tr) => tr.statut?.niveau === 'aujourdhui' || tr.statut?.niveau === 'proche').length,
    messages: totalNonLus,
    demandes: data.demandes.filter((x) => !DEMANDES_TERMINEES.includes(x.etape)).length,
    formations: data.formations.filter((x) => x.formation?.statut === 'PLANIFIEE').length,
  };
  const estAujourdhui = activeTab === 'aujourdhui';
  const filtresRole = (
    <div className="ep-filtres-role ept-filtres" role="group" aria-label={t('Filtrer par rôle')}>
      {FILTRES_ROLE.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`ep-filtre-role ${filtreRole === f.id ? 'is-actif' : ''}`}
          aria-pressed={filtreRole === f.id}
          onClick={() => setFiltreRole(f.id)}
        >
          {t(f.label)}
          <span className="ep-filtre-role-compte">{compteRoles[f.id]}</span>
        </button>
      ))}
    </div>
  );
  const avecCote = activeTab === 'bons';

  return (
    <main className="ep-page ep-theme ep-calme ep2 ep3">
      <div className="ep3-cadre">
        <header className="ep3-entete">
          <span className="ep-avatar ep2-avatar" aria-hidden="true">{initialesDe(displayName)}</span>
          <div className="ep3-entete-texte">
            <p className="ep2-date">
              {new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1>{salutation()}{displayName ? `, ${displayName.split(' ')[0]}` : ''}</h1>
            <p className="ep-synthese ep2-synthese">
              {loading ? t('Chargement de vos données…') : syntheses.length === 0 ? t('Rien d’urgent aujourd’hui.') : (
                <>
                  {syntheses.map((x, i) => (
                    <span key={x.cle}>
                      {i > 0 && (i === syntheses.length - 1 ? ` ${t('et')} ` : ', ')}
                      <button type="button" className={`ep-synthese-lien ${x.alerte ? 'is-alerte' : ''}`} onClick={() => aller(x.onglet)}>
                        {x.texte}
                      </button>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
          <button type="button" className="ep2-actualiser" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'ep-spin' : ''} />
            <span>{loading ? t('Chargement…') : t('Actualiser')}</span>
          </button>
        </header>

        <nav className="ep3-onglets" role="tablist" aria-label={t('Mon espace')}>
          <button type="button" role="tab" aria-selected={estAujourdhui}
            className={`ep3-onglet ${estAujourdhui ? 'is-actif' : ''}`} onClick={() => aller('aujourdhui')}>
            <Sun size={16} aria-hidden="true" />
            <span>{t("Aujourd'hui")}</span>
            {compteurs.retard > 0 && <span className="ep2-nav-nb is-alerte" title={tp('travail en retard', compteurs.retard)}>{compteurs.retard}</span>}
          </button>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const n = compteOnglet(tab);
            const actif = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={actif}
                className={`ep3-onglet ${actif ? 'is-actif' : ''}`}
                onClick={() => aller(tab.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
                {n > 0 && (
                  <span
                    className={`ep2-nav-nb ${tab.id === 'discussions' ? 'is-alerte' : ''}`}
                    title={tab.id === 'discussions' ? tp('message non lu', n) : tp('actif', n)}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <section className="ep2-contenu ep3-contenu">
          {!estAujourdhui && <p className="ep3-aide">{aideOnglet}</p>}

      {error && (
        <div className="ep-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

          {estAujourdhui ? (
            <EspaceAujourdhui
              chargement={loading}
              compteurs={compteurs}
              travaux={travaux}
              onAller={aller}
              onOuvrirTravail={ouvrirTravail}
              onSignaler={signaler}
            />
          ) : (
      <div className={`ep-layout ep2-layout ${avecCote ? '' : 'ep2-layout--plein'}`}>
        <div className="ep-principal ep2-principal" role="tabpanel">

          {activeTab === 'formations' ? (
            <MesFormations liste={data.formations} chargement={chargementFormations} />
          ) : activeTab === 'demandes' ? (
            <MesDemandes
              integre
              onCharge={(demandes) => setData((d) => ({ ...d, demandes }))}
              onOuvrir={ouvrirReclamation}
              demandeSignalement={demandeSignalement}
            />
          ) : loading ? (
            <div className="ep-empty">
              <RefreshCw size={18} className="ep-spin" />
              <span>{t('Chargement de vos données…')}</span>
            </div>
          ) : activeTab === 'bons' ? (
            bonsFiltres.length === 0 ? (
              <div className="ep-empty ept-vide-bloc">
                {data.bons.length > 0 && filtresRole}
                <Wrench size={18} />
                <span>{filtreRole === 'tous' ? t('Aucun bon de maintenance ne vous est associé.') : t('Aucun bon pour ce rôle.')}</span>
              </div>
            ) : (
              <TableauBons
                bons={bonsFiltres}
                nonLusChat={nonLusChat}
                onApercu={(b) => openDetails(b, 'bons')}
                onOuvrir={ouvrirBon}
                onDiscuter={ouvrirDiscussion}
                outils={filtresRole}
              />
            )
          ) : activeTab === 'discussions' ? (
            <div className="ep-surface">
              <EspaceDiscussions
                key={chatInitial ?? 'liste'}
                bons={data.bons}
                personnelId={personnelId}
                bonInitial={chatInitial}
                onOuvrirBon={ouvrirBon}
                onNonLusChange={setNonLusChat}
              />
            </div>
          ) : activeTab === 'taches' ? (
            data.taches.length === 0 ? (
              <div className="ep-empty">
                <ClipboardList size={18} />
                <span>{t('Aucune tâche ne vous est affectée.')}</span>
              </div>
            ) : (
              <EspaceKanban
                taches={data.taches}
                bonsParId={bonsParId}
                enCours={tachesEnCours}
                onDeplacer={deplacerTache}
                onApercu={(tache) => openDetails(tache, 'taches')}
                onOuvrirBon={ouvrirBon}
              />
            )
          ) : null}
        </div>

        {avecCote && (
          <aside className="ep-cote" aria-label={t('Mon planning')}>
            <ASurveiller travaux={travaux} onOuvrir={ouvrirTravail} />
            <MiniCalendrier travaux={travaux} onOuvrir={ouvrirTravail} />
          </aside>
        )}
      </div>
          )}
        </section>
      </div>

      {toast && (
        <div className={`ep-toast ${toast.erreur ? 'ep-toast--erreur' : ''}`} role="status" aria-live="polite">
          {toast.erreur ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.texte}</span>
          {toast.annuler && (
            <button
              type="button"
              onClick={() => {
                const { tache, etat } = toast.annuler;
                setToast(null);
                deplacerTache(tache, etat, { annulable: false });
              }}
            >
              <Undo2 size={14} /> {t('Annuler')}
            </button>
          )}
          <button type="button" className="ep-toast-fermer" onClick={() => setToast(null)} aria-label={t('Fermer')}>
            <X size={14} />
          </button>
        </div>
      )}

      <DetailModal
        item={selectedItem}
        type={selectedType}
        onClose={closeDetails}
        onOuvrirBon={ouvrirBon}
        onOuvrirReclamation={ouvrirReclamation}
        taches={data.taches}
        nonLusChat={nonLusChat}
        onDiscuter={(bonId) => { closeDetails(); ouvrirDiscussion(bonId); }}
      />
    </main>
  );
}
