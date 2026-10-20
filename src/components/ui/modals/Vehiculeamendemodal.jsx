import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Calendar, Car, Check, CheckCircle2, ChevronRight, Coins, FileText, Loader2, MapPin, Receipt, Save, Search, User, UserCheck, UserX, X } from 'lucide-react';
import Button from '../Button';
import vehiculeAmendeService from '../../../services/vehiculeAmendeService';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import { TYPES_INFRACTION, IMPUTATIONS, ORIGINE, ltr } from '../../../constants/Amendelibelles';
import './Modal.css';
import './VehiculeIncidentModal.css';
import './VehiculeAmendeModal.css';

const vide = {
  vehiculeId: '', dateInfraction: '', type: '', lieu: '', referencePv: '',
  montant: '', dateReception: '', dateLimitePaiement: '',
  conducteurId: '', missionId: '', origineConducteur: '', imputation: '0', commentaire: '',
};

// 2026-10-12T15:30:00 → 2026-10-12T15:30 (champ datetime-local)
const versChampDateHeure = (v) => (v ? String(v).slice(0, 16) : '');
const versChampDate = (v) => (v ? String(v).slice(0, 10) : '');
const maintenantLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Fenêtres ouvertes les unes sur les autres : Échap ne ferme que celle du dessus
const pileFenetres = [];

// Sections de la fenêtre de saisie (même navigation que les autres fenêtres du Parc)
const SECTIONS_AMENDE = [
  { id: 'infraction', label: 'Infraction', Icone: Receipt },
  { id: 'conducteur', label: 'Conducteur', Icone: User },
  { id: 'paiement', label: 'PV & paiement', Icone: Coins },
];
const SECTION_DU_CHAMP = {
  vehiculeId: 'infraction', dateInfraction: 'infraction', type: 'infraction',
  montant: 'paiement', dateLimitePaiement: 'paiement',
};

/** Échap ferme seulement la fenêtre du dessus (fenêtres ouvertes les unes sur les autres). */
function useEchap(onClose) {
  const fermer = useRef(onClose);
  useEffect(() => { fermer.current = onClose; });
  useEffect(() => {
    const jeton = {};
    pileFenetres.push(jeton);
    const echap = (e) => {
      if (e.key === 'Escape' && pileFenetres.at(-1) === jeton) { e.stopPropagation(); fermer.current(); }
    };
    // Phase de capture : passe avant les fenêtres plein écran (PageModal) qui écoutent aussi Échap
    document.addEventListener('keydown', echap, true);
    return () => {
      pileFenetres.splice(pileFenetres.indexOf(jeton), 1);
      document.removeEventListener('keydown', echap, true);
    };
  }, []);
}

function nomPersonnel(p) {
  return p ? `${p.nom || ''} ${p.prenom || ''}`.trim() || t('Personnel #{id}', { id: p.id }) : '';
}

function dateHeure(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ───────────────────────── Fenêtre commune ─────────────────────────
   Réutilisée par les fenêtres du Parc (amendes, frais et coûts des véhicules). */


export function Fenetre({ titre, sousTitre, Icone, onClose, children, pied, largeur = 760 }) {
  const idTitre = useId();
  const boite = useRef(null);
  useEchap(onClose);
  // Focus au premier champ une seule fois, à l'ouverture
  useEffect(() => { boite.current?.querySelector('input, select, textarea, button')?.focus(); }, []);

  return (
    <div className="vam-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boite} className="vam-fenetre" style={{ maxWidth: largeur }} role="dialog" aria-modal="true" aria-labelledby={idTitre}>
        <header className="vam-entete">
          <span className="vam-entete-icone" aria-hidden="true"><Icone size={20} /></span>
          <div>
            <h2 id={idTitre}>{titre}</h2>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
          <button type="button" className="vam-fermer" onClick={onClose} aria-label={t('Fermer')}><X size={18} /></button>
        </header>
        {children}
        {pied && <footer className="vam-pied">{pied}</footer>}
      </div>
    </div>
  );
}

export function Champ({ id, label, requis, aide, erreur, children, large }) {
  return (
    <div className={`vam-champ ${large ? 'vam-champ--large' : ''} ${erreur ? 'is-erreur' : ''}`}>
      <label htmlFor={id}>{label}{requis && <span className="vam-requis" aria-hidden="true"> *</span>}</label>
      {children}
      {erreur ? <p className="vam-erreur-champ" id={`${id}-erreur`}>{erreur}</p> : aide && <p className="vam-aide">{aide}</p>}
    </div>
  );
}

/* ───────────────────────── Saisie / modification ───────────────────────── */

export default function VehiculeAmendeModal({ isOpen, onClose, onSave, amende, vehicules = [], personnels = [] }) {
  if (!isOpen) return null;
  // Remonter le formulaire à chaque ouverture : il repart des valeurs de l'amende
  return <FormulaireAmende key={amende?.id ?? 'nouvelle'} onClose={onClose} onSave={onSave} amende={amende} vehicules={vehicules} personnels={personnels} />;
}

function FormulaireAmende({ onClose, onSave, amende, vehicules, personnels }) {
  const enModification = !!amende;
  const [form, setForm] = useState(() => (amende ? {
    vehiculeId: String(amende.vehiculeId ?? ''),
    dateInfraction: versChampDateHeure(amende.dateInfraction),
    type: String(amende.type ?? ''),
    lieu: amende.lieu || '',
    referencePv: amende.referencePv || '',
    montant: amende.montant ?? '',
    dateReception: versChampDate(amende.dateReception),
    dateLimitePaiement: versChampDate(amende.dateLimitePaiement),
    conducteurId: amende.conducteurId != null ? String(amende.conducteurId) : '',
    missionId: amende.missionId ?? '',
    origineConducteur: amende.origineConducteur ?? '',
    imputation: String(amende.imputation ?? 0),
    commentaire: amende.commentaire || '',
  } : { ...vide, dateReception: new Date().toISOString().slice(0, 10) }));
  const [erreurs, setErreurs] = useState({});
  const [erreurServeur, setErreurServeur] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [section, setSection] = useState('infraction');
  const [rechercheVehicule, setRechercheVehicule] = useState('');
  useEchap(onClose);

  // Recherche du conducteur : { etat: 'attente' | 'recherche' | 'fait' | 'erreur', resultat }
  const [identification, setIdentification] = useState(() => (amende ? {
    etat: 'fait',
    resultat: {
      origine: amende.origineConducteur, conducteurId: amende.conducteurId,
      missionId: amende.missionId, missionNum: amende.missionNum,
    },
  } : { etat: 'attente', resultat: null }));
  // Le conducteur choisi à la main n'est plus remplacé par la recherche automatique
  const manuelInitial = enModification && amende.origineConducteur === ORIGINE.SAISIE;
  const choixManuel = useRef(manuelInitial);
  const [manuel, setManuel] = useState(manuelInitial);

  const maj = (champ, valeur) => {
    setForm((f) => ({ ...f, [champ]: valeur }));
    setErreurs((e) => (e[champ] ? { ...e, [champ]: undefined } : e));
  };

  const vehiculesTries = useMemo(
    () => [...vehicules].sort((a, b) => String(a.matricule || '').localeCompare(String(b.matricule || ''), locale(), { numeric: true })),
    [vehicules],
  );
  const personnelsTries = useMemo(
    () => [...personnels].sort((a, b) => nomPersonnel(a).localeCompare(nomPersonnel(b), locale())),
    [personnels],
  );
  const personnelParId = useMemo(() => Object.fromEntries(personnels.map((p) => [String(p.id), p])), [personnels]);

  // Véhicule + date connus → on cherche qui conduisait (mission en cours, sinon dernier affecté)
  const cleRecherche = form.vehiculeId && form.dateInfraction ? `${form.vehiculeId}|${form.dateInfraction}` : '';
  const derniereCle = useRef(enModification ? `${amende.vehiculeId}|${versChampDateHeure(amende.dateInfraction)}` : '');
  useEffect(() => {
    if (!cleRecherche || cleRecherche === derniereCle.current) return undefined;
    derniereCle.current = cleRecherche;
    let annule = false;
    const minuterie = setTimeout(async () => {
      setIdentification({ etat: 'recherche', resultat: null });
      try {
        const r = await vehiculeAmendeService.identifierConducteur(form.vehiculeId, `${form.dateInfraction}:00`);
        if (annule) return;
        setIdentification({ etat: 'fait', resultat: r });
        if (!choixManuel.current) {
          setForm((f) => ({
            ...f,
            conducteurId: r?.conducteurId != null ? String(r.conducteurId) : '',
            missionId: r?.missionId ?? '',
            origineConducteur: r?.origine ?? ORIGINE.SAISIE,
          }));
        }
      } catch {
        if (!annule) setIdentification({ etat: 'erreur', resultat: null });
      }
    }, 350);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [cleRecherche]); // eslint-disable-line react-hooks/exhaustive-deps

  const choisirConducteur = (valeur) => {
    const r = identification.resultat;
    const estPropose = r?.conducteurId != null && String(r.conducteurId) === valeur;
    choixManuel.current = !estPropose;
    setManuel(!estPropose);
    setForm((f) => ({
      ...f,
      conducteurId: valeur,
      // Revenir au conducteur proposé rétablit le lien avec la mission
      missionId: estPropose ? (r.missionId ?? '') : '',
      origineConducteur: estPropose ? r.origine : ORIGINE.SAISIE,
    }));
  };

  const valider = () => {
    const e = {};
    if (!form.vehiculeId) e.vehiculeId = t('Choisissez le véhicule.');
    if (!form.dateInfraction) e.dateInfraction = t("Indiquez la date et l'heure de l'infraction.");
    else if (form.dateInfraction > maintenantLocal()) e.dateInfraction = t('La date ne peut pas être dans le futur.');
    if (!form.type) e.type = t("Choisissez le type d'infraction.");
    if (form.montant === '' || Number(form.montant) < 0 || Number.isNaN(Number(form.montant))) e.montant = t('Indiquez le montant de l’amende.');
    if (form.dateLimitePaiement && form.dateInfraction && form.dateLimitePaiement < form.dateInfraction.slice(0, 10)) {
      e.dateLimitePaiement = t('La date limite est antérieure à l’infraction.');
    }
    return e;
  };

  const enregistrer = async (ev) => {
    ev?.preventDefault?.();
    const e = valider();
    setErreurs(e);
    const premier = Object.keys(e)[0];
    if (premier) {
      setSection(SECTION_DU_CHAMP[premier] || 'infraction');
      setTimeout(() => document.getElementById(`vam-${premier}`)?.focus(), 0);
      return;
    }
    const ctx = authService.getContexteMetier();
    const user = authService.getCurrentUser?.();
    const payload = {
      vehiculeId: Number(form.vehiculeId),
      dateInfraction: `${form.dateInfraction}:00`,
      type: Number(form.type),
      lieu: form.lieu,
      referencePv: form.referencePv,
      montant: Number(form.montant),
      dateReception: form.dateReception || null,
      dateLimitePaiement: form.dateLimitePaiement || null,
      conducteurId: form.conducteurId ? Number(form.conducteurId) : null,
      missionId: form.conducteurId && form.missionId !== '' ? Number(form.missionId) : null,
      origineConducteur: form.conducteurId ? (form.origineConducteur === '' ? ORIGINE.SAISIE : Number(form.origineConducteur)) : null,
      imputation: Number(form.imputation),
      commentaire: form.commentaire,
      ...(enModification ? {
        statut: amende.statut, datePaiement: amende.datePaiement, montantPaye: amende.montantPaye,
      } : {
        personnelCreationId: ctx.userId ?? null,
        personnelCreationNom: user?.userNom || ctx.user || null,
      }),
    };
    setEnregistrement(true);
    setErreurServeur('');
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setErreurServeur(err?.response?.data?.message || t("Échec de l'enregistrement."));
    } finally {
      setEnregistrement(false);
    }
  };

  const r = identification.resultat;
  const proposeNom = r?.conducteurNom || nomPersonnel(personnelParId[String(r?.conducteurId)]);
  const conducteurChoisi = personnelParId[form.conducteurId];
  const vehiculeChoisi = vehicules.find((v) => String(v.id) === String(form.vehiculeId));

  // Liste de véhicules à cartes, comme les autres fenêtres du Parc (le véhicule choisi reste visible)
  const vehiculesAffiches = useMemo(() => {
    const q = rechercheVehicule.trim().toLowerCase();
    const liste = vehiculesTries.filter((v) => !q || `${v.matricule || ''} ${v.marque || ''} ${v.modele || ''}`.toLowerCase().includes(q)).slice(0, 6);
    if (vehiculeChoisi && !liste.some((v) => v.id === vehiculeChoisi.id)) liste.unshift(vehiculeChoisi);
    return liste;
  }, [vehiculesTries, rechercheVehicule, vehiculeChoisi]);

  const typeLibelle = form.type ? t(TYPES_INFRACTION[form.type]) : t('À choisir');
  const imputationLibelle = t(IMPUTATIONS[form.imputation] || '—');
  const montantLibelle = form.montant !== '' && !Number.isNaN(Number(form.montant))
    ? `${Number(form.montant).toLocaleString(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`
    : '—';

  const compteSection = {
    infraction: [form.vehiculeId, form.dateInfraction, form.type, form.lieu].filter(Boolean).length,
    conducteur: [form.conducteurId].filter(Boolean).length,
    paiement: [form.referencePv, form.montant !== '' ? 'x' : '', form.dateReception, form.dateLimitePaiement, form.commentaire].filter(Boolean).length,
  };
  const erreurSection = (id) => Object.keys(erreurs).some((k) => erreurs[k] && SECTION_DU_CHAMP[k] === id);
  const indexSection = SECTIONS_AMENDE.findIndex((s) => s.id === section);

  const champ = (id, label, { requis, erreur, aide, Icone, large } = {}, controle) => (
    <div className={`vim-field ${large ? 'vim-field--full' : ''} ${erreur ? 'vam-champ-erreur' : ''}`}>
      <label htmlFor={`vam-${id}`}>{label}{requis && <span className="vim-required">*</span>}</label>
      {Icone ? <div className="vim-input-icon"><Icone size={15} strokeWidth={2.4} />{controle}</div> : controle}
      {erreur ? <p className="vam-erreur-champ" id={`vam-${id}-erreur`}>{erreur}</p> : aide && <p className="vim-hint">{aide}</p>}
    </div>
  );
  const aria = (id) => ({ 'aria-invalid': !!erreurs[id], 'aria-describedby': erreurs[id] ? `vam-${id}-erreur` : undefined });

  const contenu = () => {
    if (section === 'infraction') {
      return (
        <div className="vim-content-pane">
          <div className="vim-pane-header">
            <h3>{t('Infraction')}</h3>
            <p>{t('Le véhicule, la date et la nature de l’infraction')}</p>
          </div>

          <div className="vim-field vim-field--full">
            <label>{t('Véhicule')}<span className="vim-required">*</span></label>
            <div className="vim-search">
              <Search size={16} strokeWidth={2.3} className="vim-search-icon" />
              <input type="text" placeholder={t('Rechercher par matricule, marque...')} value={rechercheVehicule} onChange={(e) => setRechercheVehicule(e.target.value)} aria-label={t('Rechercher un véhicule')} />
            </div>
            {vehiculesAffiches.length === 0 ? (
              <div className="vim-vehicules-empty"><Car size={24} strokeWidth={1.6} /><span>{t('Aucun véhicule trouvé')}</span></div>
            ) : (
              <div className="vim-vehicules-grid" id="vam-vehiculeId" tabIndex={-1} role="radiogroup" aria-label={t('Véhicule')} {...aria('vehiculeId')}>
                {vehiculesAffiches.map((v) => {
                  const choisi = String(form.vehiculeId) === String(v.id);
                  return (
                    <button key={v.id} type="button" role="radio" aria-checked={choisi} className={`vim-vehicule-card ${choisi ? 'selected' : ''}`} onClick={() => maj('vehiculeId', String(v.id))}>
                      <div className="vim-vehicule-icon"><Car size={18} strokeWidth={2.2} /></div>
                      <div className="vim-vehicule-text">
                        <span className="vim-vehicule-matricule">{ltr(v.matricule) || t('Véhicule #{id}', { id: v.id })}</span>
                        <span className="vim-vehicule-marque">{v.marque || '—'}{v.modele ? ` · ${v.modele}` : ''}</span>
                      </div>
                      {choisi && <div className="vim-vehicule-check"><Check size={14} strokeWidth={3} /></div>}
                    </button>
                  );
                })}
              </div>
            )}
            {erreurs.vehiculeId && <p className="vam-erreur-champ" id="vam-vehiculeId-erreur">{erreurs.vehiculeId}</p>}
          </div>

          <div className="vim-grid" style={{ marginTop: 18 }}>
            {champ('dateInfraction', t("Date et heure de l'infraction"), { requis: true, erreur: erreurs.dateInfraction, Icone: Calendar },
              <input id="vam-dateInfraction" type="datetime-local" max={maintenantLocal()} value={form.dateInfraction} onChange={(e) => maj('dateInfraction', e.target.value)} {...aria('dateInfraction')} />)}
            {champ('type', t("Type d'infraction"), { requis: true, erreur: erreurs.type, Icone: Receipt },
              <select id="vam-type" value={form.type} onChange={(e) => maj('type', e.target.value)} {...aria('type')}>
                <option value="">{t('— Choisir —')}</option>
                {Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>)}
            {champ('lieu', t('Lieu'), { large: true, Icone: MapPin },
              <input id="vam-lieu" type="text" value={form.lieu} onChange={(e) => maj('lieu', e.target.value)} placeholder={t('Ville, route, adresse…')} />)}
          </div>
        </div>
      );
    }
    if (section === 'conducteur') {
      return (
        <div className="vim-content-pane">
          <div className="vim-pane-header">
            <h3>{t('Conducteur responsable')}</h3>
            <p>{t('Le conducteur responsable est retrouvé à partir de la date de l’infraction.')}</p>
          </div>
          <div className={`vam-identification vam-identification--${identification.etat === 'fait' ? (r?.conducteurId ? 'trouve' : 'aucun') : identification.etat}`} aria-live="polite">
            {identification.etat === 'attente' && (
              <><Search size={18} aria-hidden="true" /><span>{t('Choisissez le véhicule et la date : le conducteur sera retrouvé automatiquement.')}</span></>
            )}
            {identification.etat === 'recherche' && (
              <><Loader2 size={18} className="vam-tourne" aria-hidden="true" /><span>{t('Recherche du conducteur…')}</span></>
            )}
            {identification.etat === 'erreur' && (
              <><UserX size={18} aria-hidden="true" /><span>{t('La recherche du conducteur a échoué : choisissez-le dans la liste.')}</span></>
            )}
            {identification.etat === 'fait' && r?.conducteurId != null && (
              <>
                <UserCheck size={18} aria-hidden="true" />
                <span>
                  <strong>{proposeNom || t('Personnel #{id}', { id: r.conducteurId })}</strong>
                  {' — '}
                  {r.origine === ORIGINE.MISSION
                    ? (r.missionDebut
                      ? t('en mission {num} ({debut} → {fin}).', {
                        num: ltr(r.missionNum || ''),
                        debut: dateHeure(r.missionDebut),
                        fin: r.missionFin ? dateHeure(r.missionFin) : t('en cours'),
                      })
                      : r.missionNum ? t('en mission {num}.', { num: ltr(r.missionNum) }) : t('en mission à cette date.'))
                    : r.origine === ORIGINE.AFFECTATION
                      ? t('dernier conducteur affecté au véhicule (aucune mission à cette date).')
                      : t('saisi à la main.')}
                </span>
              </>
            )}
            {identification.etat === 'fait' && r?.conducteurId == null && (
              <><UserX size={18} aria-hidden="true" /><span>{t('Aucune mission ni affectation à cette date : choisissez le conducteur dans la liste.')}</span></>
            )}
          </div>
          <div className="vim-grid" style={{ marginTop: 18 }}>
            {champ('conducteurId', t('Conducteur'), { aide: manuel && form.conducteurId ? t('Choisi à la main.') : undefined, Icone: User },
              <select id="vam-conducteurId" value={form.conducteurId} onChange={(e) => choisirConducteur(e.target.value)}>
                <option value="">{t('— Non identifié —')}</option>
                {form.conducteurId && !conducteurChoisi && (
                  <option value={form.conducteurId}>{proposeNom || t('Personnel #{id}', { id: form.conducteurId })}</option>
                )}
                {personnelsTries.map((p) => <option key={p.id} value={p.id}>{nomPersonnel(p)}</option>)}
              </select>)}
            {champ('imputation', t('Qui paie ?'), { Icone: Coins },
              <select id="vam-imputation" value={form.imputation} onChange={(e) => maj('imputation', e.target.value)}>
                {Object.entries(IMPUTATIONS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>)}
          </div>
        </div>
      );
    }
    return (
      <div className="vim-content-pane">
        <div className="vim-pane-header">
          <h3>{t('Procès-verbal et paiement')}</h3>
          <p>{t('Référence du PV, montant et échéance de paiement')}</p>
        </div>
        <div className="vim-grid">
          {champ('referencePv', t('N° du procès-verbal'), { Icone: FileText },
            <input id="vam-referencePv" type="text" value={form.referencePv} onChange={(e) => maj('referencePv', e.target.value)} />)}
          {champ('montant', t('Montant (DT)'), { requis: true, erreur: erreurs.montant, Icone: Coins },
            <input id="vam-montant" type="number" min="0" step="0.001" inputMode="decimal" value={form.montant} onChange={(e) => maj('montant', e.target.value)} {...aria('montant')} />)}
          {champ('dateReception', t('Reçue le'), { Icone: Calendar },
            <input id="vam-dateReception" type="date" value={form.dateReception} onChange={(e) => maj('dateReception', e.target.value)} />)}
          {champ('dateLimitePaiement', t('À payer avant le'), { erreur: erreurs.dateLimitePaiement, Icone: Calendar },
            <input id="vam-dateLimitePaiement" type="date" value={form.dateLimitePaiement} onChange={(e) => maj('dateLimitePaiement', e.target.value)} {...aria('dateLimitePaiement')} />)}
          {champ('commentaire', t('Commentaire'), { large: true },
            <textarea id="vam-commentaire" rows={3} value={form.commentaire} onChange={(e) => maj('commentaire', e.target.value)} placeholder={t('Notes internes, suivi...')} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay vam-superpose" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vim-modal vam-modal" role="dialog" aria-modal="true" aria-labelledby="vam-titre">

        {/* ═══ EN-TÊTE (même style que les autres fenêtres du Parc) ═══ */}
        <div className="vim-header">
          <div className="vim-header-left">
            <div className="vim-header-icon"><Receipt size={22} strokeWidth={2.2} /></div>
            <div className="vim-header-titles">
              <span className="vim-eyebrow">{enModification ? t('Modification') : t('Nouvelle amende')}</span>
              <h2 id="vam-titre">
                {enModification
                  ? t('Modifier l’amende {num}', { num: ltr(amende.num || '') })
                  : (vehiculeChoisi ? ltr(vehiculeChoisi.matricule) : t('Enregistrer une amende'))}
              </h2>
              <p className="vim-header-subtitle">{t('Le conducteur responsable est retrouvé à partir de la date de l’infraction.')}</p>
            </div>
          </div>
          <div className="vim-header-right">
            <div className="vim-header-stats">
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">{t('Type')}</span>
                <span className={`vim-header-stat-value tag-${form.type ? 'red' : 'slate'}`}><Receipt size={12} strokeWidth={2.5} />{typeLibelle}</span>
              </div>
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">{t('Montant')}</span>
                <span className="vim-header-stat-value tag-amber"><Coins size={12} strokeWidth={2.5} />{montantLibelle}</span>
              </div>
              <div className="vim-header-stat">
                <span className="vim-header-stat-label">{t('Qui paie ?')}</span>
                <span className="vim-header-stat-value tag-blue"><User size={12} strokeWidth={2.5} />{imputationLibelle}</span>
              </div>
            </div>
            <button type="button" className="vim-close" onClick={onClose} aria-label={t('Fermer')}><X size={18} strokeWidth={2.5} /></button>
          </div>
        </div>

        {/* ═══ SECTIONS + CONTENU ═══ */}
        <form id="vam-formulaire" className="vim-layout" onSubmit={enregistrer} noValidate>
          <aside className="vim-nav">
            <div className="vim-nav-title">{t('Sections')}</div>
            <nav className="vim-nav-list">
              {SECTIONS_AMENDE.map((s) => {
                const Icone = s.Icone;
                const n = compteSection[s.id];
                return (
                  <button key={s.id} type="button" className={`vim-nav-item ${section === s.id ? 'active' : ''} ${erreurSection(s.id) ? 'vam-nav-erreur' : ''}`} onClick={() => setSection(s.id)} aria-current={section === s.id ? 'step' : undefined}>
                    <span className="vim-nav-item-icon"><Icone size={15} strokeWidth={2.3} /></span>
                    <span className="vim-nav-item-label">{t(s.label)}</span>
                    {erreurSection(s.id)
                      ? <span className="vim-nav-item-count vam-nav-erreur__n" aria-label={t('Champ à corriger')}>!</span>
                      : n > 0 && <span className="vim-nav-item-count">{n}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="vim-content">
            {contenu()}
            {erreurServeur && (
              <div className="vim-error-inline" role="alert"><AlertCircle size={16} strokeWidth={2.5} /><span>{erreurServeur}</span></div>
            )}
          </div>
        </form>

        {/* ═══ PIED ═══ */}
        <div className="vim-footer">
          <div className="vim-footer-left">
            <span className="vim-footer-step">{indexSection + 1} / {SECTIONS_AMENDE.length}</span>
          </div>
          <div className="vim-footer-right">
            <Button type="button" variant="ghost" onClick={onClose} disabled={enregistrement}>{t('Annuler')}</Button>
            {indexSection < SECTIONS_AMENDE.length - 1 && (
              <Button type="button" variant="secondary" onClick={() => setSection(SECTIONS_AMENDE[indexSection + 1].id)} disabled={enregistrement}>
                {t('Suivant')} <ChevronRight size={16} strokeWidth={2.5} className="rtl-miroir" style={{ marginInlineStart: 4 }} />
              </Button>
            )}
            <Button type="button" variant="primary" onClick={enregistrer} disabled={enregistrement}>
              {enregistrement
                ? <><Loader2 size={16} strokeWidth={2.5} className="vam-tourne" style={{ marginInlineEnd: 6 }} />{t('Enregistrement...')}</>
                : <><Save size={16} strokeWidth={2.5} style={{ marginInlineEnd: 6 }} />{enModification ? t('Mettre à jour') : t("Enregistrer l'amende")}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Paiement ───────────────────────── */

export function PaiementAmendeModal({ amende, vehicule, onClose, onPayer }) {
  const [datePaiement, setDatePaiement] = useState(() => new Date().toISOString().slice(0, 10));
  const [montantPaye, setMontantPaye] = useState(amende?.montant ?? '');
  const [imputation, setImputation] = useState(String(amende?.imputation ?? 0));
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const payer = async (e) => {
    e.preventDefault();
    if (montantPaye === '' || Number(montantPaye) < 0 || Number.isNaN(Number(montantPaye))) {
      setErreur(t('Indiquez le montant payé.'));
      document.getElementById('vam-montantPaye')?.focus();
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      await onPayer({ datePaiement, montantPaye: Number(montantPaye), imputation: Number(imputation) });
      onClose();
    } catch (err) {
      setErreur(err?.response?.data?.message || t("Échec de l'enregistrement du paiement."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      titre={t('Enregistrer le paiement')}
      sousTitre={[ltr(amende?.num), ltr(vehicule?.matricule)].filter(Boolean).join(' · ')}
      Icone={Coins}
      onClose={onClose}
      largeur={480}
      pied={(
        <>
          <button type="button" className="vam-bouton vam-bouton--clair" onClick={onClose} disabled={envoi}>{t('Annuler')}</button>
          <button type="submit" form="vam-paiement" className="vam-bouton" disabled={envoi}>
            {envoi ? <Loader2 size={16} className="vam-tourne" /> : <CheckCircle2 size={16} />}
            {t('Marquer comme payée')}
          </button>
        </>
      )}
    >
      <form id="vam-paiement" className="vam-corps" onSubmit={payer} noValidate>
        {erreur && <p className="vam-alerte" role="alert">{erreur}</p>}
        <div className="vam-grille vam-grille--une">
          <Champ id="vam-datePaiement" label={t('Payée le')}>
            <input id="vam-datePaiement" type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
          </Champ>
          <Champ id="vam-montantPaye" label={t('Montant payé (DT)')} requis aide={amende?.montant != null ? t('Montant de l’amende : {m} DT', { m: amende.montant }) : undefined}>
            <input id="vam-montantPaye" type="number" min="0" step="0.001" inputMode="decimal" value={montantPaye} onChange={(e) => setMontantPaye(e.target.value)} />
          </Champ>
          <Champ id="vam-imputationPaiement" label={t('Qui paie ?')}>
            <select id="vam-imputationPaiement" value={imputation} onChange={(e) => setImputation(e.target.value)}>
              {Object.entries(IMPUTATIONS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </Champ>
        </div>
        <p className="vam-aide vam-aide--bloc"><Car size={14} aria-hidden="true" /> {t('Le paiement passe l’amende au statut « Payée ».')}</p>
      </form>
    </Fenetre>
  );
}