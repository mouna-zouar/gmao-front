import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hash, Palette } from 'lucide-react';
import ModaleFormulaire from '../ModaleFormulaire';
import {
  COULEURS_TONS, ICONES_CARTE, PAGES_LIEN, STYLE_PAR_GROUPE, couleurHex,
} from './outilsPerso';
import { t } from '../../../i18n';

const avecPrecedent = (INDICATEURS, cle) => Boolean(INDICATEURS.find((i) => i.cle === cle)?.precedent);
const groupeDe = (INDICATEURS, cle) => INDICATEURS.find((i) => i.cle === cle)?.groupe;

function carteDepuisValeurs(INDICATEURS, v) {
  const indicateur = INDICATEURS.find((i) => i.cle === v.indicateur);
  const libre = String(v.teinte || '').startsWith('#') ? couleurHex(v.teinte) : null;
  return {
    titre: String(v.titre || '').trim() || (indicateur ? t(indicateur.label) : t('Nouvelle carte')),
    indicateur: v.indicateur || null,
    comparer: Boolean(v.comparer) && avecPrecedent(INDICATEURS, v.indicateur),
    ton: libre ? 'neutre' : (v.teinte || 'teal'),
    couleur: libre,
    icone: v.icone || 'nombre',
    lien: v.lien || null,
  };
}

function Apercu({ indicateurs: INDICATEURS, valeurs, changerChamp, rendreApercu }) {
  const indicateurPrecedent = useRef(valeurs.indicateur);
  useEffect(() => {
    if (valeurs.indicateur === indicateurPrecedent.current) return;
    indicateurPrecedent.current = valeurs.indicateur;
    if (valeurs.styleAuto === false) return;
    const style = STYLE_PAR_GROUPE[groupeDe(INDICATEURS, valeurs.indicateur)];
    if (style) { changerChamp('icone', style.icone); changerChamp('teinte', style.teinte); }
  }, [INDICATEURS, valeurs.indicateur, valeurs.styleAuto, changerChamp]);
  return (
    <div className="mcc-apercu">
      <span className="mcc-apercu-label">{t('Aperçu')}</span>
      <div className="mcc-apercu-carte">{rendreApercu(carteDepuisValeurs(INDICATEURS, valeurs))}</div>
    </div>
  );
}

function ChoixCouleur({ valeur, changer, changerChamp }) {
  const libre = String(valeur || '').startsWith('#') ? valeur : null;
  const [saisie, setSaisie] = useState(libre || '');
  const [invalide, setInvalide] = useState(false);
  const choisir = (v) => { changer(v); changerChamp('styleAuto', false); };
  const valider = (texte) => {
    setSaisie(texte);
    const hex = couleurHex(texte);
    setInvalide(Boolean(texte) && !hex);
    if (hex) choisir(hex);
  };
  return (
    <div className="mcc-couleurs">
      <div className="mcc-pastilles" role="radiogroup" aria-label={t('Couleur')}>
        {Object.entries(COULEURS_TONS).map(([cle, c]) => (
          <button key={cle} type="button" role="radio" aria-checked={valeur === cle} title={t(c.label)} aria-label={t(c.label)}
            className={`mcc-pastille ${valeur === cle ? 'is-actif' : ''}`} style={{ '--p': c.hex }} onClick={() => choisir(cle)}>
            {valeur === cle && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
        <label className={`mcc-pastille mcc-pastille--libre ${libre ? 'is-actif' : ''}`} style={libre ? { '--p': libre } : undefined}
          title={t('Couleur personnalisée')}>
          <input type="color" value={libre || '#0d9488'} onChange={(e) => valider(e.target.value)} aria-label={t('Couleur personnalisée')} />
          {libre ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <Palette size={15} aria-hidden="true" />}
        </label>
      </div>
      <input type="text" className={`mcc-code ${invalide ? 'is-invalide' : ''}`} value={saisie} spellCheck={false}
        onChange={(e) => valider(e.target.value)} placeholder="#1a73e8 · rgb(26, 115, 232)" aria-label={t('Code couleur')} />
    </div>
  );
}

function ChoixIcone({ valeur, changer, changerChamp, valeurs }) {
  const teinte = valeurs.teinte;
  const hex = String(teinte || '').startsWith('#') ? teinte : COULEURS_TONS[teinte]?.hex;
  return (
    <div className="mcc-icones" role="radiogroup" aria-label={t('Icône')} style={hex ? { '--p': hex } : undefined}>
      {Object.entries(ICONES_CARTE).map(([cle, { label, icone: Icone }]) => (
        <button key={cle} type="button" role="radio" aria-checked={valeur === cle} title={t(label)} aria-label={t(label)}
          className={`mcc-icone ${valeur === cle ? 'is-actif' : ''}`} onClick={() => { changer(cle); changerChamp('styleAuto', false); }}>
          <Icone size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default function ModaleCarteChiffree({ indicateurs: INDICATEURS, surtitre, pagesLien = PAGES_LIEN, ouvert, carte, onFermer, onEnregistrer, rendreApercu, valeurIndicateur }) {
  const champs = useMemo(() => [
    {
      nom: 'apercu', type: 'personnalise', largeur: 'pleine', envoyer: false,
      rendu: ({ valeurs, changerChamp }) => <Apercu indicateurs={INDICATEURS} valeurs={valeurs} changerChamp={changerChamp} rendreApercu={rendreApercu} />,
    },
    { nom: 'styleAuto', type: 'personnalise', defaut: true, envoyer: false, visible: () => false, rendu: () => null },
    { nom: 'titre', label: 'Titre', type: 'texte', largeur: 'pleine', longueurMax: 60 },
    {
      nom: 'indicateur', label: 'Indicateur', type: 'recherche', requis: true, largeur: 'pleine', numerique: false,
      options: INDICATEURS.map((i) => ({ value: i.cle, label: t(i.label), groupe: i.groupe })),
      optionAide: (o) => `${t(o.groupe)} · ${valeurIndicateur(o.value)}`,
    },
    { nom: 'comparer', type: 'case', texteCase: 'Comparer à la période précédente', largeur: 'pleine', visible: (v) => avecPrecedent(INDICATEURS, v.indicateur) },
    {
      nom: 'teinte', label: 'Couleur', type: 'personnalise', largeur: 'pleine', defaut: 'teal',
      rendu: ({ valeur, changer, changerChamp }) => <ChoixCouleur valeur={valeur} changer={changer} changerChamp={changerChamp} />,
    },
    {
      nom: 'icone', label: 'Icône', type: 'personnalise', largeur: 'pleine', defaut: 'nombre',
      rendu: ({ valeur, changer, changerChamp, valeurs }) => <ChoixIcone valeur={valeur} changer={changer} changerChamp={changerChamp} valeurs={valeurs} />,
    },
    { nom: 'lien', label: 'Page à ouvrir au clic', type: 'liste', largeur: 'pleine', numerique: false, optionVide: '— Aucune —', options: pagesLien, traduireOptions: true },
  ], [INDICATEURS, pagesLien, rendreApercu, valeurIndicateur]);

  const objet = useMemo(() => (carte ? { ...carte, teinte: carte.couleur || carte.ton || 'teal', styleAuto: false } : null), [carte]);

  const enregistrer = async (_payload, { valeurs }) => {
    onEnregistrer({ ...(carte?.id ? { id: carte.id } : {}), ...carteDepuisValeurs(INDICATEURS, valeurs) });
  };

  return (
    <ModaleFormulaire
      ouvert={ouvert}
      onFermer={onFermer}
      icone={Hash}
      taille="md"
      titres={{ creation: t('Nouvelle carte chiffrée'), modification: t('Modifier la carte') }}
      surtitres={{ creation: surtitre || t('Tableau de bord'), modification: surtitre || t('Tableau de bord') }}
      champs={champs}
      sections={[{ cle: 'general', label: 'Carte' }]}
      objet={objet}
      onEnregistrer={enregistrer}
    />
  );
}
