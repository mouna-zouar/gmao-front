import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Printer, QrCode, ScanLine, Search, Stethoscope } from 'lucide-react';
import equipementService from '../../../services/equipementService';
import ScannerQR from './ScannerQR';
import { imprimerEtiquettes } from './qrEtiquettes';
import { CRITICITES, ETATS_EQUIPEMENT, garantieEnClair } from './equipementLibelles';
import { t, tp } from '../../../i18n';
import './Equipements.css';
import Pagination from '../../commun/Pagination';

/*
 * Page « Équipements » : rechercher un appareil, ouvrir sa fiche, scanner son QR code
 * et imprimer des étiquettes QR (une planche A4 pour plusieurs appareils).
 */

const TAILLE_PAGE = 10;

function Pastille({ ton = 'neutre', children }) {
  return <span className={`eq-pastille eq-ton--${ton}`}>{children}</span>;
}

export default function Equipements({ isModal = false }) {
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [rechercheEffective, setRechercheEffective] = useState('');
  const [page, setPage] = useState(0);
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [selection, setSelection] = useState(() => new Map());
  const [scanner, setScanner] = useState(false);
  const [impression, setImpression] = useState(false);

  // La recherche part 300 ms après la dernière frappe
  useEffect(() => {
    const minuterie = setTimeout(() => { setRechercheEffective(recherche.trim()); setPage(0); }, 300);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  useEffect(() => {
    let actif = true;
    equipementService.rechercher(rechercheEffective, page, TAILLE_PAGE)
      .then((r) => { if (actif) { setResultat(r); setErreur(''); } })
      .catch(() => { if (actif) setErreur(t('La liste des équipements est injoignable pour le moment.')); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [rechercheEffective, page]);

  const changerPage = (p) => { setChargement(true); setPage(p); };

  const basculer = (e) => setSelection((s) => {
    const n = new Map(s);
    if (n.has(e.id)) n.delete(e.id); else n.set(e.id, e);
    return n;
  });

  const imprimer = async () => {
    setImpression(true);
    try { await imprimerEtiquettes([...selection.values()]); } finally { setImpression(false); }
  };

  const fermerScanner = useCallback(() => setScanner(false), []);

  const liste = resultat?.content ?? [];
  const total = resultat?.totalElements ?? 0;
  const nbPages = resultat?.totalPages ?? 0;

  return (
    <main className={`eq-page${isModal ? ' eq-page--modale' : ''}`}>
      <header className="eq-entete">
        {/* Dans la fenêtre des bons de maintenance, le titre est déjà affiché par la fenêtre */}
        {!isModal && (
          <div>
            <h1>{t('Équipements')}</h1>
            <p>{t('Retrouvez un appareil, son historique de pannes et ses documents, ou imprimez son étiquette QR.')}</p>
          </div>
        )}
        <div className="eq-entete-actions">
          {selection.size > 0 && (
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={imprimer} disabled={impression}>
              {impression ? <Loader2 size={17} className="eq-tourne" /> : <Printer size={17} />}
              {tp('étiquette à imprimer', selection.size)}
            </button>
          )}
          <button type="button" className="eq-bouton" onClick={() => setScanner(true)}>
            <ScanLine size={17} /> {t('Scanner un QR code')}
          </button>
        </div>
      </header>

      <label className="eq-recherche">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => { setRecherche(e.target.value); setChargement(true); }}
          placeholder={t('Désignation, marque, modèle, n° de pièce ou code-barre')}
          aria-label={t('Rechercher un équipement')}
        />
      </label>

      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}

      <section className="eq-liste" aria-busy={chargement}>
        <div className="eq-liste-entete">
          <span>{chargement ? t('Recherche…') : tp('équipement trouvé', total)}</span>
          {selection.size > 0 && (
            <button type="button" className="eq-lien" onClick={() => setSelection(new Map())}>{t('Vider la sélection')}</button>
          )}
        </div>

        {!chargement && liste.length === 0 && !erreur && (
          <div className="eq-vide">
            <Stethoscope size={22} />
            <p>{rechercheEffective ? t('Aucun équipement ne correspond à « {texte} ».', { texte: rechercheEffective }) : t('Aucun équipement.')}</p>
          </div>
        )}

        <ul>
          {liste.map((e) => {
            const etat = ETATS_EQUIPEMENT[e.etatActuel];
            const crit = CRITICITES[e.criticite];
            const garantie = garantieEnClair(e.garantie);
            const choisi = selection.has(e.id);
            return (
              <li key={e.id} className={`eq-ligne ${choisi ? 'is-choisi' : ''}`}>
                <label className="eq-case" title={t('Ajouter à l’impression des étiquettes')}>
                  <input type="checkbox" checked={choisi} onChange={() => basculer(e)} aria-label={t('Sélectionner {nom}', { nom: e.designation || `#${e.id}` })} />
                </label>
                <button type="button" className="eq-ligne-corps" onClick={() => navigate(`/equipement/${e.id}`)}>
                  <span className="eq-ligne-nom">
                    <strong>{e.designation || t('Équipement #{id}', { id: e.id })}</strong>
                    <span>{[e.marque, e.modele].filter(Boolean).join(' ') || '—'}</span>
                  </span>
                  <span className="eq-ligne-ref">{e.numPiece || e.codeBarre || `#${e.id}`}</span>
                  <span className="eq-ligne-pastilles">
                    {etat && <Pastille ton={etat.ton}>{t(etat.label)}</Pastille>}
                    {crit && <Pastille ton={crit.ton}>{t(crit.label)}</Pastille>}
                    <Pastille ton={garantie.ton}>{garantie.texte}</Pastille>
                  </span>
                  <ChevronRight size={18} className="eq-ligne-fleche rtl-miroir" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        <Pagination page={page} taille={TAILLE_PAGE} total={total} nbPages={nbPages} onPage={changerPage} desactive={chargement} masquerSiUnePage />
      </section>

      <p className="eq-astuce">
        <QrCode size={16} />
        {t('Cochez des équipements pour imprimer leurs étiquettes QR sur une planche A4 (3 × 7, format 63,5 × 38,1 mm).')}
      </p>

      {scanner && <ScannerQR onClose={fermerScanner} />}
    </main>
  );
}