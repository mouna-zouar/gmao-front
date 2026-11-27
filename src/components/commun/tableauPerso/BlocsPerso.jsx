import { useCallback, useRef, useState } from 'react';
import { GripVertical, Pencil, X } from 'lucide-react';
import { ICONES_CARTE, LIBELLE_LARGEUR, evolution, formater, lireChemin, variablesCouleur } from './outilsPerso';
import GalerieCartes from './GalerieCartes';
import ModaleCarteChiffree from './ModaleCarteChiffree';
import { Stat } from '../TableauBord';
import { t } from '../../../i18n';
import '../../pages/TableauDeBord/TableauDeBord.css';

/*
 * Blocs du tableau de bord personnalisable : déplacement avec emplacement fantôme,
 * redimensionnement (poignée ◢), galerie et modale « Créer une carte ».
 * ZonePerso assemble le tout pour une page : il suffit de lui passer le profil, la disposition
 * et le rendu de chaque carte.
 */

const FANTOME = '__fantome__';
const LARGEUR_PAR_SPAN = (span) => (span <= 2 ? 'tiers' : span === 3 ? 'moitie' : span === 4 ? 'deux-tiers' : 'pleine');
const ORDRE_LARGEURS = ['tiers', 'moitie', 'deux-tiers', 'pleine'];

function PoigneeRedim({ mode, valeur, refBloc, refGrille, onApercu, onValider }) {
  const calculer = (largeurVoulue, depart) => {
    if (mode === 'stat') {
      const normale = valeur === 'large' ? (depart - 10) / 2 : depart;
      return largeurVoulue >= normale * 1.5 ? 'large' : 'normal';
    }
    const grille = refGrille.current;
    const gap = 12;
    const colonne = ((grille?.clientWidth || 1200) - 5 * gap) / 6;
    const span = Math.max(1, Math.min(6, Math.round((largeurVoulue + gap) / (colonne + gap))));
    return LARGEUR_PAR_SPAN(span);
  };
  const debut = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const poignee = e.currentTarget;
    poignee.setPointerCapture?.(e.pointerId);
    const x0 = e.clientX;
    const depart = refBloc.current?.getBoundingClientRect().width || 0;
    let courante = valeur;
    onApercu(valeur);
    const bouger = (ev) => {
      const v = calculer(depart + (ev.clientX - x0) * (document.dir === 'rtl' ? -1 : 1), depart);
      if (v !== courante) { courante = v; onApercu(v); }
    };
    const fin = () => {
      poignee.removeEventListener('pointermove', bouger);
      poignee.removeEventListener('pointerup', fin);
      poignee.removeEventListener('pointercancel', fin);
      onApercu(null);
      if (courante !== valeur) onValider(courante);
    };
    poignee.addEventListener('pointermove', bouger);
    poignee.addEventListener('pointerup', fin);
    poignee.addEventListener('pointercancel', fin);
  };
  const clavier = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const plus = (e.key === 'ArrowRight') !== (document.dir === 'rtl');
    if (mode === 'stat') { onValider(plus ? 'large' : 'normal'); return; }
    const i = ORDRE_LARGEURS.indexOf(valeur);
    onValider(ORDRE_LARGEURS[Math.max(0, Math.min(ORDRE_LARGEURS.length - 1, i + (plus ? 1 : -1)))]);
  };
  return (
    <button type="button" className="tbd-poignee-taille" onPointerDown={debut} onKeyDown={clavier} draggable={false}
      onDragStart={(e) => e.preventDefault()} title={t('Tirer pour agrandir ou réduire')} aria-label={t('Changer la taille')}>
      <span aria-hidden="true" />
    </button>
  );
}

function Bloc({ id, index, large, edition, glisse, setGlisse, cache, setCache, setFantome, onRetirer, onModifier, onTaille, apercu, setApercu, children }) {
  const ref = useRef(null);
  const enRedim = apercu?.id === id;
  const effectif = enRedim ? apercu.valeur === 'large' : large;
  const classes = [
    'tbd-bloc', 'tbd-bloc--stat', effectif ? 'tbd-bloc--large' : '', edition ? 'is-edition' : '',
    cache === id ? 'is-cache' : '', glisse?.id === id ? 'is-glisse' : '', enRedim ? 'is-redim' : '',
  ].filter(Boolean).join(' ');
  const proprietes = edition ? {
    draggable: !enRedim,
    onDragStart: (e) => {
      if (e.target.closest?.('.tbd-poignee-taille')) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setGlisse({ source: 'stat', id, large });
      setTimeout(() => setCache(id), 0);
    },
    onDragEnd: () => setGlisse(null),
    onDragOver: (e) => {
      if (!glisse) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const apres = (e.clientX > r.left + r.width / 2) !== (document.dir === 'rtl');
      setFantome(index + (apres ? 1 : 0));
    },
    onClickCapture: (e) => { if (!e.target.closest('.tbd-outils, .tbd-poignee-taille')) { e.preventDefault(); e.stopPropagation(); } },
  } : {};
  return (
    <div ref={ref} className={classes} {...proprietes}>
      {edition && (
        <div className="tbd-outils">
          <span className="tbd-poignee" title={t('Glisser pour déplacer')}><GripVertical size={15} aria-hidden="true" /></span>
          {onModifier && (
            <button type="button" onClick={() => onModifier(id)} title={t('Modifier')} aria-label={t('Modifier')}><Pencil size={13} aria-hidden="true" /></button>
          )}
          <button type="button" onClick={() => onRetirer(id)} title={t('Retirer')} aria-label={t('Retirer')}><X size={14} aria-hidden="true" /></button>
        </div>
      )}
      {children}
      {edition && (
        <PoigneeRedim mode="stat" valeur={large ? 'large' : 'normal'} refBloc={ref}
          onApercu={(v) => setApercu(v ? { id, valeur: v } : null)} onValider={(v) => onTaille(id, v === 'large')} />
      )}
    </div>
  );
}

function BlocCarte({ id, largeur, edition, refGrille, apercu, setApercu, onLargeur, children }) {
  const ref = useRef(null);
  const enRedim = apercu?.id === id;
  const effective = enRedim ? apercu.valeur : largeur;
  return (
    <div ref={ref} className={`tbd-bloc tbd-l--${effective} ${edition ? 'is-edition is-fixe' : ''} ${enRedim ? 'is-redim' : ''}`}>
      {edition && enRedim && <span className="tbd-taille-etiquette">{LIBELLE_LARGEUR[effective]}</span>}
      {children}
      {edition && (
        <PoigneeRedim mode="carte" valeur={largeur} refBloc={ref} refGrille={refGrille}
          onApercu={(v) => setApercu(v ? { id, valeur: v } : null)} onValider={(v) => onLargeur(id, v)} />
      )}
    </div>
  );
}


/** Carte chiffrée créée par l'utilisateur (indicateur du catalogue, couleur, icône, comparaison). */
export function CartePerso({ carte: p, donnees, indicateurs, apercu = false }) {
  const def = indicateurs.find((i) => i.cle === p.indicateur);
  const evol = p.comparer && def?.precedent ? evolution(lireChemin(donnees, p.indicateur), lireChemin(donnees, def.precedent)) : null;
  const rendu = (
    <Stat lien={apercu ? undefined : (p.lien || undefined)} icone={ICONES_CARTE[p.icone]?.icone || ICONES_CARTE.nombre.icone}
      ton={p.couleur ? 'neutre' : (p.ton || 'teal')}
      valeur={p.indicateur ? formater(def?.format, lireChemin(donnees, p.indicateur)) : '—'} label={p.titre || t(def?.label || '')}
      sous={evol ? t('{e} vs période précédente', { e: evol }) : null} />
  );
  return p.couleur ? <div className="tbd-perso-couleur" style={variablesCouleur(p.couleur)}>{rendu}</div> : rendu;
}

/**
 * Zone personnalisable complète : rangée de cartes chiffrées + grille de grandes cartes,
 * galerie (mode Personnaliser) et modale de création.
 * statsRendus : { id: <Stat/> } pour les cartes d'origine ; cartesRendues : { id: <Carte/> | null }.
 */
export function ZonePerso({ profil, disposition, actions, edition, onTerminer, donnees, statsRendus, cartesRendues, surtitre }) {
  const [glisse, setGlisseBrut] = useState(null);
  const [cache, setCache] = useState(null);
  const [fantome, setFantome] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [modaleCarte, setModaleCarte] = useState(null);
  const refGrille = useRef(null);
  const setGlisse = useCallback((v) => {
    setGlisseBrut(v);
    if (!v) { setFantome(null); setCache(null); }
  }, []);

  const indicateurs = profil.indicateurs;
  const rendus = { ...statsRendus };
  disposition.persos.forEach((p) => { rendus[p.id] = <CartePerso carte={p} donnees={donnees} indicateurs={indicateurs} />; });
  const valeurIndicateur = (cle) => formater(indicateurs.find((i) => i.cle === cle)?.format, lireChemin(donnees, cle));
  const modifierPerso = (id) => setModaleCarte({ carte: disposition.persos.find((p) => p.id === id) });

  const statsVisibles = disposition.stats.filter((id) => id !== cache && rendus[id]);
  const statsAvecFantome = glisse && fantome != null
    ? [...statsVisibles.slice(0, fantome), FANTOME, ...statsVisibles.slice(fantome)]
    : statsVisibles;

  return (
    <>
      {edition && (
        <GalerieCartes stats={profil.stats} disposition={disposition} actions={actions} statsRendus={rendus} glisse={glisse} setGlisse={setGlisse}
          onCreer={() => setModaleCarte({ carte: null })} onModifier={modifierPerso} onTerminer={onTerminer} />
      )}

      <ModaleCarteChiffree indicateurs={indicateurs} surtitre={surtitre} ouvert={Boolean(modaleCarte)} carte={modaleCarte?.carte}
        onFermer={() => setModaleCarte(null)} onEnregistrer={actions.enregistrerPerso}
        rendreApercu={(p) => <CartePerso carte={p} donnees={donnees} indicateurs={indicateurs} apercu />} valeurIndicateur={valeurIndicateur} />

      <div
        className={`tb-stats tb-stats--compact ${glisse ? 'is-depot' : ''}`}
        onDragOver={(e) => {
          if (!glisse) return;
          e.preventDefault();
          if (e.target === e.currentTarget && fantome == null) setFantome(statsVisibles.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (glisse) actions.placerStat(glisse.id, fantome ?? statsVisibles.length);
          setGlisse(null);
        }}
      >
        {statsAvecFantome.map((id) => (id === FANTOME ? (
          <div key="fantome" className={`tbd-fantome ${glisse?.large ? 'tbd-bloc--large' : ''}`} onDragOver={(e) => e.preventDefault()} />
        ) : (
          <Bloc key={id} id={id} index={statsVisibles.indexOf(id)} edition={edition} glisse={glisse} setGlisse={setGlisse}
            cache={cache} setCache={setCache} setFantome={setFantome} apercu={apercu} setApercu={setApercu}
            onRetirer={actions.retirerStat} onTaille={actions.definirTailleStat}
            large={Boolean(disposition.tailles.stats[id])}
            onModifier={disposition.persos.some((p) => p.id === id) ? () => modifierPerso(id) : undefined}>
            {rendus[id]}
          </Bloc>
        )))}
      </div>

      <div className="tbd-grille" ref={refGrille}>
        {profil.cartes.map((c) => (cartesRendues[c.id] ? (
          <BlocCarte key={c.id} id={c.id} largeur={disposition.tailles.cartes[c.id] || c.largeur} edition={edition}
            refGrille={refGrille} apercu={apercu} setApercu={setApercu} onLargeur={actions.definirLargeur}>
            {cartesRendues[c.id]}
          </BlocCarte>
        ) : null))}
      </div>
    </>
  );
}
