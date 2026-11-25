import { useState } from 'react';
import { ArrowLeft, FileText, User, Calendar, ChevronRight, Users, ClipboardList, Check, Tag } from 'lucide-react';
import { formatDateTime, formatDate, formatMontant } from './BmdCommun';
import { t } from '../../../i18n';

function formatDureeHeures(heures) {
  if (heures === null || heures === undefined) return '—';
  if (heures < 48) return t('{n} h', { n: heures.toFixed(1) });
  return t('{n} j', { n: (heures / 24).toFixed(1) });
}

const ETAPES_REPARATION = [
  { key: 'intervenants', label: 'Intervenants', aide: 'Qui répare', icon: Users },
  { key: 'taches', label: 'Tâches', aide: 'Les travaux à faire', icon: ClipboardList },
];

export function ReparationEtapes({ intervenants, taches }) {
  const [etape, setEtape] = useState(0);
  const contenus = [intervenants, taches];
  return (
    <div className="bmx-rep">
      <ol className="bmx-rep-etapes" role="tablist" aria-label={t('Étapes de la réparation')}>
        {ETAPES_REPARATION.map((e, i) => {
          const Icon = e.icon;
          const etat = i === etape ? 'is-actif' : i < etape ? 'is-passe' : '';
          return (
            <li key={e.key} className={`bmx-rep-etape ${etat}`}>
              <button type="button" role="tab" aria-selected={i === etape} onClick={() => setEtape(i)}>
                <span className="bmx-rep-num">{i < etape ? <Check size={14} /> : i + 1}</span>
                <span className="bmx-rep-texte">
                  <strong><Icon size={15} /> {t(e.label)}</strong>
                  <small>{t(e.aide)}</small>
                </span>
              </button>
              {i < ETAPES_REPARATION.length - 1 && <span className="bmx-rep-trait" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <div className="bmx-rep-contenu" role="tabpanel">{contenus[etape]}</div>
      <div className="bmx-rep-nav">
        {etape > 0 ? (
          <button type="button" className="bmz-btn" onClick={() => setEtape(etape - 1)}>
            <ArrowLeft size={15} /> {t('Étape précédente : {e}', { e: t(ETAPES_REPARATION[etape - 1].label) })}
          </button>
        ) : <span />}
        {etape < ETAPES_REPARATION.length - 1 && (
          <button type="button" className="bmz-btn bmz-btn--plein" onClick={() => setEtape(etape + 1)}>
            {t('Étape suivante : {e}', { e: t(ETAPES_REPARATION[etape + 1].label) })} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export function PanneauDelais({ sla }) {
  if (!sla || (sla.statutReponse === 'NON_APPLICABLE' && sla.statutResolution === 'NON_APPLICABLE')) {
    return (
      <p className="bmx-vide">
        {t("Aucun délai n'est fixé pour ce bon. Les délais apparaissent quand la priorité est calculée.")}
      </p>
    );
  }
  const lignes = [
    {
      titre: t("Premier passage"),
      aide: t("Temps pour qu’un technicien commence"),
      statut: sla.statutReponse,
      cible: sla.delaiReponseCibleHeures,
      reel: sla.delaiReponseReelHeures,
      echeance: sla.echeanceReponse,
    },
    {
      titre: t("Réparation complète"),
      aide: t("Temps pour rendre l’équipement"),
      statut: sla.statutResolution,
      cible: sla.delaiResolutionCibleHeures,
      reel: sla.delaiResolutionReelHeures,
      echeance: sla.echeanceResolution,
    },
  ];
  const tonStatut = { RESPECTE: 'ok', EN_COURS: 'attention', DEPASSE: 'alerte', NON_APPLICABLE: 'neutre' };
  const texteStatut = { RESPECTE: 'Dans les temps', EN_COURS: 'En cours', DEPASSE: 'En retard', NON_APPLICABLE: 'Sans délai' };

  return (
    <div className="bmx-delais">
      {lignes.map((l) => {
        const ratio = l.cible && l.reel != null ? Math.min(l.reel / l.cible, 1.3) : null;
        return (
          <div key={l.titre} className="bmx-delai">
            <div className="bmx-delai-haut">
              <div>
                <h3>{t(l.titre)}</h3>
                <p>{t(l.aide)}</p>
              </div>
              <span className={`bmx-pastille bmx-ton--${tonStatut[l.statut] || 'neutre'}`}>
                {texteStatut[l.statut] || l.statut}
              </span>
            </div>
            {ratio != null && (
              <div className="bmx-jauge" aria-hidden="true">
                <span style={{ width: `${(ratio / 1.3) * 100}%` }} className={ratio > 1 ? 'is-depasse' : ''} />
                <i style={{ left: `${(1 / 1.3) * 100}%` }} />
              </div>
            )}
            <p className="bmx-delai-chiffres">
              {t("Objectif :")} {formatDureeHeures(l.cible)}
              {l.reel != null ? t('. Réel : {duree}.', { duree: formatDureeHeures(l.reel) }) : '.'}
              {l.reel == null && l.echeance ? ' ' + t('À faire avant le {date}', { date: formatDateTime(l.echeance) }) + '.' : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PanneauCout({ cout }) {
  if (!cout) {
    return <p className="bmx-vide">{t("Aucun coût enregistré pour l'instant. Il se calcule avec les intervenants, les pièces et les achats.")}</p>;
  }
  const total = Number(cout.coutTotal) || 0;
  const parts = [
    { label: t("Main d'œuvre"), valeur: Number(cout.coutMainOeuvre) || 0, classe: 'mo' },
    { label: t("Pièces du dépôt"), valeur: Number(cout.coutPiecesDepot) || 0, classe: 'pieces' },
    { label: t("Achats fournisseur"), valeur: Number(cout.coutAchats) || 0, classe: 'achats' },
  ];
  return (
    <div className="bmx-cout">
      <p className="bmx-cout-total">{formatMontant(total)}</p>
      <p className="bmx-cout-sous">{t("Coût total de la réparation")}</p>
      {total > 0 && (
        <div className="bmx-cout-barre" aria-hidden="true">
          {parts.map((p) => (
            <span key={p.classe} className={`is-${p.classe}`} style={{ width: `${(p.valeur / total) * 100}%` }} />
          ))}
        </div>
      )}
      <ul className="bmx-cout-liste">
        {parts.map((p) => (
          <li key={p.classe}>
            <span className={`bmx-cout-puce is-${p.classe}`} />
            <span>{t(p.label)}</span>
            <strong>{formatMontant(p.valeur)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TON_REPONSE = { Oui: 'oui', Non: 'non', 'Sans objet': 'na' };

export function InfosReclamation({ reclamation: r }) {
  const verifs = Array.isArray(r.checklist) ? r.checklist.filter((c) => c && c.question) : [];
  const lignes = [
    { icon: FileText, label: t('Description'), valeur: r.description ? t(r.description) : '—' },
    { icon: Tag, label: t('Code panne'), valeur: r.codePanneCode ? `${r.codePanneCode} · ${t(r.codePanneLibelle || '')}` : '—' },
    { icon: User, label: t('Signalée par'), valeur: r.personnelCreationNom || '—' },
    { icon: Calendar, label: t('Date'), valeur: r.date ? formatDate(r.date) : '—' },
  ];
  return (
    <div className="bmz-infos-bloc bmz-reclamation">
      <h3 className="bmz-sous-titre bmz-reclamation-num">{r.num || `#${r.id}`}</h3>
      <div className="bmz-info-groupe">
        <dl>
          {lignes.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.label}>
                <dt><Icon size={13} /> {i.label}</dt>
                <dd title={i.valeur}>{i.valeur}</dd>
              </div>
            );
          })}
        </dl>
      </div>
      {verifs.length > 0 && (
        <div className="bmz-info-groupe">
          <h4>{t('Vérifications')}</h4>
          <ul className="bmz-verifs">
            {verifs.map((c, i) => (
              <li key={`${i}-${c.question}`}>
                <span className="bmz-verif-q">{t(c.question)}</span>
                <span className={`bmz-verif-r bmz-verif-r--${TON_REPONSE[c.reponse] || 'na'}`}>{t(c.reponse || '—')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
