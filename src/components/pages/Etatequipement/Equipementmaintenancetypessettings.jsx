import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Pause, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import equipementMaintenanceService from '../../../services/equipementMaintenanceService';
import { commePage, obtenirEquipements } from '../../../store/referentiels';
import { t, locale } from '../../../i18n';
import { useCarteLieux } from '../../ui/FiltreLieu/FiltreLieu';
import gammeService from '../../../services/gammeService';
import { dureeLisible } from '../gammes/Gammes';
import { cheminLieu, lieuxAplatis } from '../../../services/lieuxCache';
import { Badge, ConfirmModal, ModaleFormulaire, PageListe } from '../../commun';
import serviceService from '../../../services/Serviceservice';
import FiltreFamilleArbre, { filtrerParFamille } from './FiltreFamilleArbre';
import './Equipementmaintenancetypessettings.css';

const normaliser = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const nf = (v) => new Intl.NumberFormat(locale()).format(v);

const URGENCES = {
  1: { label: 'Faible', ton: 'vert' },
  2: { label: 'Normale', ton: 'bleu' },
  3: { label: 'Haute', ton: 'orange' },
  4: { label: 'Critique', ton: 'rouge' },
};
const BASES_RECALCUL = { 0: 'Date réelle', 1: 'Échéance théorique' };

const idsEquipements = (tache) => (tache.lotArticleImmobilistationIds?.length
  ? tache.lotArticleImmobilistationIds
  : (tache.lotArticleImmobilistationId != null ? [tache.lotArticleImmobilistationId] : []));

function SelectionEquipements({ id, valeurs, onChange, options, services = {}, loading = false, disabled = false }) {
  const [recherche, setRecherche] = useState('');
  const [famille, setFamille] = useState(null);
  const [service, setService] = useState('');
  const pourFamilles = useMemo(() => options.map((o) => ({
    lotArticleImmobilistationId: o.id, familleId: o.articleFamilleId ?? null, familleNom: o.articleFamilleNom || '',
  })), [options]);
  const listeServices = useMemo(() => {
    const m = new Map();
    let sans = 0;
    options.forEach((o) => {
      if (o.serviceId == null) { sans += 1; return; }
      const cle = String(o.serviceId);
      const f = m.get(cle) || { id: cle, nom: services[cle] || t('Service #{id}', { id: cle }), n: 0 };
      f.n += 1;
      m.set(cle, f);
    });
    return { liste: [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, locale())), sans };
  }, [options, services]);
  const choisis = useMemo(() => new Set(valeurs.map(String)), [valeurs]);
  const parId = useMemo(() => new Map(options.map((o) => [String(o.id), o])), [options]);
  const nom = (cle) => parId.get(cle)?.designation || t('Équipement #{id}', { id: cle });

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return options
      .filter((o) => filtrerParFamille(famille, { lotArticleImmobilistationId: o.id, familleId: o.articleFamilleId ?? null }))
      .filter((o) => !service || (service === 'AUCUN' ? o.serviceId == null : String(o.serviceId) === service))
      .filter((o) => !q || [o.designation, o.numPiece, o.codeBarre, o.marque, o.modele].some((v) => normaliser(v).includes(q)));
  }, [options, recherche, famille, service]);
  const filtre = Boolean(recherche.trim() || famille || service);

  const basculer = (cle) => {
    const suivant = new Set(choisis);
    if (suivant.has(cle)) suivant.delete(cle); else suivant.add(cle);
    onChange([...suivant]);
  };
  const toutCocher = () => onChange([...new Set([...choisis, ...visibles.map((o) => String(o.id))])]);

  return (
    <div className={`emt-multi ${disabled ? 'is-disabled' : ''}`}>
      <div className="emt-multi__choisis" aria-live="polite">
        {choisis.size === 0 ? (
          <span className="emt-multi__aucun">{t('Tous les équipements')}</span>
        ) : (
          [...choisis].map((cle) => (
            <span key={cle} className="emt-multi__puce">
              {nom(cle)}
              <button type="button" onClick={() => basculer(cle)} disabled={disabled} aria-label={t('Retirer {nom}', { nom: nom(cle) })}>
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="emt-multi__barre">
        <FiltreFamilleArbre equipements={pourFamilles} valeur={famille} onChange={setFamille} />
        <select className="emt-multi__service" value={service} onChange={(e) => setService(e.target.value)} disabled={disabled} aria-label={t('Service')}>
          <option value="">{t('Tous les services')} ({options.length})</option>
          {listeServices.liste.map((x) => <option key={x.id} value={x.id}>{x.nom} ({x.n})</option>)}
          {listeServices.sans > 0 && <option value="AUCUN">{t('Sans service')} ({listeServices.sans})</option>}
        </select>
      </div>
      <div className="emt-multi__barre">
        <div className="emt-multi__recherche">
          <Search size={14} aria-hidden="true" />
          <input
            id={id}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher par nom, n° de pièce ou code-barres…')}
            disabled={disabled}
          />
        </div>
        <button type="button" className="emt-multi__action" onClick={toutCocher} disabled={disabled || visibles.length === 0}>
          {filtre ? t('Cocher les {n} résultats', { n: visibles.length }) : t('Tout cocher')}
        </button>
        <button type="button" className="emt-multi__action" onClick={() => onChange([])} disabled={disabled || choisis.size === 0}>
          {t('Tout décocher')}
        </button>
      </div>

      <ul className="emt-multi__liste" role="group" aria-label={t('Équipements')}>
        {loading ? (
          <li className="emt-multi__vide"><Loader2 size={14} className="cf-tourne" /> {t('Chargement…')}</li>
        ) : visibles.length === 0 ? (
          <li className="emt-multi__vide">{t('Aucun équipement ne correspond')}</li>
        ) : (
          visibles.map((o) => {
            const cle = String(o.id);
            return (
              <li key={cle}>
                <label className={`emt-multi__ligne ${choisis.has(cle) ? 'is-choisi' : ''}`}>
                  <input type="checkbox" checked={choisis.has(cle)} onChange={() => basculer(cle)} disabled={disabled} />
                  <span className="emt-multi__nom">{o.designation || t('Équipement #{id}', { id: o.id })}</span>
                  {(o.numPiece || o.marque) && (
                    <span className="emt-multi__hint">{o.numPiece ? t('N° pièce : {num}', { num: o.numPiece }) : o.marque}</span>
                  )}
                </label>
              </li>
            );
          })
        )}
      </ul>
      <small className="emt-multi__compte">{t('{n} équipement(s) choisi(s)', { n: choisis.size })}</small>
    </div>
  );
}

export default function EquipementMaintenanceTypesSettings({ vues, integre = false }) {
  const [types, setTypes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState('tous');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });
  const [aDesactiver, setADesactiver] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const [equipements, setEquipements] = useState([]);
  const [chargementEquipements, setChargementEquipements] = useState(true);
  const [gammes, setGammes] = useState([]);
  const [services, setServices] = useState({});
  const carteLieux = useCarteLieux();

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await equipementMaintenanceService.getTypes();
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Impossible de charger les échéances.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { gammeService.lister().then(setGammes).catch(() => setGammes([])); }, []);
  useEffect(() => {
    serviceService.getAll(0, 500).then((d) => d?.content ?? d ?? [])
      .then((l) => setServices(Object.fromEntries(l.map((x) => [String(x.id), x.description || x.code || t('Service #{id}', { id: x.id })]))))
      .catch(() => setServices({}));
  }, []);
  useEffect(() => {
    let actif = true;
    obtenirEquipements().then(commePage)
      .then((page) => {
        const data = page?.content ?? page?.data ?? page ?? [];
        if (actif) setEquipements(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (actif) setEquipements([]); })
      .finally(() => { if (actif) setChargementEquipements(false); });
    return () => { actif = false; };
  }, []);

  const gammesParOrigine = useMemo(() => {
    const m = new Map();
    const rang = (x) => (x.statut === 'VALIDEE' ? 2 : x.statut === 'BROUILLON' ? 1 : 0) * 1000 + (x.version || 0);
    gammes.forEach((g) => {
      const k = g.gammeOrigineId ?? g.id;
      const d = m.get(k);
      if (!d || rang(g) > rang(d)) m.set(k, g);
    });
    return m;
  }, [gammes]);
  const gammeDe = useCallback((id) => {
    if (id == null || id === '') return null;
    const g = gammes.find((x) => String(x.id) === String(id));
    return g ? (gammesParOrigine.get(g.gammeOrigineId ?? g.id) || g) : null;
  }, [gammes, gammesParOrigine]);
  const gammesChoix = useMemo(() => [...gammesParOrigine.values()].filter((g) => g.statut === 'VALIDEE')
    .sort((a, b) => a.code.localeCompare(b.code)), [gammesParOrigine]);
  const lieuxChoix = useMemo(() => lieuxAplatis(carteLieux), [carteLieux]);
  const nomsEquipements = useMemo(() => new Map(equipements.map((e) => [String(e.id), e.designation])), [equipements]);

  const libelleGamme = (g) => `${g.code} v${g.version} · ${g.etapes?.length ?? 0} ${t('étapes')} · ${dureeLisible(g.dureeTotaleMinutes)}`;
  const portee = (l) => {
    const ids = idsEquipements(l);
    if (ids.length === 0 && l.lieuId != null) return cheminLieu(carteLieux, l.lieuId) || t('Lieu #{id}', { id: l.lieuId });
    if (ids.length === 0) return t('Tous les équipements');
    if (ids.length === 1) return nomsEquipements.get(String(ids[0])) || t('Équipement #{id}', { id: ids[0] });
    return t('{n} équipements', { n: ids.length });
  };
  const gammeTexte = (l) => {
    if (l.gammeId == null) return '';
    const g = gammeDe(l.gammeId);
    return g ? libelleGamme(g) : t('Gamme #{id}', { id: l.gammeId });
  };

  const actifs = types.filter((x) => x.actif).length;
  const lignes = vue === 'actifs' ? types.filter((x) => x.actif) : vue === 'desactives' ? types.filter((x) => !x.actif) : types;

  const colonnes = [
    { cle: 'code', label: 'Code', valeur: (l) => l.code || '', rendu: (l) => <code className="emt-code">{l.code}</code> },
    { cle: 'libelle', label: 'Libellé', valeur: (l) => l.libelle || '', rendu: (l) => <strong dir="auto">{l.libelle}</strong> },
    {
      cle: 'intervalleJours', label: 'Intervalle', alignement: 'droite', valeur: (l) => Number(l.intervalleJours) || 0,
      texte: (l) => t('{n} j', { n: nf(Number(l.intervalleJours) || 0) }),
      rendu: (l) => t('{n} j', { n: nf(Number(l.intervalleJours) || 0) }),
    },
    {
      cle: 'seuilAlerteJours', label: 'Pré-alerte', alignement: 'droite', valeur: (l) => (l.seuilAlerteJours ?? -1),
      texte: (l) => (l.seuilAlerteJours != null ? t('{n} j', { n: nf(l.seuilAlerteJours) }) : ''),
      rendu: (l) => (l.seuilAlerteJours != null ? t('{n} j', { n: nf(l.seuilAlerteJours) }) : '—'),
    },
    {
      cle: 'urgenceBon', label: 'Urgence', filtre: 'liste', valeur: (l) => (URGENCES[l.urgenceBon] ? t(URGENCES[l.urgenceBon].label) : ''),
      rendu: (l) => (URGENCES[l.urgenceBon] ? <Badge ton={URGENCES[l.urgenceBon].ton}>{`${l.urgenceBon} · ${t(URGENCES[l.urgenceBon].label)}`}</Badge> : '—'),
    },
    { cle: 'baseRecalcul', label: 'Recalcul', filtre: 'liste', valeur: (l) => t(BASES_RECALCUL[l.baseRecalcul === 1 ? 1 : 0]) },
    { cle: 'portee', label: 'Portée', valeur: (l) => portee(l) },
    { cle: 'gamme', label: 'Gamme', valeur: (l) => gammeTexte(l), rendu: (l) => gammeTexte(l) || '—' },
    {
      cle: 'actif', label: 'État', filtre: 'liste', valeur: (l) => (l.actif ? t('Actif') : t('Désactivé')),
      rendu: (l) => <Badge ton={l.actif ? 'vert' : 'gris'}>{l.actif ? t('Actif') : t('Désactivé')}</Badge>,
    },
  ];

  const champs = useMemo(() => [
    { nom: 'code', label: 'Code', type: 'texte', requis: true, longueurMax: 50, section: 'identification', desactive: Boolean(fenetre.objet), transformer: (v) => String(v ?? '').trim().toUpperCase() },
    { nom: 'libelle', label: 'Libellé', type: 'texte', requis: true, longueurMax: 255, section: 'identification' },
    { nom: 'intervalleJours', label: 'Intervalle', unite: 'jours', type: 'nombre', requis: true, min: 1, section: 'periodicite' },
    { nom: 'seuilAlerteJours', label: "Marge d'alerte", unite: 'jours', type: 'nombre', min: 0, section: 'periodicite' },
    {
      nom: 'urgenceBon', label: 'Urgence du bon', type: 'liste', optionVide: '—', section: 'periodicite',
      options: Object.entries(URGENCES).map(([value, u]) => ({ value, label: `${value} · ${t(u.label)}` })),
    },
    {
      nom: 'baseRecalcul', label: 'Base de recalcul', type: 'liste', requis: true, defaut: '0', section: 'periodicite',
      options: [{ value: '0', label: t("Date réelle de l'intervention") }, { value: '1', label: t('Échéance théorique') }],
    },
    {
      nom: 'gammeId', label: 'Gamme', type: 'liste', optionVide: 'Aucune', largeur: 'pleine', section: 'periodicite',
      options: (() => {
        const actuelle = gammeDe(fenetre.objet?.gammeId);
        const liste = actuelle && !gammesChoix.some((g) => g.id === actuelle.id) ? [actuelle, ...gammesChoix] : gammesChoix;
        return liste.map((g) => ({ value: String(g.id), label: `${libelleGamme(g)} · ${g.libelle}` }));
      })(),
    },
    {
      nom: 'lieuId', label: 'Lieu', type: 'liste', optionVide: 'Tous les lieux', largeur: 'pleine', section: 'cible',
      options: lieuxChoix.map((l) => ({ value: String(l.id), label: `${'\u00A0\u00A0'.repeat(l.niveau)}${l.nom}` })),
    },
    {
      nom: 'lotArticleImmobilistationIds', label: 'Équipements', type: 'personnalise', defaut: [], largeur: 'pleine', section: 'cible',
      rendu: ({ valeur, changer, id }) => (
        <SelectionEquipements id={id} valeurs={Array.isArray(valeur) ? valeur : []} onChange={changer}
          options={equipements} services={services} loading={chargementEquipements} />
      ),
      transformer: (v) => (Array.isArray(v) ? v : []).map(Number),
    },
  ], [fenetre.objet, gammeDe, gammesChoix, lieuxChoix, equipements, services, chargementEquipements]);

  const ouvrir = (tache) => setFenetre({
    ouverte: true,
    objet: tache ? {
      ...tache,
      baseRecalcul: tache.baseRecalcul === 1 ? 1 : 0,
      gammeId: gammeDe(tache.gammeId)?.id ?? tache.gammeId,
      lotArticleImmobilistationIds: idsEquipements(tache).map(String),
    } : null,
  });

  const basculer = async (tache) => {
    setEnCours(true);
    setErreur(null);
    try {
      if (tache.actif) await equipementMaintenanceService.removeType(tache.id);
      else await equipementMaintenanceService.updateType(tache.id, { ...tache, actif: true });
      setSelection(null);
      await charger();
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Échec de la mise à jour.'));
    } finally {
      setEnCours(false);
      setADesactiver(null);
    }
  };

  const desactiverSel = selection?.actif !== false;

  return (
    <PageListe
      titre={t('Maintenance préventive')}
      sansEntete
      classe={integre ? 'emt-page--integree' : undefined}
      finActions={vues}
      filtres={(
        <select value={vue} onChange={(e) => { setVue(e.target.value); setSelection(null); }} aria-label={t('Vue')}>
          <option value="tous">{`${t('Tous')} (${types.length})`}</option>
          <option value="actifs">{`${t('Actifs')} (${actifs})`}</option>
          <option value="desactives">{`${t('Désactivés')} (${types.length - actifs})`}</option>
        </select>
      )}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={selection}
      onSelection={setSelection}
      onAjouter={() => ouvrir(null)}
      libelleAjouter={t('Nouveau type')}
      onModifier={ouvrir}
      actions={[
        {
          label: desactiverSel ? t('Désactiver') : t('Réactiver'), icone: desactiverSel ? Pause : RotateCcw,
          classe: desactiverSel ? 'cl-action--supprimer' : 'cl-action--teal', besoinSelection: true, desactive: enCours,
          onClick: (l) => (l.actif ? setADesactiver(l) : basculer(l)),
        },
        { label: t('Actualiser'), icone: RefreshCw, classe: 'cl-action--gris', desactive: chargement, onClick: charger },
      ]}
      recherchePlaceholder={t('Code, libellé, gamme...')}
      cleStockage="maintenance-preventive-types"
      nomExport="maintenance-preventive-types"
      triInitial={{ cle: 'code', sens: 'asc' }}
      vide={{ aucun: t('Aucun type de maintenance.'), aucunFiltre: t('Aucun élément ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={CalendarClock}
        surtitres={{ creation: t('Maintenance préventive'), modification: t('Maintenance préventive') }}
        titres={{ creation: t('Nouveau type de maintenance'), modification: t('Modifier le type de maintenance') }}
        sections={[
          { cle: 'identification', label: t('Identification') },
          { cle: 'periodicite', label: t('Périodicité') },
          { cle: 'cible', label: t('Équipements ciblés') },
        ]}
        champs={champs}
        objet={fenetre.objet}
        taille="lg"
        onEnregistrer={async (payload) => {
          const corps = { ...payload, actif: fenetre.objet ? fenetre.objet.actif !== false : true };
          if (fenetre.objet) await equipementMaintenanceService.updateType(fenetre.objet.id, corps);
          else await equipementMaintenanceService.createType(corps);
          await charger();
        }}
      />
      <ConfirmModal
        show={Boolean(aDesactiver)}
        onClose={() => setADesactiver(null)}
        onConfirm={() => basculer(aDesactiver)}
        type="danger"
        title={t('Désactiver le type')}
        message={aDesactiver ? t('Désactiver « {nom} » ?', { nom: aDesactiver.libelle || aDesactiver.code }) : ''}
        confirmText={t('Désactiver')}
        cancelText={t('Annuler')}
      />
    </PageListe>
  );
}
