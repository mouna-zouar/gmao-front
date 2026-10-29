import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Eye, User, XCircle } from 'lucide-react';
import { ICONES_MODULES } from '../../../../constants/modules';
import permisConduiteService from '../../../../services/permisConduiteService';
import personnelService from '../../../../services/personnelService';
import PermisConduiteModal from '../../../ui/modals/PermisConduiteModal';
import { PageListe } from '../../../commun';
import { t, locale } from '../../../../i18n';
import { imprimerFiche } from '../../../../utils/imprimerListe';
import PermisCarteDetails from './PermisCarteDetails';
import './PermisConduite.css';

/*
 * Permis de conduire : page liste de la bibliothèque commune.
 * Gardés tels quels : la fenêtre PermisConduiteModal et la fiche du permis (PermisCarteDetails, ouverte au double-clic).
 */

// Référentiel de secours des catégories (au cas où l'appel API échoue avant chargement)
const CATEGORIE_LABELS = { A1: 'A1', A: 'A', B: 'B', B_E: 'B+E', C: 'C', C_E: 'C+E', D: 'D', D_E: 'D+E', F: 'F' };
const POIDS_LOURD = ['C', 'C_E', 'D', 'D_E'];
const categorieLabel = (code) => CATEGORIE_LABELS[code] ?? code;
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const estExpire = (date) => {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return d < aujourdhui;
};
const statutTexte = (p) => (estExpire(p.dateExpiration) ? t('Expiré') : t('Valide'));
const nomPersonne = (p) => (p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : '');

export default function PermisConduite() {
  const [permis, setPermis] = useState([]);
  const [personnels, setPersonnels] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState('all');
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState(false);
  const [fiche, setFiche] = useState(null);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const [page, pers] = await Promise.all([permisConduiteService.getAll(0, 500), personnelService.getAll(0, 500)]);
      const liste = page.content ?? [];
      setPermis(liste);
      setSelection((s) => (s ? liste.find((p) => p.id === s.id) || null : null));
      setFiche((f) => (f ? liste.find((p) => p.id === f.id) || null : null));
      setPersonnels(Object.fromEntries((pers.content ?? []).map((p) => [p.id, p])));
    } catch {
      setErreur(t('Impossible de charger les permis de conduite. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo(() => [
    {
      cle: 'conducteur', label: 'Conducteur', valeur: (p) => nomPersonne(personnels[p.personnelId]),
      texte: (p) => { const x = personnels[p.personnelId]; return [x?.nom, x?.prenom, x?.matricule].filter(Boolean).join(' '); },
      rendu: (p) => { const x = personnels[p.personnelId]; return x ? (
        <div className="pc-cell-driver">
          <div className="pc-cell-driver-avatar"><User size={14} strokeWidth={2.2} /></div>
          <div className="pc-cell-driver-text">
            <span className="pc-cell-main">{nomPersonne(x)}</span>
            {x.matricule && <span className="pc-cell-sub">{x.matricule}</span>}
          </div>
        </div>
      ) : <span className="pc-cell-empty">—</span>; },
    },
    { cle: 'numero', label: 'N° permis', valeur: (p) => p.numero || '', rendu: (p) => <span className="pc-cell-main">{p.numero || '—'}</span> },
    {
      cle: 'categories', label: 'Catégories', recherche: false, valeur: (p) => (p.categories ?? []).map(categorieLabel).join(' '),
      rendu: (p) => (
        <div className="pc-cat-list">
          {(p.categories ?? []).length === 0
            ? <span className="pc-cell-empty">—</span>
            : p.categories.map((c) => <span key={c} className="pc-cat-chip">{categorieLabel(c)}</span>)}
        </div>
      ),
    },
    {
      cle: 'delivrance', label: 'Délivrance', valeur: (p) => (p.dateDelivrance ? new Date(p.dateDelivrance).getTime() : 0),
      texte: (p) => [formatDate(p.dateDelivrance), p.lieuDelivrance].filter(Boolean).join(' '),
      rendu: (p) => <span className="pc-date-badge"><Calendar size={11} strokeWidth={2.5} />{formatDate(p.dateDelivrance)}</span>,
    },
    {
      cle: 'expiration', label: 'Expiration', recherche: false,
      valeur: (p) => (p.dateExpiration ? new Date(p.dateExpiration).getTime() : Number.MAX_SAFE_INTEGER),
      texte: (p) => (p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration')),
      rendu: (p) => <span className="pc-date-badge"><Calendar size={11} strokeWidth={2.5} />{p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration')}</span>,
    },
    {
      cle: 'statut', label: 'Statut', recherche: false, valeur: (p) => (estExpire(p.dateExpiration) ? 1 : 0), texte: statutTexte,
      rendu: (p) => { const exp = estExpire(p.dateExpiration); return (
        <span className={`pc-pill ${exp ? 'expire' : 'valide'}`}>
          {exp ? <XCircle size={11} strokeWidth={2.5} /> : <CheckCircle2 size={11} strokeWidth={2.5} />}{statutTexte(p)}
        </span>
      ); },
    },
  ], [personnels]);

  /* L'export et l'impression gardent les colonnes détaillées de l'écran d'origine */
  const colonnesExport = useMemo(() => [
    { label: 'Conducteur', texte: (p) => nomPersonne(personnels[p.personnelId]) },
    { label: 'Matricule', texte: (p) => personnels[p.personnelId]?.matricule },
    { label: 'Numéro permis', texte: (p) => p.numero },
    { label: 'Catégories', texte: (p) => (p.categories ?? []).map(categorieLabel).join(' / ') },
    { label: 'Date délivrance', texte: (p) => formatDate(p.dateDelivrance) },
    { label: "Date d'expiration", texte: (p) => (p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration')) },
    { label: 'Lieu', texte: (p) => p.lieuDelivrance },
    { label: 'Statut', texte: statutTexte },
  ], [personnels]);

  const lignes = permis.filter((p) => {
    const exp = estExpire(p.dateExpiration);
    return (filtreCategorie === 'all' || (p.categories ?? []).includes(filtreCategorie))
      && (filtreStatut === 'all' || (filtreStatut === 'valide' && !exp) || (filtreStatut === 'expire' && exp));
  });
  const basculer = (v) => setFiltreStatut((f) => (f === v ? 'all' : v));
  const nbExpires = permis.filter((p) => estExpire(p.dateExpiration)).length;
  const nbPoidsLourd = permis.filter((p) => (p.categories ?? []).some((c) => POIDS_LOURD.includes(c))).length;

  /* Impression de la fiche du permis (A4 portrait) */
  const imprimer = (p) => {
    const x = personnels[p.personnelId];
    imprimerFiche({
      titre: x ? nomPersonne(x) : t('Permis de conduire'),
      sousTitre: t('Permis de conduire'),
      reference: p.numero || '',
      statut: statutTexte(p),
      sections: [{
        titre: t('Informations générales'),
        champs: [
          { label: t('Conducteur'), valeur: nomPersonne(x) },
          { label: t('Matricule'), valeur: x?.matricule },
          { label: t('Numéro permis'), valeur: p.numero },
          { label: t('Catégories'), valeur: (p.categories ?? []).map(categorieLabel).join(' · ') },
          { label: t('Date délivrance'), valeur: p.dateDelivrance ? formatDate(p.dateDelivrance) : '' },
          { label: t('Lieu'), valeur: p.lieuDelivrance },
          { label: t("Date d'expiration"), valeur: p.dateExpiration ? formatDate(p.dateExpiration) : t('Sans expiration') },
          { label: t('Statut'), valeur: statutTexte(p) },
        ],
      }],
      signatures: [t('Responsable parc'), t('Conducteur')],
    });
  };

  const fermerFiche = useCallback(() => setFiche(null), []);

  return (
    <PageListe
      icone={ICONES_MODULES.permis}
      titre={t('Permis de conduire')}
      sousTitre={t('Suivi des permis des conducteurs et de leurs catégories (réglementation tunisienne)')}
      stats={[
        { label: t('Total'), valeur: permis.length, actif: filtreStatut === 'all', onClick: () => setFiltreStatut('all') },
        { label: t('Valides'), valeur: permis.length - nbExpires, ton: 'vert', icone: CheckCircle2, actif: filtreStatut === 'valide', onClick: () => basculer('valide') },
        { label: t('Expirés'), valeur: nbExpires, ton: 'rouge', icone: XCircle, alerte: nbExpires > 0, actif: filtreStatut === 'expire', onClick: () => basculer('expire') },
        { label: t('Poids lourd / bus'), valeur: nbPoidsLourd, ton: 'violet' },
      ]}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={selection}
      onSelection={setSelection}
      actions={[{ label: t('Détails'), icone: Eye, classe: 'cl-action--teal', besoinSelection: true, onClick: (p) => setFiche(p) }]}
      filtres={(
        <>
          <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} aria-label={t('Catégorie')}>
            <option value="all">{t('Toutes les catégories')}</option>
            {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label={t('Statut')}>
            <option value="all">{t('Tous les statuts')}</option>
            <option value="valide">{t('Valide')}</option>
            <option value="expire">{t('Expiré')}</option>
          </select>
        </>
      )}
      colonnesExport={colonnesExport}
      filtresImpression={[
        { label: t('Catégorie'), valeur: filtreCategorie !== 'all' ? categorieLabel(filtreCategorie) : '' },
        { label: t('Statut'), valeur: filtreStatut === 'valide' ? t('Valide') : filtreStatut === 'expire' ? t('Expiré') : '' },
      ]}
      onAjouter={() => { setSelection(null); setFenetre(true); }}
      libelleAjouter={t('Nouveau permis')}
      onModifier={(p) => { setSelection(p); setFenetre(true); }}
      onOuvrir={(p) => { setSelection(p); setFiche(p); }}
      onSupprimer={async (p) => { await permisConduiteService.remove(p.id); setSelection(null); await charger(); }}
      messageSuppression={() => t('Supprimer ce permis de conduire ? Cette action est irréversible.')}
      cleStockage="permis-conduite"
      nomExport="permis-conduite"
      vide={{ aucun: t('Aucun permis pour l’instant.'), aucunFiltre: t('Aucun permis ne correspond à ces filtres.') }}
    >
      {fiche && (
        <PermisCarteDetails
          permis={fiche}
          personnel={personnels[fiche.personnelId]}
          expire={estExpire(fiche.dateExpiration)}
          onFermer={fermerFiche}
          onModifier={() => { setSelection(fiche); setFenetre(true); }}
          onImprimer={() => imprimer(fiche)}
        />
      )}
      <PermisConduiteModal
        isOpen={fenetre}
        onClose={() => setFenetre(false)}
        onSave={async (payload) => {
          if (selection) await permisConduiteService.update(selection.id, payload);
          else await permisConduiteService.create(payload);
          await charger();
        }}
        permis={selection}
        isEditing={Boolean(selection)}
      />
    </PageListe>
  );
}
