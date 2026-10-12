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

  return (
    <section className="mtp-panel" aria-labelledby="mtp-panel-title">
      <header className="mtp-panel__head">
        <div>
          <h3 id="mtp-panel-title" className="mtp-panel__title">
            Paramètres de maintenance préventive
          </h3>
          <p className="mtp-panel__lead">
            Vos propres seuils kilométriques — aucune valeur imposée par défaut.
          </p>
        </div>
        <button type="button" className="mtp-panel__add" onClick={openCreate}>
          <Plus size={16} /> Nouveau type
        </button>
      </header>

      <div className="mtp-kpis" role="list">
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--total" aria-hidden="true">
            <Activity size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.total}</span>
            <span className="mtp-kpi__label">Types</span>
          </div>
        </div>
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--on" aria-hidden="true">
            <CheckCircle2 size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.actifs}</span>
            <span className="mtp-kpi__label">Actifs</span>
          </div>
        </div>
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--off" aria-hidden="true">
            <CircleSlash size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.inactifs}</span>
            <span className="mtp-kpi__label">Désactivés</span>
          </div>
        </div>
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--avg" aria-hidden="true">
            <TrendingUp size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">
              {stats.avgIntervalle ? nf.format(stats.avgIntervalle) : '—'}
            </span>
            <span className="mtp-kpi__label">km moyen</span>
          </div>
        </div>
      </div>

      <div className="mtp-toolbar">
        <div className="mtp-search">
          <Search size={15} className="mtp-search__icon" aria-hidden="true" />
          <input
            type="search"
            className="mtp-search__input"
            placeholder="Rechercher un code ou un libellé…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher"
          />
          {query && (
            <button
              type="button"
              className="mtp-search__clear"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="mtp-chips" role="group" aria-label="Filtrer par statut">
          {[
            { v: 'all',      label: 'Tous',       count: stats.total },
            { v: 'active',   label: 'Actifs',     count: stats.actifs },
            { v: 'inactive', label: 'Désactivés', count: stats.inactifs },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              className={`mtp-chip${statusFilter === opt.v ? ' mtp-chip--active' : ''}`}
              onClick={() => setStatusFilter(opt.v)}
              aria-pressed={statusFilter === opt.v}
            >
              {opt.label}
              <span className="mtp-chip__count">{opt.count}</span>
            </button>
          ))}
        </div>

        <label className="mtp-sort">
          <ArrowUpDown size={14} aria-hidden="true" />
          <select
            className="mtp-sort__select"
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
        <div className="mtp-alert" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="mtp-cards" role="list">
        {loading && (
          <div className="mtp-cards__state mtp-cards__state--loading">
            <Loader2 size={22} className="mtp-spin" />
            <span>Chargement des seuils…</span>
          </div>
        )}

        {!loading && types.length === 0 && (
          <div className="mtp-cards__state mtp-cards__state--empty">
            <Inbox size={32} strokeWidth={1.5} />
            <p className="mtp-cards__state-title">Aucun type de maintenance</p>
            <p className="mtp-cards__state-text">
              Cliquez sur « Nouveau type » pour créer votre premier seuil
              (ex. Vidange tous les 10 000 km).
            </p>
            <button
              type="button"
              className="mtp-btn mtp-btn--primary mtp-btn--sm"
              onClick={openCreate}
            >
              <Plus size={14} /> Créer le premier type
            </button>
          </div>
        )}

        {!loading && types.length > 0 && filtered.length === 0 && (
          <div className="mtp-cards__state mtp-cards__state--empty">
            <Search size={28} strokeWidth={1.5} />
            <p className="mtp-cards__state-title">Aucun résultat</p>
            <p className="mtp-cards__state-text">
              Aucun type ne correspond aux critères sélectionnés.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="mtp-btn mtp-btn--ghost mtp-btn--sm"
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
                  'mtp-card',
                  !t.actif && 'mtp-card--inactive',
                  isPending && 'mtp-card--pending',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <header className="mtp-card__head">
                  <code className="mtp-card__code">{t.code}</code>
                  <span
                    className={`mtp-status ${t.actif ? 'mtp-status--on' : 'mtp-status--off'}`}
                  >
                    {t.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </header>

                <h4 className="mtp-card__title">{t.libelle}</h4>

                <div className="mtp-card__gauge">
                  <div className="mtp-card__gauge-head">
                    <span className="mtp-card__gauge-value">
                      {nf.format(interval)} <em>km</em>
                    </span>
                    {margin > 0 && (
                      <span className="mtp-card__gauge-hint">
                        alerte dès {nf.format(alertAt)} km
                      </span>
                    )}
                  </div>
                  <div
                    className="mtp-card__gauge-track"
                    role="img"
                    aria-label={
                      margin > 0
                        ? `Échéance à ${nf.format(interval)} km, alerte dès ${nf.format(alertAt)} km`
                        : `Échéance à ${nf.format(interval)} km, sans pré-alerte`
                    }
                  >
                    <span className="mtp-card__gauge-ok" />
                    {margin > 0 && (
                      <span
                        className="mtp-card__gauge-alert"
                        style={{ width: `${alertPct}%` }}
                      />
                    )}
                  </div>
                </div>

                <dl className="mtp-card__metrics">
                  <div className="mtp-card__metric">
                    <dt>
                      <BellRing size={12} /> Pré-alerte
                    </dt>
                    <dd>
                      {t.seuilAlerteKm != null
                        ? `${nf.format(margin)} km`
                        : <span className="mtp-card__muted">—</span>}
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Flag size={12} /> Urgence
                    </dt>
                    <dd>
                      {urgency ? (
                        <span className={`mtp-urgency mtp-urgency--${t.urgenceBon}`}>
                          {t.urgenceBon} · {urgency.label}
                        </span>
                      ) : (
                        <span className="mtp-card__muted">—</span>
                      )}
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Calculator size={12} /> Recalcul
                    </dt>
                    <dd>
                      <span className="mtp-card__tag">
                        {t.baseRecalcul === 1 ? 'Seuil théorique' : 'Km réel'}
                      </span>
                    </dd>
                  </div>
                </dl>

                <footer className="mtp-card__foot">
                  <button
                    type="button"
                    className="mtp-card__btn mtp-card__btn--edit"
                    onClick={() => openEdit(t)}
                    disabled={isPending || isConfirm}
                  >
                    <Pencil size={14} /> Modifier
                  </button>

                  {isConfirm ? (
                    <div className="mtp-confirm" role="group" aria-label="Confirmer la désactivation">
                      <span className="mtp-confirm__label">Désactiver ?</span>
                      <button
                        type="button"
                        className="mtp-confirm__btn mtp-confirm__btn--yes"
                        onClick={() => doToggle(t)}
                        aria-label="Confirmer la désactivation"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="mtp-confirm__btn mtp-confirm__btn--no"
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
                      className={`mtp-card__btn ${
                        t.actif ? 'mtp-card__btn--danger' : 'mtp-card__btn--restore'
                      }`}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 size={14} className="mtp-spin" /> Traitement…
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

      {formOpen && (
        <div
          className="mtp-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mtp-dialog-title"
          onClick={closeForm}
        >
          <div className="mtp-dialog" onClick={(e) => e.stopPropagation()}>
            <aside className="mtp-dialog__aside" aria-label="Aperçu du seuil">
              <div className="mtp-dialog__aside-head">
                <span className="mtp-dialog__icon" aria-hidden="true">
                  {editingId ? <Pencil size={16} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={2.4} />}
                </span>
                <span className="mtp-dialog__badge">
                  {form.code.trim().toUpperCase() || 'CODE'}
                </span>
              </div>

              <p className="mtp-dialog__aside-title">
                {form.libelle.trim() || 'Libellé du type'}
              </p>

              <div className="mtp-gauge">
                {preview ? (
                  <>
                    <p className="mtp-gauge__value">
                      {nf.format(preview.interval)}
                      <span className="mtp-gauge__unit">km</span>
                    </p>

                    <div
                      className="mtp-gauge__track"
                      role="img"
                      aria-label={
                        preview.margin > 0
                          ? `Échéance à ${nf.format(preview.interval)} km, alerte dès ${nf.format(preview.alertAt)} km`
                          : `Échéance à ${nf.format(preview.interval)} km, sans pré-alerte`
                      }
                    >
                      <span className="mtp-gauge__ok" />
                      {preview.margin > 0 && (
                        <span
                          className="mtp-gauge__alert"
                          style={{ width: `${preview.alertPct}%` }}
                        />
                      )}
                    </div>

                    <ul className="mtp-gauge__legend">
                      <li className="mtp-gauge__legend-item mtp-gauge__legend-item--ok">
                        Circulation normale
                        <span className="mtp-gauge__legend-range">
                          0 – {nf.format(preview.alertAt)} km
                        </span>
                      </li>
                      {preview.margin > 0 && (
                        <li className="mtp-gauge__legend-item mtp-gauge__legend-item--alert">
                          Zone d'alerte
                          <span className="mtp-gauge__legend-range">
                            {nf.format(preview.alertAt)} – {nf.format(preview.interval)} km
                          </span>
                        </li>
                      )}
                      <li className="mtp-gauge__legend-item mtp-gauge__legend-item--due">
                        Échéance
                        <span className="mtp-gauge__legend-range">
                          {nf.format(preview.interval)} km
                        </span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <p className="mtp-gauge__placeholder">
                    Saisissez un intervalle pour visualiser le cycle de maintenance.
                  </p>
                )}
              </div>

              <dl className="mtp-recap">
                <div className="mtp-recap__row">
                  <dt>Urgence du bon</dt>
                  <dd>
                    {form.urgenceBon !== '' ? (
                      <span className={`mtp-urgency mtp-urgency--${form.urgenceBon}`}>
                        {form.urgenceBon}
                      </span>
                    ) : ('Non définie')}
                  </dd>
                </div>
                <div className="mtp-recap__row">
                  <dt>Recalcul</dt>
                  <dd>{Number(form.baseRecalcul) === 1 ? 'Seuil théorique' : 'Km réel'}</dd>
                </div>
                <div className="mtp-recap__row">
                  <dt>Statut</dt>
                  <dd>{form.actif ? 'Actif' : 'Désactivé'}</dd>
                </div>
              </dl>
            </aside>

            <div className="mtp-dialog__main">
              <header className="mtp-dialog__header">
                <div>
                  <h4 id="mtp-dialog-title" className="mtp-dialog__heading">
                    {editingId ? 'Modifier le type de maintenance' : 'Nouveau type de maintenance'}
                  </h4>
                  <p className="mtp-dialog__subtitle">
                    {editingId
                      ? 'Ajustez les paramètres du seuil de déclenchement'
                      : 'Définissez un nouveau seuil kilométrique préventif'}
                  </p>
                </div>
                <button
                  type="button"
                  className="mtp-dialog__close"
                  onClick={closeForm}
                  aria-label="Fermer"
                  disabled={saving}
                >
                  <X size={16} />
                </button>
              </header>

              <form className="mtp-dialog__form" onSubmit={submitForm}>
                <div className="mtp-dialog__body">
                  <section className="mtp-group" aria-labelledby="mtp-group-id">
                    <div>
                      <h5 id="mtp-group-id" className="mtp-group__title">Identification</h5>
                      <p className="mtp-group__desc">Code unique et libellé utilisateur</p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">Code technique *</span>
                        <input
                          ref={codeInputRef}
                          className="mtp-field__input"
                          name="code"
                          value={form.code}
                          onChange={handleChange}
                          placeholder="VIDANGE"
                          disabled={!!editingId || saving}
                          autoComplete="off"
                        />
                        <small className="mtp-field__hint">
                          {editingId
                            ? "Le code n'est pas modifiable après création."
                            : 'Ex. VIDANGE, PLAQUETTES, FILTRE_AIR'}
                        </small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">Libellé *</span>
                        <input
                          className="mtp-field__input"
                          name="libelle"
                          value={form.libelle}
                          onChange={handleChange}
                          placeholder="Vidange huile moteur"
                          disabled={saving}
                          autoComplete="off"
                        />
                        <small className="mtp-field__hint">Nom affiché aux utilisateurs</small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-seuils">
                    <div>
                      <h5 id="mtp-group-seuils" className="mtp-group__title">Seuils kilométriques</h5>
                      <p className="mtp-group__desc">
                        Intervalle de déclenchement et marge de pré-alerte
                      </p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">Intervalle *</span>
                        <div className="mtp-field__affix">
                          <input
                            className="mtp-field__input mtp-field__input--suffixed"
                            type="number"
                            min="1"
                            name="intervalleKm"
                            value={form.intervalleKm}
                            onChange={handleChange}
                            placeholder="10000"
                            disabled={saving}
                          />
                          <span className="mtp-field__suffix">km</span>
                        </div>
                        <small className="mtp-field__hint">Distance entre deux interventions</small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">Marge d'alerte</span>
                        <div className="mtp-field__affix">
                          <input
                            className="mtp-field__input mtp-field__input--suffixed"
                            type="number"
                            min="0"
                            name="seuilAlerteKm"
                            value={form.seuilAlerteKm}
                            onChange={handleChange}
                            placeholder="500"
                            disabled={saving}
                          />
                          <span className="mtp-field__suffix">km</span>
                        </div>
                        <small className="mtp-field__hint">
                          Prévient l'utilisateur avant l'échéance
                        </small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-avance">
                    <div>
                      <h5 id="mtp-group-avance" className="mtp-group__title">Paramètres avancés</h5>
                      <p className="mtp-group__desc">Bon de maintenance et cycle de recalcul</p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">Urgence du bon</span>
                        <input
                          className="mtp-field__input"
                          type="number"
                          min="1"
                          max="4"
                          name="urgenceBon"
                          value={form.urgenceBon}
                          onChange={handleChange}
                          placeholder="1 à 4"
                          disabled={saving}
                        />
                        <small className="mtp-field__hint">
                          Niveau 1 (faible) à 4 (critique)
                        </small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">Base de recalcul</span>
                        <select
                          className="mtp-field__input mtp-field__input--select"
                          name="baseRecalcul"
                          value={form.baseRecalcul}
                          onChange={handleChange}
                          disabled={saving}
                        >
                          <option value={0}>Kilométrage réel de l'intervention</option>
                          <option value={1}>Seuil théorique</option>
                        </select>
                        <small className="mtp-field__hint">
                          Référence pour calculer le prochain seuil
                        </small>
                      </label>
                    </div>

                    <label className="mtp-switch">
                      <input
                        className="mtp-switch__input"
                        type="checkbox"
                        role="switch"
                        name="actif"
                        checked={form.actif}
                        onChange={handleChange}
                        disabled={saving}
                      />
                      <span className="mtp-switch__knob" aria-hidden="true" />
                      <span className="mtp-switch__text">
                        <span className="mtp-switch__title">Type actif</span>
                        <small className="mtp-switch__desc">
                          Contrôlé automatiquement à chaque mise à jour du kilométrage
                        </small>
                      </span>
                    </label>
                  </section>

                  {formError && (
                    <div className="mtp-alert mtp-alert--inline" role="alert">
                      <AlertTriangle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}
                </div>

                <footer className="mtp-dialog__footer">
                  <span className="mtp-dialog__hint">
                    <kbd className="mtp-kbd">Échap</kbd> pour annuler
                  </span>

                  <div className="mtp-dialog__buttons">
                    <button
                      type="button"
                      className="mtp-btn mtp-btn--ghost"
                      onClick={closeForm}
                      disabled={saving}
                    >
                      Annuler
                    </button>
                    <button type="submit" className="mtp-btn mtp-btn--primary" disabled={saving}>
                      {saving ? (
                        <><Loader2 size={15} className="mtp-spin" /> Enregistrement…</>
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