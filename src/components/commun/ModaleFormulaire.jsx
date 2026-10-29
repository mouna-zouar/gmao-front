import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import Modale from './Modale';
import Formulaire from './Formulaire';
import { useFormulaire, valeursDepuis, versPayload } from './useFormulaire';
import { t } from '../../i18n';


export default function ModaleFormulaire({
  ouvert, onFermer, icone, titres = {}, surtitres = {}, sousTitre, champs, sections, objet, valider,
  onEnregistrer, taille = 'lg', libelleEnregistrer, children,
}) {
  const creation = !objet;
  const f = useFormulaire(champs);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const listeSections = sections?.length ? sections : [{ cle: 'general', label: t('Général') }];
  const [section, setSection] = useState(listeSections[0].cle);

  // Remplit le formulaire à chaque ouverture (création ou modification)
  useEffect(() => {
    if (!ouvert) return;
    f.definir(valeursDepuis(champs, objet));
    setErreur(null);
    setSection(listeSections[0].cle);
  }, [ouvert, objet]); // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => { if (!envoi) onFermer(); };

  const enregistrer = async (e) => {
    e?.preventDefault?.();
    const erreurs = f.valider();
    if (erreurs) {
      const premier = champs.find((c) => erreurs[c.nom]);
      if (premier) setSection(premier.section || 'general');
      setErreur(t('Corrigez les champs signalés.'));
      return;
    }
    const message = valider?.(f.valeurs);
    if (message) { setErreur(message); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await onEnregistrer(versPayload(champs, f.valeurs), { creation, valeurs: f.valeurs });
      onFermer();
    } catch (err) {
      setErreur(err?.response?.data?.message || err?.message || t('Échec de l’enregistrement.'));
    } finally {
      setEnvoi(false);
    }
  };

  const indexSection = listeSections.findIndex((s) => s.cle === section);
  const sectionCourante = listeSections[indexSection] || listeSections[0];
  const plusieurs = listeSections.length > 1;

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
      sections={listeSections.map((s) => ({ ...s, erreur: f.erreursParSection[s.cle] }))}
      sectionActive={section}
      onSection={setSection}
      infoPied={plusieurs ? `${indexSection + 1} / ${listeSections.length}` : null}
      pied={(
        <>
          <button type="button" className="cm-btn cm-btn--lien" onClick={fermer} disabled={envoi}>{t('Annuler')}</button>
          <button type="submit" form="cm-formulaire" className="cm-btn cm-btn--principal" disabled={envoi}>
            {envoi ? <Loader2 size={16} className="cf-tourne" /> : <Save size={16} />}
            {envoi ? t('Enregistrement…') : (libelleEnregistrer || (creation ? t('Créer') : t('Enregistrer')))}
          </button>
        </>
      )}
    >
      <form id="cm-formulaire" onSubmit={enregistrer} noValidate>
        <div className="cm-section-tete">
          <h3>{t(sectionCourante.label)}</h3>
          {sectionCourante.description && <p>{t(sectionCourante.description)}</p>}
        </div>
        {erreur && <p className="cm-alerte" role="alert"><AlertCircle size={16} aria-hidden="true" /> {erreur}</p>}
        <Formulaire champs={champs} valeurs={f.valeurs} erreurs={f.erreurs} onChange={f.changer} section={plusieurs ? section : undefined} />
        {typeof children === 'function' ? children({ valeurs: f.valeurs, changer: f.changer, section }) : children}
      </form>
    </Modale>
  );
}
