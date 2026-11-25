import { useEffect, useMemo, useState } from 'react';
import {
  Save,
  CheckCircle2,
  Undo2,
  Loader2,
  Plus,
  ClipboardCheck,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import parametreService from '../../../services/parametreService';
import reclamationService from '../../../services/Reclamationservice';
import { t } from '../../../i18n';
import { arbreFamilles, lignesArbre, basculerDansSet } from '../../../utils/arbreFamilles';
import { messageErreur } from './parametresCommun';

export function ChecklistsReclamationVue({ prestataireId }) {
  const [familles, setFamilles] = useState(null);
  const [ecrites, setEcrites] = useState(null);
  const [choix, setChoix] = useState('defaut');
  const [questions, setQuestions] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = () => {
    setErreur('');
    reclamationService.checklists()
      .then((l) => setEcrites(Object.fromEntries((l || []).map((c) => [String(c.famille), c]))))
      .catch(() => { setEcrites({}); setErreur(t('Impossible de charger les check-lists.')); });
  };
  useEffect(charger, []);
  useEffect(() => {
    let annule = false;
    parametreService.getFamillesCubix(prestataireId)
      .then((l) => { if (!annule) setFamilles(l.filter((f) => f.id != null)); })
      .catch(() => { if (!annule) setFamilles([]); });
    return () => { annule = true; };
  }, [prestataireId]);

  const questionFinale = ecrites?.defaut?.questionFinale;
  const propre = ecrites?.[choix];
  const nomFamille = choix === 'defaut' ? null : (familles || []).find((f) => String(f.id) === choix)?.nom || propre?.familleNom || null;

  useEffect(() => {
    if (!ecrites) return;
    setQuestions([...(ecrites[choix]?.questions ?? ecrites.defaut?.questions ?? [])]);
    setInfo('');
  }, [choix, ecrites]);

  const modifie = JSON.stringify(questions.map((q) => q.trim()).filter(Boolean))
    !== JSON.stringify(propre?.questions ?? ecrites?.defaut?.questions ?? []);

  const enregistrer = async (liste) => {
    setOccupe(true);
    setErreur('');
    try {
      await reclamationService.enregistrerChecklist(choix, nomFamille, liste.map((q) => q.trim()).filter(Boolean));
      setInfo(liste.length ? t('Check-list enregistrée.') : t('Cette famille reprend maintenant la check-list par défaut.'));
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const deplacer = (i, sens) => setQuestions((l) => {
    const n = [...l];
    const j = i + sens;
    if (j < 0 || j >= n.length) return l;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const arbre = useMemo(() => arbreFamilles(familles), [familles]);
  const [ouverts, setOuverts] = useState(() => new Set());
  const plier = basculerDansSet(setOuverts);
  const liste = lignesArbre(arbre, ouverts, filtre);
  const cliquerFamille = (f) => {
    if (!f.virtuel) setChoix(String(f.id));
    if (f.enfants.length > 0 && (f.virtuel || choix === String(f.id) || !ouverts.has(String(f.id)))) plier(f.id);
  };

  return (
    <div className="ps-mc">
      <h3 className="ps-carte-titre ps-mc-titre">
        <ClipboardCheck size={15} aria-hidden="true" /> {t('Check-lists des réclamations')}
      </h3>
      <p className="ps-mc-aide">
        {t('Avant d’envoyer une réclamation, le demandeur répond à ces vérifications (Oui / Non / Sans objet). Les questions dépendent de la famille de l’équipement ; une famille sans check-list reprend celle par défaut. La dernière question est toujours posée : si le problème a disparu, on lui propose de ne pas envoyer la réclamation.')}
      </p>
      {erreur && <p className="ps-cp-erreur" role="alert">{erreur}</p>}
      {ecrites === null ? (
        <p className="ps-mc-vide"><Loader2 size={15} className="ps-tourne" /> {t('Chargement…')}</p>
      ) : (
        <div className="ps-ck">
          <div className="ps-ck-familles">
            <input className="ps-cp-input" type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)}
              placeholder={t('Rechercher une famille…')} aria-label={t('Rechercher une famille…')} />
            <ul>
              <li>
                <button type="button" className={`ps-ck-famille ${choix === 'defaut' ? 'is-actif' : ''}`} onClick={() => setChoix('defaut')}>
                  <strong>{t('Par défaut (toutes les familles)')}</strong>
                  <small>{t('{n} question(s)', { n: ecrites.defaut?.questions?.length ?? 0 })}</small>
                </button>
              </li>
              {familles === null && <li className="ps-mc-vide"><Loader2 size={14} className="ps-tourne" /></li>}
              {liste.map(({ noeud: f, niveau, ouvert }) => {
                const c = ecrites[String(f.id)];
                return (
                  <li key={f.id} className={niveau > 0 ? 'ps-ck-fils' : 'ps-ck-parent'} style={{ '--niveau': niveau }}>
                    <button type="button" className={`ps-ck-famille ${choix === String(f.id) ? 'is-actif' : ''}`}
                      onClick={() => cliquerFamille(f)} aria-expanded={f.enfants.length > 0 ? ouvert : undefined}>
                      <span className="ps-ck-famille-nom">
                        {f.enfants.length > 0
                          ? (ouvert ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />)
                          : niveau > 0 ? <span className="ps-ck-puce" aria-hidden="true" /> : null}
                        {f.nom || f.code || `#${f.id}`}
                      </span>
                      <small className={c ? 'is-propre' : ''}>
                        {f.virtuel
                          ? t('{n} sous-famille(s)', { n: f.enfants.length })
                          : c ? t('{n} question(s)', { n: c.questions.length }) : t('par défaut')}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="ps-ck-edition">
            <h4>
              {choix === 'defaut' ? t('Check-list par défaut') : t('Famille {nom}', { nom: nomFamille || `#${choix}` })}
              {choix !== 'defaut' && !propre && <small>{t('Utilise la check-list par défaut : modifiez-la ci-dessous pour en faire une propre à cette famille.')}</small>}
            </h4>
            <ol className="ps-ck-questions">
              {questions.map((q, i) => (
                <li key={i}>
                  <input className="ps-cp-input" value={q} maxLength={250} aria-label={t('Question {n}', { n: i + 1 })}
                    onChange={(e) => setQuestions((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
                  <button type="button" className="ps-icone-btn" onClick={() => deplacer(i, -1)} disabled={i === 0} title={t('Monter')} aria-label={t('Monter')}><ArrowUp size={14} /></button>
                  <button type="button" className="ps-icone-btn" onClick={() => deplacer(i, 1)} disabled={i === questions.length - 1} title={t('Descendre')} aria-label={t('Descendre')}><ArrowDown size={14} /></button>
                  <button type="button" className="ps-icone-btn" onClick={() => setQuestions((l) => l.filter((_, k) => k !== i))} title={t('Supprimer')} aria-label={t('Supprimer')}><Trash2 size={14} /></button>
                </li>
              ))}
              {questionFinale && (
                <li className="ps-ck-finale">
                  <span>{questionFinale}</span>
                  <small>{t('toujours posée en dernier')}</small>
                </li>
              )}
            </ol>
            <div className="ps-cp-barre">
              <button type="button" className="ps-action" onClick={() => setQuestions((l) => [...l, ''])} disabled={questions.length >= 30}>
                <Plus size={14} /> {t('Ajouter une question')}
              </button>
              <button type="button" className="ps-btn ps-btn--primary" disabled={occupe || !modifie || !questions.some((q) => q.trim())} onClick={() => enregistrer(questions)}>
                {occupe ? <Loader2 size={15} className="ps-tourne" /> : <Save size={15} />} {t('Enregistrer')}
              </button>
              {choix !== 'defaut' && propre && (
                <button type="button" className="ps-action" disabled={occupe} onClick={() => enregistrer([])}>
                  <Undo2 size={14} /> {t('Revenir à la check-list par défaut')}
                </button>
              )}
              {info && <span className="ps-ck-info" role="status"><CheckCircle2 size={14} /> {info}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
