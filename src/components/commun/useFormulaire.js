import { useCallback, useMemo, useState } from 'react';
import { t } from '../../i18n';

/*
 * Formulaires décrits par une liste de champs (même description pour l'affichage, la validation et l'envoi).
 *
 *   const CHAMPS = [
 *     { nom: 'nom', label: 'Nom', type: 'texte', requis: true, longueurMax: 120, section: 'general' },
 *     { nom: 'villeId', label: 'Ville', type: 'liste', chargerOptions: () => villeService.liste(), optionValeur: 'id', optionLabel: 'nom' },
 *   ];
 *
 * Types : texte · email · tel · nombre · montant · zone (texte long) · liste · date · dateheure · case · equipement · personnalise
 * Règles : requis · min · max · longueurMax · motif (RegExp) · valider(valeur, valeurs) → message ou null
 * Affichage : largeur 'pleine' | 'demi' (défaut) · aide · placeholder · icone · visible(valeurs) · desactive(valeurs)
 * Envoi : versPayload convertit (texte vide → null, nombres, listes numériques) ; transformer(valeur, valeurs) pour un cas particulier.
 */

const vide = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Valeurs de départ du formulaire à partir d'un objet existant (modification) ou des valeurs par défaut (création). */
export function valeursDepuis(champs, objet) {
  const v = {};
  champs.forEach((c) => {
    const brut = objet?.[c.nom];
    if (brut !== undefined && brut !== null) {
      if (c.type === 'date') v[c.nom] = String(brut).slice(0, 10);
      else if (c.type === 'dateheure') v[c.nom] = String(brut).slice(0, 16);
      else if (c.type === 'case') v[c.nom] = Boolean(brut);
      else v[c.nom] = typeof brut === 'object' ? brut : String(brut);
    } else {
      v[c.nom] = c.defaut !== undefined ? c.defaut : (c.type === 'case' ? false : '');
    }
  });
  return v;
}

/** Message d'erreur d'un champ, ou null. */
export function validerChamp(c, valeur, valeurs) {
  if (c.visible && !c.visible(valeurs)) return null;
  if (c.requis && (vide(valeur) || (c.type === 'case' && c.requis === 'coche' && !valeur))) {
    return c.messageRequis || t('Ce champ est obligatoire.');
  }
  if (!vide(valeur)) {
    if (['nombre', 'montant'].includes(c.type)) {
      const n = Number(String(valeur).replace(',', '.'));
      if (Number.isNaN(n)) return t('Nombre attendu.');
      if (c.min != null && n < c.min) return t('Valeur minimale : {n}.', { n: c.min });
      if (c.max != null && n > c.max) return t('Valeur maximale : {n}.', { n: c.max });
    }
    if (c.longueurMax && String(valeur).length > c.longueurMax) return t('{n} caractères au plus.', { n: c.longueurMax });
    if (c.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valeur))) return t('Adresse email invalide.');
    if (c.motif && !c.motif.test(String(valeur))) return c.messageMotif || t('Format invalide.');
  }
  if (c.valider) return c.valider(valeur, valeurs) || null;
  return null;
}

/** Objet envoyé au serveur : conversions faites, champs masqués ignorés. */
export function versPayload(champs, valeurs) {
  const p = {};
  champs.forEach((c) => {
    if (c.envoyer === false) return;
    let v = valeurs[c.nom];
    if (c.transformer) { p[c.nom] = c.transformer(v, valeurs); return; }
    if (c.visible && !c.visible(valeurs)) v = null;
    if (typeof v === 'string') v = v.trim();
    if (vide(v)) { p[c.nom] = c.type === 'case' ? false : null; return; }
    if (['nombre', 'montant'].includes(c.type)) p[c.nom] = Number(String(v).replace(',', '.'));
    else if (c.type === 'liste' && c.numerique !== false && /^-?\d+$/.test(String(v))) p[c.nom] = Number(v);
    else if (c.type === 'equipement') p[c.nom] = Number(v);
    else if (c.type === 'dateheure' && String(v).length === 16) p[c.nom] = `${v}:00`;
    else p[c.nom] = v;
  });
  return p;
}

/**
 * État d'un formulaire décrit par ses champs.
 * → { valeurs, erreurs, changer(nom, valeur), definir(valeurs), valider() → bool, sale, erreursParSection }
 */
export function useFormulaire(champs, initiales) {
  const [valeurs, setValeurs] = useState(() => initiales || valeursDepuis(champs, null));
  const [erreurs, setErreurs] = useState({});
  const [sale, setSale] = useState(false);

  const changer = useCallback((nom, valeur) => {
    setSale(true);
    setValeurs((v) => ({ ...v, [nom]: valeur }));
    setErreurs((e) => (e[nom] ? { ...e, [nom]: null } : e));
  }, []);

  const definir = useCallback((v) => { setValeurs(v); setErreurs({}); setSale(false); }, []);

  const valider = useCallback(() => {
    const e = {};
    champs.forEach((c) => {
      const m = validerChamp(c, valeurs[c.nom], valeurs);
      if (m) e[c.nom] = m;
    });
    setErreurs(e);
    return Object.keys(e).length === 0 ? null : e;
  }, [champs, valeurs]);

  const erreursParSection = useMemo(() => {
    const parSection = {};
    champs.forEach((c) => { if (erreurs[c.nom]) parSection[c.section || 'general'] = true; });
    return parSection;
  }, [champs, erreurs]);

  return { valeurs, erreurs, changer, definir, valider, sale, erreursParSection, setErreurs };
}
