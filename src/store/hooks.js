import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { trouver } from './registre';
import { cleParametres } from './fabriques/communs';

export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;

export function useExecuter() {
  const dispatch = useDispatch();
  return useCallback((action) => dispatch(action).unwrap().catch((e) => {
    const message = typeof e === 'string' ? e : e?.message || 'Erreur';
    const erreur = new Error(message);
    erreur.response = { data: { message } };
    throw erreur;
  }), [dispatch]);
}

export function useLireRequete() {
  const executer = useExecuter();
  const store = useStore();
  return useCallback(async (nomOuRequete, params = {}, { forcer = false } = {}) => {
    const req = trouver(nomOuRequete);
    await executer(req.actions.executer({ params, forcer }));
    return req.selecteurs.entree(params)(store.getState()).donnees;
  }, [executer, store]);
}

export function useReferentiel(nomOuRef, { auto = true } = {}) {
  const ref = trouver(nomOuRef);
  const dispatch = useDispatch();
  const liste = useSelector(ref.selecteurs.liste);
  const statut = useSelector(ref.selecteurs.statut);
  const erreur = useSelector(ref.selecteurs.erreur);
  const chargeLe = useSelector(ref.selecteurs.chargeLe);
  const recharger = useCallback((forcer = true) => dispatch(ref.actions.charger({ forcer })), [dispatch, ref]);
  useEffect(() => { if (auto) dispatch(ref.actions.charger()); }, [auto, dispatch, ref, chargeLe]);
  return { liste, statut, erreur, chargement: statut === 'chargement', pret: statut === 'pret', recharger };
}

export function useModule(nomOuModule, params = undefined, { auto = true } = {}) {
  const mod = trouver(nomOuModule);
  const dispatch = useDispatch();
  const cle = cleParametres(params);
  const elements = useSelector(mod.selecteurs.elements);
  const total = useSelector(mod.selecteurs.total);
  const statut = useSelector(mod.selecteurs.statut);
  const erreur = useSelector(mod.selecteurs.erreur);
  const erreurAction = useSelector(mod.selecteurs.erreurAction);
  const filtres = useSelector(mod.selecteurs.filtres);
  const selection = useSelector(mod.selecteurs.selection);
  const chargeLe = useSelector((s) => s[mod.nom].chargeLe);
  const actions = useMemo(() => Object.fromEntries(Object.entries(mod.actions).map(([k, a]) => [k, (arg) => dispatch(a(arg))])), [dispatch, mod]);
  useEffect(() => {
    if (auto && params !== null) dispatch(mod.actions.charger({ params }));
  }, [auto, dispatch, mod, cle, chargeLe]); // eslint-disable-line react-hooks/exhaustive-deps
  const recharger = useCallback(() => dispatch(mod.actions.charger({ params, forcer: true })), [dispatch, mod, cle]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    elements, total, statut, erreur, erreurAction, filtres, selection,
    chargement: statut === 'chargement', pret: statut === 'pret', actions, recharger,
  };
}

export function useRequete(nomOuRequete, params = {}, { auto = true, intervalleMs = 0 } = {}) {
  const req = trouver(nomOuRequete);
  const dispatch = useDispatch();
  const cle = cleParametres(params);
  const selecteur = useMemo(() => req.selecteurs.entree(params), [req, cle]); // eslint-disable-line react-hooks/exhaustive-deps
  const entree = useSelector(selecteur);
  const recharger = useCallback((forcer = true) => dispatch(req.actions.executer({ params, forcer })), [dispatch, req, cle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (auto) recharger(false); }, [auto, recharger, entree.chargeLe === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!auto || !intervalleMs) return undefined;
    const id = setInterval(() => { if (!document.hidden) recharger(true); }, intervalleMs);
    return () => clearInterval(id);
  }, [auto, intervalleMs, recharger]);
  return {
    donnees: entree.donnees, statut: entree.statut, erreur: entree.erreur, chargeLe: entree.chargeLe,
    chargement: entree.statut === 'chargement', enCours: entree.enCours, pret: entree.statut === 'pret', recharger,
  };
}
