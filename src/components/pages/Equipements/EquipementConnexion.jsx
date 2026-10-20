import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Loader2, Network, Pencil, Trash2, WifiOff } from 'lucide-react';
import equipementService from '../../../services/equipementService';
import alerteMachineService from '../../../services/alerteMachineService';
import { t, locale } from '../../../i18n';

/*
 * « Connexion réseau » de la fiche équipement : adresse IP, port et protocole,
 * avec un test immédiat « l'équipement répond-il ? ». Base de la surveillance des machines.
 */

const PROTOCOLES = [
  { value: 'PING', label: 'Ping (répond / ne répond pas)', port: '' },
  { value: 'TCP', label: 'Port TCP', port: '' },
  { value: 'HTTP', label: 'Page web (HTTP)', port: '80' },
  { value: 'SNMP', label: 'SNMP (onduleurs, réseau…)', port: '161' },
  { value: 'MODBUS', label: 'Modbus TCP (automates, groupes…)', port: '502' },
];
const libelleProtocole = (v) => PROTOCOLES.find((p) => p.value === v)?.label || v || '—';

const vide = { adresseIp: '', port: '', protocole: 'PING', surveillee: true, commentaire: '' };

function dateHeure(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EquipementConnexion({ equipementId, Bloc, Pastille }) {
  const [connexion, setConnexion] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState(vide);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [test, setTest] = useState(null); // { joignable, tempsMs, message }
  const [enTest, setEnTest] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [alertes, setAlertes] = useState([]);

  // Dernières alertes reçues de la machine (SNMP, Syslog) ou de la surveillance réseau
  useEffect(() => {
    let annule = false;
    alerteMachineService.parEquipement(equipementId)
      .then((l) => { if (!annule) setAlertes(l ?? []); })
      .catch(() => { if (!annule) setAlertes([]); });
    return () => { annule = true; };
  }, [equipementId, connexion?.horsLigneDepuis]);

  useEffect(() => {
    let annule = false;
    equipementService.getConnexion(equipementId)
      .then((c) => { if (!annule) setConnexion(c); })
      .catch(() => { if (!annule) setConnexion(null); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [equipementId]);

  const ouvrir = () => {
    setForm(connexion ? {
      adresseIp: connexion.adresseIp || '',
      port: connexion.port ?? '',
      protocole: connexion.protocole || 'PING',
      surveillee: connexion.surveillee !== false,
      commentaire: connexion.commentaire || '',
    } : vide);
    setErreur('');
    setTest(null);
    setEdition(true);
  };

  const maj = (champ, valeur) => {
    setForm((f) => {
      const suivant = { ...f, [champ]: valeur };
      // Choisir un protocole propose son port habituel (si le port n'a pas été saisi)
      if (champ === 'protocole') {
        const ancien = PROTOCOLES.find((p) => p.value === f.protocole)?.port || '';
        if (f.port === '' || String(f.port) === ancien) suivant.port = PROTOCOLES.find((p) => p.value === valeur)?.port || '';
      }
      return suivant;
    });
    setTest(null);
    setErreur('');
  };

  const versPayload = () => ({
    adresseIp: form.adresseIp.trim(),
    port: form.port === '' ? null : Number(form.port),
    protocole: form.protocole,
    surveillee: form.surveillee,
    commentaire: form.commentaire,
  });

  const tester = async (surSaisie) => {
    setEnTest(true);
    setErreur('');
    try {
      const r = await equipementService.testerConnexion(equipementId, surSaisie ? versPayload() : null);
      setTest(r);
      if (!surSaisie) setConnexion(await equipementService.getConnexion(equipementId));
    } catch (err) {
      setErreur(err?.response?.data?.message || t('Le test n’a pas pu être lancé.'));
    } finally {
      setEnTest(false);
    }
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!form.adresseIp.trim()) {
      setErreur(t("Indiquez l'adresse IP de l'équipement."));
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      const enregistree = await equipementService.enregistrerConnexion(equipementId, versPayload());
      setConnexion(enregistree);
      setEdition(false);
      setTest(null);
    } catch (err) {
      setErreur(err?.response?.data?.message || t("L'adresse n'a pas pu être enregistrée."));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    try {
      await equipementService.supprimerConnexion(equipementId);
      setConnexion(null);
      setConfirmerSuppression(false);
      setEdition(false);
    } catch {
      setErreur(t("L'adresse n'a pas pu être supprimée."));
    }
  };

  const resultatTest = test && (
    <p className={`eq-cnx-test ${test.joignable ? 'is-ok' : 'is-ko'}`} role="status">
      {test.joignable ? <CheckCircle2 size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span>
        <strong>{test.joignable ? t('Joignable') : t('Injoignable')}</strong>
        {test.joignable && test.tempsMs != null && ` · ${test.tempsMs} ms`}
        {' — '}{t(test.message)}
      </span>
    </p>
  );

  return (
    <Bloc
      titre={t('Connexion réseau')}
      icone={Network}
      action={!edition && !chargement && (
        <button type="button" className="eq-lien" onClick={ouvrir}>
          <Pencil size={15} /> {connexion ? t('Modifier') : t('Ajouter')}
        </button>
      )}
    >
      {chargement ? (
        <p className="eq-vide-texte"><Loader2 size={15} className="eq-tourne" /> {t('Chargement…')}</p>
      ) : edition ? (
        <form className="eq-doc-form" onSubmit={enregistrer} noValidate>
          <label>
            {t('Adresse IP')} *
            <input
              value={form.adresseIp}
              onChange={(e) => maj('adresseIp', e.target.value)}
              placeholder="192.168.0.132"
              inputMode="decimal"
              autoFocus
              aria-invalid={!!erreur}
            />
          </label>
          <div className="eq-cnx-ligne">
            <label>
              {t('Protocole')}
              <select value={form.protocole} onChange={(e) => maj('protocole', e.target.value)}>
                {PROTOCOLES.map((p) => <option key={p.value} value={p.value}>{t(p.label)}</option>)}
              </select>
            </label>
            <label>
              {t('Port')}
              <input type="number" min="1" max="65535" value={form.port} onChange={(e) => maj('port', e.target.value)} placeholder={t('Optionnel')} />
            </label>
          </div>
          <label>
            {t('Commentaire')}
            <input value={form.commentaire} onChange={(e) => maj('commentaire', e.target.value)} placeholder={t('Ex. prise réseau baie B, carte SNMP')} />
          </label>
          <label className="eq-cnx-case">
            <input type="checkbox" checked={form.surveillee} onChange={(e) => maj('surveillee', e.target.checked)} />
            {t('Surveiller cet équipement automatiquement')}
          </label>

          {resultatTest}
          {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}

          <div className="eq-doc-form-actions eq-cnx-actions">
            {connexion && (confirmerSuppression ? (
              <span className="eq-doc-confirmer">
                <button type="button" className="eq-lien eq-lien--alerte" onClick={supprimer}>{t('Supprimer')}</button>
                <button type="button" className="eq-lien" onClick={() => setConfirmerSuppression(false)}>{t('Annuler')}</button>
              </span>
            ) : (
              <button type="button" className="eq-ico" onClick={() => setConfirmerSuppression(true)} aria-label={t("Supprimer l'adresse")} title={t("Supprimer l'adresse")}>
                <Trash2 size={16} />
              </button>
            ))}
            <span className="eq-cnx-espace" />
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => tester(true)} disabled={enTest || !form.adresseIp.trim()}>
              {enTest ? <Loader2 size={16} className="eq-tourne" /> : <Activity size={16} />} {t('Tester')}
            </button>
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => { setEdition(false); setErreur(''); setTest(null); }}>{t('Annuler')}</button>
            <button type="submit" className="eq-bouton" disabled={envoi}>
              {envoi && <Loader2 size={16} className="eq-tourne" />} {t('Enregistrer')}
            </button>
          </div>
        </form>
      ) : !connexion ? (
        <p className="eq-vide-texte">{t('Aucune adresse IP : ajoutez-la pour que la GMAO puisse surveiller cet équipement.')}</p>
      ) : (
        <>
          <dl className="eq-identite">
            <div><dt>{t('Adresse IP')}</dt><dd className="eq-mono">{connexion.adresseIp}{connexion.port ? `:${connexion.port}` : ''}</dd></div>
            <div><dt>{t('Protocole')}</dt><dd>{t(libelleProtocole(connexion.protocole))}</dd></div>
            <div>
              <dt>{t('Surveillance')}</dt>
              <dd>
                {connexion.surveillee !== false ? t('Activée') : t('Désactivée')}
                {connexion.surveillee !== false && <span className="eq-cnx-date">{t('Testé automatiquement toutes les 5 minutes')}</span>}
              </dd>
            </div>
            {connexion.horsLigneDepuis && (
              <div>
                <dt>{t('Statut')}</dt>
                <dd><Pastille ton="alerte">{t('Hors ligne depuis le {date}', { date: dateHeure(connexion.horsLigneDepuis) })}</Pastille></dd>
              </div>
            )}
            <div>
              <dt>{t('Dernier test')}</dt>
              <dd>
                {connexion.dernierResultat ? (
                  <Pastille ton={connexion.dernierResultat === 'EN_LIGNE' ? 'ok' : 'alerte'}>
                    {connexion.dernierResultat === 'EN_LIGNE' ? t('En ligne') : t('Hors ligne')}
                    {connexion.dernierTempsMs != null && connexion.dernierResultat === 'EN_LIGNE' ? ` · ${connexion.dernierTempsMs} ms` : ''}
                  </Pastille>
                ) : t('Jamais testé')}
                {connexion.derniereVerification && <span className="eq-cnx-date">{dateHeure(connexion.derniereVerification)}</span>}
              </dd>
            </div>
            {connexion.commentaire && <div><dt>{t('Commentaire')}</dt><dd>{connexion.commentaire}</dd></div>}
          </dl>
          {resultatTest}
          {erreur && <p className="eq-erreur" role="alert">{erreur}</p>}

          <div className="eq-cnx-alertes">
            <h3>{t('Dernières alertes de la machine')}</h3>
            {alertes.length === 0 ? (
              <p className="eq-vide-texte">{t('Aucune alerte reçue de cette machine.')}</p>
            ) : (
              <ul>
                {alertes.slice(0, 5).map((a) => {
                  const ton = a.statut === 'RESOLUE' || a.statut === 'IGNOREE' ? 'neutre' : a.niveau === 'CRITIQUE' ? 'alerte' : a.niveau === 'ALERTE' ? 'attention' : 'info';
                  return (
                    <li key={a.id} className={`eq-ton--${ton}`}>
                      <span className="eq-cnx-alerte-texte">
                        <strong>{a.message}</strong>
                        <em>
                          {[a.source === 'SURVEILLANCE' ? t('Surveillance réseau') : a.source, dateHeure(a.derniereReception), (a.occurrences ?? 1) > 1 ? `× ${a.occurrences}` : null,
                            a.reclamationId ? t('Réclamation {num}', { num: a.reclamationNum || `#${a.reclamationId}` }) : null]
                            .filter(Boolean).join(' · ')}
                        </em>
                      </span>
                      <Pastille ton={ton}>
                        {a.statut === 'RESOLUE' ? t('Résolue') : a.statut === 'IGNOREE' ? t('Ignorée') : a.statut === 'VUE' ? t('Vue') : t('À traiter')}
                      </Pastille>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="eq-cnx-pied">
            <button type="button" className="eq-bouton eq-bouton--clair" onClick={() => tester(false)} disabled={enTest}>
              {enTest ? <Loader2 size={16} className="eq-tourne" /> : <Activity size={16} />} {t('Tester maintenant')}
            </button>
          </div>
        </>
      )}
    </Bloc>
  );
}
