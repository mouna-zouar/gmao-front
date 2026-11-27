import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react';
import metrologieService from '../../../services/metrologieService';
import equipementService from '../../../services/equipementService';
import { Badge, ModaleFormulaire, PageListe } from '../../commun';
import { ICONES_MODULES } from '../../../constants/modules';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { t, locale } from '../../../i18n';
import './Metrologie.css';
import { lireRequete } from '../../../store/referentiels';

export const TYPES_CONTROLE = {
  ETALONNAGE: 'Étalonnage', VERIFICATION: 'Vérification', CONTROLE_QUALITE: 'Contrôle qualité', SECURITE_ELECTRIQUE: 'Sécurité électrique',
};
export const RESULTATS = {
  CONFORME: { label: 'Conforme', ton: 'vert' },
  CONFORME_RESERVE: { label: 'Conforme avec réserve', ton: 'ambre' },
  NON_CONFORME: { label: 'Non conforme', ton: 'rouge' },
};
const STATUTS = {
  NON_CONFORME: { label: 'Non conforme', ton: 'rouge' },
  EN_RETARD: { label: 'En retard', ton: 'rouge' },
  A_PREVOIR: { label: 'À prévoir', ton: 'ambre' },
  A_JOUR: { label: 'À jour', ton: 'vert' },
  SANS_ECHEANCE: { label: 'Sans échéance', ton: 'gris' },
};

const dateFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const lireMesures = (v) => {
  if (Array.isArray(v)) return v;
  try { const l = JSON.parse(v || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
};
const nombre = (v) => (v === '' || v == null || Number.isNaN(Number(String(v).replace(',', '.'))) ? null : Number(String(v).replace(',', '.')));
const ecartPoint = (m) => {
  const n = nombre(m.nominale);
  const v = nombre(m.mesuree);
  const tol = nombre(m.tolerance);
  if (n == null || v == null) return null;
  const ecart = v - n;
  return { ecart, conforme: tol == null ? null : Math.abs(ecart) <= Math.abs(tol) };
};
const fmt = (v) => (v == null ? '' : Number(v).toLocaleString(locale(), { maximumFractionDigits: 3 }));

function SaisieMesures({ valeur, changer }) {
  const lignes = lireMesures(valeur);
  const maj = (i, champ, v) => changer(lignes.map((l, j) => (j === i ? { ...l, [champ]: v } : l)));
  return (
    <div className="mtr-mesures">
      {lignes.length > 0 && (
        <table>
          <thead>
            <tr><th>{t('Grandeur')}</th><th>{t('Unité')}</th><th>{t('Nominale')}</th><th>{t('Mesurée')}</th><th>{t('Tolérance ±')}</th><th>{t('Écart')}</th><th /></tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const e = ecartPoint(l);
              return (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td><input value={l.grandeur ?? ''} onChange={(ev) => maj(i, 'grandeur', ev.target.value)} aria-label={t('Grandeur')} dir="auto" /></td>
                  <td><input className="mtr-court" value={l.unite ?? ''} onChange={(ev) => maj(i, 'unite', ev.target.value)} aria-label={t('Unité')} /></td>
                  <td><input className="mtr-court" type="number" step="any" value={l.nominale ?? ''} onChange={(ev) => maj(i, 'nominale', ev.target.value)} aria-label={t('Nominale')} /></td>
                  <td><input className="mtr-court" type="number" step="any" value={l.mesuree ?? ''} onChange={(ev) => maj(i, 'mesuree', ev.target.value)} aria-label={t('Mesurée')} /></td>
                  <td><input className="mtr-court" type="number" step="any" value={l.tolerance ?? ''} onChange={(ev) => maj(i, 'tolerance', ev.target.value)} aria-label={t('Tolérance ±')} /></td>
                  <td className={e?.conforme === false ? 'mtr-ko' : e?.conforme ? 'mtr-ok' : ''}>{e ? fmt(e.ecart) : '—'}</td>
                  <td><button type="button" className="mtr-retirer" onClick={() => changer(lignes.filter((_, j) => j !== i))} aria-label={t('Retirer')}><X size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <button type="button" className="cm-btn cm-btn--lien" onClick={() => changer([...lignes, { grandeur: '', unite: '', nominale: '', mesuree: '', tolerance: '' }])}>
        <Plus size={15} /> {t('Ajouter un point de mesure')}
      </button>
    </div>
  );
}

const CHAMPS = [
  { nom: 'lotArticleImmobilistationId', label: 'Équipement', type: 'equipement', requis: true, largeur: 'pleine', section: 'controle' },
  { nom: 'type', label: 'Type de contrôle', type: 'liste', requis: true, options: Object.entries(TYPES_CONTROLE).map(([value, label]) => ({ value, label })), traduireOptions: true, numerique: false, section: 'controle' },
  { nom: 'dateControle', label: 'Date du contrôle', type: 'date', requis: true, section: 'controle', valider: (v) => (v && v > new Date().toISOString().slice(0, 10) ? t('La date ne peut pas être dans le futur.') : null) },
  { nom: 'organisme', label: 'Organisme / laboratoire', type: 'texte', longueurMax: 255, section: 'controle' },
  { nom: 'intervenant', label: 'Intervenant', type: 'texte', longueurMax: 255, section: 'controle' },
  { nom: 'resultat', label: 'Résultat', type: 'liste', requis: true, options: Object.entries(RESULTATS).map(([value, r]) => ({ value, label: r.label })), traduireOptions: true, numerique: false, section: 'controle' },
  { nom: 'numeroCertificat', label: 'N° de certificat', type: 'texte', longueurMax: 100, section: 'controle' },
  { nom: 'periodiciteMois', label: 'Périodicité', unite: 'mois', type: 'nombre', min: 1, max: 120, section: 'controle' },
  { nom: 'prochaineEcheance', label: 'Prochaine échéance', type: 'date', section: 'controle' },
  {
    nom: 'certificat', label: 'Certificat', type: 'personnalise', largeur: 'pleine', envoyer: false, section: 'controle',
    rendu: ({ valeur, changer, valeurs }) => (
      <div className="mtr-certificat">
        {valeurs.documentId && !valeur && (
          <a href={equipementService.urlDocument(valeurs.documentId)} target="_blank" rel="noreferrer"><FileText size={15} /> {valeurs.documentNom || t('Certificat')}</a>
        )}
        <input type="file" accept="application/pdf,image/*" onChange={(e) => changer(e.target.files?.[0] || '')} aria-label={t('Certificat')} />
      </div>
    ),
  },
  { nom: 'documentId', type: 'nombre', cache: true },
  { nom: 'documentNom', type: 'texte', cache: true },
  {
    nom: 'mesures', label: 'Points de mesure', type: 'personnalise', largeur: 'pleine', section: 'mesures',
    rendu: ({ valeur, changer }) => <SaisieMesures valeur={valeur} changer={changer} />,
    transformer: (v) => {
      const l = lireMesures(v).filter((m) => String(m.grandeur ?? '').trim() || m.mesuree !== '');
      return l.length ? JSON.stringify(l) : null;
    },
  },
  { nom: 'commentaire', label: 'Commentaire', type: 'zone', largeur: 'pleine', longueurMax: 4000, section: 'mesures' },
];

export default function Metrologie() {
  const [vue, setVue] = useState('ECHEANCIER');
  const [echeancier, setEcheancier] = useState([]);
  const [controles, setControles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null, initiales: null });

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [e, c] = await Promise.all([lireRequete('echeancierMetrologie'), lireRequete('controlesMetrologie', {})]);
      setEcheancier(e || []);
      setControles(c || []);
    } catch {
      setErreur(t('Impossible de charger la métrologie.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setSelection(null); }, [vue]);

  const historique = vue === 'HISTORIQUE';
  const compte = (s) => echeancier.filter((e) => e.statut === s).length;
  const lignes = useMemo(() => {
    if (historique) return controles;
    const l = echeancier.map((e) => ({ ...e, id: e.controleId }));
    return vue === 'ECHEANCIER' ? l : l.filter((e) => e.statut === vue);
  }, [historique, controles, echeancier, vue]);

  const controleDe = (ligne) => (historique ? ligne : controles.find((c) => c.id === ligne.controleId));

  const imprimer = (ligne) => {
    const c = controleDe(ligne);
    if (!c) return;
    const mesures = lireMesures(c.mesures);
    imprimerFiche({
      titre: t('Rapport de contrôle métrologique'),
      sousTitre: c.equipementNom,
      reference: c.numeroCertificat || `#${c.id}`,
      statut: t(RESULTATS[c.resultat]?.label || c.resultat),
      sections: [
        {
          titre: t('Contrôle'),
          champs: [
            { label: t('Équipement'), valeur: c.equipementNom },
            { label: t('Type de contrôle'), valeur: t(TYPES_CONTROLE[c.type] || c.type) },
            { label: t('Date du contrôle'), valeur: dateFr(c.dateControle) },
            { label: t('Organisme / laboratoire'), valeur: c.organisme || '—' },
            { label: t('Intervenant'), valeur: c.intervenant || '—' },
            { label: t('N° de certificat'), valeur: c.numeroCertificat || '—' },
            { label: t('Périodicité'), valeur: c.periodiciteMois ? t('{n} mois', { n: c.periodiciteMois }) : '—' },
            { label: t('Prochaine échéance'), valeur: dateFr(c.prochaineEcheance) || '—' },
          ],
        },
        {
          titre: t('Points de mesure'),
          colonnes: [t('Grandeur'), t('Unité'), { label: t('Nominale'), align: 'end' }, { label: t('Mesurée'), align: 'end' }, { label: t('Tolérance ±'), align: 'end' }, { label: t('Écart'), align: 'end' }, t('Résultat')],
          lignes: mesures.map((m) => {
            const e = ecartPoint(m);
            return [m.grandeur || '', m.unite || '', fmt(nombre(m.nominale)), fmt(nombre(m.mesuree)), fmt(nombre(m.tolerance)), e ? fmt(e.ecart) : '', e?.conforme == null ? '' : e.conforme ? t('Conforme') : t('Hors tolérance')];
          }),
          vide: t('Aucun point de mesure.'),
        },
        ...(c.commentaire ? [{ titre: t('Commentaire'), texte: c.commentaire }] : []),
      ],
      signatures: [t('Technicien biomédical'), t('Responsable maintenance')],
    });
  };

  const colEquipement = { cle: 'equipementNom', label: 'Équipement', valeur: (l) => l.equipementNom || '', rendu: (l) => <strong dir="auto">{l.equipementNom}</strong> };
  const colType = { cle: 'type', label: 'Type', filtre: 'liste', valeur: (l) => t(TYPES_CONTROLE[l.type] || l.type) };
  const colResultat = {
    cle: 'resultat', label: 'Résultat', filtre: 'liste', valeur: (l) => t(RESULTATS[l.resultat]?.label || l.resultat || ''),
    rendu: (l) => <Badge ton={RESULTATS[l.resultat]?.ton || 'gris'}>{t(RESULTATS[l.resultat]?.label || l.resultat)}</Badge>,
  };
  const colCertificat = {
    cle: 'certificat', label: 'Certificat', valeur: (l) => l.numeroCertificat || l.documentNom || '', triable: false,
    rendu: (l) => (l.documentId
      ? <a className="mtr-lien" href={equipementService.urlDocument(l.documentId)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><FileText size={14} /> {l.numeroCertificat || t('Ouvrir')}</a>
      : (l.numeroCertificat || '—')),
  };
  const colonnes = historique ? [
    { cle: 'dateControle', label: 'Date', valeur: (l) => l.dateControle || '', texte: (l) => dateFr(l.dateControle), rendu: (l) => dateFr(l.dateControle) },
    colEquipement, colType,
    { cle: 'organisme', label: 'Organisme', valeur: (l) => l.organisme || '' },
    colResultat, colCertificat,
    { cle: 'prochaineEcheance', label: 'Échéance', valeur: (l) => l.prochaineEcheance || '', texte: (l) => dateFr(l.prochaineEcheance), rendu: (l) => dateFr(l.prochaineEcheance) || '—' },
    { cle: 'auteurNom', label: 'Saisi par', valeur: (l) => l.auteurNom || '', visible: false },
  ] : [
    colEquipement, colType,
    { cle: 'dernierControle', label: 'Dernier contrôle', valeur: (l) => l.dernierControle || '', texte: (l) => dateFr(l.dernierControle), rendu: (l) => dateFr(l.dernierControle) },
    colResultat,
    { cle: 'prochaineEcheance', label: 'Échéance', valeur: (l) => l.prochaineEcheance || '9999', texte: (l) => dateFr(l.prochaineEcheance), rendu: (l) => dateFr(l.prochaineEcheance) || '—' },
    {
      cle: 'joursRestants', label: 'Jours restants', alignement: 'droite', valeur: (l) => (l.joursRestants ?? 99999),
      texte: (l) => (l.joursRestants == null ? '' : String(l.joursRestants)),
      rendu: (l) => (l.joursRestants == null ? '—' : <span className={l.joursRestants < 0 ? 'mtr-ko' : ''}>{l.joursRestants < 0 ? t('{n} j de retard', { n: -l.joursRestants }) : t('{n} j', { n: l.joursRestants })}</span>),
    },
    {
      cle: 'statut', label: 'État', filtre: 'liste', valeur: (l) => t(STATUTS[l.statut]?.label || l.statut),
      rendu: (l) => <Badge ton={STATUTS[l.statut]?.ton || 'gris'}>{t(STATUTS[l.statut]?.label || l.statut)}</Badge>,
    },
    colCertificat,
  ];


  return (
    <PageListe
      key={historique ? 'historique' : 'echeancier'}
      titre={t('Métrologie')}
      sansEntete
      filtres={(
        <select value={vue} onChange={(e) => setVue(e.target.value)} aria-label={t('Vue')}>
          <option value="ECHEANCIER">{`${t('Échéancier')} (${echeancier.length})`}</option>
          <option value="NON_CONFORME">{`${t('Non conformes')} (${compte('NON_CONFORME')})`}</option>
          <option value="EN_RETARD">{`${t('En retard')} (${compte('EN_RETARD')})`}</option>
          <option value="A_PREVOIR">{`${t('À prévoir')} (${compte('A_PREVOIR')})`}</option>
          <option value="HISTORIQUE">{`${t('Historique')} (${controles.length})`}</option>
        </select>
      )}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={selection}
      onSelection={setSelection}
      onAjouter={() => setFenetre({ ouverte: true, objet: null, initiales: { dateControle: new Date().toISOString().slice(0, 10) } })}
      libelleAjouter={t('Enregistrer un contrôle')}
      onModifier={(l) => { const c = controleDe(l); if (c) setFenetre({ ouverte: true, objet: c, initiales: null }); }}
      actions={[
        {
          label: t('Nouveau contrôle'), icone: Plus, classe: 'cl-action--teal', besoinSelection: true, aide: t('Même équipement et même type, contrôle du jour'),
          onClick: (l) => {
            const c = controleDe(l);
            if (!c) return;
            setFenetre({
              ouverte: true, objet: null,
              initiales: { lotArticleImmobilistationId: c.lotArticleImmobilistationId, type: c.type, organisme: c.organisme, periodiciteMois: c.periodiciteMois, dateControle: new Date().toISOString().slice(0, 10) },
            });
          },
        },
        { label: t('Imprimer'), icone: Printer, classe: 'cl-action--bleu', besoinSelection: true, onClick: imprimer },
        ...(historique ? [{
          label: t('Supprimer'), icone: Trash2, classe: 'cl-action--supprimer', besoinSelection: true,
          onClick: async (l) => {
            if (!window.confirm(t('Supprimer ce contrôle ? Cette action est irréversible.'))) return;
            try { await metrologieService.supprimer(l.id); setSelection(null); await charger(); } catch (e) { setErreur(e?.response?.data?.message || t('Suppression impossible.')); }
          },
        }] : []),
        { label: t('Actualiser'), icone: RefreshCw, classe: 'cl-action--gris', desactive: chargement, onClick: charger },
      ]}
      recherchePlaceholder={t('Équipement, organisme, certificat...')}
      cleStockage={historique ? 'metrologie-historique' : 'metrologie-echeancier'}
      nomExport={historique ? 'metrologie-historique' : 'metrologie-echeancier'}
      vide={{ aucun: t('Aucun contrôle enregistré.'), aucunFiltre: t('Aucun élément ne correspond à ces filtres.') }}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.metrologie}
        surtitres={{ creation: t('Métrologie'), modification: t('Métrologie') }}
        titres={{ creation: t('Enregistrer un contrôle'), modification: t('Modifier le contrôle') }}
        sections={[{ cle: 'controle', label: t('Contrôle') }, { cle: 'mesures', label: t('Mesures') }]}
        champs={CHAMPS}
        objet={fenetre.objet}
        initiales={fenetre.initiales}
        taille="lg"
        onEnregistrer={async (payload, { valeurs }) => {
          const corps = { ...payload, documentId: valeurs.documentId ? Number(valeurs.documentId) : null, documentNom: valeurs.documentNom || null };
          if (valeurs.certificat instanceof File) {
            const doc = await equipementService.ajouterDocument(payload.lotArticleImmobilistationId, valeurs.certificat, {
              titre: `${t(TYPES_CONTROLE[payload.type] || payload.type)} ${payload.dateControle}${payload.numeroCertificat ? ` — ${payload.numeroCertificat}` : ''}`,
              categorie: 'CERTIFICAT',
            });
            corps.documentId = doc?.id ?? null;
            corps.documentNom = doc?.nomFichier || valeurs.certificat.name;
          }
          await metrologieService.enregistrer(fenetre.objet?.id, corps);
          await charger();
        }}
      />
    </PageListe>
  );
}
