// ============================================================
// SYSTÈME DE LANGUE (français / arabe / anglais)
//
// Principe : le texte français EST la clé.
//   t('Faire le diagnostic')            → « تشخيص العطل » en arabe, « Do the diagnosis » en anglais
//   t('Étape {n} sur {total}', { n, total })
//   tp('événement', 3)                  → « 3 événements » / « 3 أحداث » (pluriel arabe géré)
// Une phrase absente d'un dictionnaire reste en français : rien ne casse.
// ============================================================
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ar from './ar';
import en from './en';
import './rtl.css';

export const LANGUES = {
  fr: { code: 'fr', nom: 'Français', dir: 'ltr', locale: 'fr-FR' },
  ar: { code: 'ar', nom: 'العربية', dir: 'rtl', locale: 'ar-TN' }, // ar-TN : chiffres latins (12/10/2026)
  en: { code: 'en', nom: 'English', dir: 'ltr', locale: 'en-GB' }, // en-GB : dates jj/mm/aaaa
};

const CLE_STOCKAGE = 'app-langue';
const DICTIONNAIRES = { ar, en };

function lireLangueStockee() {
  try {
    const v = window.localStorage.getItem(CLE_STOCKAGE);
    return LANGUES[v] ? v : 'fr';
  } catch {
    return 'fr';
  }
}

// Langue courante accessible partout (y compris dans les fonctions hors composants)
let langueCourante = typeof window !== 'undefined' ? lireLangueStockee() : 'fr';

function appliquerAuDocument(code) {
  if (typeof document === 'undefined') return;
  const l = LANGUES[code];
  document.documentElement.lang = l.code;
  document.documentElement.dir = l.dir;
}

function remplir(texte, vars) {
  if (!vars) return texte;
  return texte.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** Traduit une phrase française. Renvoie la phrase d'origine si elle n'a pas de traduction. */
export function t(texte, vars) {
  if (texte == null || typeof texte !== 'string') return texte;
  const dico = DICTIONNAIRES[langueCourante];
  const trad = dico && typeof dico[texte] === 'string' ? dico[texte] : texte;
  return remplir(trad, vars);
}

/**
 * Comme t(), mais pour les PDF jsPDF : sa police standard n'affiche pas l'arabe,
 * donc on traduit en anglais si l'anglais est choisi, sinon on garde le français.
 */
export function tPdf(texte, vars) {
  if (texte == null || typeof texte !== 'string') return texte;
  const trad = langueCourante === 'en' && typeof en[texte] === 'string' ? en[texte] : texte;
  return remplir(trad, vars);
}

/** Locale à utiliser dans les PDF (même règle que tPdf). */
export function localePdf() {
  return langueCourante === 'en' ? LANGUES.en.locale : LANGUES.fr.locale;
}

// Pluriels français de base (les dictionnaires arabe et anglais définissent leurs propres formes)
const PLURIELS_FR = {
  'événement': { one: '{n} événement', other: '{n} événements' },
  personne: { one: '{n} personne', other: '{n} personnes' },
  bon: { one: '{n} bon lié', other: '{n} bons liés' },
  action: { one: '{n} action à suivre', other: '{n} actions à suivre' },
  'diagnostic fait': { one: '{n} fait', other: '{n} faits' },
  'terminé sur': { one: '{n}/{total} terminé', other: '{n}/{total} terminés' },
  jour: { one: '{n} jour', other: '{n} jours' },
  'il y a jours': { one: 'il y a {n} jour', other: 'il y a {n} jours' },
  'bon (compte)': { one: '{n} bon', other: '{n} bons' },
  'résultat': { one: '{n} résultat', other: '{n} résultats' },
  demande: { one: '{n} demande', other: '{n} demandes' },
  'analyse RCA': { one: '{n} analyse RCA', other: '{n} analyses RCA' },
  'action CAPA ouverte': { one: '{n} action CAPA ouverte', other: '{n} actions CAPA ouvertes' },
  'réclamation récente': { one: '{n} réclamation récente', other: '{n} réclamations récentes' },
  'panne sur 12 mois': { one: '{n} panne / 12 mois', other: '{n} pannes / 12 mois' },
  'depuis jours': { one: 'depuis {n} jour', other: 'depuis {n} jours' },
  opération: { one: '{n} opération', other: '{n} opérations' },
  'équipement': { one: '{n} équipement', other: '{n} équipements' },
  'équipement à risque critique (libellé)': { one: 'équipement à risque critique', other: 'équipements à risque critique' },
  an: { one: '{n} an', other: '{n} ans' },
  technicien: { one: '{n} technicien', other: '{n} techniciens' },
  '+ autre': { one: '+{n} autre', other: '+{n} autres' },
  'équipement filtré': { one: '{n} équipement filtré', other: '{n} équipements filtrés' },
  'bon analysé': { one: '{n} bon analysé', other: '{n} bons analysés' },
  'source (libellé)': { one: 'Source', other: 'Sources' },
  'maintenance en retard': { one: '{n} maintenance en retard', other: '{n} maintenances en retard' },
  'véhicule': { one: '{n} véhicule', other: '{n} véhicules' },
  'dans jours': { one: 'Dans {n} jour', other: 'Dans {n} jours' },
  ligne: { one: '{n} ligne', other: '{n} lignes' },
  'nouvelle anomalie': { one: '{n} nouvelle anomalie détectée', other: '{n} nouvelles anomalies détectées' },
  'nouveau blocage': { one: '{n} nouveau blocage détecté', other: '{n} nouveaux blocages détectés' },
  'jours sans suite': { one: '{n} j sans suite', other: '{n} j sans suite' },
};

/** Pluriel : tp('événement', 3) → « 3 événements ». En arabe : règles 0, 1, 2, 3-10, 11+. */
export function tp(cle, n, vars = {}) {
  const regles = new Intl.PluralRules(LANGUES[langueCourante].locale);
  const categorie = regles.select(n);
  const dico = DICTIONNAIRES[langueCourante];
  const formesLangue = dico ? dico[`#${cle}`] : null;
  const formes = formesLangue || PLURIELS_FR[cle];
  if (!formes) return `${n} ${cle}`;
  const modele = formes[categorie] ?? formes.other;
  return remplir(modele, { n, ...vars });
}

/** Locale pour toLocaleString / toLocaleDateString. */
export function locale() {
  return LANGUES[langueCourante].locale;
}

export function langueActuelle() {
  return langueCourante;
}

export function estRTL() {
  return LANGUES[langueCourante].dir === 'rtl';
}

// ============================================================
// CONTEXTE REACT
// ============================================================
const LangueContext = createContext({
  langue: 'fr',
  dir: 'ltr',
  setLangue: () => {},
  t,
  tp,
  locale,
});

export function LangueProvider({ children, langueInitiale }) {
  const [langue, setLangueState] = useState(() => {
    const l = langueInitiale && LANGUES[langueInitiale] ? langueInitiale : langueCourante;
    langueCourante = l;
    return l;
  });

  useEffect(() => { appliquerAuDocument(langue); }, [langue]);

  const setLangue = useCallback((code) => {
    if (!LANGUES[code]) return;
    langueCourante = code; // avant le rendu, pour que t() soit déjà à jour
    try { window.localStorage.setItem(CLE_STOCKAGE, code); } catch { /* stockage indisponible */ }
    setLangueState(code);
  }, []);

  const valeur = useMemo(() => ({
    langue,
    dir: LANGUES[langue].dir,
    setLangue,
    t,
    tp,
    locale,
  }), [langue, setLangue]);

  // La clé force un nouveau rendu de toute l'application au changement de langue
  // (le changement est rare : c'est un réglage global).
  return (
    <LangueContext.Provider value={valeur}>
      <Fragment key={langue}>{children}</Fragment>
    </LangueContext.Provider>
  );
}

export function useLangue() {
  return useContext(LangueContext);
}

// ============================================================
// SÉLECTEUR À PLACER DANS LES RÉGLAGES / LE MENU DE L'APPLICATION
// ============================================================
export function SelecteurLangue({ className = '' }) {
  const { langue, setLangue } = useLangue();
  return (
    <div className={`selecteur-langue ${className}`} role="radiogroup" aria-label={t('Langue')}>
      {Object.values(LANGUES).map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={langue === l.code}
          lang={l.code}
          className={`selecteur-langue-btn ${langue === l.code ? 'is-actif' : ''}`}
          onClick={() => setLangue(l.code)}
        >
          {l.nom}
        </button>
      ))}
    </div>
  );
}