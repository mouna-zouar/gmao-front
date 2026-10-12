import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Save, RotateCcw, Play, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';
import parametreService from '../../../services/parametreService';
import EquipementMaintenanceTypesSettings from '../Etatequipement/EquipementMaintenanceTypesSettings';
import ReglageLangue from '../../../i18n/ReglageLangue';
import { t } from '../../../i18n';
import './ParametresSysteme.css';

/** Pour les paramètres « planif.<code>.heure » : code du traitement exécutable à la main. */
function codeTache(cle) {
  const m = /^planif\.([a-z_]+)\.heure$/.exec(cle);
  return m ? m[1] : null;
}

function ChampValeur({ param, valeur, onChange }) {
  const common = { id: `ps-${param.cle}`, value: valeur ?? '' };

  switch (param.type) {
    case 'BOOLEEN':
      return (
        <label className="ps-switch">
          <input
            type="checkbox"
            checked={valeur === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          />
          <span className="ps-switch-track" />
          <span className="ps-switch-label">{valeur === 'true' ? t("Oui") : t("Non")}</span>
        </label>
      );
    case 'HEURE':
      return <input {...common} type="time" onChange={(e) => onChange(e.target.value)} />;
    case 'ENTIER':
      return (
        <input
          {...common}
          type="number"
          step="1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'DECIMAL':
      return (
        <input
          {...common}
          type="number"
          step="0.1"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function ParametresSysteme() {
  const [params, setParams] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningCode, setRunningCode] = useState(null);
  const [message, setMessage] = useState(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const apply = (list) => {
    setParams(list);
    setDraft(Object.fromEntries(list.map((p) => [p.cle, p.valeur])));
  };

  const load = async () => {
    setLoading(true);
    try {
      apply(await parametreService.getAll());
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Impossible de charger les paramètres. Vérifie que le serveur est lancé.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dirtyKeys = useMemo(
    () => params.filter((p) => draft[p.cle] !== p.valeur).map((p) => p.cle),
    [params, draft],
  );

  /** Paramètres planif.equipement_echeances.* — affichés en priorité dans
   * la section « Maintenance préventive », en plus du groupe « Planification ». */
  const paramsEquipementEcheances = useMemo(
    () => params.filter((p) => p.cle.startsWith('planif.equipement_echeances.')),
    [params],
  );

  const groupes = useMemo(() => {
    const map = new Map();
    params.forEach((p) => {
      if (!map.has(p.groupe)) map.set(p.groupe, []);
      map.get(p.groupe).push(p);
    });
    return [...map.entries()];
  }, [params]);

  const setValue = (cle, valeur) => {
    setMessage(null);
    setDraft((prev) => ({ ...prev, [cle]: valeur }));
  };

  const handleSave = async () => {
    if (dirtyKeys.length === 0 || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(dirtyKeys.map((k) => [k, String(draft[k])]));
      const saved = await parametreService.saveMany(payload);
      const parCle = new Map(saved.map((p) => [p.cle, p]));
      apply(params.map((p) => parCle.get(p.cle) ?? p));
      setMessage({ type: 'success', text: t('{n} paramètre(s) enregistré(s). Les nouveaux horaires sont appliqués immédiatement.', { n: saved.length }) });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || "Échec de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(Object.fromEntries(params.map((p) => [p.cle, p.valeur])));
    setMessage(null);
  };

  const handleExecuter = async (code) => {
    setRunningCode(code);
    setMessage(null);
    try {
      await parametreService.executerTache(code);
      setMessage({ type: 'success', text: 'Traitement exécuté avec les paramètres enregistrés.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || "Échec de l'exécution du traitement." });
    } finally {
      setRunningCode(null);
    }
  };

  const renderParamCard = (p) => {
    const modifie = draft[p.cle] !== p.valeur;
    const estDefaut = draft[p.cle] === p.valeurDefaut;
    const code = codeTache(p.cle);

    return (
      <article key={p.cle} className={`ps-pcard ${modifie ? 'is-dirty' : ''}`}>
        <div className="ps-pcard-head">
          <label htmlFor={`ps-${p.cle}`}>{p.libelle}</label>
          {modifie && <span className="ps-pcard-badge">{t("modifié")}</span>}
        </div>

        {p.description && <p className="ps-pcard-desc">{t(p.description)}</p>}

        <div className="ps-pcard-control">
          <ChampValeur
            param={p}
            valeur={draft[p.cle]}
            onChange={(v) => setValue(p.cle, v)}
          />
          {p.unite && <span className="ps-unit">{p.unite}</span>}
        </div>

        <div className="ps-pcard-actions">
          {code && (
            <button
              type="button"
              className="ps-action ps-action--run"
              title={t("Exécuter maintenant (avec les paramètres enregistrés)")}
              disabled={runningCode === code}
              onClick={() => handleExecuter(code)}
            >
              <Play size={13} />
              {t("Exécuter")}
            </button>
          )}
          <button
            type="button"
            className="ps-action"
            title={t('Valeur par défaut : {valeur}', { valeur: p.valeurDefaut })}
            disabled={estDefaut}
            onClick={() => setValue(p.cle, p.valeurDefaut)}
          >
            <RotateCcw size={13} />
            {t("Défaut")}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="ps-container">
      {/* HEADER */}
      <div className="ps-header-card">
        <div className="ps-header-icon"><SlidersHorizontal size={22} /></div>
        <div>
          <h2>{t("Paramètres système")}</h2>
          <p>{t("Heures des traitements automatiques, seuils de détection et barème SLA.")}</p>
        </div>
      </div>

      {/* LANGUE — un changement de langue réaffiche l'application : on prévient si des modifications ne sont pas enregistrées */}
      <ReglageLangue
        avantChangement={() => dirtyKeys.length === 0
          || window.confirm(t('Des modifications ne sont pas enregistrées et seront perdues. Changer de langue quand même ?'))}
      />

      {/* MAINTENANCE PRÉVENTIVE — RÉFÉRENTIEL DES TYPES (ÉQUIPEMENTS) */}
      <div className="ps-header-card" style={{ cursor: 'pointer' }} onClick={() => setMaintenanceOpen((v) => !v)}>
        <div className="ps-header-icon"><Wrench size={22} /></div>
        <div>
          <h2>{t("Maintenance préventive — paramètres")}</h2>
          <p>{t("Types de maintenance réglementaire (calibration, contrôle qualité) applicables aux équipements médicaux.")}</p>
        </div>
      </div>

      {maintenanceOpen && (
        <section style={{ marginBottom: 24 }}>
          {paramsEquipementEcheances.length > 0 && (
            <div className="ps-group" style={{ marginBottom: 18 }}>
              <header className="ps-group-head">
                <h3>{t("Déclenchement automatique")}</h3>
                <span className="ps-group-count">{paramsEquipementEcheances.length}</span>
              </header>
              <div className="ps-grid">
                {paramsEquipementEcheances.map(renderParamCard)}
              </div>
            </div>
          )}
          <EquipementMaintenanceTypesSettings />
        </section>
      )}

      {/* BANNER */}
      {message && (
        <div className={`ps-banner ps-banner--${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* CONTENU */}
      {loading ? (
        <div className="ps-empty">{t("Chargement...")}</div>
      ) : (
        groupes.map(([groupe, items]) => (
          <section key={groupe} className="ps-group">
            <header className="ps-group-head">
              <h3>{groupe}</h3>
              <span className="ps-group-count">{items.length}</span>
            </header>

            <div className="ps-grid">
              {items.map(renderParamCard)}
            </div>
          </section>
        ))
      )}

      {/* SAVEBAR */}
      {dirtyKeys.length > 0 && (
        <div className="ps-savebar">
          <span>{t('{n} modification(s) non enregistrée(s)', { n: dirtyKeys.length })}</span>
          <div>
            <button type="button" className="ps-btn ps-btn--ghost" onClick={handleCancel} disabled={saving}>
              {t("Annuler")}
            </button>
            <button type="button" className="ps-btn ps-btn--primary" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? t("Enregistrement...") : t("Enregistrer")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}