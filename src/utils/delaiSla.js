import { t } from '../i18n';

/*
 * Délai SLA d'un bon, à partir du SlaBonDTO renvoyé par /api/sla.
 * Tant que l'intervention n'a pas démarré, on suit le délai de RÉPONSE ;
 * ensuite, celui de RÉSOLUTION (jusqu'à la clôture).
 * Les seuils dépendent de la priorité, calculée automatiquement côté serveur.
 */

const HEURE = 3600 * 1000;

function duree(ms) {
  const h = Math.abs(ms) / HEURE;
  if (h < 1) return t('{n} min', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t('{n} h', { n: Math.round(h) });
  return t('{n} j', { n: Math.round(h / 24) });
}

/**
 * @returns {null | { phase: string, texte: string, ton: 'ok'|'proche'|'retard', echeance: number, titre: string }}
 */
export function delaiSla(sla, maintenant = Date.now()) {
  if (!sla || sla.statutResolution === 'NON_APPLICABLE') return null;

  if (sla.delaiResolutionReelHeures != null) {
    const reelMs = sla.delaiResolutionReelHeures * HEURE;
    const cibleMs = (sla.delaiResolutionCibleHeures ?? 0) * HEURE;
    const enRetard = sla.statutResolution === 'DEPASSE';
    return {
      phase: 'termine',
      ton: enRetard ? 'retard' : 'ok',
      echeance: Number.MAX_SAFE_INTEGER - 1,
      texte: enRetard
        ? t('Effectué en {d} · retard {r}', { d: duree(reelMs), r: duree(reelMs - cibleMs) })
        : t('Effectué en {d} · dans les délais', { d: duree(reelMs) }),
      titre: t('Délai de résolution : {n} h selon la priorité {p}', {
        n: sla.delaiResolutionCibleHeures ?? '—',
        p: sla.priorite ?? '—',
      }),
    };
  }

  const reponseFaite = sla.delaiReponseReelHeures != null;
  const phase = reponseFaite ? 'resolution' : 'reponse';
  const echeanceIso = reponseFaite ? sla.echeanceResolution : sla.echeanceReponse;
  const cibleH = reponseFaite ? sla.delaiResolutionCibleHeures : sla.delaiReponseCibleHeures;
  if (!echeanceIso) return null;

  const echeance = new Date(echeanceIso).getTime();
  const reste = echeance - maintenant;
  const libellePhase = phase === 'reponse' ? t('Réponse') : t('Résolution');

  let ton = 'ok';
  if (reste <= 0) ton = 'retard';
  else if (cibleH && reste < cibleH * HEURE * 0.25) ton = 'proche';

  const texte = reste <= 0
    ? t('{phase} · retard {d}', { phase: libellePhase, d: duree(reste) })
    : t('{phase} · {d} restantes', { phase: libellePhase, d: duree(reste) });

  const titre = t('Échéance {phase} : {date} (délai {n} h selon la priorité {p})', {
    phase: libellePhase.toLowerCase(),
    date: new Date(echeance).toLocaleString(),
    n: cibleH ?? '—',
    p: sla.priorite ?? '—',
  });

  return { phase, texte, ton, echeance, titre };
}
