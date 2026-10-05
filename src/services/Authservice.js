
import api from './api';

const login = (login, password) => {
  return api.post('/auth/login', { login, password });
};

const setSession = (data) => {
  localStorage.setItem(
    'user',
    JSON.stringify({
      login: data.login,
      admin: data.admin,

      userId: data.userId ?? null,

      serviceId: data.serviceId ?? null,
      serviceNom: data.serviceNom ?? null,

      prestataireId: data.prestataireId ?? null,
      prestataireNom: data.prestataireNom ?? null,

      cliniqueId: data.cliniqueId ?? null,
      cliniqueNom: data.cliniqueNom ?? null,
    })
  );

  localStorage.setItem(
    'privileges',
    JSON.stringify(data.privileges || [])
  );

  localStorage.setItem('sessionId', data.sessionId);
};

const logout = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('privileges');
  localStorage.removeItem('sessionId');
};

const getCurrentUser = () => {
  const user = localStorage.getItem('user');

  if (!user) return null;

  try {
    return JSON.parse(user);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const getPrivileges = () => {
  const privileges = localStorage.getItem('privileges');

  if (!privileges) return [];

  try {
    return JSON.parse(privileges);
  } catch {
    localStorage.removeItem('privileges');
    return [];
  }
};

const getSessionId = () => {
  return localStorage.getItem('sessionId');
};

const getUserId = () => {
  return getCurrentUser()?.userId ?? null;
};

const getServiceId = () => {
  return getCurrentUser()?.serviceId ?? null;
};

const getPrestataireId = () => {
  return getCurrentUser()?.prestataireId ?? null;
};

const getCliniqueId = () => {
  return getCurrentUser()?.cliniqueId ?? null;
};

const getServiceNom = () => {
  return getCurrentUser()?.serviceNom ?? null;
};

const getPrestataireNom = () => {
  return getCurrentUser()?.prestataireNom ?? null;
};

const getCliniqueNom = () => {
  return getCurrentUser()?.cliniqueNom ?? null;
};

const hasPrivilege = (code) => {
  return getPrivileges().includes(code);
};

const isAuthenticated = () => {
  return !!getSessionId();
};

const getContexteMetier = () => {
  const user = getCurrentUser();

  return {
    userId: user?.userId ?? null,
    user: user?.login ?? null,

    serviceId: user?.serviceId ?? null,
    serviceNom: user?.serviceNom ?? null,

    prestataireId: user?.prestataireId ?? null,
    prestataireNom: user?.prestataireNom ?? null,

    cliniqueId: user?.cliniqueId ?? null,
    cliniqueNom: user?.cliniqueNom ?? null,
  };
};

const authService = {
  login,
  logout,
  setSession,
  getCurrentUser,
  getPrivileges,
  getSessionId,
  getUserId,
  getServiceId,
  getPrestataireId,
  getCliniqueId,
  getServiceNom,
  getPrestataireNom,
  getCliniqueNom,
  getContexteMetier,
  hasPrivilege,
  isAuthenticated,
};

export default authService;