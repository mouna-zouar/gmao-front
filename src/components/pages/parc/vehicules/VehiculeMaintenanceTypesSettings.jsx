import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Inbox,
  Gauge,
  BellRing,
  Flag,
  Calculator,
  CheckCircle2,
  Search,
  ArrowUpDown,
  CircleSlash,
  Activity,
  TrendingUp,
  Pause,
} from 'lucide-react';
import vehiculeMaintenanceService from '../../../../services/vehiculeMaintenanceService';
import './VehiculeMaintenanceTypesSettings.css';

const emptyForm = {
  code: '',
  libelle: '',
  intervalleKm: '',
  seuilAlerteKm: '',
  urgenceBon: '',
  baseRecalcul: 0,
  actif: true,
};

const nf = new Intl.NumberFormat('fr-FR');

const URGENCE = {
  1: { label: 'Faible',   tone: 'green'  },
  2: { label: 'Normale',  tone: 'blue'   },
  3: { label: 'Haute',    tone: 'orange' },
  4: { label: 'Critique', tone: 'red'    },
};

const SORTS = [
  { value: 'code',         label: 'Code (A→Z)' },
  { value: 'libelle',      label: 'Libellé (A→Z)' },
  { value: 'intervalleKm', label: 'Intervalle ↑' },
  { value: 'urgenceBon',   label: 'Urgence ↑' },
];

/**
 * Paramétrage des seuils de maintenance préventive.
 * Chaque type est créé, modifié ou désactivé ici — aucune valeur imposée par défaut.
 */
export default function VehiculeMaintenanceTypesSettings() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('code');

  const codeInputRef = useRef(null);

  /* ---------------------------------------------------------------- data */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehiculeMaintenanceService.getTypes();
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de charger les seuils.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* --------------------------------------------------------- modal side */
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({
      code: t.code ?? '',
      libelle: t.libelle ?? '',
      intervalleKm: t.intervalleKm ?? '',
      seuilAlerteKm: t.seuilAlerteKm ?? '',
      urgenceBon: t.urgenceBon ?? '',
      baseRecalcul: t.baseRecalcul ?? 0,
      actif: t.actif ?? true,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = useCallback(() => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }, [saving]);

  useEffect(() => {
    if (!formOpen) return;

    const onKey = (e) => {
      if (e.key === 'Escape') closeForm();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const t = setTimeout(() => codeInputRef.current?.focus(), 60);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [formOpen, closeForm]);

  /* --------------------------------------------------------- form logic */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.libelle.trim()) {
      setFormError('Le code et le libellé sont obligatoires.');
      return;
    }
    if (!form.intervalleKm || Number(form.intervalleKm) <= 0) {
      setFormError("L'intervalle kilométrique doit être strictement positif.");
      return;
    }
    if (form.urgenceBon !== '' && ![1, 2, 3, 4].includes(Number(form.urgenceBon))) {
      setFormError("L'urgence du bon doit être comprise entre 1 et 4.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        libelle: form.libelle.trim(),
        intervalleKm: Number(form.intervalleKm),
        seuilAlerteKm: form.seuilAlerteKm === '' ? null : Number(form.seuilAlerteKm),
        urgenceBon: form.urgenceBon === '' ? null : Number(form.urgenceBon),
        baseRecalcul: Number(form.baseRecalcul),
        actif: form.actif,
      };

      if (editingId) {
        await vehiculeMaintenanceService.updateType(editingId, payload);
      } else {
        await vehiculeMaintenanceService.createType(payload);
      }

      setFormOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (!saving) handleSave();
  };

  /* -------------------------------------------------------- toggle actif */
  const doToggle = async (t) => {
    setPendingId(t.id);
    setError(null);
    try {
      if (t.actif) {
        await vehiculeMaintenanceService.removeType(t.id);
      } else {
        await vehiculeMaintenanceService.updateType(t.id, { ...t, actif: true });
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Échec de la mise à jour.');
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  const handleToggleActif = (t) => {
    if (t.actif) {
      setConfirmId(t.id);
    } else {
      doToggle(t);
    }
  };

  /* ------------------------------------------------------------ derived */
  const stats = useMemo(() => {
    const total = types.length;
    const actifs = types.filter((t) => t.actif).length;
    const avgIntervalle = total
      ? Math.round(types.reduce((s, t) => s + (Number(t.intervalleKm) || 0), 0) / total)
      : 0;
    return { total, actifs, inactifs: total - actifs, avgIntervalle };
  }, [types]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = types.filter((t) => {
      if (statusFilter === 'active' && !t.actif) return false;
      if (statusFilter === 'inactive' && t.actif) return false;
      if (!q) return true;
      return (
        (t.code || '').toLowerCase().includes(q) ||
        (t.libelle || '').toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'libelle':
          return (a.libelle || '').localeCompare(b.libelle || '');
        case 'intervalleKm':
          return (Number(a.intervalleKm) || 0) - (Number(b.intervalleKm) || 0);
        case 'urgenceBon':
          return (a.urgenceBon ?? 99) - (b.urgenceBon ?? 99);
        default:
          return (a.code || '').localeCompare(b.code || '');
      }
    });
    return list;
  }, [types, query, statusFilter, sortBy]);

  const hasActiveFilters = query.trim() !== '' || statusFilter !== 'all';
  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const preview = useMemo(() => {
    const interval = Number(form.intervalleKm);
    if (!interval || interval <= 0) return null;

    const rawMargin = form.seuilAlerteKm === '' ? 0 : Number(form.seuilAlerteKm);
    const margin = Math.min(Math.max(rawMargin || 0, 0), interval);

    return {
      interval,
      margin,
      alertAt: interval - margin,
      alertPct: (margin / interval) * 100,
    };
  }, [form.intervalleKm, form.seuilAlerteKm]);

  /* --------------------------------------------------------------- view */
  return (
    <section className="maint-panel" aria-labelledby="maint-panel-title">
      <header className="maint-panel__head">
        <div>
          <h3 id="maint-panel-title" className="maint-panel__title">
            Paramètres de maintenance préventive
          </h3>
          <p className="maint-panel__lead">
            Vos propres seuils kilométriques — aucune valeur imposée par défaut.
          </p>
        </div>
        <button type="button" className="maint-panel__add" onClick={openCreate}>
          <Plus size={16} /> Nouveau type
        </button>
      </header>

      {/* -------- KPI -------- */}
      <div className="maint-kpis" role="list">
        <div className="maint-kpi" role="listitem">
          <span className="maint-kpi__icon maint-kpi__icon--total" aria-hidden="true">
            <Activity size={15} />
          </span>
          <div className="maint-kpi__body">
            <span className="maint-kpi__value">{stats.total}</span>
            <span className="maint-kpi__label">Types</span>
          </div>
        </div>
        <div className="maint-kpi" role="listitem">
          <span className="maint-kpi__icon maint-kpi__icon--on" aria-hidden="true">
            <CheckCircle2 size={15} />
          </span>
          <div className="maint-kpi__body">
            <span className="maint-kpi__value">{stats.actifs}</span>
            <span className="maint-kpi__label">Actifs</span>
          </div>
        </div>
        <div className="maint-kpi" role="listitem">
          <span className="maint-kpi__icon maint-kpi__icon--off" aria-hidden="true">
            <CircleSlash size={15} />
          </span>
          <div className="maint-kpi__body">
            <span className="maint-kpi__value">{stats.inactifs}</span>
            <span className="maint-kpi__label">Désactivés</span>
          </div>
        </div>
        <div className="maint-kpi" role="listitem">
          <span className="maint-kpi__icon maint-kpi__icon--avg" aria-hidden="true">
            <TrendingUp size={15} />
          </span>
          <div className="maint-kpi__body">
            <span className="maint-kpi__value">
              {stats.avgIntervalle ? nf.format(stats.avgIntervalle) : '—'}
            </span>
            <span className="maint-kpi__label">km moyen</span>
          </div>
        </div>
      </div>

      {/* -------- Barre d'outils -------- */}
      <div className="maint-toolbar">
        <div className="maint-search">
          <Search size={15} className="maint-search__icon" aria-hidden="true" />
          <input
            type="search"
            className="maint-search__input"
            placeholder="Rechercher un code ou un libellé…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher"
          />
          {query && (
            <button
              type="button"
              className="maint-search__clear"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="maint-chips" role="group" aria-label="Filtrer par statut">
          {[
            { v: 'all',      label: 'Tous',       count: stats.total },
            { v: 'active',   label: 'Actifs',     count: stats.actifs },
            { v: 'inactive', label: 'Désactivés', count: stats.inactifs },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              className={`maint-chip${statusFilter === opt.v ? ' maint-chip--active' : ''}`}
              onClick={() => setStatusFilter(opt.v)}
              aria-pressed={statusFilter === opt.v}
            >
              {opt.label}
              <span className="maint-chip__count">{opt.count}</span>
            </button>
          ))}
        </div>

        <label className="maint-sort">
          <ArrowUpDown size={14} aria-hidden="true" />
          <select
            className="maint-sort__select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Trier"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="maint-alert" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* -------- Grille de cartes -------- */}
      <div className="maint-cards" role="list">
        {loading && (
          <div className="maint-cards__state maint-cards__state--loading">
            <Loader2 size={22} className="maint-spin" />
            <span>Chargement des seuils…</span>
          </div>
        )}

        {!loading && types.length === 0 && (
          <div className="maint-cards__state maint-cards__state--empty">
            <Inbox size={32} strokeWidth={1.5} />
            <p className="maint-cards__state-title">Aucun type de maintenance</p>
            <p className="maint-cards__state-text">
              Cliquez sur « Nouveau type » pour créer votre premier seuil
              (ex. Vidange tous les 10 000 km).
            </p>
            <button
              type="button"
              className="maint-btn maint-btn--primary maint-btn--sm"
              onClick={openCreate}
            >
              <Plus size={14} /> Créer le premier type
            </button>
          </div>
        )}

        {!loading && types.length > 0 && filtered.length === 0 && (
          <div className="maint-cards__state maint-cards__state--empty">
            <Search size={28} strokeWidth={1.5} />
            <p className="maint-cards__state-title">Aucun résultat</p>
            <p className="maint-cards__state-text">
              Aucun type ne correspond aux critères sélectionnés.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="maint-btn maint-btn--ghost maint-btn--sm"
                onClick={resetFilters}
              >
                <RotateCcw size={13} /> Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {!loading &&
          filtered.map((t) => {
            const isPending = pendingId === t.id;
            const isConfirm = confirmId === t.id;

            const interval = Number(t.intervalleKm) || 0;
            const margin = Number(t.seuilAlerteKm) || 0;
            const alertAt = Math.max(0, interval - margin);
            const alertPct = interval > 0 ? Math.min(100, (margin / interval) * 100) : 0;
            const urgency = t.urgenceBon ? URGENCE[t.urgenceBon] : null;

            return (
              <article
                key={t.id}
                role="listitem"
                className={[
                  'maint-card',
                  !t.actif && 'maint-card--inactive',
                  isPending && 'maint-card--pending',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <header className="maint-card__head">
                  <code className="maint-card__code">{t.code}</code>
                  <span
                    className={`maint-status ${t.actif ? 'maint-status--on' : 'maint-status--off'}`}
                  >
                    {t.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </header>

                <h4 className="maint-card__title">{t.libelle}</h4>

                <div className="maint-card__gauge">
                  <div className="maint-card__gauge-head">
                    <span className="maint-card__gauge-value">
                      {nf.format(interval)} <em>km</em>
                    </span>
                    {margin > 0 && (
                      <span className="maint-card__gauge-hint">
                        alerte dès {nf.format(alertAt)} km
                      </span>
                    )}
                  </div>
                  <div
                    className="maint-card__gauge-track"
                    role="img"
                    aria-label={
                      margin > 0
                        ? `Échéance à ${nf.format(interval)} km, alerte dès ${nf.format(alertAt)} km`
                        : `Échéance à ${nf.format(interval)} km, sans pré-alerte`
                    }
                  >
                    <span className="maint-card__gauge-ok" />
                    {margin > 0 && (
                      <span
                        className="maint-card__gauge-alert"
                        style={{ width: `${alertPct}%` }}
                      />
                    )}
                  </div>
                </div>

                <dl className="maint-card__metrics">
                  <div className="maint-card__metric">
                    <dt>
                      <BellRing size={12} /> Pré-alerte
                    </dt>
                    <dd>
                      {t.seuilAlerteKm != null
                        ? `${nf.format(margin)} km`
                        : <span className="maint-card__muted">—</span>}
                    </dd>
                  </div>

                  <div className="maint-card__metric">
                    <dt>
                      <Flag size={12} /> Urgence
                    </dt>
                    <dd>
                      {urgency ? (
                        <span className={`maint-urgency maint-urgency--${t.urgenceBon}`}>
                          {t.urgenceBon} · {urgency.label}
                        </span>
                      ) : (
                        <span className="maint-card__muted">—</span>
                      )}
                    </dd>
                  </div>

                  <div className="maint-card__metric">
                    <dt>
                      <Calculator size={12} /> Recalcul
                    </dt>
                    <dd>
                      <span className="maint-card__tag">
                        {t.baseRecalcul === 1 ? 'Seuil théorique' : 'Km réel'}
                      </span>
                    </dd>
                  </div>
                </dl>

                <footer className="maint-card__foot">
                  <button
                    type="button"
                    className="maint-card__btn maint-card__btn--edit"
                    onClick={() => openEdit(t)}
                    disabled={isPending || isConfirm}
                  >
                    <Pencil size={14} /> Modifier
                  </button>

                  {isConfirm ? (
                    <div className="maint-confirm" role="group" aria-label="Confirmer la désactivation">
                      <span className="maint-confirm__label">Désactiver ?</span>
                      <button
                        type="button"
                        className="maint-confirm__btn maint-confirm__btn--yes"
                        onClick={() => doToggle(t)}
                        aria-label="Confirmer la désactivation"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="maint-confirm__btn maint-confirm__btn--no"
                        onClick={() => setConfirmId(null)}
                        aria-label="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleActif(t)}
                      className={`maint-card__btn ${
                        t.actif ? 'maint-card__btn--danger' : 'maint-card__btn--restore'
                      }`}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 size={14} className="maint-spin" /> Traitement…
                        </>
                      ) : t.actif ? (
                        <>
                          <Pause size={14} /> Désactiver
                        </>
                      ) : (
                        <>
                          <RotateCcw size={14} /> Réactiver
                        </>
                      )}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
      </div>

      {/* ---------- Modale ---------- */}
      {formOpen && (
        <div
          className="maint-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="maint-dialog-title"
          onClick={closeForm}
        >
          <div className="maint-dialog" onClick={(e) => e.stopPropagation()}>
            <aside className="maint-dialog__aside" aria-label="Aperçu du seuil">
              <div className="maint-dialog__aside-head">
                <span className="maint-dialog__icon" aria-hidden="true">
                  {editingId ? <Pencil size={16} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={2.4} />}
                </span>
                <span className="maint-dialog__badge">
                  {form.code.trim().toUpperCase() || 'CODE'}
                </span>
              </div>

              <p className="maint-dialog__aside-title">
                {form.libelle.trim() || 'Libellé du type'}
              </p>

              <div className="maint-gauge">
                {preview ? (
                  <>
                    <p className="maint-gauge__value">
                      {nf.format(preview.interval)}
                      <span className="maint-gauge__unit">km</span>
                    </p>

                    <div
                      className="maint-gauge__track"
                      role="img"
                      aria-label={
                        preview.margin > 0
                          ? `Échéance à ${nf.format(preview.interval)} km, alerte dès ${nf.format(preview.alertAt)} km`
                          : `Échéance à ${nf.format(preview.interval)} km, sans pré-alerte`
                      }
                    >
                      <span className="maint-gauge__ok" />
                      {preview.margin > 0 && (
                        <span
                          className="maint-gauge__alert"
                          style={{ width: `${preview.alertPct}%` }}
                        />
                      )}
                    </div>

                    <ul className="maint-gauge__legend">
                      <li className="maint-gauge__legend-item maint-gauge__legend-item--ok">
                        Circulation normale
                        <span className="maint-gauge__legend-range">
                          0 – {nf.format(preview.alertAt)} km
                        </span>
                      </li>
                      {preview.margin > 0 && (
                        <li className="maint-gauge__legend-item maint-gauge__legend-item--alert">
                          Zone d'alerte
                          <span className="maint-gauge__legend-range">
                            {nf.format(preview.alertAt)} – {nf.format(preview.interval)} km
                          </span>
                        </li>
                      )}
                      <li className="maint-gauge__legend-item maint-gauge__legend-item--due">
                        Échéance
                        <span className="maint-gauge__legend-range">
                          {nf.format(preview.interval)} km
                        </span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <p className="maint-gauge__placeholder">
                    Saisissez un intervalle pour visualiser le cycle de maintenance.
                  </p>
                )}
              </div>

              <dl className="maint-recap">
                <div className="maint-recap__row">
                  <dt>Urgence du bon</dt>
                  <dd>
                    {form.urgenceBon !== '' ? (
                      <span className={`maint-urgency maint-urgency--${form.urgenceBon}`}>
                        {form.urgenceBon}
                      </span>
                    ) : ('Non définie')}
                  </dd>
                </div>
                <div className="maint-recap__row">
                  <dt>Recalcul</dt>
                  <dd>{Number(form.baseRecalcul) === 1 ? 'Seuil théorique' : 'Km réel'}</dd>
                </div>
                <div className="maint-recap__row">
                  <dt>Statut</dt>
                  <dd>{form.actif ? 'Actif' : 'Désactivé'}</dd>
                </div>
              </dl>
            </aside>

            <div className="maint-dialog__main">
              <header className="maint-dialog__header">
                <div>
                  <h4 id="maint-dialog-title" className="maint-dialog__heading">
                    {editingId ? 'Modifier le type de maintenance' : 'Nouveau type de maintenance'}
                  </h4>
                  <p className="maint-dialog__subtitle">
                    {editingId
                      ? 'Ajustez les paramètres du seuil de déclenchement'
                      : 'Définissez un nouveau seuil kilométrique préventif'}
                  </p>
                </div>
                <button
                  type="button"
                  className="maint-dialog__close"
                  onClick={closeForm}
                  aria-label="Fermer"
                  disabled={saving}
                >
                  <X size={16} />
                </button>
              </header>

              <form className="maint-dialog__form" onSubmit={submitForm}>
                <div className="maint-dialog__body">
                  <section className="maint-group" aria-labelledby="maint-group-id">
                    <div>
                      <h5 id="maint-group-id" className="maint-group__title">Identification</h5>
                      <p className="maint-group__desc">Code unique et libellé utilisateur</p>
                    </div>

                    <div className="maint-grid">
                      <label className="maint-field">
                        <span className="maint-field__label">Code technique *</span>
                        <input
                          ref={codeInputRef}
                          className="maint-field__input"
                          name="code"
                          value={form.code}
                          onChange={handleChange}
                          placeholder="VIDANGE"
                          disabled={!!editingId || saving}
                          autoComplete="off"
                        />
                        <small className="maint-field__hint">
                          {editingId
                            ? "Le code n'est pas modifiable après création."
                            : 'Ex. VIDANGE, PLAQUETTES, FILTRE_AIR'}
                        </small>
                      </label>

                      <label className="maint-field">
                        <span className="maint-field__label">Libellé *</span>
                        <input
                          className="maint-field__input"
                          name="libelle"
                          value={form.libelle}
                          onChange={handleChange}
                          placeholder="Vidange huile moteur"
                          disabled={saving}
                          autoComplete="off"
                        />
                        <small className="maint-field__hint">Nom affiché aux utilisateurs</small>
                      </label>
                    </div>
                  </section>

                  <section className="maint-group" aria-labelledby="maint-group-seuils">
                    <div>
                      <h5 id="maint-group-seuils" className="maint-group__title">Seuils kilométriques</h5>
                      <p className="maint-group__desc">
                        Intervalle de déclenchement et marge de pré-alerte
                      </p>
                    </div>

                    <div className="maint-grid">
                      <label className="maint-field">
                        <span className="maint-field__label">Intervalle *</span>
                        <div className="maint-field__affix">
                          <input
                            className="maint-field__input maint-field__input--suffixed"
                            type="number"
                            min="1"
                            name="intervalleKm"
                            value={form.intervalleKm}
                            onChange={handleChange}
                            placeholder="10000"
                            disabled={saving}
                          />
                          <span className="maint-field__suffix">km</span>
                        </div>
                        <small className="maint-field__hint">Distance entre deux interventions</small>
                      </label>

                      <label className="maint-field">
                        <span className="maint-field__label">Marge d'alerte</span>
                        <div className="maint-field__affix">
                          <input
                            className="maint-field__input maint-field__input--suffixed"
                            type="number"
                            min="0"
                            name="seuilAlerteKm"
                            value={form.seuilAlerteKm}
                            onChange={handleChange}
                            placeholder="500"
                            disabled={saving}
                          />
                          <span className="maint-field__suffix">km</span>
                        </div>
                        <small className="maint-field__hint">
                          Prévient l'utilisateur avant l'échéance
                        </small>
                      </label>
                    </div>
                  </section>

                  <section className="maint-group" aria-labelledby="maint-group-avance">
                    <div>
                      <h5 id="maint-group-avance" className="maint-group__title">Paramètres avancés</h5>
                      <p className="maint-group__desc">Bon de maintenance et cycle de recalcul</p>
                    </div>

                    <div className="maint-grid">
                      <label className="maint-field">
                        <span className="maint-field__label">Urgence du bon</span>
                        <input
                          className="maint-field__input"
                          type="number"
                          min="1"
                          max="4"
                          name="urgenceBon"
                          value={form.urgenceBon}
                          onChange={handleChange}
                          placeholder="1 à 4"
                          disabled={saving}
                        />
                        <small className="maint-field__hint">
                          Niveau 1 (faible) à 4 (critique)
                        </small>
                      </label>

                      <label className="maint-field">
                        <span className="maint-field__label">Base de recalcul</span>
                        <select
                          className="maint-field__input maint-field__input--select"
                          name="baseRecalcul"
                          value={form.baseRecalcul}
                          onChange={handleChange}
                          disabled={saving}
                        >
                          <option value={0}>Kilométrage réel de l'intervention</option>
                          <option value={1}>Seuil théorique</option>
                        </select>
                        <small className="maint-field__hint">
                          Référence pour calculer le prochain seuil
                        </small>
                      </label>
                    </div>

                    <label className="maint-switch">
                      <input
                        className="maint-switch__input"
                        type="checkbox"
                        role="switch"
                        name="actif"
                        checked={form.actif}
                        onChange={handleChange}
                        disabled={saving}
                      />
                      <span className="maint-switch__knob" aria-hidden="true" />
                      <span className="maint-switch__text">
                        <span className="maint-switch__title">Type actif</span>
                        <small className="maint-switch__desc">
                          Contrôlé automatiquement à chaque mise à jour du kilométrage
                        </small>
                      </span>
                    </label>
                  </section>

                  {formError && (
                    <div className="maint-alert maint-alert--inline" role="alert">
                      <AlertTriangle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}
                </div>

                <footer className="maint-dialog__footer">
                  <span className="maint-dialog__hint">
                    <kbd className="maint-kbd">Échap</kbd> pour annuler
                  </span>

                  <div className="maint-dialog__buttons">
                    <button
                      type="button"
                      className="maint-btn maint-btn--ghost"
                      onClick={closeForm}
                      disabled={saving}
                    >
                      Annuler
                    </button>
                    <button type="submit" className="maint-btn maint-btn--primary" disabled={saving}>
                      {saving ? (
                        <><Loader2 size={15} className="maint-spin" /> Enregistrement…</>
                      ) : (
                        <>
                          <Save size={15} />
                          {editingId ? 'Enregistrer les modifications' : 'Créer le type'}
                        </>
                      )}
                    </button>
                  </div>
                </footer>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}