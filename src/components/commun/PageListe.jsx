import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Download, Inbox, Loader2, Pencil, Plus, Printer, RotateCcw, Search, Settings2, Trash2,
} from 'lucide-react';
import ConfirmModal from '../ui/modals/ConfirmModal';
import ColumnSettingsModal from '../ui/modals/ColumnSettingsModal';
import Pagination from './Pagination';
import { imprimerListe } from '../../utils/imprimerListe';
import { t, locale } from '../../i18n';
import PastillesStats from './PastillesStats';
import './commun.css';


export default function PageListe({
  icone: Icone, titre, sousTitre, stats = [], colonnes, lignes = [], chargement = false, erreur = null,
  cleLigne = 'id', onAjouter, libelleAjouter, onModifier, onSupprimer, messageSuppression, onOuvrir,
  actions = [], filtres, recherchePlaceholder, cleStockage, nomExport, vide = {}, taillePage = 10,
  selection: selectionControlee, onSelection, avantTableau, children,
  triInitial, colonnesExport, filtresImpression = [], classe,
}) {
  /* Colonnes : visibilité et recherche réglables, gardées dans ce navigateur */
  const cle = cleStockage ? `gmao.liste.${cleStockage}.colonnes` : null;
  const [reglages, setReglages] = useState(() => {
    try { return cle ? JSON.parse(localStorage.getItem(cle) || '{}') : {}; } catch { return {}; }
  });
  useEffect(() => { if (cle) { try { localStorage.setItem(cle, JSON.stringify(reglages)); } catch { /* stockage indisponible */ } } }, [cle, reglages]);
  const cols = colonnes.map((c) => ({
    ...c,
    visible: reglages[c.cle]?.visible ?? (c.visible !== false),
    recherche: reglages[c.cle]?.recherche ?? (c.recherche !== false),
  }));
  const visibles = cols.filter((c) => c.visible);
  const [reglageOuvert, setReglageOuvert] = useState(false);

  const [recherche, setRecherche] = useState('');
  const triDefaut = triInitial || { cle: null, sens: 'asc' };
  const [tri, setTri] = useState(triDefaut);
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(taillePage);
  const [selInterne, setSelInterne] = useState(null);
  const selection = selectionControlee !== undefined ? selectionControlee : selInterne;
  const choisir = (l) => { setSelInterne(l); onSelection?.(l); };
  const [confirmation, setConfirmation] = useState(null);
  const [suppression, setSuppression] = useState(false);

  const texte = (c, l) => {
    const v = c.texte ? c.texte(l) : (c.valeur ? c.valeur(l) : l?.[c.cle]);
    return v == null ? '' : String(v);
  };

  const filtrees = useMemo(() => {
    const mots = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const cherchables = cols.filter((c) => c.recherche);
    let r = lignes.filter((l) => mots.every((m) => cherchables.some((c) => texte(c, l).toLowerCase().includes(m))));
    if (tri.cle) {
      const c = cols.find((x) => x.cle === tri.cle);
      if (c) {
        r = [...r].sort((a, b) => {
          const va = c.valeur ? c.valeur(a) : a?.[c.cle];
          const vb = c.valeur ? c.valeur(b) : b?.[c.cle];
          if (typeof va === 'number' && typeof vb === 'number') return va - vb;
          return String(va ?? '').localeCompare(String(vb ?? ''), locale(), { sensitivity: 'base', numeric: true });
        });
        if (tri.sens === 'desc') r.reverse();
      }
    }
    return r;
  }, [lignes, recherche, tri, reglages, colonnes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(0); }, [recherche, tri, lignes.length]);
  const pageLignes = filtrees.slice(page * taille, page * taille + taille);
  const idSel = selection?.[cleLigne];

  const trier = (c) => {
    if (c.triable === false) return;
    setTri((p) => (p.cle === c.cle ? { cle: c.cle, sens: p.sens === 'asc' ? 'desc' : 'asc' } : { cle: c.cle, sens: 'asc' }));
  };

  const demanderSuppression = () => {
    if (!selection || !onSupprimer) return;
    setConfirmation({
      titre: t('Supprimer'),
      message: messageSuppression ? messageSuppression(selection) : t('Supprimer cet élément ? Cette action est irréversible.'),
      confirmer: async () => {
        setConfirmation(null);
        setSuppression(true);
        try {
          await onSupprimer(selection);
          choisir(null);
        } catch (err) {
          setConfirmation({ titre: t('Suppression impossible'), message: err?.response?.data?.message || t('Échec de la suppression.'), info: true });
        } finally {
          setSuppression(false);
        }
      },
    });
  };

  /* Export et impression : colonnes visibles, lignes filtrées */
  const donnees = () => ({
    entetes: (colonnesExport || visibles).map((c) => t(c.label)),
    lignes: filtrees.map((l) => (colonnesExport || visibles).map((c) => texte(c, l) || '—')),
  });
  const exporterCsv = () => {
    const { entetes, lignes: ls } = donnees();
    const csv = [entetes, ...ls].map((l) => l.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nomExport || 'liste'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const imprimer = () => {
    const { entetes, lignes: ls } = donnees();
    imprimerListe({ titre, colonnes: entetes, lignes: ls, filtres: [{ label: t('Recherche'), valeur: recherche.trim() }, ...filtresImpression] });
  };

  const ouvrir = onOuvrir || onModifier;

  return (
    <div className={`cl-page ${classe || ''}`.trim()}>
      {/* En-tête */}
      <div className="cl-entete">
        <div className="cl-entete__gauche">
          {Icone && <span className="cl-entete__icone"><Icone size={24} strokeWidth={2} aria-hidden="true" /></span>}
          <div>
            <h1>{titre}</h1>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
        </div>
        <PastillesStats stats={stats} />
      </div>

      {/* Actions */}
      {(onAjouter || onModifier || onSupprimer || actions.length > 0) && (
        <div className="cl-actions">
          {onAjouter && (
            <button type="button" className="cl-action cl-action--principal" onClick={onAjouter}>
              <Plus size={18} strokeWidth={2.5} /> <span>{libelleAjouter || t('Ajouter')}</span>
            </button>
          )}
          {onModifier && (
            <button type="button" className="cl-action cl-action--modifier" disabled={!selection} onClick={() => onModifier(selection)}>
              <Pencil size={18} /> <span>{t('Modifier')}</span>
            </button>
          )}
          {onSupprimer && (
            <button type="button" className="cl-action cl-action--supprimer" disabled={!selection || suppression} onClick={demanderSuppression}>
              {suppression ? <Loader2 size={18} className="cf-tourne" /> : <Trash2 size={18} />}
              <span>{suppression ? t('Suppression…') : t('Supprimer')}</span>
            </button>
          )}
          {actions.map((a) => {
            const AIcone = a.icone;
            return (
              <button key={a.label} type="button" className={`cl-action ${a.classe || ''}`}
                disabled={(a.besoinSelection && !selection) || a.desactive} onClick={() => a.onClick(selection)} title={a.aide}>
                {AIcone && <AIcone size={18} />} <span>{a.label}</span>
              </button>
            );
          })}
          {selection && <span className="cl-actions__sel">{t('1 ligne sélectionnée')}</span>}
        </div>
      )}

      {/* Recherche, filtres, export */}
      <div className="cl-filtres">
        <label className="cl-recherche">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder={recherchePlaceholder || t('Rechercher dans les colonnes actives...')} aria-label={t('Recherche')} />
        </label>
        {filtres}
        <button type="button" className="cl-btn-discret" onClick={() => { setRecherche(''); setTri(triDefaut); }}>
          <RotateCcw size={14} /> {t('Réinitialiser')}
        </button>
        <div className="cl-icones">
          <button type="button" onClick={exporterCsv} title={t('Export CSV')} aria-label={t('Export CSV')}><Download size={16} /></button>
          <button type="button" onClick={imprimer} title={t('Imprimer')} aria-label={t('Imprimer')}><Printer size={16} /></button>
          <button type="button" onClick={() => setReglageOuvert(true)} title={t('Paramètres des colonnes')} aria-label={t('Paramètres des colonnes')}><Settings2 size={16} /></button>
        </div>
      </div>

      {erreur && <p className="cl-erreur" role="alert"><AlertTriangle size={18} /> {erreur}</p>}
      {avantTableau}

      {/* Tableau */}
      <div className="cl-table-cadre">
        <table className="cl-table">
          <thead>
            <tr>
              {visibles.map((c) => {
                const actif = tri.cle === c.cle;
                return (
                  <th key={c.cle} style={c.largeur ? { width: c.largeur } : undefined}
                    className={`${c.triable === false ? '' : 'est-triable'} ${actif ? 'est-trie' : ''} ${c.alignement === 'droite' ? 'a-droite' : ''}`}
                    onClick={() => trier(c)} aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <span>
                      {t(c.label)}
                      {c.triable !== false && (actif ? (tri.sens === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} className="cl-tri-repos" />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {chargement ? (
              <tr><td colSpan={visibles.length || 1}><div className="cl-vide"><Loader2 size={24} className="cf-tourne" /> {t('Chargement…')}</div></td></tr>
            ) : filtrees.length === 0 ? (
              <tr><td colSpan={visibles.length || 1}><div className="cl-vide"><Inbox size={30} strokeWidth={1.6} />
                {lignes.length === 0 ? (vide.aucun || t('Aucun élément pour l’instant.')) : (vide.aucunFiltre || t('Aucun élément ne correspond à ces filtres.'))}
              </div></td></tr>
            ) : pageLignes.map((l) => {
              const id = l[cleLigne];
              return (
                <tr key={id} className={idSel === id ? 'est-selectionnee' : ''} tabIndex={0}
                  onClick={() => choisir(idSel === id ? null : l)}
                  onDoubleClick={ouvrir ? () => { window.getSelection?.()?.removeAllRanges(); choisir(l); ouvrir(l); } : undefined}
                  onKeyDown={(e) => { if (e.key === 'Enter' && ouvrir) { choisir(l); ouvrir(l); } }}
                  title={ouvrir ? t('Double-clic pour ouvrir la fiche') : undefined}
                  aria-selected={idSel === id}>
                  {visibles.map((c) => (
                    <td key={c.cle} className={c.alignement === 'droite' ? 'a-droite' : ''}>
                      {c.rendu ? c.rendu(l) : (texte(c, l) || <span className="cl-tiret">—</span>)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!chargement && filtrees.length > 0 && (
        <Pagination page={page} taille={taille} total={filtrees.length} onPage={setPage} onTaille={(v) => { setTaille(v); setPage(0); }} />
      )}

      {children}

      <ColumnSettingsModal
        show={reglageOuvert}
        onClose={() => setReglageOuvert(false)}
        columns={cols.map((c) => ({ key: c.cle, label: t(c.label), visible: c.visible, searchable: c.recherche }))}
        onToggleVisibility={(k) => setReglages((r) => ({ ...r, [k]: { ...r[k], visible: !(r[k]?.visible ?? (colonnes.find((c) => c.cle === k)?.visible !== false)) } }))}
        onToggleSearch={(k) => setReglages((r) => ({ ...r, [k]: { ...r[k], recherche: !(r[k]?.recherche ?? (colonnes.find((c) => c.cle === k)?.recherche !== false)) } }))}
      />
      <ConfirmModal
        show={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmation?.info ? () => setConfirmation(null) : confirmation?.confirmer}
        type={confirmation?.info ? 'warning' : 'danger'}
        title={confirmation?.titre}
        message={confirmation?.message}
        confirmText={confirmation?.info ? t('OK') : t('Supprimer')}
        cancelText={confirmation?.info ? null : t('Annuler')}
      />
    </div>
  );
}
