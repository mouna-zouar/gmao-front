import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ChampEquipement from '../ui/ChampEquipement/ChampEquipement';
import { t } from '../../i18n';
import './commun.css';


const cacheOptions = new Map();

function useOptions(champ) {
  const cle = champ.cleOptions || (champ.chargerOptions ? `${champ.nom}` : null);
  const [etat, setEtat] = useState(() => (cle && cacheOptions.has(cle) ? { liste: cacheOptions.get(cle), chargement: false } : { liste: champ.options || [], chargement: Boolean(champ.chargerOptions) }));
  useEffect(() => {
    if (!champ.chargerOptions || (cle && cacheOptions.has(cle) && !champ.sansCache)) return undefined;
    let annule = false;
    Promise.resolve(champ.chargerOptions())
      .then((r) => {
        const liste = Array.isArray(r) ? r : (r?.content ?? r?.data ?? []);
        if (!champ.sansCache && cle) cacheOptions.set(cle, liste);
        if (!annule) setEtat({ liste, chargement: false });
      })
      .catch(() => { if (!annule) setEtat({ liste: [], chargement: false, erreur: true }); });
    return () => { annule = true; };
  }, [champ, cle]);
  if (!champ.chargerOptions) return { liste: champ.options || [], chargement: false };
  return etat;
}

const valeurOption = (champ, o) => (typeof o === 'object' ? o[champ.optionValeur || 'value'] ?? o.id : o);
const labelOption = (champ, o) => {
  if (typeof o !== 'object') return String(o);
  if (typeof champ.optionLabel === 'function') return champ.optionLabel(o);
  return o[champ.optionLabel || 'label'] ?? o.nom ?? o.libelle ?? String(valeurOption(champ, o));
};

/** Un champ : libellé, saisie selon le type, aide et message d'erreur. */
export function Champ({ champ, valeur, erreur, onChange, valeurs }) {
  const options = useOptions(champ);
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
    case 'case':
      saisie = (
        <label className="cf-case">
          <input type="checkbox" id={id} name={champ.nom} checked={Boolean(valeur)} disabled={desactive} onChange={(e) => changer(e.target.checked)} />
          <span>{t(champ.texteCase || champ.label)}</span>
        </label>
      );
      break;
    case 'equipement':
      saisie = <ChampEquipement id={id} name={champ.nom} value={valeur ?? ''} onChange={(e) => changer(e.target.value)} facultatif={!champ.requis} disabled={desactive} />;
      break;
    case 'personnalise':
      saisie = champ.rendu({ valeur, changer, valeurs, erreur, id });
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
      {champ.type !== 'case' && (
        <label htmlFor={id} className="cf-label">
          {t(champ.label)}{champ.requis && <span className="cf-requis" aria-hidden="true">*</span>}
          {champ.unite && <small>({t(champ.unite)})</small>}
        </label>
      )}
      {Icone && !['zone', 'case', 'equipement', 'personnalise', 'liste'].includes(champ.type)
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
  const visibles = champs.filter((c) => (!section || (c.section || 'general') === section) && (!c.visible || c.visible(valeurs)));
  return (
    <div className="cf-grille">
      {visibles.map((c) => (
        <Champ key={c.nom} champ={c} valeur={valeurs[c.nom]} erreur={erreurs[c.nom]} onChange={onChange} valeurs={valeurs} />
      ))}
    </div>
  );
}
