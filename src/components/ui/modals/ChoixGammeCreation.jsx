import { useEffect, useState } from 'react';
import { ListOrdered, Loader2, X } from 'lucide-react';
import gammeService from '../../../services/gammeService';
import { dureeLisible } from '../../pages/gammes/Gammes';
import { t, tp } from '../../../i18n';
import '../../pages/gammes/Gammes.css';

export function etapesEnTaches(gamme) {
  return (gamme?.etapes ?? []).map((e, i) => ({
    _id: Date.now() + Math.random() + i,
    _gamme: true,
    designation: e.designation || '',
    nom: [e.precision, e.dureeMinutes ? `${e.dureeMinutes} min` : null].filter(Boolean).join(' · '),
    ordre: String(e.ordre ?? i + 1),
    dateDebut: '', dateFin: '',
    prestataireArticlesId: e.prestataireArticlesId != null ? String(e.prestataireArticlesId) : '',
    qte: e.prestataireArticlesId != null ? String(e.qte ?? 1) : '',
    sousTraitantId: '',
  }));
}

export default function ChoixGammeCreation({ equipementId, gammeId, onAppliquer, onRetirer }) {
  const [gammes, setGammes] = useState(null);
  const [choix, setChoix] = useState('');

  useEffect(() => {
    let actif = true;
    setGammes(null);
    gammeService.proposeesPourEquipement(equipementId || null)
      .then((l) => { if (actif) setGammes(l); })
      .catch(() => { if (actif) setGammes([]); });
    return () => { actif = false; };
  }, [equipementId]);

  const appliquee = gammeId ? (gammes ?? []).find((g) => String(g.id) === String(gammeId)) : null;

  if (gammeId) {
    return (
      <div className="gam-creation gam-creation--appliquee">
        <ListOrdered size={16} aria-hidden="true" />
        <span>{t('Gamme')} : <strong>{appliquee ? `${appliquee.code} v${appliquee.version} · ${appliquee.libelle}` : `#${gammeId}`}</strong></span>
        <button type="button" className="gam-creation__retirer" onClick={onRetirer}>
          <X size={14} /> {t('Retirer la gamme et ses tâches')}
        </button>
      </div>
    );
  }
  if (gammes != null && gammes.length === 0) return null;
  return (
    <div className="gam-creation">
      <label>
        <span>{t('Gamme')}</span>
        <select value={choix} onChange={(e) => setChoix(e.target.value)} disabled={gammes == null}>
          <option value="">{gammes == null ? t('Chargement…') : t('— Choisir une gamme —')}</option>
          {(gammes ?? []).map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.code} v{g.version} · {g.libelle} · {tp('étape', g.etapes?.length ?? 0)}{g.dureeTotaleMinutes ? ` · ${dureeLisible(g.dureeTotaleMinutes)}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="cm-btn cm-btn--principal" disabled={!choix}
        onClick={() => { const g = gammes.find((x) => String(x.id) === choix); if (g) { onAppliquer(g); setChoix(''); } }}>
        {gammes == null ? <Loader2 size={14} className="gam-tourne" /> : <ListOrdered size={15} />} {t('Appliquer')}
      </button>
    </div>
  );
}
