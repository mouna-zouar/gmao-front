import { useMemo } from 'react';
import { Hash } from 'lucide-react';
import ModaleFormulaire from '../../commun/ModaleFormulaire';
import { ICONES_CARTE, INDICATEURS, PAGES_LIEN } from './dispositionTableau';
import { t } from '../../../i18n';

const TONS = [
  { value: 'teal', label: 'Turquoise' }, { value: 'bleu', label: 'Bleu' }, { value: 'vert', label: 'Vert' },
  { value: 'ambre', label: 'Ambre' }, { value: 'orange', label: 'Orange' }, { value: 'rouge', label: 'Rouge' },
  { value: 'violet', label: 'Violet' }, { value: 'neutre', label: 'Gris' },
];

const avecPrecedent = (cle) => Boolean(INDICATEURS.find((i) => i.cle === cle)?.precedent);

export default function ModaleCarteChiffree({ ouvert, carte, onFermer, onEnregistrer }) {
  const champs = useMemo(() => [
    { nom: 'titre', label: 'Titre', type: 'texte', largeur: 'pleine', longueurMax: 60 },
    {
      nom: 'indicateur', label: 'Indicateur', type: 'recherche', requis: true, largeur: 'pleine', numerique: false,
      options: INDICATEURS.map((i) => ({ value: i.cle, label: i.label, groupe: i.groupe })),
      optionAide: (o) => o.groupe,
    },
    { nom: 'comparer', type: 'case', texteCase: 'Comparer à la période précédente', largeur: 'pleine', visible: (v) => avecPrecedent(v.indicateur) },
    { nom: 'ton', label: 'Couleur', type: 'liste', requis: true, defaut: 'teal', numerique: false, options: TONS, traduireOptions: true },
    {
      nom: 'icone', label: 'Icône', type: 'liste', requis: true, defaut: 'nombre', numerique: false, traduireOptions: true,
      options: Object.entries(ICONES_CARTE).map(([value, x]) => ({ value, label: x.label })),
    },
    { nom: 'lien', label: 'Page à ouvrir au clic', type: 'liste', largeur: 'pleine', numerique: false, optionVide: '— Aucune —', options: PAGES_LIEN, traduireOptions: true },
  ], []);

  const enregistrer = async (payload) => {
    const indicateur = INDICATEURS.find((i) => i.cle === payload.indicateur);
    onEnregistrer({
      ...(carte?.id ? { id: carte.id } : {}),
      titre: payload.titre || indicateur?.label || '',
      indicateur: payload.indicateur,
      comparer: Boolean(payload.comparer) && avecPrecedent(payload.indicateur),
      ton: payload.ton,
      icone: payload.icone,
      lien: payload.lien || null,
    });
  };

  return (
    <ModaleFormulaire
      ouvert={ouvert}
      onFermer={onFermer}
      icone={Hash}
      taille="md"
      titres={{ creation: t('Nouvelle carte chiffrée'), modification: t('Modifier la carte') }}
      surtitres={{ creation: t('Tableau de bord'), modification: t('Tableau de bord') }}
      champs={champs}
      sections={[{ cle: 'general', label: 'Carte' }]}
      objet={carte || null}
      onEnregistrer={enregistrer}
    />
  );
}
