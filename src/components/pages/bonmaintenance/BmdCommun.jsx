/*
 * Outils communs du bon de maintenance, regroupés dans un seul fichier :
 *   - constantes, formats et liste de choix avec recherche (ancien Bmdshared.jsx) ;
 *   - briques de formulaire Bmf… (ancien Bmdform.jsx) ;
 *   - tableau, fiche et vue détail (ancien Bmdentityviews.jsx) ;
 *   - animations de fin d'étape, useCelebration (ancien Bmdcelebration.jsx) ;
 *   - temps passé, chronomètre (ancien TempsPasse.jsx).
 * Leurs styles sont dans Bonmaintenancedetails.css.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Edit, Inbox, Loader2, Search, Timer, Trash2, X } from 'lucide-react';
import { locale, t } from '../../../i18n';

// ═════════════════════════════════════════════════════════════
// Constantes, formats et liste de choix avec recherche   (ancien Bmdshared.jsx)
// ═════════════════════════════════════════════════════════════
// Éléments partagés entre BonMaintenanceDetails.jsx et BmdSousOnglets.jsx
// (déplacés ici pour éviter les imports circulaires)

export const INTERVENANT_ETAT_LABELS = {
  0: 'Nouveau',
  1: 'En cours',
  2: 'Terminé',
  10: 'Annulé',
};

// Valeurs réelles de BonMaintenanceTache.etat
export const TACHE_ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

export const GRAVITE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
export const TYPE_CONTROLE_OPTIONS = ['Fonctionnel', 'Sécurité électrique', 'Calibration', 'Étalonnage', 'Autre'];
export const ETAT_IMMOBILISATION_OPTIONS = [
  { value: 1, label: 'Fonctionnel avec problème' },
  { value: 2, label: 'En panne' },
  { value: 3, label: 'À changer' },
  { value: 4, label: 'Hors service' },
];

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMontant(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  return t('{montant} DT', { montant: Number(valeur).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
}

export function warnIfQuantiteInvalide(articles, articleId, qte, libelleQuantite = 'quantité') {
  if (!articleId) return;
  const article = articles.find((a) => String(a.id) === String(articleId));
  const nomArticle = article?.designation || t('cet article');
  const libelle = t(libelleQuantite);

  if (qte === '' || qte == null) {
    alert(
      t('Attention : aucune {libelle} saisie pour « {article} ».', { libelle, article: nomArticle }) + '\n'
      + t('Vous pouvez continuer, mais pensez à renseigner la quantité si nécessaire.')
    );
    return;
  }

  const qteNum = Number(qte);
  if (isNaN(qteNum) || qteNum <= 0) {
    alert(
      t('Attention : la {libelle} saisie ({qte}) pour « {article} » semble invalide (elle doit être un nombre positif).', { libelle, qte, article: nomArticle }) + '\n'
      + t("Vous pouvez continuer si c'est volontaire.")
    );
  }
}

// Coût total d'un intervenant : valeur du backend si présente, sinon heures × coût unitaire + forfait
export function coutIntervenant(i) {
  if (i.coutTotal != null) return Number(i.coutTotal);
  if (i.coutUnitaire == null && i.nbrHeure == null && i.forfait == null) return null;
  return (Number(i.coutUnitaire) || 0) * (Number(i.nbrHeure) || 0) + (Number(i.forfait) || 0);
}

export function nomIntervenantAffiche(i) {
  if (!i) return null;
  return i.personnel
    ? `${i.personnel.nom} ${i.personnel.prenom}`
    : (i.sousTraitant?.raisonSociale || i.intervenantNom || t('Intervenant #{id}', { id: i.id }));
}

// Le backend journalise « Changement d'état : 0 -> 1 » : on affiche les libellés plutôt que les codes
export function libelleActionHistoriqueIntervenant(action) {
  const m = /^Changement d'état : (\d+|null) -> (\d+|null)$/.exec(action || '');
  if (!m) return t(action);
  const lbl = (v) => (v === 'null' ? '—' : t(INTERVENANT_ETAT_LABELS[v] ?? v));
  return t("Changement d'état : {de} → {a}", { de: lbl(m[1]), a: lbl(m[2]) });
}

// ============================================================
// SEARCHABLE SELECT (combobox avec recherche)
// ============================================================
export const SearchableSelect = ({
  id,
  name,
  value,
  onChange,
  options,
  getValue = (o) => o.id,
  getLabel = (o) => o.label ?? o.nom ?? String(o),
  getOptionHint = () => null,
  placeholder = 'Sélectionner...',
  emptyMessage = 'Aucun résultat',
  allowEmpty = false,
  emptyOptionLabel = '— Aucun —',
  disabled = false,
  loading = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(getValue(o)) === String(value));
  const selectedLabel = selected ? getLabel(selected) : '';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearch(selectedLabel);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (opt) => {
    onChange({ target: { name, value: String(getValue(opt)) } });
    setIsOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
    setSearch('');
    inputRef.current?.focus();
  };

  const term = search.trim().toLowerCase();
  const isSelectedLabel = selected && term === selectedLabel.toLowerCase();
  const filtered = (!term || isSelectedLabel)
    ? options
    : options.filter((o) => getLabel(o).toLowerCase().includes(term));

  const displayValue = isOpen ? search : selectedLabel;
  const rootClass = compact ? 'bmd-searchable bmd-searchable--compact' : 'bmd-searchable';

  return (
    <div className={rootClass} ref={containerRef}>
      <div className={`bmd-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={compact ? 13 : 15} strokeWidth={2.3} className="bmd-searchable-icon" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="bmd-searchable-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={loading ? t('Chargement...') : (selected ? '' : t(placeholder))}
          disabled={disabled || loading}
          autoComplete="off"
        />
        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="bmd-searchable-clear-inline"
            onClick={handleClear}
            aria-label={t('Effacer')}
            tabIndex={-1}
          >
            <X size={compact ? 11 : 13} strokeWidth={2.5} />
          </button>
        )}
        <ChevronDown
          size={compact ? 13 : 15}
          strokeWidth={2.3}
          className={`bmd-searchable-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="bmd-searchable-menu">
          <div className="bmd-searchable-options">
            {allowEmpty && !term && (
              <button
                type="button"
                className={`bmd-searchable-option ${!value ? 'is-selected' : ''}`}
                onClick={() => handleSelect({ id: '' })}
              >
                <span className="bmd-searchable-option-main">
                  <span className="bmd-searchable-option-label">{t(emptyOptionLabel)}</span>
                </span>
                {!value && <Check size={14} strokeWidth={3} />}
              </button>
            )}

            {filtered.length === 0 && (!allowEmpty || term) ? (
              <div className="bmd-searchable-empty">{t(emptyMessage)}</div>
            ) : (
              filtered.map((o) => {
                const val = String(getValue(o));
                const isSelected = val === String(value);
                const hint = getOptionHint(o);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`bmd-searchable-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(o)}
                  >
                    <span className="bmd-searchable-option-main">
                      <span className="bmd-searchable-option-label">{t(getLabel(o))}</span>
                      {hint && <span className="bmd-searchable-option-hint">{hint}</span>}
                    </span>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Briques de formulaire (Bmf…)   (ancien Bmdform.jsx)
// ═════════════════════════════════════════════════════════════
// Briques de formulaire guidées : chaque champ a un libellé clair, une aide en une phrase,
// et les choix fermés deviennent de gros boutons au lieu de listes déroulantes.

// Formulaire découpé en étapes numérotées (c'est une vraie séquence : on remplit dans l'ordre)
export function BmfFormulaire({ titre, intro, onSubmit, children }) {
  return (
    <form className="bmf-form" onSubmit={onSubmit}>
      {(titre || intro) && (
        <header className="bmf-form-entete">
          {titre && <h3>{t(titre)}</h3>}
          {intro && <p>{t(intro)}</p>}
        </header>
      )}
      <div className="bmf-etapes">{children}</div>
    </form>
  );
}

export function BmfEtape({ numero, titre, aide, children }) {
  return (
    <fieldset className="bmf-etape">
      <legend className="bmf-etape-titre">
        <span className="bmf-etape-num" aria-hidden="true">{numero}</span>
        <span>
          {t(titre)}
          {aide && <small>{t(aide)}</small>}
        </span>
      </legend>
      <div className="bmf-etape-champs">{children}</div>
    </fieldset>
  );
}

// Un champ : libellé au-dessus, aide en dessous, jamais de placeholder seul
export function BmfChamp({ label, aide, requis = false, large = false, alerte, info, children, htmlFor }) {
  return (
    <div className={`bmf-champ ${large ? 'is-large' : ''}`}>
      <label className="bmf-label" htmlFor={htmlFor}>
        {t(label)}
        {requis ? <span className="bmf-requis">{t('obligatoire')}</span> : <span className="bmf-optionnel">{t('facultatif')}</span>}
      </label>
      {children}
      {info && <p className="bmf-info">{t(info)}</p>}
      {alerte && <p className="bmf-alerte" role="alert">{t(alerte)}</p>}
      {aide && !alerte && <p className="bmf-aide">{t(aide)}</p>}
    </div>
  );
}

// Choix fermé en pastilles (remplace les <select> Oui/Non, Gravité, État…)
// options : [{ value, label, ton?, icon? }]
export function BmfChoix({ value, onChange, options, nom, effacable = true, grand = false }) {
  return (
    <div className={`bmf-choix ${grand ? 'is-grand' : ''}`} role="radiogroup" aria-label={t(nom)}>
      {options.map((o) => {
        const actif = String(value) === String(o.value);
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={actif}
            className={`bmf-choix-btn bmf-ton--${o.ton || 'brand'} ${actif ? 'is-actif' : ''}`}
            onClick={() => onChange(actif && effacable ? '' : String(o.value))}
          >
            {Icon ? <Icon size={grand ? 20 : 16} /> : actif && <Check size={15} strokeWidth={3} />}
            <span>{t(o.label)}</span>
            {o.aide && grand && <small>{t(o.aide)}</small>}
          </button>
        );
      })}
    </div>
  );
}

// Champ numérique avec son unité affichée (h, DT, …)
export function BmfNombre({ id, value, onChange, unite, step = 'any', min, placeholder, onBlur }) {
  return (
    <div className="bmf-nombre">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value}
        placeholder={t(placeholder)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {unite && <span className="bmf-unite">{t(unite)}</span>}
    </div>
  );
}

export function BmfTexte({ id, value, onChange, placeholder, multiligne = false, rows = 3, autoFocus = false, requis = false }) {
  return multiligne ? (
    <textarea
      id={id}
      className="bmf-input"
      rows={rows}
      required={requis}
      value={value}
      placeholder={t(placeholder)}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      id={id}
      type="text"
      className="bmf-input"
      value={value}
      placeholder={t(placeholder)}
      autoFocus={autoFocus}
      required={requis}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function BmfDate({ id, value, onChange }) {
  return (
    <input
      id={id}
      type="datetime-local"
      className="bmf-input bmf-input--date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Indication de stock disponible sous un champ article
export function BmfStock({ verification, quantite, demande }) {
  if (verification) {
    return <span className="bmf-stock"><Loader2 size={14} className="bmf-tourne" /> {t('Vérification du stock…')}</span>;
  }
  if (quantite == null) return <span className="bmf-stock">{t('Stock inconnu')}</span>;
  const manque = demande !== '' && demande != null && Number(demande) > Number(quantite);
  const vide = Number(quantite) <= 0;
  return (
    <span className={`bmf-stock ${manque || vide ? 'is-manque' : 'is-ok'}`}>
      {vide ? t('Rupture de stock') : t('{n} en stock', { n: quantite })}
      {manque && !vide ? t(' : il en manque {n}', { n: Number(demande) - Number(quantite) }) : ''}
    </span>
  );
}

// Barre d'actions collée en bas du formulaire
export function BmfActions({ enregistrement, label, labelEnCours = 'Enregistrement…', onAnnuler }) {
  return (
    <div className="bmf-actions">
      {onAnnuler && (
        <button type="button" className="bmf-btn bmf-btn--annuler" onClick={onAnnuler}>
          <X size={16} /> {t('Annuler')}
        </button>
      )}
      <button type="submit" className="bmf-btn bmf-btn--valider" disabled={enregistrement}>
        {enregistrement ? <Loader2 size={17} className="bmf-tourne" /> : <Check size={17} strokeWidth={2.6} />}
        {enregistrement ? t(labelEnCours) : t(label)}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Tableau, fiche et vue détail (BmdDataTable, BmdDetailView…)   (ancien Bmdentityviews.jsx)
// ═════════════════════════════════════════════════════════════
// Composants génériques : tableau cliquable + page de détail (en-tête, infos générales, cadre à onglets)

const estVide = (v) => v === null || v === undefined || v === '';
// Les valeurs texte (libellés d'état, « Oui », « Interne »…) sont traduites ; les données saisies restent telles quelles
const tr = (v) => (typeof v === 'string' ? t(v) : v);
// 'right' devient 'end' pour s'inverser automatiquement en arabe
const alignement = (a) => (a === 'right' ? 'end' : a === 'left' ? 'start' : a);

export const Pill = ({ tone = 'slate', children }) => (
  <span className={`bmd-pill bmd-pill--${tone}`}>{tr(children)}</span>
);

export const TexteOuVide = ({ texte, vide = 'Aucune information.' }) => (
  texte
    ? <p className="bmd-detail-text">{texte}</p>
    : <p className="bmd-flow-empty"><Inbox size={18} className="empty-icon" /> {t(vide)}</p>
);

// Grille de champs label / valeur, réutilisable dans les sections
export function BmdFieldGrid({ fields }) {
  const visibles = fields.filter((f) => !f.hidden);
  return (
    <dl className="bmd-detail-grid">
      {visibles.map((f) => (
        <div key={f.label} className={`bmd-detail-field ${f.wide ? 'is-wide' : ''}`}>
          <dt>{t(f.label)}</dt>
          <dd>{estVide(f.value) ? '—' : tr(f.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// ============================================================
// TABLEAU
// columns : [{ key, label, render?(row), align?, width? }]
// ============================================================
export function BmdDataTable({
  columns,
  rows,
  getRowKey = (r) => r.id,
  onRowClick,
  loading = false,
  emptyMessage = 'Aucun élément pour l\'instant.',
  getSearchText,
  searchPlaceholder = 'Filtrer...',
}) {
  const [filtre, setFiltre] = useState('');

  const visibles = useMemo(() => {
    const tache = filtre.trim().toLowerCase();
    if (!tache || !getSearchText) return rows;
    return rows.filter((r) => (getSearchText(r) || '').toLowerCase().includes(tache));
  }, [rows, filtre, getSearchText]);

  if (loading) {
    return <p className="bmd-empty"><Loader2 size={24} className="spinner" /> {t('Chargement...')}</p>;
  }

  if (rows.length === 0) {
    return <p className="bmd-empty"><Inbox size={24} className="empty-icon" /> {t(emptyMessage)}</p>;
  }

  return (
    <div className="bmd-table-wrap">
      {getSearchText && (
        <div className="bmd-table-toolbar">
          <label className="bmd-table-search">
            <Search size={14} />
            <input
              type="text"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder={t(searchPlaceholder)}
            />
          </label>
          <span className="bmd-table-count" dir="ltr">{visibles.length} / {rows.length}</span>
        </div>
      )}

      <div className="bmd-table-scroll">
        <table className="bmd-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: alignement(c.align) }}>{t(c.label)}</th>
              ))}
              <th className="bmd-table-chevron-col" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="bmd-table-empty">
                  {t('Aucun résultat pour « {q} »', { q: filtre })}
                </td>
              </tr>
            ) : (
              visibles.map((r) => (
                <tr
                  key={getRowKey(r)}
                  tabIndex={0}
                  onClick={() => onRowClick?.(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onRowClick?.(r); }}
                  title={t('Voir le détail')}
                >
                  {columns.map((c) => {
                    const contenu = c.render ? c.render(r) : r[c.key];
                    return (
                      <td key={c.key} style={{ textAlign: alignement(c.align) }}>
                        {estVide(contenu) ? <span className="bmd-cell-muted">—</span> : tr(contenu)}
                      </td>
                    );
                  })}
                  <td className="bmd-table-chevron-col"><ChevronRight size={16} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// PAGE DE DÉTAIL
// Partie 1 : en-tête + informations générales
// Partie 2 : cartes (une carte par section, toutes visibles)
// sections : [{ key, label, icon?, count?, content, wide? }]
// ============================================================
export function BmdDetailView({
  onBack,
  backLabel = 'Retour à la liste',
  icon: Icon,
  surtitre,
  title,
  badges,
  extraActions,
  onEdit,
  onDelete,
  infos = [],
  sections = [],
}) {
  return (
    <div className="bmd-detail">
      <button type="button" className="bmd-detail-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {t(backLabel)}
      </button>

      {/* PARTIE 1 — EN-TÊTE + INFORMATIONS GÉNÉRALES */}
      <header className="bmd-detail-header">
        <div className="bmd-detail-header-left">
          {Icon && <div className="bmd-detail-icon"><Icon size={22} /></div>}
          <div className="bmd-detail-header-text">
            {surtitre && <span className="bmd-detail-surtitre">{tr(surtitre)}</span>}
            <h3 className="bmd-detail-title">{tr(title)}</h3>
            {badges && <div className="bmd-detail-badges">{badges}</div>}
          </div>
        </div>
        <div className="bmd-detail-header-actions">
          {extraActions}
          {onEdit && (
            <button type="button" className="bmd-edit-btn" onClick={onEdit}>
              <Edit size={14} /> {t('Modifier')}
            </button>
          )}
          {onDelete && (
            <button type="button" className="bmd-delete-btn" onClick={onDelete}>
              <Trash2 size={14} /> {t('Supprimer')}
            </button>
          )}
        </div>
      </header>

      {infos.length > 0 && (
        <section className="bmd-detail-infos">
          <h4 className="bmd-detail-section-title">{t('Informations générales')}</h4>
          <BmdFieldGrid fields={infos} />
        </section>
      )}

      {/* PARTIE 2 — CARTES */}
      {sections.length > 0 && (
        <div className="bmd-detail-cards">
          {sections.map((s) => {
            const SIcon = s.icon;
            return (
              <section key={s.key} className={`bmd-detail-card ${s.wide ? 'is-wide' : ''}`}>
                <header className="bmd-detail-card-header">
                  {SIcon && <span className="bmd-detail-card-icon"><SIcon size={16} /></span>}
                  <h4 className="bmd-detail-card-title">{t(s.label)}</h4>
                  {s.count != null && <span className="bmd-detail-subtab-count">{s.count}</span>}
                </header>
                <div className="bmd-detail-card-body">{s.content}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Animations de fin d'étape (useCelebration)   (ancien Bmdcelebration.jsx)
// ═════════════════════════════════════════════════════════════
// Animations de fin d'étape (intervenant terminé, remise en service, bon clôturé)
// Usage : const [celebrer, celebrationElement] = useCelebration();
//         celebrer('intervenant-termine', 'Ahmed Ben Ali');

const CONFIG = {
  'intervenant-termine': { tone: 'teal', titre: 'Intervention terminée' },
  'remise-autorisee': { tone: 'green', titre: 'Équipement remis en service' },
  'remise-refusee': { tone: 'red', titre: 'Remise en service refusée' },
  'bon-cloture': { tone: 'ink', titre: 'Bon de maintenance clôturé' },
};

const ANGLES_ETINCELLES = [0, 45, 90, 135, 180, 225, 270, 315];

const Etincelles = () => (
  <g className="bmdc-sparks">
    {ANGLES_ETINCELLES.map((a) => (
      <g key={a} transform={`rotate(${a} 100 70)`}>
        <line x1="100" y1="12" x2="100" y2="4" />
      </g>
    ))}
  </g>
);

const Ondes = () => (
  <g className="bmdc-ripples">
    <circle cx="100" cy="70" r="46" />
    <circle cx="100" cy="70" r="46" />
  </g>
);

// Tracé ECG qui traverse le cercle puis laisse place à la coche
const VisuelIntervenant = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <Ondes />
    <path
      className="bmdc-ecg"
      pathLength="1"
      d="M8 70 H58 L66 70 L74 46 L84 98 L94 30 L104 86 L112 70 H192"
    />
    <circle className="bmdc-ring" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-check" pathLength="1" d="M80 71 L95 86 L122 56" />
    <Etincelles />
  </svg>
);

// Symbole « power » qui se dessine puis s'allume
const VisuelRemiseAutorisee = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <Ondes />
    <circle className="bmdc-ring bmdc-ring--glow" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-power-arc" pathLength="1" d="M84 52 A26 26 0 1 0 116 52" />
    <path className="bmdc-power-bar" pathLength="1" d="M100 38 V68" />
    <Etincelles />
  </svg>
);

const VisuelRemiseRefusee = () => (
  <svg viewBox="0 0 200 140" className="bmdc-svg" aria-hidden="true">
    <circle className="bmdc-ring" pathLength="1" cx="100" cy="70" r="46" />
    <path className="bmdc-cross" pathLength="1" d="M85 55 L115 85" />
    <path className="bmdc-cross bmdc-cross--2" pathLength="1" d="M115 55 L85 85" />
  </svg>
);

// Tampon qui « tombe » sur la carte
const VisuelBonCloture = ({ sousTitre }) => (
  <div className="bmdc-stamp-zone">
    <div className="bmdc-dust" />
    <div className="bmdc-stamp">
      <span className="bmdc-stamp-texte">{t('CLÔTURÉ')}</span>
      <span className="bmdc-stamp-date">
        {sousTitre ? `${sousTitre} · ` : ''}
        {new Date().toLocaleDateString(locale())}
      </span>
    </div>
  </div>
);

export function BmdCelebration({ type, sousTitre, duree = 2900, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const fermer = () => onDoneRef.current?.();
    const timer = setTimeout(fermer, duree);
    const onKey = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [duree]);

  const cfg = CONFIG[type];
  if (!cfg) return null;

  let visuel = null;
  if (type === 'intervenant-termine') visuel = <VisuelIntervenant />;
  else if (type === 'remise-autorisee') visuel = <VisuelRemiseAutorisee />;
  else if (type === 'remise-refusee') visuel = <VisuelRemiseRefusee />;
  else if (type === 'bon-cloture') visuel = <VisuelBonCloture sousTitre={sousTitre} />;

  const contenu = (
    <div
      className={`bmdc-overlay bmdc--${cfg.tone}`}
      onClick={() => onDoneRef.current?.()}
      role="status"
      aria-live="polite"
    >
      <div className={`bmdc-card bmdc-card--${type}`}>
        <div className="bmdc-visual">{visuel}</div>
        <p className="bmdc-titre">{t(cfg.titre)}</p>
        {sousTitre && type !== 'bon-cloture' && <p className="bmdc-sous">{sousTitre}</p>}
        <div className="bmdc-progress">
          <span style={{ animationDuration: `${duree}ms` }} />
        </div>
      </div>
    </div>
  );

  // Portail : évite que l'overlay soit coupé par un parent animé (transform)
  return createPortal(contenu, document.body);
}

// File d'attente : si deux événements arrivent ensemble (intervenant terminé puis bon clôturé),
// les animations s'enchaînent au lieu de se superposer.
export function useCelebration() {
  const [file, setFile] = useState([]);

  const celebrer = useCallback((type, sousTitre) => {
    setFile((f) => [...f, { type, sousTitre, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const suivant = useCallback(() => setFile((f) => f.slice(1)), []);

  const courant = file[0];
  const element = courant ? (
    <BmdCelebration
      key={courant.id}
      type={courant.type}
      sousTitre={courant.sousTitre}
      onDone={suivant}
    />
  ) : null;

  return [celebrer, element];
}

// ═════════════════════════════════════════════════════════════
// Temps passé (chronomètre des tâches et intervenants)   (ancien TempsPasse.jsx)
// ═════════════════════════════════════════════════════════════
/*
 * Temps passé sur une tâche ou par un intervenant d'un bon.
 * Le serveur tient un chronomètre (tempsPasseSecondes + enCoursDepuis) : il tourne tant que l'élément
 * est « en cours » et se met en pause sinon. Pour les éléments plus anciens que ce chronomètre,
 * on retombe sur les dates d'intervention (début → fin, ou début → maintenant s'il est en cours).
 */

export const TACHE_EN_COURS = 3;
export const INTERVENANT_EN_COURS = 1;

/** { secondes, enCours, estime } ou null si rien ne permet de calculer. */
export function tempsPasse(o, etatEnCours, maintenant = Date.now()) {
  if (!o) return null;
  const enCours = Number(o.etat) === etatEnCours;
  // Chronomètre du serveur ; un cumul à 0 sans période en cours vient d'un élément plus ancien que le chronomètre
  if (Number(o.tempsPasseSecondes) > 0 || o.enCoursDepuis) {
    const enPlus = o.enCoursDepuis ? Math.max(0, (maintenant - new Date(o.enCoursDepuis).getTime()) / 1000) : 0;
    return { secondes: (Number(o.tempsPasseSecondes) || 0) + enPlus, enCours: Boolean(o.enCoursDepuis), estime: false };
  }
  // Repli sur les dates d'intervention
  const zero = o.tempsPasseSecondes != null ? { secondes: 0, enCours: false, estime: false } : null;
  const debut = o.dateDebutIntervention ? new Date(o.dateDebutIntervention).getTime() : null;
  if (!debut || Number.isNaN(debut)) return zero;
  const fin = o.dateFinIntervention ? new Date(o.dateFinIntervention).getTime() : (enCours ? maintenant : null);
  if (!fin || fin < debut) return zero;
  return { secondes: (fin - debut) / 1000, enCours: enCours && !o.dateFinIntervention, estime: true };
}

/** « 2 h 15 min », « 45 min », « 3 j 4 h », « < 1 min » */
export function formatTemps(secondes) {
  if (secondes == null) return '—';
  const min = Math.floor(secondes / 60);
  if (min < 1) return t('< 1 min');
  const j = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const n = (v) => v.toLocaleString(locale());
  if (j > 0) return h > 0 ? t('{j} j {h} h', { j: n(j), h: n(h) }) : t('{j} j', { j: n(j) });
  if (h > 0) return m > 0 ? t('{h} h {m} min', { h: n(h), m: String(m).padStart(2, '0') }) : t('{h} h', { h: n(h) });
  return t('{m} min', { m: n(m) });
}

/** Heure courante, rafraîchie toutes les 30 s seulement si un chronomètre tourne. */
export function useMaintenant(actif) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return undefined;
    setMaintenant(Date.now());
    const id = setInterval(() => setMaintenant(Date.now()), 30000);
    return () => clearInterval(id);
  }, [actif]);
  return maintenant;
}

/** Somme des temps passés d'une liste (en secondes) et indicateur « au moins un en cours ». */
export function totalTemps(liste, etatEnCours, maintenant) {
  let secondes = 0;
  let enCours = false;
  let connu = false;
  (liste || []).forEach((o) => {
    const tp = tempsPasse(o, etatEnCours, maintenant);
    if (!tp) return;
    connu = true;
    secondes += tp.secondes;
    enCours = enCours || tp.enCours;
  });
  return connu ? { secondes, enCours } : null;
}

/** Pastille « ⏱ 2 h 15 min » ; un point vert indique que le chronomètre tourne. */
export function TempsPasse({ objet, etatEnCours, maintenant, vide = '—' }) {
  const tp = tempsPasse(objet, etatEnCours, maintenant);
  if (!tp) return vide;
  return (
    <span
      className={`bmd-temps ${tp.enCours ? 'is-en-cours' : ''}`}
      title={tp.enCours ? t('En cours : le temps continue de tourner') : tp.estime ? t('Calculé à partir des dates d’intervention') : t('Temps de travail mesuré')}
    >
      <Timer size={13} aria-hidden="true" /> {formatTemps(tp.secondes)}{tp.estime ? ' *' : ''}
    </span>
  );
}
