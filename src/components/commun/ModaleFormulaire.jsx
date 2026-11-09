import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import Modale from './Modale';
import Formulaire from './Formulaire';
import { useFormulaire, valeursDepuis, validerChamp, versPayload } from './useFormulaire';
import { t } from '../../i18n';

/*
 * Fenêtre de saisie décrite par ses champs (voir useFormulaire) et ses sections.
 *
 *   etapes                 sections en assistant pas à pas : « Suivant » vérifie l'étape avant d'avancer
 *   creation: true         (champ ou section) seulement à la création
 *   initiales              valeurs proposées à la création (ex. équipement pré-rempli)
 *   validerEtape(cle, v)   message qui empêche de quitter une étape, ou null
 *   confirmerAvantEnvoi(v) { titre, texte, icone, envoyer, abandonner } pour demander confirmation, ou null
 *   onEnregistrer(payload, { creation, valeurs })
 */
export default function ModaleFormulaire({
  ouvert, onFermer, icone, titres = {}, surtitres = {}, sousTitre, champs, sections, objet, valider,
  onEnregistrer, taille = 'lg', libelleEnregistrer, children,
  etapes = false, initiales, validerEtape, confirmerAvantEnvoi,
}) {
  const creation = !objet;
  // Champs et sections réservés à la création retirés en modification
  const champsActifs = useMemo(() => champs.filter((c) => !(c.creation && !creation)), [champs, creation]);
  const listeSections = useMemo(() => {
    const l = (sections?.length ? sections : [{ cle: 'general', label: t('Général') }]).filter((s) => !(s.creation && !creation));
    return l.length ? l : [{ cle: 'general', label: t('Général') }];
  }, [sections, creation]);

  const f = useFormulaire(champsActifs);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [section, setSection] = useState(listeSections[0].cle);
  const [etapeMax, setEtapeMax] = useState(0);
  const [confirmation, setConfirmation] = useState(null);

  // Remplit le formulaire à chaque ouverture (création ou modification)
  useEffect(() => {
    if (!ouvert) return;
    const v = valeursDepuis(champsActifs, objet);
    if (creation && initiales) {
      Object.entries(initiales).forEach(([k, x]) => {
        if (x !== undefined && x !== null && x !== '' && k in v) v[k] = typeof x === 'object' ? x : String(x);
      });
    }
    f.definir(v);
    setErreur(null);
    setConfirmation(null);
    setSection(listeSections[0].cle);
    setEtapeMax(0);
  }, [ouvert, objet]); // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => { if (!envoi) onFermer(); };

  const indexSection = Math.max(0, listeSections.findIndex((s) => s.cle === section));
  const sectionCourante = listeSections[indexSection];
  const plusieurs = listeSections.length > 1;
  const derniere = indexSection === listeSections.length - 1;

  /** Erreurs des champs d'une section (affichées sous les champs) ; vrai si elle est correcte. */
  const sectionValide = (cle) => {
    const erreurs = {};
    champsActifs.filter((c) => (c.section || 'general') === cle).forEach((c) => {
      const m = validerChamp(c, f.valeurs[c.nom], f.valeurs);
      if (m) erreurs[c.nom] = m;
    });
    f.setErreurs((e) => ({ ...e, ...erreurs }));
    const message = Object.values(erreurs)[0] || validerEtape?.(cle, f.valeurs) || null;
    setErreur(message);
    return !message;
  };

  const suivant = () => {
    if (!sectionValide(section)) return;
    const i = Math.min(indexSection + 1, listeSections.length - 1);
    setEtapeMax((m) => Math.max(m, i));
    setSection(listeSections[i].cle);
  };

  const precedent = () => {
    setErreur(null);
    setSection(listeSections[Math.max(0, indexSection - 1)].cle);
  };

  const enregistrer = async (e, confirme = false) => {
    e?.preventDefault?.();
    // En assistant, « Entrée » avant la dernière étape fait « Suivant »
    if (etapes && creation && !derniere && e?.type === 'submit') { suivant(); return; }
    const erreurs = f.valider();
    if (erreurs) {
      const premier = champsActifs.find((c) => erreurs[c.nom]);
      if (premier) setSection(premier.section || 'general');
      setErreur(erreurs[premier?.nom] || t('Corrigez les champs signalés.'));
      return;
    }
    if (etapes) {
      for (const s of listeSections) {
        const m = validerEtape?.(s.cle, f.valeurs);
        if (m) { setSection(s.cle); setErreur(m); return; }
      }
    }
    const message = valider?.(f.valeurs);
    if (message) { setErreur(message); return; }
    if (!confirme) {
      const c = confirmerAvantEnvoi?.(f.valeurs);
      if (c) { setConfirmation(c); return; }
    }
    setConfirmation(null);
    setEnvoi(true);
    setErreur(null);
    try {
      await onEnregistrer(versPayload(champsActifs, f.valeurs), { creation, valeurs: f.valeurs });
      onFermer();
    } catch (err) {
      setErreur(err?.response?.data?.message || err?.message || t('Échec de l’enregistrement.'));
    } finally {
      setEnvoi(false);
    }
  };

  const enAssistant = etapes && plusieurs;
  const infoSections = listeSections.map((s, i) => ({
    ...s,
    erreur: f.erreursParSection[s.cle],
    accessible: !enAssistant || !creation || i <= etapeMax,
    fait: enAssistant && i < etapeMax && i !== indexSection, // étapes déjà passées avec « Suivant »
  }));
  const BoutonEnregistrer = (
    <button type="submit" form="cm-formulaire" className="cm-btn cm-btn--principal" disabled={envoi}
      onClick={(e) => { e.preventDefault(); enregistrer(null); }}>
      {envoi ? <Loader2 size={16} className="cf-tourne" /> : <Save size={16} />}
      {envoi ? t('Enregistrement…') : (libelleEnregistrer || (creation ? t('Créer') : t('Enregistrer')))}
    </button>
  );
  const IconeConfirmation = confirmation?.icone;

  return (
    <Modale
      ouvert={ouvert}
      onFermer={fermer}
      fermerSurFond={!f.sale}
      icone={icone}
      taille={taille}
      surtitre={creation ? (surtitres.creation || t('Nouvelle entrée')) : (surtitres.modification || t('Modification'))}
      titre={creation ? titres.creation : titres.modification}
      sousTitre={sousTitre}
      etapes={enAssistant}
      sections={infoSections}
      sectionActive={section}
      onSection={(cle) => { setErreur(null); setSection(cle); }}
      infoPied={plusieurs ? (enAssistant ? t('Étape {n} / {total}', { n: indexSection + 1, total: listeSections.length }) : `${indexSection + 1} / ${listeSections.length}`) : null}
      pied={(
        <>
          <button type="button" className="cm-btn cm-btn--lien" onClick={fermer} disabled={envoi}>{t('Annuler')}</button>
          {enAssistant && indexSection > 0 && (
            <button type="button" className="cm-btn" onClick={precedent} disabled={envoi}>
              <ArrowLeft size={16} /> {t('Précédent')}
            </button>
          )}
          {enAssistant && !derniere && (
            <button type="button" className={`cm-btn ${creation ? 'cm-btn--principal' : ''}`} onClick={suivant} disabled={envoi}>
              {t('Suivant')} <ArrowRight size={16} />
            </button>
          )}
          {(!enAssistant || derniere || !creation) && BoutonEnregistrer}
        </>
      )}
    >
      <form id="cm-formulaire" onSubmit={enregistrer} noValidate>
        <div className="cm-section-tete">
          <h3>{t(sectionCourante.label)}</h3>
          {sectionCourante.description && <p>{t(sectionCourante.description)}</p>}
        </div>
        {erreur && <p className="cm-alerte" role="alert"><AlertCircle size={16} aria-hidden="true" /> {erreur}</p>}
        <Formulaire champs={champsActifs} valeurs={f.valeurs} erreurs={f.erreurs} section={plusieurs ? section : undefined}
          onChange={(nom, v) => { setErreur(null); f.changer(nom, v); }} />
        {typeof children === 'function' ? children({ valeurs: f.valeurs, changer: f.changer, section }) : children}
      </form>

      {confirmation && (
        <div className="cm-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="cm-confirmation-titre">
          <div className="cm-confirmation__boite">
            {IconeConfirmation && <span className="cm-confirmation__icone"><IconeConfirmation size={26} aria-hidden="true" /></span>}
            <h3 id="cm-confirmation-titre">{confirmation.titre}</h3>
            {confirmation.texte && <p>{confirmation.texte}</p>}
            <div className="cm-confirmation__boutons">
              <button type="button" className="cm-btn cm-btn--principal" onClick={() => { setConfirmation(null); onFermer(); }}>
                {confirmation.abandonner || t('Ne pas envoyer')}
              </button>
              <button type="button" className="cm-btn" onClick={() => enregistrer(null, true)}>
                {confirmation.envoyer || t('Envoyer quand même')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modale>
  );
}
