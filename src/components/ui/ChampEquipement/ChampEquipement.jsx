import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, Loader2, MapPin, ScanLine, Search, X } from 'lucide-react';
import { carteLieux, cheminLieu } from '../../../services/lieuxCache';
import equipementService from '../../../services/equipementService';
import lotArticleImmobilistationService from '../../../services/Lotarticleimmobilistationservice';
import ScannerQR from '../../pages/Equipements/ScannerQR';
import { t } from '../../../i18n';
import './ChampEquipement.css';
import { obtenirFamilles } from '../../../store/referentiels';

const memeId = (a, b) => a != null && b != null && String(a) === String(b);

const libelle = (e) => e?.designation || e?.libelle || e?.code || (e?.id != null ? `${t('Équipement')} n° ${e.id}` : '');
const details = (e) => [
  e?.familleNom || e?.articleFamilleNom || null,
  [e?.marque, e?.modele].filter(Boolean).join(' '),
  e?.numPiece ? `${t('Série')} ${e.numPiece}` : null,
  e?.codeBarre ? `${t('Code')} ${e.codeBarre}` : (e?.code ? `${t('Code')} ${e.code}` : null),
].filter(Boolean).join(' · ');

const contient = (e, motif) => [e.designation, e.libelle, e.code, e.marque, e.modele, e.numPiece, e.codeBarre]
  .some((v) => v != null && String(v).toLowerCase().includes(motif));

export default function ChampEquipement({
  id,
  name = 'lotArticleImmobilistationId',
  value,
  onChange,
  optionsLocales = [],
  chargement = false,
  placeholder,
  facultatif = false,
  disabled = false,
  invalide = false,
  className = '',
  serviceId = null,
  serviceNom = '',
  lieuId = null,
  onEquipementChoisi,
  autoFocus = false,
}) {
  const idAuto = useId();
  const idChamp = id || `cheq-${idAuto}`;
  const idListe = `${idChamp}-liste`;

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [reponse, setReponse] = useState({ motif: '', liste: null, horsLigne: false });
  const [actif, setActif] = useState(-1);
  const [message, setMessage] = useState('');
  const [resolution, setResolution] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [choisi, setChoisi] = useState(null);
  const [famille, setFamille] = useState('');
  const [familles, setFamilles] = useState(null);

  const [parService, setParService] = useState(true);
  const [parLieu, setParLieu] = useState(true);
  const filtreLieu = Boolean(lieuId) && parLieu;
  useEffect(() => { setParLieu(true); }, [lieuId]);
  const [nomLieu, setNomLieu] = useState('');
  useEffect(() => {
    if (!lieuId) { setNomLieu(''); return undefined; }
    let actif = true;
    carteLieux().then((c) => { if (actif) setNomLieu(cheminLieu(c, lieuId)); }).catch(() => {});
    return () => { actif = false; };
  }, [lieuId]);
  const filtreService = Boolean(serviceId) && parService && !filtreLieu;
  useEffect(() => { setParService(true); }, [serviceId]);
  const servicePrecedent = useRef(serviceId);
  useEffect(() => {
    const avant = servicePrecedent.current;
    servicePrecedent.current = serviceId;
    if (!serviceId || memeId(avant, serviceId) || !valeur) return;
    const e = connu;
    if (e && e.serviceId != null && !memeId(e.serviceId, serviceId)) {
      setChoisi(null);
      onChange?.({ target: { name, value: '' } });
    }
  }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const racine = useRef(null);
  const champ = useRef(null);
  const boutonScanner = useRef(null);

  const valeur = value == null ? '' : String(value);

  const motif = saisie.trim();

  const connu = useMemo(() => {
    if (!valeur) return null;
    if (choisi && String(choisi.id) === valeur) return choisi;
    return optionsLocales.find((o) => String(o.id) === valeur)
      || reponse.liste?.find((o) => String(o.id) === valeur)
      || null;
  }, [valeur, choisi, optionsLocales, reponse.liste]);

  useEffect(() => {
    if (!valeur || connu || chargement) return undefined;
    let annule = false;
    lotArticleImmobilistationService.getById(valeur)
      .then((e) => { if (!annule) setChoisi({ ...e, id: e?.id ?? valeur }); })
      .catch(() => { if (!annule) setChoisi({ id: valeur }); });
    return () => { annule = true; };
  }, [valeur, connu, chargement]);

  const libelleChoisi = valeur ? libelle(connu || { id: valeur }) : '';

  useEffect(() => {
    if (!ouvert || familles !== null) return;
    obtenirFamilles()
      .then((l) => setFamilles(Array.isArray(l) ? l : []))
      .catch(() => setFamilles([]));
  }, [ouvert, familles]);

  const motifActif = ouvert && motif && motif.toLowerCase() !== libelleChoisi.toLowerCase() ? motif : '';
  const serviceRequete = filtreService && ouvert ? String(serviceId) : '';
  const lieuRequete = filtreLieu && ouvert ? String(lieuId) : '';
  const cleRequete = ouvert ? `${motifActif}|${famille}|${serviceRequete}|${lieuRequete}` : '';
  const aJour = reponse.motif === cleRequete;
  const resultats = cleRequete && aJour ? reponse.liste : null;
  const horsLigne = Boolean(cleRequete && aJour && reponse.horsLigne);
  const recherche = Boolean(cleRequete && !aJour);

  useEffect(() => {
    if (!cleRequete) return undefined;
    let annule = false;
    const minuterie = setTimeout(async () => {
      const demande = { recherche: motifActif, familleId: famille || null, serviceId: serviceRequete || null, lieuId: lieuRequete || null };
      try {
        const page = await equipementService.rechercher(motifActif, 0, famille || serviceRequete || lieuRequete ? 80 : 25, famille || null, serviceRequete || null, lieuRequete || null);
        console.info('[GMAO équipements] recherche', demande, '→', page?.totalElements ?? (page?.content ?? []).length, 'résultat(s)',
          (page?.content ?? []).slice(0, 5).map((e) => ({ id: e.id, designation: e.designation, serviceId: e.serviceId })));
        if (!annule) setReponse({ motif: cleRequete, liste: page?.content ?? [], total: page?.totalElements ?? null, horsLigne: false });
      } catch (err) {
        console.error('[GMAO équipements] recherche impossible', demande, '→', err?.response?.status ?? '', err?.response?.data ?? err?.message ?? err);
        if (!annule) setReponse({ motif: cleRequete, liste: null, total: null, horsLigne: true });
      }
    }, motifActif ? 280 : 0);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [cleRequete, motifActif, famille, serviceRequete, lieuRequete]);

  const liste = useMemo(() => {
    if (!cleRequete) return optionsLocales.slice(0, 60);
    if (resultats) return resultats;
    const m = motifActif.toLowerCase();
    return optionsLocales
      .filter((o) => !famille || String(o.articleFamilleId ?? o.familleId) === famille)
      .filter((o) => !serviceRequete || memeId(o.serviceId, serviceRequete))
      .filter((o) => !m || contient(o, m))
      .slice(0, 60);
  }, [cleRequete, motifActif, famille, serviceRequete, resultats, optionsLocales]);
  const totalFamille = famille && aJour ? reponse.total : null;
  const totalService = serviceRequete && aJour && !reponse.horsLigne ? reponse.total : null;


  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => {
      if (racine.current && !racine.current.contains(e.target)) {
        setOuvert(false);
        setSaisie('');
      }
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  const choisir = useCallback((equipement) => {
    setChoisi(equipement);
    setMessage('');
    setOuvert(false);
    setSaisie('');
    onChange?.({ target: { name, value: String(equipement.id) } });
    console.info('[GMAO équipements] choisi', { id: equipement.id, designation: equipement.designation, serviceId: equipement.serviceId });
    if (!onEquipementChoisi) return;
    if (equipement.serviceId !== undefined) { onEquipementChoisi(equipement); return; }
    lotArticleImmobilistationService.getById(equipement.id)
      .then((e) => onEquipementChoisi({ ...equipement, ...(e || {}) }))
      .catch((err) => {
        console.error('[GMAO équipements] service de l’équipement introuvable', equipement.id, err?.response?.status ?? '', err?.message ?? err);
        onEquipementChoisi(equipement);
      });
  }, [name, onChange, onEquipementChoisi]);

  const choisirParId = useCallback(async (idEquipement) => {
    const deja = optionsLocales.find((o) => String(o.id) === String(idEquipement))
      || reponse.liste?.find((o) => String(o.id) === String(idEquipement));
    if (deja) { choisir(deja); return; }
    try {
      const e = await lotArticleImmobilistationService.getById(idEquipement);
      choisir({ ...e, id: e?.id ?? idEquipement });
    } catch {
      choisir({ id: idEquipement });
    }
  }, [optionsLocales, reponse.liste, choisir]);

  const resoudreSaisie = async () => {
    const code = motif;
    if (!code) return;
    setResolution(true);
    setMessage('');
    try {
      const idTrouve = await equipementService.resoudreCode(code);
      await choisirParId(idTrouve);
    } catch (err) {
      if (liste.length === 1) {
        choisir(liste[0]);
      } else {
        setMessage(err?.response?.data?.message || t('Aucun équipement ne correspond à ce code.'));
      }
    } finally {
      setResolution(false);
    }
  };

  const vider = (e) => {
    e.stopPropagation();
    setChoisi(null);
    setSaisie('');
    setMessage('');
    onChange?.({ target: { name, value: '' } });
    champ.current?.focus();
  };

  const fermerScanner = useCallback(() => setScanner(false), []);
  const trouveParScanner = useCallback(async (idEquipement) => {
    setScanner(false);
    await choisirParId(idEquipement);
    boutonScanner.current?.focus();
  }, [choisirParId]);

  const auClavier = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!ouvert) setOuvert(true);
      setActif((i) => Math.min(Math.min(i, liste.length - 1) + 1, liste.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (liste[actif]) choisir(liste[actif]);
      else if (motifActif) resoudreSaisie();
    } else if (e.key === 'Escape' && ouvert) {
      e.stopPropagation();
      setOuvert(false);
      setSaisie('');
    }
  };

  const affiche = ouvert ? saisie : libelleChoisi;
  const occupe = recherche || resolution;

  return (
    <div className={`cheq ${className}`} ref={racine}>
      <div className="cheq-ligne">
        <div className={`cheq-champ ${ouvert ? 'is-open' : ''} ${invalide ? 'is-invalid' : ''}`}>
          <Search size={15} strokeWidth={2.3} className="cheq-icone" aria-hidden="true" />
          <input
            ref={champ}
            id={idChamp}
            className="cheq-input"
            type="text"
            role="combobox"
            aria-expanded={ouvert}
            aria-controls={idListe}
            aria-autocomplete="list"
            aria-activedescendant={actif >= 0 ? `${idListe}-${actif}` : undefined}
            aria-invalid={invalide || undefined}
            data-autofocus={autoFocus || undefined}
            autoComplete="off"
            disabled={disabled}
            value={affiche}
            placeholder={chargement ? t('Chargement…') : (placeholder || t('Nom, marque, n° de série ou code-barre…'))}
            onFocus={() => {
              if (disabled) return;
              setOuvert(true);
              setSaisie(libelleChoisi);
              setTimeout(() => champ.current?.select(), 0);
            }}
            onChange={(e) => { setSaisie(e.target.value); setActif(-1); setMessage(''); if (!ouvert) setOuvert(true); }}
            onKeyDown={auClavier}
          />
          {occupe && <Loader2 size={15} className="cheq-tourne" aria-hidden="true" />}
          {!occupe && valeur && !disabled && (
            <button type="button" className="cheq-vider" onClick={vider} aria-label={t('Effacer l’équipement choisi')}>
              <X size={12} strokeWidth={2.6} />
            </button>
          )}
        </div>
        <button
          ref={boutonScanner}
          type="button"
          className="cheq-scanner"
          onClick={() => { setOuvert(false); setScanner(true); }}
          disabled={disabled}
          title={t('Scanner le QR code ou le code-barre de l’équipement')}
        >
          <ScanLine size={17} strokeWidth={2.2} />
          <span>{t('Scanner')}</span>
        </button>
      </div>

      {ouvert && (
        <div className="cheq-menu">
          {lieuId && (
            <div className="cheq-service">
              <button type="button" className={`cheq-service-btn ${filtreLieu ? 'is-actif' : ''}`} aria-pressed={filtreLieu}
                onMouseDown={(e) => { e.preventDefault(); setParLieu((v) => !v); setActif(-1); }}>
                <MapPin size={14} aria-hidden="true" />
                <span>{nomLieu ? t('Lieu : {l}', { l: nomLieu }) : t('Équipements du lieu')}</span>
                {filtreLieu && aJour && !reponse.horsLigne && reponse.total != null && <span className="cheq-service-nb">{reponse.total}</span>}
              </button>
              {filtreLieu && (
                <button type="button" className="cheq-service-tous" onMouseDown={(e) => { e.preventDefault(); setParLieu(false); setActif(-1); }}>
                  {t('Tous les lieux')}
                </button>
              )}
            </div>
          )}
          {serviceId && !filtreLieu && (
            <div className="cheq-service">
              <button type="button" className={`cheq-service-btn ${filtreService ? 'is-actif' : ''}`} aria-pressed={filtreService}
                onMouseDown={(e) => { e.preventDefault(); setParService((v) => !v); setActif(-1); }}>
                <Building2 size={14} aria-hidden="true" />
                <span>{serviceNom ? t('Service : {s}', { s: serviceNom }) : t('Équipements du service')}</span>
                {filtreService && totalService != null && <span className="cheq-service-nb">{totalService}</span>}
              </button>
              {filtreService && (
                <button type="button" className="cheq-service-tous" onMouseDown={(e) => { e.preventDefault(); setParService(false); setActif(-1); }}>
                  {t('Tous les services')}
                </button>
              )}
            </div>
          )}
          {familles?.length > 0 && (
            <div className="cheq-filtre">
              <label htmlFor={`${idChamp}-famille`}>{t('Famille')}</label>
              <select
                id={`${idChamp}-famille`}
                value={famille}
                onChange={(e) => { setFamille(e.target.value); setActif(-1); }}
              >
                <option value="">{t('Toutes les familles')}</option>
                {familles.map((f) => (
                  <option key={f.id} value={String(f.id)}>{f.nom || t('Famille #{id}', { id: f.id })} ({Number(f.nombre || 0).toLocaleString()})</option>
                ))}
              </select>
              {totalFamille != null && totalFamille > liste.length && (
                <span className="cheq-filtre-note">{t('{n} premiers sur {total} : tapez pour affiner', { n: liste.length, total: totalFamille.toLocaleString() })}</span>
              )}
            </div>
          )}
          <ul className="cheq-options" id={idListe} role="listbox" aria-label={t('Équipements')}>
            {facultatif && !motifActif && (
              <li
                role="option"
                aria-selected={!valeur}
                className={`cheq-option cheq-option--vide ${!valeur ? 'is-selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); setChoisi(null); setOuvert(false); setSaisie(''); onChange?.({ target: { name, value: '' } }); }}
              >
                {t('— Aucun —')}
              </li>
            )}
            {liste.map((o, i) => {
              const choisiIci = String(o.id) === valeur;
              const d = details(o);
              return (
                <li
                  key={o.id}
                  id={`${idListe}-${i}`}
                  role="option"
                  aria-selected={choisiIci}
                  className={`cheq-option ${choisiIci ? 'is-selected' : ''} ${i === actif ? 'is-active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); choisir(o); }}
                  onMouseEnter={() => setActif(i)}
                >
                  <span className="cheq-option-texte">
                    <span className="cheq-option-nom">{libelle(o)}</span>
                    {d && <span className="cheq-option-details">{d}</span>}
                  </span>
                  {choisiIci && <Check size={15} strokeWidth={2.6} className="cheq-coche" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
          {!liste.length && !occupe && (
            <p className="cheq-vide">
              {filtreLieu
                ? t('Aucun équipement de ce lieu ne correspond.')
                : filtreService
                ? t('Aucun équipement de ce service ne correspond.')
                : motifActif ? t('Aucun équipement ne correspond. Appuyez sur Entrée pour chercher ce code.') : t('Tapez un nom ou scannez l’étiquette.')}
            </p>
          )}
          {horsLigne && motifActif && (
            <p className="cheq-note">{t('Recherche sur tout le parc indisponible : résultats de la liste chargée.')}</p>
          )}
        </div>
      )}

      {message && <p className="cheq-message" role="alert">{message}</p>}

      {scanner && createPortal(
        <ScannerQR
          onClose={fermerScanner}
          onTrouve={trouveParScanner}
          titre={t('Scanner l’équipement concerné')}
          aide={t('Placez le QR code ou le code-barre de l’étiquette dans le cadre : l’équipement est choisi tout seul.')}
        />,
        document.body,
      )}
    </div>
  );
}