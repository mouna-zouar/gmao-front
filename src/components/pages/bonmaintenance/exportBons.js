import { prioriteLabel } from '../../../constants/Priorite';
import { t, locale } from '../../../i18n';
import { STATUTS } from '../../../constants/statuts';

const ETAT_LABELS = Object.fromEntries(Object.entries(STATUTS.bon).map(([k, v]) => [k, v.libelle]));

const NIVEAU_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

export function etatLabel(etat) { return etat == null ? '—' : ETAT_LABELS[etat] ?? t('État {n}', { n: etat }); }

export function niveauLabel(niveau) { return niveau == null ? '—' : NIVEAU_LABELS[niveau] ?? t('Niveau {n}', { n: niveau }); }

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const EXCEL_ALL_FIELDS = [
  { key: 'id',                          label: 'ID',                        extract: (b) => b.id ?? '' },
  { key: 'num',                         label: 'Numéro',                    extract: (b) => b.num || '' },
  { key: 'titre',                       label: 'Titre',                     extract: (b) => b.titre || '' },
  { key: 'description',                 label: 'Description',               extract: (b) => b.description || '' },

  { key: 'etat',                        label: 'État',                      extract: (b) => etatLabel(b.etat) },
  { key: 'urgence',                     label: 'Urgence',                   extract: (b) => niveauLabel(b.urgence) },
  { key: 'priorite',                    label: 'Priorité (code)',           extract: (b) => b.priorite ?? '' },
  { key: 'prioriteLabel',               label: 'Priorité (libellé)',        extract: (b) => prioriteLabel(b.priorite) },

  { key: 'date',                        label: 'Date',                      extract: (b) => formatDate(b.date) },
  { key: 'dateCreation',                label: 'Date de création',          extract: (b) => formatDate(b.dateCreation) },
  { key: 'dateDebut',                   label: 'Date de début',             extract: (b) => formatDate(b.dateDebut) },
  { key: 'dateFin',                     label: 'Date de fin',               extract: (b) => formatDate(b.dateFin) },
  { key: 'dateCloture',                 label: 'Date de clôture',           extract: (b) => formatDate(b.dateCloture) },

  { key: 'prestataireId',               label: 'Prestataire ID',            extract: (b) => b.prestataireId ?? b.prestataire?.id ?? '' },
  { key: 'prestataireNom',              label: 'Prestataire',               extract: (b) => b.prestataire?.raisonSociale || b.prestataire?.nom || '' },
  { key: 'prestataireCode',             label: 'Code prestataire',          extract: (b) => b.prestataire?.code || '' },

  { key: 'sousTraitantId',              label: 'Sous-traitant ID',          extract: (b) => b.sousTraitantId ?? '' },
  { key: 'sousTraitant',                label: 'Sous-traitant',             extract: (b) => b.sousTraitant || '' },

  { key: 'serviceId',                   label: 'Service ID',                extract: (b) => b.serviceId ?? b.service?.id ?? '' },
  { key: 'serviceNom',                  label: 'Service',                   extract: (b) => b.serviceNom || b.service?.description || b.service?.label || '' },

  { key: 'depotId',                     label: 'Dépôt ID',                  extract: (b) => b.depotId ?? b.depot?.id ?? '' },
  { key: 'depotNom',                    label: 'Dépôt',                     extract: (b) => b.depotNom || b.depot?.codeDepots || b.depot?.libelle || '' },

  { key: 'lotArticleImmobilistationId', label: 'Immobilisation ID',         extract: (b) => b.lotArticleImmobilistationId ?? '' },

  { key: 'personnelId',                 label: 'Personnel ID',              extract: (b) => b.personnelId ?? '' },
  { key: 'personnelNom',                label: 'Personnel',                 extract: (b) => b.personnelNom || (b.personnel ? `${b.personnel.nom || ''} ${b.personnel.prenom || ''}`.trim() : '') },

  { key: 'personnelCreationNom',        label: 'Créé par',                  extract: (b) => b.personnelCreationNom || '' },
  { key: 'personnelModificationNom',    label: 'Modifié par',               extract: (b) => b.personnelModificationNom || '' },

  { key: 'motifSuspension',             label: 'Motif suspension',          extract: (b) => b.motifSuspension || '' },
  { key: 'observations',                label: 'Observations',              extract: (b) => b.observations || '' },
  { key: 'commentaire',                 label: 'Commentaire',               extract: (b) => b.commentaire || '' },

  { key: 'slaReponse',                  label: 'SLA réponse',               extract: (b) => b.sla?.statutReponse || '' },
  { key: 'slaResolution',               label: 'SLA résolution',            extract: (b) => b.sla?.statutResolution || '' },
  { key: 'coutTotal',                   label: 'Coût total',                extract: (b) => b.cout?.coutTotal ?? '' },
];

export const EXCEL_COLUMNS_OPTIONS = EXCEL_ALL_FIELDS.map(({ key, label }) => ({ key, label }));

export function collectDynamicFields(bons) {
  const knownKeys = new Set(EXCEL_ALL_FIELDS.map((f) => f.key));
  const skipKeys = new Set([
    'prestataire', 'service', 'depot', 'clinique', 'cliniqueId', 'cliniqueNom', 'personnel',
    'sla', 'cout', 'rcaAnalyses', 'commentaires', 'intervenants',
    'taches', 'diagnostics', 'controles', 'remisesEnService',
    'documents', 'historique', 'reclamations', 'pieces', 'lignes',
  ]);

  const dynamicKeys = new Set();

  bons.forEach((b) => {
    Object.keys(b || {}).forEach((k) => {
      if (knownKeys.has(k) || skipKeys.has(k)) return;
      const v = b[k];
      if (v === null || v === undefined) return;
      if (typeof v === 'object') return;
      dynamicKeys.add(k);
    });
  });

  return Array.from(dynamicKeys).map((k) => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    extract: (b) => {
      const v = b[k];
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? t("Oui") : t("Non");
      return String(v);
    },
  }));
}
