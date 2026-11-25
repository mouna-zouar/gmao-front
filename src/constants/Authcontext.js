import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { connecter, deconnecter, selectUtilisateur } from '../store/authSlice';
import { aDroitPour } from './privileges';

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

export function useDroit(code) {
  const user = useSelector(selectUtilisateur);
  return aDroitPour(user, code);
}

export default null;
