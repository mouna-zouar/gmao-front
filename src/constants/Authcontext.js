
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';

import authService from '../services/Authservice';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getSession());

  const login = useCallback(async (loginValue, password) => {
    const session = await authService.login(loginValue, password);

    setUser(session);

    return session;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    userId: user?.userId ?? null,
    serviceId: user?.serviceId ?? null,
    prestataireId: user?.prestataireId ?? null,
    cliniqueId: user?.cliniqueId ?? null,
    privileges: user?.privileges ?? [],
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth doit être utilisé à l'intérieur d'un <AuthProvider>"
    );
  }

  return ctx;
}

export default AuthContext;
