import { useEffect, useState } from 'react';
import { ListOrdered, Loader2 } from 'lucide-react';
import gammeService from '../../../services/gammeService';
import { Badge, Modale } from '../../commun';
import { TYPES_GAMME, cibleGamme, dureeLisible } from '../gammes/Gammes';
import { t, tp } from '../../../i18n';
import '../gammes/Gammes.css';

const CORRESPONDANCE = {
  MODELE: { label: 'Même modèle', ton: 'vert' },
  FAMILLE: { label: 'Même famille', ton: 'bleu' },
  GENERALE: { label: 'Générale', ton: 'gris' },
};

/* Fenêtre « Appliquer une gamme » : gammes validées qui conviennent à l'équipement du bon. */
export default function ChoixGamme({ ouvert, bonMaintenanceId, onFermer, onApplique }) {
  const [gammes, setGammes] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    let actif = true;
    setGammes(null);
    setErreur('');
    gammeService.proposees(bonMaintenanceId)
      .then((l) => { if (actif) setGammes(l); })
      .catch(() => { if (actif) { setGammes([]); setErreur(t('Les gammes sont injoignables pour le moment.')); } });
    return () => { actif = false; };
  }, [ouvert, bonMaintenanceId]);

  const appliquer = async (g) => {
    setEnvoi(g.id);
    setErreur('');
    try {
      const r = await gammeService.appliquer(bonMaintenanceId, g.id);
      onApplique?.(g, r?.taches ?? 0);
    } catch (err) {
      setErreur(err?.response?.data?.message || t("La gamme n'a pas pu être appliquée."));
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} icone={ListOrdered} taille="lg" titre={t('Appliquer une gamme')}
      pied={<button type="button" className="cm-btn" onClick={onFermer}>{t('Fermer')}</button>}>
      {erreur && <p className="gam-erreur" role="alert">{erreur}</p>}
      {gammes == null ? (
        <p className="gam-aucune"><Loader2 size={20} className="gam-tourne" /></p>
      ) : gammes.length === 0 ? (
        <p className="gam-aucune">{t('Aucune gamme validée pour cet équipement.')}</p>
      ) : (
        <ul className="gam-choix">
          {gammes.map((g) => (
            <li key={g.id}>
              <div className="gam-choix__tete">
                <strong>{g.code} · {g.libelle}</strong>
                <Badge ton={CORRESPONDANCE[g.correspondance]?.ton || 'gris'}>{t(CORRESPONDANCE[g.correspondance]?.label || '')}</Badge>
              </div>
              <span className="gam-choix__meta">
                {[t(TYPES_GAMME[g.type] || ''), cibleGamme(g), `v${g.version}`, tp('étape', g.etapes.length), dureeLisible(g.dureeTotaleMinutes)].filter(Boolean).join(' · ')}
              </span>
              <ol>
                {g.etapes.map((e) => (
                  <li key={e.ordre}>{e.designation}{e.dureeMinutes ? <small> · {dureeLisible(e.dureeMinutes)}</small> : null}{e.prestataireArticlesId ? <small> · {t('pièce')} ×{e.qte ?? 1}</small> : null}</li>
                ))}
              </ol>
              {g.outillage?.length > 0 && <span className="gam-choix__meta">{t('Outillage')} : {g.outillage.join(', ')}</span>}
              <button type="button" className="cm-btn cm-btn--principal gam-choix__btn" disabled={envoi != null} onClick={() => appliquer(g)}>
                {envoi === g.id ? <Loader2 size={14} className="gam-tourne" /> : <ListOrdered size={15} />} {t('Appliquer')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modale>
  );
}
