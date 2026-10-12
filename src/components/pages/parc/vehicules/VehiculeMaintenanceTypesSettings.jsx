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
import { t, tp, locale } from '../../../../i18n';
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

// Formatage dans la langue courante (l'app est remontée à chaque changement de langue)
const nf = { format: (v) => new Intl.NumberFormat(locale()).format(v) };

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
      setError(err?.response?.data?.message || t('Impossible de charger les seuils.'));
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

  const openEdit = (typeMaint) => {
    setEditingId(typeMaint.id);
    setForm({
      code: typeMaint.code ?? '',
      libelle: typeMaint.libelle ?? '',
      intervalleKm: typeMaint.intervalleKm ?? '',
      seuilAlerteKm: typeMaint.seuilAlerteKm ?? '',
      urgenceBon: typeMaint.urgenceBon ?? '',
      baseRecalcul: typeMaint.baseRecalcul ?? 0,
      actif: typeMaint.actif ?? true,
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

    const timer = setTimeout(() => codeInputRef.current?.focus(), 60);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
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
      setFormError(err?.response?.data?.message || t("Échec de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (!saving) handleSave();
  };

  const doToggle = async (typeMaint) => {
    setPendingId(typeMaint.id);
    setError(null);
    try {
      if (typeMaint.actif) {
        await vehiculeMaintenanceService.removeType(typeMaint.id);
      } else {
        await vehiculeMaintenanceService.updateType(typeMaint.id, { ...typeMaint, actif: true });
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || t('Échec de la mise à jour.'));
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  const handleToggleActif = (typeMaint) => {
    if (typeMaint.actif) {
      setConfirmId(typeMaint.id);
    } else {
      doToggle(typeMaint);
    }
  };

  const stats = useMemo(() => {
    const total = types.length;
    const actifs = types.filter((typeMaint) => typeMaint.actif).length;
    const avgIntervalle = total
      ? Math.round(types.reduce((s, typeMaint) => s + (Number(typeMaint.intervalleKm) || 0), 0) / total)
      : 0;
    return { total, actifs, inactifs: total - actifs, avgIntervalle };
  }, [types]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = types.filter((typeMaint) => {
      if (statusFilter === 'active' && !typeMaint.actif) return false;
      if (statusFilter === 'inactive' && typeMaint.actif) return false;
      if (!q) return true;
      return (
        (typeMaint.code || '').toLowerCase().includes(q) ||
        (typeMaint.libelle || '').toLowerCase().includes(q)
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
            {t("Paramètres de maintenance préventive")}
          </h3>
          <p className="mtp-panel__lead">
            {t("Vos propres seuils kilométriques — aucune valeur imposée par défaut.")}
          </p>
        </div>
        <button type="button" className="mtp-panel__add" onClick={openCreate}>
          <Plus size={16} /> {t("Nouveau type")}
        </button>
      </header>

      <div className="mtp-kpis" role="list">
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--total" aria-hidden="true">
            <Activity size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.total}</span>
            <span className="mtp-kpi__label">{t("Types")}</span>
          </div>
        </div>
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--on" aria-hidden="true">
            <CheckCircle2 size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.actifs}</span>
            <span className="mtp-kpi__label">{t("Actifs")}</span>
          </div>
        </div>
        <div className="mtp-kpi" role="listitem">
          <span className="mtp-kpi__icon mtp-kpi__icon--off" aria-hidden="true">
            <CircleSlash size={15} />
          </span>
          <div className="mtp-kpi__body">
            <span className="mtp-kpi__value">{stats.inactifs}</span>
            <span className="mtp-kpi__label">{t("Désactivés")}</span>
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
            <span className="mtp-kpi__label">{t("km moyen")}</span>
          </div>
        </div>
      </div>

      <div className="mtp-toolbar">
        <div className="mtp-search">
          <Search size={15} className="mtp-search__icon" aria-hidden="true" />
          <input
            type="search"
            className="mtp-search__input"
            placeholder={t("Rechercher un code ou un libellé…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("Rechercher")}
          />
          {query && (
            <button
              type="button"
              className="mtp-search__clear"
              onClick={() => setQuery('')}
              aria-label={t("Effacer la recherche")}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="mtp-chips" role="group" aria-label={t("Filtrer par statut")}>
          {[
            { v: 'all',      label: t("Tous"),       count: stats.total },
            { v: 'active',   label: t("Actifs"),     count: stats.actifs },
            { v: 'inactive', label: t("Désactivés"), count: stats.inactifs },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              className={`mtp-chip${statusFilter === opt.v ? ' mtp-chip--active' : ''}`}
              onClick={() => setStatusFilter(opt.v)}
              aria-pressed={statusFilter === opt.v}
            >
              {t(opt.label)}
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
            aria-label={t("Trier")}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{t(s.label)}</option>
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
            <span>{t("Chargement des seuils…")}</span>
          </div>
        )}

        {!loading && types.length === 0 && (
          <div className="mtp-cards__state mtp-cards__state--empty">
            <Inbox size={32} strokeWidth={1.5} />
            <p className="mtp-cards__state-title">{t("Aucun type de maintenance")}</p>
            <p className="mtp-cards__state-text">
              {t("Cliquez sur « Nouveau type » pour créer votre premier seuil (ex. Vidange tous les 10 000 km).")}
            </p>
            <button
              type="button"
              className="mtp-btn mtp-btn--primary mtp-btn--sm"
              onClick={openCreate}
            >
              <Plus size={14} /> {t("Créer le premier type")}
            </button>
          </div>
        )}

        {!loading && types.length > 0 && filtered.length === 0 && (
          <div className="mtp-cards__state mtp-cards__state--empty">
            <Search size={28} strokeWidth={1.5} />
            <p className="mtp-cards__state-title">{t("Aucun résultat")}</p>
            <p className="mtp-cards__state-text">
              {t("Aucun type ne correspond aux critères sélectionnés.")}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="mtp-btn mtp-btn--ghost mtp-btn--sm"
                onClick={resetFilters}
              >
                <RotateCcw size={13} /> {t("Réinitialiser les filtres")}
              </button>
            )}
          </div>
        )}

        {!loading &&
          filtered.map((typeMaint) => {
            const isPending = pendingId === typeMaint.id;
            const isConfirm = confirmId === typeMaint.id;

            const interval = Number(typeMaint.intervalleKm) || 0;
            const margin = Number(typeMaint.seuilAlerteKm) || 0;
            const alertAt = Math.max(0, interval - margin);
            const alertPct = interval > 0 ? Math.min(100, (margin / interval) * 100) : 0;
            const urgency = typeMaint.urgenceBon ? URGENCE[typeMaint.urgenceBon] : null;

            return (
              <article
                key={typeMaint.id}
                role="listitem"
                className={[
                  'mtp-card',
                  !typeMaint.actif && 'mtp-card--inactive',
                  isPending && 'mtp-card--pending',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <header className="mtp-card__head">
                  <code className="mtp-card__code">{typeMaint.code}</code>
                  <span
                    className={`mtp-status ${typeMaint.actif ? 'mtp-status--on' : 'mtp-status--off'}`}
                  >
                    {typeMaint.actif ? t("Actif") : t("Désactivé")}
                  </span>
                </header>

                <h4 className="mtp-card__title">{typeMaint.libelle}</h4>

                <div className="mtp-card__gauge">
                  <div className="mtp-card__gauge-head">
                    <span className="mtp-card__gauge-value">
                      {nf.format(interval)} <em>{t("km")}</em>
                    </span>
                    {margin > 0 && (
                      <span className="mtp-card__gauge-hint">
                        {t("alerte dès")} {nf.format(alertAt)} {t("km")}
                      </span>
                    )}
                  </div>
                  <div
                    className="mtp-card__gauge-track"
                    role="img"
                    aria-label={
                      margin > 0
                        ? t('Échéance à {n} km, alerte dès {a} km', { n: nf.format(interval), a: nf.format(alertAt) })
                        : t('Échéance à {n} km, sans pré-alerte', { n: nf.format(interval) })
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
                      <BellRing size={12} /> {t("Pré-alerte")}
                    </dt>
                    <dd>
                      {typeMaint.seuilAlerteKm != null
                        ? `${nf.format(margin)} km`
                        : <span className="mtp-card__muted">—</span>}
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Flag size={12} /> {t("Urgence")}
                    </dt>
                    <dd>
                      {urgency ? (
                        <span className={`mtp-urgency mtp-urgency--${typeMaint.urgenceBon}`}>
                          {typeMaint.urgenceBon} · {t(urgency.label)}
                        </span>
                      ) : (
                        <span className="mtp-card__muted">—</span>
                      )}
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Calculator size={12} /> {t("Recalcul")}
                    </dt>
                    <dd>
                      <span className="mtp-card__tag">
                        {typeMaint.baseRecalcul === 1 ? t("Seuil théorique") : t("Km réel")}
                      </span>
                    </dd>
                  </div>
                </dl>

                <footer className="mtp-card__foot">
                  <button
                    type="button"
                    className="mtp-card__btn mtp-card__btn--edit"
                    onClick={() => openEdit(typeMaint)}
                    disabled={isPending || isConfirm}
                  >
                    <Pencil size={14} /> {t("Modifier")}
                  </button>

                  {isConfirm ? (
                    <div className="mtp-confirm" role="group" aria-label={t("Confirmer la désactivation")}>
                      <span className="mtp-confirm__label">{t("Désactiver ?")}</span>
                      <button
                        type="button"
                        className="mtp-confirm__btn mtp-confirm__btn--yes"
                        onClick={() => doToggle(typeMaint)}
                        aria-label={t("Confirmer la désactivation")}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="mtp-confirm__btn mtp-confirm__btn--no"
                        onClick={() => setConfirmId(null)}
                        aria-label={t("Annuler")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleActif(typeMaint)}
                      className={`mtp-card__btn ${
                        typeMaint.actif ? 'mtp-card__btn--danger' : 'mtp-card__btn--restore'
                      }`}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 size={14} className="mtp-spin" /> {t("Traitement…")}
                        </>
                      ) : typeMaint.actif ? (
                        <>
                          <Pause size={14} /> {t("Désactiver")}
                        </>
                      ) : (
                        <>
                          <RotateCcw size={14} /> {t("Réactiver")}
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
            <aside className="mtp-dialog__aside" aria-label={t("Aperçu du seuil")}>
              <div className="mtp-dialog__aside-head">
                <span className="mtp-dialog__icon" aria-hidden="true">
                  {editingId ? <Pencil size={16} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={2.4} />}
                </span>
                <span className="mtp-dialog__badge">
                  {form.code.trim().toUpperCase() || 'CODE'}
                </span>
              </div>

              <p className="mtp-dialog__aside-title">
                {form.libelle.trim() || t("Libellé du type")}
              </p>

              <div className="mtp-gauge">
                {preview ? (
                  <>
                    <p className="mtp-gauge__value">
                      {nf.format(preview.interval)}
                      <span className="mtp-gauge__unit">{t("km")}</span>
                    </p>

                    <div
                      className="mtp-gauge__track"
                      role="img"
                      aria-label={
                        preview.margin > 0
                          ? t('Échéance à {n} km, alerte dès {a} km', { n: nf.format(preview.interval), a: nf.format(preview.alertAt) })
                          : t('Échéance à {n} km, sans pré-alerte', { n: nf.format(preview.interval) })
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
                        {t("Circulation normale")}
                        <span className="mtp-gauge__legend-range">
                          0 – {nf.format(preview.alertAt)} {t("km")}
                        </span>
                      </li>
                      {preview.margin > 0 && (
                        <li className="mtp-gauge__legend-item mtp-gauge__legend-item--alert">
                          {t("Zone d'alerte")}
                          <span className="mtp-gauge__legend-range">
                            {nf.format(preview.alertAt)} – {nf.format(preview.interval)} {t("km")}
                          </span>
                        </li>
                      )}
                      <li className="mtp-gauge__legend-item mtp-gauge__legend-item--due">
                        {t("Échéance")}
                        <span className="mtp-gauge__legend-range">
                          {nf.format(preview.interval)} {t("km")}
                        </span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <p className="mtp-gauge__placeholder">
                    {t("Saisissez un intervalle pour visualiser le cycle de maintenance.")}
                  </p>
                )}
              </div>

              <dl className="mtp-recap">
                <div className="mtp-recap__row">
                  <dt>{t("Urgence du bon")}</dt>
                  <dd>
                    {form.urgenceBon !== '' ? (
                      <span className={`mtp-urgency mtp-urgency--${form.urgenceBon}`}>
                        {form.urgenceBon}
                      </span>
                    ) : (t("Non définie"))}
                  </dd>
                </div>
                <div className="mtp-recap__row">
                  <dt>{t("Recalcul")}</dt>
                  <dd>{Number(form.baseRecalcul) === 1 ? t("Seuil théorique") : t("Km réel")}</dd>
                </div>
                <div className="mtp-recap__row">
                  <dt>{t("Statut")}</dt>
                  <dd>{form.actif ? t("Actif") : t("Désactivé")}</dd>
                </div>
              </dl>
            </aside>

            <div className="mtp-dialog__main">
              <header className="mtp-dialog__header">
                <div>
                  <h4 id="mtp-dialog-title" className="mtp-dialog__heading">
                    {editingId ? t("Modifier le type de maintenance") : t("Nouveau type de maintenance")}
                  </h4>
                  <p className="mtp-dialog__subtitle">
                    {editingId
                      ? t("Ajustez les paramètres du seuil de déclenchement")
                      : t("Définissez un nouveau seuil kilométrique préventif")}
                  </p>
                </div>
                <button
                  type="button"
                  className="mtp-dialog__close"
                  onClick={closeForm}
                  aria-label={t("Fermer")}
                  disabled={saving}
                >
                  <X size={16} />
                </button>
              </header>

              <form className="mtp-dialog__form" onSubmit={submitForm}>
                <div className="mtp-dialog__body">
                  <section className="mtp-group" aria-labelledby="mtp-group-id">
                    <div>
                      <h5 id="mtp-group-id" className="mtp-group__title">{t("Identification")}</h5>
                      <p className="mtp-group__desc">{t("Code unique et libellé utilisateur")}</p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Code technique *")}</span>
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
                            ? t("Le code n'est pas modifiable après création.")
                            : t("Ex. VIDANGE, PLAQUETTES, FILTRE_AIR")}
                        </small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Libellé *")}</span>
                        <input
                          className="mtp-field__input"
                          name="libelle"
                          value={form.libelle}
                          onChange={handleChange}
                          placeholder={t("Vidange huile moteur")}
                          disabled={saving}
                          autoComplete="off"
                        />
                        <small className="mtp-field__hint">{t("Nom affiché aux utilisateurs")}</small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-seuils">
                    <div>
                      <h5 id="mtp-group-seuils" className="mtp-group__title">{t("Seuils kilométriques")}</h5>
                      <p className="mtp-group__desc">
                        {t("Intervalle de déclenchement et marge de pré-alerte")}
                      </p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Intervalle *")}</span>
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
                          <span className="mtp-field__suffix">{t("km")}</span>
                        </div>
                        <small className="mtp-field__hint">{t("Distance entre deux interventions")}</small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Marge d'alerte")}</span>
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
                          <span className="mtp-field__suffix">{t("km")}</span>
                        </div>
                        <small className="mtp-field__hint">
                          {t("Prévient l'utilisateur avant l'échéance")}
                        </small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-avance">
                    <div>
                      <h5 id="mtp-group-avance" className="mtp-group__title">{t("Paramètres avancés")}</h5>
                      <p className="mtp-group__desc">{t("Bon de maintenance et cycle de recalcul")}</p>
                    </div>

                    <div className="mtp-grid">
                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Urgence du bon")}</span>
                        <input
                          className="mtp-field__input"
                          type="number"
                          min="1"
                          max="4"
                          name="urgenceBon"
                          value={form.urgenceBon}
                          onChange={handleChange}
                          placeholder={t("1 à 4")}
                          disabled={saving}
                        />
                        <small className="mtp-field__hint">
                          {t("Niveau 1 (faible) à 4 (critique)")}
                        </small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Base de recalcul")}</span>
                        <select
                          className="mtp-field__input mtp-field__input--select"
                          name="baseRecalcul"
                          value={form.baseRecalcul}
                          onChange={handleChange}
                          disabled={saving}
                        >
                          <option value={0}>{t("Kilométrage réel de l'intervention")}</option>
                          <option value={1}>{t("Seuil théorique")}</option>
                        </select>
                        <small className="mtp-field__hint">
                          {t("Référence pour calculer le prochain seuil")}
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
                        <span className="mtp-switch__title">{t("Type actif")}</span>
                        <small className="mtp-switch__desc">
                          {t("Contrôlé automatiquement à chaque mise à jour du kilométrage")}
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
                    <kbd className="mtp-kbd">{t("Échap")}</kbd> {t("pour annuler")}
                  </span>

                  <div className="mtp-dialog__buttons">
                    <button
                      type="button"
                      className="mtp-btn mtp-btn--ghost"
                      onClick={closeForm}
                      disabled={saving}
                    >
                      {t("Annuler")}
                    </button>
                    <button type="submit" className="mtp-btn mtp-btn--primary" disabled={saving}>
                      {saving ? (
                        <><Loader2 size={15} className="mtp-spin" /> {t("Enregistrement…")}</>
                      ) : (
                        <>
                          <Save size={15} />
                          {editingId ? t("Enregistrer les modifications") : t("Créer le type")}
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