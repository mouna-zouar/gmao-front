import { useEffect, useMemo, useState } from 'react';
import { Cable, ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import liaisonAgentService from '../../../services/liaisonAgentService';
import { t, locale } from '../../../i18n';
import { lireRequete } from '../../../store/referentiels';

export const TYPES_LIAISON = [
  { value: 'USB', label: 'USB (port COM)', aide: 'Câble USB : les messages de la machine sont lus ligne par ligne.' },
  { value: 'RS232', label: 'RS232 (port série)', aide: 'Câble série, souvent via un adaptateur USB-RS232.' },
  { value: 'BLUETOOTH', label: 'Bluetooth classique', aide: 'Appareil appairé : il apparaît comme un port COM.' },
  { value: 'RS485', label: 'RS485 – valeur Modbus', aide: 'L’agent lit une valeur (température, pression…) et la compare aux limites.' },
  { value: 'ALARMES', label: 'Alarmes Modbus', aide: 'L’agent lit les registres de défauts et traduit chaque défaut en message.' },
  { value: 'ZIGBEE', label: 'Capteur Zigbee', aide: 'Capteur sans fil (température, fuite, fumée…) via Zigbee2MQTT.' },
  { value: 'MQTT', label: 'MQTT (capteur IoT)' },
  { value: 'HL7', label: 'HL7 / MLLP (biomédical)' },
  { value: 'BACNET', label: 'BACnet/IP (GTB)' },
  { value: 'OPCUA', label: 'OPC UA (automate)' },
];
const RESEAU = ['MQTT', 'HL7', 'BACNET', 'OPCUA'];
const VALEURS = ['RS485', 'MQTT', 'BACNET', 'OPCUA'];
const PORTS_DEFAUT = { MQTT: 1883, HL7: 2575, BACNET: 47808, OPCUA: 4840 };
const OBJETS_BACNET = [
  [0, 'analog-input'], [1, 'analog-output'], [2, 'analog-value'],
  [3, 'binary-input'], [4, 'binary-output'], [5, 'binary-value'],
  [13, 'multi-state-input'], [14, 'multi-state-output'], [19, 'multi-state-value'],
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

const vide = {
  type: 'RS485', agentNom: '', actif: true, libelle: '',
  port: '', baud: 9600, bitsDonnees: 8, parite: 'N', bitsStop: 1,
  mots: 'alarm, alarme, fault, défaut, erreur, error', niveau: 'ALERTE',
  esclave: 1, registre: 0, fonction: 3, nombre: 1, echelle: 1, signe: false, unite: '', min: '', max: '',
  transport: 'RTU', hote: '', portTcp: 502, mode: 'BITS', regles: [],
  zigbeeNom: '', batterieMin: 20, temperatureMax: '',
  intervalleSecondes: 10, echecsAvantAlerte: 3,
  parametres: {},
};

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

export function resumeLiaison(l) {
  const parts = [];
  const p = l.parametres || {};
  if (l.type === 'ZIGBEE') parts.push(l.zigbeeNom);
  else if (l.type === 'MQTT') parts.push(`${l.hote ? `${l.hote}:${l.portTcp ?? 1883}` : t('broker de l’agent')} · ${p.topic || ''}`);
  else if (l.type === 'HL7') parts.push([`${t('port')} ${l.portTcp ?? 2575}`, l.hote, p.idAppareil].filter(Boolean).join(' · '));
  else if (l.type === 'BACNET') parts.push(`${l.hote}:${l.portTcp ?? 47808} · ${(OBJETS_BACNET.find(([v]) => v === p.objetType) || [null, p.objetType])[1]} ${p.objetInstance ?? ''}`);
  else if (l.type === 'OPCUA') parts.push(`${l.hote}:${l.portTcp ?? 4840} · ${p.noeud || ''}`);
  else if (l.transport === 'TCP') parts.push(`${l.hote}:${l.portTcp ?? 502}`);
  else if (l.port) parts.push(`${l.port}${l.baud ? ` · ${l.baud} ${t('bauds')}` : ''}`);
  if (l.type === 'RS485' || l.type === 'ALARMES') parts.push(t('appareil {e}, registre {r}', { e: l.esclave ?? 1, r: l.registre ?? 0 }));
  if (VALEURS.includes(l.type) && (l.min != null || l.max != null)) parts.push(`${l.min ?? '—'} … ${l.max ?? '—'} ${l.unite || ''}`.trim());
  return parts.filter(Boolean).join(' · ');
}

export default function EquipementLiaisonAgent({ equipementId, Bloc, Pastille }) {
  const [liaisons, setLiaisons] = useState([]);
  const [agents, setAgents] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [plus, setPlus] = useState(false);
  const [erreur, setErreur] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);

  const charger = () => {
    setChargement(true);
    Promise.all([
      liaisonAgentService.parEquipement(equipementId).catch(() => []),
      lireRequete('agentsMachines').catch(() => []),
    ]).then(([l, a]) => { setLiaisons(l); setAgents(a); }).finally(() => setChargement(false));
  };
  useEffect(charger, [equipementId]);

  const agentChoisi = useMemo(() => agents.find((a) => a.nom === form?.agentNom), [agents, form?.agentNom]);
  const ports = agentChoisi?.portsSerie ?? [];

  const ouvrir = (l) => {
    setErreur('');
    setPlus(false);
    if (!l) {
      setForm({ ...vide, agentNom: agents.length === 1 ? agents[0].nom : '' });
      return;
    }
    setForm({
      ...vide,
      ...Object.fromEntries(Object.entries(l).filter(([, v]) => v != null)),
      mots: l.motifAlerte ? motifVersMots(l.motifAlerte) : (l.type === 'MQTT' ? '' : vide.mots),
      min: l.min ?? '', max: l.max ?? '', temperatureMax: l.temperatureMax ?? '',
      regles: (l.regles || []).map((r) => ({ ...r })),
      parametres: { ...(l.parametres || {}), motDePasse: '' },
      portTcp: l.portTcp ?? PORTS_DEFAUT[l.type] ?? 502,
    });
  };
  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const majP = (champ, valeur) => setForm((f) => ({ ...f, parametres: { ...f.parametres, [champ]: valeur } }));
  const changerType = (type) => setForm((f) => ({
    ...f,
    type,
    portTcp: PORTS_DEFAUT[type] ?? (PORTS_DEFAUT[f.type] ? 502 : f.portTcp),
    hote: RESEAU.includes(type) === RESEAU.includes(f.type) ? f.hote : '',
    mots: type === 'MQTT' && f.mots === vide.mots ? '' : (type !== 'MQTT' && !f.mots ? vide.mots : f.mots),
  }));

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
      parametres: RESEAU.includes(f.type) ? f.parametres : null,
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

  const champ = (libelle, contenu) => (
    <label>
      {libelle}
      {contenu}
    </label>
  );

  const niveauSelect = (
    <select value={form?.niveau} onChange={(e) => maj('niveau', e.target.value)}>
      <option value="CRITIQUE">{t('Critique')}</option><option value="ALERTE">{t('Alerte')}</option><option value="INFO">{t('Information')}</option>
    </select>
  );
  const entree = (cle, props = {}) => <input value={form?.[cle] ?? ''} onChange={(e) => maj(cle, e.target.value)} {...props} />;
  const entreeP = (cle, props = {}) => <input value={form?.parametres?.[cle] ?? ''} onChange={(e) => majP(cle, e.target.value)} {...props} />;
  const champsLimites = () => (
    <>
      {champ(t('Minimum'), entree('min', { type: 'number', step: 'any', placeholder: t('aucun') }))}
      {champ(t('Maximum'), entree('max', { type: 'number', step: 'any', placeholder: t('aucun') }))}
      {champ(t('Unité'), entree('unite', { placeholder: '°C' }))}
    </>
  );
  const champsSerie = () => (
    <>
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
    </>
  );
  const champVitesse = () => champ(t('Vitesse'), (
    <select value={form.baud} onChange={(e) => maj('baud', e.target.value)}>
      {VITESSES.map((v) => <option key={v} value={v}>{v} {t('bauds')}</option>)}
    </select>
  ));
  const champPortCom = () => champ(`${t('Port COM')} *`, (
    <>
      {entree('port', { placeholder: 'COM4', list: 'eq-lia-ports' })}
      <datalist id="eq-lia-ports">
        {ports.map((p) => <option key={p.nom} value={p.nom}>{p.description}</option>)}
      </datalist>
    </>
  ));
  const champIntervalle = () => champ(t('Lecture toutes les (s)'), entree('intervalleSecondes', { type: 'number', min: 1 }));
  const champFonction = () => champ(t('Fonction'), (
    <select value={form.fonction} onChange={(e) => maj('fonction', e.target.value)}>
      <option value={3}>{t('3 – maintien')}</option><option value={4}>{t('4 – entrée')}</option>
    </select>
  ));
  const modbus = form && (form.type === 'RS485' || form.type === 'ALARMES');
  const modbusTcp = modbus && form.transport === 'TCP';

  const essentiels = () => {
    switch (form.type) {
      case 'USB': case 'RS232': case 'BLUETOOTH':
        return <div className="eq-lia-grille">{champPortCom()}{champVitesse()}</div>;
      case 'RS485': case 'ALARMES':
        return (
          <>
            <div className="eq-lia-grille">
              {champ(t('Raccordement'), (
                <select value={form.transport} onChange={(e) => maj('transport', e.target.value)}>
                  <option value="RTU">{t('Port série (RS485 / RS232)')}</option>
                  <option value="TCP">{t('Réseau (Modbus TCP)')}</option>
                </select>
              ))}
              {modbusTcp ? champ(`${t('Adresse de l’appareil')} *`, entree('hote', { placeholder: '192.168.0.50' })) : champPortCom()}
              {champ(t('Adresse Modbus'), entree('esclave', { type: 'number', min: 0, max: 255 }))}
              {champ(t('Registre'), entree('registre', { type: 'number', min: 0 }))}
            </div>
            {form.type === 'RS485' && <div className="eq-lia-grille">{champsLimites()}</div>}
          </>
        );
      case 'ZIGBEE':
        return (
          <div className="eq-lia-grille">
            {champ(`${t('Nom dans Zigbee2MQTT')} *`, entree('zigbeeNom', { placeholder: 'capteur-chambre-froide' }))}
            {champ(t('Température maximum (°C)'), entree('temperatureMax', { type: 'number', step: 'any', placeholder: t('aucune') }))}
          </div>
        );
      case 'MQTT':
        return (
          <>
            <div className="eq-lia-grille">
              {champ(`${t('Topic')} *`, entreeP('topic', { placeholder: 'hopital/bloc1/frigo' }))}
              {champ(t('Champ JSON'), entreeP('cheminJson', { placeholder: 'temperature' }))}
            </div>
            <div className="eq-lia-grille">{champsLimites()}</div>
          </>
        );
      case 'HL7':
        return (
          <div className="eq-lia-grille">
            {champ(t('Port d’écoute'), entree('portTcp', { type: 'number' }))}
            {champ(t('Identifiant de l’appareil'), entreeP('idAppareil', { placeholder: 'MSH-3 / MSH-4 / OBX-18' }))}
          </div>
        );
      case 'BACNET':
        return (
          <>
            <div className="eq-lia-grille">
              {champ(`${t('Adresse de l’appareil')} *`, entree('hote', { placeholder: '192.168.0.50' }))}
              {champ(`${t('Type d’objet')} *`, (
                <select value={form.parametres.objetType ?? 0} onChange={(e) => majP('objetType', Number(e.target.value))}>
                  {OBJETS_BACNET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              {champ(`${t('Instance')} *`, entreeP('objetInstance', { type: 'number', min: 0 }))}
            </div>
            <div className="eq-lia-grille">{champsLimites()}</div>
          </>
        );
      case 'OPCUA':
        return (
          <>
            <div className="eq-lia-grille">
              {champ(`${t('Adresse de l’appareil')} *`, entree('hote', { placeholder: '192.168.0.50' }))}
              {champ(`${t('Nœud')} *`, entreeP('noeud', { placeholder: 'ns=2;s=Temperature' }))}
            </div>
            <div className="eq-lia-grille">{champsLimites()}</div>
          </>
        );
      default:
        return null;
    }
  };

  const supplementaires = () => {
    switch (form.type) {
      case 'USB': case 'RS232': case 'BLUETOOTH':
        return (
          <>
            <div className="eq-lia-grille">{champsSerie()}</div>
            <div className="eq-lia-grille">
              {champ(t('Mots qui déclenchent une alerte'), entree('mots', { placeholder: 'alarm, défaut, erreur' }))}
              {champ(t('Niveau'), niveauSelect)}
            </div>
          </>
        );
      case 'RS485': case 'ALARMES':
        return (
          <>
            {modbusTcp
              ? <div className="eq-lia-grille">{champ(t('Port TCP'), entree('portTcp', { type: 'number' }))}{champFonction()}</div>
              : <div className="eq-lia-grille">{champVitesse()}{champsSerie()}</div>}
            <div className="eq-lia-grille">
              {!modbusTcp && champFonction()}
              {form.type === 'ALARMES'
                ? champ(t('Nombre de registres'), entree('nombre', { type: 'number', min: 1, max: 100 }))
                : champ(t('Échelle'), entree('echelle', { type: 'number', step: 'any' }))}
              {champIntervalle()}
            </div>
            {form.type === 'RS485' && (
              <label className="eq-cnx-case">
                <input type="checkbox" checked={!!form.signe} onChange={(e) => maj('signe', e.target.checked)} />
                {t('Valeur signée (températures négatives)')}
              </label>
            )}
          </>
        );
      case 'ZIGBEE':
        return <div className="eq-lia-grille">{champ(t('Batterie minimum (%)'), entree('batterieMin', { type: 'number', min: 0, max: 100 }))}</div>;
      case 'MQTT':
        return (
          <>
            <div className="eq-lia-grille">
              {champ(t('Broker'), entree('hote', { placeholder: t('broker de l’agent') }))}
              {champ(t('Port'), entree('portTcp', { type: 'number' }))}
            </div>
            {form.hote && (
              <div className="eq-lia-grille">
                {champ(t('Utilisateur'), entreeP('utilisateur', { autoComplete: 'off' }))}
                {champ(t('Mot de passe'), entreeP('motDePasse', { type: 'password', autoComplete: 'new-password', placeholder: form.parametres.motDePasseDefini ? '••••••' : '' }))}
              </div>
            )}
            <div className="eq-lia-grille">
              {champ(t('Mots qui déclenchent une alerte'), entree('mots', { placeholder: 'alarm, défaut' }))}
              {champ(t('Niveau'), niveauSelect)}
            </div>
            <div className="eq-lia-grille">
              {champ(t('Échelle'), entree('echelle', { type: 'number', step: 'any' }))}
              {champ(t('Silence maximum (min)'), entreeP('silenceMinutes', { type: 'number', min: 0, placeholder: t('aucun') }))}
            </div>
          </>
        );
      case 'HL7':
        return (
          <div className="eq-lia-grille">
            {champ(t('IP de l’expéditeur'), entree('hote', { placeholder: t('toutes') }))}
            {champ(t('Silence maximum (min)'), entreeP('silenceMinutes', { type: 'number', min: 0, placeholder: t('aucun') }))}
          </div>
        );
      case 'BACNET':
        return (
          <div className="eq-lia-grille">
            {champ(t('Port'), entree('portTcp', { type: 'number' }))}
            {champ(t('Propriété'), entreeP('propriete', { type: 'number', min: 0, placeholder: '85' }))}
            {champ(t('Échelle'), entree('echelle', { type: 'number', step: 'any' }))}
            {champIntervalle()}
          </div>
        );
      case 'OPCUA':
        return (
          <div className="eq-lia-grille">
            {champ(t('Port'), entree('portTcp', { type: 'number' }))}
            {champ(t('Chemin du serveur'), entreeP('chemin', { placeholder: '/' }))}
            {champ(t('Échelle'), entree('echelle', { type: 'number', step: 'any' }))}
            {champIntervalle()}
          </div>
        );
      default:
        return null;
    }
  };

  const formulaire = form && (
    <form className="eq-doc-form eq-lia-form" onSubmit={enregistrer} noValidate>
      <div className="eq-lia-grille">
        {champ(`${t('Agent')} *`, agents.length > 0 ? (
          <select value={form.agentNom} onChange={(e) => maj('agentNom', e.target.value)}>
            <option value="">{t('— Choisir —')}</option>
            {agents.map((a) => <option key={a.id} value={a.nom}>{a.nom}{a.hote ? ` (${a.hote})` : ''}{a.etat === 'ARRETE' ? ` – ${t('arrêté')}` : ''}</option>)}
          </select>
        ) : entree('agentNom', { placeholder: 'agent-atelier-1' }))}
        {champ(`${t('Type de liaison')} *`, (
          <select value={form.type} onChange={(e) => changerType(e.target.value)}>
            {TYPES_LIAISON.map((x) => <option key={x.value} value={x.value}>{t(x.label)}</option>)}
          </select>
        ))}
        {champ(t('Libellé'), entree('libelle', { placeholder: t('Ex. sonde température cuve') }))}
      </div>

      {essentiels()}

      {form.type === 'ALARMES' && (
        <div className="eq-lia-regles">
          <div className="eq-lia-grille">
            {champ(t('Le registre contient'), (
              <select value={form.mode} onChange={(e) => maj('mode', e.target.value)}>
                <option value="BITS">{t('un bit par alarme')}</option>
                <option value="CODE">{t('un code de défaut (0 = aucun)')}</option>
              </select>
            ))}
          </div>
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

      <button type="button" className="eq-lien eq-lia-plus" onClick={() => setPlus((v) => !v)} aria-expanded={plus}>
        {plus ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {plus ? t('Moins de réglages') : t('Plus de réglages')}
      </button>
      {plus && (
        <div className="eq-lia-supplement">
          {supplementaires()}
          <label className="eq-cnx-case">
            <input type="checkbox" checked={form.actif !== false} onChange={(e) => maj('actif', e.target.checked)} />
            {t('Liaison active (lue par l’agent)')}
          </label>
        </div>
      )}

      {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}
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
        <p className="eq-vide-texte">{t('Machine sans adresse IP ? Reliez-la à l’agent de terrain : USB, RS232, RS485, Modbus, Zigbee, Bluetooth, MQTT, HL7, BACnet ou OPC UA.')}</p>
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
