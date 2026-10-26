import { useEffect, useMemo, useState } from 'react';
import { Cable, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import liaisonAgentService from '../../../services/liaisonAgentService';
import alerteMachineService from '../../../services/alerteMachineService';
import { t, locale } from '../../../i18n';

/*
 * « Liaison avec l'agent » de la fiche équipement : pour les machines SANS adresse IP.
 * L'agent de terrain relit ces réglages chaque minute (pas de redémarrage) et renvoie l'état de chaque liaison.
 */

export const TYPES_LIAISON = [
  { value: 'USB', label: 'USB (port COM)', aide: 'Câble USB : les messages de la machine sont lus ligne par ligne.' },
  { value: 'RS232', label: 'RS232 (port série)', aide: 'Câble série, souvent via un adaptateur USB-RS232.' },
  { value: 'BLUETOOTH', label: 'Bluetooth classique', aide: 'Appareil appairé : il apparaît comme un port COM.' },
  { value: 'RS485', label: 'RS485 – valeur Modbus', aide: 'L’agent lit une valeur (température, pression…) et la compare aux limites.' },
  { value: 'ALARMES', label: 'Alarmes Modbus', aide: 'L’agent lit les registres de défauts et traduit chaque défaut en message.' },
  { value: 'ZIGBEE', label: 'Capteur Zigbee', aide: 'Capteur sans fil (température, fuite, fumée…) via Zigbee2MQTT.' },
];
export const libelleType = (v) => TYPES_LIAISON.find((x) => x.value === v)?.label || v;

export const ETATS_LIAISON = {
  OK: { ton: 'ok', label: 'Lit correctement' },
  ALERTE: { ton: 'attention', label: 'Hors limites / défaut' },
  ERREUR: { ton: 'alerte', label: 'Erreur' },
  ABSENT: { ton: 'alerte', label: 'Introuvable' },
  ATTENTE: { ton: 'info', label: 'En attente' },
};

const VITESSES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
const SERIE = ['USB', 'RS232', 'BLUETOOTH', 'RS485', 'ALARMES'];

const vide = {
  type: 'RS485', agentNom: '', actif: true, libelle: '',
  port: '', baud: 9600, bitsDonnees: 8, parite: 'N', bitsStop: 1,
  mots: 'alarm, alarme, fault, défaut, erreur, error', niveau: 'ALERTE',
  esclave: 1, registre: 0, fonction: 3, nombre: 1, echelle: 1, signe: false, unite: '', min: '', max: '',
  transport: 'RTU', hote: '', portTcp: 502, mode: 'BITS', regles: [],
  zigbeeNom: '', batterieMin: 20, temperatureMax: '',
  intervalleSecondes: 10, echecsAvantAlerte: 3,
};

/* « alarm, défaut » ↔ (?i)(alarm|défaut) */
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const motsVersMotif = (mots) => {
  const l = String(mots || '').split(',').map((m) => m.trim()).filter(Boolean);
  return l.length ? `(?i)(${l.map(echapper).join('|')})` : '';
};
const motifVersMots = (motif) => {
  const m = /^\(\?i\)\((.*)\)$/.exec(motif || '');
  return m ? m[1].split('|').map((x) => x.replace(/\\(.)/g, '$1')).join(', ') : (motif || '');
};

const nombre = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

function dateHeure(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Résumé d'une ligne : « COM4 · 9600 bauds · appareil 1, registre 0 » */
export function resumeLiaison(l) {
  const parts = [];
  if (l.type === 'ZIGBEE') parts.push(l.zigbeeNom);
  else if (l.transport === 'TCP') parts.push(`${l.hote}:${l.portTcp ?? 502}`);
  else if (l.port) parts.push(`${l.port}${l.baud ? ` · ${l.baud} ${t('bauds')}` : ''}`);
  if (l.type === 'RS485' || l.type === 'ALARMES') parts.push(t('appareil {e}, registre {r}', { e: l.esclave ?? 1, r: l.registre ?? 0 }));
  if (l.type === 'RS485' && (l.min != null || l.max != null)) parts.push(`${l.min ?? '—'} … ${l.max ?? '—'} ${l.unite || ''}`.trim());
  return parts.filter(Boolean).join(' · ');
}

export default function EquipementLiaisonAgent({ equipementId, Bloc, Pastille }) {
  const [liaisons, setLiaisons] = useState([]);
  const [agents, setAgents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState(null); // null = pas d'édition
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);

  const charger = () => {
    setChargement(true);
    Promise.all([
      liaisonAgentService.parEquipement(equipementId).catch(() => []),
      alerteMachineService.agents().catch(() => []),
    ]).then(([l, a]) => { setLiaisons(l); setAgents(a); }).finally(() => setChargement(false));
  };
  useEffect(charger, [equipementId]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentChoisi = useMemo(() => agents.find((a) => a.nom === form?.agentNom), [agents, form?.agentNom]);
  const ports = agentChoisi?.portsSerie ?? [];

  const ouvrir = (l) => {
    setErreur('');
    if (!l) {
      setForm({ ...vide, agentNom: agents.length === 1 ? agents[0].nom : '' });
      return;
    }
    setForm({
      ...vide,
      ...Object.fromEntries(Object.entries(l).filter(([, v]) => v != null)),
      mots: l.motifAlerte ? motifVersMots(l.motifAlerte) : vide.mots,
      min: l.min ?? '', max: l.max ?? '', temperatureMax: l.temperatureMax ?? '',
      regles: (l.regles || []).map((r) => ({ ...r })),
    });
  };
  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));

  const enregistrer = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    const f = form;
    const corps = {
      id: f.id, type: f.type, agentNom: f.agentNom, actif: f.actif, libelle: f.libelle,
      port: f.port, baud: nombre(f.baud), bitsDonnees: nombre(f.bitsDonnees), parite: f.parite, bitsStop: nombre(f.bitsStop),
      motifAlerte: motsVersMotif(f.mots), niveau: f.niveau,
      esclave: nombre(f.esclave), registre: nombre(f.registre), fonction: nombre(f.fonction), nombre: nombre(f.nombre),
      echelle: nombre(f.echelle), signe: f.signe, unite: f.unite, min: nombre(f.min), max: nombre(f.max),
      transport: f.transport, hote: f.hote, portTcp: nombre(f.portTcp), mode: f.mode,
      regles: f.regles.filter((r) => r.index !== '' && r.index != null).map((r) => ({ index: Number(r.index), message: r.message, niveau: r.niveau || 'ALERTE' })),
      zigbeeNom: f.zigbeeNom, batterieMin: nombre(f.batterieMin), temperatureMax: nombre(f.temperatureMax),
      intervalleSecondes: nombre(f.intervalleSecondes), echecsAvantAlerte: nombre(f.echecsAvantAlerte),
    };
    try {
      await liaisonAgentService.enregistrer(equipementId, corps);
      setForm(null);
      charger();
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (l) => {
    try {
      await liaisonAgentService.supprimer(l.id);
      setASupprimer(null);
      charger();
    } catch {
      setErreur(t('Suppression impossible.'));
    }
  };

  const champ = (libelle, contenu, aide) => (
    <label>
      {libelle}
      {contenu}
      {aide && <small className="eq-lia-aide">{aide}</small>}
    </label>
  );

  const formulaire = form && (
    <form className="eq-doc-form eq-lia-form" onSubmit={enregistrer} noValidate>
      <div className="eq-cnx-ligne">
        {champ(`${t('Agent')} *`, agents.length > 0 ? (
          <select value={form.agentNom} onChange={(e) => maj('agentNom', e.target.value)}>
            <option value="">{t('— Choisir —')}</option>
            {agents.map((a) => <option key={a.id} value={a.nom}>{a.nom}{a.hote ? ` (${a.hote})` : ''}{a.etat === 'ARRETE' ? ` – ${t('arrêté')}` : ''}</option>)}
          </select>
        ) : (
          <input value={form.agentNom} onChange={(e) => maj('agentNom', e.target.value)} placeholder="agent-atelier-1" />
        ), agents.length === 0 ? t('Aucun agent relié pour l’instant : tapez son nom (agent.nom).') : null)}
        {champ(`${t('Type de liaison')} *`, (
          <select value={form.type} onChange={(e) => maj('type', e.target.value)}>
            {TYPES_LIAISON.map((x) => <option key={x.value} value={x.value}>{t(x.label)}</option>)}
          </select>
        ))}
      </div>
      <p className="eq-lia-explication">{t(TYPES_LIAISON.find((x) => x.value === form.type)?.aide || '')}</p>

      {(form.type === 'ALARMES' || form.type === 'RS485') && champ(t('Raccordement'), (
        <select value={form.transport} onChange={(e) => maj('transport', e.target.value)}>
          <option value="RTU">{t('Port série (RS485 / RS232)')}</option>
          <option value="TCP">{t('Réseau (Modbus TCP)')}</option>
        </select>
      ))}

      {SERIE.includes(form.type) && !((form.type === 'ALARMES' || form.type === 'RS485') && form.transport === 'TCP') && (
        <>
          {champ(`${t('Port COM')} *`, (
            <>
              <input value={form.port} onChange={(e) => maj('port', e.target.value)} placeholder="COM4" list="eq-lia-ports" />
              <datalist id="eq-lia-ports">
                {ports.map((p) => <option key={p.nom} value={p.nom}>{p.description}</option>)}
              </datalist>
            </>
          ), ports.length > 0
            ? t('Ports vus sur le PC de l’agent : {liste}', { liste: ports.map((p) => p.nom).join(', ') })
            : t('Les ports apparaîtront ici dès que l’agent aura envoyé son signal.'))}
          <div className="eq-lia-grille">
            {champ(t('Vitesse'), (
              <select value={form.baud} onChange={(e) => maj('baud', e.target.value)}>
                {VITESSES.map((v) => <option key={v} value={v}>{v} {t('bauds')}</option>)}
              </select>
            ))}
            {champ(t('Bits de données'), (
              <select value={form.bitsDonnees} onChange={(e) => maj('bitsDonnees', e.target.value)}>
                <option value={8}>8</option><option value={7}>7</option>
              </select>
            ))}
            {champ(t('Parité'), (
              <select value={form.parite} onChange={(e) => maj('parite', e.target.value)}>
                <option value="N">{t('Aucune')}</option><option value="E">{t('Paire')}</option><option value="O">{t('Impaire')}</option>
              </select>
            ))}
            {champ(t('Bits de stop'), (
              <select value={form.bitsStop} onChange={(e) => maj('bitsStop', e.target.value)}>
                <option value={1}>1</option><option value={2}>2</option>
              </select>
            ))}
          </div>
          <p className="eq-lia-astuce">{t('Ces réglages doivent être identiques à ceux de la machine (voir sa notice).')}</p>
        </>
      )}

      {(form.type === 'ALARMES' || form.type === 'RS485') && form.transport === 'TCP' && (
        <div className="eq-cnx-ligne">
          {champ(`${t('Adresse de l’appareil')} *`, <input value={form.hote} onChange={(e) => maj('hote', e.target.value)} placeholder="192.168.0.50" />)}
          {champ(t('Port TCP'), <input type="number" value={form.portTcp} onChange={(e) => maj('portTcp', e.target.value)} />)}
        </div>
      )}

      {['USB', 'RS232', 'BLUETOOTH'].includes(form.type) && (
        <div className="eq-cnx-ligne">
          {champ(t('Mots qui déclenchent une alerte'), (
            <input value={form.mots} onChange={(e) => maj('mots', e.target.value)} placeholder="alarm, défaut, erreur" />
          ), t('Séparés par des virgules ; majuscules et minuscules indifférentes.'))}
          {champ(t('Niveau'), (
            <select value={form.niveau} onChange={(e) => maj('niveau', e.target.value)}>
              <option value="CRITIQUE">{t('Critique')}</option><option value="ALERTE">{t('Alerte')}</option><option value="INFO">{t('Information')}</option>
            </select>
          ))}
        </div>
      )}

      {(form.type === 'RS485' || form.type === 'ALARMES') && (
        <div className="eq-lia-grille">
          {champ(t('Adresse Modbus'), <input type="number" min="0" max="255" value={form.esclave} onChange={(e) => maj('esclave', e.target.value)} />)}
          {champ(t('Registre'), <input type="number" min="0" value={form.registre} onChange={(e) => maj('registre', e.target.value)} />, t('À partir de 0'))}
          {champ(t('Fonction'), (
            <select value={form.fonction} onChange={(e) => maj('fonction', e.target.value)}>
              <option value={3}>{t('3 – maintien')}</option><option value={4}>{t('4 – entrée')}</option>
            </select>
          ))}
          {form.type === 'ALARMES'
            ? champ(t('Nombre de registres'), <input type="number" min="1" max="100" value={form.nombre} onChange={(e) => maj('nombre', e.target.value)} />)
            : champ(t('Échelle'), <input type="number" step="any" value={form.echelle} onChange={(e) => maj('echelle', e.target.value)} />, t('253 × 0,1 = 25,3'))}
        </div>
      )}

      {form.type === 'RS485' && (
        <>
          <div className="eq-lia-grille">
            {champ(t('Unité'), <input value={form.unite} onChange={(e) => maj('unite', e.target.value)} placeholder="°C" />)}
            {champ(t('Minimum'), <input type="number" step="any" value={form.min} onChange={(e) => maj('min', e.target.value)} placeholder={t('aucun')} />)}
            {champ(t('Maximum'), <input type="number" step="any" value={form.max} onChange={(e) => maj('max', e.target.value)} placeholder={t('aucun')} />)}
            {champ(t('Lecture toutes les'), <input type="number" min="1" value={form.intervalleSecondes} onChange={(e) => maj('intervalleSecondes', e.target.value)} />, t('secondes'))}
          </div>
          <label className="eq-cnx-case">
            <input type="checkbox" checked={!!form.signe} onChange={(e) => maj('signe', e.target.checked)} />
            {t('Valeur signée (températures négatives)')}
          </label>
        </>
      )}

      {form.type === 'ALARMES' && (
        <div className="eq-lia-regles">
          {champ(t('Le registre contient'), (
            <select value={form.mode} onChange={(e) => maj('mode', e.target.value)}>
              <option value="BITS">{t('un bit par alarme')}</option>
              <option value="CODE">{t('un code de défaut (0 = aucun)')}</option>
            </select>
          ))}
          <span className="eq-lia-regles-titre">{t('Tableau de la notice')}</span>
          {form.mode === 'BITS' && !form.regles.some((r) => r.index !== '' && r.index != null) && (
            <p className="eq-lia-attention">{t('En mode « un bit par alarme », seuls les bits listés ici déclenchent une alerte : ajoutez une ligne par bit (numéro et message).')}</p>
          )}
          {form.regles.map((r, i) => (
            <div key={i} className="eq-lia-regle">
              <input type="number" min="0" value={r.index} onChange={(e) => maj('regles', form.regles.map((x, j) => (j === i ? { ...x, index: e.target.value } : x)))}
                placeholder={form.mode === 'CODE' ? t('Code') : t('Bit')} aria-label={form.mode === 'CODE' ? t('Code') : t('Bit')} />
              <input value={r.message} onChange={(e) => maj('regles', form.regles.map((x, j) => (j === i ? { ...x, message: e.target.value } : x)))}
                placeholder={t('Message (ex. Surchauffe moteur)')} aria-label={t('Message')} />
              <select value={r.niveau || 'ALERTE'} onChange={(e) => maj('regles', form.regles.map((x, j) => (j === i ? { ...x, niveau: e.target.value } : x)))} aria-label={t('Niveau')}>
                <option value="CRITIQUE">{t('Critique')}</option><option value="ALERTE">{t('Alerte')}</option><option value="INFO">{t('Information')}</option>
              </select>
              <button type="button" className="eq-ico" onClick={() => maj('regles', form.regles.filter((_, j) => j !== i))} aria-label={t('Retirer')}><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="eq-lien" onClick={() => maj('regles', [...form.regles, { index: '', message: '', niveau: 'ALERTE' }])}>
            <Plus size={15} /> {t('Ajouter une ligne')}
          </button>
        </div>
      )}

      {form.type === 'ZIGBEE' && (
        <div className="eq-lia-grille">
          {champ(`${t('Nom dans Zigbee2MQTT')} *`, <input value={form.zigbeeNom} onChange={(e) => maj('zigbeeNom', e.target.value)} placeholder="capteur-chambre-froide" />, 'friendly_name')}
          {champ(t('Batterie minimum'), <input type="number" min="0" max="100" value={form.batterieMin} onChange={(e) => maj('batterieMin', e.target.value)} />, '%')}
          {champ(t('Température maximum'), <input type="number" step="any" value={form.temperatureMax} onChange={(e) => maj('temperatureMax', e.target.value)} placeholder={t('aucune')} />, '°C')}
        </div>
      )}

      {champ(t('Libellé'), <input value={form.libelle} onChange={(e) => maj('libelle', e.target.value)} placeholder={t('Ex. sonde température cuve')} />)}
      <label className="eq-cnx-case">
        <input type="checkbox" checked={form.actif !== false} onChange={(e) => maj('actif', e.target.checked)} />
        {t('Liaison active (lue par l’agent)')}
      </label>

      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
      <p className="eq-lia-astuce">{t('L’agent prend en compte la modification en moins d’une minute, sans redémarrage.')}</p>
      <div className="eq-doc-form-actions">
        <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => { setForm(null); setErreur(''); }}>{t('Annuler')}</button>
        <button type="submit" className="eq-bouton" disabled={envoi}>
          {envoi && <Loader2 size={16} className="eq-tourne" />} {t('Enregistrer')}
        </button>
      </div>
    </form>
  );

  return (
    <Bloc
      titre={t('Liaison avec l’agent')}
      icone={Cable}
      action={!form && !chargement && (
        <button type="button" className="eq-lien" onClick={() => ouvrir(null)}>
          <Plus size={15} /> {t('Ajouter')}
        </button>
      )}
    >
      {chargement ? (
        <p className="eq-vide-texte"><Loader2 size={15} className="eq-tourne" /> {t('Chargement…')}</p>
      ) : form ? formulaire : liaisons.length === 0 ? (
        <p className="eq-vide-texte">{t('Machine sans adresse IP ? Reliez-la à l’agent de terrain : USB, RS232, RS485, Modbus, capteur Zigbee ou Bluetooth.')}</p>
      ) : (
        <ul className="eq-lia-liste">
          {liaisons.map((l) => {
            const et = l.actif === false ? { ton: 'neutre', label: 'Désactivée' } : (ETATS_LIAISON[l.dernierEtat] || { ton: 'neutre', label: 'Pas encore lue' });
            return (
              <li key={l.id} className={`eq-ton--${et.ton}`}>
                <div className="eq-lia-tete">
                  <strong>{l.libelle || t(libelleType(l.type))}</strong>
                  <Pastille ton={et.ton}>{t(et.label)}</Pastille>
                </div>
                <span className="eq-lia-detail">{[l.libelle ? t(libelleType(l.type)) : null, resumeLiaison(l), t('agent {nom}', { nom: l.agentNom })].filter(Boolean).join(' · ')}</span>
                {(l.dernierMessage || l.derniereLecture) && (
                  <span className="eq-lia-etat">
                    {l.dernierMessage}{l.derniereLecture ? ` · ${dateHeure(l.derniereLecture)}` : ''}
                  </span>
                )}
                <div className="eq-lia-actions">
                  {aSupprimer === l.id ? (
                    <span className="eq-doc-confirmer">
                      <button type="button" className="eq-lien eq-lien--alerte" onClick={() => supprimer(l)}>{t('Supprimer')}</button>
                      <button type="button" className="eq-lien" onClick={() => setASupprimer(null)}>{t('Annuler')}</button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className="eq-lien" onClick={() => ouvrir(l)}><Pencil size={14} /> {t('Modifier')}</button>
                      <button type="button" className="eq-ico" onClick={() => setASupprimer(l.id)} aria-label={t('Supprimer la liaison')} title={t('Supprimer la liaison')}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {erreur && !form && <p className="eq-erreur" role="alert">{erreur}</p>}
    </Bloc>
  );
}
