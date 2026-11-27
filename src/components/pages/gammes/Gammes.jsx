import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, ArrowDown, ArrowUp, CheckCircle2, Copy, GitBranchPlus, Loader2, Plus, Trash2, X,
} from 'lucide-react';
import gammeService from '../../../services/gammeService';
import equipementService from '../../../services/equipementService';
import { obtenirArticles } from '../../../store/referentiels';
import { ICONES_MODULES } from '../../../constants/modules';
import { Badge, Modale, PageListe } from '../../commun';
import ListeRecherche from '../../commun/ListeRecherche';
import ConfirmModal from '../../ui/modals/ConfirmModal';
import { t } from '../../../i18n';
import './Gammes.css';

export const TYPES_GAMME = { PREVENTIF: 'Préventive', CURATIF: 'Curative', REGLEMENTAIRE: 'Contrôle réglementaire' };
export const STATUTS_GAMME = {
  BROUILLON: { label: 'Brouillon', ton: 'ambre' },
  VALIDEE: { label: 'Validée', ton: 'vert' },
  ARCHIVEE: { label: 'Archivée', ton: 'gris' },
};

export const dureeLisible = (minutes) => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
};

export const cibleGamme = (g) => {
  const modele = [g.marque, g.modele].filter(Boolean).join(' ');
  if (modele) return modele;
  if (g.familleId != null) return g.familleNom || t('Famille #{id}', { id: g.familleId });
  return t('Tous les équipements');
};

const etapeVide = () => ({ cle: Math.random().toString(36).slice(2), designation: '', precision: '', dureeMinutes: '', prestataireArticlesId: '', qte: '' });

const versFormulaire = (g) => ({
  id: g?.id ?? null,
  statut: g?.statut ?? 'BROUILLON',
  code: g?.code ?? '',
  libelle: g?.libelle ?? '',
  type: g?.type ?? 'PREVENTIF',
  familleId: g?.familleId != null ? String(g.familleId) : '',
  marque: g?.marque ?? '',
  modele: g?.modele ?? '',
  etapes: (g?.etapes?.length ? g.etapes : [{}]).map((e) => ({
    ...etapeVide(),
    designation: e.designation ?? '',
    precision: e.precision ?? '',
    dureeMinutes: e.dureeMinutes != null ? String(e.dureeMinutes) : '',
    prestataireArticlesId: e.prestataireArticlesId != null ? String(e.prestataireArticlesId) : '',
    qte: e.qte != null ? String(e.qte) : '',
  })),
  outillage: g?.outillage ?? [],
});

function EditeurGamme({ ouvert, gamme, familles, articles, onFermer, onEnregistre }) {
  const [form, setForm] = useState(() => versFormulaire(gamme));
  const [outil, setOutil] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => { if (ouvert) { setForm(versFormulaire(gamme)); setErreur(''); setOutil(''); } }, [ouvert, gamme]);

  const lecture = form.statut !== 'BROUILLON';
  const maj = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const majEtape = (i, k, v) => setForm((f) => ({ ...f, etapes: f.etapes.map((e, j) => (j === i ? { ...e, [k]: v } : e)) }));
  const deplacer = (i, sens) => setForm((f) => {
    const l = [...f.etapes];
    const j = i + sens;
    if (j < 0 || j >= l.length) return f;
    [l[i], l[j]] = [l[j], l[i]];
    return { ...f, etapes: l };
  });
  const ajouterOutil = () => {
    const v = outil.trim();
    if (!v) return;
    setForm((f) => (f.outillage.includes(v) ? f : { ...f, outillage: [...f.outillage, v] }));
    setOutil('');
  };
  const duree = form.etapes.reduce((s, e) => s + (Number(e.dureeMinutes) || 0), 0);

  const enregistrer = async (puisValider = false) => {
    setErreur('');
    if (!form.code.trim() || !form.libelle.trim()) { setErreur(t('Le code et le libellé sont obligatoires.')); return; }
    const famille = familles.find((x) => String(x.id) === String(form.familleId));
    const corps = {
      code: form.code, libelle: form.libelle, type: form.type,
      familleId: form.familleId === '' ? null : Number(form.familleId), familleNom: famille?.nom ?? null,
      marque: form.marque, modele: form.modele,
      etapes: form.etapes.filter((e) => e.designation.trim()).map((e) => ({
        designation: e.designation, precision: e.precision,
        dureeMinutes: e.dureeMinutes === '' ? null : Number(e.dureeMinutes),
        prestataireArticlesId: e.prestataireArticlesId === '' ? null : Number(e.prestataireArticlesId),
        qte: e.prestataireArticlesId === '' ? null : (e.qte === '' ? 1 : Number(String(e.qte).replace(',', '.'))),
      })),
      outillage: form.outillage,
    };
    setEnvoi(true);
    try {
      let g = form.id ? await gammeService.modifier(form.id, corps) : await gammeService.creer(corps);
      if (puisValider) g = await gammeService.action(g.id, 'valider');
      onEnregistre(g);
    } catch (err) {
      setErreur(err?.response?.data?.message || t("L'enregistrement a échoué."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} icone={ICONES_MODULES.gammes} taille="xl"
      titre={form.id ? (lecture ? t('Gamme {code}', { code: form.code }) : t('Modifier la gamme')) : t('Nouvelle gamme')}
      sousTitre={form.id ? `v${gamme?.version ?? 1} · ${t(STATUTS_GAMME[form.statut]?.label || form.statut)}` : undefined}
      pied={lecture ? (
        <button type="button" className="cm-btn" onClick={onFermer}>{t('Fermer')}</button>
      ) : (<>
        <span className="gam-pied-duree">{t('Durée totale')} : <strong>{dureeLisible(duree)}</strong></span>
        <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
        <button type="button" className="cm-btn" disabled={envoi} onClick={() => enregistrer(false)}>{t('Enregistrer le brouillon')}</button>
        <button type="button" className="cm-btn cm-btn--principal" disabled={envoi} onClick={() => enregistrer(true)}>
          {envoi ? <Loader2 size={14} className="gam-tourne" /> : <CheckCircle2 size={15} />} {t('Enregistrer et valider')}
        </button>
      </>)}>
      {erreur && <p className="gam-erreur" role="alert">{erreur}</p>}
      <fieldset className="gam-form" disabled={lecture}>
        <section className="gam-bloc">
          <h3>{t('Identité et cible')}</h3>
          <div className="gam-grille">
            <label><span>{t('Code')} *</span><input value={form.code} onChange={maj('code')} maxLength={40} /></label>
            <label className="gam-large"><span>{t('Libellé')} *</span><input value={form.libelle} onChange={maj('libelle')} /></label>
            <label><span>{t('Type')}</span>
              <select value={form.type} onChange={maj('type')}>
                {Object.entries(TYPES_GAMME).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
            </label>
            <label><span>{t('Famille')}</span>
              <select value={form.familleId} onChange={maj('familleId')}>
                <option value="">{t('Toutes les familles')}</option>
                {familles.map((f) => <option key={f.id} value={String(f.id)}>{f.nom || `#${f.id}`}</option>)}
              </select>
            </label>
            <label><span>{t('Marque')}</span><input value={form.marque} onChange={maj('marque')} /></label>
            <label><span>{t('Modèle')}</span><input value={form.modele} onChange={maj('modele')} /></label>
          </div>
        </section>

        <section className="gam-bloc">
          <h3>{t('Étapes')} <span className="gam-n">{form.etapes.filter((e) => e.designation.trim()).length}</span></h3>
          <table className="gam-etapes">
            <thead>
              <tr>
                <th className="gam-col-n">#</th>
                <th>{t('Désignation')} *</th>
                <th>{t('Précision')}</th>
                <th className="gam-col-duree">{t('Durée (min)')}</th>
                <th className="gam-col-piece">{t('Pièce')}</th>
                <th className="gam-col-qte">{t('Qté')}</th>
                {!lecture && <th className="gam-col-act" aria-label={t('Actions')} />}
              </tr>
            </thead>
            <tbody>
              {form.etapes.map((e, i) => (
                <tr key={e.cle}>
                  <td className="gam-col-n">{i + 1}</td>
                  <td><input value={e.designation} onChange={(ev) => majEtape(i, 'designation', ev.target.value)} aria-label={t('Désignation')} /></td>
                  <td><input value={e.precision} onChange={(ev) => majEtape(i, 'precision', ev.target.value)} aria-label={t('Précision')} /></td>
                  <td><input type="number" min="0" value={e.dureeMinutes} onChange={(ev) => majEtape(i, 'dureeMinutes', ev.target.value)} aria-label={t('Durée (min)')} /></td>
                  <td>
                    <ListeRecherche value={e.prestataireArticlesId} options={articles} disabled={lecture}
                      onChange={(ev) => majEtape(i, 'prestataireArticlesId', ev.target.value ?? '')}
                      getValue={(a) => a.id} getLabel={(a) => a.designation || a.libelle || `#${a.id}`}
                      allowEmpty emptyOptionLabel={t('— Aucune —')} placeholder={t('Rechercher une pièce…')} emptyMessage={t('Aucun résultat')} />
                  </td>
                  <td><input type="number" min="0" step="any" value={e.qte} disabled={lecture || !e.prestataireArticlesId}
                    onChange={(ev) => majEtape(i, 'qte', ev.target.value)} aria-label={t('Qté')} placeholder={e.prestataireArticlesId ? '1' : ''} /></td>
                  {!lecture && (
                    <td className="gam-col-act">
                      <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label={t('Monter')}><ArrowUp size={14} /></button>
                      <button type="button" onClick={() => deplacer(i, 1)} disabled={i === form.etapes.length - 1} aria-label={t('Descendre')}><ArrowDown size={14} /></button>
                      <button type="button" className="is-danger" onClick={() => setForm((f) => ({ ...f, etapes: f.etapes.length > 1 ? f.etapes.filter((_, j) => j !== i) : [etapeVide()] }))}
                        aria-label={t('Retirer')}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!lecture && (
            <button type="button" className="gam-ajout" onClick={() => setForm((f) => ({ ...f, etapes: [...f.etapes, etapeVide()] }))}>
              <Plus size={15} /> {t('Ajouter une étape')}
            </button>
          )}
        </section>

        <section className="gam-bloc">
          <h3>{t('Outillage')}</h3>
          <div className="gam-outils">
            {form.outillage.map((o) => (
              <span key={o} className="gam-outil">{o}
                {!lecture && <button type="button" onClick={() => setForm((f) => ({ ...f, outillage: f.outillage.filter((x) => x !== o) }))} aria-label={t('Retirer')}><X size={12} /></button>}
              </span>
            ))}
            {!lecture && (
              <input value={outil} onChange={(e) => setOutil(e.target.value)} placeholder={t('Ajouter un outil…')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterOutil(); } }} onBlur={ajouterOutil} />
            )}
            {lecture && !form.outillage.length && <span className="gam-vide">—</span>}
          </div>
        </section>
      </fieldset>
    </Modale>
  );
}

export default function Gammes() {
  const [gammes, setGammes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [familles, setFamilles] = useState([]);
  const [articles, setArticles] = useState([]);
  const [editeur, setEditeur] = useState({ ouvert: false, gamme: null });
  const [filtreStatut, setFiltreStatut] = useState('ACTIVES');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setGammes(await gammeService.lister());
    } catch {
      setErreur(t('Impossible de charger les gammes. Vérifie que le serveur est bien lancé.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    equipementService.familles().then(setFamilles).catch(() => setFamilles([]));
    obtenirArticles().then((l) => setArticles(Array.isArray(l) ? l : (l?.content ?? []))).catch(() => setArticles([]));
  }, []);

  const action = async (g, a, texte) => {
    setMessage(null);
    try {
      const r = await gammeService.action(g.id, a);
      await charger();
      setMessage({ ok: true, texte });
      if (a === 'nouvelle-version' || a === 'dupliquer') setEditeur({ ouvert: true, gamme: r });
      return true;
    } catch (err) {
      setMessage({ ok: false, texte: err?.response?.data?.message || t("L'action n'a pas pu être enregistrée.") });
      return false;
    }
  };

  // Confirmation avant « Nouvelle version », « Dupliquer » et « Archiver »
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationEnCours, setConfirmationEnCours] = useState(false);
  const demander = (g, a) => {
    const nom = `${g.code}${g.libelle ? ` · ${g.libelle}` : ''}`;
    const defs = {
      'nouvelle-version': {
        type: 'info', titre: t('Créer une nouvelle version ?'), bouton: t('Créer la version'), succes: t('Nouvelle version créée.'),
        texte: t('Une version v{v} de « {nom} » sera créée en brouillon, à partir de la version actuelle. La version v{actuelle} reste utilisée tant que la nouvelle n’est pas validée.', { v: (Number(g.version) || 1) + 1, actuelle: g.version ?? 1, nom }),
      },
      dupliquer: {
        type: 'info', titre: t('Dupliquer la gamme ?'), bouton: t('Dupliquer'), succes: t('Gamme dupliquée.'),
        texte: t('Une copie de « {nom} » sera créée en brouillon, avec ses étapes. Vous pourrez la modifier ensuite.', { nom }),
      },
      archiver: {
        type: 'warning', titre: t('Archiver la gamme ?'), bouton: t('Archiver'), succes: t('Gamme archivée.'),
        texte: t('« {nom} » ne sera plus proposée pour les nouveaux bons et plans préventifs. Elle reste visible avec le filtre « Archivées ».', { nom }),
      },
    };
    setConfirmation({ g, a, ...defs[a] });
  };
  const confirmer = async () => {
    if (!confirmation) return;
    setConfirmationEnCours(true);
    await action(confirmation.g, confirmation.a, confirmation.succes);
    setConfirmationEnCours(false);
    setConfirmation(null);
  };

  const lignes = useMemo(() => gammes.filter((g) => filtreStatut === 'TOUTES'
    || (filtreStatut === 'ACTIVES' ? g.statut !== 'ARCHIVEE' : g.statut === filtreStatut)), [gammes, filtreStatut]);

  const colonnes = [
    { cle: 'code', label: 'Code', valeur: (g) => g.code, rendu: (g) => <strong className="gam-code">{g.code}</strong> },
    { cle: 'libelle', label: 'Libellé', valeur: (g) => g.libelle },
    { cle: 'type', label: 'Type', filtre: 'liste', valeur: (g) => t(TYPES_GAMME[g.type] || g.type || '') },
    { cle: 'cible', label: 'Cible', valeur: (g) => cibleGamme(g) },
    { cle: 'etapes', label: 'Étapes', valeur: (g) => g.etapes?.length ?? 0 },
    { cle: 'duree', label: 'Durée', valeur: (g) => g.dureeTotaleMinutes, texte: (g) => dureeLisible(g.dureeTotaleMinutes), rendu: (g) => dureeLisible(g.dureeTotaleMinutes) },
    { cle: 'version', label: 'Version', valeur: (g) => g.version, rendu: (g) => `v${g.version}` },
    {
      cle: 'statut', label: 'Statut', filtre: 'liste', valeur: (g) => t(STATUTS_GAMME[g.statut]?.label || g.statut),
      rendu: (g) => <Badge ton={STATUTS_GAMME[g.statut]?.ton || 'gris'}>{t(STATUTS_GAMME[g.statut]?.label || g.statut)}</Badge>,
    },
  ];

  return (
    <PageListe
      titre={t('Gammes d’intervention')}
      sansEntete
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      onAjouter={() => setEditeur({ ouvert: true, gamme: null })}
      libelleAjouter={t('Nouvelle gamme')}
      onModifier={(g) => setEditeur({ ouvert: true, gamme: g })}
      onSupprimer={async (g) => {
        try { await gammeService.supprimer(g.id); await charger(); } catch (err) {
          setMessage({ ok: false, texte: err?.response?.data?.message || t('Suppression impossible.') });
        }
      }}
      messageSuppression={(g) => t('Supprimer le brouillon « {code} » ?', { code: g.code })}
      actions={[
        { label: t('Valider'), icone: CheckCircle2, classe: 'cl-action--teal', besoinSelection: true, onClick: (g) => action(g, 'valider', t('Gamme validée.')) },
        { label: t('Nouvelle version'), icone: GitBranchPlus, classe: 'cl-action--bleu', besoinSelection: true, onClick: (g) => demander(g, 'nouvelle-version') },
        { label: t('Dupliquer'), icone: Copy, classe: 'cl-action--violet', besoinSelection: true, onClick: (g) => demander(g, 'dupliquer') },
        { label: t('Archiver'), icone: Archive, classe: 'cl-action--gris', besoinSelection: true, onClick: (g) => demander(g, 'archiver') },
      ]}
      filtres={(
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label={t('Filtrer par statut')}>
          <option value="ACTIVES">{t('Brouillons et validées')}</option>
          <option value="VALIDEE">{t('Validées')}</option>
          <option value="BROUILLON">{t('Brouillons')}</option>
          <option value="ARCHIVEE">{t('Archivées')}</option>
          <option value="TOUTES">{t('Toutes')}</option>
        </select>
      )}
      avantTableau={message && <p className={`gam-message ${message.ok ? 'is-ok' : 'is-ko'}`} role="status">{message.texte}</p>}
      recherchePlaceholder={t('Rechercher une gamme...')}
      cleStockage="gammes"
      nomExport="gammes-intervention"
      vide={{ aucun: t('Aucune gamme pour l’instant.'), aucunFiltre: t('Aucune gamme ne correspond à ces filtres.') }}
    >
      <EditeurGamme ouvert={editeur.ouvert} gamme={editeur.gamme} familles={familles} articles={articles}
        onFermer={() => setEditeur((e) => ({ ...e, ouvert: false }))}
        onEnregistre={async () => { setEditeur((e) => ({ ...e, ouvert: false })); await charger(); setMessage({ ok: true, texte: t('Gamme enregistrée.') }); }} />
      <ConfirmModal
        show={Boolean(confirmation)}
        type={confirmation?.type}
        title={confirmation?.titre}
        message={confirmation?.texte}
        confirmText={confirmation?.bouton}
        cancelText={t('Annuler')}
        confirming={confirmationEnCours}
        onConfirm={confirmer}
        onClose={() => { if (!confirmationEnCours) setConfirmation(null); }}
      />
    </PageListe>
  );
}
