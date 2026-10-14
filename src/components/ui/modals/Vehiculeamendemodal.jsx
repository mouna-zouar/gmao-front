import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Car, CheckCircle2, Coins, Loader2, Receipt, Search, UserCheck, UserX, X } from 'lucide-react';
import vehiculeAmendeService from '../../../services/vehiculeAmendeService';
import authService from '../../../services/Authservice';
import { t, locale } from '../../../i18n';
import { TYPES_INFRACTION, IMPUTATIONS, ORIGINE, ltr } from '../../../constants/Amendelibelles';
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

// Fenêtres ouvertes les unes sur les autres : Échap ne ferme que celle du dessus
const pileFenetres = [];

export function Fenetre({ titre, sousTitre, Icone, onClose, children, pied, largeur = 760 }) {
  const idTitre = useId();
  const boite = useRef(null);
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
    // Focus au premier champ une seule fois, à l'ouverture
    boite.current?.querySelector('input, select, textarea, button')?.focus();
    return () => {
      pileFenetres.splice(pileFenetres.indexOf(jeton), 1);
      document.removeEventListener('keydown', echap, true);
    };
  }, []);

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
    ev.preventDefault();
    const e = valider();
    setErreurs(e);
    const premier = Object.keys(e)[0];
    if (premier) {
      document.getElementById(`vam-${premier}`)?.focus();
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

  return (
    <Fenetre
      titre={enModification ? t('Modifier l’amende {num}', { num: ltr(amende.num || '') }) : t('Nouvelle amende')}
      sousTitre={t('Le conducteur responsable est retrouvé à partir de la date de l’infraction.')}
      Icone={Receipt}
      onClose={onClose}
      pied={(
        <>
          <button type="button" className="vam-bouton vam-bouton--clair" onClick={onClose} disabled={enregistrement}>{t('Annuler')}</button>
          <button type="submit" form="vam-formulaire" className="vam-bouton" disabled={enregistrement}>
            {enregistrement ? <Loader2 size={16} className="vam-tourne" /> : <CheckCircle2 size={16} />}
            {enModification ? t('Enregistrer') : t("Enregistrer l'amende")}
          </button>
        </>
      )}
    >
      <form id="vam-formulaire" className="vam-corps" onSubmit={enregistrer} noValidate>
        {erreurServeur && <p className="vam-alerte" role="alert">{erreurServeur}</p>}

        <fieldset className="vam-groupe">
          <legend>{t('Infraction')}</legend>
          <div className="vam-grille">
            <Champ id="vam-vehiculeId" label={t('Véhicule')} requis erreur={erreurs.vehiculeId}>
              <select id="vam-vehiculeId" value={form.vehiculeId} onChange={(e) => maj('vehiculeId', e.target.value)} aria-invalid={!!erreurs.vehiculeId} aria-describedby={erreurs.vehiculeId ? 'vam-vehiculeId-erreur' : undefined}>
                <option value="">{t('— Choisir —')}</option>
                {vehiculesTries.map((v) => (
                  <option key={v.id} value={v.id}>{[ltr(v.matricule), v.marque].filter(Boolean).join(' · ') || t('Véhicule #{id}', { id: v.id })}</option>
                ))}
              </select>
            </Champ>
            <Champ id="vam-dateInfraction" label={t("Date et heure de l'infraction")} requis erreur={erreurs.dateInfraction}>
              <input id="vam-dateInfraction" type="datetime-local" max={maintenantLocal()} value={form.dateInfraction} onChange={(e) => maj('dateInfraction', e.target.value)} aria-invalid={!!erreurs.dateInfraction} aria-describedby={erreurs.dateInfraction ? 'vam-dateInfraction-erreur' : undefined} />
            </Champ>
            <Champ id="vam-type" label={t("Type d'infraction")} requis erreur={erreurs.type}>
              <select id="vam-type" value={form.type} onChange={(e) => maj('type', e.target.value)} aria-invalid={!!erreurs.type} aria-describedby={erreurs.type ? 'vam-type-erreur' : undefined}>
                <option value="">{t('— Choisir —')}</option>
                {Object.entries(TYPES_INFRACTION).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
            </Champ>
            <Champ id="vam-lieu" label={t('Lieu')}>
              <input id="vam-lieu" type="text" value={form.lieu} onChange={(e) => maj('lieu', e.target.value)} placeholder={t('Ville, route, adresse…')} />
            </Champ>
          </div>
        </fieldset>

        <fieldset className="vam-groupe">
          <legend>{t('Conducteur responsable')}</legend>
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
                      // Amende enregistrée : seule la mission est connue, pas ses horaires
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
          <div className="vam-grille">
            <Champ id="vam-conducteurId" label={t('Conducteur')} aide={manuel && form.conducteurId ? t('Choisi à la main.') : undefined}>
              <select id="vam-conducteurId" value={form.conducteurId} onChange={(e) => choisirConducteur(e.target.value)}>
                <option value="">{t('— Non identifié —')}</option>
                {form.conducteurId && !conducteurChoisi && (
                  <option value={form.conducteurId}>{proposeNom || t('Personnel #{id}', { id: form.conducteurId })}</option>
                )}
                {personnelsTries.map((p) => <option key={p.id} value={p.id}>{nomPersonnel(p)}</option>)}
              </select>
            </Champ>
            <Champ id="vam-imputation" label={t('Qui paie ?')}>
              <select id="vam-imputation" value={form.imputation} onChange={(e) => maj('imputation', e.target.value)}>
                {Object.entries(IMPUTATIONS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
            </Champ>
          </div>
        </fieldset>

        <fieldset className="vam-groupe">
          <legend>{t('Procès-verbal et paiement')}</legend>
          <div className="vam-grille">
            <Champ id="vam-referencePv" label={t('N° du procès-verbal')}>
              <input id="vam-referencePv" type="text" value={form.referencePv} onChange={(e) => maj('referencePv', e.target.value)} />
            </Champ>
            <Champ id="vam-montant" label={t('Montant (DT)')} requis erreur={erreurs.montant}>
              <input id="vam-montant" type="number" min="0" step="0.001" inputMode="decimal" value={form.montant} onChange={(e) => maj('montant', e.target.value)} aria-invalid={!!erreurs.montant} aria-describedby={erreurs.montant ? 'vam-montant-erreur' : undefined} />
            </Champ>
            <Champ id="vam-dateReception" label={t('Reçue le')}>
              <input id="vam-dateReception" type="date" value={form.dateReception} onChange={(e) => maj('dateReception', e.target.value)} />
            </Champ>
            <Champ id="vam-dateLimitePaiement" label={t('À payer avant le')} erreur={erreurs.dateLimitePaiement}>
              <input id="vam-dateLimitePaiement" type="date" value={form.dateLimitePaiement} onChange={(e) => maj('dateLimitePaiement', e.target.value)} aria-invalid={!!erreurs.dateLimitePaiement} aria-describedby={erreurs.dateLimitePaiement ? 'vam-dateLimitePaiement-erreur' : undefined} />
            </Champ>
            <Champ id="vam-commentaire" label={t('Commentaire')} large>
              <textarea id="vam-commentaire" rows={2} value={form.commentaire} onChange={(e) => maj('commentaire', e.target.value)} />
            </Champ>
          </div>
        </fieldset>
      </form>
    </Fenetre>
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