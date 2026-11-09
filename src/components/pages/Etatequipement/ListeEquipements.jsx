import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CircleCheck, CirclePause, CircleX, Gauge, LoaderCircle, Printer, QrCode, RefreshCw, Settings, Wrench, X,
} from 'lucide-react';
import { PageListe, Badge, Modale } from '../../commun';
import equipementService from '../../../services/equipementService';
import etatEquipementService from '../../../services/Etatequipementservice';
import disponibiliteService from '../../../services/Disponibiliteservice ';
import risqueService from '../../../services/Risqueservice';
import { CRITICITE_OPTIONS, CRITICITE_DEFAUT, CRITICITE_LABELS, criticiteHex } from '../../../constants/Criticite';
import ScannerQR from '../Equipements/ScannerQR';
import { imprimerEtiquettes } from '../Equipements/qrEtiquettes';
import EquipementMaintenanceTypesSettings from './EquipementMaintenanceTypesSettings';
import { t, tp, locale } from '../../../i18n';
import './ListeEquipements.css';

/*
 * Liste des équipements : même présentation que les autres listes (PageListe) —
 * colonnes triables, recherche dans chaque colonne, barre d'actions, export et impression.
 * Double-clic sur une ligne : fiche de l'équipement.
 */

const ETATS = {
  EN_SERVICE: { label: 'En service', ton: 'vert', icone: CircleCheck },
  EN_PANNE: { label: 'En panne', ton: 'rouge', icone: CircleX },
  EN_REPARATION: { label: 'En réparation', ton: 'bleu', icone: Wrench },
  HORS_SERVICE: { label: 'Hors service', ton: 'orange', icone: CirclePause },
};
const RISQUES = {
  CRITIQUE: { label: 'Critique', ton: 'rouge' },
  ELEVE: { label: 'Élevé', ton: 'orange' },
  MODERE: { label: 'Modéré', ton: 'ambre' },
  FAIBLE: { label: 'Faible', ton: 'vert' },
};
const dispoTon = (v) => (v == null ? 'gris' : v >= 95 ? 'vert' : v >= 80 ? 'ambre' : 'rouge');
const joursDepuis = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null;
};
const parId = (liste) => Object.fromEntries((liste ?? []).map((x) => [x.lotArticleImmobilistationId, x]));

export default function ListeEquipements() {
  const navigate = useNavigate();
  const [etats, setEtats] = useState([]);
  const [dispos, setDispos] = useState({});
  const [risques, setRisques] = useState({});
  const [connexions, setConnexions] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [recalcul, setRecalcul] = useState(false);
  const [filtreEtat, setFiltreEtat] = useState('TOUS');
  const [filtreFamille, setFiltreFamille] = useState('');
  const [filtreIp, setFiltreIp] = useState('TOUS');
  const [etiquettes, setEtiquettes] = useState(() => new Map());
  const [impression, setImpression] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [preventifs, setPreventifs] = useState(false);
  const [enregistrement, setEnregistrement] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setEtats((await etatEquipementService.getAll()) ?? []);
    } catch (err) {
      console.error('[GMAO équipements] Chargement des états :', err);
      setErreur(t('Impossible de charger les états.'));
    } finally {
      setChargement(false);
    }
    // Indicateurs complémentaires : une erreur n'empêche pas la liste de s'afficher
    disponibiliteService.getAll().then((d) => setDispos(parId(d))).catch((e) => console.error('[GMAO équipements] Disponibilité :', e));
    risqueService.getRisques(1000).then((d) => setRisques(parId(d))).catch((e) => console.error('[GMAO équipements] Risques :', e));
    equipementService.listeConnexions().then((d) => setConnexions(parId(d))).catch((e) => console.error('[GMAO équipements] Adresses IP :', e));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const recalculerTout = async () => {
    setRecalcul(true);
    setMessage(null);
    try {
      await etatEquipementService.recalculerTout();
      setMessage({ ton: 'ok', texte: t("États recalculés à partir de l'historique des bons de maintenance.") });
      await charger();
    } catch (err) {
      console.error('[GMAO équipements] Recalcul :', err);
      setMessage({ ton: 'erreur', texte: t('Échec du recalcul. Réessaie plus tard.') });
    } finally {
      setRecalcul(false);
    }
  };

  const changerCriticite = async (id, criticite) => {
    setEnregistrement(id);
    try {
      const maj = await etatEquipementService.definirCriticite(id, criticite);
      setEtats((p) => (p.some((e) => e.lotArticleImmobilistationId === id)
        ? p.map((e) => (e.lotArticleImmobilistationId === id ? maj : e)) : [...p, maj]));
    } catch (err) {
      console.error('[GMAO équipements] Criticité :', err);
      setMessage({ ton: 'erreur', texte: t("Échec de l'enregistrement de la criticité. Réessaie plus tard.") });
    } finally {
      setEnregistrement(null);
    }
  };

  const basculerEtiquette = (e) => setEtiquettes((s) => {
    const n = new Map(s);
    if (n.has(e.lotArticleImmobilistationId)) n.delete(e.lotArticleImmobilistationId);
    else n.set(e.lotArticleImmobilistationId, e.cibleNom);
    return n;
  });

  const imprimer = async () => {
    setImpression(true);
    try {
      const lignes = await Promise.all([...etiquettes.entries()].map(async ([id, nom]) => {
        try {
          const f = await equipementService.getFiche(id);
          const i = f?.identite || {};
          return { id, designation: i.designation || nom, marque: i.marque, modele: i.modele, numPiece: i.numPiece, codeBarre: i.codeBarre };
        } catch {
          return { id, designation: nom };
        }
      }));
      await imprimerEtiquettes(lignes);
    } finally {
      setImpression(false);
    }
  };

  /* Un seul état par équipement, le plus récent */
  const uniques = useMemo(() => {
    const m = new Map();
    etats.forEach((e) => {
      const d = m.get(e.lotArticleImmobilistationId);
      if (!d || String(e.derniereMiseAJour || '') > String(d.derniereMiseAJour || '')) m.set(e.lotArticleImmobilistationId, e);
    });
    return [...m.values()];
  }, [etats]);

  const familles = useMemo(() => {
    const m = new Map();
    uniques.forEach((e) => {
      const cle = e.familleId == null ? 'AUCUNE' : String(e.familleId);
      const f = m.get(cle) || { cle, nom: e.familleId == null ? t('Sans famille') : (e.familleNom || t('Famille #{id}', { id: cle })), n: 0 };
      f.n += 1;
      m.set(cle, f);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [uniques]);

  const aIp = (e) => !!connexions[e.lotArticleImmobilistationId];
  const horsLigne = (e) => !!connexions[e.lotArticleImmobilistationId]?.horsLigneDepuis;
  const nbIp = uniques.filter(aIp).length;
  const nbHorsLigne = uniques.filter(horsLigne).length;

  const lignes = uniques
    .filter((e) => filtreEtat === 'TOUS' || e.etatActuel === filtreEtat)
    .filter((e) => !filtreFamille || (filtreFamille === 'AUCUNE' ? e.familleId == null : String(e.familleId) === filtreFamille))
    .filter((e) => filtreIp === 'TOUS' || (filtreIp === 'AVEC' && aIp(e)) || (filtreIp === 'SANS' && !aIp(e)) || (filtreIp === 'HORS_LIGNE' && horsLigne(e)));

  const compte = (cle) => uniques.filter((e) => e.etatActuel === cle).length;
  const total = uniques.length;

  const colonnes = useMemo(() => [
    {
      cle: 'etiquette', label: 'Étiquette', triable: false, recherche: false, largeur: 64,
      valeur: (e) => (etiquettes.has(e.lotArticleImmobilistationId) ? t('Oui') : ''),
      rendu: (e) => (
        <label className="leq-case" onClick={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => ev.stopPropagation()}>
          <input type="checkbox" checked={etiquettes.has(e.lotArticleImmobilistationId)} onChange={() => basculerEtiquette(e)}
            aria-label={t('Ajouter {nom} aux étiquettes', { nom: e.cibleNom || `#${e.lotArticleImmobilistationId}` })} />
        </label>
      ),
    },
    {
      cle: 'nom', label: 'Équipement', filtre: 'texte', valeur: (e) => e.cibleNom || `#${e.lotArticleImmobilistationId}`,
      rendu: (e) => <span className="leq-nom">{e.cibleNom || '—'}<small>#{e.lotArticleImmobilistationId}</small></span>,
    },
    {
      cle: 'etat', label: 'État', filtre: 'liste', valeur: (e) => t(ETATS[e.etatActuel]?.label || e.etatActuel || ''),
      rendu: (e) => {
        const d = ETATS[e.etatActuel];
        if (!d) return <span className="cl-tiret">—</span>;
        const I = d.icone;
        return <Badge ton={d.ton}><I size={12} aria-hidden="true" />{t(d.label)}</Badge>;
      },
    },
    {
      cle: 'depuis', label: 'Depuis', valeur: (e) => joursDepuis(e.depuisLe), texte: (e) => (joursDepuis(e.depuisLe) == null ? '' : t('{n} j', { n: joursDepuis(e.depuisLe) })),
      rendu: (e) => (joursDepuis(e.depuisLe) == null ? <span className="cl-tiret">—</span> : <span className="leq-doux">{t('{n} j', { n: joursDepuis(e.depuisLe) })}</span>),
    },
    {
      cle: 'famille', label: 'Famille', filtre: 'liste', valeur: (e) => e.familleNom || '',
      rendu: (e) => (e.familleNom ? <Badge ton="gris">{e.familleNom}</Badge> : <span className="cl-tiret">—</span>),
    },
    {
      cle: 'dispo', label: 'Disponibilité', valeur: (e) => dispos[e.lotArticleImmobilistationId]?.tauxDisponibilitePct ?? null,
      texte: (e) => { const v = dispos[e.lotArticleImmobilistationId]?.tauxDisponibilitePct; return v == null ? '' : `${v.toFixed(1)} %`; },
      rendu: (e) => {
        const v = dispos[e.lotArticleImmobilistationId]?.tauxDisponibilitePct;
        if (v == null) return <span className="cl-tiret">—</span>;
        return (
          <span className={`leq-dispo leq-ton--${dispoTon(v)}`} title={t('Taux de disponibilité sur les 12 derniers mois')}>
            <b>{v.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</b>
            <span className="leq-jauge"><span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>
          </span>
        );
      },
    },
    {
      cle: 'risque', label: 'Risque', valeur: (e) => risques[e.lotArticleImmobilistationId]?.scoreRisque ?? null,
      texte: (e) => { const r = risques[e.lotArticleImmobilistationId]; return r ? `${r.scoreRisque} · ${t(RISQUES[r.niveauRisque]?.label || r.niveauRisque)}` : ''; },
      rendu: (e) => {
        const r = risques[e.lotArticleImmobilistationId];
        if (!r) return <span className="cl-tiret">—</span>;
        const d = RISQUES[r.niveauRisque] || { label: r.niveauRisque, ton: 'gris' };
        return <Badge ton={d.ton}><b>{r.scoreRisque}</b> · {t(d.label)}</Badge>;
      },
    },
    {
      cle: 'criticite', label: 'Criticité', filtre: 'liste', valeur: (e) => t(CRITICITE_LABELS[e.criticite || CRITICITE_DEFAUT]),
      rendu: (e) => {
        const id = e.lotArticleImmobilistationId;
        return (
          <span className="leq-criticite" onClick={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => ev.stopPropagation()}>
            <span className="leq-criticite__point" style={{ background: criticiteHex(e.criticite) }} aria-hidden="true" />
            <select value={e.criticite || CRITICITE_DEFAUT} disabled={enregistrement === id} onChange={(ev) => changerCriticite(id, ev.target.value)}
              aria-label={t('Criticité de {nom}', { nom: e.cibleNom || `#${id}` })}>
              {CRITICITE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </span>
        );
      },
    },
    {
      cle: 'bon', label: 'Dernier bon', filtre: 'texte', visible: false, valeur: (e) => e.bonMaintenanceReferenceNum || '',
    },
  ], [etiquettes, connexions, dispos, risques, enregistrement]); // eslint-disable-line react-hooks/exhaustive-deps

  const basculerEtat = (cle) => setFiltreEtat((v) => (v === cle ? 'TOUS' : cle));

  return (
    <PageListe
      classe="leq-page"
      icone={Gauge}
      titre={t('Équipements')}
      stats={[
        { label: t('Tous les équipements'), valeur: total.toLocaleString(locale()), icone: Gauge, actif: filtreEtat === 'TOUS', onClick: () => setFiltreEtat('TOUS') },
        ...Object.entries(ETATS).map(([cle, d]) => ({
          label: t(d.label), valeur: compte(cle).toLocaleString(locale()), ton: d.ton, icone: d.icone,
          actif: filtreEtat === cle, onClick: () => basculerEtat(cle),
        })),
      ]}
      colonnes={colonnes}
      lignes={lignes}
      cleLigne="lotArticleImmobilistationId"
      chargement={chargement}
      erreur={erreur}
      onOuvrir={(e) => navigate(`/equipement/${e.lotArticleImmobilistationId}`)}
      actions={[
        { label: t('Fiche'), icone: ArrowRight, classe: 'cl-action--principal', besoinSelection: true, onClick: (e) => navigate(`/equipement/${e.lotArticleImmobilistationId}`) },
        { label: t('Scanner un QR code'), icone: QrCode, classe: 'cl-action--teal', onClick: () => setScanner(true) },
        {
          label: etiquettes.size ? tp('étiquette à imprimer', etiquettes.size) : t('Imprimer les étiquettes'),
          icone: impression ? LoaderCircle : Printer, classe: 'cl-action--bleu', desactive: !etiquettes.size || impression,
          aide: etiquettes.size ? undefined : t('Cochez des équipements dans la colonne « Étiquette »'), onClick: imprimer,
        },
        ...(etiquettes.size ? [{ label: t('Vider les étiquettes'), icone: X, classe: 'cl-action--gris', onClick: () => setEtiquettes(new Map()) }] : []),
        { label: t('Paramètres préventifs'), icone: Settings, classe: 'cl-action--violet', onClick: () => setPreventifs(true) },
        { label: recalcul ? t('Recalcul en cours') : t('Recalculer tout'), icone: recalcul ? LoaderCircle : RefreshCw, classe: 'cl-action--orange', desactive: recalcul, onClick: recalculerTout },
      ]}
      filtres={(
        <>
          <select value={filtreFamille} onChange={(ev) => setFiltreFamille(ev.target.value)} aria-label={t('Filtrer par famille')}>
            <option value="">{t('Toutes les familles')} ({total})</option>
            {familles.map((f) => <option key={f.cle} value={f.cle}>{f.nom} ({f.n})</option>)}
          </select>
          <select value={filtreIp} onChange={(ev) => setFiltreIp(ev.target.value)} aria-label={t('Filtrer par adresse IP')}>
            <option value="TOUS">{t('Adresse IP : toutes')}</option>
            <option value="AVEC">{t('Avec adresse IP')} ({nbIp})</option>
            <option value="SANS">{t('Sans adresse IP')} ({total - nbIp})</option>
            {(nbHorsLigne > 0 || filtreIp === 'HORS_LIGNE') && <option value="HORS_LIGNE">{t('Hors ligne')} ({nbHorsLigne})</option>}
          </select>
        </>
      )}
      avantTableau={message && (
        <p className={`leq-message leq-message--${message.ton}`} role="status">
          {message.texte}
          <button type="button" onClick={() => setMessage(null)} aria-label={t('Fermer')}><X size={14} /></button>
        </p>
      )}
      recherchePlaceholder={t('Rechercher un équipement...')}
      cleStockage="equipements"
      nomExport="equipements"
      triInitial={{ cle: 'nom', sens: 'asc' }}
      filtresImpression={[
        { label: t('État'), valeur: filtreEtat === 'TOUS' ? '' : t(ETATS[filtreEtat].label) },
        { label: t('Famille'), valeur: familles.find((f) => f.cle === filtreFamille)?.nom || '' },
      ]}
      vide={{
        aucun: t("Aucun état calculé pour le moment — clique sur \"Recalculer tout\" pour initialiser."),
        aucunFiltre: t('Aucun équipement ne correspond à ce filtre.'),
      }}
    >
      {scanner && <ScannerQR onClose={() => setScanner(false)} />}
      <Modale ouvert={preventifs} onFermer={() => setPreventifs(false)} icone={Settings} titre={t('Paramètres préventifs')} taille="xl">
        {preventifs && <EquipementMaintenanceTypesSettings />}
      </Modale>
    </PageListe>
  );
}
