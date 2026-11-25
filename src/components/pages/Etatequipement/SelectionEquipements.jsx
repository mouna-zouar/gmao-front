import { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { t, locale } from '../../../i18n';
import FiltreFamilleArbre, { filtrerParFamille } from './FiltreFamilleArbre';
import './SelectionEquipements.css';

const normaliser = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function SelectionEquipements({ id, valeurs, onChange, options, services = {}, loading = false, disabled = false }) {
  const [recherche, setRecherche] = useState('');
  const [famille, setFamille] = useState(null);
  const [service, setService] = useState('');
  const pourFamilles = useMemo(() => options.map((o) => ({
    lotArticleImmobilistationId: o.id, familleId: o.articleFamilleId ?? null, familleNom: o.articleFamilleNom || '',
  })), [options]);
  const listeServices = useMemo(() => {
    const m = new Map();
    let sans = 0;
    options.forEach((o) => {
      if (o.serviceId == null) { sans += 1; return; }
      const cle = String(o.serviceId);
      const f = m.get(cle) || { id: cle, nom: services[cle] || t('Service #{id}', { id: cle }), n: 0 };
      f.n += 1;
      m.set(cle, f);
    });
    return { liste: [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, locale())), sans };
  }, [options, services]);
  const choisis = useMemo(() => new Set(valeurs.map(String)), [valeurs]);
  const parId = useMemo(() => new Map(options.map((o) => [String(o.id), o])), [options]);
  const nom = (cle) => parId.get(cle)?.designation || t('Équipement #{id}', { id: cle });

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return options
      .filter((o) => filtrerParFamille(famille, { lotArticleImmobilistationId: o.id, familleId: o.articleFamilleId ?? null }))
      .filter((o) => !service || (service === 'AUCUN' ? o.serviceId == null : String(o.serviceId) === service))
      .filter((o) => !q || [o.designation, o.numPiece, o.codeBarre, o.marque, o.modele].some((v) => normaliser(v).includes(q)));
  }, [options, recherche, famille, service]);
  const filtre = Boolean(recherche.trim() || famille || service);

  const basculer = (cle) => {
    const suivant = new Set(choisis);
    if (suivant.has(cle)) suivant.delete(cle); else suivant.add(cle);
    onChange([...suivant]);
  };
  const toutCocher = () => onChange([...new Set([...choisis, ...visibles.map((o) => String(o.id))])]);

  return (
    <div className={`emt-multi ${disabled ? 'is-disabled' : ''}`}>
      <div className="emt-multi__choisis" aria-live="polite">
        {choisis.size === 0 ? (
          <span className="emt-multi__aucun">{t('Tous les équipements')}</span>
        ) : (
          [...choisis].map((cle) => (
            <span key={cle} className="emt-multi__puce">
              {nom(cle)}
              <button type="button" onClick={() => basculer(cle)} disabled={disabled} aria-label={t('Retirer {nom}', { nom: nom(cle) })}>
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="emt-multi__barre">
        <FiltreFamilleArbre equipements={pourFamilles} valeur={famille} onChange={setFamille} />
        <select className="emt-multi__service" value={service} onChange={(e) => setService(e.target.value)} disabled={disabled} aria-label={t('Service')}>
          <option value="">{t('Tous les services')} ({options.length})</option>
          {listeServices.liste.map((x) => <option key={x.id} value={x.id}>{x.nom} ({x.n})</option>)}
          {listeServices.sans > 0 && <option value="AUCUN">{t('Sans service')} ({listeServices.sans})</option>}
        </select>
      </div>
      <div className="emt-multi__barre">
        <div className="emt-multi__recherche">
          <Search size={14} aria-hidden="true" />
          <input
            id={id}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher par nom, n° de pièce ou code-barres…')}
            disabled={disabled}
          />
        </div>
        <button type="button" className="emt-multi__action" onClick={toutCocher} disabled={disabled || visibles.length === 0}>
          {filtre ? t('Cocher les {n} résultats', { n: visibles.length }) : t('Tout cocher')}
        </button>
        <button type="button" className="emt-multi__action" onClick={() => onChange([])} disabled={disabled || choisis.size === 0}>
          {t('Tout décocher')}
        </button>
      </div>

      <ul className="emt-multi__liste" role="group" aria-label={t('Équipements')}>
        {loading ? (
          <li className="emt-multi__vide"><Loader2 size={14} className="cf-tourne" /> {t('Chargement…')}</li>
        ) : visibles.length === 0 ? (
          <li className="emt-multi__vide">{t('Aucun équipement ne correspond')}</li>
        ) : (
          visibles.map((o) => {
            const cle = String(o.id);
            return (
              <li key={cle}>
                <label className={`emt-multi__ligne ${choisis.has(cle) ? 'is-choisi' : ''}`}>
                  <input type="checkbox" checked={choisis.has(cle)} onChange={() => basculer(cle)} disabled={disabled} />
                  <span className="emt-multi__nom">{o.designation || t('Équipement #{id}', { id: o.id })}</span>
                  {(o.numPiece || o.marque) && (
                    <span className="emt-multi__hint">{o.numPiece ? t('N° pièce : {num}', { num: o.numPiece }) : o.marque}</span>
                  )}
                </label>
              </li>
            );
          })
        )}
      </ul>
      <small className="emt-multi__compte">{t('{n} équipement(s) choisi(s)', { n: choisis.size })}</small>
    </div>
  );
}
