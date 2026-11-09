import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ChampEquipement from '../ui/ChampEquipement/ChampEquipement';
import ListeRecherche from './ListeRecherche';
import { t } from '../../i18n';
import './commun.css';


const cacheOptions = new Map();

/*
 * Options d'une liste : options (tableau, ou fonction (valeurs) → tableau) ou chargerOptions(valeurs) → promesse.
 * cleOptions (texte, ou fonction (valeurs) → texte) : quand elle change, la liste est rechargée
 * (ex. dépôts du service choisi : cleOptions: (v) => `depots-${v.serviceId}`).
 */
function useOptions(champ, valeurs) {
  const cle = typeof champ.cleOptions === 'function' ? champ.cleOptions(valeurs) : (champ.cleOptions || (champ.chargerOptions ? `${champ.nom}` : null));
  const statiques = typeof champ.options === 'function' ? champ.options(valeurs) : (champ.options || []);
  const [etat, setEtat] = useState(() => (cle && cacheOptions.has(cle) ? { liste: cacheOptions.get(cle), chargement: false } : { liste: statiques, chargement: Boolean(champ.chargerOptions) }));
  const valeursRef = useRef(valeurs);
  valeursRef.current = valeurs;
  useEffect(() => {
    if (!champ.chargerOptions) return undefined;
    if (cle && cacheOptions.has(cle) && !champ.sansCache) { setEtat({ liste: cacheOptions.get(cle), chargement: false }); return undefined; }
    let annule = false;
    setEtat((e) => ({ ...e, chargement: true }));
    Promise.resolve(champ.chargerOptions(valeursRef.current))
      .then((r) => {
        const liste = Array.isArray(r) ? r : (r?.content ?? r?.data ?? []);
        if (!champ.sansCache && cle) cacheOptions.set(cle, liste);
        if (!annule) setEtat({ liste, chargement: false });
      })
      .catch(() => { if (!annule) setEtat({ liste: [], chargement: false, erreur: true }); });
    return () => { annule = true; };
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps
  const brute = champ.chargerOptions ? etat.liste : statiques;
  // filtrerOptions(liste, valeurs) : ne garder que les options compatibles avec les autres champs
  const liste = champ.filtrerOptions ? champ.filtrerOptions(brute, valeurs) : brute;
  return { liste, chargement: champ.chargerOptions ? etat.chargement : false };
}

const valeurOption = (champ, o) => (typeof o === 'object' ? o[champ.optionValeur || 'value'] ?? o.id : o);
const labelOption = (champ, o) => {
  if (typeof o !== 'object') return String(o);
  if (typeof champ.optionLabel === 'function') return champ.optionLabel(o);
  return o[champ.optionLabel || 'label'] ?? o.nom ?? o.libelle ?? String(valeurOption(champ, o));
};

/** Un champ : libellé, saisie selon le type, aide et message d'erreur. */
export function Champ({ champ, valeur, erreur, onChange, valeurs }) {
  const options = useOptions(champ, valeurs);
  const estListe = champ.type === 'liste' || champ.type === 'recherche';

  // viderSiAbsent : la valeur choisie n'est plus dans la liste (filtrée par un autre champ) → on la vide
  // libelleVers : recopie le libellé de l'option choisie dans un autre champ (ex. serviceNom)
  const choisie = estListe && valeur !== '' && valeur != null
    ? options.liste.find((o) => String(valeurOption(champ, o)) === String(valeur)) : null;
  useEffect(() => {
    if (!estListe || options.chargement) return;
    if (champ.viderSiAbsent && valeur !== '' && valeur != null && !choisie) { onChange(champ.nom, ''); return; }
    if (champ.libelleVers) {
      const libelle = choisie ? labelOption(champ, choisie) : (valeur ? valeurs?.[champ.libelleVers] ?? '' : '');
      if ((valeurs?.[champ.libelleVers] ?? '') !== libelle) onChange(champ.libelleVers, libelle);
    }
  }, [estListe, options.chargement, valeur, choisie]); // eslint-disable-line react-hooks/exhaustive-deps

  const id = `cf-${champ.nom}`;
  const desactive = typeof champ.desactive === 'function' ? champ.desactive(valeurs) : champ.desactive;
  const Icone = champ.icone;
  const commun = {
    id, name: champ.nom, disabled: desactive, 'aria-invalid': erreur ? true : undefined,
    'aria-describedby': erreur || champ.aide ? `${id}-aide` : undefined,
    placeholder: champ.placeholder ? t(champ.placeholder) : undefined,
    ...(champ.autoFocus ? { 'data-autofocus': true } : {}),
  };
  const changer = (v) => onChange(champ.nom, v);

  let saisie;
  switch (champ.type) {
    case 'zone':
      saisie = <textarea {...commun} rows={champ.lignes || 4} value={valeur ?? ''} maxLength={champ.longueurMax} onChange={(e) => changer(e.target.value)} dir="auto" />;
      break;
    case 'liste':
      saisie = (
        <div className="cf-liste">
          <select {...commun} value={valeur ?? ''} onChange={(e) => changer(e.target.value)}>
            <option value="">{champ.optionVide ? t(champ.optionVide) : options.chargement ? t('Chargement…') : t('— Choisir —')}</option>
            {options.liste.map((o) => {
              const v = valeurOption(champ, o);
              return <option key={String(v)} value={v}>{champ.traduireOptions ? t(labelOption(champ, o)) : labelOption(champ, o)}</option>;
            })}
          </select>
          {options.chargement && <Loader2 size={14} className="cf-tourne" aria-hidden="true" />}
        </div>
      );
      break;
    case 'recherche':
      saisie = (
        <ListeRecherche id={id} name={champ.nom} value={valeur ?? ''} onChange={(e) => changer(e.target.value)}
          options={options.liste} loading={options.chargement} disabled={desactive}
          getValue={(o) => valeurOption(champ, o)} getLabel={(o) => labelOption(champ, o)}
          getOptionHint={champ.optionAide || (() => null)}
          placeholder={champ.placeholder ? t(champ.placeholder) : t('Rechercher…')}
          emptyMessage={t('Aucun résultat')} allowEmpty={!champ.requis}
          emptyOptionLabel={champ.optionVide ? t(champ.optionVide) : t('— Aucun —')} />
      );
      break;
    case 'case':
      saisie = (
        <label className="cf-case">
          <input type="checkbox" id={id} name={champ.nom} checked={Boolean(valeur)} disabled={desactive} onChange={(e) => changer(e.target.checked)} />
          <span>{t(champ.texteCase || champ.label)}</span>
        </label>
      );
      break;
    case 'equipement':
      // champ.service : nom du champ service — liste limitée à ce service, et service rempli d'après l'équipement choisi
      saisie = (
        <ChampEquipement id={id} name={champ.nom} value={valeur ?? ''} onChange={(e) => changer(e.target.value)} facultatif={!champ.requis} disabled={desactive}
          autoFocus={champ.autoFocus}
          serviceId={champ.service ? valeurs?.[champ.service] || null : null}
          serviceNom={champ.serviceLibelle ? valeurs?.[champ.serviceLibelle] || '' : ''}
          onEquipementChoisi={champ.service ? (e) => {
            if (e?.serviceId == null || String(e.serviceId) === String(valeurs?.[champ.service] ?? '')) return;
            onChange(champ.service, e.serviceId);
            // libellé recalculé par le champ service (il ne doit pas garder le nom de l'ancien service)
            if (champ.serviceLibelle) onChange(champ.serviceLibelle, '');
          } : undefined} />
      );
      break;
    case 'personnalise':
      // changerChamp(nom, valeur) : pour un champ personnalisé qui remplit aussi d'autres champs
      saisie = champ.rendu({ valeur, changer, changerChamp: onChange, valeurs, erreur, id });
      break;
    default: {
      const type = { email: 'email', tel: 'tel', nombre: 'number', montant: 'number', date: 'date', dateheure: 'datetime-local' }[champ.type] || 'text';
      saisie = (
        <input {...commun} type={type} value={valeur ?? ''} onChange={(e) => changer(e.target.value)}
          step={champ.pas ?? (champ.type === 'montant' ? '0.001' : undefined)} min={champ.min} max={champ.max}
          maxLength={champ.longueurMax} dir={['texte', undefined].includes(champ.type) ? 'auto' : undefined} />
      );
    }
  }

  return (
    <div className={`cf-champ cf-champ--${champ.largeur || 'demi'} ${erreur ? 'a-erreur' : ''}`}>
      {champ.type !== 'case' && champ.label && (
        <label htmlFor={id} className="cf-label">
          {t(champ.label)}{champ.requis && <span className="cf-requis" aria-hidden="true">*</span>}
          {champ.unite && <small>({t(champ.unite)})</small>}
        </label>
      )}
      {Icone && !['zone', 'case', 'equipement', 'personnalise', 'liste', 'recherche'].includes(champ.type)
        ? <div className="cf-avec-icone"><Icone size={15} aria-hidden="true" />{saisie}</div>
        : saisie}
      {(erreur || champ.aide) && (
        <p id={`${id}-aide`} className={erreur ? 'cf-erreur' : 'cf-aide'}>{erreur || t(champ.aide)}</p>
      )}
    </div>
  );
}

/** Grille de champs (2 colonnes, 1 sur téléphone). `section` : n'affiche que les champs de cette section. */
export default function Formulaire({ champs, valeurs, erreurs = {}, onChange, section }) {
  // cache : valeur gardée et envoyée, mais pas affichée (ex. un libellé recopié par libelleVers)
  const visibles = champs.filter((c) => !c.cache && (!section || (c.section || 'general') === section) && (!c.visible || c.visible(valeurs)));
  return (
    <div className="cf-grille">
      {visibles.map((c) => (
        <Champ key={c.nom} champ={c} valeur={valeurs[c.nom]} erreur={erreurs[c.nom]} onChange={onChange} valeurs={valeurs} />
      ))}
    </div>
  );
}
