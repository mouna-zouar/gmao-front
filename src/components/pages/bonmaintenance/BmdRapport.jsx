import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles, FileText, Loader2, RefreshCw, Pencil, Check, X, AlertTriangle, ShieldCheck, Wrench, Package,
  ClipboardCheck, Lightbulb, Stethoscope, Search, Hammer, Printer,
} from 'lucide-react';
import bonMaintenanceRapportService from '../../../services/bonMaintenanceRapportService';
import authService from '../../../services/Authservice';
import { t, locale, langueActuelle } from '../../../i18n';
import { imprimerFiche } from '../../../utils/imprimerListe';
import './BmdRapport.css';

const ETAT_EFFECTUE = 4;
const VIDE = {
  resume: '', panneConstatee: '', causeIdentifiee: '', remede: '',
  travauxRealises: [], piecesRemplacees: [], controlesEtRemiseEnService: '', recommandations: [],
};
const LANGUES = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];

const dateHeure = (v) => (v ? new Date(v).toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const lignes = (l) => (Array.isArray(l) ? l.join('\n') : '');
const versListe = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * Rapport d'intervention du bon : rédigé par l'IA à la clôture (ou à la demande),
 * relu, corrigé puis validé par une personne. onChange(rapport) prévient la page
 * (fiche imprimée) ; onBonModifie() la fait recharger le bon après validation
 * (effet / cause / remède complétés).
 */
export default function BmdRapport({ bon, equipementNom, onChange, onBonModifie }) {
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState(null); // 'generer' | 'enregistrer' | 'valider'
  const [erreur, setErreur] = useState(null);
  const [edition, setEdition] = useState(null); // copie modifiable du contenu
  const [langue, setLangue] = useState(() => (['fr', 'ar', 'en'].includes(langueActuelle()) ? langueActuelle() : 'fr'));
  const [completerBon, setCompleterBon] = useState(true);

  const appliquer = useCallback((r) => {
    setRapport(r);
    onChange?.(r);
  }, [onChange]);

  const charger = useCallback(async () => {
    if (!bon?.id) return;
    setChargement(true);
    try {
      appliquer(await bonMaintenanceRapportService.get(bon.id));
      setErreur(null);
    } catch (e) {
      console.error('Rapport du bon :', e);
      setErreur(t("Le rapport n'a pas pu être chargé."));
    } finally {
      setChargement(false);
    }
  }, [bon?.id, appliquer]);

  useEffect(() => { charger(); }, [charger]);

  // Le brouillon automatique est préparé en arrière-plan à la clôture : on revérifie une fois
  useEffect(() => {
    if (chargement || rapport || bon?.etat !== ETAT_EFFECTUE) return undefined;
    const minuteur = setTimeout(charger, 8000);
    return () => clearTimeout(minuteur);
  }, [chargement, rapport, bon?.etat, charger]);

  const executer = async (nom, fn) => {
    setAction(nom);
    setErreur(null);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setErreur(e?.response?.data?.message || t("L'opération n'a pas abouti. Réessayez."));
    } finally {
      setAction(null);
    }
  };

  const generer = () => {
    if (rapport && !window.confirm(t('Régénérer le rapport ? Le texte actuel sera remplacé par un nouveau brouillon.'))) return;
    executer('generer', async () => {
      appliquer(await bonMaintenanceRapportService.generer(bon.id, langue));
      setEdition(null);
    });
  };

  const enregistrer = () => executer('enregistrer', async () => {
    appliquer(await bonMaintenanceRapportService.enregistrer(bon.id, {
      ...edition,
      travauxRealises: versListe(edition.travauxRealises),
      piecesRemplacees: versListe(edition.piecesRemplacees),
      recommandations: versListe(edition.recommandations),
    }));
    setEdition(null);
  });

  const valider = () => executer('valider', async () => {
    const ctx = authService.getContexteMetier();
    const user = authService.getCurrentUser?.() ?? {};
    appliquer(await bonMaintenanceRapportService.valider(bon.id, {
      personnelId: ctx.userId ?? null,
      personnelNom: user?.userNom || ctx.user || null,
      completerBon,
    }));
    if (completerBon) onBonModifie?.();
  });

  const commencerEdition = () => {
    const c = { ...VIDE, ...(rapport?.contenu || {}) };
    setEdition({
      ...c,
      travauxRealises: lignes(c.travauxRealises),
      piecesRemplacees: lignes(c.piecesRemplacees),
      recommandations: lignes(c.recommandations),
    });
  };
  const changer = (e) => setEdition((x) => ({ ...x, [e.target.name]: e.target.value }));

  // Impression du rapport seul (A4) : en-tête du bon, rapport, validation et signatures
  const imprimerRapport = () => {
    if (!rapport) return;
    const r = { ...VIDE, ...(rapport.contenu || {}) };
    const puces = (l) => (l?.length ? l.map((x) => `• ${x}`).join('\n') : '');
    const estValide = rapport.statut === 1;
    imprimerFiche({
      titre: equipementNom || bon.titre || t("Rapport d'intervention"),
      sousTitre: estValide ? t("Rapport d'intervention") : t("Rapport d'intervention (brouillon)"),
      reference: bon.num || t('Bon #{id}', { id: bon.id }),
      statut: estValide ? t('Validé') : t('Brouillon'),
      sections: [
        {
          titre: t('Intervention'),
          champs: [
            { label: t('Bon de maintenance'), valeur: bon.num || `#${bon.id}` },
            { label: t('Titre'), valeur: bon.titre },
            { label: t('Service'), valeur: bon.serviceNom || bon.service?.description },
            { label: t('Équipement'), valeur: equipementNom },
            { label: t('Date'), valeur: bon.date ? dateHeure(bon.date) : '' },
            { label: t('Date de clôture'), valeur: bon.dateCloture ? dateHeure(bon.dateCloture) : '' },
            { label: t('Durée'), valeur: rapport.dureeIntervenant != null ? t('{n} h', { n: rapport.dureeIntervenant }) : '' },
            { label: t('Coût total'), valeur: rapport.coutTotal != null ? `${Number(rapport.coutTotal).toLocaleString(locale(), { minimumFractionDigits: 3 })} ${t('DT')}` : '' },
          ],
        },
        { titre: t('Résumé'), texte: r.resume || '' },
        {
          titre: t('Diagnostic et réparation'),
          champs: [
            { label: t('Panne constatée'), valeur: r.panneConstatee, large: true },
            { label: t('Cause identifiée'), valeur: r.causeIdentifiee, large: true },
            { label: t('Remède'), valeur: r.remede, large: true },
          ],
        },
        { titre: t('Travaux réalisés'), texte: puces(r.travauxRealises) },
        { titre: t('Pièces remplacées'), texte: puces(r.piecesRemplacees) },
        { titre: t('Contrôles et remise en service'), texte: r.controlesEtRemiseEnService || '' },
        { titre: t('Recommandations'), texte: puces(r.recommandations) },
        {
          titre: t('Validation'),
          champs: [
            { label: t('Statut'), valeur: estValide ? t('Validé') : t('Brouillon — non validé'), toujours: true },
            { label: t('Validé par'), valeur: estValide ? rapport.valideParNom : '' },
            { label: t('Validé le'), valeur: estValide && rapport.valideLe ? dateHeure(rapport.valideLe) : '' },
            { label: t('Rédaction'), valeur: rapport.source === 'IA' ? t('Rédigé avec l’aide de l’IA, relu par l’équipe') : rapport.source === 'MANUEL' ? t('Saisi à la main') : t('Assemblé à partir des données du bon') },
          ],
        },
      ],
      signatures: [t('Technicien'), t('Responsable maintenance')],
    });
  };

  // Rien à montrer tant que le bon n'est pas effectué et qu'aucun rapport n'existe
  if (!chargement && !rapport && bon?.etat !== ETAT_EFFECTUE) return null;

  const enCours = action != null;
  const c = { ...VIDE, ...(rapport?.contenu || {}) };
  const valide = rapport?.statut === 1;
  const dirRapport = rapport?.langue === 'ar' ? 'rtl' : undefined;

  return (
    <section className="bmr" aria-label={t("Rapport d'intervention")}>
      <div className="bmr-entete">
        <div className="bmr-titre">
          <span className="bmr-titre-icone"><FileText size={20} /></span>
          <div>
            <h2>{t("Rapport d'intervention")}</h2>
            <p>{t("Rédigé par l'IA à partir des tâches, des pièces et de la discussion, puis relu par l'équipe.")}</p>
          </div>
        </div>
        {rapport && (
          <div className="bmr-badges">
            <span className={`bmr-badge ${valide ? 'bmr-badge--valide' : 'bmr-badge--brouillon'}`}>
              {valide ? <ShieldCheck size={14} /> : <Pencil size={14} />} {valide ? t('Validé') : t('Brouillon')}
            </span>
            <span className="bmr-badge bmr-badge--source" title={rapport.modele || ''}>
              <Sparkles size={14} /> {rapport.source === 'IA' ? t('Rédigé avec l’IA') : rapport.source === 'MANUEL' ? t('Saisi à la main') : t('Assemblé sans IA')}
            </span>
          </div>
        )}
      </div>

      {erreur && <p className="bmr-alerte bmr-alerte--erreur"><AlertTriangle size={16} /> {erreur}</p>}
      {rapport?.avertissement && !erreur && <p className="bmr-alerte"><AlertTriangle size={16} /> {t(rapport.avertissement)}</p>}

      {chargement ? (
        <div className="bmr-vide"><Loader2 size={20} className="bmr-tourne" /> {t('Chargement...')}</div>
      ) : action === 'generer' ? (
        <div className="bmr-vide bmr-vide--redaction">
          <Sparkles size={22} className="bmr-pulse" />
          <div>
            <strong>{t('Rédaction du rapport en cours…')}</strong>
            <span>{t("L'IA relit les tâches, les pièces et la discussion. Cela prend quelques secondes.")}</span>
          </div>
        </div>
      ) : !rapport ? (
        <div className="bmr-vide bmr-vide--cta">
          <p>{t("Le bon est effectué : l'IA peut rédiger son rapport d'intervention. Vous le relirez avant de le valider.")}</p>
          <div className="bmr-actions">
            <select className="bmr-langue" value={langue} onChange={(e) => setLangue(e.target.value)} aria-label={t('Langue du rapport')}>
              {LANGUES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <button type="button" className="bmx-btn bmx-btn--principal" onClick={generer} disabled={enCours}>
              <Sparkles size={17} /> {t('Générer le rapport')}
            </button>
          </div>
        </div>
      ) : edition ? (
        <div className="bmr-edition">
          <label className="bmr-champ bmr-champ--large"><span>{t('Résumé')}</span>
            <textarea name="resume" rows={3} value={edition.resume || ''} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ"><span>{t('Panne constatée')}</span>
            <textarea name="panneConstatee" rows={3} value={edition.panneConstatee || ''} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ"><span>{t('Cause identifiée')}</span>
            <textarea name="causeIdentifiee" rows={3} value={edition.causeIdentifiee || ''} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ bmr-champ--large"><span>{t('Remède')}</span>
            <textarea name="remede" rows={2} value={edition.remede || ''} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ"><span>{t('Travaux réalisés')} <em>{t('(une ligne par action)')}</em></span>
            <textarea name="travauxRealises" rows={5} value={edition.travauxRealises} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ"><span>{t('Pièces remplacées')} <em>{t('(une ligne par pièce)')}</em></span>
            <textarea name="piecesRemplacees" rows={5} value={edition.piecesRemplacees} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ bmr-champ--large"><span>{t('Contrôles et remise en service')}</span>
            <textarea name="controlesEtRemiseEnService" rows={2} value={edition.controlesEtRemiseEnService || ''} onChange={changer} dir={dirRapport} /></label>
          <label className="bmr-champ bmr-champ--large"><span>{t('Recommandations')} <em>{t('(une ligne par recommandation)')}</em></span>
            <textarea name="recommandations" rows={3} value={edition.recommandations} onChange={changer} dir={dirRapport} /></label>
          <div className="bmr-actions bmr-champ--large">
            <button type="button" className="bmx-btn bmx-btn--clair" onClick={() => setEdition(null)} disabled={enCours}>
              <X size={17} /> {t('Annuler')}
            </button>
            <button type="button" className="bmx-btn bmx-btn--principal" onClick={enregistrer} disabled={enCours}>
              {action === 'enregistrer' ? <Loader2 size={17} className="bmr-tourne" /> : <Check size={17} />} {t('Enregistrer')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bmr-lecture" dir={dirRapport}>
            {c.resume && <p className="bmr-resume">{c.resume}</p>}
            <div className="bmr-grille">
              <Bloc icone={Stethoscope} titre={t('Panne constatée')} texte={c.panneConstatee} />
              <Bloc icone={Search} titre={t('Cause identifiée')} texte={c.causeIdentifiee} />
              <Bloc icone={Hammer} titre={t('Remède')} texte={c.remede} large />
              <Bloc icone={Wrench} titre={t('Travaux réalisés')} liste={c.travauxRealises} />
              <Bloc icone={Package} titre={t('Pièces remplacées')} liste={c.piecesRemplacees} />
              <Bloc icone={ClipboardCheck} titre={t('Contrôles et remise en service')} texte={c.controlesEtRemiseEnService} large />
              {c.recommandations?.length > 0 && <Bloc icone={Lightbulb} titre={t('Recommandations')} liste={c.recommandations} large accent />}
            </div>
          </div>

          <div className="bmr-pied">
            <span className="bmr-trace">
              {valide
                ? t('Validé par {nom} le {date}.', { nom: rapport.valideParNom || t('un utilisateur'), date: dateHeure(rapport.valideLe) })
                : t('Brouillon du {date} : relisez-le avant de le valider.', { date: dateHeure(rapport.modifieLe || rapport.genereLe) })}
              {rapport.source === 'IA' && ' ' + t('Rédigé avec l’aide de l’IA.')}
            </span>
            <div className="bmr-actions">
              <select className="bmr-langue" value={langue} onChange={(e) => setLangue(e.target.value)} aria-label={t('Langue du rapport')}>
                {LANGUES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button type="button" className="bmx-btn bmx-btn--fantome" onClick={generer} disabled={enCours}>
                <RefreshCw size={16} /> {t('Régénérer')}
              </button>
              <button type="button" className="bmx-btn bmx-btn--clair" onClick={commencerEdition} disabled={enCours}>
                <Pencil size={16} /> {t('Modifier')}
              </button>
              <button type="button" className="bmx-btn bmx-btn--clair" onClick={imprimerRapport} disabled={enCours}>
                <Printer size={16} /> {t('Imprimer')}
              </button>
              {!valide && (
                <>
                  <label className="bmr-case">
                    <input type="checkbox" checked={completerBon} onChange={(e) => setCompleterBon(e.target.checked)} />
                    {t('Compléter effet, cause et remède du bon s’ils sont vides')}
                  </label>
                  <button type="button" className="bmx-btn bmx-btn--principal" onClick={valider} disabled={enCours}>
                    {action === 'valider' ? <Loader2 size={17} className="bmr-tourne" /> : <ShieldCheck size={17} />} {t('Valider le rapport')}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Bloc({ icone: Icone, titre, texte, liste, large, accent }) {
  const vide = liste ? liste.length === 0 : !texte;
  return (
    <div className={`bmr-bloc${large ? ' bmr-bloc--large' : ''}${accent ? ' bmr-bloc--accent' : ''}`}>
      <h3><Icone size={15} /> {titre}</h3>
      {vide ? <p className="bmr-non-renseigne">{t('Non renseigné')}</p>
        : liste ? <ul>{liste.map((x, i) => <li key={i}>{x}</li>)}</ul>
          : <p>{texte}</p>}
    </div>
  );
}
