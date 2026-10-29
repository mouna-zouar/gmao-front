import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connecter, deconnecter, selectUtilisateur } from '../store/authSlice';

/*
 * Utilisateur connecté : l'état est maintenant dans Redux (store/authSlice.js).
 * useAuth() garde exactement la même forme qu'avant, les écrans n'ont rien à changer.
 * AuthProvider ne fait plus rien ; il est gardé pour ne pas casser main.jsx.
 */

export function AuthProvider({ children }) {
  return children;
}

export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectUtilisateur);

  const login = useCallback(
    (loginValue, password) => dispatch(connecter({ login: loginValue, password })).unwrap(),
    [dispatch]
  );

  const logout = useCallback(() => {
    dispatch(deconnecter());
  }, [dispatch]);

  return useMemo(() => ({
    user,
    isAuthenticated: !!user,
    login,
    logout,
    userId: user?.userId ?? null,
    serviceId: user?.serviceId ?? null,
    prestataireId: user?.prestataireId ?? null,
    cliniqueId: user?.cliniqueId ?? null,
    privileges: user?.privileges ?? [],
  }), [user, login, logout]);
}

/** Vrai si l'utilisateur connecté a le privilège `code`. */
export function useDroit(code) {
  const user = useSelector(selectUtilisateur);
  return (user?.privileges ?? []).includes(code);
}

export default null;
