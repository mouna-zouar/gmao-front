import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, ScanLine, Search, X } from 'lucide-react';
import equipementService from '../../../services/equipementService';
import lotArticleImmobilistationService from '../../../services/lotArticleImmobilistationService';
import ScannerQR from '../../pages/Equipements/ScannerQR';
import { t } from '../../../i18n';
import './ChampEquipement.css';

/*
 * Choix de l'équipement (immobilisation) dans un formulaire :
 *  - recherche par nom, marque, modèle, n° de série ou code-barre (côté serveur, sur tout le parc) ;
 *  - bouton « Scanner » : caméra (QR code de l'étiquette ou code-barre) ;
 *  - douchette : le code tapé puis « Entrée » choisit directement l'équipement.
 *
 * Même contrat qu'un <select> : onChange({ target: { name, value: '12' } }).
 * optionsLocales : liste déjà chargée par le formulaire (affichée tant que rien n'est tapé,
 * et utilisée si la recherche serveur est injoignable).
 */

const libelle = (e) => e?.designation || e?.libelle || e?.code || (e?.id != null ? `${t('Équipement')} n° ${e.id}` : '');
const details = (e) => [
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
}) {
  const idAuto = useId();
  const idChamp = id || `cheq-${idAuto}`;
  const idListe = `${idChamp}-liste`;

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  // Dernière réponse du serveur, rangée avec le texte cherché : { motif, liste, horsLigne }
  const [reponse, setReponse] = useState({ motif: '', liste: null, horsLigne: false });
  const [actif, setActif] = useState(-1);
  const [message, setMessage] = useState('');
  const [resolution, setResolution] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [choisi, setChoisi] = useState(null); // dernier équipement choisi (pour son libellé)

  const racine = useRef(null);
  const champ = useRef(null);
  const boutonScanner = useRef(null);

  const valeur = value == null ? '' : String(value);

  // ─── Libellé de l'équipement choisi ───
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

  // ─── Recherche serveur (après une courte pause de frappe) ───
  const motifActif = ouvert && motif && motif.toLowerCase() !== libelleChoisi.toLowerCase() ? motif : '';
  const aJour = reponse.motif === motifActif;
  const resultats = motifActif && aJour ? reponse.liste : null;
  const horsLigne = Boolean(motifActif && aJour && reponse.horsLigne);
  const recherche = Boolean(motifActif && !aJour);

  useEffect(() => {
    if (!motifActif) return undefined;
    let annule = false;
    const minuterie = setTimeout(async () => {
      try {
        const page = await equipementService.rechercher(motifActif, 0, 25);
        if (!annule) setReponse({ motif: motifActif, liste: page?.content ?? [], horsLigne: false });
      } catch {
        // serveur ou source des équipements injoignable : la liste déjà chargée sert de repli
        if (!annule) setReponse({ motif: motifActif, liste: null, horsLigne: true });
      }
    }, 280);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [motifActif]);

  const liste = useMemo(() => {
    if (!motifActif) return optionsLocales.slice(0, 60);
    if (resultats) return resultats;
    // serveur injoignable (ou réponse en attente) : filtre de la liste déjà chargée
    const m = motifActif.toLowerCase();
    return optionsLocales.filter((o) => contient(o, m)).slice(0, 60);
  }, [motifActif, resultats, optionsLocales]);


  // ─── Fermeture au clic extérieur ───
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

  // ─── Choix ───
  const choisir = useCallback((equipement) => {
    setChoisi(equipement);
    setMessage('');
    setOuvert(false);
    setSaisie('');
    onChange?.({ target: { name, value: String(equipement.id) } });
  }, [name, onChange]);

  /** Identifiant trouvé par un code (caméra ou douchette) : on récupère son nom puis on le choisit. */
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
    // le focus revient sur le bouton (sur le champ, il rouvrirait la liste avec l'ancien texte)
    boutonScanner.current?.focus();
  }, [choisirParId]);

  // ─── Clavier ───
  const auClavier = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!ouvert) setOuvert(true);
      setActif((i) => Math.min(Math.min(i, liste.length - 1) + 1, liste.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Ne jamais soumettre le formulaire depuis ce champ
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
              {motifActif ? t('Aucun équipement ne correspond. Appuyez sur Entrée pour chercher ce code.') : t('Tapez un nom ou scannez l’étiquette.')}
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