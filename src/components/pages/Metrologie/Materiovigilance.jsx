import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Printer, RefreshCw, Search, Send, SlidersHorizontal } from 'lucide-react';
import metrologieService from '../../../services/metrologieService';
import { Badge, Modale, ModaleFormulaire, PageListe } from '../../commun';
import { ICONES_MODULES } from '../../../constants/modules';
import { imprimerFiche } from '../../../utils/imprimerListe';
import { t, locale } from '../../../i18n';
import './Metrologie.css';
import { lireRequete } from '../../../store/referentiels';

const GRAVITES = {
  GRAVE: { label: 'Grave', ton: 'rouge' },
  SERIEUSE: { label: 'Sérieuse', ton: 'orange' },
  MINEURE: { label: 'Mineure', ton: 'ambre' },
};
const CONSEQUENCES = { AUCUNE: 'Aucune', PATIENT: 'Patient', UTILISATEUR: 'Utilisateur', TIERS: 'Tiers' };
const STATUTS = {
  OUVERT: { label: 'Ouvert', ton: 'bleu' },
  DECLARE: { label: 'Déclaré à l’autorité', ton: 'teal' },
  EN_INVESTIGATION: { label: 'En investigation', ton: 'ambre' },
  CLOTURE: { label: 'Clôturé', ton: 'vert' },
};

const dateFr = (v, heure = false) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale(), heure
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const lireSuivi = (v) => { try { const l = JSON.parse(v || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
const enRetard = (x) => x.statut === 'OUVERT' && x.dateLimiteDeclaration && new Date(x.dateLimiteDeclaration) < new Date();
const maintenantLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const CHAMPS = [
  { nom: 'lotArticleImmobilistationId', label: 'Équipement', type: 'equipement', largeur: 'pleine', section: 'dispositif' },
  {
    nom: 'equipementNom', label: 'Dispositif (hors parc)', type: 'texte', longueurMax: 255, largeur: 'pleine', section: 'dispositif',
    visible: (v) => !v.lotArticleImmobilistationId,
    valider: (val, v) => (!v.lotArticleImmobilistationId && !String(val || '').trim() ? t('Choisissez l’équipement ou indiquez le dispositif.') : null),
  },
  { nom: 'fabricant', label: 'Fabricant', type: 'texte', longueurMax: 255, section: 'dispositif' },
  { nom: 'modele', label: 'Modèle', type: 'texte', longueurMax: 255, section: 'dispositif' },
  { nom: 'numeroSerie', label: 'N° de série', type: 'texte', longueurMax: 100, section: 'dispositif' },
  { nom: 'lot', label: 'N° de lot', type: 'texte', longueurMax: 100, section: 'dispositif' },
  { nom: 'dateIncident', label: 'Date de l’incident', type: 'dateheure', requis: true, section: 'incident' },
  { nom: 'serviceNom', label: 'Service', type: 'texte', longueurMax: 255, section: 'incident' },
  { nom: 'gravite', label: 'Gravité', type: 'liste', requis: true, options: Object.entries(GRAVITES).map(([value, g]) => ({ value, label: g.label })), traduireOptions: true, numerique: false, section: 'incident' },
  { nom: 'consequence', label: 'Conséquence', type: 'liste', options: Object.entries(CONSEQUENCES).map(([value, label]) => ({ value, label })), traduireOptions: true, numerique: false, section: 'incident' },
  { nom: 'declarantNom', label: 'Déclarant', type: 'texte', longueurMax: 255, section: 'incident' },
  { nom: 'equipementRetire', label: 'Équipement retiré du service', type: 'case', section: 'incident' },
  { nom: 'description', label: 'Description', type: 'zone', requis: true, largeur: 'pleine', longueurMax: 8000, section: 'incident' },
  { nom: 'circonstances', label: 'Circonstances', type: 'zone', largeur: 'pleine', longueurMax: 8000, section: 'incident' },
  { nom: 'mesuresPrises', label: 'Mesures prises', type: 'zone', largeur: 'pleine', longueurMax: 8000, section: 'incident' },
];

function FenetreStatut({ incident, cible, onFermer, onFait }) {
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [conclusion, setConclusion] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const manque = (cible === 'DECLARE' && !ref.trim()) || (cible === 'CLOTURE' && !conclusion.trim());
  const titres = { DECLARE: 'Déclarer à l’autorité', EN_INVESTIGATION: 'Passer en investigation', CLOTURE: 'Clôturer l’incident' };

  const valider = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await metrologieService.changerStatut(incident.id, {
        statut: cible, referenceAutorite: ref || null, dateDeclaration: cible === 'DECLARE' ? date : null, conclusion: conclusion || null, commentaire: commentaire || null,
      });
      onFait();
    } catch (e) {
      setErreur(e?.response?.data?.message || t('L’action n’a pas pu être enregistrée.'));
      setEnvoi(false);
    }
  };

  return (
    <Modale
      ouvert onFermer={onFermer} icone={cible === 'CLOTURE' ? CheckCircle2 : cible === 'DECLARE' ? Send : Search}
      surtitre={incident.numero} titre={t(titres[cible])} taille="sm"
      infoPied={erreur ? <span className="mtr-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={valider} disabled={envoi || manque}>
            {envoi ? <Loader2 size={16} className="cf-tourne" /> : <CheckCircle2 size={16} />} {t('Valider')}
          </button>
        </>
      )}
    >
      <div className="cf-grille">
        {cible === 'DECLARE' && (
          <>
            <div className="cf-champ cf-champ--demi">
              <label className="cf-label" htmlFor="mv-ref">{t('Référence de la déclaration')}<span className="cf-requis">*</span></label>
              <input id="mv-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} />
            </div>
            <div className="cf-champ cf-champ--demi">
              <label className="cf-label" htmlFor="mv-date">{t('Date de déclaration')}</label>
              <input id="mv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        )}
        {cible === 'CLOTURE' && (
          <div className="cf-champ cf-champ--pleine">
            <label className="cf-label" htmlFor="mv-conclusion">{t('Conclusion')}<span className="cf-requis">*</span></label>
            <textarea id="mv-conclusion" rows={4} value={conclusion} onChange={(e) => setConclusion(e.target.value)} dir="auto" />
          </div>
        )}
        <div className="cf-champ cf-champ--pleine">
          <label className="cf-label" htmlFor="mv-commentaire">{t('Commentaire')}</label>
          <textarea id="mv-commentaire" rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} dir="auto" />
        </div>
      </div>
    </Modale>
  );
}

function FenetreDelais({ onFermer }) {
  const [d, setD] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { lireRequete('delaisMateriovigilance').then(setD).catch(() => setD({ graveJours: 2, serieuseJours: 10, mineureJours: 30 })); }, []);
  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await metrologieService.enregistrerDelais({ graveJours: Number(d.graveJours) || 0, serieuseJours: Number(d.serieuseJours) || 0, mineureJours: Number(d.mineureJours) || 0 });
      onFermer();
    } catch (e) {
      setErreur(e?.response?.data?.message || t('Enregistrement impossible.'));
      setEnvoi(false);
    }
  };
  return (
    <Modale
      ouvert onFermer={onFermer} icone={SlidersHorizontal} surtitre={t('Matériovigilance')} titre={t('Délais de déclaration')} taille="sm"
      infoPied={erreur ? <span className="mtr-erreur" role="alert">{erreur}</span> : null}
      pied={(
        <>
          <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
          <button type="button" className="cm-btn cm-btn--principal" onClick={enregistrer} disabled={!d || envoi}>{t('Enregistrer')}</button>
        </>
      )}
    >
      {!d ? <p className="mtr-vide"><Loader2 size={15} className="cf-tourne" /> {t('Chargement…')}</p> : (
        <div className="cf-grille">
          {[['graveJours', 'Incident grave'], ['serieuseJours', 'Incident sérieux'], ['mineureJours', 'Incident mineur']].map(([k, l]) => (
            <div key={k} className="cf-champ cf-champ--pleine">
              <label className="cf-label" htmlFor={`mv-${k}`}>{t(l)} <small>({t('jours')})</small></label>
              <input id={`mv-${k}`} type="number" min="0" max="365" value={d[k]} onChange={(e) => setD((x) => ({ ...x, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
      )}
    </Modale>
  );
}

export default function Materiovigilance() {
  const [incidents, setIncidents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState('');
  const [selection, setSelection] = useState(null);
  const [fenetre, setFenetre] = useState({ ouverte: false, objet: null });
  const [statut, setStatut] = useState(null);
  const [reglages, setReglages] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setIncidents(await lireRequete('incidentsMateriovigilance'));
    } catch {
      setErreur(t('Impossible de charger les incidents.'));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo(() => {
    if (!vue) return incidents;
    if (vue === 'RETARD') return incidents.filter(enRetard);
    if (vue === 'GRAVE') return incidents.filter((x) => x.gravite === 'GRAVE' && x.statut !== 'CLOTURE');
    return incidents.filter((x) => x.statut === vue);
  }, [incidents, vue]);
  useEffect(() => { setSelection(null); }, [vue]);
  const sel = selection ? incidents.find((x) => x.id === selection.id) || selection : null;

  const imprimer = (x) => {
    const suivi = lireSuivi(x.suivi);
    imprimerFiche({
      titre: t('Déclaration d’incident de matériovigilance'),
      sousTitre: x.equipementNom,
      reference: x.numero,
      statut: t(STATUTS[x.statut]?.label || x.statut),
      sections: [
        {
          titre: t('Dispositif médical'),
          champs: [
            { label: t('Dispositif'), valeur: x.equipementNom || '—' },
            { label: t('Fabricant'), valeur: x.fabricant || '—' },
            { label: t('Modèle'), valeur: x.modele || '—' },
            { label: t('N° de série'), valeur: x.numeroSerie || '—' },
            { label: t('N° de lot'), valeur: x.lot || '—' },
            { label: t('Équipement retiré du service'), valeur: x.equipementRetire ? t('Oui') : t('Non') },
          ],
        },
        {
          titre: t('Incident'),
          champs: [
            { label: t('Date de l’incident'), valeur: dateFr(x.dateIncident, true) },
            { label: t('Service'), valeur: x.serviceNom || '—' },
            { label: t('Gravité'), valeur: t(GRAVITES[x.gravite]?.label || x.gravite) },
            { label: t('Conséquence'), valeur: t(CONSEQUENCES[x.consequence] || x.consequence || '—') },
            { label: t('Déclarant'), valeur: x.declarantNom || '—' },
            { label: t('Date limite de déclaration'), valeur: dateFr(x.dateLimiteDeclaration) },
            { label: t('Déclaré le'), valeur: dateFr(x.dateDeclarationAutorite) || '—' },
            { label: t('Référence de la déclaration'), valeur: x.referenceAutorite || '—' },
          ],
        },
        { titre: t('Description'), texte: x.description || '—' },
        ...(x.circonstances ? [{ titre: t('Circonstances'), texte: x.circonstances }] : []),
        ...(x.mesuresPrises ? [{ titre: t('Mesures prises'), texte: x.mesuresPrises }] : []),
        ...(x.conclusion ? [{ titre: t('Conclusion'), texte: x.conclusion }] : []),
        {
          titre: t('Suivi'),
          colonnes: [t('Date'), t('Étape'), t('Par'), t('Commentaire')],
          lignes: suivi.map((e) => [dateFr(e.date, true), t(STATUTS[e.statut]?.label || e.statut), e.par || '', e.commentaire || '']),
          vide: t('Aucune étape.'),
        },
      ],
      signatures: [t('Déclarant'), t('Correspondant matériovigilance')],
    });
  };

  const colonnes = [
    { cle: 'numero', label: 'Numéro', valeur: (x) => x.numero || '', rendu: (x) => <strong>{x.numero}</strong> },
    { cle: 'dateIncident', label: 'Date', valeur: (x) => x.dateIncident || '', texte: (x) => dateFr(x.dateIncident, true), rendu: (x) => dateFr(x.dateIncident, true) },
    { cle: 'equipementNom', label: 'Dispositif', valeur: (x) => x.equipementNom || '', rendu: (x) => <span dir="auto">{x.equipementNom}</span> },
    { cle: 'fabricant', label: 'Fabricant', valeur: (x) => x.fabricant || '', visible: false },
    { cle: 'serviceNom', label: 'Service', filtre: 'liste', valeur: (x) => x.serviceNom || '' },
    {
      cle: 'gravite', label: 'Gravité', filtre: 'liste', valeur: (x) => t(GRAVITES[x.gravite]?.label || x.gravite || ''),
      rendu: (x) => <Badge ton={GRAVITES[x.gravite]?.ton || 'gris'}>{t(GRAVITES[x.gravite]?.label || x.gravite)}</Badge>,
    },
    { cle: 'consequence', label: 'Conséquence', filtre: 'liste', valeur: (x) => t(CONSEQUENCES[x.consequence] || x.consequence || '') },
    {
      cle: 'dateLimiteDeclaration', label: 'Déclaration', valeur: (x) => x.dateDeclarationAutorite || x.dateLimiteDeclaration || '',
      texte: (x) => (x.dateDeclarationAutorite ? `${dateFr(x.dateDeclarationAutorite)} (${x.referenceAutorite || ''})` : t('avant le {d}', { d: dateFr(x.dateLimiteDeclaration) })),
      rendu: (x) => (x.dateDeclarationAutorite
        ? <span title={x.referenceAutorite || ''}>{dateFr(x.dateDeclarationAutorite)}</span>
        : <span className={enRetard(x) ? 'mtr-ko' : ''}>{enRetard(x) && <Clock size={13} aria-hidden="true" />} {t('avant le {d}', { d: dateFr(x.dateLimiteDeclaration) })}</span>),
    },
    {
      cle: 'statut', label: 'Statut', filtre: 'liste', valeur: (x) => t(STATUTS[x.statut]?.label || x.statut || ''),
      rendu: (x) => <Badge ton={enRetard(x) ? 'rouge' : STATUTS[x.statut]?.ton || 'gris'}>{enRetard(x) ? t('À déclarer, en retard') : t(STATUTS[x.statut]?.label || x.statut)}</Badge>,
    },
  ];

  const compte = (s) => incidents.filter((x) => x.statut === s).length;

  return (
    <PageListe
      titre={t('Matériovigilance')}
      sansEntete
      filtres={(
        <select value={vue} onChange={(e) => setVue(e.target.value)} aria-label={t('Vue')}>
          <option value="">{`${t('Incidents')} (${incidents.length})`}</option>
          <option value="RETARD">{`${t('À déclarer, en retard')} (${incidents.filter(enRetard).length})`}</option>
          <option value="GRAVE">{`${t('Graves en cours')} (${incidents.filter((x) => x.gravite === 'GRAVE' && x.statut !== 'CLOTURE').length})`}</option>
          <option value="OUVERT">{`${t('Ouverts')} (${compte('OUVERT')})`}</option>
          <option value="DECLARE">{`${t('Déclarés')} (${compte('DECLARE')})`}</option>
          <option value="EN_INVESTIGATION">{`${t('En investigation')} (${compte('EN_INVESTIGATION')})`}</option>
          <option value="CLOTURE">{`${t('Clôturés')} (${compte('CLOTURE')})`}</option>
        </select>
      )}
      colonnes={colonnes}
      lignes={lignes}
      chargement={chargement}
      erreur={erreur}
      selection={sel}
      onSelection={setSelection}
      onAjouter={() => setFenetre({ ouverte: true, objet: null })}
      libelleAjouter={t('Déclarer un incident')}
      onModifier={(x) => setFenetre({ ouverte: true, objet: x })}
      onSupprimer={async (x) => { await metrologieService.supprimerIncident(x.id); await charger(); }}
      messageSuppression={(x) => t('Supprimer l’incident « {n} » ? Seul un incident encore ouvert peut être supprimé.', { n: x.numero })}
      actions={[
        { label: t('Déclarer'), icone: Send, classe: 'cl-action--violet', desactive: !sel || sel.statut !== 'OUVERT', onClick: (x) => setStatut({ incident: x, cible: 'DECLARE' }) },
        { label: t('Investigation'), icone: Search, classe: 'cl-action--ambre', desactive: !sel || !['OUVERT', 'DECLARE', 'CLOTURE'].includes(sel.statut), onClick: (x) => setStatut({ incident: x, cible: 'EN_INVESTIGATION' }) },
        { label: t('Clôturer'), icone: CheckCircle2, classe: 'cl-action--vert', desactive: !sel || sel.statut === 'CLOTURE', onClick: (x) => setStatut({ incident: x, cible: 'CLOTURE' }) },
        { label: t('Imprimer la fiche'), icone: Printer, classe: 'cl-action--bleu', besoinSelection: true, onClick: imprimer },
        { label: t('Réglages'), icone: SlidersHorizontal, classe: 'cl-action--gris', onClick: () => setReglages(true) },
        { label: t('Actualiser'), icone: RefreshCw, classe: 'cl-action--gris', desactive: chargement, onClick: charger },
      ]}
      recherchePlaceholder={t('Numéro, dispositif, fabricant, service...')}
      cleStockage="materiovigilance"
      nomExport="materiovigilance"
      vide={{ aucun: t('Aucun incident déclaré.'), aucunFiltre: t('Aucun élément ne correspond à ces filtres.') }}
      avantTableau={sel && lireSuivi(sel.suivi).length > 0 && (
        <ol className="mtr-suivi" aria-label={t('Suivi')}>
          {lireSuivi(sel.suivi).map((e, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={i}>
              <Badge ton={STATUTS[e.statut]?.ton || 'gris'}>{t(STATUTS[e.statut]?.label || e.statut)}</Badge>
              <span>{dateFr(e.date, true)}{e.par ? ` · ${e.par}` : ''}</span>
              {e.commentaire && <em dir="auto">{e.commentaire}</em>}
            </li>
          ))}
        </ol>
      )}
    >
      <ModaleFormulaire
        ouvert={fenetre.ouverte}
        onFermer={() => setFenetre((f) => ({ ...f, ouverte: false }))}
        icone={ICONES_MODULES.materiovigilance}
        surtitres={{ creation: t('Matériovigilance'), modification: fenetre.objet?.numero || t('Matériovigilance') }}
        titres={{ creation: t('Déclarer un incident'), modification: t('Modifier l’incident') }}
        sections={[{ cle: 'dispositif', label: t('Dispositif') }, { cle: 'incident', label: t('Incident') }]}
        champs={CHAMPS}
        objet={fenetre.objet}
        initiales={{ dateIncident: maintenantLocal() }}
        taille="lg"
        onEnregistrer={async (payload) => {
          await metrologieService.enregistrerIncident(fenetre.objet?.id, payload);
          await charger();
        }}
      />
      {statut && <FenetreStatut incident={statut.incident} cible={statut.cible} onFermer={() => setStatut(null)} onFait={() => { setStatut(null); charger(); }} />}
      {reglages && <FenetreDelais onFermer={() => { setReglages(false); charger(); }} />}
    </PageListe>
  );
}
