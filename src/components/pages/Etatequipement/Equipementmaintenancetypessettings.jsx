import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Pencil,
  X,
  Save,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Inbox,
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
  ChevronDown,
  Check,
  Boxes,
} from 'lucide-react';
import equipementMaintenanceService from '../../../services/equipementMaintenanceService';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import { t, locale } from '../../../i18n';
// Réutilise le style du panneau équivalent du Parc automobile (classes mtp-*
// génériques, sans rien de spécifique au kilométrage).
import '../parc/vehicules/VehiculeMaintenanceTypesSettings.css';
// Réutilise les styles du combobox « bmd-searchable » déjà utilisé pour
// rechercher une immobilisation ailleurs dans l'appli (BonMaintenanceDetails).
import '../bonmaintenance/Bonmaintenancedetails.css';
// Overrides spécifiques à ce panneau (ex. ascenseur de secours sur la modale).
import './EquipementMaintenanceTypesSettings.css';

// ─── Select avec recherche intégrée (combobox), identique au composant
// local déjà dupliqué dans BonMaintenanceDetails.jsx / VehiculeMissionModal.jsx. ───
const SearchableSelect = ({
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

  return (
    <div className="bmd-searchable" ref={containerRef}>
      <div className={`bmd-searchable-input-wrap ${isOpen ? 'is-open' : ''}`}>
        <Search size={15} strokeWidth={2.3} className="bmd-searchable-icon" />

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="bmd-searchable-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={loading ? t("Chargement...") : (selected ? '' : placeholder)}
          disabled={disabled || loading}
          autoComplete="off"
        />

        {(selected || search) && !disabled && !loading && (
          <button
            type="button"
            className="bmd-searchable-clear-inline"
            onClick={handleClear}
            aria-label={t("Effacer")}
            tabIndex={-1}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}

        <ChevronDown
          size={15}
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
                  <span className="bmd-searchable-option-label">{emptyOptionLabel}</span>
                </span>
                {!value && <Check size={14} strokeWidth={2.5} />}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="bmd-searchable-empty">{emptyMessage}</div>
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
                      {hint && (
                        <span className="bmd-searchable-option-hint">{hint}</span>
                      )}
                    </span>
                    {isSelected && <Check size={14} strokeWidth={2.5} />}
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

/**
 * Miroir de VehiculeMaintenanceTypesSettings.jsx, mais pour le référentiel
 * des maintenances préventives RÉGLEMENTAIRES des équipements médicaux
 * (calibration, contrôle qualité périodique...), piloté par une périodicité
 * en JOURS plutôt qu'un seuil kilométrique.
 */
const emptyForm = {
  code: '',
  libelle: '',
  intervalleJours: '',
  seuilAlerteJours: '',
  urgenceBon: '',
  baseRecalcul: 0,
  actif: true,
  lotArticleImmobilistationId: '',
};

// Format des nombres selon la langue choisie
const nf = { format: (v) => new Intl.NumberFormat(locale()).format(v) };

const URGENCE = {
  1: { label: 'Faible',   tone: 'green'  },
  2: { label: 'Normale',  tone: 'blue'   },
  3: { label: 'Haute',    tone: 'orange' },
  4: { label: 'Critique', tone: 'red'    },
};

const SORTS = [
  { value: 'code',            label: 'Code (A→Z)' },
  { value: 'libelle',         label: 'Libellé (A→Z)' },
  { value: 'intervalleJours', label: 'Intervalle ↑' },
  { value: 'urgenceBon',      label: 'Urgence ↑' },
];

export default function EquipementMaintenanceTypesSettings() {
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

  const [immobilisations, setImmobilisations] = useState([]);
  const [loadingImmobilisations, setLoadingImmobilisations] = useState(false);

  const codeInputRef = useRef(null);

  const immobilisationsMap = useMemo(
    () => new Map(immobilisations.map((i) => [String(i.id), i])),
    [immobilisations],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await equipementMaintenanceService.getTypes();
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de charger les échéances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    setLoadingImmobilisations(true);
    lotArticleImmobilistationService.getAll(0, 200)
      .then((page) => {
        if (!active) return;
        const data = page?.content ?? page?.data ?? page ?? [];
        setImmobilisations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Erreur chargement des équipements :', err);
        if (active) setImmobilisations([]);
      })
      .finally(() => {
        if (active) setLoadingImmobilisations(false);
      });
    return () => { active = false; };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (tache) => {
    setEditingId(tache.id);
    setForm({
      code: tache.code ?? '',
      libelle: tache.libelle ?? '',
      intervalleJours: tache.intervalleJours ?? '',
      seuilAlerteJours: tache.seuilAlerteJours ?? '',
      urgenceBon: tache.urgenceBon ?? '',
      baseRecalcul: tache.baseRecalcul ?? 0,
      actif: tache.actif ?? true,
      lotArticleImmobilistationId: tache.lotArticleImmobilistationId != null
        ? String(tache.lotArticleImmobilistationId)
        : '',
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

    const tache = setTimeout(() => codeInputRef.current?.focus(), 60);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(tache);
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
    if (!form.intervalleJours || Number(form.intervalleJours) <= 0) {
      setFormError("L'intervalle en jours doit être strictement positif.");
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
        intervalleJours: Number(form.intervalleJours),
        seuilAlerteJours: form.seuilAlerteJours === '' ? null : Number(form.seuilAlerteJours),
        urgenceBon: form.urgenceBon === '' ? null : Number(form.urgenceBon),
        baseRecalcul: Number(form.baseRecalcul),
        actif: form.actif,
        lotArticleImmobilistationId: form.lotArticleImmobilistationId === ''
          ? null
          : Number(form.lotArticleImmobilistationId),
      };

      if (editingId) {
        await equipementMaintenanceService.updateType(editingId, payload);
      } else {
        await equipementMaintenanceService.createType(payload);
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

  const doToggle = async (tache) => {
    setPendingId(tache.id);
    setError(null);
    try {
      if (tache.actif) {
        await equipementMaintenanceService.removeType(tache.id);
      } else {
        await equipementMaintenanceService.updateType(tache.id, { ...tache, actif: true });
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Échec de la mise à jour.');
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  const handleToggleActif = (tache) => {
    if (tache.actif) {
      setConfirmId(tache.id);
    } else {
      doToggle(tache);
    }
  };

  const stats = useMemo(() => {
    const total = types.length;
    const actifs = types.filter((tache) => tache.actif).length;
    const avgIntervalle = total
      ? Math.round(types.reduce((s, tache) => s + (Number(tache.intervalleJours) || 0), 0) / total)
      : 0;
    return { total, actifs, inactifs: total - actifs, avgIntervalle };
  }, [types]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = types.filter((tache) => {
      if (statusFilter === 'active' && !tache.actif) return false;
      if (statusFilter === 'inactive' && tache.actif) return false;
      if (!q) return true;
      return (
        (tache.code || '').toLowerCase().includes(q) ||
        (tache.libelle || '').toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'libelle':
          return (a.libelle || '').localeCompare(b.libelle || '');
        case 'intervalleJours':
          return (Number(a.intervalleJours) || 0) - (Number(b.intervalleJours) || 0);
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
    const interval = Number(form.intervalleJours);
    if (!interval || interval <= 0) return null;

    const rawMargin = form.seuilAlerteJours === '' ? 0 : Number(form.seuilAlerteJours);
    const margin = Math.min(Math.max(rawMargin || 0, 0), interval);

    return {
      interval,
      margin,
      alertAt: interval - margin,
      alertPct: (margin / interval) * 100,
    };
  }, [form.intervalleJours, form.seuilAlerteJours]);

  return (
    <section className="mtp-panel mtp-panel--equipement" aria-labelledby="mtp-panel-title">
      <header className="mtp-panel__head">
        <div>
          <h3 id="mtp-panel-title" className="mtp-panel__title">
            {t("Maintenance préventive des équipements médicaux")}
          </h3>
          <p className="mtp-panel__lead">
            {t("Échéances réglementaires (calibration, contrôle qualité...) — aucune valeur imposée par défaut.")}
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
            <span className="mtp-kpi__label">{t("jours moyen")}</span>
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
            <span>{t("Chargement des échéances…")}</span>
          </div>
        )}

        {!loading && types.length === 0 && (
          <div className="mtp-cards__state mtp-cards__state--empty">
            <Inbox size={32} strokeWidth={1.5} />
            <p className="mtp-cards__state-title">{t("Aucun type de maintenance")}</p>
            <p className="mtp-cards__state-text">
              {t("Cliquez sur « Nouveau type » pour créer votre première échéance (ex. Calibration tous les 365 jours).")}
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
          filtered.map((tache) => {
            const isPending = pendingId === tache.id;
            const isConfirm = confirmId === tache.id;

            const interval = Number(tache.intervalleJours) || 0;
            const margin = Number(tache.seuilAlerteJours) || 0;
            const alertAt = Math.max(0, interval - margin);
            const alertPct = interval > 0 ? Math.min(100, (margin / interval) * 100) : 0;
            const urgency = tache.urgenceBon ? URGENCE[tache.urgenceBon] : null;

            return (
              <article
                key={tache.id}
                role="listitem"
                className={[
                  'mtp-card',
                  !tache.actif && 'mtp-card--inactive',
                  isPending && 'mtp-card--pending',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <header className="mtp-card__head">
                  <code className="mtp-card__code">{tache.code}</code>
                  <span
                    className={`mtp-status ${tache.actif ? 'mtp-status--on' : 'mtp-status--off'}`}
                  >
                    {tache.actif ? t("Actif") : t("Désactivé")}
                  </span>
                </header>

                <h4 className="mtp-card__title">{tache.libelle}</h4>

                <div className="mtp-card__gauge">
                  <div className="mtp-card__gauge-head">
                    <span className="mtp-card__gauge-value">
                      {nf.format(interval)} <em>{t("jours")}</em>
                    </span>
                    {margin > 0 && (
                      <span className="mtp-card__gauge-hint">
                        {t("alerte dès")} {nf.format(alertAt)} {t("j")}
                      </span>
                    )}
                  </div>
                  <div
                    className="mtp-card__gauge-track"
                    role="img"
                    aria-label={
                      margin > 0
                        ? t('Échéance à {n} jours, alerte dès {a} jours', { n: nf.format(interval), a: nf.format(alertAt) })
                        : t('Échéance à {n} jours, sans pré-alerte', { n: nf.format(interval) })
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
                      {tache.seuilAlerteJours != null
                        ? t('{n} j', { n: nf.format(margin) })
                        : <span className="mtp-card__muted">—</span>}
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Flag size={12} /> {t("Urgence")}
                    </dt>
                    <dd>
                      {urgency ? (
                        <span className={`mtp-urgency mtp-urgency--${tache.urgenceBon}`}>
                          {tache.urgenceBon} · {t(urgency.label)}
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
                        {tache.baseRecalcul === 1 ? t("Échéance théorique") : t("Date réelle")}
                      </span>
                    </dd>
                  </div>

                  <div className="mtp-card__metric">
                    <dt>
                      <Boxes size={12} /> {t("Portée")}
                    </dt>
                    <dd>
                      {tache.lotArticleImmobilistationId ? (
                        <span className="mtp-card__tag">
                          {immobilisationsMap.get(String(tache.lotArticleImmobilistationId))?.designation
                            || t('Équipement #{id}', { id: tache.lotArticleImmobilistationId })}
                        </span>
                      ) : (
                        <span className="mtp-card__muted">{t("Tous les équipements")}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <footer className="mtp-card__foot">
                  <button
                    type="button"
                    className="mtp-card__btn mtp-card__btn--edit"
                    onClick={() => openEdit(tache)}
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
                        onClick={() => doToggle(tache)}
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
                      onClick={() => handleToggleActif(tache)}
                      className={`mtp-card__btn ${
                        tache.actif ? 'mtp-card__btn--danger' : 'mtp-card__btn--restore'
                      }`}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 size={14} className="mtp-spin" /> {t("Traitement…")}
                        </>
                      ) : tache.actif ? (
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
            <aside className="mtp-dialog__aside" aria-label={t("Aperçu de l'échéance")}>
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
                      <span className="mtp-gauge__unit">{t("jours")}</span>
                    </p>

                    <div
                      className="mtp-gauge__track"
                      role="img"
                      aria-label={
                        preview.margin > 0
                          ? t('Échéance à {n} jours, alerte dès {a} jours', { n: nf.format(preview.interval), a: nf.format(preview.alertAt) })
                          : t('Échéance à {n} jours, sans pré-alerte', { n: nf.format(preview.interval) })
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
                        {t("Période normale")}
                        <span className="mtp-gauge__legend-range">
                          0 – {nf.format(preview.alertAt)} {t("j")}
                        </span>
                      </li>
                      {preview.margin > 0 && (
                        <li className="mtp-gauge__legend-item mtp-gauge__legend-item--alert">
                          {t("Zone d'alerte")}
                          <span className="mtp-gauge__legend-range">
                            {nf.format(preview.alertAt)} – {nf.format(preview.interval)} {t("j")}
                          </span>
                        </li>
                      )}
                      <li className="mtp-gauge__legend-item mtp-gauge__legend-item--due">
                        {t("Échéance")}
                        <span className="mtp-gauge__legend-range">
                          {nf.format(preview.interval)} {t("j")}
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
                  <dd>{Number(form.baseRecalcul) === 1 ? t("Échéance théorique") : t("Date réelle")}</dd>
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
                      ? t("Ajustez les paramètres de l'échéance réglementaire")
                      : t("Définissez une nouvelle périodicité réglementaire")}
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
                          placeholder="CALIBRATION"
                          disabled={!!editingId || saving}
                          autoComplete="off"
                        />
                        <small className="mtp-field__hint">
                          {editingId
                            ? t("Le code n'est pas modifiable après création.")
                            : t("Ex. CALIBRATION, CONTROLE_QUALITE, VERIF_SECURITE")}
                        </small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Libellé *")}</span>
                        <input
                          className="mtp-field__input"
                          name="libelle"
                          value={form.libelle}
                          onChange={handleChange}
                          placeholder={t("Calibration annuelle")}
                          disabled={saving}
                          autoComplete="off"
                        />
                        <small className="mtp-field__hint">{t("Nom affiché aux utilisateurs")}</small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-seuils">
                    <div>
                      <h5 id="mtp-group-seuils" className="mtp-group__title">{t("Périodicité")}</h5>
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
                            name="intervalleJours"
                            value={form.intervalleJours}
                            onChange={handleChange}
                            placeholder="365"
                            disabled={saving}
                          />
                          <span className="mtp-field__suffix">{t("jours")}</span>
                        </div>
                        <small className="mtp-field__hint">{t("Durée entre deux interventions")}</small>
                      </label>

                      <label className="mtp-field">
                        <span className="mtp-field__label">{t("Marge d'alerte")}</span>
                        <div className="mtp-field__affix">
                          <input
                            className="mtp-field__input mtp-field__input--suffixed"
                            type="number"
                            min="0"
                            name="seuilAlerteJours"
                            value={form.seuilAlerteJours}
                            onChange={handleChange}
                            placeholder="30"
                            disabled={saving}
                          />
                          <span className="mtp-field__suffix">{t("jours")}</span>
                        </div>
                        <small className="mtp-field__hint">
                          {t("Prévient l'utilisateur avant l'échéance")}
                        </small>
                      </label>
                    </div>
                  </section>

                  <section className="mtp-group" aria-labelledby="mtp-group-cible">
                    <div>
                      <h5 id="mtp-group-cible" className="mtp-group__title">{t("Équipement ciblé")}</h5>
                      <p className="mtp-group__desc">
                        {t("Laissez vide pour appliquer ce type à tous les équipements (ou à toute la catégorie) ; choisissez un lot d'immobilisation pour le restreindre à un équipement précis.")}
                      </p>
                    </div>

                    <label className="mtp-field">
                      <span className="mtp-field__label">{t("Lot d'immobilisation")}</span>
                      <SearchableSelect
                        id="emt-lot-immob"
                        name="lotArticleImmobilistationId"
                        value={form.lotArticleImmobilistationId}
                        onChange={handleChange}
                        options={immobilisations}
                        loading={loadingImmobilisations}
                        allowEmpty
                        emptyOptionLabel={t("— Tous les équipements —")}
                        placeholder={t("Rechercher un équipement…")}
                        emptyMessage={t("Aucun équipement ne correspond")}
                        getValue={(i) => i.id}
                        getLabel={(i) => i.designation || t('Équipement #{id}', { id: i.id })}
                        getOptionHint={(i) => i.numPiece ? t('N° pièce : {num}', { num: i.numPiece }) : (i.marque || null)}
                        disabled={saving}
                      />
                      <small className="mtp-field__hint">
                        {form.lotArticleImmobilistationId
                          ? t("Ce type ne s'appliquera qu'à cet équipement.")
                          : t("Applicable à tous les équipements (selon la catégorie éventuelle).")}
                      </small>
                    </label>
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
                          <option value={0}>{t("Date réelle de l'intervention")}</option>
                          <option value={1}>{t("Échéance théorique")}</option>
                        </select>
                        <small className="mtp-field__hint">
                          {t("Référence pour calculer la prochaine échéance")}
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
                          {t("Contrôlé automatiquement chaque jour par le planificateur")}
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