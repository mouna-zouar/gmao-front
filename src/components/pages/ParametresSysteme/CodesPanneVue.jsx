import { useEffect, useMemo, useState, cloneElement, Fragment } from 'react';
import { Save, RefreshCw, X, Tags, Loader2, Plus, Pencil, Power, ChevronRight, ChevronDown } from 'lucide-react';
import parametreService from '../../../services/parametreService';
import codePanneService from '../../../services/codePanneService';
import { t } from '../../../i18n';
import { arbreFamilles, lignesArbre, basculerDansSet } from '../../../utils/arbreFamilles';
import { messageErreur } from './parametresCommun';

const VIDE = { id: null, code: '', libelle: '', categorie: '', motsCles: '', familles: '', actif: true };

function ChoixFamillesCode({ familles, valeur, onChange }) {
  const choisies = new Set(String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean));
  const arbre = useMemo(() => arbreFamilles(familles), [familles]);
  const [ouverts, setOuverts] = useState(() => new Set());
  const plier = basculerDansSet(setOuverts);
  const basculer = (id) => {
    const n = new Set(choisies);
    if (n.has(String(id))) n.delete(String(id)); else n.add(String(id));
    onChange([...n].join(','));
  };
  return (
    <div className="ps-cp-familles" role="group" aria-label={t('Familles')}>
      <span className="ps-cp-familles-titre">{t('Familles concernées')} :</span>
      <button type="button" className={`ps-cp-puce ${choisies.size === 0 ? 'is-choisie' : ''}`} aria-pressed={choisies.size === 0} onClick={() => onChange('')}>
        {t('Toutes les familles')}
      </button>
      {lignesArbre(arbre, ouverts).map(({ noeud: f, niveau, ouvert }) => {
        const nbFilsChoisis = f.ids.filter((id) => id !== String(f.id) && choisies.has(id)).length;
        return (
          <span key={f.id} className={`ps-cp-puce-groupe ${niveau > 0 ? 'is-fils' : ''}`}>
            {f.virtuel ? (
              <span className="ps-cp-puce ps-cp-puce--parent">{f.nom || f.code}</span>
            ) : (
              <button type="button" className={`ps-cp-puce ${niveau > 0 ? 'ps-cp-puce--fils' : ''} ${choisies.has(String(f.id)) ? 'is-choisie' : ''}`}
                aria-pressed={choisies.has(String(f.id))} onClick={() => basculer(f.id)}>
                {f.nom || f.code}
              </button>
            )}
            {f.enfants.length > 0 && (
              <button type="button" className={`ps-cp-puce-fils ${nbFilsChoisis ? 'has-choix' : ''}`} onClick={() => plier(f.id)}
                aria-expanded={ouvert} title={ouvert ? t('Cacher les sous-familles') : t('Afficher les sous-familles')}>
                {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {nbFilsChoisis ? `${nbFilsChoisis}/${f.enfants.length}` : f.enfants.length}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function CodesPanneVue({ prestataireId }) {
  const [familles, setFamilles] = useState([]);
  useEffect(() => {
    let annule = false;
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) setFamilles([]); });
    return () => { annule = true; };
  }, [prestataireId]);
  const nomsFamilles = (valeur) => {
    const ids = String(valeur || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0) return t('Toutes');
    return ids.map((id) => familles.find((f) => String(f.id) === id)?.nom || `#${id}`).join(', ');
  };
  const [codes, setCodes] = useState(null);
  const [edition, setEdition] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [inactifs, setInactifs] = useState(false);

  const charger = () => {
    setErreur('');
    codePanneService.liste(true)
      .then(setCodes)
      .catch(() => { setCodes([]); setErreur(t('Impossible de charger les codes panne.')); });
  };
  useEffect(charger, []);

  const visibles = useMemo(() => (codes || []).filter((c) => inactifs || c.actif), [codes, inactifs]);
  const nbInactifs = (codes || []).filter((c) => !c.actif).length;
  const categories = useMemo(() => [...new Set((codes || []).map((c) => c.categorie).filter(Boolean))].sort(), [codes]);

  const enregistrer = async (c) => {
    setOccupe(true);
    setErreur('');
    try {
      await codePanneService.enregistrer(c);
      setEdition(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const basculer = async (c) => {
    setOccupe(true);
    setErreur('');
    try {
      if (c.actif) await codePanneService.desactiver(c.id);
      else await codePanneService.enregistrer({ ...c, actif: true });
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const champ = (nom, props = {}) => (
    <input
      className="ps-cp-input"
      value={edition?.[nom] ?? ''}
      onChange={(e) => setEdition((x) => ({ ...x, [nom]: e.target.value }))}
      {...props}
    />
  );

  const ligneEdition = (
    <Fragment>
    <tr className="ps-cp-edition">
      <td>{champ('code', { placeholder: 'ELEC-ALIM', maxLength: 30, 'aria-label': t('Code'), autoFocus: true })}</td>
      <td>{champ('libelle', { placeholder: t('Libellé'), maxLength: 200, 'aria-label': t('Libellé') })}</td>
      <td>
        {champ('categorie', { placeholder: t('Catégorie'), list: 'ps-cp-categories', 'aria-label': t('Catégorie') })}
        <datalist id="ps-cp-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </td>
      <td>{champ('motsCles', { placeholder: t('mots séparés par des virgules'), 'aria-label': t('Mots-clés') })}</td>
      <td className="ps-cp-mots">{nomsFamilles(edition?.familles)}</td>
      <td className="ps-cp-actions">
        <button type="button" className="ps-icone-btn" disabled={occupe} onClick={() => enregistrer(edition)} title={t('Enregistrer')} aria-label={t('Enregistrer')}>
          {occupe ? <Loader2 size={15} className="ps-tourne" /> : <Save size={15} />}
        </button>
        <button type="button" className="ps-icone-btn" onClick={() => { setEdition(null); setErreur(''); }} title={t('Annuler')} aria-label={t('Annuler')}>
          <X size={15} />
        </button>
      </td>
    </tr>
    <tr className="ps-cp-edition ps-cp-edition-familles">
      <td colSpan={6}>
        <ChoixFamillesCode familles={familles} valeur={edition?.familles}
          onChange={(v) => setEdition((x) => ({ ...x, familles: v }))} />
      </td>
    </tr>
    </Fragment>
  );

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <Tags size={15} aria-hidden="true" /> {t('Codes panne')}
        <button type="button" className="ps-icone-btn" onClick={charger} title={t('Rafraîchir')} aria-label={t('Rafraîchir')}>
          <RefreshCw size={15} />
        </button>
      </h3>
      <p className="ps-mc-aide">
        {t('Pendant la saisie d’une réclamation, l’IA propose un de ces codes et montre les pannes semblables déjà résolues. Les mots-clés servent quand l’IA ne répond pas.')}
        {' '}{t('Seuls les codes de la famille de l’équipement sont proposés ; un code sans famille vaut pour toutes.')}
      </p>
      <div className="ps-cp-barre">
        <button type="button" className="ps-action" disabled={edition !== null} onClick={() => setEdition({ ...VIDE })}>
          <Plus size={14} /> {t('Nouveau code')}
        </button>
        {nbInactifs > 0 && (
          <label className="ps-cp-filtre">
            <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
            {t('Afficher les codes désactivés ({n})', { n: nbInactifs })}
          </label>
        )}
      </div>
      {erreur && <p className="ps-cp-erreur" role="alert">{erreur}</p>}
      {codes === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="ps-mc-defile">
          <table className="ps-mc-table ps-cp-table">
            <thead>
              <tr>
                <th>{t('Code')}</th>
                <th>{t('Libellé')}</th>
                <th>{t('Catégorie')}</th>
                <th>{t('Mots-clés')}</th>
                <th>{t('Familles')}</th>
                <th><span className="ps-sr">{t('Actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {edition && !edition.id && ligneEdition}
              {visibles.length === 0 && !edition && (
                <tr><td colSpan={6} className="ps-mc-vide">{t('Aucun code panne.')}</td></tr>
              )}
              {visibles.map((c) => (edition?.id === c.id ? cloneElement(ligneEdition, { key: c.id }) : (
                <tr key={c.id} className={c.actif ? '' : 'ps-cp-inactif'}>
                  <td className="ps-mc-num"><strong>{c.code}</strong></td>
                  <td dir="auto">{c.libelle}{!c.actif && <small>{t('Désactivé')}</small>}</td>
                  <td>{c.categorie || '—'}</td>
                  <td className="ps-cp-mots" dir="auto">{c.motsCles || '—'}</td>
                  <td className="ps-cp-mots">{nomsFamilles(c.familles)}</td>
                  <td className="ps-cp-actions">
                    <button type="button" className="ps-icone-btn" disabled={edition !== null} onClick={() => setEdition({ ...VIDE, ...c, categorie: c.categorie || '', motsCles: c.motsCles || '', familles: c.familles || '' })} title={t('Modifier')} aria-label={t('Modifier')}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="ps-icone-btn" disabled={occupe || edition !== null} onClick={() => basculer(c)} title={c.actif ? t('Désactiver') : t('Réactiver')} aria-label={c.actif ? t('Désactiver') : t('Réactiver')}>
                      <Power size={15} />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
