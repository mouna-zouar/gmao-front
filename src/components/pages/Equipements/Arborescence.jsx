import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, ChevronDown, ChevronRight, DoorOpen, FolderInput, Layers, Link2, Loader2, MapPin, Pencil, Plus,
  RefreshCw, Search, Stethoscope, Trash2, Unlink, Warehouse, Hospital,
} from 'lucide-react';
import hierarchieService from '../../../services/hierarchieService';
import { oublierCarte } from '../../../services/lieuxCache';
import equipementService from '../../../services/equipementService';
import serviceService from '../../../services/Serviceservice';
import { Modale, ConfirmModal } from '../../commun';
import { ETATS_EQUIPEMENT, montant } from './equipementLibelles';
import { t, tp } from '../../../i18n';
import './Arborescence.css';

/*
 * Hiérarchie des lieux et des équipements (onglet « Arborescence » de la page Équipements)
 * et bloc « Position » de la fiche équipement.
 */

export const TYPES_LIEU = {
  SITE: { label: 'Site', icone: Hospital },
  BATIMENT: { label: 'Bâtiment', icone: Building2 },
  ETAGE: { label: 'Étage', icone: Layers },
  SERVICE: { label: 'Service', icone: Warehouse },
  LOCAL: { label: 'Local', icone: DoorOpen },
};
const TYPE_ENFANT = { SITE: 'BATIMENT', BATIMENT: 'ETAGE', ETAGE: 'SERVICE', SERVICE: 'LOCAL', LOCAL: 'LOCAL' };

const messageErreur = (err, defaut) => err?.response?.data?.message || defaut;

/** Lieux à plat dans l'ordre de l'arbre, avec leur profondeur. */
function aplatir(lieux) {
  const enfants = new Map();
  lieux.forEach((l) => {
    const k = l.parentId ?? 'racine';
    if (!enfants.has(k)) enfants.set(k, []);
    enfants.get(k).push(l);
  });
  const ids = new Set(lieux.map((l) => l.id));
  const racines = lieux.filter((l) => l.parentId == null || !ids.has(l.parentId));
  const sortie = [];
  const parcourir = (l, niveau) => {
    sortie.push({ ...l, niveau });
    (enfants.get(l.id) || []).forEach((e) => parcourir(e, niveau + 1));
  };
  racines.forEach((r) => parcourir(r, 0));
  return { liste: sortie, enfants };
}

function descendantsDe(id, enfants) {
  const r = new Set();
  const pile = [...(enfants.get(id) || [])];
  while (pile.length) {
    const l = pile.pop();
    if (!r.has(l.id)) { r.add(l.id); pile.push(...(enfants.get(l.id) || [])); }
  }
  return r;
}

function cheminDe(id, parId) {
  const c = [];
  const vus = new Set();
  for (let l = parId.get(id); l && !vus.has(l.id); l = parId.get(l.parentId)) { vus.add(l.id); c.unshift(l); }
  return c;
}

function IconeLieu({ type, size = 16 }) {
  const Icone = TYPES_LIEU[type]?.icone || MapPin;
  return <Icone size={size} aria-hidden="true" />;
}

function PastilleEtat({ etat }) {
  const d = ETATS_EQUIPEMENT[etat];
  if (!d) return null;
  return <span className={`eq-pastille eq-ton--${d.ton}`}>{t(d.label)}</span>;
}

/* ───────── Choix d'un lieu (déplacer un lieu ou des équipements) ───────── */

function ChoixLieu({ ouvert, titre, lieux, exclus = new Set(), avecRacine, libelleRacine, onChoisir, onFermer, occupe }) {
  const [choix, setChoix] = useState(undefined);
  const [filtre, setFiltre] = useState('');
  useEffect(() => { if (ouvert) { setChoix(undefined); setFiltre(''); } }, [ouvert]);
  const { liste } = useMemo(() => aplatir(lieux), [lieux]);
  const f = filtre.trim().toLowerCase();
  const visibles = liste.filter((l) => !exclus.has(l.id) && (!f || l.nom.toLowerCase().includes(f)));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} icone={FolderInput} taille="sm" titre={titre}
      pied={<>
        <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
        <button type="button" className="cm-btn cm-btn--principal" disabled={choix === undefined || occupe} onClick={() => onChoisir(choix)}>
          {occupe ? <Loader2 size={14} className="eq-tourne" /> : null} {t('Déplacer')}
        </button>
      </>}>
      <label className="arb-filtre">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t('Filtrer les lieux')} />
      </label>
      <ul className="arb-choix" role="radiogroup">
        {avecRacine && (
          <li>
            <label className={choix === null ? 'is-choisi' : ''}>
              <input type="radio" name="arb-choix" checked={choix === null} onChange={() => setChoix(null)} />
              <MapPin size={15} aria-hidden="true" /> <span>{libelleRacine}</span>
            </label>
          </li>
        )}
        {visibles.map((l) => (
          <li key={l.id}>
            <label className={choix === l.id ? 'is-choisi' : ''} style={{ paddingInlineStart: 10 + (f ? 0 : l.niveau * 18) }}>
              <input type="radio" name="arb-choix" checked={choix === l.id} onChange={() => setChoix(l.id)} />
              <IconeLieu type={l.type} size={15} /> <span>{l.nom}</span>
            </label>
          </li>
        ))}
      </ul>
    </Modale>
  );
}

/* ───────── Formulaire d'un lieu ───────── */

function FormLieu({ ouvert, initial, onEnregistrer, onFermer, occupe, services }) {
  const [form, setForm] = useState(initial);
  useEffect(() => { if (ouvert) setForm(initial); }, [ouvert, initial]);
  if (!form) return null;
  const maj = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} icone={form.id ? Pencil : Plus} taille="sm"
      titre={form.id ? t('Modifier le lieu') : t('Nouveau lieu')} sousTitre={form.parentNom || undefined}
      pied={<>
        <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
        <button type="button" className="cm-btn cm-btn--principal" disabled={!form.nom?.trim() || occupe} onClick={() => onEnregistrer(form)}>
          {t('Enregistrer')}
        </button>
      </>}>
      <div className="arb-form">
        <label>
          <span>{t('Type')} *</span>
          <select value={form.type} onChange={maj('type')}>
            {Object.entries(TYPES_LIEU).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('Nom')} *</span>
          <input value={form.nom || ''} onChange={maj('nom')} autoFocus />
        </label>
        <label>
          <span>{t('Code')}</span>
          <input value={form.code || ''} onChange={maj('code')} />
        </label>
        {form.type === 'SERVICE' && (
          <label>
            <span>{t('Service MEDSYS')}</span>
            <select value={form.serviceId ?? ''} onChange={maj('serviceId')}>
              <option value="">—</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
        )}
      </div>
    </Modale>
  );
}

/* ───────── Ajout d'équipements à un lieu ───────── */

function AjoutEquipements({ ouvert, lieu, onAjouter, onFermer, occupe }) {
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState([]);
  const [choisis, setChoisis] = useState(() => new Map());
  const [chargement, setChargement] = useState(false);
  useEffect(() => { if (ouvert) { setRecherche(''); setChoisis(new Map()); } }, [ouvert]);
  useEffect(() => {
    if (!ouvert) return undefined;
    let actif = true;
    setChargement(true);
    const m = setTimeout(() => {
      equipementService.rechercher(recherche.trim(), 0, 30)
        .then((r) => { if (actif) setResultats(r?.content ?? []); })
        .catch(() => { if (actif) setResultats([]); })
        .finally(() => { if (actif) setChargement(false); });
    }, 250);
    return () => { actif = false; clearTimeout(m); };
  }, [recherche, ouvert]);
  const basculer = (e) => setChoisis((s) => { const n = new Map(s); if (n.has(e.id)) n.delete(e.id); else n.set(e.id, e); return n; });
  return (
    <Modale ouvert={ouvert} onFermer={onFermer} icone={Plus} taille="md" titre={t('Ajouter des équipements')} sousTitre={lieu?.nom}
      pied={<>
        <button type="button" className="cm-btn" onClick={onFermer}>{t('Annuler')}</button>
        <button type="button" className="cm-btn cm-btn--principal" disabled={!choisis.size || occupe} onClick={() => onAjouter([...choisis.keys()])}>
          {tp('équipement à ranger', choisis.size)}
        </button>
      </>}>
      <label className="arb-filtre">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} autoFocus
          placeholder={t('Désignation, marque, modèle, n° de pièce ou code-barre')} />
      </label>
      <ul className="arb-ajout">
        {chargement && <li className="arb-vide"><Loader2 size={18} className="eq-tourne" /></li>}
        {!chargement && resultats.map((e) => (
          <li key={e.id}>
            <label className={choisis.has(e.id) ? 'is-choisi' : ''}>
              <input type="checkbox" checked={choisis.has(e.id)} onChange={() => basculer(e)} />
              <span className="arb-ajout__nom">
                <strong>{e.designation || `#${e.id}`}</strong>
                <span>{[e.marque, e.modele].filter(Boolean).join(' ') || '—'} · {e.numPiece || e.codeBarre || `#${e.id}`}</span>
              </span>
              <PastilleEtat etat={e.etatActuel} />
            </label>
          </li>
        ))}
      </ul>
    </Modale>
  );
}

/* ───────── Onglet « Arborescence » ───────── */

export default function Arborescence() {
  const navigate = useNavigate();
  const [arbre, setArbre] = useState(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState(null);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [selection, setSelection] = useState(undefined); // id du lieu, null = sans lieu
  const [sousLieux, setSousLieux] = useState(true);
  const [equipements, setEquipements] = useState([]);
  const [chargementEq, setChargementEq] = useState(false);
  const [coches, setCoches] = useState(() => new Set());
  const [filtre, setFiltre] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [formLieu, setFormLieu] = useState(null);
  const [deplacement, setDeplacement] = useState(null); // { type: 'lieu' | 'equipements', ids }
  const [ajout, setAjout] = useState(false);
  const [aDesactiver, setADesactiver] = useState(null);
  const [services, setServices] = useState([]);
  const [survol, setSurvol] = useState(null);

  const chargerArbre = useCallback(async () => {
    try {
      const a = await hierarchieService.arbre();
      setArbre(a);
      setErreur('');
      setSelection((s) => {
        if (s !== undefined && (s === null || a.lieux.some((l) => l.id === s))) return s;
        return a.lieux.find((l) => l.parentId == null)?.id ?? null;
      });
      setOuverts((o) => (o.size ? o : new Set(a.lieux.filter((l) => l.parentId == null).map((l) => l.id))));
    } catch {
      setErreur(t("L'arborescence est injoignable pour le moment."));
    }
  }, []);

  useEffect(() => { chargerArbre(); }, [chargerArbre]);
  useEffect(() => {
    serviceService.getAll(0, 500)
      .then((r) => {
        const liste = Array.isArray(r) ? r : (r?.content ?? []);
        setServices(liste.map((s) => ({ id: s.id, nom: s.description || s.libelle || s.nom || s.code || `#${s.id}` })));
      })
      .catch(() => setServices([]));
  }, []);

  const chargerEquipements = useCallback(async () => {
    if (selection === undefined) return;
    setChargementEq(true);
    try {
      setEquipements(await hierarchieService.equipements(selection, sousLieux));
    } catch {
      setEquipements([]);
    } finally {
      setChargementEq(false);
    }
  }, [selection, sousLieux]);
  useEffect(() => { setCoches(new Set()); chargerEquipements(); }, [chargerEquipements]);

  const lieux = useMemo(() => arbre?.lieux ?? [], [arbre]);
  const parId = useMemo(() => new Map(lieux.map((l) => [l.id, l])), [lieux]);
  const { enfants } = useMemo(() => aplatir(lieux), [lieux]);
  const lieu = selection != null ? parId.get(selection) : null;

  const action = async (fn, succes) => {
    setOccupe(true);
    setMessage(null);
    try {
      await fn();
      oublierCarte();
      if (succes) setMessage({ ok: true, texte: succes });
      await chargerArbre();
      await chargerEquipements();
      return true;
    } catch (err) {
      setMessage({ ok: false, texte: messageErreur(err, t("L'action n'a pas pu être enregistrée.")) });
      return false;
    } finally {
      setOccupe(false);
    }
  };

  const basculerOuvert = (id) => setOuverts((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const enregistrerLieu = async (f) => {
    const corps = { parentId: f.parentId ?? null, type: f.type, nom: f.nom, code: f.code, serviceId: f.serviceId === '' ? null : f.serviceId };
    const ok = await action(async () => {
      const r = f.id ? await hierarchieService.modifierLieu(f.id, corps) : await hierarchieService.creerLieu(corps);
      if (!f.id) {
        if (f.parentId) setOuverts((o) => new Set(o).add(f.parentId));
        setSelection(r.id);
      }
    });
    if (ok) setFormLieu(null);
  };

  const deplacer = async (cible) => {
    const d = deplacement;
    const ok = await action(
      () => (d.type === 'lieu' ? hierarchieService.deplacerLieu(d.ids[0], cible) : hierarchieService.affecter(d.ids, cible)),
      d.type === 'lieu' ? t('Lieu déplacé.') : tp('équipement déplacé', d.ids.length),
    );
    if (ok) { setDeplacement(null); if (cible != null) setOuverts((o) => new Set(o).add(cible)); }
  };

  // Glisser-déposer : un lieu ou des équipements sur un lieu de l'arbre
  const deposer = (e, cibleId) => {
    e.preventDefault();
    setSurvol(null);
    let donnees;
    try { donnees = JSON.parse(e.dataTransfer.getData('application/json') || 'null'); } catch { donnees = null; }
    if (!donnees) return;
    if (donnees.type === 'lieu') {
      if (donnees.id === cibleId || descendantsDe(donnees.id, enfants).has(cibleId)) return;
      action(() => hierarchieService.deplacerLieu(donnees.id, cibleId), t('Lieu déplacé.'));
    } else if (donnees.type === 'equipements') {
      action(() => hierarchieService.affecter(donnees.ids, cibleId), tp('équipement déplacé', donnees.ids.length));
    }
  };
  const glisser = (e, donnees) => {
    e.dataTransfer.setData('application/json', JSON.stringify(donnees));
    e.dataTransfer.effectAllowed = 'move';
  };

  const f = filtre.trim().toLowerCase();
  const correspond = useMemo(() => {
    if (!f) return null;
    const garder = new Set();
    lieux.forEach((l) => {
      if (l.nom.toLowerCase().includes(f) || (l.code || '').toLowerCase().includes(f)) {
        garder.add(l.id);
        cheminDe(l.id, parId).forEach((p) => garder.add(p.id));
      }
    });
    return garder;
  }, [f, lieux, parId]);

  const rendreNoeud = (l, niveau) => {
    if (correspond && !correspond.has(l.id)) return null;
    const fils = enfants.get(l.id) || [];
    const ouvert = correspond ? true : ouverts.has(l.id);
    return (
      <li key={l.id} role="treeitem" aria-expanded={fils.length ? ouvert : undefined} aria-selected={selection === l.id}>
        <div
          className={`arb-noeud ${selection === l.id ? 'is-actif' : ''} ${survol === l.id ? 'is-survol' : ''}`}
          style={{ paddingInlineStart: 6 + niveau * 16 }}
          draggable
          onDragStart={(e) => glisser(e, { type: 'lieu', id: l.id })}
          onDragOver={(e) => { e.preventDefault(); setSurvol(l.id); }}
          onDragLeave={() => setSurvol((s) => (s === l.id ? null : s))}
          onDrop={(e) => deposer(e, l.id)}
        >
          <button type="button" className="arb-noeud__fleche" onClick={() => basculerOuvert(l.id)} disabled={!fils.length}
            aria-label={ouvert ? t('Replier') : t('Déplier')}>
            {fils.length ? (ouvert ? <ChevronDown size={15} /> : <ChevronRight size={15} className="rtl-miroir" />) : null}
          </button>
          <button type="button" className="arb-noeud__corps" onClick={() => setSelection(l.id)}>
            <IconeLieu type={l.type} size={15} />
            <span className="arb-noeud__nom">{l.nom}</span>
            {l.nbArretes > 0 && <span className="arb-noeud__alerte" title={tp('équipement à l’arrêt', l.nbArretes)}>{l.nbArretes}</span>}
            <span className="arb-noeud__n">{l.nbEquipements}</span>
          </button>
        </div>
        {fils.length > 0 && ouvert && <ul role="group">{fils.map((e) => rendreNoeud(e, niveau + 1))}</ul>}
      </li>
    );
  };

  const racines = lieux.filter((l) => l.parentId == null || !parId.has(l.parentId));
  const chemin = lieu ? cheminDe(lieu.id, parId) : [];
  const toutCoche = equipements.length > 0 && equipements.every((e) => coches.has(e.id));

  if (!arbre && !erreur) return <div className="arb-chargement"><Loader2 size={22} className="eq-tourne" /></div>;

  return (
    <div className="arb">
      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
      {message && <p className={`arb-message ${message.ok ? 'is-ok' : 'is-ko'}`} role="status">{message.texte}</p>}

      <div className="arb-grille">
        {/* ── Arbre des lieux ── */}
        <div className="arb-arbre" role="region" aria-label={t('Lieux')}>
          <div className="arb-arbre__entete">
            <label className="arb-filtre">
              <Search size={15} aria-hidden="true" />
              <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t('Filtrer les lieux')} />
            </label>
            <button type="button" className="arb-icone" title={t('Ajouter les services manquants')} disabled={occupe}
              onClick={() => action(async () => {
                const n = await hierarchieService.servicesManquants();
                setMessage({ ok: true, texte: n ? tp('service ajouté', n) : t('Tous les services ont déjà leur nœud.') });
              })}>
              <RefreshCw size={16} />
            </button>
            <button type="button" className="arb-icone arb-icone--plein" title={t('Nouveau site')}
              onClick={() => setFormLieu({ type: 'SITE', nom: '', code: '', parentId: null })}>
              <Plus size={16} />
            </button>
          </div>
          <ul className="arb-liste" role="tree">
            {racines.map((r) => rendreNoeud(r, 0))}
          </ul>
          <button type="button" className={`arb-noeud arb-noeud--sans ${selection === null ? 'is-actif' : ''}`} onClick={() => setSelection(null)}>
            <MapPin size={15} aria-hidden="true" />
            <span className="arb-noeud__nom">{t('Sans lieu')}</span>
            <span className="arb-noeud__n">{arbre?.sansLieu ?? 0}</span>
          </button>
        </div>

        {/* ── Détail du lieu choisi ── */}
        <section className="arb-detail">
          <header className="arb-detail__entete">
            <div>
              {chemin.length > 1 && (
                <nav className="arb-chemin" aria-label={t('Chemin')}>
                  {chemin.slice(0, -1).map((c) => (
                    <button key={c.id} type="button" onClick={() => setSelection(c.id)}>{c.nom}</button>
                  ))}
                </nav>
              )}
              <h2>
                {lieu ? <IconeLieu type={lieu.type} size={20} /> : <MapPin size={20} />}
                {lieu ? lieu.nom : t('Équipements sans lieu')}
                {lieu && <span className="arb-type">{t(TYPES_LIEU[lieu.type]?.label || lieu.type)}{lieu.code ? ` · ${lieu.code}` : ''}</span>}
              </h2>
            </div>
            {lieu && (
              <div className="arb-actions">
                <button type="button" className="eq-bouton" onClick={() => setFormLieu({ type: TYPE_ENFANT[lieu.type], nom: '', code: '', parentId: lieu.id, parentNom: lieu.nom })}>
                  <Plus size={16} /> {t('Sous-lieu')}
                </button>
                <button type="button" className="arb-icone" title={t('Modifier')}
                  onClick={() => setFormLieu({ id: lieu.id, type: lieu.type, nom: lieu.nom, code: lieu.code || '', serviceId: lieu.serviceId ?? '', parentId: lieu.parentId })}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="arb-icone" title={t('Déplacer')} onClick={() => setDeplacement({ type: 'lieu', ids: [lieu.id] })}>
                  <FolderInput size={16} />
                </button>
                <button type="button" className="arb-icone arb-icone--danger" title={t('Désactiver')} onClick={() => setADesactiver(lieu)}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </header>

          {lieu && (
            <dl className="arb-stats">
              <div><dt>{t('Équipements')}</dt><dd>{lieu.nbEquipements}</dd></div>
              <div className={lieu.nbArretes ? 'is-alerte' : ''}><dt>{t('À l’arrêt')}</dt><dd>{lieu.nbArretes}</dd></div>
              <div><dt>{t('Bons ouverts')}</dt><dd>{lieu.bonsOuverts}</dd></div>
              <div><dt>{t('Bons au total')}</dt><dd>{lieu.nbBons}</dd></div>
              <div><dt>{t('Coût des réparations')}</dt><dd>{montant(lieu.cout)}</dd></div>
            </dl>
          )}

          <div className="arb-eq-entete">
            {lieu && (
              <label className="arb-case">
                <input type="checkbox" checked={sousLieux} onChange={(e) => setSousLieux(e.target.checked)} />
                {t('Inclure les sous-lieux')}
              </label>
            )}
            <span className="arb-eq-n">{chargementEq ? t('Chargement…') : tp('équipement', equipements.length)}</span>
            {coches.size > 0 && (
              <>
                <button type="button" className="eq-bouton" onClick={() => setDeplacement({ type: 'equipements', ids: [...coches] })}>
                  <FolderInput size={16} /> {t('Déplacer ({n})', { n: coches.size })}
                </button>
                {lieu && (
                  <button type="button" className="eq-bouton eq-bouton--clair" title={t('Revenir au lieu par défaut (équipement principal ou service)')}
                    onClick={() => action(() => hierarchieService.affecter([...coches], null), t('Lieu par défaut rétabli.'))}>
                    <Unlink size={16} /> {t('Lieu par défaut')}
                  </button>
                )}
              </>
            )}
          </div>

          {!chargementEq && equipements.length === 0 && (
            <div className="eq-vide"><Stethoscope size={22} /><p>{t('Aucun équipement ici.')}</p></div>
          )}

          {equipements.length > 0 && (
            <table className="arb-table">
              <thead>
                <tr>
                  <th className="arb-col-case">
                    <input type="checkbox" checked={toutCoche} aria-label={t('Tout sélectionner')}
                      onChange={() => setCoches(toutCoche ? new Set() : new Set(equipements.map((e) => e.id)))} />
                  </th>
                  <th>{t('Équipement')}</th>
                  <th>{t('État')}</th>
                  <th>{t('Lieu')}</th>
                </tr>
              </thead>
              <tbody>
                {equipements.map((e) => {
                  const ids = coches.has(e.id) ? [...coches] : [e.id];
                  return (
                    <tr key={e.id} draggable onDragStart={(ev) => glisser(ev, { type: 'equipements', ids })} className={coches.has(e.id) ? 'is-coche' : ''}>
                      <td className="arb-col-case">
                        <input type="checkbox" checked={coches.has(e.id)} aria-label={t('Sélectionner {nom}', { nom: e.designation || `#${e.id}` })}
                          onChange={() => setCoches((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} />
                      </td>
                      <td>
                        <button type="button" className="arb-eq-nom" onClick={() => navigate(`/equipement/${e.id}`)}>
                          <strong>{e.designation || `#${e.id}`}</strong>
                          <span>{[e.marque, e.modele].filter(Boolean).join(' ') || '—'} · {e.numPiece || `#${e.id}`}</span>
                        </button>
                        <span className="arb-eq-tags">
                          {e.parentImmoId != null && <span className="arb-tag"><Link2 size={12} /> {t('Sous-ensemble')}</span>}
                          {e.nbSousEnsembles > 0 && <span className="arb-tag">{tp('sous-ensemble', e.nbSousEnsembles)}</span>}
                        </span>
                      </td>
                      <td><PastilleEtat etat={e.etatActuel} /></td>
                      <td className="arb-eq-lieu">
                        {e.lieuNom || '—'}
                        {e.lieuHerite && e.lieuId != null && <small>{e.parentImmoId != null ? t('via l’équipement principal') : t('via le service')}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="eq-astuce"><FolderInput size={16} /> {t('Glissez un lieu ou des équipements sur un lieu de l’arbre pour les déplacer.')}</p>
        </section>
      </div>

      <FormLieu ouvert={!!formLieu} initial={formLieu} services={services} occupe={occupe}
        onEnregistrer={enregistrerLieu} onFermer={() => setFormLieu(null)} />

      <ChoixLieu ouvert={!!deplacement} lieux={lieux} occupe={occupe}
        titre={deplacement?.type === 'lieu' ? t('Déplacer « {nom} » vers', { nom: parId.get(deplacement.ids[0])?.nom || '' }) : t('Déplacer vers')}
        exclus={deplacement?.type === 'lieu' ? new Set([deplacement.ids[0], ...descendantsDe(deplacement.ids[0], enfants)]) : new Set()}
        avecRacine libelleRacine={deplacement?.type === 'lieu' ? t('Racine (nouveau site)') : t('Lieu par défaut (équipement principal ou service)')}
        onChoisir={deplacer} onFermer={() => setDeplacement(null)} />

      <AjoutEquipements ouvert={ajout} lieu={lieu} occupe={occupe} onFermer={() => setAjout(false)}
        onAjouter={async (ids) => { if (await action(() => hierarchieService.affecter(ids, lieu.id), tp('équipement rangé', ids.length))) setAjout(false); }} />

      <ConfirmModal
        show={!!aDesactiver}
        onClose={() => setADesactiver(null)}
        onConfirm={async () => {
          const l = aDesactiver;
          setADesactiver(null);
          if (await action(() => hierarchieService.desactiverLieu(l.id), t('Lieu désactivé.'))) setSelection(l.parentId ?? null);
        }}
        type="danger"
        title={t('Désactiver le lieu')}
        message={t('Désactiver « {nom} » ? Il doit être vide (ni sous-lieu, ni équipement).', { nom: aDesactiver?.nom || '' })}
        confirmText={t('Désactiver')}
      />
    </div>
  );
}

/* ───────── Bloc « Position » de la fiche équipement ───────── */

export function PositionEquipement({ equipementId, peutModifier = true, onChange }) {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [lieux, setLieux] = useState([]);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [choixLieu, setChoixLieu] = useState(false);
  const [choixParent, setChoixParent] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState([]);

  const charger = useCallback(async () => {
    try {
      const p = await hierarchieService.position(equipementId);
      setPosition(p);
      onChange?.(p);
    } catch {
      setPosition(null);
    }
  }, [equipementId, onChange]);
  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!choixParent) return undefined;
    let actif = true;
    const m = setTimeout(() => {
      equipementService.rechercher(recherche.trim(), 0, 20)
        .then((r) => { if (actif) setResultats((r?.content ?? []).filter((e) => e.id !== equipementId)); })
        .catch(() => { if (actif) setResultats([]); });
    }, 250);
    return () => { actif = false; clearTimeout(m); };
  }, [recherche, choixParent, equipementId]);

  const ouvrirChoixLieu = async () => {
    try { setLieux((await hierarchieService.arbre()).lieux); setChoixLieu(true); } catch { setErreur(t("L'arborescence est injoignable pour le moment.")); }
  };
  const executer = async (fn) => {
    setOccupe(true);
    setErreur('');
    try { await fn(); await charger(); return true; } catch (err) { setErreur(messageErreur(err, t("L'action n'a pas pu être enregistrée."))); return false; } finally { setOccupe(false); }
  };

  if (!position) return null;
  return (
    <>
      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
      <dl className="eqf-lignes">
        <div className="eqf-ligne">
          <dt>{t('Lieu')}</dt>
          <dd>
            {position.chemin.length ? (
              <span className="arb-fil">
                {position.chemin.map((c, i) => (
                  <span key={c.id}>{i > 0 && <ChevronRight size={13} className="rtl-miroir" aria-hidden="true" />}{c.nom}</span>
                ))}
              </span>
            ) : '—'}
          </dd>
        </div>
        <div className="eqf-ligne">
          <dt>{t('Équipement principal')}</dt>
          <dd>
            {position.parent ? (
              <button type="button" className="arb-lien" onClick={() => navigate(`/equipement/${position.parent.id}`)}>
                {position.parent.designation} <PastilleEtat etat={position.parent.etatActuel} />
              </button>
            ) : '—'}
          </dd>
        </div>
        <div className="eqf-ligne">
          <dt>{t('Sous-ensembles')}</dt>
          <dd>
            {position.sousEnsembles.length ? (
              <span className="arb-sous">
                {position.sousEnsembles.map((s) => (
                  <button key={s.id} type="button" className="arb-lien" onClick={() => navigate(`/equipement/${s.id}`)}>
                    {s.designation} <PastilleEtat etat={s.etatActuel} />
                  </button>
                ))}
              </span>
            ) : '—'}
          </dd>
        </div>
      </dl>
      {position.degrade && <p className="arb-avis">{t('Dégradé : un sous-ensemble est en panne ou en réparation.')}</p>}
      {position.parentArrete && <p className="arb-avis">{t('Impacté : l’équipement principal est à l’arrêt.')}</p>}
      {peutModifier && (
        <div className="arb-pos-actions">
          <button type="button" className="eq-lien" onClick={ouvrirChoixLieu}><FolderInput size={14} /> {t('Changer de lieu')}</button>
          {position.parent ? (
            <button type="button" className="eq-lien" disabled={occupe} onClick={() => executer(() => hierarchieService.definirParent(equipementId, null))}>
              <Unlink size={14} /> {t('Détacher de l’équipement principal')}
            </button>
          ) : (
            <button type="button" className="eq-lien" onClick={() => { setRecherche(''); setChoixParent(true); }}>
              <Link2 size={14} /> {t('Rattacher à un équipement principal')}
            </button>
          )}
        </div>
      )}

      <ChoixLieu ouvert={choixLieu} lieux={lieux} occupe={occupe} titre={t('Déplacer vers')}
        avecRacine libelleRacine={t('Lieu par défaut (équipement principal ou service)')}
        onChoisir={async (cible) => { if (await executer(() => hierarchieService.affecter([equipementId], cible))) setChoixLieu(false); }}
        onFermer={() => setChoixLieu(false)} />

      <Modale ouvert={choixParent} onFermer={() => setChoixParent(false)} icone={Link2} taille="md" titre={t('Rattacher à un équipement principal')}
        pied={<button type="button" className="cm-btn" onClick={() => setChoixParent(false)}>{t('Annuler')}</button>}>
        <label className="arb-filtre">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} autoFocus
            placeholder={t('Désignation, marque, modèle, n° de pièce ou code-barre')} />
        </label>
        <ul className="arb-ajout">
          {resultats.map((e) => (
            <li key={e.id}>
              <button type="button" className="arb-ajout__choix" disabled={occupe}
                onClick={async () => { if (await executer(() => hierarchieService.definirParent(equipementId, e.id))) setChoixParent(false); }}>
                <span className="arb-ajout__nom">
                  <strong>{e.designation || `#${e.id}`}</strong>
                  <span>{[e.marque, e.modele].filter(Boolean).join(' ') || '—'} · {e.numPiece || e.codeBarre || `#${e.id}`}</span>
                </span>
                <PastilleEtat etat={e.etatActuel} />
              </button>
            </li>
          ))}
        </ul>
      </Modale>
    </>
  );
}
