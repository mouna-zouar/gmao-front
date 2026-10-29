// Composants génériques : tableau cliquable + page de détail (en-tête, infos générales, cadre à onglets)
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Edit, Inbox, Loader2, Search, Trash2 } from 'lucide-react';
import { t } from '../../../i18n';
import './BmdEntityViews.css';

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